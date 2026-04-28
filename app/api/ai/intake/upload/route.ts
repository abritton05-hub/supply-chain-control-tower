import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { logActivity } from '@/lib/activity/log-activity';

export const runtime = 'nodejs';

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

      const documentId = `text-${Date.now()}`;
      const activity = await logActivity({
        actionType: 'AI_INTAKE_DRAFT_CREATED',
        module: 'ai_intake',
        recordId: documentId,
        recordLabel: 'text intake',
        actor: profile.email || profile.full_name || 'unknown',
        details: { source_type: 'text' },
      });
      if (!activity.ok) console.warn('AI intake draft create logging failed.', activity.message);

      return NextResponse.json({
        ok: true,
        document_id: documentId,
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
      const documentId = `text-${Date.now()}`;
      const activity = await logActivity({
        actionType: 'AI_INTAKE_DRAFT_CREATED',
        module: 'ai_intake',
        recordId: documentId,
        recordLabel: 'text intake',
        actor: profile.email || profile.full_name || 'unknown',
        details: { source_type: 'text' },
      });
      if (!activity.ok) console.warn('AI intake draft create logging failed.', activity.message);

      return NextResponse.json({
        ok: true,
        document_id: documentId,
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
    const base64 = Buffer.from(buffer).toString('base64');

    const documentId = `file-${Date.now()}`;
    const activity = await logActivity({
      actionType: 'AI_INTAKE_DRAFT_CREATED',
      module: 'ai_intake',
      recordId: documentId,
      recordLabel: file.name || 'uploaded intake file',
      actor: profile.email || profile.full_name || 'unknown',
      details: { source_type: mime === 'application/pdf' ? 'pdf' : 'image', mime_type: file.type || null },
    });
    if (!activity.ok) console.warn('AI intake draft create logging failed.', activity.message);

    return NextResponse.json({
      ok: true,
      document_id: documentId,
      source: {
        source_type: mime === 'application/pdf' ? 'pdf' : 'image',
        file_base64: base64,
        raw_text: rawText || null,
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
