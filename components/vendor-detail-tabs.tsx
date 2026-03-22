'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { inventoryItems, purchaseOrders, serialRecords, transactions } from '@/lib/data/mock-data';
import { Vendor } from '@/lib/types/domain';

const tabs = ['Overview', 'Items Supplied', 'Receipts', 'Open POs', 'Performance', 'Contacts / Ordering', 'Notes'] as const;

type Props = {
  vendor: Vendor;
  onVendorChange: (vendor: Vendor) => void;
  onSaveNotes: () => void;
};

export function VendorDetailTabs({ vendor, onVendorChange, onSaveNotes }: Props) {
  const [active, setActive] = useState<(typeof tabs)[number]>('Overview');
  const [editingNotes, setEditingNotes] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  const [selectedPos, setSelectedPos] = useState<string[]>([]);

  const suppliedItems = useMemo(() => inventoryItems.filter((item) => item.preferredVendor === vendor.vendorName), [vendor.vendorName]);
  const openPos = useMemo(() => purchaseOrders.filter((po) => po.vendor === vendor.vendorName), [vendor.vendorName]);
  const receipts = useMemo(() => transactions.filter((transaction) => transaction.movementType === 'RECEIPT' && transaction.reference.startsWith('PO-') && openPos.some((po) => po.poNumber === transaction.reference)), [openPos]);
  const vendorSerials = useMemo(() => serialRecords.filter((serial) => serial.vendor === vendor.vendorName), [vendor.vendorName]);

  const toggle = (id: string, selected: string[], setSelected: (next: string[]) => void) => setSelected(selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => <button key={tab} onClick={() => setActive(tab)} className={`rounded border px-2 py-1 text-xs ${active === tab ? 'border-cyan-600 bg-cyan-50 text-cyan-700' : 'border-slate-300 bg-white text-slate-600'}`}>{tab}</button>)}
      </div>

      {active === 'Overview' && <div className="erp-card grid gap-2 p-4 text-sm md:grid-cols-2 xl:grid-cols-3"><p><span className="font-semibold">Vendor Name:</span> {vendor.vendorName}</p><p><span className="font-semibold">Contact Person:</span> {vendor.contact}</p><p><span className="font-semibold">Email:</span> {vendor.email}</p><p><span className="font-semibold">Phone:</span> {vendor.phone}</p><p><span className="font-semibold">Lead Time Days:</span> {vendor.leadTimeDays}</p><p><span className="font-semibold">Payment Terms:</span> {vendor.paymentTerms}</p><p><span className="font-semibold">Ordering Method:</span> {vendor.orderingMethod}</p><p><span className="font-semibold">Credit Card Accepted:</span> {vendor.creditCardAccepted ? 'YES' : 'NO'}</p><p><span className="font-semibold">PO Required:</span> {vendor.poRequired ? 'YES' : 'NO'}</p></div>}
      {active === 'Items Supplied' && <DataTable><thead><tr>{['Select','Item ID', 'Item Name', 'Description', 'Tracking', 'Current Qty', 'Safety Stock'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{suppliedItems.map((item) => <tr key={item.itemId}><td><input type="checkbox" checked={selectedItems.includes(item.itemId)} onChange={() => toggle(item.itemId, selectedItems, setSelectedItems)} /></td><td><Link href={`/inventory/${item.itemId}`} className="text-cyan-700 font-semibold hover:underline">{item.itemId}</Link></td><td>{item.itemName}</td><td>{item.description}</td><td>{item.trackingType}</td><td>{item.currentInventory}</td><td>{item.safetyStock}</td></tr>)}</tbody></DataTable>}
      {active === 'Receipts' && <DataTable><thead><tr>{['Select','Item', 'Qty', 'Date', 'PO', 'Received By', 'Serials'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{receipts.map((receipt) => <tr key={receipt.id}><td><input type="checkbox" checked={selectedReceipts.includes(receipt.id)} onChange={() => toggle(receipt.id, selectedReceipts, setSelectedReceipts)} /></td><td><Link href={`/inventory/${receipt.itemId}`} className="text-cyan-700 hover:underline">{receipt.itemId}</Link></td><td>{receipt.quantity}</td><td>{receipt.date}</td><td><Link href={`/open-pos/${receipt.reference}`} className="text-cyan-700 hover:underline">{receipt.reference}</Link></td><td>{receipt.performedByName}</td><td>{receipt.serialNumber !== '-' ? <Link href={`/serial-traceability/${receipt.serialNumber}`} className="text-cyan-700 hover:underline">{receipt.serialNumber}</Link> : '-'}</td></tr>)}</tbody></DataTable>}
      {active === 'Open POs' && <DataTable><thead><tr>{['Select','PO Number', 'Item', 'Project', 'Qty Ordered', 'Expected Delivery', 'Status'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{openPos.map((po) => <tr key={po.poNumber}><td><input type="checkbox" checked={selectedPos.includes(po.poNumber)} onChange={() => toggle(po.poNumber, selectedPos, setSelectedPos)} /></td><td><Link href={`/open-pos/${po.poNumber}`} className="text-cyan-700 font-semibold hover:underline">{po.poNumber}</Link></td><td><Link href={`/inventory/${po.itemId}`} className="text-cyan-700 hover:underline">{po.itemId}</Link></td><td><Link href={`/projects-builds/${po.project}`} className="text-cyan-700 hover:underline">{po.project}</Link></td><td>{po.qtyOrdered}</td><td>{po.expectedDelivery}</td><td>{po.status}</td></tr>)}</tbody></DataTable>}
      {active === 'Performance' && <div className="erp-card grid gap-2 p-4 text-sm md:grid-cols-3"><p><span className="font-semibold">Receipts:</span> {receipts.length}</p><p><span className="font-semibold">Open POs:</span> {openPos.filter((po) => po.status !== 'CLOSED').length}</p><p><span className="font-semibold">Linked Serials:</span> {vendorSerials.length}</p></div>}
      {active === 'Contacts / Ordering' && <div className="erp-card space-y-2 p-4 text-sm"><p><span className="font-semibold">Primary Contact:</span> {vendor.contact}</p><p><span className="font-semibold">Ordering Email:</span> <a className="text-cyan-700 hover:underline" href={`mailto:${vendor.email}`}>{vendor.email}</a></p><p><span className="font-semibold">Phone:</span> <a className="text-cyan-700 hover:underline" href={`tel:${vendor.phone}`}>{vendor.phone}</a></p><p><span className="font-semibold">Payment Terms:</span> {vendor.paymentTerms}</p><p><span className="font-semibold">Ordering Method:</span> {vendor.orderingMethod}</p></div>}
      {active === 'Notes' && <div className="erp-card space-y-3 p-4 text-sm"><div className="flex gap-2 text-xs"><button onClick={() => setEditingNotes(true)} className="rounded border border-slate-300 px-2 py-1">Edit Notes</button><button onClick={() => { onSaveNotes(); setEditingNotes(false); }} disabled={!editingNotes} className="rounded border border-cyan-700 bg-cyan-50 px-2 py-1 text-cyan-800 disabled:opacity-40">Save</button></div>{editingNotes ? <textarea value={vendor.notes} onChange={(event) => onVendorChange({ ...vendor, notes: event.target.value })} className="h-28 w-full rounded border border-slate-300 px-2 py-1 text-sm" /> : <p>{vendor.notes}</p>}<p><span className="font-semibold">Linked Serials:</span> {vendorSerials.map((serial) => <Link key={serial.serialNumber} href={`/serial-traceability/${serial.serialNumber}`} className="ml-2 text-cyan-700 hover:underline">{serial.serialNumber}</Link>)}</p></div>}
    </div>
  );
}
