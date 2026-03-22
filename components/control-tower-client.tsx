'use client';

import { useState } from 'react';

import { DashboardDrillDrawer, DrillContent } from '@/components/dashboard-drill';
import { DataTable } from '@/components/data-table';
import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { StatusChip } from '@/components/status-chip';
import { freightQuotes, inventoryItems, projectBuilds, purchaseOrders, shipmentLog, users, vendors } from '@/lib/data/mock-data';
import { inventoryMetrics, poDaysLate, shipmentDelayFlag } from '@/lib/logic';

export function ControlTowerClient() {
  const [drillContent, setDrillContent] = useState<DrillContent | null>(null);
  const risky = inventoryItems.map((i) => ({ ...i, ...inventoryMetrics(i) })).sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
  const latePos = purchaseOrders.filter((po) => poDaysLate(po) !== '');
  const delayed = shipmentLog.filter((s) => shipmentDelayFlag(s) === 'YES');
  const issues = projectBuilds.filter((p) => p.issuedQty < p.requiredQty);
  const vendorIdByName = new Map(vendors.map((vendor) => [vendor.vendorName, vendor.id]));
  const freightQuoteByShipmentId = new Map([['sh1', 'FQ-1001'], ['sh2', 'FQ-1002'], ['sh3', 'FQ-1003']]);
  const currentAdmin = users[0];

  const shipmentLinks = (shipment: (typeof shipmentLog)[number]) => {
    const links = [{ label: `Open Project ${shipment.project}`, href: `/projects-builds/${shipment.project}` }];
    if (shipment.serialNumber !== '-') links.push({ label: `Open Serial ${shipment.serialNumber}`, href: `/serial-traceability/${shipment.serialNumber}` });
    const quoteId = freightQuoteByShipmentId.get(shipment.id);
    if (quoteId && freightQuotes.find((quote) => quote.quoteId === quoteId)) links.push({ label: `Open Freight Quote ${quoteId}`, href: `/freight-quotes/${quoteId}` });
    return links;
  };

  const riskRecord = (item: (typeof risky)[number]) => ({
    id: item.id,
    label: `${item.itemId} · ${item.itemName}`,
    description: `${item.priority} priority item with ${item.daysCover.toFixed(1)} days of cover remaining.`,
    href: `/inventory/${item.itemId}`,
    hrefLabel: 'Open Full Record',
    metadata: [
      { label: 'Risk Score', value: item.riskScore },
      { label: 'Reorder Needed', value: item.reorderNeeded },
      { label: 'Suggested Order Qty', value: item.suggestedOrderQty },
      { label: 'Lead Time Days', value: item.leadTimeDays },
    ],
    relatedLinks: [
      ...(vendorIdByName.get(item.preferredVendor) ? [{ label: `Open Vendor ${item.preferredVendor}`, href: `/vendors/${vendorIdByName.get(item.preferredVendor)}` }] : []),
    ],
  });

  return (
    <>
      <div className="space-y-4">
        <SectionHeader title="Control Tower" subtitle="Operations command center for risk, inbound, outbound, and project exceptions" />
        <button type="button" onClick={() => setDrillContent({ title: 'Shift Focus', summary: 'Current operational focus combines inventory risk, late inbound orders, outbound delays, and project shortages.', records: [{ id: 'focus-risk', label: 'Top Risk Items', description: `${risky.length} top-risk inventory positions.`, href: `/inventory/${risky[0]?.itemId ?? inventoryItems[0].itemId}`, hrefLabel: 'Open Full Record', metadata: [{ label: 'Items in Focus', value: risky.length }, { label: 'Late Inbound POs', value: latePos.length }, { label: 'Delayed Shipments', value: delayed.length }, { label: 'Project Issues', value: issues.length }], relatedLinks: [{ label: `Open User ${currentAdmin.name}`, href: `/users/${currentAdmin.id}` }] }] })} className="erp-banner block w-full cursor-pointer text-left transition hover:opacity-95">
          <p className="text-sm font-semibold">Shift Focus: Inbound risks + outbound delays + build shortages</p>
        </button>
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard label="Top Risk Items" value={risky.length} helper="Ranked by blended risk score" onClick={() => setDrillContent({ title: 'Top Risk Items', summary: 'Highest-risk inventory positions ranked by blended shortage score.', records: risky.map(riskRecord) })} />
          <KpiCard label="Late Inbound POs" value={latePos.length} helper="Expected date exceeded" onClick={() => setDrillContent({ title: 'Late Inbound POs', summary: 'Inbound supplier orders that missed their expected receipt date.', records: latePos.map((po) => ({ id: po.id, label: po.poNumber, description: `${po.vendor} is ${poDaysLate(po)} days late for ${po.itemId}.`, href: `/open-pos/${po.poNumber}`, hrefLabel: 'Open Full Record', metadata: [{ label: 'Expected Delivery', value: po.expectedDelivery ?? '—' }, { label: 'Status', value: po.status }, { label: 'Project', value: po.project }, { label: 'Quantity Ordered', value: po.qtyOrdered }], relatedLinks: [{ label: `Open Project ${po.project}`, href: `/projects-builds/${po.project}` }, { label: `Open Item ${po.itemId}`, href: `/inventory/${po.itemId}` }, ...(vendorIdByName.get(po.vendor) ? [{ label: `Open Vendor ${po.vendor}`, href: `/vendors/${vendorIdByName.get(po.vendor)}` }] : [])] })) })} />
          <KpiCard label="Delayed Shipments" value={delayed.length} helper="Flagged by delay logic" onClick={() => setDrillContent({ title: 'Delayed Shipments', summary: 'Customer shipments currently at risk of SLA miss.', records: delayed.map((shipment) => ({ id: shipment.id, label: shipment.id, description: `${shipment.customer} shipment via ${shipment.carrier} is delayed.`, href: `/shipment-log/${shipment.id}`, hrefLabel: 'Open Full Record', metadata: [{ label: 'Project', value: shipment.project }, { label: 'ETA', value: shipment.estimatedDelivery }, { label: 'Tracking', value: shipment.trackingNumber }, { label: 'Customer', value: shipment.customer }], relatedLinks: shipmentLinks(shipment) })) })} />
          <KpiCard label="Key Project Issues" value={issues.length} helper="Issued qty below required" onClick={() => setDrillContent({ title: 'Key Project Issues', summary: 'Builds that are short against required issue quantities.', records: issues.map((project) => ({ id: project.id, label: project.projectId, description: `${project.customer} issued ${project.issuedQty}/${project.requiredQty}.`, href: `/projects-builds/${project.projectId}`, hrefLabel: 'Open Full Record', metadata: [{ label: 'Item', value: project.itemId }, { label: 'Work Order', value: project.workOrder }, { label: 'Ship Status', value: project.shipStatus }, { label: 'Shortage', value: project.requiredQty - project.issuedQty }], relatedLinks: [{ label: `Open Item ${project.itemId}`, href: `/inventory/${project.itemId}` }] })) })} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <DataTable>
            <thead><tr>{['Item ID', 'Item Name', 'Days Cover', 'Reorder Needed', 'Risk Score', 'Priority'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{risky.map((item) => <tr key={item.itemId} className="cursor-pointer hover:bg-slate-50" onClick={() => setDrillContent({ title: `Risk Item · ${item.itemId}`, summary: `${item.itemName} is one of the highest-risk SKUs in the command center.`, records: [riskRecord(item)] })}><td>{item.itemId}</td><td>{item.itemName}</td><td>{item.daysCover.toFixed(1)}</td><td><StatusChip value={item.reorderNeeded} /></td><td>{item.riskScore}</td><td><StatusChip value={item.priority} /></td></tr>)}</tbody>
          </DataTable>
          <DataTable>
            <thead><tr>{['PO Number', 'Vendor', 'Expected Delivery', 'Status', 'Days Late'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{latePos.map((po) => <tr key={po.poNumber} className="cursor-pointer hover:bg-slate-50" onClick={() => setDrillContent({ title: `Inbound Exception · ${po.poNumber}`, summary: `${po.vendor} inbound order needs escalation because it is late.`, records: [{ id: po.id, label: po.poNumber, description: `${po.vendor} late inbound order for ${po.itemId}.`, href: `/open-pos/${po.poNumber}`, hrefLabel: 'Open Full Record', metadata: [{ label: 'Order Date', value: po.orderDate ?? '—' }, { label: 'Expected Delivery', value: po.expectedDelivery ?? '—' }, { label: 'Days Late', value: poDaysLate(po) }, { label: 'Status', value: po.status }], relatedLinks: [{ label: `Open Project ${po.project}`, href: `/projects-builds/${po.project}` }, { label: `Open Item ${po.itemId}`, href: `/inventory/${po.itemId}` }, ...(vendorIdByName.get(po.vendor) ? [{ label: `Open Vendor ${po.vendor}`, href: `/vendors/${vendorIdByName.get(po.vendor)}` }] : [])] }] })}><td>{po.poNumber}</td><td>{po.vendor}</td><td>{po.expectedDelivery}</td><td><StatusChip value={po.status} /></td><td>{poDaysLate(po)}</td></tr>)}</tbody>
          </DataTable>
          <DataTable>
            <thead><tr>{['Delayed Shipment', 'Customer', 'Project', 'ETA', 'Carrier'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{delayed.map((shipment) => <tr key={shipment.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDrillContent({ title: `Shipment Exception · ${shipment.id}`, summary: `${shipment.customer} outbound shipment is delayed.`, records: [{ id: shipment.id, label: shipment.id, description: `${shipment.customer} shipment for ${shipment.project}.`, href: `/shipment-log/${shipment.id}`, hrefLabel: 'Open Full Record', metadata: [{ label: 'Project', value: shipment.project }, { label: 'ETA', value: shipment.estimatedDelivery }, { label: 'Carrier', value: shipment.carrier }, { label: 'Tracking', value: shipment.trackingNumber }], relatedLinks: shipmentLinks(shipment) }] })}><td>{shipment.id}</td><td>{shipment.customer}</td><td>{shipment.project}</td><td>{shipment.estimatedDelivery}</td><td>{shipment.carrier}</td></tr>)}</tbody>
          </DataTable>
          <DataTable>
            <thead><tr>{['Priority Actions', 'Owner', 'Reason'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{[...risky.map((item) => ({ id: `risk-${item.id}`, label: `Review ${item.itemId}`, owner: currentAdmin.name, reason: `${item.priority} priority with ${item.daysCover.toFixed(1)} days cover`, content: { title: `Priority Action · ${item.itemId}`, summary: `Immediate inventory review for ${item.itemName}.`, records: [riskRecord(item), { id: currentAdmin.id, label: currentAdmin.name, description: 'Current system administrator assigned to oversee user and escalation workflows.', href: `/users/${currentAdmin.id}`, hrefLabel: 'Open Full Record', metadata: [{ label: 'Role', value: currentAdmin.role }, { label: 'Login', value: currentAdmin.login }, { label: 'Department', value: currentAdmin.department ?? '—' }, { label: 'Access Level', value: currentAdmin.accessLevel ?? '—' }] }] } })), ...issues.map((project) => ({ id: `project-${project.id}`, label: `Escalate ${project.projectId}`, owner: currentAdmin.name, reason: `${project.requiredQty - project.issuedQty} unit shortage for ${project.itemId}`, content: { title: `Project Action · ${project.projectId}`, summary: `Escalation path for build shortage ${project.projectId}.`, records: [{ id: project.id, label: project.projectId, description: `${project.customer} requires more issued quantity.`, href: `/projects-builds/${project.projectId}`, hrefLabel: 'Open Full Record', metadata: [{ label: 'Shortage', value: project.requiredQty - project.issuedQty }, { label: 'Work Order', value: project.workOrder }, { label: 'Item', value: project.itemId }, { label: 'Ship Status', value: project.shipStatus }], relatedLinks: [{ label: `Open Item ${project.itemId}`, href: `/inventory/${project.itemId}` }, { label: `Open User ${currentAdmin.name}`, href: `/users/${currentAdmin.id}` }] }] } }))].map((action) => <tr key={action.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDrillContent(action.content)}><td>{action.label}</td><td>{action.owner}</td><td>{action.reason}</td></tr>)}</tbody>
          </DataTable>
        </div>
      </div>

      <DashboardDrillDrawer open={Boolean(drillContent)} content={drillContent} onClose={() => setDrillContent(null)} />
    </>
  );
}
