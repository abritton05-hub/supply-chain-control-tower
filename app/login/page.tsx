// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || 'Login failed');
        setLoading(false);
        return;
      }

      router.push('/executive-dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="text-4xl font-semibold text-slate-900">
          Supply Chain Control Tower
        </h1>
        <p className="mt-2 text-lg text-slate-600">Sign in to continue</p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-6"
          autoComplete="off"
        >
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-900">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-md border border-slate-300 px-4 py-3 text-lg outline-none focus:border-sky-600"
              placeholder=""
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-900">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              className="w-full rounded-md border border-slate-300 px-4 py-3 text-lg outline-none focus:border-sky-600"
              placeholder=""
            />
          </div>

          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-sky-700 px-4 py-3 text-lg font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </main>
  );
}