'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createInventoryItem } from '../inventory/actions';
import type { InventoryActionResult, InventoryFormInput } from '../inventory/types';

type Props = {
  initialMode: 'add' | 'adjust';
  returnTo: string;
  initialPartNumber: string;
  initialDescription: string;
};

const EMPTY_FORM: InventoryFormInput = {
  item_id: '',
  part_number: '',
  description: '',
  category: '',
  location: '',
  qty_on_hand: null,
  reorder_point: null,
  is_supply: false,
};

export function InventoryAdjustClient({
  initialMode,
  returnTo,
  initialPartNumber,
  initialDescription,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'add' | 'adjust'>(initialMode);
  const [message, setMessage] = useState<InventoryActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<InventoryFormInput>({
    ...EMPTY_FORM,
    part_number: initialPartNumber,
    description: initialDescription,
  });

  const returnHref = useMemo(() => {
    return returnTo?.trim() ? returnTo.trim() : '/inventory';
  }, [returnTo]);

  function updateField<K extends keyof InventoryFormInput>(
    key: K,
    value: InventoryFormInput[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm({
      ...EMPTY_FORM,
      part_number: initialPartNumber,
      description: initialDescription,
    });
    setMessage(null);
  }

  function submitAddItem() {
    setMessage(null);

    startTransition(async () => {
      const result = await createInventoryItem(form);
      setMessage(result);

      if (result.ok) {
        resetForm();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="erp-panel p-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('add')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              mode === 'add'
                ? 'bg-cyan-700 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Add New Item
          </button>

          <button
            type="button"
            onClick={() => setMode('adjust')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              mode === 'adjust'
                ? 'bg-cyan-700 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Quantity Adjustment
          </button>
        </div>
      </div>

      {mode === 'add' ? (
        <div className="erp-panel p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Add New Inventory Item</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create a new inventory record, then return to receiving if needed.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Item ID</label>
              <input
                value={form.item_id}
                onChange={(event) => updateField('item_id', event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="INV-1001"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Part Number</label>
              <input
                value={form.part_number}
                onChange={(event) => updateField('part_number', event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="131950-390"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <input
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Harness assembly"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
              <input
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Harness"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Location</label>
              <input
                value={form.location}
                onChange={(event) => updateField('location', event.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="SEA991"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Starting Qty</label>
              <input
                type="number"
                min={0}
                value={form.qty_on_hand ?? ''}
                onChange={(event) =>
                  updateField(
                    'qty_on_hand',
                    event.target.value === '' ? null : Number(event.target.value)
                  )
                }
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reorder Point</label>
              <input
                type="number"
                min={0}
                value={form.reorder_point ?? ''}
                onChange={(event) =>
                  updateField(
                    'reorder_point',
                    event.target.value === '' ? null : Number(event.target.value)
                  )
                }
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(form.is_supply)}
                onChange={(event) => updateField('is_supply', event.target.checked)}
              />
              Supply / Consumable
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            {message ? (
              <p className={`text-sm font-medium ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                {message.message}
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                Add the item here, then continue receiving if this item came in from the dock.
              </p>
            )}

            <div className="flex gap-2">
              <Link
                href={returnHref}
                className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back
              </Link>

              <button
                type="button"
                onClick={submitAddItem}
                disabled={isPending}
                className="erp-button"
              >
                {isPending ? 'Saving...' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="erp-panel p-5">
          <h2 className="text-base font-semibold text-slate-900">Quantity Adjustment</h2>
          <p className="mt-2 text-sm text-slate-500">
            Next step: wire Add / Remove / Set Absolute Quantity with required reason codes and transaction logging.
          </p>
        </div>
      )}
    </div>
  );
}