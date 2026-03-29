'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import {
  EditableUser,
  addUserRecord,
  createBlankUser,
  deleteUserRecord,
  getCurrentUserRecord,
  getUsers,
  roleToDepartment,
} from '@/lib/state/mock-users';

const roles = ['System Admin', 'Operations Manager', 'Warehouse', 'Purchasing', 'Viewer'] as const;

export default function UsersPage() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<EditableUser[]>([]);
  const [currentUser, setCurrentUser] = useState<EditableUser | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<EditableUser>(createBlankUser());

  useEffect(() => {
    setRows(getUsers());
    setCurrentUser(getCurrentUserRecord());
  }, []);

  const filteredRows = useMemo(
    () =>
      rows.filter((u) =>
        `${u.name} ${u.email} ${u.role} ${u.department}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [rows, query],
  );

  const openAdd = () => {
    setDraft(createBlankUser());
    setShowModal(true);
  };

  const saveNewUser = () => {
    const trimmedName = draft.name.trim();
    const trimmedEmail = draft.email.trim();

    if (!trimmedName || !trimmedEmail) return;

    const nextRows = addUserRecord({
      ...draft,
      name: trimmedName,
      email: trimmedEmail,
      department: draft.department || roleToDepartment(draft.role),
    });

    setRows(nextRows);
    setShowModal(false);
  };

  const handleDelete = (userId: string) => {
    const target = rows.find((u) => u.id === userId);
    if (!target) return;

    const confirmed = window.confirm(`Delete user ${target.name}?`);
    if (!confirmed) return;

    const nextRows = deleteUserRecord(userId);
    setRows(nextRows);
    setCurrentUser(getCurrentUserRecord());
  };

  if (!currentUser) return null;

  if (currentUser.role !== 'System Admin') {
    return (
      <div className="space-y-3">
        <SectionHeader title="Users" subtitle="System users, roles, access, and operational accountability" />
        <div className="erp-card p-4 text-sm text-slate-700">
          Only admin users can access the Users section.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Users"
        subtitle="System users, roles, access, and operational accountability"
        actions={
          <button
            onClick={openAdd}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
          >
            Add User
          </button>
        }
      />

      <div className="erp-card p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search user by name, email, role"
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>

      <DataTable>
        <thead>
          <tr>{['User', 'Email', 'Role', 'Department', 'Status', 'Profile', 'Delete'].map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {filteredRows.map((u) => (
            <tr key={u.id}>
              <td>
                <Link href={`/users/${u.id}`} className="font-semibold text-cyan-700 hover:underline">
                  {u.name}
                </Link>
              </td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.department || roleToDepartment(u.role)}</td>
              <td>{u.active ? 'Active' : 'Disabled'}</td>
              <td>
                <Link href={`/users/${u.id}`} className="text-cyan-700 hover:underline">
                  Open Detail
                </Link>
              </td>
              <td>
                <button
                  onClick={() => handleDelete(u.id)}
                  className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-2xl rounded border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add User</h2>
              <button onClick={() => setShowModal(false)} className="rounded border border-slate-300 px-3 py-1 text-sm">
                Close
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded border border-slate-300 px-2 py-2 text-sm"
                placeholder="Full Name"
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className="rounded border border-slate-300 px-2 py-2 text-sm"
                placeholder="Email"
                value={draft.email}
                onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
              />
              <select
                className="rounded border border-slate-300 px-2 py-2 text-sm"
                value={draft.role}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    role: e.target.value as EditableUser['role'],
                    department: roleToDepartment(e.target.value as EditableUser['role']),
                  }))
                }
              >
                {roles.map((role) => <option key={role}>{role}</option>)}
              </select>
              <input
                className="rounded border border-slate-300 px-2 py-2 text-sm"
                placeholder="Department"
                value={draft.department}
                onChange={(e) => setDraft((prev) => ({ ...prev, department: e.target.value }))}
              />
              <input
                className="rounded border border-slate-300 px-2 py-2 text-sm"
                placeholder="Temporary Password"
                value={draft.password}
                onChange={(e) => setDraft((prev) => ({ ...prev, password: e.target.value }))}
              />
              <select
                className="rounded border border-slate-300 px-2 py-2 text-sm"
                value={draft.active ? 'Active' : 'Disabled'}
                onChange={(e) => setDraft((prev) => ({ ...prev, active: e.target.value === 'Active' }))}
              >
                <option>Active</option>
                <option>Disabled</option>
              </select>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="rounded border border-slate-300 px-3 py-2 text-sm">
                Cancel
              </button>
              <button onClick={saveNewUser} className="rounded border border-cyan-600 bg-cyan-600 px-3 py-2 text-sm text-white">
                Save User
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}