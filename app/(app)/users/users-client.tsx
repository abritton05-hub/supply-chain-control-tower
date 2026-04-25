'use client';

import { useEffect, useState } from 'react';

type UserRole = 'tech' | 'warehouse' | 'admin';

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

type UsersResponse = {
  ok: boolean;
  users?: UserRow[];
  user?: UserRow;
  message?: string;
};

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'tech', label: 'Tech' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'admin', label: 'Admin' },
];

function normalizeRole(value: unknown): UserRole {
  if (value === 'admin') return 'admin';
  if (value === 'warehouse') return 'warehouse';
  return 'tech';
}

export function UsersClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('tech');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function loadUsers() {
    setLoading(true);

    try {
      const response = await fetch('/api/users', { cache: 'no-store' });
      const result = (await response.json()) as UsersResponse;

      if (!response.ok || !result.ok) {
        setUsers([]);
        setMessage(result.message || 'Failed to load users.');
        setLoading(false);
        return;
      }

      setUsers(
        (result.users ?? []).map((user) => ({
          ...user,
          role: normalizeRole(user.role),
        }))
      );
      setLoading(false);
    } catch (error) {
      setUsers([]);
      setMessage(error instanceof Error ? error.message : 'Failed to load users.');
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function updateLocalUser(id: string, patch: Partial<UserRow>) {
    setUsers((current) =>
      current.map((user) => (user.id === id ? { ...user, ...patch } : user))
    );
  }

  async function addUser() {
    setMessage('');

    if (!newEmail.trim()) {
      setMessage('Email is required.');
      return;
    }

    setWorking(true);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          full_name: newFullName,
          role: newRole,
        }),
      });

      const result = (await response.json()) as UsersResponse;

      if (!response.ok || !result.ok) {
        setMessage(result.message || 'Invite failed.');
        setWorking(false);
        return;
      }

      setMessage(result.message || 'Invite sent.');
      setNewEmail('');
      setNewFullName('');
      setNewRole('tech');

      await loadUsers();
      setWorking(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invite failed.');
      setWorking(false);
    }
  }

  async function saveUser(user: UserRow) {
    setMessage('');
    setWorking(true);

    try {
      const response = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          full_name: user.full_name ?? '',
          role: user.role,
        }),
      });

      const result = (await response.json()) as UsersResponse;

      if (!response.ok || !result.ok) {
        setMessage(result.message || 'Save failed.');
        setWorking(false);
        return;
      }

      if (result.user) {
        updateLocalUser(user.id, {
          ...result.user,
          role: normalizeRole(result.user.role),
        });
      }

      setMessage(result.message || 'User saved.');
      setWorking(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed.');
      setWorking(false);
    }
  }

  async function sendInviteAgain(user: UserRow) {
    if (!user.email) {
      setMessage('User email is missing.');
      return;
    }

    setNewEmail(user.email);
    setNewFullName(user.full_name ?? '');
    setNewRole(user.role);
    setMessage('User loaded into Add User form. Click Send Invite Link.');
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <section className="erp-panel p-4">
        <h2 className="text-base font-semibold text-slate-900">Add User</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter a name, email, and role. The user will receive an invite link to complete setup.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input
            value={newFullName}
            onChange={(event) => setNewFullName(event.target.value)}
            placeholder="Full name"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />

          <input
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="Email"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />

          <select
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as UserRole)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={addUser}
            disabled={working}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-70"
          >
            {working ? 'Sending...' : 'Send Invite Link'}
          </button>
        </div>
      </section>

      <section className="erp-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Existing Users</h2>
        </div>

        {loading ? (
          <div className="p-5 text-sm text-slate-600">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-5 text-sm text-slate-600">No users found.</div>
        ) : (
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
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3 text-slate-800">{user.email || '-'}</td>

                    <td className="px-4 py-3">
                      <input
                        value={user.full_name ?? ''}
                        onChange={(event) =>
                          updateLocalUser(user.id, { full_name: event.target.value })
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Full name"
                      />
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={(event) =>
                          updateLocalUser(user.id, {
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
                      {user.updated_at ? new Date(user.updated_at).toLocaleString() : '-'}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => saveUser(user)}
                          disabled={working}
                          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
                        >
                          Save
                        </button>

                        <button
                          type="button"
                          onClick={() => sendInviteAgain(user)}
                          disabled={working}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
                        >
                          Prepare Invite
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}