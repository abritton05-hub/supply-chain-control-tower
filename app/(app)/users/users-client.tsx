'use client';

import { useEffect, useState, useTransition } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

type UserRole = 'tech' | 'warehouse' | 'admin';

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type UsersResponse = {
  ok: boolean;
  users?: UserRow[];
  message?: string;
};

type UserUpdateResponse = {
  ok: boolean;
  user?: UserRow;
  message?: string;
};

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'tech', label: 'Tech' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'admin', label: 'Admin' },
];

function normalizeRole(value: string | null | undefined): UserRole {
  if (value === 'admin') return 'admin';
  if (value === 'warehouse') return 'warehouse';
  return 'tech';
}

export function UsersClient() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  async function loadUsers() {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/users', { cache: 'no-store' });
      const result = (await response.json()) as UsersResponse;

      if (!response.ok || !result.ok) {
        setRows([]);
        setMessage(result.message || 'Failed to load users.');
        setLoading(false);
        return;
      }

      setRows(
        (result.users ?? []).map((user) => ({
          ...user,
          role: normalizeRole(user.role),
        }))
      );
      setLoading(false);
    } catch (error) {
      setRows([]);
      setMessage(error instanceof Error ? error.message : 'Failed to load users.');
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function updateLocalRow(id: string, patch: Partial<UserRow>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function saveRow(row: UserRow) {
    setMessage('');

    startTransition(async () => {
      try {
        const response = await fetch('/api/users', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: row.id,
            full_name: row.full_name ?? '',
            role: row.role,
            is_active: true,
          }),
        });

        const result = (await response.json()) as UserUpdateResponse;

        if (!response.ok || !result.ok) {
          setMessage(result.message || 'Failed to update user.');
          return;
        }

        if (result.user) {
          updateLocalRow(row.id, {
            ...result.user,
            role: normalizeRole(result.user.role),
          });
        }

        setMessage(result.message || 'User updated successfully.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to update user.');
      }
    });
  }

  function sendPasswordSetup(row: UserRow) {
    setMessage('');

    if (!row.email) {
      setMessage('User email is missing.');
      return;
    }

    startTransition(async () => {
      const supabase = supabaseBrowser();

      const { error } = await supabase.auth.resetPasswordForEmail(row.email!, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(`Password setup link sent to ${row.email}.`);
    });
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="erp-panel p-5 text-sm text-slate-600">Loading users...</div>
      ) : rows.length === 0 ? (
        <div className="erp-panel p-5 text-sm text-slate-600">
          No users found in profiles.
        </div>
      ) : (
        <div className="erp-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3 text-slate-800">{row.email || '-'}</td>
                    <td className="px-4 py-3">
                      <input
                        value={row.full_name ?? ''}
                        onChange={(event) =>
                          updateLocalRow(row.id, { full_name: event.target.value })
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Full name"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.role}
                        onChange={(event) =>
                          updateLocalRow(row.id, {
                            role: event.target.value as UserRole,
                          })
                        }
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.updated_at ? new Date(row.updated_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => saveRow(row)}
                          disabled={isPending}
                          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
                        >
                          Save
                        </button>

                        <button
                          type="button"
                          onClick={() => sendPasswordSetup(row)}
                          disabled={isPending}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
                        >
                          Send Password Link
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}