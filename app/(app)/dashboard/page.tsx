import Link from 'next/link';
import { SectionHeader } from '@/components/section-header';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ShippingManifestRow = {
  id: string;
  manifest_number: string | null;
  direction: string | null;
  stop_date: string | null;
  shipment_transfer_id: string | null;
  reference: string | null;
  from_location: string | null;
  from_address: string | null;
  to_location: string | null;
  to_address: string | null;
  items: string | null;
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

export default async function DashboardPage() {
  const supabase = await supabaseServer();

  const [shippingResult, inventoryResult] = await Promise.all([
    supabase
      .from('shipping_manifest_history')
      .select(
        'id,manifest_number,direction,stop_date,shipment_transfer_id,reference,from_location,from_address,to_location,to_address,items,created_at'
      )
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('inventory_transactions')
      .select(
        'id,transaction_date,transaction_type,part_number,description,quantity,from_location,to_location,created_at'
      )
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const shippingRows = (shippingResult.data ?? []) as ShippingManifestRow[];
  const inventoryRows = (inventoryResult.data ?? []) as InventoryTransactionRow[];

  const movementCount = shippingRows.length + inventoryRows.length;
  const manifestCount = new Set(shippingRows.map((row) => row.manifest_number).filter(Boolean)).size;
  const pickupCount = shippingRows.filter((row) => row.direction === 'incoming').length;
  const dropOffCount = shippingRows.filter((row) => row.direction === 'outgoing').length;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Executive Dashboard"
        subtitle="Operational visibility across shipping, receiving, inventory, and site movement"
      />

      {shippingResult.error || inventoryResult.error ? (
        <div className="erp-panel border-amber-200 bg-amber-50 p-5">
          <h2 className="text-base font-semibold text-amber-900">
            Some dashboard data could not load
          </h2>
          <div className="mt-2 space-y-1 text-sm text-amber-800">
            {shippingResult.error ? <p>Shipping: {shippingResult.error.message}</p> : null}
            {inventoryResult.error ? <p>Inventory: {inventoryResult.error.message}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="erp-panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Movement
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-950">{movementCount}</div>
          <p className="mt-2 text-sm text-slate-500">Shipping stops plus inventory movement.</p>
        </div>

        <div className="erp-panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Manifests
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-950">{manifestCount}</div>
          <p className="mt-2 text-sm text-slate-500">Unique manifests in recent history.</p>
        </div>

        <div className="erp-panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pickups
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-950">{pickupCount}</div>
          <p className="mt-2 text-sm text-slate-500">Recent inbound stops.</p>
        </div>

        <div className="erp-panel p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Drop Offs
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-950">{dropOffCount}</div>
          <p className="mt-2 text-sm text-slate-500">Recent outbound stops.</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="erp-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Latest Shipping Movement</h2>
              <p className="mt-1 text-xs text-slate-500">Pickup and drop-off stops from manifests.</p>
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
                {shippingRows.length ? (
                  shippingRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {displayValue(row.manifest_number)}
                        <div className="text-xs font-normal text-slate-500">
                          {formatDate(row.stop_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatDirection(row.direction)}</td>
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
              <h2 className="text-sm font-semibold text-slate-900">Latest Inventory Transactions</h2>
              <p className="mt-1 text-xs text-slate-500">Receipt, issue, and transfer activity.</p>
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
                {inventoryRows.length ? (
                  inventoryRows.map((row) => (
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
    </div>
  );
}