import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canManageDelivery } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const BUCKET = 'signed-boms';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

type SignedBomRow = {
  id: string;
  manifest_number: string | null;
  bom_number: string | null;
  stop_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeSegment(value: string, fallback: string) {
  const cleaned = value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/-+/g, '-');

  return cleaned || fallback;
}

function safeFileName(name: string) {
  const withoutPath = name.split(/[/\\]/).pop() || '';
  return safeSegment(withoutPath, 'upload.bin');
}

function extensionOf(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

function storageKey(filePath: string) {
  return filePath.startsWith(`${BUCKET}/`) ? filePath.slice(BUCKET.length + 1) : filePath;
}

async function requireActiveUser() {
  const profile = await getCurrentUserProfile();

  if (!profile.is_active) {
    return {
      profile,
      response: NextResponse.json({ ok: false, message: 'Access denied.' }, { status: 403 }),
    };
  }

  return { profile, response: null as NextResponse<unknown> | null };
}

export async function GET(request: Request) {
  try {
    const auth = await requireActiveUser();
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const manifestNumber = cleanText(searchParams.get('manifest_number'));
    const bomNumber = cleanText(searchParams.get('bom_number'));
    const stopId = cleanText(searchParams.get('stop_id'));

    const admin = await supabaseAdmin();

    let query = admin
      .from('signed_bom_files')
      .select(
        'id,manifest_number,bom_number,stop_id,file_name,file_path,file_type,uploaded_by,uploaded_at'
      )
      .order('uploaded_at', { ascending: false })
      .limit(100);

    if (manifestNumber) query = query.eq('manifest_number', manifestNumber);
    if (bomNumber) query = query.eq('bom_number', bomNumber);
    if (stopId) query = query.eq('stop_id', stopId);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    const rows = (data || []) as SignedBomRow[];
    const rowsWithUrls = await Promise.all(
      rows.map(async (row) => {
        const { data: signed, error: signedError } = await admin.storage
          .from(BUCKET)
          .createSignedUrl(storageKey(row.file_path), 60 * 60);

        return {
          ...row,
          signed_url: signedError ? null : signed?.signedUrl || null,
        };
      })
    );

    return NextResponse.json({ ok: true, rows: rowsWithUrls });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Load failed.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireActiveUser();
    if (auth.response) return auth.response;

    if (!canManageDelivery(auth.profile.role)) {
      return NextResponse.json(
        { ok: false, message: 'Warehouse or admin access is required for signed BOM uploads.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: 'No file uploaded.' }, { status: 400 });
    }

    const manifestNumber = cleanText(formData.get('manifest_number'));
    const bomNumber = cleanText(formData.get('bom_number'));
    const stopId = cleanText(formData.get('stop_id'));

    if (!manifestNumber) {
      return NextResponse.json(
        { ok: false, message: 'Manifest number is required.' },
        { status: 400 }
      );
    }

    if (!bomNumber && !stopId) {
      return NextResponse.json(
        { ok: false, message: 'BOM number or stop id is required.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, message: 'File is too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    const safeName = safeFileName(file.name || 'upload.bin');
    const ext = extensionOf(safeName);
    const mime = cleanText(file.type).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { ok: false, message: 'Unsupported file extension.' },
        { status: 400 }
      );
    }

    if (mime && !ALLOWED_MIME_TYPES.has(mime)) {
      return NextResponse.json({ ok: false, message: 'Unsupported file type.' }, { status: 400 });
    }

    const manifestSegment = safeSegment(manifestNumber, 'manifest');
    const targetSegment = safeSegment(bomNumber || stopId, 'unknown');
    const timestamp = Date.now();
    const key = `${manifestSegment}/${targetSegment}/${timestamp}-${safeName}`;
    const filePath = `${BUCKET}/${key}`;

    const bytes = await file.arrayBuffer();
    const admin = await supabaseAdmin();

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(key, Buffer.from(bytes), {
      contentType: mime || (ext === 'pdf' ? 'application/pdf' : undefined),
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json({ ok: false, message: uploadError.message }, { status: 500 });
    }

    const insertPayload = {
      manifest_number: manifestNumber,
      bom_number: bomNumber || null,
      stop_id: stopId || null,
      file_name: file.name || safeName,
      file_path: filePath,
      file_type: mime || null,
      uploaded_by: auth.profile.email || auth.profile.full_name || 'Unknown',
    };

    const { data, error } = await admin
      .from('signed_bom_files')
      .insert(insertPayload)
      .select('id,manifest_number,bom_number,stop_id,file_name,file_path,file_type,uploaded_by,uploaded_at')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Upload failed.' },
      { status: 500 }
    );
  }
}
