'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DataTable } from '@/components/data-table';
import { KpiCard } from '@/components/kpi-card';
import { SlideOver } from '@/components/overlay-ui';
import { SectionHeader } from '@/components/section-header';
import { inventoryItems, projectBuilds, purchaseOrders, serialRecords, shipmentLog, transactions, users, vendors } from '@/lib/data/mock-data';
import { inventoryMetrics, poDaysLate, shipmentDelayFlag } from '@/lib/logic';

type MiniStat = { label: string; value: number };
type DrillLink = { label: string; href: string };

type DrillRecord = {
  id: string;
  primary: string;
  secondary?: string;
  href?: string;
  meta?: Array<{ label: string; value: string | number }>;
  relatedLinks?: DrillLink[];
};

type DrillState = {
  title: string;
  subtitle: string;
  records: DrillRecord[];
} | null;

type EnrichedInventory = (typeof inventoryItems)[number] & ReturnType<typeof inventoryMetrics>;

function BarChart({ title, data, onSelect }: { title: string; data: MiniStat[]; onSelect?: (label: string) => void }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <article className="erp-card p-3">
      <h3 className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">{title}</h3>
      <div className="space-y-2">
        {data.map((d) => {
          const row = (
            <div className="grid grid-cols-[140px_1fr_34px] items-center gap-2 text-xs">
              <span className="truncate text-slate-600">{d.label}</span>
              <div className="h-2 rounded bg-slate-200">
                <div className="h-2 rounded bg-slate-700" style={{ width: `${(d.value / max) * 100}%` }} />
              </div>
              <span className="text-right font-semibold text-slate-700">{d.value}</span>
            </div>
          );

          if (onSelect) {
            return (
              <button
                key={d.label}
                type="button"
                onClick={() => onSelect(d.label)}
                className="w-full cursor-pointer rounded px-1 py-1 text-left transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {row}
              </button>
            );
          }

          return <div key={d.label}>{row}</div>;
        })}
      </div>
    </article>
  );
}

function PercentPanel({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  const content = (
    <>
      <p className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}%</p>
      <div className="mt-2 h-2 rounded bg-slate-200">
        <div className="h-2 rounded bg-emerald-600" style={{ width: `${value}%` }} />
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="erp-card w-full cursor-pointer p-3 text-left transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        {content}
      </button>
    );
  }

  return <article className="erp-card p-3">{content}</article>;
}

export default function DashboardPage() {
  const [drill, setDrill] = useState<DrillState>(null);

  const enriched = useMemo<EnrichedInventory[]>(() => inventoryItems.map((item) => ({ ...item, ...inventoryMetrics(item) })), []);
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
  const topRisk = [...enriched].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);

  const vendorHref = (vendorName: string) => {
    const vendor = vendors.find((entry) => entry.vendorName === vendorName);
    return vendor ? `/vendors/${vendor.id}` : '/vendors';
  };

  const itemRecord = (item: EnrichedInventory): DrillRecord => ({
    id: item.itemId,
    primary: item.itemId,
    secondary: item.itemName,
    href: `/inventory/${item.itemId}`,
    meta: [
      { label: 'Priority', value: item.priority },
      { label: 'Risk Score', value: item.riskScore },
      { label: 'Days Cover', value: item.daysCover.toFixed(1) },
      { label: 'Vendor', value: item.preferredVendor },
    ],
    relatedLinks: [
      { label: 'Vendor', href: vendorHref(item.preferredVendor) },
      ...purchaseOrders.filter((po) => po.itemId === item.itemId).map((po) => ({ label: po.poNumber, href: `/open-pos/${po.poNumber}` })),
      ...projectBuilds.filter((project) => project.itemId === item.itemId).map((project) => ({ label: project.projectId, href: `/projects-builds/${project.projectId}` })),
      ...serialRecords.filter((serial) => serial.itemId === item.itemId).map((serial) => ({ label: serial.serialNumber, href: `/serial-traceability/${serial.serialNumber}` })),
      ...shipmentLog.filter((shipment) => shipment.itemId === item.itemId).map((shipment) => ({ label: shipment.id, href: `/shipment-log/${shipment.id}` })),
    ],
  });

  const poRecord = (po: (typeof purchaseOrders)[number]): DrillRecord => ({
    id: po.poNumber,
    primary: po.poNumber,
    secondary: `${po.vendor} · ${po.itemId}`,
    href: `/open-pos/${po.poNumber}`,
    meta: [
      { label: 'Status', value: po.status },
      { label: 'Expected', value: po.expectedDelivery ?? '—' },
      { label: 'Qty Ordered', value: po.qtyOrdered },
      { label: 'Days Late', value: poDaysLate(po) || '0' },
    ],
    relatedLinks: [
      { label: 'Vendor', href: vendorHref(po.vendor) },
      { label: 'Item', href: `/inventory/${po.itemId}` },
      { label: 'Project', href: `/projects-builds/${po.project}` },
      ...transactions
        .filter((transaction) => transaction.reference === po.poNumber)
        .map((transaction) => ({ label: transaction.id, href: `/transactions` })),
    ],
  });

  const shipmentRecord = (shipment: (typeof shipmentLog)[number]): DrillRecord => ({
    id: shipment.id,
    primary: shipment.id,
    secondary: `${shipment.customer} · ${shipment.itemId}`,
    href: `/shipment-log/${shipment.id}`,
    meta: [
      { label: 'Status', value: shipment.status },
      { label: 'Carrier', value: shipment.carrier },
      { label: 'ETA', value: shipment.estimatedDelivery },
      { label: 'Tracking', value: shipment.trackingNumber },
    ],
    relatedLinks: [
      { label: 'Project', href: `/projects-builds/${shipment.project}` },
      { label: 'Item', href: `/inventory/${shipment.itemId}` },
      { label: 'PO', href: `/open-pos/${shipment.poNumber}` },
      ...(shipment.serialNumber && shipment.serialNumber !== '-' ? [{ label: shipment.serialNumber, href: `/serial-traceability/${shipment.serialNumber}` }] : []),
    ],
  });

  const projectRecord = (project: (typeof projectBuilds)[number]): DrillRecord => ({
    id: project.projectId,
    primary: project.projectId,
    secondary: `${project.customer} · ${project.workOrder}`,
    href: `/projects-builds/${project.projectId}`,
    meta: [
      { label: 'Build Status', value: project.buildStatus },
      { label: 'Ship Status', value: project.shipStatus },
      { label: 'Required Qty', value: project.requiredQty },
      { label: 'Issued Qty', value: project.issuedQty },
    ],
    relatedLinks: [
      { label: 'Item', href: `/inventory/${project.itemId}` },
      { label: 'Customer PO', href: `/open-pos/${project.poNumber}` },
      ...serialRecords.filter((serial) => serial.project === project.projectId).map((serial) => ({ label: serial.serialNumber, href: `/serial-traceability/${serial.serialNumber}` })),
      ...shipmentLog.filter((shipment) => shipment.project === project.projectId).map((shipment) => ({ label: shipment.id, href: `/shipment-log/${shipment.id}` })),
    ],
  });

  const transactionRecord = (transaction: (typeof transactions)[number]): DrillRecord => ({
    id: transaction.id,
    primary: transaction.movementType,
    secondary: `${transaction.itemId} · ${transaction.performedByName}`,
    href: '/transactions',
    meta: [
      { label: 'Performed At', value: transaction.performedAt },
      { label: 'Quantity', value: transaction.quantity },
      { label: 'Reference', value: transaction.reference },
      { label: 'From / To', value: `${transaction.fromLocation} → ${transaction.toLocation}` },
    ],
    relatedLinks: [
      { label: 'Item', href: `/inventory/${transaction.itemId}` },
      ...(transaction.serialNumber && transaction.serialNumber !== '-' ? [{ label: transaction.serialNumber, href: `/serial-traceability/${transaction.serialNumber}` }] : []),
      ...(transaction.reference.startsWith('PO-') ? [{ label: transaction.reference, href: `/open-pos/${transaction.reference}` }] : []),
      ...(transaction.reference.startsWith('PRJ-') ? [{ label: transaction.reference, href: `/projects-builds/${transaction.reference}` }] : []),
      { label: transaction.performedByName, href: `/users/${transaction.performedByUserId}` },
    ],
  });

  const vendorLatePoRecord = (vendorName: string): DrillRecord => {
    const matchingPos = latePurchaseOrders.filter((po) => po.vendor === vendorName);
    return {
      id: vendorName,
      primary: vendorName,
      secondary: `${matchingPos.length} late PO(s)`,
      href: vendorHref(vendorName),
      meta: [
        { label: 'Late POs', value: matchingPos.length },
        { label: 'Worst Delay', value: Math.max(...matchingPos.map((po) => Number(poDaysLate(po)) || 0), 0) },
      ],
      relatedLinks: matchingPos.map((po) => ({ label: po.poNumber, href: `/open-pos/${po.poNumber}` })),
    };
  };

  const userDrillLink = (userId: string) => {
    const user = users.find((entry) => entry.id === userId);
    return user ? { label: user.name, href: `/users/${user.id}` } : null;
  };

  const openDrill = (title: string, subtitle: string, records: DrillRecord[]) => setDrill({ title, subtitle, records });

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

  const operationsWindow = [
    ...receiptsTodayRows.map((po) => ({ id: `receipt-${po.poNumber}`, label: `Receive ${po.poNumber}`, detail: `${po.vendor} · ${po.itemId}`, records: [poRecord(po)] })),
    ...pickupsTodayRows.map((shipment) => ({ id: `pickup-${shipment.id}`, label: `Pickup ${shipment.id}`, detail: `${shipment.customer} · ${shipment.carrier}`, records: [shipmentRecord(shipment)] })),
    ...lowStockItems.slice(0, 3).map((item) => ({ id: `risk-${item.itemId}`, label: `Replenish ${item.itemId}`, detail: `${item.itemName} · ${item.priority}`, records: [itemRecord(item)] })),
  ];

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
          <KpiCard label="Low Stock Items" value={lowStock} helper="Click to view exact low items" onClick={() => openDrill('Low Stock Items', 'Exact inventory records currently at or below reorder point.', lowStockItems.map(itemRecord))} />
          <KpiCard label="Below Safety Stock" value={belowSafety} helper="Protected stock consumed" onClick={() => openDrill('Below Safety Stock', 'Items that have fallen below their safety floor.', belowSafetyItems.map(itemRecord))} />
          <KpiCard label="Critical Items" value={critical} helper="Highest operational exposure" onClick={() => openDrill('Critical Items', 'Critical inventory records and their linked supply relationships.', criticalItems.map(itemRecord))} />
          <KpiCard label="Open POs" value={openPos} helper="Inbound orders pending receipt" onClick={() => openDrill('Open Purchase Orders', 'Exact open purchase orders that still require action.', openPurchaseOrders.map(poRecord))} />
          <KpiCard label="Late POs" value={latePos} helper="Supplier follow-up required" onClick={() => openDrill('Late Purchase Orders', 'Exact overdue purchase orders with forward vendor and item links.', latePurchaseOrders.map(poRecord))} />
          <KpiCard label="Delayed Shipments" value={delayed} helper="Delivery exceptions open" onClick={() => openDrill('Delayed Shipments', 'Exact delayed outbound shipments requiring escalation.', delayedShipments.map(shipmentRecord))} />
          <KpiCard label="Active Projects" value={activeProjects} helper="Builds still consuming supply" onClick={() => openDrill('Active Projects', 'Projects still active in build or shipment execution.', activeProjectBuilds.map(projectRecord))} />
          <KpiCard label="Shipments In Transit" value={inTransit} helper="Current outbound movements" onClick={() => openDrill('Shipments In Transit', 'Outbound shipments currently moving through carrier networks.', inTransitShipments.map(shipmentRecord))} />
          <KpiCard label="Receipts Expected Today" value={receiptsToday} helper="Today’s inbound receipts" onClick={() => openDrill('Receipts Expected Today', 'Inbound receipts expected in today’s operating window.', receiptsTodayRows.map(poRecord))} />
          <KpiCard label="Pickups Scheduled Today" value={pickupsToday} helper="Today’s outbound handoffs" onClick={() => openDrill('Pickups Scheduled Today', 'Outbound handoffs scheduled for pickup today.', pickupsTodayRows.map(shipmentRecord))} />
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <BarChart title="Inventory by Department" data={inventoryByDept} onSelect={(dept) => openDrill(`Inventory · ${dept}`, `Inventory items assigned to ${dept}.`, enriched.filter((item) => item.department === dept).map(itemRecord))} />
          <BarChart title="Inventory by Project (Unissued Qty)" data={inventoryByProject} onSelect={(projectId) => openDrill(`Project Exposure · ${projectId}`, `Open requirement and linked records for ${projectId}.`, projectBuilds.filter((project) => project.projectId === projectId).map(projectRecord))} />
          <BarChart title="Shipment Status" data={shipmentStatus} onSelect={(status) => openDrill(`Shipment Status · ${status}`, `Shipments currently in ${status} status.`, shipmentLog.filter((shipment) => shipment.status === status).map(shipmentRecord))} />
          <BarChart title="PO Status" data={poStatus} onSelect={(status) => openDrill(`PO Status · ${status}`, `Purchase orders currently in ${status} status.`, purchaseOrders.filter((po) => po.status === status).map(poRecord))} />
          <BarChart title="Criticality Mix" data={criticalityMix} onSelect={(criticality) => openDrill(`Criticality · ${criticality}`, `Inventory records with ${criticality} criticality.`, enriched.filter((item) => item.criticality === criticality).map(itemRecord))} />
          <BarChart title="Late POs by Vendor" data={latePoByVendor.length ? latePoByVendor : [{ label: 'None', value: 0 }]} onSelect={(vendorName) => openDrill(`Vendor Late POs · ${vendorName}`, `Overdue purchase orders for ${vendorName}.`, vendorName === 'None' ? [] : [vendorLatePoRecord(vendorName)])} />
          <BarChart title="Upcoming Deliveries by Day" data={upcomingDeliveries} onSelect={(date) => openDrill(`Deliveries · ${date}`, `Purchase orders due on ${date}.`, purchaseOrders.filter((po) => po.expectedDelivery === date).map(poRecord))} />
          <BarChart title="Transactions by Type" data={transactionsByType} onSelect={(type) => openDrill(`Transactions · ${type}`, `Movement history for ${type}.`, transactions.filter((transaction) => transaction.movementType === type).map(transactionRecord))} />
          <BarChart title="Project Build Status" data={projectBuildStatus} onSelect={(status) => openDrill(`Projects · ${status}`, `Projects with ${status} build state.`, projectBuilds.filter((project) => project.buildStatus === status).map(projectRecord))} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <PercentPanel label="Inventory Above Safety Stock" value={percentAboveSafety} onClick={() => openDrill('Inventory Above Safety Stock', 'Items still above the protected inventory floor.', enriched.filter((item) => item.quantityAboveSafetyStock > 0).map(itemRecord))} />
          <PercentPanel label="POs On Time" value={percentPoOnTime} onClick={() => openDrill('POs On Time', 'Purchase orders still meeting their expected dates.', purchaseOrders.filter((po) => poDaysLate(po) === '').map(poRecord))} />
          <PercentPanel label="Shipments Delivered On Time" value={percentShipOnTime} onClick={() => openDrill('Shipments Delivered On Time', 'Shipments delivered without delay exception.', shipmentLog.filter((shipment) => shipmentDelayFlag(shipment) !== 'YES').map(shipmentRecord))} />
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <DataTable>
            <thead><tr>{['Top Risk Items', 'Priority', 'Risk Score', 'Days Cover'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {topRisk.map((item) => (
                <tr key={item.itemId} className="cursor-pointer transition hover:bg-slate-50" onClick={() => openDrill(`Risk Item · ${item.itemId}`, 'Forward drill into the highest-risk inventory record.', [itemRecord(item)])}>
                  <td>{item.itemId}</td><td>{item.priority}</td><td>{item.riskScore}</td><td>{item.daysCover.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <DataTable>
            <thead><tr>{['Delayed Shipments', 'Customer', 'ETA', 'Status'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {delayedShipments.map((shipment) => (
                <tr key={shipment.id} className="cursor-pointer transition hover:bg-slate-50" onClick={() => openDrill(`Shipment Exception · ${shipment.id}`, 'Forward drill into delayed shipment records.', [shipmentRecord(shipment)])}>
                  <td>{shipment.id}</td><td>{shipment.customer}</td><td>{shipment.estimatedDelivery}</td><td>{shipment.status}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <DataTable>
            <thead><tr>{['Late Purchase Orders', 'Vendor', 'Expected', 'Days Late'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {latePurchaseOrders.map((po) => (
                <tr key={po.id} className="cursor-pointer transition hover:bg-slate-50" onClick={() => openDrill(`Late PO · ${po.poNumber}`, 'Forward drill into the exact overdue PO and linked records.', [poRecord(po)])}>
                  <td>{po.poNumber}</td><td>{po.vendor}</td><td>{po.expectedDelivery}</td><td>{poDaysLate(po)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <DataTable>
            <thead><tr>{['Priority Actions', 'Reason'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {topRisk.map((item) => (
                <tr key={`action-${item.itemId}`} className="cursor-pointer transition hover:bg-slate-50" onClick={() => openDrill(`Priority Action · ${item.itemId}`, 'Priority action with exact linked inventory, PO, project, and shipment records.', [itemRecord(item)])}>
                  <td>Review {item.itemId}</td><td>{item.priority} · Reorder {item.suggestedOrderQty}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>

        <article className="erp-card p-4">
          <h3 className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">48-Hour Operations Window</h3>
          <div className="space-y-2">
            {operationsWindow.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => openDrill(event.label, event.detail, event.records)}
                className="flex w-full cursor-pointer items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{event.label}</span>
                  <span className="block text-xs text-slate-600">{event.detail}</span>
                </span>
                <span className="text-xs font-medium text-slate-500">Open</span>
              </button>
            ))}
          </div>
        </article>
      </div>

      <SlideOver open={Boolean(drill)} title={drill?.title ?? 'Dashboard Drill'} onClose={() => setDrill(null)}>
        {drill ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{drill.subtitle}</p>
            <div className="space-y-3">
              {drill.records.length ? drill.records.map((record) => (
                <article key={record.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {record.href ? (
                        <Link href={record.href} className="text-sm font-semibold text-slate-900 underline-offset-2 hover:text-slate-700 hover:underline">
                          {record.primary}
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold text-slate-900">{record.primary}</p>
                      )}
                      {record.secondary ? <p className="mt-1 text-xs text-slate-600">{record.secondary}</p> : null}
                    </div>
                    {record.href ? (
                      <Link href={record.href} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900">
                        Open Full Record
                      </Link>
                    ) : null}
                  </div>

                  {record.meta?.length ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {record.meta.map((entry) => {
                        const isVendor = entry.label === 'Vendor';
                        return (
                          <div key={`${record.id}-${entry.label}`} className="rounded border border-slate-200 bg-white px-2 py-2 text-xs">
                            <p className="text-slate-500">{entry.label}</p>
                            {isVendor ? (
                              <Link href={vendorHref(String(entry.value))} className="font-semibold text-slate-900 underline-offset-2 hover:text-slate-700 hover:underline">
                                {entry.value}
                              </Link>
                            ) : (
                              <p className="font-semibold text-slate-900">{entry.value}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {record.relatedLinks?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {record.relatedLinks.map((link) => (
                        <Link key={`${record.id}-${link.label}-${link.href}`} href={link.href} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900">
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </article>
              )) : <p className="text-sm text-slate-500">No matching records.</p>}
            </div>
          </div>
        ) : null}
      </SlideOver>
    </>
  );
}
