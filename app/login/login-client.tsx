'use client';

import { useState, useTransition } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

type LoginResult =
  | { ok: true }
  | { ok: false; message: string };

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
    return { ok: true };
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

    return { ok: true };
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
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true };
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
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    startTransition(async () => {
      const result = await signInWithPassword(email.trim(), password);

      if (!result.ok) {
        setMessage(result.message);
      }
    });
  }

  function handleMagicLink() {
    setMessage('');

    startTransition(async () => {
      const cleanEmail = email.trim();

      if (!cleanEmail) {
        setMessage('Enter your email first.');
        return;
      }

      const result = await sendMagicLink(cleanEmail);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setMessage('Magic link sent. Check your email and use the newest link.');
    });
  }

  function handleForgotPassword() {
    setMessage('');

    startTransition(async () => {
      const cleanEmail = email.trim();

      if (!cleanEmail) {
        setMessage('Enter your email first.');
        return;
      }

      const result = await sendForgotPassword(cleanEmail);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setMessage('Password reset link sent. Check your email.');
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
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
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Password
            </label>
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
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {message}
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

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isPending}
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
            >
              Forgot Password / Create Password
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}