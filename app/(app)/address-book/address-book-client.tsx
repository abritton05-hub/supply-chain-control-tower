'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  deactivateAddressBookEntry,
  reactivateAddressBookEntry,
  saveAddressBookEntry,
} from './actions';
import type { AddressBookEntry, AddressBookFormInput, AddressType } from './types';

type AddressBookClientProps = {
  entries: AddressBookEntry[];
};

type FormState = AddressBookFormInput;

const emptyForm: FormState = {
  company_name: '',
  location_name: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'USA',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  location_type: 'both',
  notes: '',
  is_active: true,
};

function clean(value: string | null | undefined) {
  return value?.trim() || '';
}

function addressLine(entry: AddressBookEntry) {
  const parts = [
    entry.address_line_1,
    entry.address_line_2,
    entry.city,
    entry.state,
    entry.postal_code,
  ]
    .map((part) => clean(part))
    .filter(Boolean);

  return parts.join(', ');
}

function typeLabel(value: string | null) {
  if (value === 'pickup') return 'Pickup';
  if (value === 'dropoff') return 'Drop Off';
  return 'Both';
}

function toForm(entry: AddressBookEntry): FormState {
  return {
    id: entry.id,
    company_name: entry.company_name ?? '',
    location_name: entry.location_name ?? '',
    address_line_1: entry.address_line_1 ?? '',
    address_line_2: entry.address_line_2 ?? '',
    city: entry.city ?? '',
    state: entry.state ?? '',
    postal_code: entry.postal_code ?? '',
    country: entry.country ?? 'USA',
    contact_name: entry.contact_name ?? '',
    contact_phone: entry.contact_phone ?? '',
    contact_email: entry.contact_email ?? '',
    location_type:
      entry.location_type === 'pickup' ||
      entry.location_type === 'dropoff' ||
      entry.location_type === 'both'
        ? entry.location_type
        : 'both',
    notes: entry.notes ?? '',
    is_active: entry.is_active,
  };
}

export function AddressBookClient({ entries }: AddressBookClientProps) {
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  const filteredEntries = useMemo(() => {
    const term = query.trim().toLowerCase();

    return entries
      .filter((entry) => (showInactive ? true : entry.is_active))
      .filter((entry) => {
        if (!term) return true;

        const haystack = [
          entry.company_name,
          entry.location_name,
          entry.address_line_1,
          entry.address_line_2,
          entry.city,
          entry.state,
          entry.postal_code,
          entry.contact_name,
          entry.contact_phone,
          entry.contact_email,
          entry.notes,
        ]
          .map((value) => clean(value).toLowerCase())
          .join(' ');

        return haystack.includes(term);
      });
  }, [entries, query, showInactive]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openNewForm() {
    setMessage('');
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEditForm(entry: AddressBookEntry) {
    setMessage('');
    setForm(toForm(entry));
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setForm(emptyForm);
  }

  function handleSave() {
    setMessage('');

    startTransition(async () => {
      const result = await saveAddressBookEntry(form);
      setMessage(result.message);

      if (result.ok) {
        closeForm();
      }
    });
  }

  function handleArchive(id: string) {
    if (!window.confirm('Archive this address entry? It will be removed from active lists and dropdowns.')) {
      return;
    }

    setMessage('');

    startTransition(async () => {
      const result = await deactivateAddressBookEntry(id);
      setMessage(result.message);
    });
  }

  function handleRestore(id: string) {
    setMessage('');

    startTransition(async () => {
      const result = await reactivateAddressBookEntry(id);
      setMessage(result.message);
    });
  }

  const activeCount = entries.filter((entry) => entry.is_active).length;
  const inactiveCount = entries.length - activeCount;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Active Addresses
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-950">{activeCount}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Archived
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-950">{inactiveCount}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-2">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Master Data Rule
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Addresses live here once. Shipping, delivery, pickup, BOM, and manifest screens should
            pull from this list instead of typing the same address over and over.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-950">Address Book</h3>
            <p className="text-sm text-slate-500">
              Saved pickup and drop-off locations for manifests and delivery paperwork.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search company, contact, city, phone..."
              className="h-11 min-w-[280px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500"
            />

            <button
              type="button"
              onClick={() => setShowInactive((current) => !current)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {showInactive ? 'Hide Archived' : 'Show Archived'}
            </button>

            <button
              type="button"
              onClick={openNewForm}
              className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Add Address
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            {message}
          </div>
        ) : null}

        <div className="mt-4 overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Company / Location</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredEntries.length ? (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-950">{entry.company_name}</div>
                      <div className="text-sm text-slate-500">
                        {entry.location_name || 'Main location'}
                      </div>
                      {entry.notes ? (
                        <div className="mt-1 max-w-[280px] text-xs leading-5 text-slate-500">
                          {entry.notes}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3">
                      <div className="max-w-[340px] font-medium text-slate-800">
                        {addressLine(entry)}
                      </div>
                      <div className="text-xs text-slate-500">{entry.country || 'USA'}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">
                        {entry.contact_name || '-'}
                      </div>
                      <div className="text-xs text-slate-500">{entry.contact_phone || '-'}</div>
                      <div className="text-xs text-slate-500">{entry.contact_email || '-'}</div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                        {typeLabel(entry.location_type)}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          entry.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {entry.is_active ? 'Active' : 'Archived'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(entry)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>

                        {entry.is_active ? (
                          <button
                            type="button"
                            onClick={() => handleArchive(entry.id)}
                            disabled={isPending}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Delete (Archive)
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestore(entry.id)}
                            disabled={isPending}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    No addresses found. Add the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-950">
                  {form.id ? 'Edit Address' : 'Add Address'}
                </h3>
                <p className="text-sm text-slate-500">
                  This is master address data used by shipping, pickups, drop-offs, BOMs, and
                  manifests.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Company Name *
                </span>
                <input
                  value={form.company_name}
                  onChange={(event) => updateField('company_name', event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Location Name
                </span>
                <input
                  value={form.location_name}
                  onChange={(event) => updateField('location_name', event.target.value)}
                  placeholder="Warehouse, SEA99, Dock 4, Main Office..."
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Address Line 1 *
                </span>
                <input
                  value={form.address_line_1}
                  onChange={(event) => updateField('address_line_1', event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Address Line 2
                </span>
                <input
                  value={form.address_line_2}
                  onChange={(event) => updateField('address_line_2', event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  City
                </span>
                <input
                  value={form.city}
                  onChange={(event) => updateField('city', event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    State
                  </span>
                  <input
                    value={form.state}
                    onChange={(event) => updateField('state', event.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    ZIP
                  </span>
                  <input
                    value={form.postal_code}
                    onChange={(event) => updateField('postal_code', event.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Country
                </span>
                <input
                  value={form.country}
                  onChange={(event) => updateField('country', event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Address Type
                </span>
                <select
                  value={form.location_type}
                  onChange={(event) =>
                    updateField('location_type', event.target.value as AddressType)
                  }
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
                >
                  <option value="both">Both</option>
                  <option value="pickup">Pickup</option>
                  <option value="dropoff">Drop Off</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Contact Name
                </span>
                <input
                  value={form.contact_name}
                  onChange={(event) => updateField('contact_name', event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Contact Phone
                </span>
                <input
                  value={form.contact_phone}
                  onChange={(event) => updateField('contact_phone', event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Contact Email
                </span>
                <input
                  value={form.contact_email}
                  onChange={(event) => updateField('contact_email', event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Notes
                </span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
              </label>

              <label className="flex items-center gap-3 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_active ?? true}
                  onChange={(event) => updateField('is_active', event.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm font-semibold text-slate-700">Active address</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {isPending ? 'Saving...' : 'Save Address'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
