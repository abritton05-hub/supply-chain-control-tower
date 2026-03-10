import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { DataTable } from '@/components/data-table';
import { inventoryItems, projectBuilds, purchaseOrders, shipmentLog, transactions } from '@/lib/data/mock-data';
import { inventoryMetrics, poDaysLate, shipmentDelayFlag } from '@/lib/logic';

type MiniStat = { label: string; value: number };

function BarChart({ title, data }: { title: string; data: MiniStat[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <article className="erp-card p-3">
<<<<<<< HEAD
      <h3 className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">{title}</h3>
=======
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</h3>
>>>>>>> origin/main
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
<<<<<<< HEAD
      <p className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}%</p>
=======
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}%</p>
>>>>>>> origin/main
      <div className="mt-2 h-2 rounded bg-slate-200">
        <div className="h-2 rounded bg-emerald-600" style={{ width: `${value}%` }} />
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const today = new Date('2026-03-05');
  const in48h = new Date(today.getTime() + 48 * 60 * 60 * 1000);

  const enriched = inventoryItems.map((item) => ({ ...item, ...inventoryMetrics(item) }));
  const lowStock = enriched.filter((i) => i.reorderNeeded === 'YES').length;
  const belowSafety = enriched.filter((i) => i.quantityAboveSafetyStock <= 0).length;
  const critical = inventoryItems.filter((i) => i.criticality === 'CRITICAL').length;
  const openPos = purchaseOrders.filter((p) => p.status !== 'CLOSED').length;
  const latePos = purchaseOrders.filter((p) => poDaysLate(p) !== '').length;
  const delayed = shipmentLog.filter((s) => shipmentDelayFlag(s) === 'YES').length;
  const activeProjects = projectBuilds.filter((p) => p.buildStatus !== 'COMPLETE').length;
  const inTransit = shipmentLog.filter((s) => s.status === 'IN_TRANSIT').length;
  const receiptsToday = purchaseOrders.filter((po) => po.expectedDelivery === '2026-03-05').length;
  const pickupsToday = shipmentLog.filter((s) => s.shipDate === '2026-03-05').length;

  const inventoryByDept: MiniStat[] = ['Assembly', 'Warehouse', 'Service', 'Engineering'].map((dept) => ({ label: dept, value: enriched.filter((i) => i.department === dept).reduce((sum, i) => sum + i.currentInventory, 0) }));
  const inventoryByProject: MiniStat[] = projectBuilds.map((p) => ({ label: p.projectId, value: p.requiredQty - p.issuedQty }));
  const shipmentStatus: MiniStat[] = ['DELIVERED', 'IN_TRANSIT', 'DELAYED'].map((s) => ({ label: s, value: shipmentLog.filter((row) => row.status === s).length }));
  const poStatus: MiniStat[] = ['OPEN', 'PARTIAL', 'LATE'].map((s) => ({ label: s, value: purchaseOrders.filter((row) => row.status === s).length }));
  const criticalityMix: MiniStat[] = ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'].map((c) => ({ label: c, value: inventoryItems.filter((i) => i.criticality === c).length }));
  const latePoByVendor: MiniStat[] = purchaseOrders.filter((po) => poDaysLate(po) !== '').map((po) => ({ label: po.vendor, value: Number(poDaysLate(po)) || 0 }));
  const upcomingDeliveries: MiniStat[] = ['2026-03-05', '2026-03-06', '2026-03-07'].map((d) => ({ label: d, value: purchaseOrders.filter((po) => po.expectedDelivery === d).length }));
<<<<<<< HEAD
  const transactionsByType: MiniStat[] = ['RECEIPT', 'TRANSFER', 'ISSUE', 'BUILD COMPLETE', 'CYCLE COUNT'].map((t) => ({ label: t, value: transactions.filter((row) => row.movementType === t).length }));
=======
  const transactionsByType: MiniStat[] = ['RECEIVED', 'TRANSFER', 'ISSUED', 'BUILT', 'COUNT'].map((t) => ({ label: t, value: transactions.filter((row) => row.transactionType === t).length }));
>>>>>>> origin/main
  const projectBuildStatus: MiniStat[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE'].map((s) => ({ label: s, value: projectBuilds.filter((p) => p.buildStatus === s).length }));

  const percentAboveSafety = Math.round((enriched.filter((i) => i.quantityAboveSafetyStock > 0).length / enriched.length) * 100);
  const percentPoOnTime = Math.round(((purchaseOrders.length - latePos) / purchaseOrders.length) * 100);
  const percentShipOnTime = Math.round(((shipmentLog.length - delayed) / shipmentLog.length) * 100);

  const topRisk = [...enriched].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
  const latePoTable = purchaseOrders.filter((po) => poDaysLate(po) !== '');
  const delayedShipTable = shipmentLog.filter((s) => shipmentDelayFlag(s) === 'YES');

  const operationsWindow = [
    ...purchaseOrders
      .filter((po) => po.expectedDelivery)
      .map((po) => ({ label: `Inbound PO ${po.poNumber}`, when: po.expectedDelivery!, detail: `${po.vendor} · ${po.itemId}` })),
    ...shipmentLog.map((s) => ({ label: `Shipment ${s.id}`, when: s.estimatedDelivery, detail: `${s.customer} · ${s.status}` })),
    ...topRisk.map((i) => ({ label: `Shortage ${i.itemId}`, when: i.nextSuggestedOrderDate, detail: `${i.priority} · Days Cover ${i.daysCover.toFixed(1)}` })),
  ].filter((e) => {
    const dt = new Date(e.when);
    return dt >= today && dt <= in48h;
  });

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Dashboard"
        subtitle="Control tower summary for urgent actions, trends, risk, and 48-hour operations."
        actions={<select className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"><option>View: Network</option><option>View: Plant A</option><option>View: Plant B</option></select>}
      />

      <div className="grid gap-3 md:grid-cols-5 xl:grid-cols-10">
        <KpiCard label="Low Stock Items" value={lowStock} />
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

      <section className="erp-card p-4">
<<<<<<< HEAD
        <h3 className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">48-Hour Operations Window</h3>
=======
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">48-Hour Operations Window</h3>
>>>>>>> origin/main
        <p className="mb-3 text-xs text-slate-500">Watchlist for deliveries, pickups, shortages, and project risk events due within the next 48 hours.</p>
        <div className="grid gap-2">
          {operationsWindow.length === 0 ? <div className="text-sm text-slate-500">No high-priority events in next 48 hours.</div> : operationsWindow.map((event, idx) => (
            <div key={`${event.label}-${idx}`} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div><span className="font-semibold text-slate-800">{event.label}</span><span className="ml-2 text-slate-500">{event.detail}</span></div>
              <span className="text-xs font-semibold text-slate-600">{event.when}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
