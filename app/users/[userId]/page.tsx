'use client';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { KpiCard } from '@/components/kpi-card';
import { auditLog, inventoryItems, purchaseOrders, shipmentLog, transactions, users, vendors } from '@/lib/data/mock-data';

const tabs = ['Overview', 'Transactions', 'Record Changes', 'Shipping / Receiving', 'Login History', 'Activity Feed'] as const;

const profileMeta: Record<string, { department: string; createdDate: string; lastLogin: string; lastLogout?: string }> = {
  u1: { department: 'IT / Platform', createdDate: '2025-01-12', lastLogin: '2026-03-05T08:01:00Z', lastLogout: '2026-03-05T17:11:00Z' },
  u2: { department: 'Operations', createdDate: '2025-02-20', lastLogin: '2026-03-05T06:42:00Z', lastLogout: '2026-03-05T16:55:00Z' },
  u3: { department: 'Warehouse', createdDate: '2025-03-01', lastLogin: '2026-03-05T07:03:00Z', lastLogout: '2026-03-05T15:44:00Z' },
  u4: { department: 'Supply Chain', createdDate: '2025-04-10', lastLogin: '2026-03-05T07:30:00Z', lastLogout: '2026-03-05T16:20:00Z' },
  u5: { department: 'Executive', createdDate: '2025-05-08', lastLogin: '2026-03-04T09:00:00Z' },
};

const loginHistory: Record<string, { loginTime: string; logoutTime?: string; sessionDuration: string; context: string }[]> = {
  u1: [
    { loginTime: '2026-03-05T08:01:00Z', logoutTime: '2026-03-05T17:11:00Z', sessionDuration: '9h 10m', context: 'Web · Chrome · future IP/device' },
    { loginTime: '2026-03-04T08:10:00Z', logoutTime: '2026-03-04T16:55:00Z', sessionDuration: '8h 45m', context: 'Web · Chrome · future IP/device' },
  ],
  u2: [
    { loginTime: '2026-03-05T06:42:00Z', logoutTime: '2026-03-05T16:55:00Z', sessionDuration: '10h 13m', context: 'Web · Edge · future IP/device' },
    { loginTime: '2026-03-04T06:51:00Z', logoutTime: '2026-03-04T17:05:00Z', sessionDuration: '10h 14m', context: 'Web · Edge · future IP/device' },
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
};

function itemNameById(itemId: string) {
  return inventoryItems.find((i) => i.itemId === itemId)?.itemName ?? '-';
}

export default function UserDetailPage({ params }: { params: { userId: string } }) {
  const userId = params.userId;
  const user = users.find((u) => u.id === userId);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Overview');

  const tx = useMemo(() => transactions.filter((t) => t.performedByUserId === userId), [userId]);
  const changes = useMemo(() => auditLog.filter((a) => a.changedByUserId === userId), [userId]);
  const receipts = useMemo(() => tx.filter((t) => t.movementType === 'RECEIPT'), [tx]);
  const shipmentsProcessed = useMemo(() => tx.filter((t) => t.movementType === 'SHIP'), [tx]);
  const adjustments = useMemo(() => tx.filter((t) => t.movementType === 'ADJUSTMENT' || t.movementType === 'CYCLE COUNT'), [tx]);
  const recordsDeletedOrArchived = useMemo(() => changes.filter((c) => c.actionType === 'DELETE' || c.actionType === 'ARCHIVE'), [changes]);

  const shippingReceivingRows = [
    ...receipts.map((r) => {
      const po = purchaseOrders.find((poRow) => poRow.poNumber === r.reference);
      return {
        id: r.id,
        flowType: 'RECEIVING',
        party: po?.vendor ?? vendors.find((v) => v.vendorName === purchaseOrders[0]?.vendor)?.vendorName ?? 'Vendor',
        itemId: r.itemId,
        quantity: r.quantity,
        reference: r.reference,
        serials: r.serialNumber,
        performedAt: r.performedAt,
      };
    }),
    ...shipmentsProcessed.map((r) => {
      const ship = shipmentLog.find((s) => s.serialNumber === r.serialNumber || s.itemId === r.itemId);
      return {
        id: r.id,
        flowType: 'SHIPPING',
        party: ship?.customer ?? 'Customer',
        itemId: r.itemId,
        quantity: r.quantity,
        reference: ship?.id ?? r.reference,
        serials: r.serialNumber,
        performedAt: r.performedAt,
      };
    }),
  ].sort((a, b) => b.performedAt.localeCompare(a.performedAt));

  if (!user) return notFound();

  const meta = profileMeta[user.id];

  const activityFeed = [
    ...tx.map((t) => ({ stamp: t.performedAt, type: t.movementType, detail: `${t.itemId} · ${t.quantity} · ${t.notes}`, link: t.reference.startsWith('PO-') ? `/open-pos/${t.reference}` : `/inventory/${t.itemId}` })),
    ...changes.map((c) => ({ stamp: c.changedAt, type: c.actionType, detail: `${c.entityType} ${c.entityId} · ${c.fieldName}: ${c.oldValue} → ${c.newValue}`, link: '#' })),
    ...(loginHistory[user.id] ?? []).flatMap((s) => [
      { stamp: s.loginTime, type: 'LOGIN', detail: s.context, link: '#' },
      ...(s.logoutTime ? [{ stamp: s.logoutTime, type: 'LOGOUT', detail: `Session ${s.sessionDuration}`, link: '#' }] : []),
    ]),
  ].sort((a, b) => b.stamp.localeCompare(a.stamp));

  return (
    <div className="space-y-3">
      <div className="erp-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{user.name}</h2>
            <p className="text-sm text-slate-600">{user.email} · {user.role}</p>
          </div>
          <div className="flex gap-2 text-xs">
            <button className="rounded border border-slate-300 px-2 py-1">Edit User</button>
            <button className="rounded border border-slate-300 px-2 py-1">Disable User</button>
            <button className="rounded border border-slate-300 px-2 py-1">Reset Password (future)</button>
            <button className="rounded border border-slate-300 px-2 py-1">Change Role (future)</button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-4">
          <p><span className="font-semibold">Full Name:</span> {user.name}</p>
          <p><span className="font-semibold">Email:</span> {user.email}</p>
          <p><span className="font-semibold">Role:</span> {user.role}</p>
          <p><span className="font-semibold">Department:</span> {meta?.department ?? 'Operations'}</p>
          <p><span className="font-semibold">Status:</span> {user.active ? 'Active' : 'Disabled'}</p>
          <p><span className="font-semibold">Last Login:</span> {meta?.lastLogin ?? '-'}</p>
          <p><span className="font-semibold">Last Logout:</span> {meta?.lastLogout ?? '-'}</p>
          <p><span className="font-semibold">Created Date:</span> {meta?.createdDate ?? '-'}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Transactions Performed" value={tx.length} />
        <KpiCard label="Receipts Processed" value={receipts.length} />
        <KpiCard label="Shipments Processed" value={shipmentsProcessed.length} />
        <KpiCard label="Adjustments Made" value={adjustments.length} />
        <KpiCard label="Records Edited" value={changes.filter((c) => c.actionType === 'UPDATE').length} />
        <KpiCard label="Records Deleted/Archived" value={recordsDeletedOrArchived.length} />
        <KpiCard label="Last Login" value={meta?.lastLogin ?? '-'} />
        <KpiCard label="Last Activity" value={activityFeed[0]?.stamp ?? '-'} />
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded border px-2 py-1 text-xs ${activeTab === tab ? 'border-cyan-600 bg-cyan-50 text-cyan-700' : 'border-slate-300 bg-white text-slate-600'}`}>{tab}</button>)}
      </div>

      {activeTab === 'Overview' && (
        <div className="erp-card p-4 text-sm text-slate-700">
          Audit-focused user accountability profile with connected operations, record-change history, login sessions, and chronological activity. Use tabs to drill into transaction-level traceability.
        </div>
      )}

      {activeTab === 'Transactions' && (
        <DataTable>
          <thead><tr>{['Transaction ID', 'Date/Time', 'Transaction Type', 'Item ID', 'Item Name', 'Serial Number', 'Quantity', 'From Location', 'To Location', 'PO Number', 'Project ID', 'Shipment ID', 'Notes'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {tx.map((t) => {
              const poNumber = t.reference.startsWith('PO-') ? t.reference : '-';
              const project = t.reference.startsWith('PRJ-') ? t.reference : purchaseOrders.find((po) => po.poNumber === poNumber)?.project ?? '-';
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
                  <td>{t.fromLocation}</td>
                  <td>{t.toLocation}</td>
                  <td>{poNumber !== '-' ? <Link href={`/open-pos/${poNumber}`} className="text-cyan-700 hover:underline">{poNumber}</Link> : '-'}</td>
                  <td>{project !== '-' ? <Link href={`/projects/${project}`} className="text-cyan-700 hover:underline">{project}</Link> : '-'}</td>
                  <td>{shipment ? <Link href={`/shipment-log/${shipment.id}`} className="text-cyan-700 hover:underline">{shipment.id}</Link> : '-'}</td>
                  <td>{t.notes}</td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}

      {activeTab === 'Record Changes' && (
        <DataTable>
          <thead><tr>{['Date/Time', 'Entity Type', 'Record ID', 'Action Type', 'Field Changed', 'Old Value', 'New Value'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{changes.map((c) => <tr key={c.id}><td>{c.changedAt}</td><td>{c.entityType}</td><td>{c.entityId}</td><td>{c.actionType}</td><td>{c.fieldName}</td><td>{c.oldValue}</td><td>{c.newValue}</td></tr>)}</tbody>
        </DataTable>
      )}

      {activeTab === 'Shipping / Receiving' && (
        <DataTable>
          <thead><tr>{['Flow', 'Vendor/Customer', 'Item', 'Quantity', 'Shipment/PO Ref', 'Serials', 'Date/Time'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{shippingReceivingRows.map((r) => <tr key={r.id}><td>{r.flowType}</td><td>{r.party}</td><td><Link href={`/inventory/${r.itemId}`} className="text-cyan-700 hover:underline">{r.itemId}</Link></td><td>{r.quantity}</td><td>{r.reference.startsWith('PO-') ? <Link href={`/open-pos/${r.reference}`} className="text-cyan-700 hover:underline">{r.reference}</Link> : r.reference.startsWith('sh') ? <Link href={`/shipment-log/${r.reference}`} className="text-cyan-700 hover:underline">{r.reference}</Link> : r.reference}</td><td>{r.serials !== '-' ? <Link href={`/serial-traceability/${r.serials}`} className="text-cyan-700 hover:underline">{r.serials}</Link> : '-'}</td><td>{r.performedAt}</td></tr>)}</tbody>
        </DataTable>
      )}

      {activeTab === 'Login History' && (
        <DataTable>
          <thead><tr>{['Login Time', 'Logout Time', 'Session Duration', 'IP/Device (future-ready)'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{(loginHistory[user.id] ?? []).map((row, idx) => <tr key={`${row.loginTime}-${idx}`}><td>{row.loginTime}</td><td>{row.logoutTime ?? '-'}</td><td>{row.sessionDuration}</td><td>{row.context}</td></tr>)}</tbody>
        </DataTable>
      )}

      {activeTab === 'Activity Feed' && (
        <DataTable>
          <thead><tr>{['Date/Time', 'Activity Type', 'Detail', 'Linked Record'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{activityFeed.map((e, idx) => <tr key={`${e.stamp}-${idx}`}><td>{e.stamp}</td><td>{e.type}</td><td>{e.detail}</td><td>{e.link !== '#' ? <Link href={e.link} className="text-cyan-700 hover:underline">Open</Link> : '-'}</td></tr>)}</tbody>
        </DataTable>
      )}
    </div>
  );
}
