'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { inventoryItems, projectBuilds, purchaseOrders, serialRecords, shipmentLog, transactions, vendors } from '@/lib/data/mock-data';

const tabs = ['Overview', 'Purchasing', 'Transactions', 'Receiving History', 'Shipping History', 'Serial Numbers', 'Open POs', 'Projects / Builds', 'Inventory by Location', 'Risk / Planning', 'Vendor Info'] as const;

const linkCls = 'font-semibold text-cyan-700 hover:underline';

function yesNo(value: boolean) {
  return value ? 'YES' : 'NO';
}

export function ItemDetailTabs({ itemId }: { itemId: string }) {
  const item = inventoryItems.find((row) => row.itemId === itemId)!;
  const [active, setActive] = useState<(typeof tabs)[number]>('Overview');

  const itemTransactions = useMemo(() => transactions.filter((t) => t.itemId === itemId), [itemId]);
  const itemSerials = useMemo(() => serialRecords.filter((s) => s.itemId === itemId), [itemId]);
  const itemShipments = useMemo(() => shipmentLog.filter((s) => s.itemId === itemId), [itemId]);
  const itemPos = useMemo(() => purchaseOrders.filter((po) => po.itemId === itemId), [itemId]);
  const itemProjects = useMemo(() => projectBuilds.filter((p) => p.itemId === itemId), [itemId]);
  const receipts = useMemo(() => itemTransactions.filter((t) => t.movementType === 'RECEIPT'), [itemTransactions]);
  const vendor = vendors.find((v) => v.vendorName === item.preferredVendor);
  const altVendor = vendors.find((v) => v.vendorName !== item.preferredVendor);

  const lastReceivedDate = receipts[0]?.date ?? '-';
  const nextOrderDate = itemPos.find((po) => po.status !== 'CLOSED')?.expectedDelivery ?? '-';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActive(tab)} className={`rounded border px-2 py-1 text-xs ${active === tab ? 'border-cyan-600 bg-cyan-50 text-cyan-700' : 'border-slate-300 bg-white text-slate-600'}`}>
            {tab}
          </button>
        ))}
      </div>

      {active === 'Overview' && (
        <div className="erp-card p-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <p><span className="font-semibold">Item ID:</span> {item.itemId}</p>
            <p><span className="font-semibold">Internal Part Number:</span> INT-{item.itemId}</p>
            <p><span className="font-semibold">Vendor Part Number:</span> {vendor ? `${vendor.id.toUpperCase()}-${item.itemId}` : '-'}</p>
            <p><span className="font-semibold">Item Name:</span> {item.itemName}</p>
            <p><span className="font-semibold">Description:</span> {item.description}</p>
            <p><span className="font-semibold">Tracking Type:</span> {item.trackingType}</p>
            <p><span className="font-semibold">Serial Required:</span> {yesNo(item.serialRequired)}</p>
            <p><span className="font-semibold">Current Quantity:</span> {item.currentInventory}</p>
            <p><span className="font-semibold">Safety Stock:</span> {item.safetyStock}</p>
            <p><span className="font-semibold">Quantity Above Safety Stock:</span> {item.currentInventory - item.safetyStock}</p>
            <p><span className="font-semibold">Reorder Point:</span> {item.safetyStock + item.averageDailyUsage * item.leadTimeDays}</p>
            <p><span className="font-semibold">Next Order Date:</span> {nextOrderDate}</p>
            <p><span className="font-semibold">Last Received Date:</span> {lastReceivedDate}</p>
            <p><span className="font-semibold">Expiration Date:</span> N/A</p>
          </div>
        </div>
      )}

      {active === 'Purchasing' && (
        <div className="erp-card p-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <p><span className="font-semibold">Preferred Vendor:</span> {vendor ? <Link className={linkCls} href={`/vendors/${vendor.id}`}>{vendor.vendorName}</Link> : item.preferredVendor}</p>
            <p><span className="font-semibold">Alternate Vendor:</span> {altVendor ? <Link className={linkCls} href={`/vendors/${altVendor.id}`}>{altVendor.vendorName}</Link> : '-'}</p>
            <p><span className="font-semibold">Lead Time Days:</span> {item.leadTimeDays}</p>
            <p><span className="font-semibold">MOQ:</span> 10</p>
            <p><span className="font-semibold">Last Purchase Price:</span> $124.75</p>
            <p><span className="font-semibold">Standard Cost / COGS:</span> $119.00</p>
            <p><span className="font-semibold">Order Method:</span> Email + PO</p>
            <p><span className="font-semibold">Credit Card Allowed:</span> YES</p>
            <p><span className="font-semibold">PO Required:</span> YES</p>
          </div>
        </div>
      )}

      {active === 'Transactions' && (
        <DataTable>
          <thead><tr>{['Date', 'Movement', 'Qty', 'From', 'To', 'Reference', 'Work Order', 'User', 'Notes'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{itemTransactions.map((r) => <tr key={r.id}><td>{r.date}</td><td>{r.movementType}</td><td>{r.quantity}</td><td>{r.fromLocation}</td><td>{r.toLocation}</td><td>{r.reference.startsWith('PO-') ? <Link className={linkCls} href={`/open-pos/${r.reference}`}>{r.reference}</Link> : r.reference}</td><td>{r.workOrder}</td><td>{r.performedByName}</td><td>{r.notes}</td></tr>)}</tbody>
        </DataTable>
      )}

      {active === 'Receiving History' && (
        <DataTable>
          <thead><tr>{['Vendor', 'Qty', 'Date', 'PO', 'Received By', 'Serials'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{receipts.map((r) => <tr key={r.id}><td>{vendor ? <Link className={linkCls} href={`/vendors/${vendor.id}`}>{vendor.vendorName}</Link> : item.preferredVendor}</td><td>{r.quantity}</td><td>{r.date}</td><td>{r.reference.startsWith('PO-') ? <Link className={linkCls} href={`/open-pos/${r.reference}`}>{r.reference}</Link> : r.reference}</td><td>{r.performedByName}</td><td>{r.serialNumber !== '-' ? <Link className={linkCls} href={`/serial-traceability/${r.serialNumber}`}>{r.serialNumber}</Link> : '-'}</td></tr>)}</tbody>
        </DataTable>
      )}

      {active === 'Shipping History' && (
        <DataTable>
          <thead><tr>{['Customer', 'Shipment ID', 'Qty', 'Date', 'User', 'Serials Shipped'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{itemShipments.map((s) => <tr key={s.id}><td>{s.customer}</td><td><Link className={linkCls} href={`/shipment-log/${s.id}`}>{s.id}</Link></td><td>1</td><td>{s.shipDate}</td><td>Warehouse Team</td><td>{s.serialNumber !== '-' ? <Link className={linkCls} href={`/serial-traceability/${s.serialNumber}`}>{s.serialNumber}</Link> : '-'}</td></tr>)}</tbody>
        </DataTable>
      )}

      {active === 'Serial Numbers' && (
        <DataTable>
          <thead><tr>{['Serial Number', 'Current Status', 'Current Location', 'Date Received', 'Received From Vendor', 'Shipment ID', 'Shipped Date', 'Customer', 'Notes'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{itemSerials.map((r) => <tr key={r.serialNumber}><td><Link className={linkCls} href={`/serial-traceability/${r.serialNumber}`}>{r.serialNumber}</Link></td><td>{r.status}</td><td>{r.currentLocation}</td><td>{r.dateReceived}</td><td>{vendor ? <Link className={linkCls} href={`/vendors/${vendor.id}`}>{r.vendor}</Link> : r.vendor}</td><td>{r.shipmentId ? <Link className={linkCls} href={`/shipment-log/${r.shipmentId}`}>{r.shipmentId}</Link> : '-'}</td><td>{r.dateShipped ?? '-'}</td><td>{r.customer}</td><td>{r.notes}</td></tr>)}</tbody>
        </DataTable>
      )}

      {active === 'Open POs' && (
        <DataTable>
          <thead><tr>{['PO Number', 'Vendor', 'Project', 'Qty Ordered', 'Expected Delivery', 'Status'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{itemPos.map((po) => <tr key={po.poNumber}><td><Link className={linkCls} href={`/open-pos/${po.poNumber}`}>{po.poNumber}</Link></td><td>{vendor ? <Link className={linkCls} href={`/vendors/${vendor.id}`}>{po.vendor}</Link> : po.vendor}</td><td><Link className={linkCls} href={`/projects-builds/${po.project}`}>{po.project}</Link></td><td>{po.qtyOrdered}</td><td>{po.expectedDelivery}</td><td>{po.status}</td></tr>)}</tbody>
        </DataTable>
      )}

      {active === 'Projects / Builds' && (
        <DataTable>
          <thead><tr>{['Project ID', 'Customer', 'PO Number', 'Work Order', 'Required Qty', 'Issued Qty', 'Build Status', 'Ship Status'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{itemProjects.map((p) => <tr key={p.projectId}><td><Link className={linkCls} href={`/projects/${p.projectId}`}>{p.projectId}</Link></td><td>{p.customer}</td><td><Link className={linkCls} href={`/open-pos/${p.poNumber}`}>{p.poNumber}</Link></td><td>{p.workOrder}</td><td>{p.requiredQty}</td><td>{p.issuedQty}</td><td>{p.buildStatus}</td><td>{p.shipStatus}</td></tr>)}</tbody>
        </DataTable>
      )}


      {active === 'Inventory by Location' && (
        <DataTable>
          <thead><tr>{['Location', 'On Hand Qty', 'Allocated Qty', 'Available Qty'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            <tr><td>Main Warehouse</td><td>{item.currentInventory}</td><td>{Math.max(0, item.safetyStock - 2)}</td><td>{Math.max(0, item.currentInventory - (item.safetyStock - 2))}</td></tr>
            <tr><td>Warehouse B</td><td>{Math.max(0, Math.floor(item.currentInventory * 0.2))}</td><td>0</td><td>{Math.max(0, Math.floor(item.currentInventory * 0.2))}</td></tr>
          </tbody>
        </DataTable>
      )}

      {active === 'Risk / Planning' && (
        <div className="erp-card p-4 text-sm">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <p><span className="font-semibold">Reorder Point:</span> {item.safetyStock + item.averageDailyUsage * item.leadTimeDays}</p>
            <p><span className="font-semibold">Reorder Needed:</span> {item.currentInventory <= item.safetyStock + item.averageDailyUsage * item.leadTimeDays ? 'YES' : 'NO'}</p>
            <p><span className="font-semibold">Suggested Order Qty:</span> {Math.max(0, (item.safetyStock + item.averageDailyUsage * item.leadTimeDays) - item.currentInventory)}</p>
            <p><span className="font-semibold">Next Suggested Order Date:</span> {nextOrderDate}</p>
            <p><span className="font-semibold">MOQ:</span> 10</p>
            <p><span className="font-semibold">Lead Time Days:</span> {item.leadTimeDays}</p>
            <p><span className="font-semibold">Order Method:</span> PO + Email</p>
            <p><span className="font-semibold">Expiration Date:</span> N/A</p>
          </div>
        </div>
      )}

      {active === 'Vendor Info' && (
        <div className="erp-card p-4 text-sm">
          {vendor ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <p><span className="font-semibold">Vendor Name:</span> <Link className={linkCls} href={`/vendors/${vendor.id}`}>{vendor.vendorName}</Link></p>
              <p><span className="font-semibold">Contact Person:</span> {vendor.contact}</p>
              <p><span className="font-semibold">Email:</span> {vendor.email}</p>
              <p><span className="font-semibold">Phone:</span> {vendor.phone}</p>
              <p><span className="font-semibold">Lead Time Days:</span> {vendor.leadTimeDays}</p>
              <p><span className="font-semibold">Payment Terms:</span> Net 30</p>
              <p><span className="font-semibold">Ordering Method:</span> Email + EDI</p>
              <p><span className="font-semibold">Credit Card Accepted:</span> YES</p>
              <p><span className="font-semibold">PO Required:</span> YES</p>
            </div>
          ) : (
            <p className="text-slate-600">No linked vendor info found.</p>
          )}
        </div>
      )}
    </div>
  );
}
