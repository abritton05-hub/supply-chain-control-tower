'use client';

import Link from 'next/link';
import { useState } from 'react';

import { SectionHeader } from '@/components/section-header';
import { DataTable } from '@/components/data-table';
import {
  inventoryItems,
  projectBuilds,
  purchaseOrders,
  shipmentLog,
  transactions,
} from '@/lib/data/mock-data';
import { inventoryMetrics, poDaysLate, shipmentDelayFlag } from '@/lib/logic';

type MiniStat = { label: string; value: number };

type DrawerRecord = {
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
};

type DrawerState = {
  title: string;
  subtitle?: string;
  records: DrawerRecord[];
} | null;

function Drawer({
  state,
  onClose,
}: {
  state: DrawerState;
  onClose: () => void;
}) {
  if (!state) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
      <button
        aria-label="Close drawer backdrop"
        className="h-full flex-1 cursor-default"
        onClick={onClose}
        type="button"
      />
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{state.title}</h2>
            {state.subtitle ? (
              <p className="mt-1 text-sm text-slate-500">{state.subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 p-5">
          {state.records.length === 0 ? (
            <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No matching records.
            </div>
          ) : (
            state.records.map((record) => (
              <div
                key={record.id}
                className="rounded border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
              >
                {record.href ? (
                  <Link
                    href={record.href}
                    className="block cursor-pointer text-sm"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div className="font-semibold text-cyan-700 hover:underline">
                      {record.title}
                    </div>
                    {record.subtitle ? (
                      <div className="mt-1 text-slate-500">{record.subtitle}</div>
                    ) : null}
                  </Link>
                ) : (
                  <div className="text-sm">
                    <div className="font-semibold text-slate-900">{record.title}</div>
                    {record.subtitle ? (
                      <div className="mt-1 text-slate-500">{record.subtitle}</div>
                    ) : null}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function ClickableKpiCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-full w-full text-left transition hover:scale-[1.01] hover:cursor-pointer"
    >
      <article className="flex h-[190px] min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="min-h-[88px] border-b border-slate-200 pb-3 text-[15px] font-medium leading-8 text-slate-900">
          {label}
        </div>

        <div className="pt-4 text-4xl font-semibold tracking-tight text-slate-950">
          {value}
        </div>
      </article>
    </button>
  );
}

function BarChart({
  title,
  data,
  onSelect,
}: {
  title: string;
  data: MiniStat[];
  onSelect?: (label: string) => void;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <article className="erp-card p-3">
      <h3 className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">
        {title}
      </h3>
      <div className="space-y-2">
        {data.map((d) => {
          const content = (
            <div className="grid grid-cols-[140px_1fr_34px] items-center gap-2 text-xs">
              <span className="truncate text-slate-600">{d.label}</span>
              <div className="h-2 rounded bg-slate-200">
                <div
                  className="h-2 rounded bg-slate-700"
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
              </div>
              <span className="text-right font-semibold text-slate-700">{d.value}</span>
            </div>
          );

          if (!onSelect) {
            return <div key={d.label}>{content}</div>;
          }

          return (
            <button
              key={d.label}
              type="button"
              onClick={() => onSelect(d.label)}
              className="w-full rounded px-1 py-1 text-left transition hover:cursor-pointer hover:bg-slate-50"
            >
              {content}
            </button>
          );
        })}
      </div>
    </article>
  );
}

function PercentPanel({ label, value }: { label: string; value: number }) {
  return (
    <article className="erp-card p-3">
      <p className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">
        {label}
      </p>
      <p className="text-2xl font-semibold text-slate-900">{value}%</p>
      <div className="mt-2 h-2 rounded bg-slate-200">
        <div className="h-2 rounded bg-emerald-600" style={{ width: `${value}%` }} />
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const [drawer, setDrawer] = useState<DrawerState>(null);

  const today = new Date('2026-03-05');
  const in48h = new Date(today.getTime() + 48 * 60 * 60 * 1000);

  const enriched = inventoryItems.map((item) => ({
    ...item,
    ...inventoryMetrics(item),
  }));

  const lowStockItems = enriched.filter((i) => i.reorderNeeded === 'YES');
  const belowSafetyItems = enriched.filter((i) => i.quantityAboveSafetyStock <= 0);
  const criticalItems = inventoryItems.filter((i) => i.criticality === 'CRITICAL');
  const openPoRecords = purchaseOrders.filter((p) => p.status !== 'CLOSED');
  const latePoRecords = purchaseOrders.filter((p) => poDaysLate(p) !== '');
  const delayedShipRecords = shipmentLog.filter((s) => shipmentDelayFlag(s) === 'YES');
  const activeProjectRecords = projectBuilds.filter((p) => p.buildStatus !== 'COMPLETE');
  const inTransitRecords = shipmentLog.filter((s) => s.status === 'IN_TRANSIT');
  const receiptsTodayRecords = purchaseOrders.filter(
    (po) => po.expectedDelivery === '2026-03-05'
  );
  const pickupsTodayRecords = shipmentLog.filter((s) => s.shipDate === '2026-03-05');

  const lowStock = lowStockItems.length;
  const belowSafety = belowSafetyItems.length;
  const critical = criticalItems.length;
  const openPos = openPoRecords.length;
  const latePos = latePoRecords.length;
  const delayed = delayedShipRecords.length;
  const activeProjects = activeProjectRecords.length;
  const inTransit = inTransitRecords.length;
  const receiptsToday = receiptsTodayRecords.length;
  const pickupsToday = pickupsTodayRecords.length;

  const inventoryByDept: MiniStat[] = ['Assembly', 'Warehouse', 'Service', 'Engineering'].map(
    (dept) => ({
      label: dept,
      value: enriched
        .filter((i) => i.department === dept)
        .reduce((sum, i) => sum + i.currentInventory, 0),
    })
  );

  const inventoryByProject: MiniStat[] = projectBuilds.map((p) => ({
    label: p.projectId,
    value: p.requiredQty - p.issuedQty,
  }));

  const shipmentStatus: MiniStat[] = ['DELIVERED', 'IN_TRANSIT', 'DELAYED'].map((s) => ({
    label: s,
    value: shipmentLog.filter((row) => row.status === s).length,
  }));

  const poStatus: MiniStat[] = ['OPEN', 'PARTIAL', 'LATE'].map((s) => ({
    label: s,
    value: purchaseOrders.filter((row) => row.status === s).length,
  }));

  const criticalityMix: MiniStat[] = ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'].map((c) => ({
    label: c,
    value: inventoryItems.filter((i) => i.criticality === c).length,
  }));

  const latePoByVendor: MiniStat[] = purchaseOrders
    .filter((po) => poDaysLate(po) !== '')
    .map((po) => ({ label: po.vendor, value: Number(poDaysLate(po)) || 0 }));

  const upcomingDeliveries: MiniStat[] = ['2026-03-05', '2026-03-06', '2026-03-07'].map(
    (d) => ({
      label: d,
      value: purchaseOrders.filter((po) => po.expectedDelivery === d).length,
    })
  );

  const transactionsByType: MiniStat[] = [
    'RECEIPT',
    'TRANSFER',
    'ISSUE',
    'BUILD COMPLETE',
    'CYCLE COUNT',
  ].map((t) => ({
    label: t,
    value: transactions.filter((row) => row.movementType === t).length,
  }));

  const projectBuildStatus: MiniStat[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE'].map(
    (s) => ({
      label: s,
      value: projectBuilds.filter((p) => p.buildStatus === s).length,
    })
  );

  const percentAboveSafety = Math.round(
    (enriched.filter((i) => i.quantityAboveSafetyStock > 0).length / enriched.length) * 100
  );
  const percentPoOnTime = Math.round(
    ((purchaseOrders.length - latePos) / purchaseOrders.length) * 100
  );
  const percentShipOnTime = Math.round(
    ((shipmentLog.length - delayed) / shipmentLog.length) * 100
  );

  const topRisk = [...enriched].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
  const latePoTable = latePoRecords;
  const delayedShipTable = delayedShipRecords;

  const operationsWindow = [
    ...purchaseOrders
      .filter((po) => po.expectedDelivery)
      .map((po) => ({
        id: `po-${po.id}`,
        type: 'po' as const,
        label: `Inbound PO ${po.poNumber}`,
        when: po.expectedDelivery!,
        detail: `${po.vendor} · ${po.itemId}`,
        href: `/open-pos/${po.poNumber}`,
      })),
    ...shipmentLog.map((s) => ({
      id: `ship-${s.id}`,
      type: 'shipment' as const,
      label: `Shipment ${s.id}`,
      when: s.estimatedDelivery,
      detail: `${s.customer} · ${s.status}`,
      href: `/shipment-log/${s.id}`,
    })),
    ...topRisk.map((i) => ({
      id: `item-${i.itemId}`,
      type: 'item' as const,
      label: `Shortage ${i.itemId}`,
      when: i.nextSuggestedOrderDate,
      detail: `${i.priority} · Days Cover ${i.daysCover.toFixed(1)}`,
      href: `/inventory/${i.itemId}`,
    })),
  ].filter((e) => {
    const dt = new Date(e.when);
    return dt >= today && dt <= in48h;
  });

  const openDrawer = (title: string, subtitle: string, records: DrawerRecord[]) => {
    setDrawer({ title, subtitle, records });
  };

  const departmentDrawer = (dept: string) => {
    const matches = enriched
      .filter((item) => item.department === dept)
      .map((item) => ({
        id: item.itemId,
        title: `${item.itemId} — ${item.itemName}`,
        subtitle: `Qty ${item.currentInventory} · Safety ${item.safetyStock} · Vendor ${item.preferredVendor}`,
        href: `/inventory/${item.itemId}`,
      }));

    openDrawer(`Inventory — ${dept}`, `Items currently assigned to ${dept}.`, matches);
  };

  const projectDrawer = (projectId: string) => {
    const matches = projectBuilds
      .filter((project) => project.projectId === projectId)
      .map((project) => ({
        id: project.id,
        title: `${project.projectId} — WO ${project.workOrder}`,
        subtitle: `Customer ${project.customer} · Required ${project.requiredQty} · Issued ${project.issuedQty}`,
        href: `/projects-builds/${project.projectId}`,
      }));

    openDrawer(`Project Exposure — ${projectId}`, 'Project demand and shortage records.', matches);
  };

  const shipmentStatusDrawer = (status: string) => {
    const matches = shipmentLog
      .filter((shipment) => shipment.status === status)
      .map((shipment) => ({
        id: shipment.id,
        title: `${shipment.id} — ${shipment.customer}`,
        subtitle: `${shipment.itemId} · ETA ${shipment.estimatedDelivery} · ${shipment.carrier}`,
        href: `/shipment-log/${shipment.id}`,
      }));

    openDrawer(`Shipment Status — ${status}`, 'Matching shipment records.', matches);
  };

  const poStatusDrawer = (status: string) => {
    const matches = purchaseOrders
      .filter((po) => po.status === status)
      .map((po) => ({
        id: po.id,
        title: `${po.poNumber} — ${po.vendor}`,
        subtitle: `${po.itemId} · Expected ${po.expectedDelivery ?? 'N/A'} · Status ${po.status}`,
        href: `/open-pos/${po.poNumber}`,
      }));

    openDrawer(`PO Status — ${status}`, 'Matching purchase orders.', matches);
  };

  const criticalityDrawer = (level: string) => {
    const matches = inventoryItems
      .filter((item) => item.criticality === level)
      .map((item) => ({
        id: item.itemId,
        title: `${item.itemId} — ${item.itemName}`,
        subtitle: `${item.description} · Vendor ${item.preferredVendor}`,
        href: `/inventory/${item.itemId}`,
      }));

    openDrawer(`Criticality — ${level}`, 'Items at this criticality level.', matches);
  };

  const vendorLatePoDrawer = (vendor: string) => {
    const matches = purchaseOrders
      .filter((po) => po.vendor === vendor && poDaysLate(po) !== '')
      .map((po) => ({
        id: po.id,
        title: `${po.poNumber} — ${po.itemId}`,
        subtitle: `Expected ${po.expectedDelivery ?? 'N/A'} · ${poDaysLate(po)} days late`,
        href: `/open-pos/${po.poNumber}`,
      }));

    openDrawer(`Late POs — ${vendor}`, 'Late purchase orders for this vendor.', matches);
  };

  const transactionTypeDrawer = (movementType: string) => {
    const matches = transactions
      .filter((transaction) => transaction.movementType === movementType)
      .map((transaction) => ({
        id: transaction.id,
        title: `${transaction.itemId} — ${transaction.movementType}`,
        subtitle: `${transaction.date} · Qty ${transaction.quantity} · Ref ${transaction.reference}`,
        href: `/inventory/${transaction.itemId}`,
      }));

    openDrawer(`Transactions — ${movementType}`, 'Matching inventory movements.', matches);
  };

  const projectBuildStatusDrawer = (status: string) => {
    const matches = projectBuilds
      .filter((project) => project.buildStatus === status)
      .map((project) => ({
        id: project.id,
        title: `${project.projectId} — WO ${project.workOrder}`,
        subtitle: `${project.customer} · Build ${project.buildStatus} · Ship ${project.shipStatus}`,
        href: `/projects-builds/${project.projectId}`,
      }));

    openDrawer(`Build Status — ${status}`, 'Projects matching this build status.', matches);
  };

  return (
    <div className="space-y-4">
      <Drawer state={drawer} onClose={() => setDrawer(null)} />

      

      <SectionHeader
        title="Dashboard"
        subtitle=""
        actions={
          <select className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">
            <option>All</option>
            <option>Warehouse A</option>
            <option>Warehouse B</option>
          </select>
        }
      />

      <div className="grid auto-rows-fr gap-3 md:grid-cols-5 xl:grid-cols-10">
        <ClickableKpiCard
          label="Low Stock Items"
          value={lowStock}
          onClick={() =>
            openDrawer(
              'Low Stock Items',
              'Items that currently need reorder action.',
              lowStockItems.map((item) => ({
                id: item.itemId,
                title: `${item.itemId} — ${item.itemName}`,
                subtitle: `Qty ${item.currentInventory} · Reorder ${item.suggestedOrderQty} · Vendor ${item.preferredVendor}`,
                href: `/inventory/${item.itemId}`,
              }))
            )
          }
        />

        <ClickableKpiCard
          label="Below Safety Stock"
          value={belowSafety}
          onClick={() =>
            openDrawer(
              'Below Safety Stock',
              'Items currently below safety stock.',
              belowSafetyItems.map((item) => ({
                id: item.itemId,
                title: `${item.itemId} — ${item.itemName}`,
                subtitle: `Above Safety ${item.quantityAboveSafetyStock} · Days Cover ${item.daysCover.toFixed(1)}`,
                href: `/inventory/${item.itemId}`,
              }))
            )
          }
        />

        <ClickableKpiCard
          label="Critical Items"
          value={critical}
          onClick={() =>
            openDrawer(
              'Critical Items',
              'Items marked as CRITICAL.',
              criticalItems.map((item) => ({
                id: item.itemId,
                title: `${item.itemId} — ${item.itemName}`,
                subtitle: `${item.description} · Vendor ${item.preferredVendor}`,
                href: `/inventory/${item.itemId}`,
              }))
            )
          }
        />

        <ClickableKpiCard
          label="Open POs"
          value={openPos}
          onClick={() =>
            openDrawer(
              'Open Purchase Orders',
              'Currently open purchase orders.',
              openPoRecords.map((po) => ({
                id: po.id,
                title: `${po.poNumber} — ${po.vendor}`,
                subtitle: `${po.itemId} · Qty ${po.qtyOrdered} · Expected ${po.expectedDelivery ?? 'N/A'}`,
                href: `/open-pos/${po.poNumber}`,
              }))
            )
          }
        />

        <ClickableKpiCard
          label="Late POs"
          value={latePos}
          onClick={() =>
            openDrawer(
              'Late Purchase Orders',
              'Purchase orders currently overdue.',
              latePoRecords.map((po) => ({
                id: po.id,
                title: `${po.poNumber} — ${po.vendor}`,
                subtitle: `${po.itemId} · ${poDaysLate(po)} days late`,
                href: `/open-pos/${po.poNumber}`,
              }))
            )
          }
        />

        <ClickableKpiCard
          label="Delayed Shipments"
          value={delayed}
          onClick={() =>
            openDrawer(
              'Delayed Shipments',
              'Shipments flagged as delayed.',
              delayedShipRecords.map((shipment) => ({
                id: shipment.id,
                title: `${shipment.id} — ${shipment.customer}`,
                subtitle: `${shipment.itemId} · ETA ${shipment.estimatedDelivery} · ${shipment.status}`,
                href: `/shipment-log/${shipment.id}`,
              }))
            )
          }
        />

        <ClickableKpiCard
          label="Active Projects"
          value={activeProjects}
          onClick={() =>
            openDrawer(
              'Active Projects',
              'Projects that are not yet complete.',
              activeProjectRecords.map((project) => ({
                id: project.id,
                title: `${project.projectId} — WO ${project.workOrder}`,
                subtitle: `${project.customer} · Build ${project.buildStatus} · Ship ${project.shipStatus}`,
                href: `/projects-builds/${project.projectId}`,
              }))
            )
          }
        />

        <ClickableKpiCard
          label="Shipments In Transit"
          value={inTransit}
          onClick={() =>
            openDrawer(
              'Shipments In Transit',
              'Shipments currently in transit.',
              inTransitRecords.map((shipment) => ({
                id: shipment.id,
                title: `${shipment.id} — ${shipment.customer}`,
                subtitle: `${shipment.itemId} · ETA ${shipment.estimatedDelivery} · ${shipment.carrier}`,
                href: `/shipment-log/${shipment.id}`,
              }))
            )
          }
        />

        <ClickableKpiCard
          label="Receipts Expected Today"
          value={receiptsToday}
          onClick={() =>
            openDrawer(
              'Receipts Expected Today',
              'Purchase orders expected today.',
              receiptsTodayRecords.map((po) => ({
                id: po.id,
                title: `${po.poNumber} — ${po.vendor}`,
                subtitle: `${po.itemId} · Qty ${po.qtyOrdered}`,
                href: `/open-pos/${po.poNumber}`,
              }))
            )
          }
        />

        <ClickableKpiCard
          label="Pickups Scheduled Today"
          value={pickupsToday}
          onClick={() =>
            openDrawer(
              'Pickups Scheduled Today',
              'Shipments scheduled to go out today.',
              pickupsTodayRecords.map((shipment) => ({
                id: shipment.id,
                title: `${shipment.id} — ${shipment.customer}`,
                subtitle: `${shipment.itemId} · Carrier ${shipment.carrier}`,
                href: `/shipment-log/${shipment.id}`,
              }))
            )
          }
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <BarChart
          title="Inventory by Department"
          data={inventoryByDept}
          onSelect={departmentDrawer}
        />
        <BarChart
          title="Inventory by Project (Unissued Qty)"
          data={inventoryByProject}
          onSelect={projectDrawer}
        />
        <BarChart
          title="Shipment Status"
          data={shipmentStatus}
          onSelect={shipmentStatusDrawer}
        />
        <BarChart title="PO Status" data={poStatus} onSelect={poStatusDrawer} />
        <BarChart
          title="Criticality Mix"
          data={criticalityMix}
          onSelect={criticalityDrawer}
        />
        <BarChart
          title="Late POs by Vendor"
          data={latePoByVendor.length ? latePoByVendor : [{ label: 'None', value: 0 }]}
          onSelect={(label) => label !== 'None' && vendorLatePoDrawer(label)}
        />
        <BarChart
          title="Upcoming Deliveries by Day"
          data={upcomingDeliveries}
          onSelect={(label) =>
            openDrawer(
              `Upcoming Deliveries — ${label}`,
              'Purchase orders due on this day.',
              purchaseOrders
                .filter((po) => po.expectedDelivery === label)
                .map((po) => ({
                  id: po.id,
                  title: `${po.poNumber} — ${po.vendor}`,
                  subtitle: `${po.itemId} · Qty ${po.qtyOrdered}`,
                  href: `/open-pos/${po.poNumber}`,
                }))
            )
          }
        />
        <BarChart
          title="Transactions by Type"
          data={transactionsByType}
          onSelect={transactionTypeDrawer}
        />
        <BarChart
          title="Project Build Status"
          data={projectBuildStatus}
          onSelect={projectBuildStatusDrawer}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <PercentPanel label="Inventory Above Safety Stock" value={percentAboveSafety} />
        <PercentPanel label="POs On Time" value={percentPoOnTime} />
        <PercentPanel label="Shipments Delivered On Time" value={percentShipOnTime} />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <DataTable>
          <thead>
            <tr>
              {['Top Risk Items', 'Priority', 'Risk Score', 'Days Cover'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topRisk.map((item) => (
              <tr key={item.itemId} className="hover:bg-slate-50">
                <td>
                  <Link
                    href={`/inventory/${item.itemId}`}
                    className="font-semibold text-cyan-700 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.itemId}
                  </Link>
                </td>
                <td>{item.priority}</td>
                <td>{item.riskScore}</td>
                <td>{item.daysCover.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>

        <DataTable>
          <thead>
            <tr>
              {['Delayed Shipments', 'Customer', 'ETA', 'Status'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {delayedShipTable.map((shipment) => (
              <tr key={shipment.id} className="hover:bg-slate-50">
                <td>
                  <Link
                    href={`/shipment-log/${shipment.id}`}
                    className="font-semibold text-cyan-700 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shipment.id}
                  </Link>
                </td>
                <td>{shipment.customer}</td>
                <td>{shipment.estimatedDelivery}</td>
                <td>{shipment.status}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>

        <DataTable>
          <thead>
            <tr>
              {['Late Purchase Orders', 'Vendor', 'Expected', 'Days Late'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {latePoTable.map((po) => (
              <tr key={po.id} className="hover:bg-slate-50">
                <td>
                  <Link
                    href={`/open-pos/${po.poNumber}`}
                    className="font-semibold text-cyan-700 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {po.poNumber}
                  </Link>
                </td>
                <td>{po.vendor}</td>
                <td>{po.expectedDelivery}</td>
                <td>{poDaysLate(po)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>

        <DataTable>
          <thead>
            <tr>
              {['Priority Actions', 'Reason'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topRisk.map((item) => (
              <tr key={`action-${item.itemId}`} className="hover:bg-slate-50">
                <td>
                  <Link
                    href={`/inventory/${item.itemId}`}
                    className="font-semibold text-cyan-700 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Review {item.itemId}
                  </Link>
                </td>
                <td>
                  {item.priority} · Reorder {item.suggestedOrderQty}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>

      <section className="erp-card p-4">
        <h3 className="mb-3 border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">
          48-Hour Operations Window
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          Watchlist for deliveries, pickups, shortages, and project risk events due within the
          next 48 hours.
        </p>
        <div className="grid gap-2">
          {operationsWindow.length === 0 ? (
            <div className="text-sm text-slate-500">
              No high-priority events in next 48 hours.
            </div>
          ) : (
            operationsWindow.map((event) => (
              <Link
                key={event.id}
                href={event.href}
                className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition hover:cursor-pointer hover:border-slate-300 hover:bg-white"
                target="_blank"
                rel="noreferrer"
              >
                <div>
                  <span className="font-semibold text-cyan-700 hover:underline">
                    {event.label}
                  </span>
                  <span className="ml-2 text-slate-500">{event.detail}</span>
                </div>
                <span className="text-xs font-semibold text-slate-600">{event.when}</span>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}