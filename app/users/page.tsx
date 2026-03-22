'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { ConfirmDialog, Modal } from '@/components/overlay-ui';
import { currentUser } from '@/lib/data/mock-data';
import { useUsersStore } from '@/lib/state/mock-client-db';
import { AppUser, UserPermissions, UserRole } from '@/lib/types/domain';

const roles: UserRole[] = ['System Admin', 'Operations Manager', 'Warehouse', 'Purchasing', 'Viewer'];
const accessLevels = ['Administrator', 'Manager', 'Operational', 'Read Only', 'Standard'];
const defaultPermissionsByRole: Record<UserRole, UserPermissions> = {
  'System Admin': { canView: true, canEditRecords: true, canDeleteArchive: true, canManageUsers: true, canApproveChanges: true, canViewFinancialFreight: true, canAccessSettings: true },
  'Operations Manager': { canView: true, canEditRecords: true, canDeleteArchive: false, canManageUsers: false, canApproveChanges: true, canViewFinancialFreight: true, canAccessSettings: false },
  Warehouse: { canView: true, canEditRecords: true, canDeleteArchive: false, canManageUsers: false, canApproveChanges: false, canViewFinancialFreight: false, canAccessSettings: false },
  Purchasing: { canView: true, canEditRecords: true, canDeleteArchive: false, canManageUsers: false, canApproveChanges: true, canViewFinancialFreight: true, canAccessSettings: false },
  Viewer: { canView: true, canEditRecords: false, canDeleteArchive: false, canManageUsers: false, canApproveChanges: false, canViewFinancialFreight: true, canAccessSettings: false },
};

const blankUser = (): AppUser => ({
  id: `u-${Date.now()}`,
  name: '',
  email: '',
  login: '',
  password: '',
  role: 'Viewer',
  active: true,
  department: 'Operations',
  accessLevel: 'Standard',
  permissions: defaultPermissionsByRole.Viewer,
});

function PermissionToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useUsersStore();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [draft, setDraft] = useState<AppUser>(blankUser());
  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null);
  const [permissionUser, setPermissionUser] = useState<AppUser | null>(null);

  const rows = useMemo(() => users.filter((user) => `${user.name} ${user.email} ${user.login} ${user.role} ${user.department ?? ''}`.toLowerCase().includes(query.toLowerCase())), [query, users]);

  const startAdd = () => { setEditing(null); setDraft(blankUser()); setOpen(true); };
  const startEdit = (user: AppUser) => { setEditing(user); setDraft({ ...user, permissions: user.permissions ?? defaultPermissionsByRole[user.role] }); setOpen(true); };
  const save = () => {
    const normalized = { ...draft, permissions: draft.permissions ?? defaultPermissionsByRole[draft.role] };
    if (editing) setUsers((prev) => prev.map((user) => (user.id === editing.id ? normalized : user)));
    else setUsers((prev) => [...prev, normalized]);
    setOpen(false);
  };
  const disableUser = (user: AppUser) => setUsers((prev) => prev.map((row) => row.id === user.id ? { ...row, active: !row.active } : row));
  const savePermissions = (next: AppUser) => setUsers((prev) => prev.map((row) => row.id === next.id ? next : row));

  return (
    <div className="space-y-3">
      <SectionHeader title="Users" subtitle="ERP admin, access control, audit ownership, and future auth-ready profile management" actions={<button onClick={startAdd} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">Add User</button>} />

      <div className="erp-card p-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users by name, email, login, role, or department" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
      </div>

      <DataTable>
        <thead><tr>{['User', 'Email', 'Login', 'Role', 'Department', 'Status', 'Profile / Open Detail', 'Actions'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
        <tbody>
          {rows.map((user) => {
            const protectedAdmin = user.id === currentUser.id;
            return (
              <tr key={user.id} onClick={() => { window.location.href = `/users/${user.id}`; }} className="cursor-pointer hover:bg-cyan-50/60">
                <td className="font-semibold text-cyan-700">{user.name}</td>
                <td>{user.email}</td>
                <td>{user.login}</td>
                <td>{user.role}</td>
                <td>{user.department ?? '-'}</td>
                <td>{user.active ? 'Active' : 'Disabled'}</td>
                <td><Link href={`/users/${user.id}`} onClick={(event) => event.stopPropagation()} className="text-cyan-700 hover:underline">Open Detail</Link></td>
                <td>
                  <div className="flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
                    <button onClick={() => startEdit(user)} className="rounded border border-slate-300 px-2 py-0.5 text-xs">Edit User</button>
                    <button onClick={() => setPermissionUser(user)} className="rounded border border-slate-300 px-2 py-0.5 text-xs">Change Access</button>
                    <button onClick={() => disableUser(user)} disabled={protectedAdmin} className="rounded border border-amber-300 px-2 py-0.5 text-xs text-amber-700 disabled:opacity-40">{user.active ? 'Disable User' : 'Enable User'}</button>
                    <button onClick={() => { setEditing(user); setDraft({ ...user, password: 'Temp#Reset2026', permissions: user.permissions ?? defaultPermissionsByRole[user.role] }); setOpen(true); }} className="rounded border border-slate-300 px-2 py-0.5 text-xs">Reset Password</button>
                    <button onClick={() => setConfirmDelete(user)} disabled={protectedAdmin} className="rounded border border-rose-300 px-2 py-0.5 text-xs text-rose-700 disabled:opacity-40">Delete User</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>

      <Modal open={open} title={editing ? `Edit User · ${editing.name}` : 'Add User'} onClose={() => setOpen(false)}>
        <div className="grid gap-2 md:grid-cols-2">
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Full Name" />
          <input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Email" />
          <input value={draft.login} onChange={(event) => setDraft({ ...draft, login: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Login" />
          <input value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Password" />
          <select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as UserRole, permissions: defaultPermissionsByRole[event.target.value as UserRole] })} className="rounded border border-slate-300 px-2 py-1 text-sm">{roles.map((role) => <option key={role}>{role}</option>)}</select>
          <input value={draft.department ?? ''} onChange={(event) => setDraft({ ...draft, department: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Department" />
          <select value={draft.active ? 'Active' : 'Disabled'} onChange={(event) => setDraft({ ...draft, active: event.target.value === 'Active' })} className="rounded border border-slate-300 px-2 py-1 text-sm"><option>Active</option><option>Disabled</option></select>
          <select value={draft.accessLevel ?? 'Standard'} onChange={(event) => setDraft({ ...draft, accessLevel: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm">{accessLevels.map((level) => <option key={level}>{level}</option>)}</select>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <PermissionToggle label="Can View" checked={draft.permissions?.canView ?? true} onChange={(next) => setDraft({ ...draft, permissions: { ...draft.permissions!, canView: next } })} />
          <PermissionToggle label="Can Edit Records" checked={draft.permissions?.canEditRecords ?? false} onChange={(next) => setDraft({ ...draft, permissions: { ...draft.permissions!, canEditRecords: next } })} />
          <PermissionToggle label="Can Delete / Archive" checked={draft.permissions?.canDeleteArchive ?? false} onChange={(next) => setDraft({ ...draft, permissions: { ...draft.permissions!, canDeleteArchive: next } })} />
          <PermissionToggle label="Can Manage Users" checked={draft.permissions?.canManageUsers ?? false} onChange={(next) => setDraft({ ...draft, permissions: { ...draft.permissions!, canManageUsers: next } })} />
          <PermissionToggle label="Can Approve Changes" checked={draft.permissions?.canApproveChanges ?? false} onChange={(next) => setDraft({ ...draft, permissions: { ...draft.permissions!, canApproveChanges: next } })} />
          <PermissionToggle label="Can View Financial / Freight Estimates" checked={draft.permissions?.canViewFinancialFreight ?? false} onChange={(next) => setDraft({ ...draft, permissions: { ...draft.permissions!, canViewFinancialFreight: next } })} />
          <PermissionToggle label="Can Access Settings" checked={draft.permissions?.canAccessSettings ?? false} onChange={(next) => setDraft({ ...draft, permissions: { ...draft.permissions!, canAccessSettings: next } })} />
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={save} className="rounded border border-cyan-700 bg-cyan-50 px-3 py-1 text-xs text-cyan-800">Save User</button>
          <button onClick={() => setOpen(false)} className="rounded border border-slate-300 px-3 py-1 text-xs">Cancel</button>
        </div>
      </Modal>

      <Modal open={!!permissionUser} title={permissionUser ? `Permissions · ${permissionUser.name}` : 'Permissions'} onClose={() => setPermissionUser(null)}>
        {permissionUser && (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 md:grid-cols-2">
              <p><span className="font-semibold">Role:</span> {permissionUser.role}</p>
              <p><span className="font-semibold">Access Level:</span> {permissionUser.accessLevel ?? 'Standard'}</p>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              <PermissionToggle label="Can View" checked={permissionUser.permissions?.canView ?? true} onChange={(next) => setPermissionUser({ ...permissionUser, permissions: { ...permissionUser.permissions!, canView: next } })} />
              <PermissionToggle label="Can Edit Records" checked={permissionUser.permissions?.canEditRecords ?? false} onChange={(next) => setPermissionUser({ ...permissionUser, permissions: { ...permissionUser.permissions!, canEditRecords: next } })} />
              <PermissionToggle label="Can Delete / Archive" checked={permissionUser.permissions?.canDeleteArchive ?? false} onChange={(next) => setPermissionUser({ ...permissionUser, permissions: { ...permissionUser.permissions!, canDeleteArchive: next } })} />
              <PermissionToggle label="Can Manage Users" checked={permissionUser.permissions?.canManageUsers ?? false} onChange={(next) => setPermissionUser({ ...permissionUser, permissions: { ...permissionUser.permissions!, canManageUsers: next } })} />
              <PermissionToggle label="Can Approve Changes" checked={permissionUser.permissions?.canApproveChanges ?? false} onChange={(next) => setPermissionUser({ ...permissionUser, permissions: { ...permissionUser.permissions!, canApproveChanges: next } })} />
              <PermissionToggle label="Can View Financial / Freight Estimates" checked={permissionUser.permissions?.canViewFinancialFreight ?? false} onChange={(next) => setPermissionUser({ ...permissionUser, permissions: { ...permissionUser.permissions!, canViewFinancialFreight: next } })} />
              <PermissionToggle label="Can Access Settings" checked={permissionUser.permissions?.canAccessSettings ?? false} onChange={(next) => setPermissionUser({ ...permissionUser, permissions: { ...permissionUser.permissions!, canAccessSettings: next } })} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { savePermissions(permissionUser); setPermissionUser(null); }} className="rounded border border-cyan-700 bg-cyan-50 px-3 py-1 text-xs text-cyan-800">Save Access</button>
              <button onClick={() => setPermissionUser(null)} className="rounded border border-slate-300 px-3 py-1 text-xs">Close</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDelete} title="Delete User" message={confirmDelete?.id === currentUser.id ? 'Anthony Britton cannot be deleted because this is the current logged-in System Admin account.' : `Delete ${confirmDelete?.name} from local mock state?`} onCancel={() => setConfirmDelete(null)} onConfirm={() => { if (confirmDelete && confirmDelete.id !== currentUser.id) setUsers((prev) => prev.filter((user) => user.id !== confirmDelete.id)); setConfirmDelete(null); }} />
    </div>
  );
}
