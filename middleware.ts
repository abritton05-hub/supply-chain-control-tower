import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function isProtectedPath(pathname: string) {
  if (pathname.startsWith('/_next')) return false;
  if (pathname.startsWith('/api')) return false;
  if (pathname.startsWith('/favicon')) return false;
  if (pathname === '/login') return false;

  return true;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/inventory', request.url));
  }

  if (isProtectedPath(pathname) && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};