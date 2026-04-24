'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

type HeaderProfile = {
  email: string | null;
  full_name: string | null;
  role: string | null;
};

type NotificationState = {
  open_pull_requests: number;
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

export function TopHeader() {
  const [profile, setProfile] = useState<HeaderProfile>({
    email: null,
    full_name: null,
    role: null,
  });
  const [notifications, setNotifications] = useState<NotificationState>({
    open_pull_requests: 0,
  });

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

        const notificationResponse = await fetch('/api/notifications', { cache: 'no-store' });
        const notificationResult = await notificationResponse.json();

        if (
          notificationResponse.ok &&
          notificationResult?.ok &&
          notificationResult.notifications
        ) {
          setNotifications({
            open_pull_requests:
              Number(notificationResult.notifications.open_pull_requests) || 0,
          });
        }
      } catch {
        // Keep header resilient even if API calls fail.
      }
    }

    loadHeaderData();
  }, []);

  async function handleLogout() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const displayName = useMemo(() => {
    if (profile.full_name?.trim()) return profile.full_name.trim();
    return profile.email ?? 'Loading user...';
  }, [profile.full_name, profile.email]);

  const secondaryLine = useMemo(() => {
    return roleLabel(profile.role);
  }, [profile.role]);

  const badgeCount = notifications.open_pull_requests;

  return (
    <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="truncate text-base font-semibold text-slate-900">
          {displayName}
        </div>
        <div className="truncate text-sm text-slate-500">{secondaryLine}</div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/pull-requests"
          className="relative inline-flex items-center justify-center rounded-full border border-slate-300 bg-white p-2 text-slate-700 transition hover:bg-slate-50"
          aria-label="Open pull request notifications"
          title="Open pull requests"
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

          {badgeCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          ) : null}
        </Link>

        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
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
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </header>
  );
}