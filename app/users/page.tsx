'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { users } from '@/lib/data/mock-data';

const deptByRole: Record<string, string> = {
  'System Admin': 'IT / Platform',
  'Operations Manager': 'Operations',
  Warehouse: 'Warehouse',
  Purchasing: 'Supply Chain',
  Viewer: 'Executive',
};

export default function UsersPage() {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => users.filter((u) => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <div className="space-y-3">
      <SectionHeader title="Users" subtitle="System users, roles, access, and operational accountability" actions={<button className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">Add User</button>} />
      <div className="erp-card p-3"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user by name, email, role" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></div>
      <DataTable>
        <thead><tr>{['User', 'Email', 'Role', 'Department', 'Status', 'Profile'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td><Link href={`/users/${u.id}`} className="font-semibold text-cyan-700 hover:underline">{u.name}</Link></td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{deptByRole[u.role] ?? 'Operations'}</td>
              <td>{u.active ? 'Active' : 'Disabled'}</td>
              <td><Link href={`/users/${u.id}`} className="text-cyan-700 hover:underline">Open Detail</Link></td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
