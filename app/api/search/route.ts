import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { runGlobalSearch } from '@/lib/search/global-search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.trim() ?? '';

    if (query.length < 2) {
      return NextResponse.json({
        ok: true,
        results: [],
      });
    }

    const profile = await getCurrentUserProfile();

    if (!profile.is_active) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Access denied.',
        },
        { status: 403 }
      );
    }

    const results = await runGlobalSearch(query, {
      role: profile.role,
      limitPerEntity: 6,
    });

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Search failed.',
      },
      { status: 500 }
    );
  }
}
