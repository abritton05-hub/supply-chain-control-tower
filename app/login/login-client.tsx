'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

type LoginResult = {
  ok: boolean;
  message: string;
};

type StatusMessage = {
  kind: 'success' | 'error';
  text: string;
};

async function signInWithPassword(
  email: string,
  password: string
): Promise<LoginResult> {
  try {
    const supabase = supabaseBrowser();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    window.location.href = '/inventory';
    return { ok: true, message: 'Signed in.' };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Login failed unexpectedly.',
    };
  }
}

async function sendMagicLink(email: string): Promise<LoginResult> {
  try {
    const supabase = supabaseBrowser();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    return {
      ok: true,
      message: 'Magic link sent. Check your email and use the newest link.',
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Magic link failed unexpectedly.',
    };
  }
}

async function sendForgotPassword(email: string): Promise<LoginResult> {
  try {
    const supabase = supabaseBrowser();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        '/update-password'
      )}`,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    return {
      ok: true,
      message: 'Password reset link sent. Check your email.',
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Password reset failed unexpectedly.',
    };
  }
}

export function LoginClient() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await signInWithPassword(email.trim(), password);

      if (!result.ok) {
        setMessage({ kind: 'error', text: result.message });
        return;
      }

      setMessage({ kind: 'success', text: result.message });
    });
  }

  function handleMagicLink() {
    setMessage(null);

    startTransition(async () => {
      const cleanEmail = email.trim();

      if (!cleanEmail) {
        setMessage({ kind: 'error', text: 'Enter your email first.' });
        return;
      }

      const result = await sendMagicLink(cleanEmail);
      setMessage({
        kind: result.ok ? 'success' : 'error',
        text: result.message,
      });
    });
  }

  function handleForgotPassword() {
    setMessage(null);

    startTransition(async () => {
      const cleanEmail = email.trim();

      if (!cleanEmail) {
        setMessage({ kind: 'error', text: 'Enter your email first.' });
        return;
      }

      const result = await sendForgotPassword(cleanEmail);
      setMessage({
        kind: result.ok ? 'success' : 'error',
        text: result.message,
      });
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/denali-logo.png"
            alt="Denali Logistics SEA991"
            width={156}
            height={79}
            priority
            className="mb-5 h-auto w-[156px] object-contain"
          />
          <h1 className="text-2xl font-semibold text-slate-900">
            Supply Chain Control Tower
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in with your internal account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-3 text-base text-slate-900"
              placeholder="name@company.com"
              required
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isPending}
                className="text-sm font-semibold text-cyan-700 hover:text-cyan-800 disabled:cursor-wait disabled:opacity-70"
              >
                Forgot password?
              </button>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-3 text-base text-slate-900"
              placeholder="Password"
            />
          </div>

          {message ? (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                message.kind === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <div className="space-y-2">
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
            >
              {isPending ? 'Signing in...' : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={handleMagicLink}
              disabled={isPending}
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
            >
              Send Magic Link
            </button>

          </div>
        </form>
      </section>
    </main>
  );
}
