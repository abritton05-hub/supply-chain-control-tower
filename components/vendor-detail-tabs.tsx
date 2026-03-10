'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { inventoryItems, purchaseOrders, serialRecords, transactions } from '@/lib/data/mock-data';
import { Vendor } from '@/lib/types/domain';

const tabs = ['Overview', 'Items Supplied', 'Receipts', 'Open POs', 'Performance', 'Contacts / Ordering', 'Notes'] as const;

export function VendorDetailTabs({ vendor }: { vendor: Vendor }) {
  const [active, setActive] = useState<(typeof tabs)[number]>('Overview');

  const suppliedItems = useMemo(() => inventoryItems.filter((item) => item.preferredVendor === vendor.vendorName), [vendor.vendorName]);
  const openPos = useMemo(() => purchaseOrders.filter((po) => po.vendor === vendor.vendorName), [vendor.vendorName]);
  const receipts = useMemo(() => transactions.filter((t) => t.movementType === 'RECEIPT' && t.reference.startsWith('PO-') && openPos.some((po) => po.poNumber === t.reference)), [openPos]);
  const vendorSerials = useMemo(() => serialRecords.filter((s) => s.vendor === vendor.vendorName), [vendor.vendorName]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => <button key={tab} onClick={() => setActive(tab)} className={`rounded border px-2 py-1 text-xs ${active === tab ? 'border-cyan-600 bg-cyan-50 text-cyan-700' : 'border-slate-300 bg-white text-slate-600'}`}>{tab}</button>)}
      </div>

      {active === 'Overview' && <div className="erp-card p-4 text-sm grid gap-2 md:grid-cols-2 xl:grid-cols-3"><p><span className="font-semibold">Vendor Name:</span> {vendor.vendorName}</p><p><span className="font-semibold">Contact Person:</span> {vendor.contact}</p><p><span className="font-semibold">Email:</span> {vendor.email}</p><p><span className="font-semibold">Phone:</span> {vendor.phone}</p><p><span className="font-semibold">Lead Time Days:</span> {vendor.leadTimeDays}</p><p><span className="font-semibold">Payment Terms:</span> Net 30</p><p><span className="font-semibold">Ordering Method:</span> PO + Email</p><p><span className="font-semibold">Credit Card Accepted:</span> YES</p><p><span className="font-semibold">PO Required:</span> YES</p></div>}
      {active === 'Items Supplied' && <DataTable><thead><tr>{['Item ID', 'Item Name', 'Description', 'Tracking', 'Current Qty', 'Safety Stock'].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{suppliedItems.map((item) => <tr key={item.itemId}><td><Link href={`/inventory/${item.itemId}`} className="text-cyan-700 font-semibold hover:underline">{item.itemId}</Link></td><td>{item.itemName}</td><td>{item.description}</td><td>{item.trackingType}</td><td>{item.currentInventory}</td><td>{item.safetyStock}</td></tr>)}</tbody></DataTable>}
      {active === 'Receipts' && <DataTable><thead><tr>{['Item', 'Qty', 'Date', 'PO', 'Received By', 'Serials'].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{receipts.map((r) => <tr key={r.id}><td><Link href={`/inventory/${r.itemId}`} className="text-cyan-700 hover:underline">{r.itemId}</Link></td><td>{r.quantity}</td><td>{r.date}</td><td><Link href={`/open-pos/${r.reference}`} className="text-cyan-700 hover:underline">{r.reference}</Link></td><td>{r.performedByName}</td><td>{r.serialNumber !== '-' ? <Link href={`/serial-traceability/${r.serialNumber}`} className="text-cyan-700 hover:underline">{r.serialNumber}</Link> : '-'}</td></tr>)}</tbody></DataTable>}
      {active === 'Open POs' && <DataTable><thead><tr>{['PO Number', 'Item', 'Project', 'Qty Ordered', 'Expected Delivery', 'Status'].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{openPos.map((po) => <tr key={po.poNumber}><td><Link href={`/open-pos/${po.poNumber}`} className="text-cyan-700 font-semibold hover:underline">{po.poNumber}</Link></td><td><Link href={`/inventory/${po.itemId}`} className="text-cyan-700 hover:underline">{po.itemId}</Link></td><td><Link href={`/projects/${po.project}`} className="text-cyan-700 hover:underline">{po.project}</Link></td><td>{po.qtyOrdered}</td><td>{po.expectedDelivery}</td><td>{po.status}</td></tr>)}</tbody></DataTable>}
      {active === 'Performance' && <div className="erp-card p-4 text-sm grid gap-2 md:grid-cols-3"><p><span className="font-semibold">Receipts:</span> {receipts.length}</p><p><span className="font-semibold">Open POs:</span> {openPos.filter((po) => po.status !== 'CLOSED').length}</p><p><span className="font-semibold">On-time Estimate:</span> 92%</p></div>}
      {active === 'Contacts / Ordering' && <div className="erp-card p-4 text-sm space-y-2"><p><span className="font-semibold">Primary Contact:</span> {vendor.contact}</p><p><span className="font-semibold">Ordering Email:</span> {vendor.email}</p><p><span className="font-semibold">Phone:</span> {vendor.phone}</p><p><span className="font-semibold">Ordering Notes:</span> Submit PO PDF and include project + item references.</p></div>}
      {active === 'Notes' && <div className="erp-card p-4 text-sm space-y-2"><p>{vendor.notes}</p><p><span className="font-semibold">Linked Serials:</span> {vendorSerials.map((s) => s.serialNumber).join(', ') || 'None'}</p></div>}
    </div>
  );
}
