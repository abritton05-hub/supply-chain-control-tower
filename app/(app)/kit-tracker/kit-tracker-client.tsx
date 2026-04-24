'use client';

import { useMemo, useState } from 'react';
import type { KitRecord } from './types';

type Props = {
  kits: KitRecord[];
};

export function KitTrackerClient({ kits }: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');

  const filtered = useMemo(() => {
    return kits.filter((kit) => {
      const text = `${kit.kit_number || ''} ${kit.kit_name || ''} ${kit.project_name || ''} ${kit.location || ''} ${kit.block_reason || ''} ${kit.notes || ''}`.toLowerCase();
      const searchMatch = !query.trim() || text.includes(query.trim().toLowerCase());
      const statusMatch = status === 'ALL' || (kit.status || '').toUpperCase() === status;
      return searchMatch && statusMatch;
    });
  }, [kits, query, status]);

  return (
    <div className="space-y-4">
      <div className="erp-panel p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search kit #, name, project, location, notes"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="BLOCKED">Blocked</option>
            <option value="READY">Ready</option>
            <option value="DELIVERY REQUESTED">Delivery Requested</option>
            <option value="DELIVERY SCHEDULED">Delivery Scheduled</option>
            <option value="DELIVERED">Delivered</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="erp-panel p-5 text-sm text-slate-600">
          No kits match the current filters.
        </div>
      ) : (
        <div className="erp-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kit #</th>
                  <th className="px-4 py-3">Kit Name</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Block Reason</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((kit) => (
                  <tr key={kit.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3 text-slate-800">{kit.kit_number || '-'}</td>
                    <td className="px-4 py-3 text-slate-800">{kit.kit_name || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{kit.project_name || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{kit.location || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{kit.status || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{kit.block_reason || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{kit.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}