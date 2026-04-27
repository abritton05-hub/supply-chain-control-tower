'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type AlertSeverity = 'critical' | 'warning' | 'info';
type AlertStatus = 'active' | 'read' | 'dismissed';

type AlertItem = {
  id: string;
  alert_key?: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  description?: string;
  message?: string;
  href: string;
  created_at: string | null;
  detected_at?: string | null;
  is_read: boolean;
  is_dismissed?: boolean;
  read_at?: string | null;
  dismissed_at?: string | null;
  status?: AlertStatus;
  entity_type?: string | null;
  entity_id?: string | null;
};

type NotificationsResponse = {
  ok?: boolean;
  alerts?: AlertItem[];
  notifications?: AlertItem[];
  unreadCount?: number;
  activeCount?: number;
  message?: string;
};

const severityStyles: Record<AlertSeverity, string> = {
  critical: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  info: 'border-blue-100 bg-blue-50 text-blue-700',
};

const statusStyles: Record<AlertStatus, string> = {
  active: 'border-slate-200 bg-white text-slate-700',
  read: 'border-slate-200 bg-slate-50 text-slate-500',
  dismissed: 'border-slate-200 bg-slate-100 text-slate-500',
};

function normalizeSeverity(value: string | undefined): AlertSeverity {
  if (value === 'critical' || value === 'warning' || value === 'info') return value;
  return 'info';
}

function alertKey(alert: AlertItem) {
  return alert.alert_key || alert.id;
}

function alertStatus(alert: AlertItem): AlertStatus {
  if (alert.is_dismissed || alert.status === 'dismissed') return 'dismissed';
  if (alert.is_read || alert.status === 'read') return 'read';
  return 'active';
}

function description(alert: AlertItem) {
  return alert.description || alert.message || '';
}

function typeLabel(value: string) {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function searchableText(alert: AlertItem) {
  return [
    alert.title,
    description(alert),
    alert.type,
    alert.href,
    alert.entity_type,
    alert.entity_id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function AlertsClient() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | AlertSeverity>('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AlertStatus>('active');
  const [search, setSearch] = useState('');

  async function loadAlerts() {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/notifications?includeDismissed=true', {
        cache: 'no-store',
      });
      const result = (await response.json()) as NotificationsResponse;

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Failed to load alerts.');
      }

      const nextAlerts = Array.isArray(result.alerts)
        ? result.alerts
        : Array.isArray(result.notifications)
          ? result.notifications
          : [];

      setAlerts(nextAlerts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load alerts.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    function handleAlertsChanged() {
      void loadAlerts();
    }

    loadAlerts();
    window.addEventListener('alerts:changed', handleAlertsChanged);
    return () => window.removeEventListener('alerts:changed', handleAlertsChanged);
  }, []);

  async function updateAlert(alert: AlertItem, action: 'read' | 'dismiss') {
    const key = alertKey(alert);
    const now = new Date().toISOString();

    setAlerts((current) =>
      current.map((item) => {
        if (alertKey(item) !== key) return item;

        if (action === 'dismiss') {
          return {
            ...item,
            is_read: true,
            is_dismissed: true,
            read_at: item.read_at || now,
            dismissed_at: now,
            status: 'dismissed',
          };
        }

        return {
          ...item,
          is_read: true,
          read_at: item.read_at || now,
          status: 'read',
        };
      })
    );

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alert.id, alert_key: key, action }),
      });
    } catch {
      // The API gracefully handles missing persistence tables; keep the UI responsive.
    } finally {
      window.dispatchEvent(new Event('alerts:changed'));
    }
  }

  async function updateAllAlerts() {
    const now = new Date().toISOString();
    const targetKeys = alerts
      .filter((alert) => !alert.is_read && alertStatus(alert) !== 'dismissed')
      .map(alertKey);

    if (targetKeys.length === 0) return;

    setAlerts((current) =>
      current.map((item) => {
        if (!targetKeys.includes(alertKey(item))) return item;

        return {
          ...item,
          is_read: true,
          read_at: item.read_at || now,
          status: 'read',
        };
      })
    );

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'read_all',
          alert_keys: targetKeys,
        }),
      });
    } catch {
      // The API gracefully handles missing persistence tables; keep the UI responsive.
    } finally {
      window.dispatchEvent(new Event('alerts:changed'));
    }
  }

  async function clearAlerts(action: 'clear_dismissed' | 'clear_resolved') {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
    } catch {
      // The API gracefully handles missing persistence tables; keep the UI responsive.
    } finally {
      window.dispatchEvent(new Event('alerts:changed'));
    }
  }

  const typeOptions = useMemo(
    () => Array.from(new Set(alerts.map((alert) => alert.type).filter(Boolean))).sort(),
    [alerts]
  );

  const filteredAlerts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return alerts.filter((alert) => {
      const severity = normalizeSeverity(alert.severity);
      const status = alertStatus(alert);

      if (severityFilter !== 'ALL' && severity !== severityFilter) return false;
      if (typeFilter !== 'ALL' && alert.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && status !== statusFilter) return false;
      if (query && !searchableText(alert).includes(query)) return false;

      return true;
    });
  }, [alerts, search, severityFilter, statusFilter, typeFilter]);

  const activeCount = alerts.filter((alert) => alertStatus(alert) !== 'dismissed').length;
  const unreadCount = alerts.filter((alert) => !alert.is_read && alertStatus(alert) !== 'dismissed').length;
  const dismissedCount = alerts.filter((alert) => alertStatus(alert) === 'dismissed').length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="erp-panel p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{activeCount}</div>
        </div>
        <div className="erp-panel p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unread</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{unreadCount}</div>
        </div>
        <div className="erp-panel p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dismissed
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{dismissedCount}</div>
        </div>
      </div>

      <section className="erp-panel p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_220px_160px_auto] lg:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Item, PR number, manifest, note text"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Severity
            </span>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as 'ALL' | AlertSeverity)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="ALL">All</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Type
            </span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="ALL">All</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'ALL' | AlertStatus)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="ALL">All</option>
              <option value="active">Active</option>
              <option value="read">Read</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </label>

          <button type="button" onClick={loadAlerts} className="erp-button">
            Refresh
          </button>
        </div>
      </section>

      <section className="erp-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Alert Queue</h2>
            <p className="mt-1 text-xs text-slate-500">
              Showing {filteredAlerts.length} of {alerts.length} computed alert
              {alerts.length === 1 ? '' : 's'}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={updateAllAlerts}
              className="erp-button-secondary text-xs"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={() => clearAlerts('clear_dismissed')}
              className="erp-button-secondary text-xs"
            >
              Clear dismissed
            </button>
            <button
              type="button"
              onClick={() => clearAlerts('clear_resolved')}
              className="erp-button-secondary text-xs"
            >
              Clear all resolved
            </button>
          </div>
        </div>

        {error ? (
          <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Alert</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Detected</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Loading alerts...
                  </td>
                </tr>
              ) : filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No alerts match the current filters.
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => {
                  const severity = normalizeSeverity(alert.severity);
                  const status = alertStatus(alert);

                  return (
                    <tr key={alertKey(alert)} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold capitalize ${severityStyles[severity]}`}
                        >
                          {severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{typeLabel(alert.type)}</td>
                      <td className="max-w-[420px] px-4 py-3">
                        <Link
                          href={alert.href || '/alerts'}
                          onClick={() => {
                            if (!alert.is_read && status !== 'dismissed') {
                              updateAlert(alert, 'read');
                            }
                          }}
                          className="font-semibold text-cyan-700 hover:underline"
                        >
                          {alert.title}
                        </Link>
                        <div className="mt-1 text-xs leading-5 text-slate-600">{description(alert)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold capitalize ${statusStyles[status]}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateTime(alert.created_at || alert.detected_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={alert.href || '/alerts'}
                            onClick={() => {
                              if (!alert.is_read && status !== 'dismissed') {
                                updateAlert(alert, 'read');
                              }
                            }}
                            className="erp-button-secondary text-xs"
                          >
                            Open
                          </Link>
                          {!alert.is_read && status !== 'dismissed' ? (
                            <button
                              type="button"
                              onClick={() => updateAlert(alert, 'read')}
                              className="erp-button-secondary text-xs"
                            >
                              Mark read
                            </button>
                          ) : null}
                          {status !== 'dismissed' ? (
                            <button
                              type="button"
                              onClick={() => updateAlert(alert, 'dismiss')}
                              className="erp-button-secondary text-xs"
                            >
                              Dismiss
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-3 lg:hidden">
          {isLoading ? (
            <div className="py-6 text-center text-sm text-slate-500">Loading alerts...</div>
          ) : filteredAlerts.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No alerts match the current filters.
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const severity = normalizeSeverity(alert.severity);
              const status = alertStatus(alert);

              return (
                <article key={alertKey(alert)} className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold capitalize ${severityStyles[severity]}`}
                    >
                      {severity}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold capitalize ${statusStyles[status]}`}
                    >
                      {status}
                    </span>
                    <span className="text-xs text-slate-500">{typeLabel(alert.type)}</span>
                  </div>
                  <Link
                    href={alert.href || '/alerts'}
                    onClick={() => {
                      if (!alert.is_read && status !== 'dismissed') {
                        updateAlert(alert, 'read');
                      }
                    }}
                    className="mt-3 block font-semibold text-cyan-700 hover:underline"
                  >
                    {alert.title}
                  </Link>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description(alert)}</p>
                  <div className="mt-2 text-xs text-slate-500">
                    {formatDateTime(alert.created_at || alert.detected_at)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={alert.href || '/alerts'}
                      onClick={() => {
                        if (!alert.is_read && status !== 'dismissed') {
                          updateAlert(alert, 'read');
                        }
                      }}
                      className="erp-button-secondary text-xs"
                    >
                      Open
                    </Link>
                    {!alert.is_read && status !== 'dismissed' ? (
                      <button
                        type="button"
                        onClick={() => updateAlert(alert, 'read')}
                        className="erp-button-secondary text-xs"
                      >
                        Mark read
                      </button>
                    ) : null}
                    {status !== 'dismissed' ? (
                      <button
                        type="button"
                        onClick={() => updateAlert(alert, 'dismiss')}
                        className="erp-button-secondary text-xs"
                      >
                        Dismiss
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
