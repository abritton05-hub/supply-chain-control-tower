import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canManageDelivery } from '@/lib/auth/roles';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function assertConfig() {
  if (!SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.');
  if (!SUPABASE_KEY) throw new Error('Missing Supabase API key.');
}

function headers(prefer = 'return=representation') {
  return {
    apikey: SUPABASE_KEY!,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLocationCode(value: unknown) {
  const code = clean(value).toUpperCase();

  if (code === 'WH') return 'WH/A13';
  if (code === 'A13') return 'WH/A13';
  if (code === 'WH/A13') return 'WH/A13';

  return code;
}

function buildAddress(row: Record<string, unknown>) {
  const directAddress = clean(row.address);
  if (directAddress) return directAddress;

  const line1 = clean(row.address_line_1);
  const city = clean(row.city);
  const state = clean(row.state);
  const postalCode = clean(row.postal_code);
  const cityStateZip = [city, state, postalCode].filter(Boolean).join(' ');

  return [line1, cityStateZip].filter(Boolean).join('\n');
}

function parseAddress(address: string) {
  const lines = address
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const addressLine1 = lines[0] || '';
  const secondLine = lines[1] || '';
  const zipMatch = secondLine.match(/\b\d{5}(?:-\d{4})?\b/);
  const postalCode = zipMatch?.[0] || '';
  const beforeZip = postalCode ? secondLine.replace(postalCode, '').trim() : secondLine;
  const parts = beforeZip.split(/\s+/).filter(Boolean);
  const state = parts.length ? parts[parts.length - 1] : '';
  const city = parts.length > 1 ? parts.slice(0, -1).join(' ') : beforeZip;

  return {
    address_line_1: addressLine1,
    city,
    state,
    postal_code: postalCode,
  };
}

async function requireDeliveryAccess() {
  const profile = await getCurrentUserProfile();

  if (!canManageDelivery(profile.role)) {
    return NextResponse.json(
      { ok: false, message: 'Warehouse or admin access is required for shipping locations.' },
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
      `${SUPABASE_URL}/rest/v1/shipping_locations?select=*&order=code.asc`,
      { headers: headers(), cache: 'no-store' }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: data.message || 'Load failed.' },
        { status: res.status }
      );
    }

    const locations = (Array.isArray(data) ? data : []).map((row) => ({
      ...row,
      code: clean(row.code).toUpperCase(),
      display_name: clean(row.display_name) || clean(row.code).toUpperCase(),
      address: buildAddress(row),
      contact_name: clean(row.contact_name),
      contact_phone: clean(row.contact_phone),
      notes: clean(row.notes),
    }));

    return NextResponse.json({ ok: true, locations });
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
    const code = normalizeLocationCode(body.code);
    const address = clean(body.address);
    const parsedAddress = parseAddress(address);

    if (!code) {
      return NextResponse.json({ ok: false, message: 'Location code is required.' }, { status: 400 });
    }

    const payload = {
      code,
      display_name: clean(body.display_name) || code,
      address_line_1: clean(body.address_line_1) || parsedAddress.address_line_1,
      city: clean(body.city) || parsedAddress.city,
      state: clean(body.state) || parsedAddress.state,
      postal_code: clean(body.postal_code) || parsedAddress.postal_code,
      contact_name: clean(body.contact_name),
      contact_phone: clean(body.contact_phone),
      updated_at: new Date().toISOString(),
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/shipping_locations`, {
      method: 'POST',
      headers: headers('resolution=merge-duplicates,return=representation'),
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: data.message || 'Save failed.' },
        { status: res.status }
      );
    }

    const location = data?.[0]
      ? {
          ...data[0],
          address: buildAddress(data[0]),
          notes: clean(data[0].notes),
        }
      : null;

    return NextResponse.json({ ok: true, location });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Save failed.' },
      { status: 500 }
    );
  }
}
