import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canManageDelivery } from '@/lib/auth/roles';
import { logTransaction } from '@/lib/transactions/log-transaction';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function headers() {
  if (!SUPABASE_KEY) throw new Error('Missing Supabase key.');

  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

function assertConfig() {
  if (!SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.');
  if (!SUPABASE_KEY) throw new Error('Missing Supabase API key.');
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isMissingRelationError(data: unknown, relation: string) {
  if (!isObject(data)) return false;
  const message = [data.message, data.details, data.hint, data.code]
    .map((value) => (typeof value === 'string' ? value : ''))
    .join(' ')
    .toLowerCase();
  return message.includes(relation.toLowerCase()) && message.includes('does not exist');
}

function bomReference(body: Record<string, unknown>) {
  return [body.bom_number, body.manifest_number, body.reference]
    .map(cleanText)
    .filter(Boolean)
    .join(' | ');
}

async function requireDeliveryAccess() {
  const profile = await getCurrentUserProfile();

  if (!canManageDelivery(profile.role)) {
    return NextResponse.json(
      { ok: false, message: 'Warehouse or admin access is required for shipping records.' },
      { status: 403 }
    );
  }

  return null;
}

export async function GET() {
  try {
    const forbidden = await requireDeliveryAccess();
    if (forbidden) return forbidden;

    assertConfig();

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/shipping_bom_history?select=*&order=created_at.desc`,
      {
        method: 'GET',
        headers: headers(),
        cache: 'no-store',
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ ok: false, message: data.message || 'Load failed.' }, { status: res.status });
    }

    return NextResponse.json({ ok: true, rows: data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Load failed.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const forbidden = await requireDeliveryAccess();
    if (forbidden) return forbidden;

    assertConfig();

    const body = await request.json();

    const res = await fetch(`${SUPABASE_URL}/rest/v1/shipping_bom_history`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ ok: false, message: data.message || 'Save failed.' }, { status: res.status });
    }

    const row = data?.[0] ?? body;
    const logResult = await logTransaction({
      transaction_type: 'BOM_CREATED',
      description: body.items || body.reference || 'BOM created',
      quantity: null,
      from_location: body.ship_from,
      to_location: body.ship_to,
      reference: bomReference(body),
      notes: body.notes,
      entity_type: 'shipping_bom_history',
      entity_id: row?.id ? String(row.id) : body.bom_number,
      details: body,
      write_inventory_transaction: true,
      write_activity_log: true,
    });

    if (logResult.ok === false) {
      console.error('BOM transaction logging failed.', {
        bomNumber: body.bom_number,
        message: logResult.message,
      });
    }

    return NextResponse.json({ ok: true, row: data?.[0] ?? null });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Save failed.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const forbidden = await requireDeliveryAccess();
    if (forbidden) return forbidden;

    assertConfig();

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = cleanText(body.id);
    const bomNumber = cleanText(body.bom_number);

    if (!id && !bomNumber) {
      return NextResponse.json({ ok: false, message: 'id or bom_number is required.' }, { status: 400 });
    }

    const selectors = ['id,bom_number,manifest_number,reference'];
    let loadUrl = `${SUPABASE_URL}/rest/v1/shipping_bom_history?select=${selectors.join(',')}`;
    loadUrl += id
      ? `&id=eq.${encodeURIComponent(id)}`
      : `&bom_number=eq.${encodeURIComponent(bomNumber)}`;

    const loadRes = await fetch(loadUrl, { method: 'GET', headers: headers(), cache: 'no-store' });
    const loadData = await readJson(loadRes);
    if (!loadRes.ok) {
      return NextResponse.json(
        { ok: false, message: (isObject(loadData) && cleanText(loadData.message)) || 'Load failed.' },
        { status: loadRes.status }
      );
    }

    const rows = (Array.isArray(loadData) ? loadData : []).filter(isObject);
    if (!rows.length) {
      return NextResponse.json({ ok: false, message: 'No matching delivery receipt found.' }, { status: 404 });
    }

    const receipt = rows[0];
    const resolvedBomNumber = cleanText(receipt.bom_number) || bomNumber;

    let signedBomDeleteCount = 0;
    if (resolvedBomNumber) {
      const signedDeleteRes = await fetch(
        `${SUPABASE_URL}/rest/v1/signed_bom_files?bom_number=eq.${encodeURIComponent(resolvedBomNumber)}`,
        {
          method: 'DELETE',
          headers: headers(),
        }
      );
      const signedDeleteData = await readJson(signedDeleteRes);
      if (!signedDeleteRes.ok && !isMissingRelationError(signedDeleteData, 'signed_bom_files')) {
        return NextResponse.json(
          {
            ok: false,
            message:
              (isObject(signedDeleteData) && cleanText(signedDeleteData.message)) ||
              'Failed to delete signed delivery receipt files.',
          },
          { status: signedDeleteRes.status }
        );
      }
      if (Array.isArray(signedDeleteData)) {
        signedBomDeleteCount = signedDeleteData.length;
      }
    }

    const deleteUrl = `${SUPABASE_URL}/rest/v1/shipping_bom_history?${
      id ? `id=eq.${encodeURIComponent(id)}` : `bom_number=eq.${encodeURIComponent(bomNumber)}`
    }`;
    const deleteRes = await fetch(deleteUrl, { method: 'DELETE', headers: headers() });
    const deleteData = await readJson(deleteRes);

    if (!deleteRes.ok) {
      return NextResponse.json(
        { ok: false, message: (isObject(deleteData) && cleanText(deleteData.message)) || 'Delete failed.' },
        { status: deleteRes.status }
      );
    }

    const logResult = await logTransaction({
      transaction_type: 'BOM_CREATED',
      description: cleanText(receipt.reference) || `Delivery receipt ${resolvedBomNumber} deleted`,
      quantity: null,
      from_location: null,
      to_location: null,
      reference: bomReference(receipt),
      notes: 'Delivery receipt deleted.',
      entity_type: 'shipping_bom_history',
      entity_id: id || resolvedBomNumber || null,
      details: { ...receipt, signed_bom_file_delete_count: signedBomDeleteCount, deleted: true },
      write_inventory_transaction: false,
      write_activity_log: true,
    });

    if (logResult.ok === false) {
      console.error('Delivery receipt delete transaction logging failed.', {
        bomNumber: resolvedBomNumber,
        message: logResult.message,
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'Delivery receipt deleted.',
      deleted_count: Array.isArray(deleteData) ? deleteData.length : rows.length,
      signed_file_metadata_deleted: signedBomDeleteCount,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Delete failed.' },
      { status: 500 }
    );
  }
}
