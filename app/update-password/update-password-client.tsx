'use client';

import { useState, useTransition } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export function UpdatePasswordClient() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    startTransition(async () => {
      const supabase = supabaseBrowser();

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage('Password updated. Redirecting...');
      window.setTimeout(() => {
        window.location.href = '/inventory';
      }, 800);
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            Create New Password
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
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? 'Saving...' : 'Save Password'}
          </button>
        </form>
      </section>
    </main>
  );
}