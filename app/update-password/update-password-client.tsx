'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

type StatusMessage = {
  kind: 'success' | 'error';
  text: string;
};

export function UpdatePasswordClient() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage({
        kind: 'error',
        text: 'Password must be at least 8 characters.',
      });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ kind: 'error', text: 'Passwords do not match.' });
      return;
    }

    startTransition(async () => {
      const supabase = supabaseBrowser();

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setMessage({ kind: 'error', text: error.message });
        return;
      }

      setMessage({ kind: 'success', text: 'Password updated. Redirecting...' });
      window.setTimeout(() => {
        window.location.href = '/inventory';
      }, 800);
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
            Reset Password
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Enter a new password for your Supply Chain Control Tower account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              New Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-3 text-base text-slate-900"
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-3 text-base text-slate-900"
              placeholder="Re-enter password"
              required
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

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? 'Saving...' : 'Save Password'}
          </button>

          <div className="text-center text-sm">
            <Link href="/login" className="font-semibold text-cyan-700 hover:text-cyan-800">
              Back to sign in
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
