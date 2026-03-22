'use client';

import { useMemo, useState } from 'react';

import { DashboardDrillDrawer, DrillContent, DrillRecord } from '@/components/dashboard-drill';
import { DataTable } from '@/components/data-table';
import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { inventoryItems, projectBuilds, purchaseOrders, shipmentLog, transactions, vendors } from '@/lib/data/mock-data';
import { inventoryMetrics, poDaysLate, shipmentDelayFlag } from '@/lib/logic';

type MiniStat = { label: string; value: number };

function BarChart({ title, data }: { title: string; data: MiniStat[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <article className="erp-card p-3">
      <h3 className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">{title}</h3>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.label} className="grid grid-cols-[140px_1fr_34px] items-center gap-2 text-xs">
            <span className="truncate text-slate-600">{d.label}</span>
            <div className="h-2 rounded bg-slate-200">
              <div className="h-2 rounded bg-slate-700" style={{ width: `${(d.value / max) * 100}%` }} />
            </div>
            <span className="text-right font-semibold text-slate-700">{d.value}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function PercentPanel({ label, value }: { label: string; value: number }) {
  return (
    <article className="erp-card p-3">
      <p className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}%</p>
      <div className="mt-2 h-2 rounded bg-slate-200">
        <div className="h-2 rounded bg-emerald-600" style={{ width: `${value}%` }} />
      </div>
    </article>
  );
}

const vendorByName = new Map(vendors.map((vendor) => [vendor.vendorName, vendor.id]));

function vendorLink(vendorName: string) {
  const vendorId = vendorByName.get(vendorName);
  return vendorId ? { label: `Open vendor ${vendorName}`, href: `/vendors/${vendorId}` } : null;
}

export function ExecutiveDashboardClient() {
  const [drillContent, setDrillContent] = useState<DrillContent | null>(null);
  const enriched = inventoryItems.map((item) => ({ ...item, ...inventoryMetrics(item) }));
  const lowStockItems = enriched.filter((item) => item.reorderNeeded === 'YES');
  const belowSafetyItems = enriched.filter((item) => item.quantityAboveSafetyStock <= 0);
  const criticalItems = inventoryItems.filter((item) => item.criticality === 'CRITICAL');
  const openPurchaseOrders = purchaseOrders.filter((po) => po.status !== 'CLOSED');
  const latePurchaseOrders = purchaseOrders.filter((po) => poDaysLate(po) !== '');
  const delayedShipments = shipmentLog.filter((shipment) => shipmentDelayFlag(shipment) === 'YES');
  const activeProjectBuilds = projectBuilds.filter((project) => project.buildStatus !== 'COMPLETE');
  const inTransitShipments = shipmentLog.filter((shipment) => shipment.status === 'IN_TRANSIT');

  const lowStock = lowStockItems.length;
  const belowSafety = belowSafetyItems.length;
  const critical = criticalItems.length;
  const openPos = openPurchaseOrders.length;
  const latePos = latePurchaseOrders.length;
  const delayed = delayedShipments.length;
  const activeProjects = activeProjectBuilds.length;
  const inTransit = inTransitShipments.length;
  const receiptsToday = purchaseOrders.filter((po) => po.expectedDelivery === '2026-03-05').length;
  const pickupsToday = shipmentLog.filter((s) => s.shipDate === '2026-03-05').length;

  const inventoryByDept: MiniStat[] = ['Assembly', 'Warehouse', 'Service', 'Engineering'].map((dept) => ({ label: dept, value: enriched.filter((i) => i.department === dept).reduce((sum, i) => sum + i.currentInventory, 0) }));
  const inventoryByProject: MiniStat[] = projectBuilds.map((p) => ({ label: p.projectId, value: p.requiredQty - p.issuedQty }));
  const shipmentStatus: MiniStat[] = ['DELIVERED', 'IN_TRANSIT', 'DELAYED'].map((s) => ({ label: s, value: shipmentLog.filter((row) => row.status === s).length }));
  const poStatus: MiniStat[] = ['OPEN', 'PARTIAL', 'LATE'].map((s) => ({ label: s, value: purchaseOrders.filter((row) => row.status === s).length }));
  const criticalityMix: MiniStat[] = ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'].map((c) => ({ label: c, value: inventoryItems.filter((i) => i.criticality === c).length }));
  const latePoByVendor: MiniStat[] = latePurchaseOrders.map((po) => ({ label: po.vendor, value: Number(poDaysLate(po)) || 0 }));
  const upcomingDeliveries: MiniStat[] = ['2026-03-05', '2026-03-06', '2026-03-07'].map((d) => ({ label: d, value: purchaseOrders.filter((po) => po.expectedDelivery === d).length }));
  const transactionsByType: MiniStat[] = ['RECEIPT', 'TRANSFER', 'ISSUE', 'BUILD COMPLETE', 'CYCLE COUNT'].map((t) => ({ label: t, value: transactions.filter((row) => row.movementType === t).length }));
  const projectBuildStatus: MiniStat[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE'].map((s) => ({ label: s, value: projectBuilds.filter((p) => p.buildStatus === s).length }));

  const percentAboveSafety = Math.round((enriched.filter((i) => i.quantityAboveSafetyStock > 0).length / enriched.length) * 100);
  const percentPoOnTime = Math.round(((purchaseOrders.length - latePos) / purchaseOrders.length) * 100);
  const percentShipOnTime = Math.round(((shipmentLog.length - delayed) / shipmentLog.length) * 100);
  const topRisk = [...enriched].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
  const delayedShipTable = delayedShipments;
  const latePoTable = latePurchaseOrders;

  const kpiDrills = useMemo<Record<string, DrillContent>>(() => ({
    'Low Stock Items': {
      eyebrow: 'Inventory',
      title: 'Low Stock Items',
      summary: 'Items currently triggering reorder recommendations based on usage, cover, and lead time.',
      records: lowStockItems.map((item) => ({
        id: item.id,
        label: `${item.itemId} · ${item.itemName}`,
        description: `Suggested reorder ${item.suggestedOrderQty} units with ${item.daysCover.toFixed(1)} days of cover remaining.`,
        href: `/inventory/${item.itemId}`,
        hrefLabel: 'Open inventory item',
        metadata: [
          { label: 'Department', value: item.department },
          { label: 'Current Inventory', value: item.currentInventory },
          { label: 'Safety Stock', value: item.safetyStock },
          { label: 'Preferred Vendor', value: item.preferredVendor },
        ],
        relatedLinks: vendorLink(item.preferredVendor) ? [vendorLink(item.preferredVendor)!] : undefined,
      })),
    },
    'Below Safety Stock': {
      eyebrow: 'Inventory',
      title: 'Below Safety Stock',
      summary: 'Items at or below safety stock that require immediate review.',
      records: belowSafetyItems.map((item) => ({
        id: item.id,
        label: `${item.itemId} · ${item.itemName}`,
        description: `Short by ${Math.abs(item.quantityAboveSafetyStock)} units versus safety stock.`,
        href: `/inventory/${item.itemId}`,
        hrefLabel: 'Open inventory item',
        metadata: [
          { label: 'Current Inventory', value: item.currentInventory },
          { label: 'Safety Stock', value: item.safetyStock },
          { label: 'Days Cover', value: item.daysCover.toFixed(1) },
          { label: 'Preferred Vendor', value: item.preferredVendor },
        ],
        relatedLinks: vendorLink(item.preferredVendor) ? [vendorLink(item.preferredVendor)!] : undefined,
      })),
    },
    'Critical Items': {
      eyebrow: 'Inventory',
      title: 'Critical Items',
      summary: 'Critical inventory positions with direct access to item and vendor records.',
      records: criticalItems.map((item) => ({
        id: item.id,
        label: `${item.itemId} · ${item.itemName}`,
        description: `Critical SKU with ${item.currentInventory} units on hand.`,
        href: `/inventory/${item.itemId}`,
        hrefLabel: 'Open inventory item',
        metadata: [
          { label: 'Department', value: item.department },
          { label: 'Inventory Type', value: item.inventoryType },
          { label: 'Lead Time Days', value: item.leadTimeDays },
          { label: 'Preferred Vendor', value: item.preferredVendor },
        ],
        relatedLinks: vendorLink(item.preferredVendor) ? [vendorLink(item.preferredVendor)!] : undefined,
      })),
    },
    'Open POs': {
      eyebrow: 'Procurement',
      title: 'Open POs',
      summary: 'Open, partial, and late purchase orders behind the procurement KPI.',
      records: openPurchaseOrders.map((po) => {
        const links = [`/projects-builds/${po.project}`].map((href) => ({ label: `Open project ${po.project}`, href }));
        const vendorHref = vendorLink(po.vendor);
        if (vendorHref) links.push(vendorHref);
        return {
          id: po.id,
          label: po.poNumber,
          description: `${po.vendor} supplying ${po.itemId} for ${po.project}.`,
          href: `/open-pos/${po.poNumber}`,
          hrefLabel: 'Open PO',
          metadata: [
            { label: 'Status', value: po.status },
            { label: 'Expected Delivery', value: po.expectedDelivery ?? '—' },
            { label: 'Quantity Ordered', value: po.qtyOrdered },
            { label: 'Project', value: po.project },
          ],
          relatedLinks: links,
        } satisfies DrillRecord;
      }),
    },
    'Late POs': {
      eyebrow: 'Procurement',
      title: 'Late POs',
      summary: 'Late supplier orders with links to the underlying PO, project, and vendor records.',
      records: latePurchaseOrders.map((po) => {
        const links = [{ label: `Open project ${po.project}`, href: `/projects-builds/${po.project}` }];
        const vendorHref = vendorLink(po.vendor);
        if (vendorHref) links.push(vendorHref);
        return {
          id: po.id,
          label: po.poNumber,
          description: `${po.vendor} is ${poDaysLate(po)} days late on ${po.itemId}.`,
          href: `/open-pos/${po.poNumber}`,
          hrefLabel: 'Open PO',
          metadata: [
            { label: 'Status', value: po.status },
            { label: 'Expected Delivery', value: po.expectedDelivery ?? '—' },
            { label: 'Days Late', value: poDaysLate(po) },
            { label: 'Project', value: po.project },
          ],
          relatedLinks: links,
        } satisfies DrillRecord;
      }),
    },
    'Delayed Shipments': {
      eyebrow: 'Logistics',
      title: 'Delayed Shipments',
      summary: 'Delayed outbound loads with links to shipment and project records.',
      records: delayedShipments.map((shipment) => ({
        id: shipment.id,
        label: shipment.id,
        description: `${shipment.customer} shipment via ${shipment.carrier} is currently delayed.`,
        href: `/shipment-log/${shipment.id}`,
        hrefLabel: 'Open shipment',
        metadata: [
          { label: 'Customer', value: shipment.customer },
          { label: 'Project', value: shipment.project },
          { label: 'ETA', value: shipment.estimatedDelivery },
          { label: 'Tracking', value: shipment.trackingNumber },
        ],
        relatedLinks: [{ label: `Open project ${shipment.project}`, href: `/projects-builds/${shipment.project}` }],
      })),
    },
    'Active Projects': {
      eyebrow: 'Projects',
      title: 'Active Projects',
      summary: 'Builds still in progress with direct project links.',
      records: activeProjectBuilds.map((project) => ({
        id: project.id,
        label: project.projectId,
        description: `${project.customer} build is ${project.buildStatus.toLowerCase().replace('_', ' ')}.`,
        href: `/projects-builds/${project.projectId}`,
        hrefLabel: 'Open project',
        metadata: [
          { label: 'Work Order', value: project.workOrder },
          { label: 'Issued / Required', value: `${project.issuedQty} / ${project.requiredQty}` },
          { label: 'Ship Status', value: project.shipStatus },
          { label: 'Item', value: project.itemId },
        ],
      })),
    },
    'Shipments In Transit': {
      eyebrow: 'Logistics',
      title: 'Shipments In Transit',
      summary: 'Loads currently moving through the network with drill-through links.',
      records: inTransitShipments.map((shipment) => ({
        id: shipment.id,
        label: shipment.id,
        description: `${shipment.customer} shipment is in transit with ETA ${shipment.estimatedDelivery}.`,
        href: `/shipment-log/${shipment.id}`,
        hrefLabel: 'Open shipment',
        metadata: [
          { label: 'Project', value: shipment.project },
          { label: 'Carrier', value: shipment.carrier },
          { label: 'Tracking', value: shipment.trackingNumber },
          { label: 'Status', value: shipment.status },
        ],
        relatedLinks: [{ label: `Open project ${shipment.project}`, href: `/projects-builds/${shipment.project}` }],
      })),
    },
  }), [activeProjectBuilds, belowSafetyItems, criticalItems, delayedShipments, inTransitShipments, latePurchaseOrders, lowStockItems, openPurchaseOrders]);

  return (
    <>
      <div className="space-y-4">
        <SectionHeader
          title="Dashboard"
          subtitle="Control tower summary for urgent actions, trends, risk, and 48-hour operations."
          actions={<select defaultValue="All" className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"><option value="All">All</option><option value="Warehouse A">Warehouse A</option><option value="Warehouse B">Warehouse B</option></select>}
        />

        <div className="grid gap-3 md:grid-cols-5 xl:grid-cols-10">
          <KpiCard label="Low Stock Items" value={lowStock} onClick={() => setDrillContent(kpiDrills['Low Stock Items'])} />
          <KpiCard label="Below Safety Stock" value={belowSafety} onClick={() => setDrillContent(kpiDrills['Below Safety Stock'])} />
          <KpiCard label="Critical Items" value={critical} onClick={() => setDrillContent(kpiDrills['Critical Items'])} />
          <KpiCard label="Open POs" value={openPos} onClick={() => setDrillContent(kpiDrills['Open POs'])} />
          <KpiCard label="Late POs" value={latePos} onClick={() => setDrillContent(kpiDrills['Late POs'])} />
          <KpiCard label="Delayed Shipments" value={delayed} onClick={() => setDrillContent(kpiDrills['Delayed Shipments'])} />
          <KpiCard label="Active Projects" value={activeProjects} onClick={() => setDrillContent(kpiDrills['Active Projects'])} />
          <KpiCard label="Shipments In Transit" value={inTransit} onClick={() => setDrillContent(kpiDrills['Shipments In Transit'])} />
          <KpiCard label="Receipts Expected Today" value={receiptsToday} />
          <KpiCard label="Pickups Scheduled Today" value={pickupsToday} />
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <BarChart title="Inventory by Department" data={inventoryByDept} />
          <BarChart title="Inventory by Project (Unissued Qty)" data={inventoryByProject} />
          <BarChart title="Shipment Status" data={shipmentStatus} />
          <BarChart title="PO Status" data={poStatus} />
          <BarChart title="Criticality Mix" data={criticalityMix} />
          <BarChart title="Late POs by Vendor" data={latePoByVendor.length ? latePoByVendor : [{ label: 'None', value: 0 }]} />
          <BarChart title="Upcoming Deliveries by Day" data={upcomingDeliveries} />
          <BarChart title="Transactions by Type" data={transactionsByType} />
          <BarChart title="Project Build Status" data={projectBuildStatus} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <PercentPanel label="Inventory Above Safety Stock" value={percentAboveSafety} />
          <PercentPanel label="POs On Time" value={percentPoOnTime} />
          <PercentPanel label="Shipments Delivered On Time" value={percentShipOnTime} />
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <DataTable>
            <thead><tr>{['Top Risk Items', 'Priority', 'Risk Score', 'Days Cover'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{topRisk.map((i) => <tr key={i.itemId}><td>{i.itemId}</td><td>{i.priority}</td><td>{i.riskScore}</td><td>{i.daysCover.toFixed(1)}</td></tr>)}</tbody>
          </DataTable>
          <DataTable>
            <thead><tr>{['Delayed Shipments', 'Customer', 'ETA', 'Status'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{delayedShipTable.map((s) => <tr key={s.id}><td>{s.id}</td><td>{s.customer}</td><td>{s.estimatedDelivery}</td><td>{s.status}</td></tr>)}</tbody>
          </DataTable>
          <DataTable>
            <thead><tr>{['Late Purchase Orders', 'Vendor', 'Expected', 'Days Late'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{latePoTable.map((po) => <tr key={po.id}><td>{po.poNumber}</td><td>{po.vendor}</td><td>{po.expectedDelivery}</td><td>{poDaysLate(po)}</td></tr>)}</tbody>
          </DataTable>
          <DataTable>
            <thead><tr>{['Priority Actions', 'Reason'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{topRisk.map((i) => <tr key={`action-${i.itemId}`}><td>Review {i.itemId}</td><td>{i.priority} · Reorder {i.suggestedOrderQty}</td></tr>)}</tbody>
          </DataTable>
        </div>
      </div>

      <DashboardDrillDrawer open={Boolean(drillContent)} content={drillContent} onClose={() => setDrillContent(null)} />
    </>
  );
}
