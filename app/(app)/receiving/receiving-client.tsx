'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RECEIVING_DRAFT_STORAGE_KEY } from '@/lib/ai/intake/draft-storage';
import type { ReceivingDraftPayload } from '@/lib/ai/intake/types';
import {
  buildReceivingLabelPayload,
  downloadLabelPayloadsCsv,
} from '@/lib/labels/p-touch';
import { receiveInventoryItem } from './actions';
import type {
  InventoryOption,
  InventoryTransaction,
  ReceiveActionResult,
  ReceiveInventoryInput,
} from './types';

type Props = {
  inventory: InventoryOption[];
  recentReceipts: InventoryTransaction[];
  initialItemQuery?: string;
};

type MeProfile = {
  email: string | null;
  full_name: string | null;
};

const EMPTY_FORM: ReceiveInventoryInput = {
  item_id: '',
  part_number: '',
  description: '',
  quantity: 1,
  reference: '',
  notes: '',
  is_supply: false,
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function labelFileSeed(row: InventoryTransaction) {
  return `receiving-label-${row.item_id || row.part_number || row.id}`;
}

function matchesInventoryItem(item: InventoryOption, value: string) {
  const needle = value.trim().toLowerCase();
  if (!needle) return false;

  return item.item_id.toLowerCase() === needle || item.part_number?.toLowerCase() === needle;
}

export function ReceivingClient({ inventory, recentReceipts, initialItemQuery = '' }: Props) {
  const router = useRouter();

  const [form, setForm] = useState<ReceiveInventoryInput>(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<ReceiveActionResult | null>(null);
  const [me, setMe] = useState<MeProfile>({ email: '', full_name: '' });
  const [isPending, startTransition] = useTransition();

  const selectedItem = inventory.find((item) => item.item_id === form.item_id);

  useEffect(() => {
    async function loadMe() {
      try {
        const response = await fetch('/api/users/me', { cache: 'no-store' });
        const result = await response.json();

        if (response.ok && result?.ok && result.profile) {
          setMe({
            email: result.profile.email ?? '',
            full_name: result.profile.full_name ?? '',
          });
        }
      } catch {
        setMe({ email: '', full_name: '' });
      }
    }

    loadMe();
  }, []);

  useEffect(() => {
    const value = initialItemQuery.trim();
    if (!value) return;

    const matchedItem = inventory.find((item) => matchesInventoryItem(item, value));
    setSearch(value);

    if (matchedItem) {
      setForm((prev) => ({
        ...prev,
        item_id: matchedItem.item_id,
        part_number: matchedItem.part_number ?? '',
        description: matchedItem.description ?? '',
      }));
      setSearch(`${matchedItem.item_id} ${matchedItem.part_number ?? ''}`.trim());
      setMessage({
        ok: true,
        message: 'Inventory item prefilled. Confirm quantity before posting.',
      });
    }
  }, [initialItemQuery, inventory]);

  useEffect(() => {
    const rawDraft = window.localStorage.getItem(RECEIVING_DRAFT_STORAGE_KEY);
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as Partial<ReceivingDraftPayload>;
      const partNumber = typeof draft.part_number === 'string' ? draft.part_number : '';
      const itemId = typeof draft.item_id === 'string' ? draft.item_id : '';
      const matchedItem = inventory.find(
        (item) =>
          (itemId && item.item_id === itemId) ||
          (partNumber && item.part_number?.toLowerCase() === partNumber.toLowerCase())
      );

      setForm({
        item_id: matchedItem?.item_id ?? itemId,
        part_number: matchedItem?.part_number ?? partNumber,
        description:
          matchedItem?.description ??
          (typeof draft.description === 'string' ? draft.description : ''),
        quantity:
          typeof draft.quantity === 'number' && Number.isFinite(draft.quantity) && draft.quantity > 0
            ? draft.quantity
            : 1,
        reference: typeof draft.reference === 'string' ? draft.reference : '',
        notes: typeof draft.notes === 'string' ? draft.notes : '',
        is_supply: Boolean(draft.is_supply),
      });
      setSearch(`${matchedItem?.item_id ?? itemId} ${matchedItem?.part_number ?? partNumber}`.trim());
      setMessage({
        ok: true,
        message: 'AI intake draft loaded. Review the fields before posting.',
      });
    } catch {
      setMessage({
        ok: false,
        message: 'AI intake draft could not be loaded.',
      });
    } finally {
      window.localStorage.removeItem(RECEIVING_DRAFT_STORAGE_KEY);
    }
  }, [inventory]);

  const matchingItems = useMemo(() => {
    if (form.is_supply) return [];

    const value = search.trim().toLowerCase();
    if (!value) return inventory.slice(0, 10);

    return inventory
      .filter((item) =>
        `${item.item_id} ${item.part_number ?? ''} ${item.description} ${item.location ?? ''}`
          .toLowerCase()
          .includes(value)
      )
      .slice(0, 10);
  }, [inventory, search, form.is_supply]);

  const displayReceivedBy =
    me.full_name?.trim() || me.email?.trim() || 'Loading user...';

  const addNewItemHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set('mode', 'add');
    params.set('returnTo', '/receiving');

    if (form.part_number?.trim()) {
      params.set('part_number', form.part_number.trim());
    }

    if (form.description?.trim()) {
      params.set('description', form.description.trim());
    }

    return `/inventory-adjust?${params.toString()}`;
  }, [form.part_number, form.description]);

  function updateField<K extends keyof ReceiveInventoryInput>(
    key: K,
    value: ReceiveInventoryInput[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function selectItem(item: InventoryOption) {
    updateField('item_id', item.item_id);
    updateField('part_number', item.part_number ?? '');
    updateField('description', item.description ?? '');
    setSearch(`${item.item_id} ${item.part_number ?? ''}`.trim());
  }

  function clearForm() {
    setForm(EMPTY_FORM);
    setSearch('');
    setMessage(null);
  }

  function toggleSupplyMode(checked: boolean) {
    setForm({
      ...EMPTY_FORM,
      is_supply: checked,
      quantity: form.quantity || 1,
      reference: checked ? form.reference : '',
      notes: checked ? form.notes : '',
    });
    setSearch('');
    setMessage(null);
  }

  function submitReceipt() {
    setMessage(null);

    startTransition(async () => {
      const result = await receiveInventoryItem({
        ...form,
        performed_by: displayReceivedBy || undefined,
      });

      setMessage(result);

      if (result.ok) {
        setForm(EMPTY_FORM);
        setSearch('');
        router.refresh();
      }
    });
  }

  function exportReceiptLabel(row: InventoryTransaction) {
    const payload = buildReceivingLabelPayload({
      itemId: row.item_id,
      partNumber: row.part_number,
      description: row.description,
      quantity: row.quantity,
      location: row.to_location,
      reference: row.reference,
      date: row.transaction_date || row.created_at,
    });

    downloadLabelPayloadsCsv([payload], labelFileSeed(row));
    setMessage({
      ok: true,
      message: 'Label data exported for P-touch Editor import.',
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="erp-panel p-4 lg:col-span-2">
          <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={form.is_supply}
                onChange={(event) => toggleSupplyMode(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Receive as Supply
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Check this for tape, paper, gloves, labels, office supplies, and other consumables that should not go into standard inventory.
            </p>
          </div>

          {!form.is_supply ? (
            <>
              <div className="mb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Select Inventory Item
                  </div>

                  <Link
                    href={addNewItemHref}
                    className="text-sm font-semibold text-cyan-700 hover:underline"
                  >
                    Item not found? Add New Item
                  </Link>
                </div>

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search item ID, part number, description, or location"
                  className="mt-2 w-full rounded border border-slate-300 px-3 py-3 text-base"
                  autoFocus
                />
                <p className="mt-2 text-xs text-slate-500">
                  Receiving posts against existing inventory items. If the item is new, create it first in Inventory Adjust.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Inventory Item</label>
                  <select
                    value={form.item_id}
                    onChange={(event) => updateField('item_id', event.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select item</option>
                    {inventory.map((item) => (
                      <option key={item.id} value={item.item_id}>
                        {item.item_id} | {item.part_number || 'No part #'} | {item.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Received Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(event) => updateField('quantity', Number(event.target.value))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Reference</label>
                  <input
                    value={form.reference}
                    onChange={(event) => updateField('reference', event.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="PO, tracking number, RMA, or dock note"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Received By</label>
                  <input
                    value={displayReceivedBy}
                    readOnly
                    className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(event) => updateField('notes', event.target.value)}
                    className="min-h-[88px] w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Condition, shortage note, damage, packaging, or receiving context"
                  />
                </div>
              </div>

              {selectedItem ? (
                <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  Current on hand: <span className="font-semibold">{selectedItem.qty_on_hand ?? 0}</span>
                  {' | '}Location: <span className="font-semibold">{selectedItem.location || '-'}</span>
                  {' | '}New on hand after receipt:{' '}
                  <span className="font-semibold">
                    {(selectedItem.qty_on_hand ?? 0) + (Number(form.quantity) || 0)}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Supply Description</label>
                <input
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Tape, gloves, paper, labels, stapler, etc."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Part Number / SKU</label>
                <input
                  value={form.part_number}
                  onChange={(event) => updateField('part_number', event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Received Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(event) => updateField('quantity', Number(event.target.value))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Reference</label>
                <input
                  value={form.reference}
                  onChange={(event) => updateField('reference', event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="PO, tracking number, order number, or dock note"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Received By</label>
                <input
                  value={displayReceivedBy}
                  readOnly
                  className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  className="min-h-[88px] w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Vendor, condition, carton count, urgency, or receiving context"
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {message ? (
              <p className={`text-sm font-medium ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                {message.message}
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                {form.is_supply
                  ? 'Submit posts a supply receipt for accountability and traceability.'
                  : 'Submit creates a RECEIPT transaction and increases inventory on hand.'}
              </p>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={clearForm} className="erp-button">
                Clear
              </button>
              <button type="button" onClick={submitReceipt} disabled={isPending} className="erp-button">
                {isPending ? 'Saving...' : 'Post Receipt'}
              </button>
            </div>
          </div>
        </div>

        <div className="erp-panel p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {form.is_supply ? 'Supply Mode' : 'Matching Inventory'}
          </div>
          <div className="space-y-2">
            {form.is_supply ? (
              <p className="text-sm text-slate-500">
                Supply receipts do not need an existing inventory item match.
              </p>
            ) : matchingItems.length === 0 ? (
              <p className="text-sm text-slate-500">No matching inventory items.</p>
            ) : (
              matchingItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  className="block w-full rounded border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <div className="text-sm font-medium text-slate-900">{item.item_id}</div>
                  <div className="text-xs text-slate-500">
                    {item.part_number || '-'} | {item.description}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    On hand: {item.qty_on_hand ?? 0} | {item.location || '-'}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="erp-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Recent Receipt Transactions</div>
          <div className="text-xs text-slate-500">
            These rows are stored in the inventory transaction history.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Received At</th>
                <th className="px-4 py-3">Item ID</th>
                <th className="px-4 py-3">Part Number</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Received By</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {recentReceipts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    No receipt transactions found.
                  </td>
                </tr>
              ) : (
                recentReceipts.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(row.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {row.item_id ? (
                        <Link href={`/inventory/${row.item_id}`} className="text-cyan-700 hover:underline">
                          {row.item_id}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.part_number || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.description || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.quantity}</td>
                    <td className="px-4 py-3 text-slate-700">{row.to_location || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.reference || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.performed_by || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.notes || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="erp-row-actions">
                        <button
                          type="button"
                          onClick={() => exportReceiptLabel(row)}
                          className="erp-action-primary"
                        >
                          Export P-touch Label Data
                        </button>
                        {row.item_id ? (
                          <Link href={`/inventory/${row.item_id}`} className="erp-action-secondary">
                            View Inventory Item
                          </Link>
                        ) : null}
                        <Link
                          href={`/transactions?type=RECEIPT#transaction-${row.id}`}
                          className="erp-action-secondary"
                        >
                          View Transaction
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
