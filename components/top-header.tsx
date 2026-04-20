'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Notification = {
  id: string;
  message: string;
  reference_id: string;
};

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function TopHeader() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // 🔥 LOAD NOTIFICATIONS
  async function loadNotifications() {
    try {
      const res = await fetch('/api/pull-requests');
      const data = await res.json();

      if (!data.ok) return;

      // ONLY OPEN REQUESTS = ACTIVE ALERTS
      const active = (data.requests || []).filter(
        (r: any) => (r.status || 'OPEN').toUpperCase() === 'OPEN'
      );

      setNotifications(
        active.map((r: any) => ({
          id: r.id,
          message: `Pull Request ${r.request_number}`,
          reference_id: r.id,
        }))
      );
    } catch {
      setNotifications([]);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  // CLOSE DROPDOWN ON OUTSIDE CLICK
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="rounded-3xl border bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between">

        {/* RIGHT SIDE */}
        <div className="ml-auto flex items-center gap-3" ref={ref}>

          {/* 🔔 NOTIFICATION BELL */}
          <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              className="relative h-12 w-12 rounded-full border bg-white flex items-center justify-center"
            >
              <BellIcon />

              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 rounded-full bg-red-600 px-2 text-xs text-white">
                  {notifications.length}
                </span>
              )}
            </button>

            {/* 🔽 DROPDOWN */}
            {open && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border bg-white shadow-lg z-50">
                <div className="p-3 border-b font-semibold">
                  Notifications
                </div>

                {notifications.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">
                    No active alerts
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setOpen(false);
                        router.push(`/pull-requests/${n.reference_id}`);
                      }}
                      className="w-full text-left p-3 hover:bg-gray-100 border-b"
                    >
                      {n.message}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 👤 USER */}
          <button
            onClick={() => router.push('/users')}
            className="h-12 w-12 rounded-full border flex items-center justify-center"
          >
            <UserIcon />
          </button>
        </div>
      </div>
    </header>
  );
}