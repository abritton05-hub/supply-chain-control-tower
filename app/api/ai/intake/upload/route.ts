import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';

export const runtime = 'nodejs';

function isTextLikeFile(mime: string, name: string) {
  return (
    mime.startsWith('text/') ||
    mime === 'message/rfc822' ||
    name.endsWith('.eml') ||
    name.endsWith('.txt') ||
    name.endsWith('.csv')
  );
}

export async function POST(req: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile.is_active) {
      return NextResponse.json({ ok: false, message: 'Access denied.' }, { status: 403 });
    }

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      const rawText = String(body.raw_text || '').trim();

      if (!rawText) {
        return NextResponse.json({
          ok: false,
          message: 'Provide pasted email/request text.',
        });
      }

      return NextResponse.json({
        ok: true,
        document_id: `text-${Date.now()}`,
        source: {
          source_type: 'text',
          raw_text: rawText,
          original_filename: 'pasted-email-text.txt',
          mime_type: 'text/plain',
        },
      });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const rawText = String(formData.get('raw_text') || '').trim();

    if (!file && !rawText) {
      return NextResponse.json({
        ok: false,
        message: 'Provide a file or paste email/request text.',
      });
    }

    if (!file && rawText) {
      return NextResponse.json({
        ok: true,
        document_id: `text-${Date.now()}`,
        source: {
          source_type: 'text',
          raw_text: rawText,
          original_filename: 'pasted-email-text.txt',
          mime_type: 'text/plain',
        },
      });
    }

    if (!file) {
      return NextResponse.json({
        ok: false,
        message: 'No file provided.',
      });
    }

    const mime = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();

    const allowed =
      mime.startsWith('image/') ||
      mime === 'application/pdf' ||
      mime === 'message/rfc822' ||
      mime === 'text/plain' ||
      name.endsWith('.heic') ||
      name.endsWith('.heif') ||
      name.endsWith('.eml') ||
      name.endsWith('.msg') ||
      name.endsWith('.txt');

    if (!allowed) {
      return NextResponse.json({
        ok: false,
        message: 'Unsupported file type.',
      });
    }

    const buffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);
    const base64 = fileBuffer.toString('base64');
    const textLike = isTextLikeFile(mime, name);
    const fileText = textLike ? fileBuffer.toString('utf8').trim() : '';
    const sourceType = textLike ? 'text' : mime === 'application/pdf' ? 'pdf' : 'image';

    return NextResponse.json({
      ok: true,
      document_id: `file-${Date.now()}`,
      source: {
        source_type: sourceType,
        file_base64: base64,
        raw_text: [rawText, fileText].filter(Boolean).join('\n\n') || null,
        original_filename: file.name,
        mime_type: file.type || 'application/octet-stream',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Upload failed.',
      },
      { status: 500 }
    );
  }
}
