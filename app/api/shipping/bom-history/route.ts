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
