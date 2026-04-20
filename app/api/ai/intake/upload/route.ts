import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  AI_INTAKE_MAX_FILE_BYTES,
  AI_INTAKE_ORGANIZATION_ID,
  AI_INTAKE_STORAGE_BUCKET,
} from '@/lib/ai/intake/constants';
import type { IntakeSourceType } from '@/lib/ai/intake/types';

export const runtime = 'nodejs';

type UploadResponse = {
  ok: boolean;
  document_id?: string;
  source_type?: IntakeSourceType;
  original_filename?: string | null;
  mime_type?: string | null;
  message?: string;
};

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'intake-source';
}

function sourceTypeFromFile(file: File): IntakeSourceType | null {
  const name = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  return null;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json<UploadResponse>({ ok: false, message }, { status });
}

async function createTextDocument(rawText: string, originalFilename: string | null) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('ai_intake_documents')
    .insert({
      organization_id: AI_INTAKE_ORGANIZATION_ID,
      source_type: 'text',
      original_filename: originalFilename,
      mime_type: 'text/plain',
      raw_text: rawText,
      status: 'uploaded',
    })
    .select('id,source_type,original_filename,mime_type')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not create text intake document.');
  }

  return data as {
    id: string;
    source_type: IntakeSourceType;
    original_filename: string | null;
    mime_type: string | null;
  };
}

async function createFileDocument(file: File, sourceType: IntakeSourceType) {
  const supabase = supabaseAdmin();
  const filename = sanitizeFilename(file.name || `intake.${sourceType === 'pdf' ? 'pdf' : 'png'}`);
  const storagePath = `${AI_INTAKE_ORGANIZATION_ID}/${Date.now()}-${crypto.randomUUID()}-${filename}`;
  const fileBytes = Buffer.from(await file.arrayBuffer());

  const { error: storageError } = await supabase.storage
    .from(AI_INTAKE_STORAGE_BUCKET)
    .upload(storagePath, fileBytes, {
      contentType: file.type || (sourceType === 'pdf' ? 'application/pdf' : 'image/png'),
      upsert: false,
    });

  if (storageError) {
    throw new Error(
      `Could not store intake file. Apply docs/supabase-ai-intake.sql and retry. Supabase said: ${storageError.message}`
    );
  }

  const { data, error } = await supabase
    .from('ai_intake_documents')
    .insert({
      organization_id: AI_INTAKE_ORGANIZATION_ID,
      source_type: sourceType,
      original_filename: filename,
      mime_type: file.type || (sourceType === 'pdf' ? 'application/pdf' : 'image/png'),
      storage_path: storagePath,
      status: 'uploaded',
    })
    .select('id,source_type,original_filename,mime_type')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not create file intake document.');
  }

  return data as {
    id: string;
    source_type: IntakeSourceType;
    original_filename: string | null;
    mime_type: string | null;
  };
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const body = (await req.json()) as { raw_text?: unknown; original_filename?: unknown };
      const rawText = typeof body.raw_text === 'string' ? body.raw_text.trim() : '';

      if (!rawText) {
        return jsonError('Paste text before uploading an intake document.');
      }

      const document = await createTextDocument(
        rawText,
        typeof body.original_filename === 'string' ? body.original_filename : null
      );

      return NextResponse.json<UploadResponse>({
        ok: true,
        document_id: document.id,
        source_type: document.source_type,
        original_filename: document.original_filename,
        mime_type: document.mime_type,
      });
    }

    const form = await req.formData();
    const rawText = form.get('raw_text');
    const file = form.get('file');

    if (typeof rawText === 'string' && rawText.trim()) {
      const document = await createTextDocument(rawText.trim(), 'pasted-text.txt');

      return NextResponse.json<UploadResponse>({
        ok: true,
        document_id: document.id,
        source_type: document.source_type,
        original_filename: document.original_filename,
        mime_type: document.mime_type,
      });
    }

    if (!(file instanceof File)) {
      return jsonError('Upload a PDF, image, screenshot, or paste text.');
    }

    if (file.size > AI_INTAKE_MAX_FILE_BYTES) {
      return jsonError('Intake files are limited to 20 MB.');
    }

    const sourceType = sourceTypeFromFile(file);
    if (!sourceType) {
      return jsonError('Only PDF and image uploads are supported in Phase 1.');
    }

    const document = await createFileDocument(file, sourceType);

    return NextResponse.json<UploadResponse>({
      ok: true,
      document_id: document.id,
      source_type: document.source_type,
      original_filename: document.original_filename,
      mime_type: document.mime_type,
    });
  } catch (error) {
    return NextResponse.json<UploadResponse>(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Upload failed.',
      },
      { status: 500 }
    );
  }
}
