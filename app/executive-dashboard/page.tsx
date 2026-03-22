'use client';

import Link from 'next/link';
import { useState } from 'react';

import { DataTable } from '@/components/data-table';
import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { inventoryItems, projectBuilds, purchaseOrders, shipmentLog, transactions } from '@/lib/data/mock-data';
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

export default function DashboardPage() {
  const [lowStockOpen, setLowStockOpen] = useState(false);

  const enriched = inventoryItems.map((item) => ({ ...item, ...inventoryMetrics(item) }));
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
    <div className="space-y-4">
      <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
        Dashboard Drill Test Active
      </div>

      <SectionHeader
        title="Dashboard"
        subtitle="Control tower summary for urgent actions, trends, risk, and 48-hour operations."
        actions={<select defaultValue="All" className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"><option value="All">All</option><option value="Warehouse A">Warehouse A</option><option value="Warehouse B">Warehouse B</option></select>}
      />

      <div className="grid gap-3 md:grid-cols-5 xl:grid-cols-10">
        <KpiCard label="Low Stock Items" value={lowStock} helper="Click to inspect low-stock parts" onClick={() => setLowStockOpen((open) => !open)} />
        <KpiCard label="Below Safety Stock" value={belowSafety} />
        <KpiCard label="Critical Items" value={critical} />
        <KpiCard label="Open POs" value={openPos} />
        <KpiCard label="Late POs" value={latePos} />
        <KpiCard label="Delayed Shipments" value={delayed} />
        <KpiCard label="Active Projects" value={activeProjects} />
        <KpiCard label="Shipments In Transit" value={inTransit} />
        <KpiCard label="Receipts Expected Today" value={receiptsToday} />
        <KpiCard label="Pickups Scheduled Today" value={pickupsToday} />
      </div>

      {lowStockOpen ? (
        <section className="erp-card p-4">
          <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-base font-semibold text-slate-900">Low Stock Items</h3>
            <button type="button" onClick={() => setLowStockOpen(false)} className="rounded border border-slate-300 px-2 py-1 text-xs">Close</button>
          </div>
          <div className="space-y-2">
            {lowStockItems.map((item) => (
              <Link key={item.id} href={`/inventory/${item.itemId}`} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition hover:border-slate-300 hover:bg-white">
                <span className="font-semibold text-slate-900">{item.itemId}</span>
                <span className="text-slate-600">{item.itemName}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

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
