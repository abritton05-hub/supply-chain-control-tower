import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';

export async function GET() {
  try {
    const profile = await getCurrentUserProfile();

    return NextResponse.json({
      ok: true,
      profile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to load current user.',
      },
      { status: 500 }
    );
  }
}