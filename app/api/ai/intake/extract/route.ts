import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    return NextResponse.json({
      ok: true,
      message: 'AI intake temporarily reset',
      data: body,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Failed to process request' },
      { status: 500 }
    );
  }
}