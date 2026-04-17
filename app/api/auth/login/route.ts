import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '').trim();

    const adminEmail = String(process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
    const adminPassword = String(process.env.ADMIN_PASSWORD ?? '').trim();

    if (!adminEmail || !adminPassword) {
      return NextResponse.json(
        { message: 'Server auth is not configured.' },
        { status: 500 }
      );
    }

    if (email !== adminEmail || password !== adminPassword) {
      return NextResponse.json(
        { message: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });

    response.cookies.set('auth-token', 'logged-in', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch {
    return NextResponse.json(
      { message: 'Invalid request.' },
      { status: 400 }
    );
  }
}