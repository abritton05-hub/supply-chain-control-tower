'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { GlobalSearch } from '@/components/global-search';
import { supabaseBrowser } from '@/lib/supabase/client';

type HeaderProfile = {
  email: string | null;
  full_name: string | null;
  role: string | null;
};

type AlertSeverity = 'critical' | 'warning' | 'info';

type NotificationItem = {
  id: string;
  alert_key?: string;
  title: string;
  description?: string;
  message?: string;
  href: string;
  type?: string;
  severity?: AlertSeverity;
  category?: string;
  is_read: boolean;
  is_dismissed?: boolean;
  read_at?: string | null;
  dismissed_at?: string | null;
  status?: string;
  created_at: string | null;
  detected_at?: string | null;
};

type NotificationsResponse = {
  ok?: boolean;
  alerts?: NotificationItem[];
  notifications?: NotificationItem[];
  unreadCount?: number;
  activeCount?: number;
  alertCount?: number;
  open_pull_requests?: number;
};

const severityStyles: Record<
  AlertSeverity,
  {
    panel: string;
    dot: string;
    label: string;
  }
> = {
  critical: {
    panel: 'border-red-200 bg-red-50',
    dot: 'bg-red-600',
    label: 'text-red-700',
  },
  warning: {
    panel: 'border-amber-200 bg-amber-50',
    dot: 'bg-amber-500',
    label: 'text-amber-700',
  },
  info: {
    panel: 'border-blue-100 bg-slate-50',
    dot: 'bg-blue-500',
    label: 'text-slate-600',
  },
};

function initialsFromName(name: string | null, email: string | null) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';
  }

  if (email?.trim()) {
    return email.trim()[0]?.toUpperCase() ?? 'U';
  }

  return 'U';
}

function roleLabel(role: string | null) {
  if (!role?.trim()) return 'Supply Chain Control Tower';

  const normalized = role.replaceAll('_', ' ').trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '';

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function normalizeSeverity(value: string | undefined): AlertSeverity {
  if (value === 'critical' || value === 'warning' || value === 'info') {
    return value;
  }

  return 'info';
}

function notificationCount(result: NotificationsResponse, alerts: NotificationItem[]) {
  if (typeof result.unreadCount === 'number') {
    return result.unreadCount;
  }

  if (typeof result.activeCount === 'number') {
    return alerts.filter((alert) => !alert.is_read && !alert.is_dismissed).length;
  }

  if (typeof result.open_pull_requests === 'number') {
    return result.open_pull_requests;
  }

  return alerts.filter((alert) => !alert.is_read && !alert.is_dismissed).length;
}

function alertKey(alert: NotificationItem) {
  return alert.alert_key || alert.id;
}

function alertDescription(alert: NotificationItem) {
  return alert.description || alert.message || 'Open alert details.';
}

function alertTime(alert: NotificationItem) {
  return formatDateTime(alert.created_at || alert.detected_at || null);
}

function typeLabel(value: string | undefined) {
  if (!value) return 'Alert';
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function TopHeader() {
  const router = useRouter();
  const [profile, setProfile] = useState<HeaderProfile>({
    email: null,
    full_name: null,
    role: null,
  });
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  async function loadNotifications() {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      const result = (await response.json()) as NotificationsResponse;

      if (response.ok && result?.ok) {
        const activeAlerts = Array.isArray(result.alerts)
          ? result.alerts.filter((alert) => !alert.is_dismissed)
          : Array.isArray(result.notifications)
            ? result.notifications.filter((alert) => !alert.is_dismissed)
            : [];

        setAlerts(activeAlerts.slice(0, 8));
        setAlertCount(notificationCount(result, activeAlerts));
      }
    } catch {
      // Keep the header usable if alerts are unavailable.
    }
  }

  useEffect(() => {
    async function loadHeaderData() {
      try {
        const profileResponse = await fetch('/api/users/me', { cache: 'no-store' });
        const profileResult = await profileResponse.json();

        if (profileResponse.ok && profileResult?.ok && profileResult.profile) {
          setProfile({
            email: profileResult.profile.email ?? null,
            full_name: profileResult.profile.full_name ?? null,
            role: profileResult.profile.role ?? null,
          });
        }

        await loadNotifications();
      } catch {
        // Keep header usable even if these requests fail.
      }
    }

    loadHeaderData();
  }, []);

  useEffect(() => {
    function handleAlertsChanged() {
      void loadNotifications();
    }

    window.addEventListener('alerts:changed', handleAlertsChanged);
    return () => window.removeEventListener('alerts:changed', handleAlertsChanged);
  }, []);

  async function handleLogout() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  async function updateAlertState(alert: NotificationItem, action: 'read' | 'dismiss') {
    const key = alertKey(alert);

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alert.id, alert_key: key, action }),
      });
    } catch {
      // Local state can still reflect the user's intent if persistence is unavailable.
    }

    if (action === 'dismiss') {
      setAlerts((current) => current.filter((item) => alertKey(item) !== key));
      setAlertCount((current) => Math.max(0, current - 1));
      return;
    }

    setAlerts((current) =>
      current.map((item) =>
        alertKey(item) === key ? { ...item, is_read: true, status: 'read' } : item
      )
    );
    setAlertCount((current) => Math.max(0, current - 1));
  }

  async function openAlert(alert: NotificationItem) {
    if (!alert.is_read) {
      await updateAlertState(alert, 'read');
    }

    setIsNotificationOpen(false);
    router.push(alert.href || '/alerts');
    router.refresh();
  }

  async function dismissAlert(alert: NotificationItem) {
    await updateAlertState(alert, 'dismiss');
  }

  async function updateAllAlerts() {
    if (alertCount === 0) return;

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read_all' }),
      });
    } catch {
      // Keep the dropdown responsive even if persistence is temporarily unavailable.
    }

    setAlerts((current) =>
      current.map((alert) => ({ ...alert, is_read: true, status: 'read' }))
    );
    setAlertCount(0);
    await loadNotifications();
    router.refresh();
    window.dispatchEvent(new Event('alerts:changed'));
  }

  async function clearAlerts(action: 'clear_dismissed' | 'clear_resolved') {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
    } catch {
      // Keep the dropdown responsive even if persistence is temporarily unavailable.
    }

    await loadNotifications();
    router.refresh();
    window.dispatchEvent(new Event('alerts:changed'));
  }

  const displayName = useMemo(() => {
    if (profile.full_name?.trim()) return profile.full_name.trim();
    return profile.email ?? 'Loading user...';
  }, [profile.full_name, profile.email]);

  const secondaryLine = useMemo(() => roleLabel(profile.role), [profile.role]);

  return (
    <header className="relative z-40 flex flex-col gap-3 rounded-md border border-slate-200 bg-white px-3 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between sm:px-4">
      <div className="min-w-0 lg:w-64 lg:shrink-0">
        <div className="truncate text-base font-semibold text-slate-900">{displayName}</div>
        <div className="truncate text-sm text-slate-500">{secondaryLine}</div>
      </div>

      <div className="min-w-0 lg:max-w-2xl lg:flex-1">
        <GlobalSearch />
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-end sm:gap-3 lg:shrink-0">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsNotificationOpen((open) => !open)}
            className="relative inline-flex items-center justify-center rounded-full border border-slate-300 bg-white p-2 text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2"
            aria-expanded={isNotificationOpen}
            aria-haspopup="menu"
            aria-label="Open alert center"
            title="Alert Center"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
              <path d="M10 17a2 2 0 0 0 4 0" />
            </svg>

            {alertCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            ) : null}
          </button>

          {isNotificationOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-50 mt-2 w-[calc(100vw-2rem)] max-w-[420px] rounded-md border border-slate-200 bg-white shadow-xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">Alert Center</div>
                  <div className="text-xs text-slate-500">
                    {alertCount} unread alert{alertCount === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={updateAllAlerts}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Mark all read
                  </button>
                  <button
                    type="button"
                    onClick={() => clearAlerts('clear_dismissed')}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Clear dismissed
                  </button>
                  <button
                    type="button"
                    onClick={() => clearAlerts('clear_resolved')}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Clear all resolved
                  </button>
                  <Link
                    href="/alerts"
                    role="menuitem"
                    onClick={() => setIsNotificationOpen(false)}
                    className="text-xs font-semibold text-cyan-700 hover:text-cyan-900"
                  >
                    View all alerts
                  </Link>
                </div>
              </div>

              {alerts.length ? (
                <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
                  {alerts.map((alert) => {
                    const severity = normalizeSeverity(alert.severity);
                    const styles = severityStyles[severity];

                    return (
                      <div
                        key={alertKey(alert)}
                        className={`rounded-md border px-3 py-3 ${styles.panel}`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`}
                          />
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => openAlert(alert)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
                              <span className={styles.label}>{severity}</span>
                              {!alert.is_read ? (
                                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-slate-600">
                                  New
                                </span>
                              ) : null}
                              <span className="truncate text-slate-500">{typeLabel(alert.type)}</span>
                            </div>
                            <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                              {alert.title || 'Alert'}
                            </div>
                            <div className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-slate-600">
                              {alertDescription(alert)}
                            </div>
                            <div className="mt-2 text-[11px] text-slate-500">
                              {alertTime(alert)}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => dismissAlert(alert)}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-8 text-center">
                  <div className="text-sm font-semibold text-slate-900">No active alerts</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Exceptions will appear here when they need attention.
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 sm:flex-none">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
            {initialsFromName(profile.full_name, profile.email)}
          </div>
          <div className="hidden pr-2 sm:block">
            <div className="max-w-[180px] truncate text-sm font-semibold text-slate-900">
              {displayName}
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
