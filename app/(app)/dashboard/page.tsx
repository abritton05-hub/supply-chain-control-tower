import Link from 'next/link';
import { SectionHeader } from '@/components/section-header';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const LOCATIONS = [
  {
    code: 'SEA991',
    label: 'Primary Logistics Hub',
    purpose: 'Default inventory, receiving, staging, shipping, and delivery control.',
  },
  {
    code: 'WH/A13',
    label: 'Warehouse / A13',
    purpose: 'Warehouse pickups, overflow storage, and controlled movement into SEA991.',
  },
  {
    code: 'SEA99',
    label: 'Transfer Site',
    purpose: 'Transfer location for inbound/outbound LEO movement.',
  },
  {
    code: 'SEA111',
    label: 'Transfer Site',
    purpose: 'Transfer location for inbound/outbound LEO movement.',
  },
  {
    code: 'SEA129',
    label: 'Transfer Site',
    purpose: 'Transfer location for inbound/outbound LEO movement.',
  },
  {
    code: 'SEA133',
    label: 'Transfer Site',
    purpose: 'Transfer location for inbound/outbound LEO movement.',
  },
  {
    code: 'SEA143',
    label: 'Transfer Site',
    purpose: 'Transfer location for inbound/outbound LEO movement.',
  },
];

type ShippingManifestRow = {
  id: string;
  manifest_number: string | null;
  direction: string | null;
  title: string | null;
  stop_date: string | null;
  stop_time: string | null;
  shipment_transfer_id: string | null;
  reference: string | null;
  from_location: string | null;
  from_address: string | null;
  to_location: string | null;
  to_address: string | null;
  contact: string | null;
  items: string | null;
  status: string | null;
  created_at: string | null;
};

type InventoryTransactionRow = {
  id: string;
  transaction_date: string | null;
  transaction_type: string | null;
  part_number: string | null;
  description: string | null;
  quantity: number | null;
  from_location: string | null;
  to_location: string | null;
  reference: string | null;
  created_at: string | null;
};

function displayValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '-' : value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';

  const date = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function formatDirection(value: string | null | undefined) {
  if (value === 'incoming') return 'Pickup';
  if (value === 'outgoing') return 'Drop Off';

  return displayValue(value);
}

function locationText(code: string | null, address: string | null) {
  const cleanCode = code?.trim() || '';
  const cleanAddress = address?.trim() || '';

  if (!cleanCode && !cleanAddress) return '-';
  if (!cleanAddress) return cleanCode;
  if (!cleanCode) return cleanAddress;

  return `${cleanCode}\n${cleanAddress}`;
}

function countUniqueManifests(rows: ShippingManifestRow[]) {
  return new Set(rows.map((row) => row.manifest_number).filter(Boolean)).size;
}

function countByDirection(rows: ShippingManifestRow[], direction: string) {
  return rows.filter((row) => row.direction === direction).length;
}

export default async function DashboardPage() {
  const supabase = await supabaseServer();

  const [
    shippingResult,
    inventoryTransactionsResult,
  ] = await Promise.all([
    supabase
      .from('shipping_manifest_history')
      .select(
        'id,manifest_number,direction,title,stop_date,stop_time,shipment_transfer_id,reference,from_location,from_address,to_location,to_address,contact,items,status,created_at'
      )
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('inventory_transactions')
      .select(
        'id,transaction_date,transaction_type,part_number,description,quantity,from_location,to_location,reference,created_at'
      )
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const shippingRows = (shippingResult.data ?? []) as ShippingManifestRow[];
  const inventoryTransactions = (inventoryTransactionsResult.data ?? []) as InventoryTransactionRow[];

  const movementCount = shippingRows.length + inventoryTransactions.length;
  const manifestCount = countUniqueManifests(shippingRows);
  const pickupCount = countByDirection(shippingRows, 'incoming');
  const dropOffCount = countByDirection(shippingRows, 'outgoing');

  const latestShippingRows = shippingRows.slice(0, 8);
  const latestInventoryRows = inventoryTransactions.slice(0, 6);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Executive Dashboard"
        subtitle="High-level operational visibility across logistics, shipping, receiving, inventory, and site movement"
      />

      {(shippingResult.error || inventoryTransactionsResult.error) ? (
        <div className="erp-panel border-amber-200 bg-amber-50 p-5">
          <h2 className="text-base font-semibold text-amber-900">
            Some dashboard movement data could not load
          </h2>
          <div className="mt-2 space-y-1 text-sm leading-6 text-amber-800">
            {shippingResult.error ? (
              <p>Shipping movement: {shippingResult.error.message}</p>
            ) : null}
            {inventoryTransactionsResult.error ? (
              <p>Inventory transactions: {inventoryTransactionsResult.error.message}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="erp-panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Movement
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-950">{movementCount}</div>
          <p className="mt-2 text-sm text-slate-500">
            Shipping stops plus inventory transactions.
          </p>
        </div>

        <div className="erp-panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Manifests
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-950">{manifestCount}</div>
          <p className="mt-2 text-sm text-slate-500">
            Unique shipping manifests in history.
          </p>
        </div>

        <div className="erp-panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pickups
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-950">{pickupCount}</div>
          <p className="mt-2 text-sm text-slate-500">
            Incoming logistics stops.
          </p>
        </div>

        <div className="erp-panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Drop Offs
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-950">{dropOffCount}</div>
          <p className="mt-2 text-sm text-slate-500">
            Outbound logistics stops.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {LOCATIONS.map((location) => (
          <div key={location.code} className="erp-panel p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Location
            </div>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">{location.code}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-700">{location.label}</p>
            <p className="mt-3 text-sm leading-6 text-slate-500">{location.purpose}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="erp-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Latest Shipping Movement</h2>
              <p className="mt-1 text-xs text-slate-500">
                Recent pickup and drop-off stops from manifests.
              </p>
            </div>

            <Link href="/delivery" className="text-sm font-semibold text-cyan-700 hover:underline">
              Open Delivery
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Manifest</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">PO / Ref</th>
                  <th className="px-4 py-3">Items</th>
                </tr>
              </thead>

              <tbody>
                {latestShippingRows.length ? (
                  latestShippingRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {displayValue(row.manifest_number)}
                        <div className="text-xs font-normal text-slate-500">
                          {formatDate(row.stop_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDirection(row.direction)}
                      </td>
                      <td className="whitespace-pre-line px-4 py-3 text-slate-700">
                        {locationText(row.from_location, row.from_address)}
                      </td>
                      <td className="whitespace-pre-line px-4 py-3 text-slate-700">
                        {locationText(row.to_location, row.to_address)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {displayValue(row.shipment_transfer_id)}
                        <div className="text-xs text-slate-500">
                          {displayValue(row.reference)}
                        </div>
                      </td>
                      <td className="whitespace-pre-line px-4 py-3 text-slate-700">
                        {displayValue(row.items)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No shipping movement found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Latest Inventory Transactions
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Receipt, issue, and transfer activity.
              </p>
            </div>

            <Link
              href="/transactions"
              className="text-sm font-semibold text-cyan-700 hover:underline"
            >
              Open Transactions
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Part</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                </tr>
              </thead>

              <tbody>
                {latestInventoryRows.length ? (
                  latestInventoryRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(row.transaction_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {displayValue(row.transaction_type)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-semibold text-slate-900">
                          {displayValue(row.part_number)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {displayValue(row.description)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{displayValue(row.quantity)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {displayValue(row.from_location)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {displayValue(row.to_location)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No inventory transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="erp-panel p-6">
        <h2 className="text-lg font-semibold text-slate-900">Logistics Control View</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Track material movement across SEA991, WH/A13, and all transfer sites
          (SEA99, SEA111, SEA129, SEA133, SEA143). Receiving, pickups, drop-offs,
          manifests, BOM releases, and inventory bin locations roll up into this dashboard.
        </p>
      </div>
    </div>
  );
}