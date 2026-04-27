'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PULL_REQUEST_DRAFT_STORAGE_KEY } from '@/lib/ai/intake/draft-storage';
import type { PullRequestDraftPayload } from '@/lib/ai/intake/types';
import type { InventoryRecord } from '../inventory/types';
import { supabaseBrowser } from '@/lib/supabase/client';

type PullRequestClientProps = {
  inventory: InventoryRecord[];
  initialItemQuery?: string;
  canFulfillRequests: boolean;
};

type RequestLine = {
  lineId: string;
  item_id: string;
  part_number: string;
  description: string;
  location: string;
  quantity: number;
  notes: string;
};

type SavedPullRequestLine = {
  id: string;
  item_id: string | null;
  part_number: string | null;
  description: string | null;
  quantity: number | null;
  quantity_fulfilled?: number | null;
  fulfillment_status?: string | null;
  location: string | null;
  notes: string | null;
};

type SavedPullRequest = {
  id: string;
  request_number: string | null;
  status: string | null;
  requested_by: string | null;
  created_at: string | null;
  pull_request_lines?: SavedPullRequestLine[];
};

type PullRequestApiResponse = {
  ok: boolean;
  requests?: SavedPullRequest[];
  message?: string;
};

type ClosePullRequestResponse = {
  ok: boolean;
  message?: string;
  closedCount?: number;
};

type TabKey = 'request' | 'requested';

function requestNumber() {
  return `PR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function matchesItem(item: InventoryRecord, value: string) {
  const needle = value.trim().toLowerCase();
  if (!needle) return true;

  return [item.item_id, item.part_number, item.description, item.location]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(needle));
}

function exactItem(item: InventoryRecord, value: string) {
  const needle = value.trim().toLowerCase();
  return item.item_id.toLowerCase() === needle || item.part_number?.toLowerCase() === needle;
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function statusBadgeClass(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes('closed') || normalized.includes('complete') || normalized.includes('fulfilled')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (normalized.includes('partial')) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (normalized.includes('cancel') || normalized.includes('reject')) return 'border-rose-200 bg-rose-50 text-rose-700';

  return 'border-cyan-200 bg-cyan-50 text-cyan-700';
}

function lineRequestedQty(line: SavedPullRequestLine) {
  return Number(line.quantity) || 0;
}

function lineFulfilledQty(line: SavedPullRequestLine) {
  return Number(line.quantity_fulfilled) || 0;
}

function lineRemainingQty(line: SavedPullRequestLine) {
  return Math.max(lineRequestedQty(line) - lineFulfilledQty(line), 0);
}

function requestFulfillmentSummary(request: SavedPullRequest) {
  const lines = request.pull_request_lines ?? [];
  const requested = lines.reduce((sum, line) => sum + lineRequestedQty(line), 0);
  const fulfilled = lines.reduce((sum, line) => sum + lineFulfilledQty(line), 0);

  return { requested, fulfilled, remaining: Math.max(requested - fulfilled, 0) };
}

function normalizedRequestStatus(request: SavedPullRequest) {
  const rawStatus = (request.status || 'OPEN').toUpperCase();
  const { requested, fulfilled, remaining } = requestFulfillmentSummary(request);

  if (rawStatus === 'CLOSED' || rawStatus === 'COMPLETED') return rawStatus;
  if (requested > 0 && remaining === 0) return 'FULFILLED';
  if (fulfilled > 0) return 'PARTIAL';

  return rawStatus;
}

function canCloseRequest(request: SavedPullRequest) {
  const status = normalizedRequestStatus(request);

  return status !== 'CLOSED' && status !== 'COMPLETED';
}

export function PullRequestClient({
  inventory,
  initialItemQuery = '',
  canFulfillRequests,
}: PullRequestClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('request');
  const [requestedBy, setRequestedBy] = useState('');
  const [search, setSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [requestLines, setRequestLines] = useState<RequestLine[]>([]);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [savedRequests, setSavedRequests] = useState<SavedPullRequest[]>([]);
  const [savedRequestsLoading, setSavedRequestsLoading] = useState(false);
  const [savedRequestsError, setSavedRequestsError] = useState('');
  const [requestSearch, setRequestSearch] = useState('');
  const [requestorFilter, setRequestorFilter] = useState('ALL');
  const [partFilter, setPartFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionMessage, setActionMessage] = useState('');
  const [closingRequestId, setClosingRequestId] = useState('');
  const [isClosingAll, setIsClosingAll] = useState(false);

  useEffect(() => {
    const query = initialItemQuery.trim();
    if (!query) return;

    const exactMatch = inventory.find((item) => exactItem(item, query));
    setActiveTab('request');

    if (exactMatch) {
      setSelectedItemId(exactMatch.id);
      setSearch(`${exactMatch.part_number || exactMatch.item_id} ${exactMatch.description}`.trim());
      setMessage(`Matched ${exactMatch.part_number || exactMatch.item_id}.`);
      return;
    }

    setSearch(query);
  }, [initialItemQuery, inventory]);

  useEffect(() => {
    const supabase = supabaseBrowser();

    supabase.auth.getUser().then(({ data }) => {
      setRequestedBy(data.user?.email ?? '');
    });
  }, []);

  useEffect(() => {
    const rawDraft = window.localStorage.getItem(PULL_REQUEST_DRAFT_STORAGE_KEY);
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as Partial<PullRequestDraftPayload>;
      const requestedByDraft =
        typeof draft.requested_by === 'string' && draft.requested_by.trim()
          ? draft.requested_by.trim()
          : '';
      const lines = Array.isArray(draft.lines) ? draft.lines : [];
      const unmatched: string[] = [];
      const mappedLines: RequestLine[] = [];

      for (const line of lines) {
        const partNumber = typeof line.part_number === 'string' ? line.part_number.trim() : '';
        const description = typeof line.description === 'string' ? line.description.trim() : '';
        const match = inventory.find(
          (item) =>
            (partNumber && item.part_number?.toLowerCase() === partNumber.toLowerCase()) ||
            (description && item.description.toLowerCase() === description.toLowerCase())
        );

        if (!match) {
          unmatched.push(partNumber || description || 'Unnamed line');
          continue;
        }

        mappedLines.push({
          lineId: `ai-intake-${match.id}-${mappedLines.length}`,
          item_id: match.item_id,
          part_number: match.part_number ?? partNumber,
          description: match.description,
          location: match.location ?? '',
          quantity:
            typeof line.quantity === 'number' && Number.isFinite(line.quantity) && line.quantity > 0
              ? line.quantity
              : 1,
          notes: [
            typeof draft.notes === 'string' ? draft.notes.trim() : '',
            typeof line.notes === 'string' ? line.notes.trim() : '',
          ]
            .filter(Boolean)
            .join('\n'),
        });
      }

      if (requestedByDraft) {
        setRequestedBy(requestedByDraft);
      }

      if (mappedLines.length) {
        setRequestLines(mappedLines);
      }

      setActiveTab('request');
      setMessage(
        unmatched.length
          ? `AI intake draft loaded with ${mappedLines.length} matched line(s). Match these before submit: ${unmatched.join(', ')}.`
          : 'AI intake draft loaded. Review the request before submitting.'
      );
    } catch {
      setMessage('AI intake draft could not be loaded.');
    } finally {
      window.localStorage.removeItem(PULL_REQUEST_DRAFT_STORAGE_KEY);
    }
  }, [inventory]);

  async function loadSavedRequests() {
    setSavedRequestsLoading(true);
    setSavedRequestsError('');

    try {
      const response = await fetch('/api/pull-requests', { cache: 'no-store' });
      const result = (await response.json()) as PullRequestApiResponse;

      if (!response.ok || !result.ok) {
        setSavedRequests([]);
        setSavedRequestsError(result.message || 'Failed to load requested parts log.');
        setSavedRequestsLoading(false);
        return;
      }

      setSavedRequests(result.requests ?? []);
      setSavedRequestsLoading(false);
    } catch (error) {
      setSavedRequests([]);
      setSavedRequestsError(
        error instanceof Error ? error.message : 'Failed to load requested parts log.'
      );
      setSavedRequestsLoading(false);
    }
  }

  useEffect(() => {
    loadSavedRequests();
  }, []);

  const selectedItem = useMemo(
    () => inventory.find((item) => item.id === selectedItemId),
    [inventory, selectedItemId]
  );

  const searchResults = useMemo(() => {
    return inventory.filter((item) => matchesItem(item, search)).slice(0, 20);
  }, [inventory, search]);

  const requestorOptions = useMemo(() => {
    const values = new Set<string>();
    for (const row of savedRequests) {
      if (row.requested_by?.trim()) values.add(row.requested_by.trim());
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [savedRequests]);

  const filteredSavedRequests = useMemo(() => {
    return savedRequests.filter((request) => {
      const lineText = (request.pull_request_lines ?? [])
        .map((line) =>
          [line.item_id, line.part_number, line.description, line.location, line.notes]
            .filter(Boolean)
            .join(' ')
        )
        .join(' ')
        .toLowerCase();

      const linePartMatch =
        !partFilter.trim() ||
        (request.pull_request_lines ?? []).some((line) =>
          `${line.part_number || ''} ${line.item_id || ''} ${line.description || ''}`
            .toLowerCase()
            .includes(partFilter.trim().toLowerCase())
        );

      const mainText = `${request.request_number || ''} ${request.requested_by || ''} ${request.status || ''} ${normalizedRequestStatus(request)} ${lineText}`.toLowerCase();

      const searchMatch =
        !requestSearch.trim() || mainText.includes(requestSearch.trim().toLowerCase());

      const requestorMatch =
        requestorFilter === 'ALL' || (request.requested_by || '') === requestorFilter;

      const statusMatch = statusFilter === 'ALL' || normalizedRequestStatus(request) === statusFilter;

      return searchMatch && requestorMatch && statusMatch && linePartMatch;
    });
  }, [savedRequests, requestSearch, requestorFilter, statusFilter, partFilter]);

  const openRequestCount = useMemo(
    () => savedRequests.filter((request) => canCloseRequest(request)).length,
    [savedRequests]
  );

  function selectItem(item: InventoryRecord) {
    setSelectedItemId(item.id);
    setSearch(`${item.part_number || item.item_id} ${item.description}`.trim());
    setMessage(`Selected ${item.part_number || item.item_id}.`);
  }

  function handleSearchSubmit() {
    const value = search.trim();
    if (!value) return;

    const exactMatch = inventory.find((item) => exactItem(item, value));

    if (exactMatch) {
      setSelectedItemId(exactMatch.id);
      setMessage(`Matched ${exactMatch.part_number || exactMatch.item_id}.`);
    } else {
      setSelectedItemId('');
      setMessage('No exact match found. Pick from the results list.');
    }
  }

  function addLine() {
    if (!selectedItem) {
      setMessage('Select an inventory item before adding a line.');
      return;
    }

    const qty = Number(quantity) || 1;

    if (qty <= 0) {
      setMessage('Quantity must be greater than 0.');
      return;
    }

    setRequestLines((prev) => [
      ...prev,
      {
        lineId: `${selectedItem.id}-${Date.now()}`,
        item_id: selectedItem.item_id,
        part_number: selectedItem.part_number ?? '',
        description: selectedItem.description,
        location: selectedItem.location ?? '',
        quantity: qty,
        notes: notes.trim(),
      },
    ]);

    setSelectedItemId('');
    setSearch('');
    setQuantity(1);
    setNotes('');
    setMessage(`Added ${selectedItem.part_number || selectedItem.item_id} to request.`);
  }

  function removeLine(lineId: string) {
    setRequestLines((prev) => prev.filter((line) => line.lineId !== lineId));
  }

  async function submitRequest() {
    if (!requestedBy.trim()) {
      setMessage('Signed-in user email is missing.');
      return;
    }

    if (requestLines.length === 0) {
      setMessage('Add at least one line item before submitting.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('/api/pull-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_number: requestNumber(),
          requested_by: requestedBy.trim(),
          lines: requestLines,
        }),
      });

      const result = (await response.json()) as PullRequestApiResponse;

      if (!response.ok || !result.ok) {
        setMessage(result.message || 'Failed to submit pull request.');
        return;
      }

      setRequestLines([]);
      setSelectedItemId('');
      setSearch('');
      setQuantity(1);
      setNotes('');
      setMessage(result.message || 'Pull request submitted.');
      setActiveTab('requested');
      await loadSavedRequests();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to submit pull request.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function closeRequest(request: SavedPullRequest) {
    if (!canFulfillRequests) {
      setActionMessage('Warehouse or admin access is required to close pull requests.');
      return;
    }

    if (!canCloseRequest(request)) {
      setActionMessage('This pull request is already closed.');
      return;
    }

    const requestLabel = request.request_number || request.id;
    if (
      !window.confirm(
        `Close pull request ${requestLabel}? Any unfulfilled quantities will remain in the history.`
      )
    ) {
      return;
    }

    setClosingRequestId(request.id);
    setActionMessage('');

    try {
      const response = await fetch(`/api/pull-requests/${encodeURIComponent(request.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' }),
      });
      const result = (await response.json()) as ClosePullRequestResponse;

      if (!response.ok || !result.ok) {
        setActionMessage(result.message || 'Pull request could not be closed.');
        return;
      }

      setActionMessage(result.message || 'Pull request closed.');
      await loadSavedRequests();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Pull request could not be closed.');
    } finally {
      setClosingRequestId('');
    }
  }

  async function closeAllRequests() {
    if (!canFulfillRequests) {
      setActionMessage('Warehouse or admin access is required to close pull requests.');
      return;
    }

    if (openRequestCount === 0) {
      setActionMessage('There are no open pull requests to close.');
      return;
    }

    if (
      !window.confirm(
        `Close all ${openRequestCount} open pull request${
          openRequestCount === 1 ? '' : 's'
        }? Any unfulfilled quantities will remain in the history.`
      )
    ) {
      return;
    }

    setIsClosingAll(true);
    setActionMessage('');

    try {
      const response = await fetch('/api/pull-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' }),
      });
      const result = (await response.json()) as ClosePullRequestResponse;

      if (!response.ok || !result.ok) {
        setActionMessage(result.message || 'Pull requests could not be closed.');
        return;
      }

      setActionMessage(result.message || 'Pull requests closed.');
      await loadSavedRequests();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Pull requests could not be closed.');
    } finally {
      setIsClosingAll(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="erp-panel p-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('request')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              activeTab === 'request'
                ? 'bg-cyan-700 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Request Parts
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('requested')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              activeTab === 'requested'
                ? 'bg-cyan-700 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Parts Requested
          </button>
        </div>
      </div>

      {activeTab === 'request' ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="erp-panel p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Request Parts</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Search an item, add quantity, then submit the request.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-md border border-slate-200 bg-white p-4">
              <label className="block text-sm font-medium text-slate-700">Requested By</label>
              <input
                value={requestedBy}
                readOnly
                className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-3 text-base text-slate-700"
              />
              <p className="mt-2 text-xs text-slate-500">
                This comes from the signed-in Supabase user.
              </p>
            </div>

            <div className="sticky top-2 z-20 mt-4 rounded-md border border-cyan-200 bg-cyan-50 p-3 sm:static">
              <label className="block text-sm font-semibold text-cyan-950" htmlFor="pull-request-search">
                Search Item
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="pull-request-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleSearchSubmit();
                    }
                  }}
                  className="w-full rounded-md border border-cyan-300 bg-white px-3 py-3 text-base text-slate-900"
                  placeholder="Search item ID, part number, location, or type to search"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="rounded-md bg-cyan-700 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-800"
                >
                  Find
                </button>
              </div>
              <p className="mt-2 text-xs text-cyan-800">
                Pick an inventory item from the results below.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {searchResults.length === 0 ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 sm:col-span-2">
                  No matching inventory items.
                </div>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item)}
                    className={`rounded-md border p-4 text-left shadow-sm transition ${
                      selectedItemId === item.id
                        ? 'border-cyan-400 bg-cyan-50 ring-1 ring-cyan-200'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {item.part_number || item.item_id}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">{item.description}</div>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                        Qty {item.qty_on_hand ?? 0}
                      </span>
                    </div>
                    <div className="mt-3 text-xs font-semibold uppercase text-slate-500">
                      Location / Bin
                    </div>
                    <div className="mt-1 text-sm text-slate-800">{item.location || '-'}</div>
                  </button>
                ))
              )}
            </div>

            <div className="mt-4 rounded-md border border-slate-200 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Selected Part</label>
                  <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    {selectedItem
                      ? `${selectedItem.part_number || selectedItem.item_id} — ${selectedItem.description}`
                      : 'Pick an item from the results list.'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(event) => setQuantity(Number(event.target.value) || 1)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-base"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-3 text-base"
                    placeholder="Optional: job, urgency, cart, substitution note"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-slate-600">
                  {message || 'Build the request on the right, then submit it.'}
                </p>
                <button
                  type="button"
                  onClick={addLine}
                  className="rounded-md bg-cyan-700 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-800"
                >
                  Add Line
                </button>
              </div>
            </div>
          </section>

          <aside className="erp-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Request Lines</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {requestLines.length} line item{requestLines.length === 1 ? '' : 's'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Requested By: {requestedBy || '-'}
                </p>
              </div>

              <button
                type="button"
                onClick={submitRequest}
                disabled={isSubmitting}
                className="rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {requestLines.length === 0 ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No items added yet.
                </div>
              ) : (
                requestLines.map((line) => (
                  <div key={line.lineId} className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/inventory/${line.item_id}`}
                          className="font-semibold text-cyan-700 hover:underline"
                        >
                          {line.part_number || line.item_id}
                        </Link>
                        <p className="mt-1 text-sm text-slate-600">{line.description}</p>
                      </div>

                      <div className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800">
                        Qty {line.quantity}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-slate-500">
                      Location / Bin: {line.location || '-'}
                    </div>

                    {line.notes ? (
                      <div className="mt-2 text-sm text-slate-700">{line.notes}</div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => removeLine(line.lineId)}
                      className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      ) : (
        <section className="erp-panel p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Parts Requested</h2>
              <p className="mt-1 text-sm text-slate-500">
                Search and filter the requested parts log.
              </p>
              {canFulfillRequests ? (
                <button
                  type="button"
                  onClick={closeAllRequests}
                  disabled={isClosingAll || savedRequestsLoading || openRequestCount === 0}
                  className="mt-3 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isClosingAll ? 'Closing all...' : `Close All Open (${openRequestCount})`}
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={requestSearch}
                onChange={(event) => setRequestSearch(event.target.value)}
                placeholder="Search request #, requester, part, notes"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />

              <select
                value={requestorFilter}
                onChange={(event) => setRequestorFilter(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ALL">All Requestors</option>
                {requestorOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <input
                value={partFilter}
                onChange={(event) => setPartFilter(event.target.value)}
                placeholder="Filter by part / item"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="PARTIAL">Partial</option>
                <option value="FULFILLED">Fulfilled</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>

          {actionMessage ? (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              {actionMessage}
            </div>
          ) : null}

          <div className="mt-4">
            {savedRequestsLoading ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Loading requested parts log...
              </div>
            ) : savedRequestsError ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {savedRequestsError}
              </div>
            ) : filteredSavedRequests.length === 0 ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No pull requests match the current filters.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSavedRequests.map((request) => {
                  const status = normalizedRequestStatus(request);
                  const closeAllowed = canFulfillRequests && canCloseRequest(request);
                  const summary = requestFulfillmentSummary(request);

                  return (
                  <div key={request.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <Link
                          href={`/pull-requests/${request.id}`}
                          className="text-base font-semibold text-cyan-700 hover:underline"
                        >
                          {request.request_number || 'Pull Request'}
                        </Link>
                        <div className="mt-1 text-sm text-slate-600">
                          Requested By: {request.requested_by || '-'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Created: {formatDateTime(request.created_at)}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                        <span className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase ${statusBadgeClass(status)}`}>
                          {status}
                        </span>
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                          {(request.pull_request_lines ?? []).length} line
                          {(request.pull_request_lines ?? []).length === 1 ? '' : 's'}
                        </span>
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                          {summary.fulfilled}/{summary.requested || 0} fulfilled
                        </span>
                        <div className="erp-row-actions w-full lg:w-auto">
                          <Link href={`/pull-requests/${request.id}`} className="erp-action-primary">
                            Open
                          </Link>
                          {canFulfillRequests ? (
                            <>
                              <Link href={`/pull-requests/${request.id}`} className="erp-action-secondary">
                                Fulfill
                              </Link>
                              <button
                                type="button"
                                onClick={() => closeRequest(request)}
                                disabled={!closeAllowed || closingRequestId === request.id}
                                className="erp-action-danger"
                                title={
                                  closeAllowed
                                    ? 'Close this pull request'
                                    : 'This pull request is already closed'
                                }
                              >
                                {closingRequestId === request.id ? 'Closing...' : 'Close'}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Item ID</th>
                            <th className="px-3 py-2">Part Number</th>
                            <th className="px-3 py-2">Description</th>
                            <th className="px-3 py-2">Qty</th>
                            <th className="px-3 py-2">Fulfilled</th>
                            <th className="px-3 py-2">Remaining</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Location</th>
                            <th className="px-3 py-2">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(request.pull_request_lines ?? []).map((line) => {
                            const requested = lineRequestedQty(line);
                            const fulfilled = lineFulfilledQty(line);
                            const remaining = lineRemainingQty(line);
                            const lineStatus =
                              line.fulfillment_status ||
                              (remaining <= 0 && requested > 0
                                ? 'FULFILLED'
                                : fulfilled > 0
                                  ? 'PARTIAL'
                                  : 'OPEN');

                            return (
                              <tr key={line.id} className="border-t border-slate-100">
                                <td className="px-3 py-2">{line.item_id || '-'}</td>
                                <td className="px-3 py-2">{line.part_number || '-'}</td>
                                <td className="px-3 py-2">{line.description || '-'}</td>
                                <td className="px-3 py-2">{requested || '-'}</td>
                                <td className="px-3 py-2">{fulfilled}</td>
                                <td className="px-3 py-2">{remaining}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold uppercase ${statusBadgeClass(lineStatus)}`}>
                                    {lineStatus}
                                  </span>
                                </td>
                                <td className="px-3 py-2">{line.location || '-'}</td>
                                <td className="px-3 py-2">{line.notes || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
