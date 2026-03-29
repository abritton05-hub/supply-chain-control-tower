'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginUser } from '@/lib/state/mock-users';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('Abritton05@gmail.com');
  const [password, setPassword] = useState('Password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    const user = loginUser(email, password);

    if (!user) {
      setError('Invalid email or password.');
      return;
    }

    setError('');
    router.push('/executive-dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">Supply Chain Control Tower</h1>
        <p className="mb-6 text-sm text-slate-500">Sign in to continue</p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Email</label>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Password</label>
            <div className="flex rounded border border-slate-300 bg-white">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full rounded-l px-3 py-2 text-sm outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="border-l border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            onClick={handleLogin}
            className="w-full rounded border border-cyan-600 bg-cyan-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Log In
          </button>
        </div>
      </div>
    </div>
  );
}