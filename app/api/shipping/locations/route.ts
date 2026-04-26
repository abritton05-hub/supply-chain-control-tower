import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function assertConfig() {
  if (!SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.');
  if (!SUPABASE_KEY) throw new Error('Missing Supabase API key.');
}

function headers() {
  return {
    apikey: SUPABASE_KEY!,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET() {
  try {
    assertConfig();

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/shipping_locations?select=*&order=code.asc`,
      { headers: headers(), cache: 'no-store' }
    );

    const data = await res.json();

    return NextResponse.json({ ok: true, locations: data });
  } catch (error) {
    return NextResponse.json({ ok: false, message: 'Load failed.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertConfig();

    const body = await request.json();

    const payload = {
      code: clean(body.code).toUpperCase(),
      display_name: clean(body.display_name),

      address_line_1: clean(body.address_line_1),
      city: clean(body.city),
      state: clean(body.state),
      postal_code: clean(body.postal_code),

      contact_name: clean(body.contact_name),
      contact_phone: clean(body.contact_phone),

      updated_at: new Date().toISOString(),
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/shipping_locations`, {
      method: 'POST',
      headers: {
        ...headers(),
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    return NextResponse.json({ ok: true, location: data?.[0] });
  } catch {
    return NextResponse.json({ ok: false, message: 'Save failed.' }, { status: 500 });
  }
}