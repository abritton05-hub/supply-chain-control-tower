'use client';

import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { EditableUser, deleteUserRecord, getCurrentUserRecord, getUsers, roleToDepartment, updateUserRecord } from '@/lib/state/mock-users';
import { inventoryItems, shipmentLog, transactions } from '@/lib/data/mock-data';

const roles = ['System Admin', 'Operations Manager', 'Warehouse', 'Purchasing', 'Viewer'] as const;
const tabs = ['Overview', 'Transactions', 'Login History'] as const;

const loginHistory: Record<string, { loginTime: string; logoutTime?: string; sessionDuration: string; context: string }[]> = {
  u1: [
    { loginTime: '2026-03-05T08:01:00Z', logoutTime: '2026-03-05T17:11:00Z', sessionDuration: '9h 10m', context: 'Web · Chrome · future IP/device' },
    { loginTime: '2026-03-04T08:10:00Z', logoutTime: '2026-03-04T16:55:00Z', sessionDuration: '8h 45m', context: 'Web · Chrome · future IP/device' },
  ],
  u2: [
    { loginTime: '2026-03-05T06:42:00Z', logoutTime: '2026-03-05T16:55:00Z', sessionDuration: '10h 13m', context: 'Web · Edge · future IP/device' },
  ],
  u3: [
    { loginTime: '2026-03-05T07:03:00Z', logoutTime: '2026-03-05T15:44:00Z', sessionDuration: '8h 41m', context: 'Warehouse Kiosk · future IP/device' },
  ],
  u4: [
    { loginTime: '2026-03-05T07:30:00Z', logoutTime: '2026-03-05T16:20:00Z', sessionDuration: '8h 50m', context: 'Web · Chrome · future IP/device' },
  ],
  u5: [
    { loginTime: '2026-03-04T09:00:00Z', sessionDuration: 'Active session', context: 'Web · Safari · future IP/device' },
  ],
  'u-admin-anthony': [
    { loginTime: '2026-03-05T07:15:00Z', logoutTime: '2026-03-05T17:05:00Z', sessionDuration: '9h 50m', context: 'Web · Chrome · Admin Session' },
  ],
};

function itemNameById(itemId: string) {
  return inventoryItems.find((i) => i.itemId === itemId)?.itemName ?? '-';
}

export default function UserDetailPage({ params }: { params: { userId: string } }) {
  const router = useRouter();
  const userId = params.userId;

  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Overview');
  const [currentUser, setCurrentUser] = useState<EditableUser | null>(null);
  const [user, setUser] = useState<EditableUser | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableUser | null>(null);

  useEffect(() => {
    const allUsers = getUsers();
    const found = allUsers.find((u) => u.id === userId) ?? null;
    setUser(found);
    setDraft(found);
    setCurrentUser(getCurrentUserRecord());
  }, [userId]);

  const tx = useMemo(() => transactions.filter((t) => t.performedByUserId === userId), [userId]);

  if (!currentUser) return null;

  if (currentUser.role !== 'System Admin') {
    return (
      <div className="erp-card p-4 text-sm text-slate-700">
        Only admin users can access user details.
      </div>
    );
  }

  if (!user || !draft) return notFound();

  const saveUser = () => {
    const next = updateUserRecord(user.id, {
      name: draft.name.trim(),
      email: draft.email.trim(),
      role: draft.role,
      department: draft.department.trim() || roleToDepartment(draft.role),
      active: draft.active,
      password: draft.password,
    });

    const refreshed = next.find((u) => u.id === user.id) ?? null;
    setUser(refreshed);
    setDraft(refreshed);
    setCurrentUser(getCurrentUserRecord());
    setEditing(false);
  };

  const deleteUser = () => {
    const confirmed = window.confirm(`Delete user ${user.name}?`);
    if (!confirmed) return;

    deleteUserRecord(user.id);
    router.push('/users');
  };

  return (
    <div className="space-y-3">
      <div className="erp-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{editing ? draft.name || 'New Name' : user.name}</h2>
            <p className="text-sm text-slate-600">
              {editing ? draft.email : user.email} · {editing ? draft.role : user.role}
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            {!editing ? (
              <button onClick={() => setEditing(true)} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
                Edit User
              </button>
            ) : (
              <>
                <button onClick={saveUser} className="rounded border border-cyan-600 bg-cyan-600 px-2 py-1 text-white">
                  Save
                </button>
                <button
                  onClick={() => {
                    setDraft(user);
                    setEditing(false);
                  }}
                  className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </>
            )}
            <button onClick={deleteUser} className="rounded border border-rose-300 px-2 py-1 text-rose-700 hover:bg-rose-50">
              Delete User
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 text-xs md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="mb-1 font-semibold">Full Name</p>
            {editing ? (
              <input className="w-full rounded border border-slate-300 px-2 py-1 text-sm" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            ) : (
              <p>{user.name}</p>
            )}
          </div>

          <div>
            <p className="mb-1 font-semibold">Email</p>
            {editing ? (
              <input className="w-full rounded border border-slate-300 px-2 py-1 text-sm" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            ) : (
              <p>{user.email}</p>
            )}
          </div>

          <div>
            <p className="mb-1 font-semibold">Role</p>
            {editing ? (
              <select
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                value={draft.role}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    role: e.target.value as EditableUser['role'],
                    department: roleToDepartment(e.target.value as EditableUser['role']),
                  })
                }
              >
                {roles.map((role) => <option key={role}>{role}</option>)}
              </select>
            ) : (
              <p>{user.role}</p>
            )}
          </div>

          <div>
            <p className="mb-1 font-semibold">Department</p>
            {editing ? (
              <input className="w-full rounded border border-slate-300 px-2 py-1 text-sm" value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} />
            ) : (
              <p>{user.department}</p>
            )}
          </div>

          <div>
            <p className="mb-1 font-semibold">Status</p>
            {editing ? (
              <select
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                value={draft.active ? 'Active' : 'Disabled'}
                onChange={(e) => setDraft({ ...draft, active: e.target.value === 'Active' })}
              >
                <option>Active</option>
                <option>Disabled</option>
              </select>
            ) : (
              <p>{user.active ? 'Active' : 'Disabled'}</p>
            )}
          </div>

          <div>
            <p className="mb-1 font-semibold">Password</p>
            {editing ? (
              <input className="w-full rounded border border-slate-300 px-2 py-1 text-sm" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
            ) : (
              <p>********</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`rounded border px-3 py-1 text-xs ${activeTab === tab ? 'border-cyan-600 bg-cyan-50 text-cyan-700' : 'border-slate-300 bg-white text-slate-600'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="erp-card p-4 text-sm text-slate-700">
          Admin-editable user profile with role, status, department, and local/mock password seed.
        </div>
      )}

      {activeTab === 'Transactions' && (
        <DataTable>
          <thead>
            <tr>{['Transaction ID', 'Date/Time', 'Transaction Type', 'Item ID', 'Item Name', 'Serial Number', 'Quantity', 'PO Number', 'Shipment ID', 'Notes'].map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {tx.map((t) => {
              const poNumber = t.reference.startsWith('PO-') ? t.reference : '-';
              const shipment = shipmentLog.find((s) => s.serialNumber === t.serialNumber || s.itemId === t.itemId);
              return (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.performedAt}</td>
                  <td>{t.movementType}</td>
                  <td><Link href={`/inventory/${t.itemId}`} className="text-cyan-700 hover:underline">{t.itemId}</Link></td>
                  <td>{itemNameById(t.itemId)}</td>
                  <td>{t.serialNumber !== '-' ? <Link href={`/serial-traceability/${t.serialNumber}`} className="text-cyan-700 hover:underline">{t.serialNumber}</Link> : '-'}</td>
                  <td>{t.quantity}</td>
                  <td>{poNumber !== '-' ? <Link href={`/open-pos/${poNumber}`} className="text-cyan-700 hover:underline">{poNumber}</Link> : '-'}</td>
                  <td>{shipment ? <Link href={`/shipment-log/${shipment.id}`} className="text-cyan-700 hover:underline">{shipment.id}</Link> : '-'}</td>
                  <td>{t.notes}</td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}

      {activeTab === 'Login History' && (
        <DataTable>
          <thead>
            <tr>{['Login Time', 'Logout Time', 'Session Duration', 'Context'].map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {(loginHistory[user.id] ?? []).map((row, idx) => (
              <tr key={`${row.loginTime}-${idx}`}>
                <td>{row.loginTime}</td>
                <td>{row.logoutTime ?? '-'}</td>
                <td>{row.sessionDuration}</td>
                <td>{row.context}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}