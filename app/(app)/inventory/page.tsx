import { supabaseServer } from '@/lib/supabase/server';
import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';

function statusTone(status: string) {
  if (status === 'OUT') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'LOW STOCK') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

function getStatus(qtyOnHand: number, reorderPoint: number) {
  if (qtyOnHand <= 0) return 'OUT';
  if (qtyOnHand <= reorderPoint) return 'LOW STOCK';
  return 'IN STOCK';
}

type InventoryItem = {
  id: string;
  item_id: string | null;
  part_number: string | null;
  description: string | null;
  category: string | null;
  location: string | null;
  qty_on_hand: number | null;
  reorder_point: number | null;
  created_at?: string | null;
};

export default async function InventoryPage() {
  const supabase = await supabaseServer();

  const { data: supplies, error } = await supabase
    .from('inventory')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const inventory: InventoryItem[] = supplies ?? [];

  const totalItems = inventory.length;
  const lowStock = inventory.filter((item) => {
    const qty = item.qty_on_hand ?? 0;
    const reorder = item.reorder_point ?? 0;
    return qty > 0 && qty <= reorder;
  }).length;

  const outCount = inventory.filter((item) => {
    const qty = item.qty_on_hand ?? 0;
    return qty <= 0;
  }).length;

  const inStock = inventory.filter((item) => {
    const qty = item.qty_on_hand ?? 0;
    const reorder = item.reorder_point ?? 0;
    return qty > reorder;
  }).length;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Supplies Inventory"
        subtitle="Area stock for daily operations, separate from kit-specific build commitments"
        actions={
          <div className="flex gap-2">
            <button className="erp-button">Add Supply</button>
            <button className="erp-button">Upload CSV</button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Total Supply Items" value={totalItems} />
        <KpiCard label="In Stock" value={inStock} />
        <KpiCard label="Low Stock" value={lowStock} />
        <KpiCard label="Out" value={outCount} />
      </div>

      <div className="erp-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Item ID</th>
                <th className="px-4 py-3">Part Number</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Qty On Hand</th>
                <th className="px-4 py-3">Reorder Point</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No inventory records found.
                  </td>
                </tr>
              ) : (
                inventory.map((item) => {
                  const qtyOnHand = item.qty_on_hand ?? 0;
                  const reorderPoint = item.reorder_point ?? 0;
                  const status = getStatus(qtyOnHand, reorderPoint);

                  return (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {item.item_id ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {item.part_number ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {item.description ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {item.category ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {item.location ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{qtyOnHand}</td>
                      <td className="px-4 py-3 text-slate-700">{reorderPoint}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}