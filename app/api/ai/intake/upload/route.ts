import { randomUUID } from 'crypto';
import heicConvert from 'heic-convert';
import { NextResponse } from 'next/server';
import {
  AI_INTAKE_ORGANIZATION_ID,
  AI_INTAKE_STORAGE_BUCKET,
  AI_INTAKE_MAX_FILE_BYTES,
} from '@/lib/ai/intake/constants';
import { supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type IntakeSourceType = 'image' | 'pdf' | 'text';

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      message,
    },
    { status }
  );
}

function safeFileName(name: string) {
  const cleaned = name
    .trim()
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || `upload-${Date.now()}`;
}

function extensionFromName(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

function isHeicFile(fileName: string, mimeType: string) {
  const extension = extensionFromName(fileName);
  const mime = mimeType.toLowerCase();

  return (
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    extension === 'heic' ||
    extension === 'heif'
  );
}

function isPdfFile(fileName: string, mimeType: string) {
  return mimeType.toLowerCase() === 'application/pdf' || extensionFromName(fileName) === 'pdf';
}

function isImageFile(fileName: string, mimeType: string) {
  const extension = extensionFromName(fileName);
  const mime = mimeType.toLowerCase();

  return (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(extension)
  );
}

async function convertHeicToJpeg(input: Buffer) {
  const converted = await heicConvert({
    buffer: input,
    format: 'JPEG',
    quality: 0.92,
  });

  return Buffer.from(converted);
}

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const body = (await request.json()) as {
        raw_text?: string;
      };

      const rawText = body.raw_text?.trim() ?? '';

      if (!rawText) {
        return jsonError('Paste text or choose a file before uploading.');
      }

      const { data, error } = await supabase
        .from('ai_intake_documents')
        .insert({
          organization_id: AI_INTAKE_ORGANIZATION_ID,
          uploaded_by: user?.id ?? null,
          source_type: 'text' satisfies IntakeSourceType,
          original_filename: null,
          mime_type: 'text/plain',
          storage_path: null,
          raw_text: rawText,
          status: 'uploaded',
        })
        .select('id, source_type, original_filename, mime_type')
        .single();

      if (error) {
        return jsonError(error.message, 500);
      }

      return NextResponse.json({
        ok: true,
        document_id: data.id,
        source_type: data.source_type,
        original_filename: data.original_filename,
        mime_type: data.mime_type,
        message: 'Text source uploaded.',
      });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return jsonError('No file provided.');
    }

    if (file.size <= 0) {
      return jsonError('The selected file is empty.');
    }

    if (file.size > AI_INTAKE_MAX_FILE_BYTES) {
      return jsonError('File is too large for intake.');
    }

    const originalName = file.name || `upload-${Date.now()}`;
    const originalMime = file.type || 'application/octet-stream';

    const allowed =
      isPdfFile(originalName, originalMime) ||
      isImageFile(originalName, originalMime) ||
      isHeicFile(originalName, originalMime);

    if (!allowed) {
      return jsonError('Unsupported file type. Upload a PDF, image, screenshot, HEIC, or paste email text.');
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());

    let uploadBuffer = rawBuffer;
    let uploadMime = originalMime;
    let uploadName = safeFileName(originalName);
    let sourceType: IntakeSourceType = 'image';

    if (isPdfFile(originalName, originalMime)) {
      sourceType = 'pdf';
      uploadMime = 'application/pdf';
    } else if (isHeicFile(originalName, originalMime)) {
      sourceType = 'image';
      uploadBuffer = await convertHeicToJpeg(rawBuffer);
      uploadMime = 'image/jpeg';
      uploadName = uploadName.replace(/\.(heic|heif)$/i, '.jpg');

      if (!uploadName.toLowerCase().endsWith('.jpg')) {
        uploadName = `${uploadName}.jpg`;
      }
    } else {
      sourceType = 'image';

      if (!uploadMime || uploadMime === 'application/octet-stream') {
        const ext = extensionFromName(originalName);
        if (ext === 'png') uploadMime = 'image/png';
        else if (ext === 'webp') uploadMime = 'image/webp';
        else uploadMime = 'image/jpeg';
      }
    }

    const storagePath = [
      AI_INTAKE_ORGANIZATION_ID,
      user?.id ?? 'anonymous',
      `${randomUUID()}-${uploadName}`,
    ].join('/');

    const { error: storageError } = await supabase.storage
      .from(AI_INTAKE_STORAGE_BUCKET)
      .upload(storagePath, uploadBuffer, {
        contentType: uploadMime,
        upsert: false,
      });

    if (storageError) {
      return jsonError(storageError.message, 500);
    }

    const { data, error } = await supabase
      .from('ai_intake_documents')
      .insert({
        organization_id: AI_INTAKE_ORGANIZATION_ID,
        uploaded_by: user?.id ?? null,
        source_type: sourceType,
        original_filename: originalName,
        mime_type: uploadMime,
        storage_path: storagePath,
        raw_text: null,
        status: 'uploaded',
      })
      .select('id, source_type, original_filename, mime_type')
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({
      ok: true,
      document_id: data.id,
      source_type: data.source_type,
      original_filename: data.original_filename,
      mime_type: data.mime_type,
      message: isHeicFile(originalName, originalMime)
        ? 'HEIC source converted to JPEG and uploaded.'
        : 'Source uploaded.',
    });
  } catch (error) {
    console.error('AI intake upload error:', error);

    return jsonError(
      error instanceof Error ? error.message : 'Upload failed.',
      500
    );
  }
}