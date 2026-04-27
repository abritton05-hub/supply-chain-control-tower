'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export type FulfillmentLineView = {
  id: string;
  itemId: string;
  partNumber: string;
  description: string;
  requestedQty: number;
  fulfilledQty: number;
  remainingQty: number;
  availableQty: number;
  location: string;
  notes: string;
  status: string;
};

type PullRequestFulfillmentClientProps = {
  requestId: string;
  canFulfill: boolean;
  lines: FulfillmentLineView[];
  lineLoadError?: string;
};

type FulfillmentResponse = {
  ok: boolean;
  message?: string;
};

function statusBadgeClass(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes('fulfilled') || normalized.includes('closed')) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (normalized.includes('partial') || normalized.includes('backorder')) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (normalized.includes('cancel') || normalized.includes('reject')) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-cyan-200 bg-cyan-50 text-cyan-700';
}

function displayValue(value: string) {
  return value || '-';
}

function defaultFulfillQuantity(line: FulfillmentLineView) {
  return Math.max(0, Math.min(line.remainingQty, line.availableQty));
}

function lineStatus(line: FulfillmentLineView) {
  if (line.remainingQty <= 0) return 'FULFILLED';
  if (line.fulfilledQty > 0) return line.availableQty > 0 ? 'PARTIAL' : 'PARTIAL / BACKORDERED';
  if (line.availableQty <= 0) return 'OPEN / BACKORDERED';
  if (line.availableQty < line.remainingQty) return 'OPEN / SHORT';
  return line.status || 'OPEN';
}

export function PullRequestFulfillmentClient({
  requestId,
  canFulfill,
  lines,
  lineLoadError,
}: PullRequestFulfillmentClientProps) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((line) => [
        line.id,
        defaultFulfillQuantity(line) > 0 ? String(defaultFulfillQuantity(line)) : '',
      ])
    )
  );
  const [pendingLineId, setPendingLineId] = useState('');
  const [message, setMessage] = useState('');

  const totals = useMemo(() => {
    return lines.reduce(
      (summary, line) => ({
        requested: summary.requested + line.requestedQty,
        fulfilled: summary.fulfilled + line.fulfilledQty,
        remaining: summary.remaining + line.remainingQty,
      }),
      { requested: 0, fulfilled: 0, remaining: 0 }
    );
  }, [lines]);

  function updateQuantity(lineId: string, value: string) {
    setQuantities((prev) => ({ ...prev, [lineId]: value }));
    setMessage('');
  }

  function quantityError(line: FulfillmentLineView) {
    const quantity = Number(quantities[line.id]);

    if (!canFulfill) return 'Warehouse or admin access is required.';
    if (line.remainingQty <= 0) return 'This line is fully fulfilled.';
    if (line.availableQty <= 0) return 'No inventory available.';
    if (!Number.isFinite(quantity) || quantity <= 0) return 'Enter a quantity greater than 0.';
    if (quantity > line.remainingQty) return 'Cannot exceed remaining quantity.';
    if (quantity > line.availableQty) {
      const quantityAvailable = Math.max(0, line.availableQty);
      const quantityRemainingAfterPartial = Math.max(0, line.remainingQty - quantityAvailable);
      return `Only ${quantityAvailable} available. Fulfill ${quantityAvailable} now and leave ${quantityRemainingAfterPartial} remaining.`;
    }

    return '';
  }

  function fulfillLine(line: FulfillmentLineView) {
    const error = quantityError(line);
    const fulfillQuantity = Number(quantities[line.id]);

    if (error) {
      setMessage(error);
      return;
    }

    setPendingLineId(line.id);
    setMessage('');

    void (async () => {
      try {
        const response = await fetch(
          `/api/pull-requests/${encodeURIComponent(requestId)}/lines/${encodeURIComponent(
            line.id
          )}/fulfill`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              request_id: requestId,
              line_id: line.id,
              fulfill_quantity: fulfillQuantity,
            }),
          }
        );

        const result = (await response.json()) as FulfillmentResponse;

        if (!response.ok || !result.ok) {
          setMessage(result.message || 'Fulfillment failed.');
          return;
        }

        setMessage(result.message || 'Line fulfilled.');
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Fulfillment failed.');
      } finally {
        setPendingLineId('');
      }
    })();
  }

  return (
    <div className="erp-panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Line Items</div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
            <span>{lines.length} line{lines.length === 1 ? '' : 's'}</span>
            <span>Requested {totals.requested}</span>
            <span>Fulfilled {totals.fulfilled}</span>
            <span>Remaining {totals.remaining}</span>
          </div>
        </div>

        {!canFulfill ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
            Warehouse or admin access is required to fulfill lines.
          </div>
        ) : null}

        {message ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            {message}
          </div>
        ) : null}
      </div>

      {lineLoadError ? (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {lineLoadError}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Requested</th>
              <th className="px-4 py-3 text-right">Fulfilled</th>
              <th className="px-4 py-3 text-right">Remaining</th>
              <th className="px-4 py-3 text-right">Available</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Qty to fulfill</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-amber-700">
                  This pull request has no line items and cannot be fulfilled.
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const error = quantityError(line);
                const pending = pendingLineId === line.id;
                const anotherLinePending = Boolean(pendingLineId) && !pending;
                const isFulfilled = line.remainingQty <= 0;

                return (
                  <tr key={line.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {displayValue(line.partNumber || line.itemId)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        ID {displayValue(line.itemId)}
                      </div>
                    </td>
                    <td className="min-w-72 px-4 py-3 text-slate-700">
                      <div>{displayValue(line.description)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {displayValue(line.location)}
                      </div>
                      {line.notes ? (
                        <div className="mt-1 max-w-xl text-xs text-slate-500">{line.notes}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {line.requestedQty}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {line.fulfilledQty}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                      {line.remainingQty}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {line.availableQty}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold uppercase ${statusBadgeClass(
                          lineStatus(line)
                        )}`}
                      >
                        {lineStatus(line)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        max={Math.max(0, Math.min(line.remainingQty, line.availableQty))}
                        value={quantities[line.id] ?? ''}
                        onChange={(event) => updateQuantity(line.id, event.target.value)}
                        disabled={
                          !canFulfill || pending || anotherLinePending || line.remainingQty <= 0
                        }
                        aria-label={`Qty to fulfill for ${line.partNumber || line.itemId}`}
                        className="w-28 rounded-md border border-slate-300 px-3 py-2 text-right text-sm tabular-nums disabled:bg-slate-100 disabled:text-slate-400"
                      />
                      {error && canFulfill ? (
                        <div className="mt-1 w-40 text-xs text-slate-500">{error}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => fulfillLine(line)}
                        disabled={Boolean(error) || pending || anotherLinePending}
                        className="whitespace-nowrap rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {isFulfilled ? 'Fulfilled' : pending ? 'Fulfilling...' : 'Fulfill Line'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
