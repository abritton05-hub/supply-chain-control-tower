'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DataTable } from '@/components/data-table';
import { KpiCard } from '@/components/kpi-card';
import { SlideOver } from '@/components/overlay-ui';
import { SectionHeader } from '@/components/section-header';
import { inventoryItems, projectBuilds, purchaseOrders, shipmentLog, transactions, vendors } from '@/lib/data/mock-data';
import { inventoryMetrics, poDaysLate, shipmentDelayFlag } from '@/lib/logic';

type MiniStat = { label: string; value: number };

type DrillRecord = {
  id: string;
  primary: string;
  secondary?: string;
  href: string;
  meta?: Array<{ label: string; value: string | number }>;
};

type DrillState = {
  title: string;
  subtitle: string;
  records: DrillRecord[];
} | null;

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

export default function DashboardPage() {
  const [drill, setDrill] = useState<DrillState>(null);

  const enriched = useMemo(() => inventoryItems.map((item) => ({ ...item, ...inventoryMetrics(item) })), []);
  const lowStockItems = enriched.filter((item) => item.reorderNeeded === 'YES');
  const belowSafetyItems = enriched.filter((item) => item.quantityAboveSafetyStock <= 0);
  const criticalItems = enriched.filter((item) => item.criticality === 'CRITICAL');
  const openPurchaseOrders = purchaseOrders.filter((po) => po.status !== 'CLOSED');
  const latePurchaseOrders = purchaseOrders.filter((po) => poDaysLate(po) !== '');
  const delayedShipments = shipmentLog.filter((shipment) => shipmentDelayFlag(shipment) === 'YES');
  const activeProjectBuilds = projectBuilds.filter((project) => project.buildStatus !== 'COMPLETE');
  const inTransitShipments = shipmentLog.filter((shipment) => shipment.status === 'IN_TRANSIT');
  const receiptsTodayRows = purchaseOrders.filter((po) => po.expectedDelivery === '2026-03-05');
  const pickupsTodayRows = shipmentLog.filter((shipment) => shipment.shipDate === '2026-03-05');

  const openVendor = (vendorName: string) => {
    const vendor = vendors.find((entry) => entry.vendorName === vendorName);
    return vendor ? `/vendors/${vendor.id}` : '/vendors';
  };

  const openLowStockDrill = () => setDrill({
    title: 'Low Stock Items',
    subtitle: 'Items at or below reorder point requiring immediate planning review.',
    records: lowStockItems.map((item) => ({
      id: item.itemId,
      primary: item.itemId,
      secondary: item.itemName,
      href: `/inventory/${item.itemId}`,
      meta: [
        { label: 'Priority', value: item.priority },
        { label: 'Days Cover', value: item.daysCover.toFixed(1) },
        { label: 'Vendor', value: item.preferredVendor },
      ],
    })),
  });

  const openBelowSafetyDrill = () => setDrill({
    title: 'Below Safety Stock',
    subtitle: 'Protected stock has been consumed and buffer recovery is needed.',
    records: belowSafetyItems.map((item) => ({
      id: item.itemId,
      primary: item.itemId,
      secondary: item.itemName,
      href: `/inventory/${item.itemId}`,
      meta: [
        { label: 'Qty Above Safety', value: item.quantityAboveSafetyStock },
        { label: 'Suggested Order', value: item.suggestedOrderQty },
        { label: 'Vendor', value: item.preferredVendor },
      ],
    })),
  });

  const openCriticalItemsDrill = () => setDrill({
    title: 'Critical Items',
    subtitle: 'Critical inventory records with the highest operational exposure.',
    records: criticalItems.map((item) => ({
      id: item.itemId,
      primary: item.itemId,
      secondary: item.itemName,
      href: `/inventory/${item.itemId}`,
      meta: [
        { label: 'Risk Score', value: item.riskScore },
        { label: 'Reorder', value: item.reorderNeeded },
        { label: 'Vendor', value: item.preferredVendor },
      ],
    })),
  });

  const openOpenPoDrill = () => setDrill({
    title: 'Open Purchase Orders',
    subtitle: 'Open inbound orders that still require receipt or closure.',
    records: openPurchaseOrders.map((po) => ({
      id: po.poNumber,
      primary: po.poNumber,
      secondary: `${po.vendor} · ${po.itemId}`,
      href: `/open-pos/${po.poNumber}`,
      meta: [
        { label: 'Status', value: po.status },
        { label: 'Expected', value: po.expectedDelivery ?? '—' },
        { label: 'Project', value: po.project },
      ],
    })),
  });

  const openLatePoDrill = () => setDrill({
    title: 'Late Purchase Orders',
    subtitle: 'Inbound supply orders that are late against expected delivery.',
    records: latePurchaseOrders.map((po) => ({
      id: po.poNumber,
      primary: po.poNumber,
      secondary: `${po.vendor} · ${po.itemId}`,
      href: `/open-pos/${po.poNumber}`,
      meta: [
        { label: 'Days Late', value: poDaysLate(po) },
        { label: 'Expected', value: po.expectedDelivery ?? '—' },
        { label: 'Vendor Page', value: vendorDisplay(po.vendor) },
      ],
    })),
  });

  const openDelayedShipmentsDrill = () => setDrill({
    title: 'Delayed Shipments',
    subtitle: 'Outbound shipments requiring customer and carrier follow-up.',
    records: delayedShipments.map((shipment) => ({
      id: shipment.id,
      primary: shipment.id,
      secondary: `${shipment.customer} · ${shipment.itemId}`,
      href: `/shipment-log/${shipment.id}`,
      meta: [
        { label: 'Carrier', value: shipment.carrier },
        { label: 'ETA', value: shipment.estimatedDelivery },
        { label: 'Tracking', value: shipment.trackingNumber },
      ],
    })),
  });

  const openActiveProjectsDrill = () => setDrill({
    title: 'Active Projects',
    subtitle: 'Projects still consuming material or moving through build stages.',
    records: activeProjectBuilds.map((project) => ({
      id: project.projectId,
      primary: project.projectId,
      secondary: `${project.customer} · ${project.workOrder}`,
      href: `/projects-builds/${project.projectId}`,
      meta: [
        { label: 'Build', value: project.buildStatus },
        { label: 'Ship', value: project.shipStatus },
        { label: 'Item', value: project.itemId },
      ],
    })),
  });

  const openInTransitDrill = () => setDrill({
    title: 'Shipments In Transit',
    subtitle: 'Current in-transit outbound shipments and linked customer commitments.',
    records: inTransitShipments.map((shipment) => ({
      id: shipment.id,
      primary: shipment.id,
      secondary: `${shipment.customer} · ${shipment.project}`,
      href: `/shipment-log/${shipment.id}`,
      meta: [
        { label: 'Carrier', value: shipment.carrier },
        { label: 'Tracking', value: shipment.trackingNumber },
        { label: 'ETA', value: shipment.estimatedDelivery },
      ],
    })),
  });

  const openReceiptsTodayDrill = () => setDrill({
    title: 'Receipts Expected Today',
    subtitle: 'Purchase orders due for receipt during today’s operating window.',
    records: receiptsTodayRows.map((po) => ({
      id: po.poNumber,
      primary: po.poNumber,
      secondary: `${po.vendor} · ${po.itemId}`,
      href: `/open-pos/${po.poNumber}`,
      meta: [
        { label: 'Expected', value: po.expectedDelivery ?? '—' },
        { label: 'Status', value: po.status },
        { label: 'Project', value: po.project },
      ],
    })),
  });

  const openPickupsTodayDrill = () => setDrill({
    title: 'Pickups Scheduled Today',
    subtitle: 'Today’s shipment handoffs queued for carrier pickup.',
    records: pickupsTodayRows.map((shipment) => ({
      id: shipment.id,
      primary: shipment.id,
      secondary: `${shipment.customer} · ${shipment.itemId}`,
      href: `/shipment-log/${shipment.id}`,
      meta: [
        { label: 'Carrier', value: shipment.carrier },
        { label: 'Waybill', value: shipment.waybill },
        { label: 'Tracking', value: shipment.trackingNumber },
      ],
    })),
  });

  const lowStock = lowStockItems.length;
  const belowSafety = belowSafetyItems.length;
  const critical = criticalItems.length;
  const openPos = openPurchaseOrders.length;
  const latePos = latePurchaseOrders.length;
  const delayed = delayedShipments.length;
  const activeProjects = activeProjectBuilds.length;
  const inTransit = inTransitShipments.length;
  const receiptsToday = receiptsTodayRows.length;
  const pickupsToday = pickupsTodayRows.length;

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

  return (
    <>
      <div className="space-y-4">
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Dashboard Drill Test Active
        </div>

        <SectionHeader
          title="Dashboard"
          subtitle="Control tower summary for urgent actions, trends, risk, and 48-hour operations."
          actions={
            <select defaultValue="All" className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
              <option value="All">All</option>
              <option value="Warehouse A">Warehouse A</option>
              <option value="Warehouse B">Warehouse B</option>
            </select>
          }
        />

        <div className="grid gap-3 md:grid-cols-5 xl:grid-cols-10">
          <KpiCard label="Low Stock Items" value={lowStock} helper="Click to drill into item shortages" onClick={openLowStockDrill} />
          <KpiCard label="Below Safety Stock" value={belowSafety} helper="Protected stock consumed" onClick={openBelowSafetyDrill} />
          <KpiCard label="Critical Items" value={critical} helper="Critical inventory exposure" onClick={openCriticalItemsDrill} />
          <KpiCard label="Open POs" value={openPos} helper="Inbound orders pending receipt" onClick={openOpenPoDrill} />
          <KpiCard label="Late POs" value={latePos} helper="Supplier follow-up required" onClick={openLatePoDrill} />
          <KpiCard label="Delayed Shipments" value={delayed} helper="Delivery exceptions open" onClick={openDelayedShipmentsDrill} />
          <KpiCard label="Active Projects" value={activeProjects} helper="Builds still consuming supply" onClick={openActiveProjectsDrill} />
          <KpiCard label="Shipments In Transit" value={inTransit} helper="Current outbound movements" onClick={openInTransitDrill} />
          <KpiCard label="Receipts Expected Today" value={receiptsToday} helper="Today’s inbound receipts" onClick={openReceiptsTodayDrill} />
          <KpiCard label="Pickups Scheduled Today" value={pickupsToday} helper="Today’s outbound handoffs" onClick={openPickupsTodayDrill} />
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
            <tbody>{topRisk.map((item) => <tr key={item.itemId}><td>{item.itemId}</td><td>{item.priority}</td><td>{item.riskScore}</td><td>{item.daysCover.toFixed(1)}</td></tr>)}</tbody>
          </DataTable>
          <DataTable>
            <thead><tr>{['Delayed Shipments', 'Customer', 'ETA', 'Status'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{delayedShipments.map((shipment) => <tr key={shipment.id}><td>{shipment.id}</td><td>{shipment.customer}</td><td>{shipment.estimatedDelivery}</td><td>{shipment.status}</td></tr>)}</tbody>
          </DataTable>
          <DataTable>
            <thead><tr>{['Late Purchase Orders', 'Vendor', 'Expected', 'Days Late'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{latePurchaseOrders.map((po) => <tr key={po.id}><td>{po.poNumber}</td><td>{po.vendor}</td><td>{po.expectedDelivery}</td><td>{poDaysLate(po)}</td></tr>)}</tbody>
          </DataTable>
          <DataTable>
            <thead><tr>{['Priority Actions', 'Reason'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{topRisk.map((item) => <tr key={`action-${item.itemId}`}><td>Review {item.itemId}</td><td>{item.priority} · Reorder {item.suggestedOrderQty}</td></tr>)}</tbody>
          </DataTable>
        </div>
      </div>

      <SlideOver open={Boolean(drill)} title={drill?.title ?? 'Dashboard Drill'} onClose={() => setDrill(null)}>
        {drill ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{drill.subtitle}</p>
            <div className="space-y-3">
              {drill.records.length ? drill.records.map((record) => (
                <div key={record.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={record.href} className="text-sm font-semibold text-slate-900 underline-offset-2 hover:text-slate-700 hover:underline">
                        {record.primary}
                      </Link>
                      {record.secondary ? <p className="mt-1 text-xs text-slate-600">{record.secondary}</p> : null}
                    </div>
                    <Link href={record.href} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900">
                      Open Full Record
                    </Link>
                  </div>
                  {record.meta?.length ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {record.meta.map((entry) => (
                        <div key={`${record.id}-${entry.label}`} className="rounded border border-slate-200 bg-white px-2 py-2 text-xs">
                          <p className="text-slate-500">{entry.label}</p>
                          {entry.label === 'Vendor' || entry.label === 'Vendor Page' ? (
                            <Link href={openVendor(String(entry.value))} className="font-semibold text-slate-900 underline-offset-2 hover:text-slate-700 hover:underline">
                              {entry.value}
                            </Link>
                          ) : (
                            <p className="font-semibold text-slate-900">{entry.value}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )) : <p className="text-sm text-slate-500">No matching records.</p>}
            </div>
          </div>
        ) : null}
      </SlideOver>
    </>
  );
}

function vendorDisplay(vendorName: string) {
  return vendorName;
}
