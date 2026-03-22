'use client';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { KpiCard } from '@/components/kpi-card';
import { ConfirmDialog, Modal } from '@/components/overlay-ui';
import { auditLog, currentUser, freightQuotes, inventoryItems, purchaseOrders, shipmentLog, transactions, vendors } from '@/lib/data/mock-data';
import { useUsersStore } from '@/lib/state/mock-client-db';
import { AppUser, UserPermissions, UserRole } from '@/lib/types/domain';

const tabs = ['Overview', 'Transactions', 'Record Changes', 'Shipping Activity', 'Receiving Activity', 'Freight Quotes', 'Login History', 'Activity Feed'] as const;
const roles: UserRole[] = ['System Admin', 'Operations Manager', 'Warehouse', 'Purchasing', 'Viewer'];
const linkCls = 'text-cyan-700 hover:underline';
const permissionKeyByLabel = {
  'Can View': 'canView',
  'Can Edit Records': 'canEditRecords',
  'Can Delete / Archive': 'canDeleteArchive',
  'Can Manage Users': 'canManageUsers',
  'Can Approve Changes': 'canApproveChanges',
  'Can View Financial / Freight Estimates': 'canViewFinancialFreight',
  'Can Access Settings': 'canAccessSettings',
} as const;


function findVendorId(vendorName: string) {
  return vendors.find((vendor) => vendor.vendorName === vendorName)?.id;
}

function permissionEntries(permissions?: UserPermissions) {
  if (!permissions) return [];
  return [
    ['Can View', permissions.canView],
    ['Can Edit Records', permissions.canEditRecords],
    ['Can Delete / Archive', permissions.canDeleteArchive],
    ['Can Manage Users', permissions.canManageUsers],
    ['Can Approve Changes', permissions.canApproveChanges],
    ['Can View Financial / Freight Estimates', permissions.canViewFinancialFreight],
    ['Can Access Settings', permissions.canAccessSettings],
  ] as const;
}

export default function UserDetailPage({ params }: { params: { userId: string } }) {
  const [users, setUsers] = useUsersStore();
  const user = users.find((entry) => entry.id === params.userId);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Overview');
  const [editing, setEditing] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<AppUser | null>(user ? { ...user } : null);
  if (!user || !draft) return notFound();

  const protectedAdmin = user.id === currentUser.id;
  const tx = transactions.filter((entry) => entry.performedByUserId === user.id);
  const changes = auditLog.filter((entry) => entry.changedByUserId === user.id);
  const shipping = shipmentLog.filter((shipment) => tx.some((entry) => entry.serialNumber === shipment.serialNumber || entry.reference === shipment.poNumber));
  const receiving = tx.filter((entry) => entry.movementType === 'RECEIPT');
  const userQuotes = freightQuotes.filter((quote, index) => (user.role === 'System Admin' && index === 0) || (user.role === 'Purchasing' && index !== 1) || (user.role === 'Operations Manager' && index === 1));
  const activity = useMemo(() => [
    ...tx.map((entry) => ({ stamp: entry.performedAt, label: `${entry.movementType} · ${entry.itemId}`, href: `/inventory/${entry.itemId}` })),
    ...changes.map((entry) => ({ stamp: entry.changedAt, label: `${entry.actionType} · ${entry.entityType} ${entry.entityId}`, href: entry.entityType === 'vendor' ? `/vendors/${entry.entityId}` : entry.entityType === 'shipment' ? `/shipment-log/${entry.entityId}` : entry.entityType === 'project' ? `/projects-builds/${entry.entityId}` : entry.entityType === 'po' ? `/open-pos/${entry.entityId}` : entry.entityType === 'user' ? `/users/${entry.entityId}` : `/inventory/${entry.entityId}` })),
  ].sort((a, b) => b.stamp.localeCompare(a.stamp)), [changes, tx]);

  const saveUser = () => { setUsers((prev) => prev.map((entry) => entry.id === user.id ? draft : entry)); setEditing(false); };

  return (
    <div className="space-y-3">
      <div className="erp-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{user.name}</h2>
            <p className="text-sm text-slate-600">{user.email} · {user.login} · {user.role}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button onClick={() => setEditing(true)} className="rounded border border-slate-300 px-2 py-1">Edit User</button>
            <button onClick={() => setPermissionsOpen(true)} className="rounded border border-slate-300 px-2 py-1">Change Access</button>
            <button onClick={() => setUsers((prev) => prev.map((entry) => entry.id === user.id ? { ...entry, active: !entry.active } : entry))} disabled={protectedAdmin} className="rounded border border-amber-300 px-2 py-1 text-amber-700 disabled:opacity-40">{user.active ? 'Disable User' : 'Enable User'}</button>
            <button disabled={protectedAdmin} onClick={() => setConfirmDelete(true)} className="rounded border border-rose-300 px-2 py-1 text-rose-700 disabled:opacity-40">Delete User</button>
            <button onClick={() => setPermissionsOpen(true)} className="rounded border border-slate-300 px-2 py-1">View Permissions</button>
            <button onClick={() => { setDraft({ ...draft, password: 'Temp#Reset2026' }); setEditing(true); }} className="rounded border border-slate-300 px-2 py-1">Reset Password</button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-4">
          <p><span className="font-semibold">Full Name:</span> {user.name}</p>
          <p><span className="font-semibold">Email:</span> {user.email}</p>
          <p><span className="font-semibold">Login:</span> {user.login}</p>
          <p><span className="font-semibold">Role:</span> {user.role}</p>
          <p><span className="font-semibold">Department:</span> {user.department ?? '-'}</p>
          <p><span className="font-semibold">Status:</span> {user.active ? 'Active' : 'Disabled'}</p>
          <p><span className="font-semibold">Last Login:</span> {user.lastLogin ?? '-'}</p>
          <p><span className="font-semibold">Last Logout:</span> {user.lastLogout ?? '-'}</p>
          <p><span className="font-semibold">Access Level:</span> {user.accessLevel ?? '-'}</p>
          <p><span className="font-semibold">Password:</span> {user.password}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Transactions Performed" value={tx.length} />
        <KpiCard label="Records Changed" value={changes.length} />
        <KpiCard label="Receiving Activity" value={receiving.length} />
        <KpiCard label="Shipping Activity" value={shipping.length} />
        <KpiCard label="Can Manage Users" value={user.permissions?.canManageUsers ? 'YES' : 'NO'} />
        <KpiCard label="Can Approve Changes" value={user.permissions?.canApproveChanges ? 'YES' : 'NO'} />
        <KpiCard label="Last Login" value={user.lastLogin ?? '-'} />
        <KpiCard label="Last Activity" value={activity[0]?.stamp ?? '-'} />
      </div>

      <div className="flex flex-wrap gap-2">{tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded border px-2 py-1 text-xs ${activeTab === tab ? 'border-cyan-600 bg-cyan-50 text-cyan-700' : 'border-slate-300 bg-white text-slate-600'}`}>{tab}</button>)}</div>

      {activeTab === 'Overview' && (
        <div className="erp-card p-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <p><span className="font-semibold">Primary Access:</span> {user.accessLevel ?? '-'}</p>
            <p><span className="font-semibold">Department:</span> {user.department ?? '-'}</p>
            <p><span className="font-semibold">Reset Password:</span> Admins can reset this credential from the user actions menu</p>
            <p><span className="font-semibold">Login Credential:</span> {user.login}</p>
            <p><span className="font-semibold">Password Credential:</span> {user.password}</p>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {permissionEntries(user.permissions).map(([label, value]) => <div key={label} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs"><span className="font-semibold">{label}:</span> {value ? 'YES' : 'NO'}</div>)}
          </div>
        </div>
      )}

      {activeTab === 'Transactions' && <DataTable><thead><tr>{['Transaction ID', 'Date/Time', 'Type', 'Item', 'Serial', 'PO', 'Project', 'Shipment', 'Vendor', 'Notes'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{tx.map((entry) => { const po = entry.reference.startsWith('PO-') ? entry.reference : '-'; const project = entry.reference.startsWith('PRJ-') ? entry.reference : '-'; const shipment = shipmentLog.find((row) => row.serialNumber === entry.serialNumber); const vendorId = po !== '-' ? findVendorId(purchaseOrders.find((row) => row.poNumber === po)?.vendor ?? '') : undefined; return <tr key={entry.id}><td>{entry.id}</td><td>{entry.performedAt}</td><td>{entry.movementType}</td><td><Link href={`/inventory/${entry.itemId}`} className={linkCls}>{entry.itemId}</Link></td><td>{entry.serialNumber !== '-' ? <Link href={`/serial-traceability/${entry.serialNumber}`} className={linkCls}>{entry.serialNumber}</Link> : '-'}</td><td>{po !== '-' ? <Link href={`/open-pos/${po}`} className={linkCls}>{po}</Link> : '-'}</td><td>{project !== '-' ? <Link href={`/projects-builds/${project}`} className={linkCls}>{project}</Link> : '-'}</td><td>{shipment ? <Link href={`/shipment-log/${shipment.id}`} className={linkCls}>{shipment.id}</Link> : '-'}</td><td>{vendorId ? <Link href={`/vendors/${vendorId}`} className={linkCls}>{purchaseOrders.find((row) => row.poNumber === po)?.vendor}</Link> : '-'}</td><td>{entry.notes}</td></tr>; })}</tbody></DataTable>}

      {activeTab === 'Record Changes' && <DataTable><thead><tr>{['Date/Time', 'Entity', 'Record', 'Action', 'Field', 'Old Value', 'New Value', 'Open Record'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{changes.map((entry) => { const href = entry.entityType === 'vendor' ? `/vendors/${entry.entityId}` : entry.entityType === 'shipment' ? `/shipment-log/${entry.entityId}` : entry.entityType === 'project' ? `/projects-builds/${entry.entityId}` : entry.entityType === 'po' ? `/open-pos/${entry.entityId}` : entry.entityType === 'user' ? `/users/${entry.entityId}` : `/inventory/${entry.entityId}`; return <tr key={entry.id}><td>{entry.changedAt}</td><td>{entry.entityType}</td><td>{entry.entityId}</td><td>{entry.actionType}</td><td>{entry.fieldName}</td><td>{entry.oldValue}</td><td>{entry.newValue}</td><td><Link href={href} className={linkCls}>Open</Link></td></tr>; })}</tbody></DataTable>}

      {activeTab === 'Shipping Activity' && <DataTable><thead><tr>{['Shipment', 'Customer', 'Item', 'Serial', 'PO', 'Project', 'Date'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{shipping.map((entry) => <tr key={entry.id}><td><Link href={`/shipment-log/${entry.id}`} className={linkCls}>{entry.id}</Link></td><td>{entry.customer}</td><td><Link href={`/inventory/${entry.itemId}`} className={linkCls}>{entry.itemId}</Link></td><td>{entry.serialNumber !== '-' ? <Link href={`/serial-traceability/${entry.serialNumber}`} className={linkCls}>{entry.serialNumber}</Link> : '-'}</td><td><Link href={`/open-pos/${entry.poNumber}`} className={linkCls}>{entry.poNumber}</Link></td><td><Link href={`/projects-builds/${entry.project}`} className={linkCls}>{entry.project}</Link></td><td>{entry.shipDate}</td></tr>)}</tbody></DataTable>}

      {activeTab === 'Receiving Activity' && <DataTable><thead><tr>{['PO', 'Vendor', 'Item', 'Serial', 'Quantity', 'Date/Time'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{receiving.map((entry) => { const vendorName = purchaseOrders.find((row) => row.poNumber === entry.reference)?.vendor ?? '-'; const vendorId = findVendorId(vendorName); return <tr key={entry.id}><td><Link href={`/open-pos/${entry.reference}`} className={linkCls}>{entry.reference}</Link></td><td>{vendorId ? <Link href={`/vendors/${vendorId}`} className={linkCls}>{vendorName}</Link> : vendorName}</td><td><Link href={`/inventory/${entry.itemId}`} className={linkCls}>{entry.itemId}</Link></td><td>{entry.serialNumber !== '-' ? <Link href={`/serial-traceability/${entry.serialNumber}`} className={linkCls}>{entry.serialNumber}</Link> : '-'}</td><td>{entry.quantity}</td><td>{entry.performedAt}</td></tr>; })}</tbody></DataTable>}

      {activeTab === 'Freight Quotes' && <DataTable><thead><tr>{['Quote ID', 'Date', 'Origin', 'Destination', 'Service Type', 'Open'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{userQuotes.map((quote) => <tr key={quote.id}><td><Link href={`/freight-quotes/${quote.quoteId}`} className={linkCls}>{quote.quoteId}</Link></td><td>{quote.date}</td><td>{quote.originZip}</td><td>{quote.destinationZip}</td><td>{quote.serviceType}</td><td><Link href={`/freight-quotes/${quote.quoteId}`} className={linkCls}>Open</Link></td></tr>)}</tbody></DataTable>}

      {activeTab === 'Login History' && <DataTable><thead><tr>{['Login Time', 'Logout Time', 'Session Duration', 'Status'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody><tr><td>{user.lastLogin ?? '-'}</td><td>{user.lastLogout ?? '-'}</td><td>{user.lastLogin && user.lastLogout ? 'Computed in mock auth session' : 'Active session / unavailable'}</td><td>{user.active ? 'Active' : 'Disabled'}</td></tr></tbody></DataTable>}

      {activeTab === 'Activity Feed' && <DataTable><thead><tr>{['Date/Time', 'Activity', 'Forward Drill'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{activity.map((entry, index) => <tr key={`${entry.stamp}-${index}`}><td>{entry.stamp}</td><td>{entry.label}</td><td><Link href={entry.href} className={linkCls}>Open related record</Link></td></tr>)}</tbody></DataTable>}

      <Modal open={editing} title={`Edit User · ${user.name}`} onClose={() => setEditing(false)}>
        <div className="grid gap-2 md:grid-cols-2">
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Full Name" />
          <input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Email" />
          <input value={draft.login} onChange={(event) => setDraft({ ...draft, login: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Login" />
          <input value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Password" />
          <select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as UserRole })} className="rounded border border-slate-300 px-2 py-1 text-sm">{roles.map((role) => <option key={role}>{role}</option>)}</select>
          <input value={draft.department ?? ''} onChange={(event) => setDraft({ ...draft, department: event.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Department" />
        </div>
        <div className="mt-4 flex gap-2"><button onClick={saveUser} className="rounded border border-cyan-700 bg-cyan-50 px-3 py-1 text-xs text-cyan-800">Save User</button><button onClick={() => setEditing(false)} className="rounded border border-slate-300 px-3 py-1 text-xs">Cancel</button></div>
      </Modal>

      <Modal open={permissionsOpen} title={`Permissions · ${user.name}`} onClose={() => setPermissionsOpen(false)}>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {permissionEntries(draft.permissions).map(([label, value]) => <label key={label} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs"><span>{label}</span><input type="checkbox" checked={value} onChange={(event) => setDraft({ ...draft, permissions: { ...draft.permissions!, [permissionKeyByLabel[label]]: event.target.checked } })} /></label>)}
        </div>
        <div className="mt-4 flex gap-2"><button onClick={saveUser} className="rounded border border-cyan-700 bg-cyan-50 px-3 py-1 text-xs text-cyan-800">Save Access</button><button onClick={() => setPermissionsOpen(false)} className="rounded border border-slate-300 px-3 py-1 text-xs">Close</button></div>
      </Modal>

      <ConfirmDialog open={confirmDelete} title="Delete User" message={protectedAdmin ? 'Anthony Britton cannot be deleted because he is the current logged-in System Admin.' : `Delete ${user.name} from local mock state?`} onCancel={() => setConfirmDelete(false)} onConfirm={() => { if (!protectedAdmin) setUsers((prev) => prev.filter((entry) => entry.id !== user.id)); setConfirmDelete(false); }} />
    </div>
  );
}
