'use client';

import { useEffect, useMemo, useState } from 'react';

type AlertSeverity = 'critical' | 'warning' | 'info';
type AlertStatus = 'active' | 'read' | 'dismissed';

type RelatedAlert = {
  id: string;
  alert_key?: string;
  type: string;
  severity?: AlertSeverity;
  title: string;
  description?: string;
  message?: string;
  href?: string;
  is_read?: boolean;
  is_dismissed?: boolean;
  status?: AlertStatus;
  entity_type?: string | null;
  entity_id?: string | null;
};

type NotificationsResponse = {
  ok?: boolean;
  alerts?: RelatedAlert[];
  notifications?: RelatedAlert[];
  message?: string;
};

type RelatedAlertsProps = {
  title?: string;
  matchValues: string[];
  matchTypes?: string[];
};

const severityStyles: Record<AlertSeverity, string> = {
  critical: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-blue-100 bg-blue-50 text-slate-700',
};

function alertKey(alert: RelatedAlert) {
  return alert.alert_key || alert.id;
}

function alertDescription(alert: RelatedAlert) {
  return alert.description || alert.message || '';
}

function normalizeSeverity(value: AlertSeverity | undefined): AlertSeverity {
  if (value === 'critical' || value === 'warning' || value === 'info') return value;
  return 'info';
}

function alertStatus(alert: RelatedAlert): AlertStatus {
  if (alert.is_dismissed || alert.status === 'dismissed') return 'dismissed';
  if (alert.is_read || alert.status === 'read') return 'read';
  return 'active';
}

function searchableAlertText(alert: RelatedAlert) {
  return [
    alert.id,
    alert.alert_key,
    alert.type,
    alert.title,
    alertDescription(alert),
    alert.href,
    alert.entity_type,
    alert.entity_id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function RelatedAlerts({
  title = 'Related Alerts',
  matchValues,
  matchTypes = [],
}: RelatedAlertsProps) {
  const [alerts, setAlerts] = useState<RelatedAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  const normalizedMatchValues = useMemo(
    () => matchValues.map((value) => value.trim().toLowerCase()).filter(Boolean),
    [matchValues]
  );
  const normalizedMatchTypes = useMemo(
    () => matchTypes.map((value) => value.trim().toUpperCase()).filter(Boolean),
    [matchTypes]
  );

  const relatedAlerts = useMemo(() => {
    if (normalizedMatchValues.length === 0) return [];

    return alerts.filter((alert) => {
      if (alertStatus(alert) === 'dismissed') return false;
      if (
        normalizedMatchTypes.length > 0 &&
        !normalizedMatchTypes.includes(alert.type.toUpperCase())
      ) {
        return false;
      }

      const haystack = searchableAlertText(alert);
      return normalizedMatchValues.some((value) => haystack.includes(value));
    });
  }, [alerts, normalizedMatchTypes, normalizedMatchValues]);

  async function loadAlerts() {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      const result = (await response.json()) as NotificationsResponse;

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Failed to load related alerts.');
      }

      setAlerts(
        Array.isArray(result.alerts)
          ? result.alerts
          : Array.isArray(result.notifications)
            ? result.notifications
            : []
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load related alerts.');
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

  async function updateAlert(alert: RelatedAlert, action: 'read' | 'dismiss') {
    const key = alertKey(alert);

    if (action === 'dismiss') {
      setAlerts((current) => current.filter((item) => alertKey(item) !== key));
    } else {
      setAlerts((current) =>
        current.map((item) =>
          alertKey(item) === key ? { ...item, is_read: true, status: 'read' } : item
        )
      );
    }

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alert.id, alert_key: key, action }),
      });
    } catch {
      // Keep the record page responsive even if alert state persistence is unavailable.
    } finally {
      window.dispatchEvent(new Event('alerts:changed'));
    }
  }

  if (!isLoading && relatedAlerts.length === 0 && !message) {
    return null;
  }

  return (
    <section className="erp-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-xs text-slate-500">
          {isLoading
            ? 'Checking current alert state...'
            : `${relatedAlerts.length} active related alert${relatedAlerts.length === 1 ? '' : 's'}`}
        </div>
      </div>

      {message ? (
        <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      ) : null}

      <div className="divide-y divide-slate-100">
        {relatedAlerts.map((alert) => {
          const severity = normalizeSeverity(alert.severity);
          const status = alertStatus(alert);

          return (
            <div
              key={alertKey(alert)}
              className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between ${severityStyles[severity]}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-current/20 bg-white/70 px-2 py-0.5 text-[11px] font-bold uppercase">
                    {severity}
                  </span>
                  {status === 'read' ? (
                    <span className="text-[11px] font-semibold uppercase text-slate-500">Read</span>
                  ) : null}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-950">{alert.title}</div>
                <p className="mt-1 text-sm leading-5 text-slate-700">{alertDescription(alert)}</p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {status !== 'read' ? (
                  <button
                    type="button"
                    onClick={() => updateAlert(alert, 'read')}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Mark read
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => updateAlert(alert, 'dismiss')}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
