'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { DataTable } from '@/components/data-table';
import { FilterBar } from '@/components/filter-bar';
import { KpiCard } from '@/components/kpi-card';
import { SearchInput } from '@/components/search-input';
import { SectionHeader } from '@/components/section-header';
import { StatusChip } from '@/components/status-chip';
import { inventoryMetrics } from '@/lib/logic';
import type {
  AddInventoryInput,
  CriticalityLevel,
  InventoryOverviewRow,
  TrackingType,
} from '@/lib/types/inventory';
import { addInventoryItem } from './actions';

type LookupOption = {
  id: string;
  vendor_name?: string;
  department_name?: string;
  location_name?: string;
};

type Props = {
  organizationId: string;
  initialRows: InventoryOverviewRow[];
  vendors: LookupOption[];
  departments: LookupOption[];
  locations: LookupOption[];
};

type AddForm = {
  itemId: string;
  itemName: string;
  description: string;
  trackingType: TrackingType;
  inventoryType: string;
  criticality: CriticalityLevel;
  preferredVendorId: string;
  departmentId: string;
  averageDailyUsage: number;
  leadTimeDays: number;
  safetyStock: number;
  openingQuantity: number;
  locationId: string;
  notes: string;
};

const buildEmptyForm = (defaults: {
  vendorId?: string;
  departmentId?: string;
  locationId?: string;
}): AddForm => ({
  itemId: '',
  itemName: '',
  description: '',
  trackingType: 'QUANTITY',
  inventoryType: 'COMPONENT',
  criticality: 'NORMAL',
  preferredVendorId: defaults.vendorId ?? '',
  departmentId: defaults.departmentId ?? '',
  averageDailyUsage: 0,
  leadTimeDays: 0,
  safetyStock: 0,
  openingQuantity: 0,
  locationId: defaults.locationId ?? '',
  notes: '',
});

function AddInventoryModal({
  form,
  setForm,
  error,
  isPending,
  onClose,
  onSubmit,
  vendors,
  departments,
  locations,
}: {
  form: AddForm;
  setForm: React.Dispatch<React.SetStateAction<AddForm>>;
  error: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  vendors: LookupOption[];
  departments: LookupOption[];
  locations: LookupOption[];
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-5xl rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add Inventory Item</h2>
            <p className="text-sm text-slate-500">
              Create a real inventory item and opening balance.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-6 px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Item ID</label>
              <input
                value={form.itemId}
                onChange={(e) => setForm((prev) => ({ ...prev, itemId: e.target.value }))}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="INV-1001"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Item Name</label>
              <input
                value={form.itemName}
                onChange={(e) => setForm((prev) => ({ ...prev, itemName: e.target.value }))}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Servo Motor"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Short description"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tracking Type</label>
              <select
                value={form.trackingType}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, trackingType: e.target.value as TrackingType }))
                }
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="SERIALIZED">SERIALIZED</option>
                <option value="LOT">LOT</option>
                <option value="QUANTITY">QUANTITY</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Inventory Type</label>
              <input
                value={form.inventoryType}
                onChange={(e) => setForm((prev) => ({ ...prev, inventoryType: e.target.value }))}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="COMPONENT"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Criticality</label>
              <select
                value={form.criticality}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, criticality: e.target.value as CriticalityLevel }))
                }
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="NORMAL">NORMAL</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Preferred Vendor</label>
              <select
                value={form.preferredVendorId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, preferredVendorId: e.target.value }))
                }
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.vendor_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
              <select
                value={form.departmentId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, departmentId: e.target.value }))
                }
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.department_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Location</label>
              <select
                value={form.locationId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, locationId: e.target.value }))
                }
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.location_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Opening Quantity</label>
              <input
                type="number"
                value={form.openingQuantity}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, openingQuantity: Number(e.target.value) }))
                }
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Average Daily Usage</label>
              <input
                type="number"
                value={form.averageDailyUsage}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, averageDailyUsage: Number(e.target.value) }))
                }
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Lead Time Days</label>
              <input
                type="number"
                value={form.leadTimeDays}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, leadTimeDays: Number(e.target.value) }))
                }
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Safety Stock</label>
              <input
                type="number"
                value={form.safetyStock}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, safetyStock: Number(e.target.value) }))
                }
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="min-h-[96px] w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Opening balance note"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded border border-cyan-700 bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-60"
            >
              {isPending ? 'Saving...' : 'Save Inventory Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InventoryClientPage({
  organizationId,
  initialRows,
  vendors,
  departments,
  locations,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [critical, setCritical] = useState('ALL');
  const [reorder, setReorder] = useState('ALL');
  const [tracking, setTracking] = useState('ALL');
  const [department, setDepartment] = useState('ALL');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addError, setAddError] = useState('');
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState(
    buildEmptyForm({
      vendorId: vendors[0]?.id,
      departmentId: departments[0]?.id,
      locationId: locations[0]?.id,
    })
  );

  const rows = useMemo(
    () =>
      initialRows
        .map((item) => ({
          ...item,
          currentInventory: Number(item.current_inventory),
          averageDailyUsage: Number(item.average_daily_usage),
          leadTimeDays: Number(item.lead_time_days),
          safetyStock: Number(item.safety_stock),
          trackingType: item.tracking_type as 'SERIALIZED' | 'LOT' | 'QUANTITY',
          inventoryType: item.inventory_type as 'RAW' | 'WIP' | 'FG' | 'MRO',
          criticality: item.criticality as 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW',
          preferredVendor: item.preferred_vendor,
          department: item.department as 'Assembly' | 'Warehouse' | 'Service' | 'Engineering',
          itemId: item.item_id,
          itemName: item.item_name,
        }))
        .map((item) => ({
          ...item,
          ...inventoryMetrics({
            currentInventory: item.currentInventory,
            averageDailyUsage: item.averageDailyUsage,
            leadTimeDays: item.leadTimeDays,
            safetyStock: item.safetyStock,
            criticality: item.criticality as 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW',
          }),
        }))
        .filter((item) => {
          const searchPass = `${item.itemId} ${item.itemName} ${item.description}`
            .toLowerCase()
            .includes(query.toLowerCase());
          const criticalPass = critical === 'ALL' || item.criticality === critical;
          const reorderPass = reorder === 'ALL' || item.reorderNeeded === reorder;
          const trackingPass = tracking === 'ALL' || item.trackingType === tracking;
          const departmentPass = department === 'ALL' || item.department === department;
          return searchPass && criticalPass && reorderPass && trackingPass && departmentPass;
        }),
    [critical, department, initialRows, query, reorder, tracking]
  );

  const reorderCount = rows.filter((r) => r.reorderNeeded === 'YES').length;

  function openAddModal() {
    setAddError('');
    setForm(
      buildEmptyForm({
        vendorId: vendors[0]?.id,
        departmentId: departments[0]?.id,
        locationId: locations[0]?.id,
      })
    );
    setIsAddOpen(true);
  }

  function closeAddModal() {
    setIsAddOpen(false);
    setAddError('');
  }

  function handleAddInventory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddError('');

    const payload: AddInventoryInput = {
      organizationId,
      itemId: form.itemId,
      itemName: form.itemName,
      description: form.description,
      trackingType: form.trackingType,
      inventoryType: form.inventoryType,
      criticality: form.criticality,
      preferredVendorId: form.preferredVendorId || null,
      departmentId: form.departmentId || null,
      averageDailyUsage: Number(form.averageDailyUsage) || 0,
      leadTimeDays: Number(form.leadTimeDays) || 0,
      safetyStock: Number(form.safetyStock) || 0,
      openingQuantity: Number(form.openingQuantity) || 0,
      locationId: form.locationId,
      notes: form.notes,
      performedByUserId: null,
    };

    startTransition(async () => {
      const result = await addInventoryItem(payload);

      if (!result.ok) {
        setAddError(result.message);
        return;
      }

      closeAddModal();
      router.refresh();
    });
  }

  function vendorHref(vendorName: string) {
    const match = vendors.find((vendor) => vendor.vendor_name === vendorName);
    return match ? `/vendors/${match.id}` : '#';
  }

  return (
    <div>
      {isAddOpen ? (
        <AddInventoryModal
          form={form}
          setForm={setForm}
          error={addError}
          isPending={isPending}
          onClose={closeAddModal}
          onSubmit={handleAddInventory}
          vendors={vendors}
          departments={departments}
          locations={locations}
        />
      ) : null}

      <SectionHeader
        title="Inventory Database"
        subtitle="Operational inventory visibility with reorder and risk logic"
        actions={
          <button
            type="button"
            onClick={openAddModal}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
          >
            Add Inventory
          </button>
        }
      />

      <div className="erp-banner">
        <p className="text-sm font-semibold">Inventory command view</p>
        <p className="text-xs text-slate-200">
          Computed planning fields are live from current usage, lead time, and safety stock assumptions.
        </p>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <KpiCard label="Filtered Items" value={rows.length} />
        <KpiCard label="Need Reorder" value={reorderCount} />
        <KpiCard label="Critical Filter" value={critical} />
        <KpiCard label="Department Filter" value={department} />
      </div>

      <FilterBar>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search Item ID, Name, Description"
        />

        <select
          className="rounded border border-slate-300 px-2 text-sm"
          value={critical}
          onChange={(e) => setCritical(e.target.value)}
        >
          <option value="ALL">Critical: All</option>
          <option>CRITICAL</option>
          <option>HIGH</option>
          <option>NORMAL</option>
          <option>LOW</option>
        </select>

        <select
          className="rounded border border-slate-300 px-2 text-sm"
          value={reorder}
          onChange={(e) => setReorder(e.target.value)}
        >
          <option value="ALL">Reorder: All</option>
          <option>YES</option>
          <option>OK</option>
        </select>

        <select
          className="rounded border border-slate-300 px-2 text-sm"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
        >
          <option value="ALL">Tracking: All</option>
          <option>SERIALIZED</option>
          <option>LOT</option>
          <option>QUANTITY</option>
        </select>

        <select
          className="rounded border border-slate-300 px-2 text-sm"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option value="ALL">Department: All</option>
          {[...new Set(rows.map((row) => row.department).filter(Boolean))].map((dep) => (
            <option key={dep} value={dep}>
              {dep}
            </option>
          ))}
        </select>
      </FilterBar>

      <DataTable>
        <thead>
          <tr>
            {[
              'Item ID',
              'Item Name',
              'Description',
              'Tracking Type',
              'Inventory Type',
              'Current Inventory',
              'Average Daily Usage',
              'Lead Time Days',
              'Safety Stock',
              'Qty Above Safety',
              'Reorder Point',
              'Reorder Needed',
              'Days Cover',
              'Projected Stockout Date',
              'Next Suggested Order Date',
              'Suggested Order Qty',
              'Priority',
              'Risk Score',
              'Critical',
              'Preferred Vendor',
              'Department',
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((item) => (
            <tr key={item.itemId} className={item.reorderNeeded === 'YES' ? 'bg-rose-50' : ''}>
              <td className="font-semibold">
                <Link href={`/inventory/${item.itemId}`} className="text-cyan-700 hover:underline">
                  {item.itemId}
                </Link>
              </td>
              <td>{item.itemName}</td>
              <td>{item.description}</td>
              <td>{item.trackingType}</td>
              <td>{item.inventoryType}</td>
              <td>{item.currentInventory}</td>
              <td>{item.averageDailyUsage}</td>
              <td>{item.leadTimeDays}</td>
              <td>{item.safetyStock}</td>
              <td className={item.quantityAboveSafetyStock <= 0 ? 'font-semibold text-rose-700' : ''}>
                {item.quantityAboveSafetyStock}
              </td>
              <td>{item.reorderPoint}</td>
              <td>
                <StatusChip value={item.reorderNeeded} />
              </td>
              <td>{item.daysCover.toFixed(1)}</td>
              <td>{item.projectedStockoutDate}</td>
              <td>{item.nextSuggestedOrderDate}</td>
              <td>{item.suggestedOrderQty}</td>
              <td>
                <StatusChip value={item.priority} />
              </td>
              <td>{item.riskScore}</td>
              <td>
                <StatusChip value={item.criticality} />
              </td>
              <td>
                <Link href={vendorHref(item.preferredVendor)} className="text-cyan-700 hover:underline">
                  {item.preferredVendor}
                </Link>
              </td>
              <td>{item.department}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
