'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

type HeaderProfile = {
  email: string | null;
  full_name: string | null;
  role: string | null;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  href: string;
  type?: string;
  category?: string;
  is_read: boolean;
  read_at?: string | null;
  created_at: string | null;
};

type NotificationsResponse = {
  ok?: boolean;
  notifications?: NotificationItem[];
  unreadCount?: number;
  open_pull_requests?: number;
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

function formatDateTime(value: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

function notificationCount(result: NotificationsResponse, notifications: NotificationItem[]) {
  if (typeof result.unreadCount === 'number') {
    return result.unreadCount;
  }

  if (typeof result.open_pull_requests === 'number') {
    return result.open_pull_requests;
  }

  return notifications.length;
}

export function TopHeader() {
  const router = useRouter();
  const [profile, setProfile] = useState<HeaderProfile>({
    email: null,
    full_name: null,
    role: null,
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  async function loadNotifications() {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      const result = (await response.json()) as NotificationsResponse;

      if (response.ok && result?.ok) {
        const unreadNotifications = Array.isArray(result.notifications)
          ? result.notifications
          : [];

        setNotifications(unreadNotifications);
        setUnreadCount(notificationCount(result, unreadNotifications));
      }
    } catch {
      // Keep the header usable if notifications are unavailable.
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

  async function handleLogout() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  async function openNotification(notification: NotificationItem) {
    try {
      if (!notification.is_read) {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: notification.id }),
        });
      }
    } catch {
      // Navigation should still happen even if marking read fails.
    }

    setNotifications((current) => current.filter((item) => item.id !== notification.id));
    setUnreadCount((current) => Math.max(0, current - 1));
    setIsNotificationOpen(false);
    router.push(notification.href || '/pull-requests');
    router.refresh();
  }

  const displayName = useMemo(() => {
    if (profile.full_name?.trim()) return profile.full_name.trim();
    return profile.email ?? 'Loading user...';
  }, [profile.full_name, profile.email]);

  const secondaryLine = useMemo(() => roleLabel(profile.role), [profile.role]);

  return (
    <header className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="min-w-0">
        <div className="truncate text-base font-semibold text-slate-900">{displayName}</div>
        <div className="truncate text-sm text-slate-500">{secondaryLine}</div>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-end sm:gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsNotificationOpen((open) => !open)}
            className="relative inline-flex items-center justify-center rounded-full border border-slate-300 bg-white p-2 text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2"
            aria-expanded={isNotificationOpen}
            aria-haspopup="menu"
            aria-label="Open notifications"
            title="Notifications"
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

            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </button>

          {isNotificationOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-50 mt-2 w-[calc(100vw-2rem)] max-w-[320px] rounded-md border border-slate-200 bg-white p-3 shadow-xl"
            >
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Open Pull Requests</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {unreadCount} open or unread
                    </div>
                  </div>
                  <div className="flex h-10 min-w-10 items-center justify-center rounded-full bg-slate-900 px-3 text-sm font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </div>
                </div>

                <Link
                  href="/pull-requests"
                  role="menuitem"
                  onClick={() => setIsNotificationOpen(false)}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-cyan-700 px-3 py-2 text-sm font-bold text-white hover:bg-cyan-800"
                >
                  View Pull Requests
                </Link>
              </div>

              {notifications.length ? (
                <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      role="menuitem"
                      onClick={() => openNotification(notification)}
                      className="block min-h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-left hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">
                          {notification.title || 'Notification'}
                        </div>
                        <div className="shrink-0 text-[11px] text-slate-400">
                          {formatDateTime(notification.created_at)}
                        </div>
                      </div>
                      <div className="mt-1 text-sm text-slate-700">
                        {notification.message || 'Open notification'}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
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
