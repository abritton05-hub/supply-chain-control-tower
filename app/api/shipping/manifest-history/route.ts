import { NextResponse } from 'next/server';

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

export async function GET() {
  try {
    assertConfig();

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/shipping_manifest_history?select=*&order=created_at.desc`,
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
    assertConfig();

    const body = await request.json();

    const res = await fetch(`${SUPABASE_URL}/rest/v1/shipping_manifest_history`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ ok: false, message: data.message || 'Save failed.' }, { status: res.status });
    }

    return NextResponse.json({ ok: true, row: data?.[0] ?? null });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Save failed.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    assertConfig();

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }

    const { id, ...updates } = body;

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/shipping_manifest_history?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({
          ...updates,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ ok: false, message: data.message || 'Update failed.' }, { status: res.status });
    }

    return NextResponse.json({ ok: true, row: data?.[0] ?? null });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Update failed.' },
      { status: 500 }
    );
  }
}