'use client';

import Link from 'next/link';
import { useState } from 'react';

import { DataTable } from '@/components/data-table';
import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { StatusChip } from '@/components/status-chip';
import { inventoryItems, projectBuilds, purchaseOrders, shipmentLog } from '@/lib/data/mock-data';
import { inventoryMetrics, poDaysLate, shipmentDelayFlag } from '@/lib/logic';

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
        type="button"
        aria-label="Close drawer backdrop"
        className="h-full flex-1 cursor-default"
        onClick={onClose}
      />
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{state.title}</h2>
            {state.subtitle ? <p className="mt-1 text-sm text-slate-500">{state.subtitle}</p> : null}
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
                    className="block text-sm"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div className="font-semibold text-cyan-700 hover:underline">{record.title}</div>
                    {record.subtitle ? <div className="mt-1 text-slate-500">{record.subtitle}</div> : null}
                  </Link>
                ) : (
                  <div className="text-sm">
                    <div className="font-semibold text-slate-900">{record.title}</div>
                    {record.subtitle ? <div className="mt-1 text-slate-500">{record.subtitle}</div> : null}
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
  helper,
  onClick,
}: {
  label: string;
  value: number;
  helper?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left transition hover:scale-[1.01] hover:cursor-pointer"
    >
      <KpiCard label={label} value={value} helper={helper} />
    </button>
  );
}

export default function ControlTowerPage() {
  const [drawer, setDrawer] = useState<DrawerState>(null);

  const risky = inventoryItems
    .map((i) => ({ ...i, ...inventoryMetrics(i) }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  const latePos = purchaseOrders.filter((po) => poDaysLate(po) !== '');
  const delayed = shipmentLog.filter((s) => shipmentDelayFlag(s) === 'YES');
  const issues = projectBuilds.filter((p) => p.issuedQty < p.requiredQty);

  const priorityActions: DrawerRecord[] = [
    ...risky.map((item) => ({
      id: `action-item-${item.itemId}`,
      title: `Review ${item.itemId}`,
      subtitle: `${item.priority} · Risk ${item.riskScore} · Reorder ${item.suggestedOrderQty}`,
      href: `/inventory/${item.itemId}`,
    })),
    ...latePos.slice(0, 5).map((po) => ({
      id: `action-po-${po.poNumber}`,
      title: `Escalate ${po.poNumber}`,
      subtitle: `${po.vendor} · ${poDaysLate(po)} days late`,
      href: `/open-pos/${po.poNumber}`,
    })),
  ];

  const openDrawer = (title: string, subtitle: string, records: DrawerRecord[]) => {
    setDrawer({ title, subtitle, records });
  };

  return (
    <div className="space-y-4">
      <Drawer state={drawer} onClose={() => setDrawer(null)} />

      <SectionHeader
        title="Control Tower"
        subtitle="Operations command center for risk, inbound, outbound, and project exceptions"
      />

      <button
        type="button"
        onClick={() =>
          openDrawer(
            'Shift Focus',
            'Inbound risks, outbound delays, and build shortages needing immediate review.',
            [
              ...risky.map((item) => ({
                id: `focus-item-${item.itemId}`,
                title: `${item.itemId} — ${item.itemName}`,
                subtitle: `Risk ${item.riskScore} · Days Cover ${item.daysCover.toFixed(1)}`,
                href: `/inventory/${item.itemId}`,
              })),
              ...latePos.map((po) => ({
                id: `focus-po-${po.poNumber}`,
                title: `${po.poNumber} — ${po.vendor}`,
                subtitle: `${po.itemId} · ${poDaysLate(po)} days late`,
                href: `/open-pos/${po.poNumber}`,
              })),
              ...delayed.map((shipment) => ({
                id: `focus-ship-${shipment.id}`,
                title: `${shipment.id} — ${shipment.customer}`,
                subtitle: `${shipment.itemId} · ${shipment.status}`,
                href: `/shipment-log/${shipment.id}`,
              })),
            ],
          )
        }
        className="erp-banner block w-full text-left transition hover:cursor-pointer hover:opacity-95"
      >
        <p className="text-sm font-semibold">Shift Focus: Inbound risks + outbound delays + build shortages</p>
      </button>

      <div className="grid gap-4 md:grid-cols-4">
        <ClickableKpiCard
          label="Top Risk Items"
          value={risky.length}
          helper="Ranked by blended risk score"
          onClick={() =>
            openDrawer(
              'Top Risk Items',
              'Inventory records with the highest current risk scores.',
              risky.map((item) => ({
                id: item.itemId,
                title: `${item.itemId} — ${item.itemName}`,
                subtitle: `Days Cover ${item.daysCover.toFixed(1)} · Priority ${item.priority} · Vendor ${item.preferredVendor}`,
                href: `/inventory/${item.itemId}`,
              })),
            )
          }
        />
        <ClickableKpiCard
          label="Late Inbound POs"
          value={latePos.length}
          helper="Expected date exceeded"
          onClick={() =>
            openDrawer(
              'Late Inbound POs',
              'Inbound purchase orders that are overdue.',
              latePos.map((po) => ({
                id: po.id,
                title: `${po.poNumber} — ${po.vendor}`,
                subtitle: `${po.itemId} · Expected ${po.expectedDelivery ?? 'N/A'} · ${poDaysLate(po)} days late`,
                href: `/open-pos/${po.poNumber}`,
              })),
            )
          }
        />
        <ClickableKpiCard
          label="Delayed Shipments"
          value={delayed.length}
          helper="Flagged by delay logic"
          onClick={() =>
            openDrawer(
              'Delayed Shipments',
              'Outbound shipments currently delayed.',
              delayed.map((shipment) => ({
                id: shipment.id,
                title: `${shipment.id} — ${shipment.customer}`,
                subtitle: `${shipment.itemId} · ETA ${shipment.estimatedDelivery} · ${shipment.carrier}`,
                href: `/shipment-log/${shipment.id}`,
              })),
            )
          }
        />
        <ClickableKpiCard
          label="Key Project Issues"
          value={issues.length}
          helper="Issued qty below required"
          onClick={() =>
            openDrawer(
              'Key Project Issues',
              'Projects with shortages or incomplete issue allocation.',
              issues.map((project) => ({
                id: project.id,
                title: `${project.projectId} — WO ${project.workOrder}`,
                subtitle: `${project.customer} · Required ${project.requiredQty} · Issued ${project.issuedQty}`,
                href: `/projects-builds/${project.projectId}`,
              })),
            )
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataTable>
          <thead>
            <tr>
              {['Item ID', 'Item Name', 'Days Cover', 'Reorder Needed', 'Risk Score', 'Priority'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {risky.map((item) => (
              <tr
                key={item.itemId}
                className="hover:bg-slate-50"
                onClick={() =>
                  openDrawer(
                    `Risk Item — ${item.itemId}`,
                    'Detailed shortage and risk context.',
                    [
                      {
                        id: item.itemId,
                        title: `${item.itemId} — ${item.itemName}`,
                        subtitle: `Vendor ${item.preferredVendor} · Qty ${item.currentInventory} · Reorder ${item.suggestedOrderQty}`,
                        href: `/inventory/${item.itemId}`,
                      },
                      {
                        id: `${item.itemId}-vendor`,
                        title: `Vendor — ${item.preferredVendor}`,
                        subtitle: 'Open vendor record',
                        href: `/vendors/${item.preferredVendor === 'Apex Electronics' ? 'v1' : item.preferredVendor === 'PowerGrid Supply' ? 'v2' : 'v3'}`,
                      },
                    ],
                  )
                }
              >
                <td>
                  <Link href={`/inventory/${item.itemId}`} className="font-semibold text-cyan-700 hover:underline" target="_blank" rel="noreferrer">
                    {item.itemId}
                  </Link>
                </td>
                <td>{item.itemName}</td>
                <td>{item.daysCover.toFixed(1)}</td>
                <td><StatusChip value={item.reorderNeeded} /></td>
                <td>{item.riskScore}</td>
                <td><StatusChip value={item.priority} /></td>
              </tr>
            ))}
          </tbody>
        </DataTable>

        <DataTable>
          <thead>
            <tr>
              {['PO Number', 'Vendor', 'Expected Delivery', 'Status', 'Days Late'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {latePos.map((po) => (
              <tr
                key={po.poNumber}
                className="hover:bg-slate-50"
                onClick={() =>
                  openDrawer(
                    `Late PO — ${po.poNumber}`,
                    'Purchase order drill-down.',
                    [
                      {
                        id: po.id,
                        title: `${po.poNumber} — ${po.vendor}`,
                        subtitle: `${po.itemId} · Qty ${po.qtyOrdered} · Expected ${po.expectedDelivery ?? 'N/A'}`,
                        href: `/open-pos/${po.poNumber}`,
                      },
                      {
                        id: `${po.id}-item`,
                        title: `Item — ${po.itemId}`,
                        subtitle: 'Open inventory item record',
                        href: `/inventory/${po.itemId}`,
                      },
                    ],
                  )
                }
              >
                <td>
                  <Link href={`/open-pos/${po.poNumber}`} className="font-semibold text-cyan-700 hover:underline" target="_blank" rel="noreferrer">
                    {po.poNumber}
                  </Link>
                </td>
                <td>{po.vendor}</td>
                <td>{po.expectedDelivery}</td>
                <td><StatusChip value={po.status} /></td>
                <td>{poDaysLate(po)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataTable>
          <thead>
            <tr>
              {['Delayed Shipment', 'Customer', 'ETA', 'Status'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {delayed.map((shipment) => (
              <tr
                key={shipment.id}
                className="hover:bg-slate-50"
                onClick={() =>
                  openDrawer(
                    `Delayed Shipment — ${shipment.id}`,
                    'Shipment exception drill-down.',
                    [
                      {
                        id: shipment.id,
                        title: `${shipment.id} — ${shipment.customer}`,
                        subtitle: `${shipment.itemId} · ETA ${shipment.estimatedDelivery} · Carrier ${shipment.carrier}`,
                        href: `/shipment-log/${shipment.id}`,
                      },
                      {
                        id: `${shipment.id}-item`,
                        title: `Item — ${shipment.itemId}`,
                        subtitle: 'Open inventory item record',
                        href: `/inventory/${shipment.itemId}`,
                      },
                    ],
                  )
                }
              >
                <td>
                  <Link href={`/shipment-log/${shipment.id}`} className="font-semibold text-cyan-700 hover:underline" target="_blank" rel="noreferrer">
                    {shipment.id}
                  </Link>
                </td>
                <td>{shipment.customer}</td>
                <td>{shipment.estimatedDelivery}</td>
                <td><StatusChip value={shipment.status} /></td>
              </tr>
            ))}
          </tbody>
        </DataTable>

        <DataTable>
          <thead>
            <tr>
              {['Priority Action', 'Reason'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {priorityActions.map((action) => (
              <tr
                key={action.id}
                className="hover:bg-slate-50"
                onClick={() =>
                  openDrawer(
                    'Priority Action',
                    'Recommended forward action.',
                    [action],
                  )
                }
              >
                <td>
                  {action.href ? (
                    <Link href={action.href} className="font-semibold text-cyan-700 hover:underline" target="_blank" rel="noreferrer">
                      {action.title}
                    </Link>
                  ) : (
                    <span className="font-semibold text-slate-900">{action.title}</span>
                  )}
                </td>
                <td>{action.subtitle}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
    </div>
  );
}