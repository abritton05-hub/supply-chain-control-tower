import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { supabaseAdmin } from '@/lib/supabase/admin';

const NOTIFICATIONS_MIGRATION_SQL = `
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  href text,
  link text,
  type text not null default 'general',
  category text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_unread_created_at_idx
on public.notifications (is_read, created_at desc);

create index if not exists notifications_read_at_idx
on public.notifications (read_at);

alter table public.notifications enable row level security;
`;

type NotificationRow = Record<string, unknown>;

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  href: string;
  type: string;
  category: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string | null;
};

type NotificationError = {
  message: string;
  code?: string;
  details?: string | null;
};

function readString(row: NotificationRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return '';
}

function readBoolean(row: NotificationRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === 'boolean') {
      return value;
    }
  }

  return null;
}

function isMissingNotificationsTable(error: NotificationError) {
  const message = error.message.toLowerCase();

  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    (message.includes('relation') && message.includes('notifications')) ||
    (message.includes('table') && message.includes('notifications'))
  );
}

function missingColumnFromError(error: NotificationError) {
  const message = error.message;
  const quotedColumn = message.match(/'([^']+)' column/i)?.[1];
  if (quotedColumn) return quotedColumn;

  const relationColumn = message.match(/column\s+(?:public\.)?notifications\.([a-zA-Z0-9_]+)\s+does not exist/i)?.[1];
  if (relationColumn) return relationColumn;

  const detailsColumn = error.details?.match(/column\s+"?([a-zA-Z0-9_]+)"?/i)?.[1];
  return detailsColumn || '';
}

function normalizeNotification(row: NotificationRow): NotificationItem {
  const id = readString(row, ['id', 'notification_id']);
  const type = readString(row, ['type', 'category', 'notification_type']) || 'notification';
  const category = readString(row, ['category', 'type', 'notification_type']) || type;
  const title = readString(row, ['title', 'subject']) || 'Notification';
  const message = readString(row, ['message', 'body', 'description']) || 'Open notification';
  const pullRequestId = readString(row, ['pull_request_id', 'request_id', 'entity_id']);
  const href =
    readString(row, ['href', 'link', 'url', 'path']) ||
    (pullRequestId ? `/pull-requests/${pullRequestId}` : '/pull-requests');
  const readAt = readString(row, ['read_at']) || null;
  const isReadValue = readBoolean(row, ['is_read', 'read']);
  const isRead = typeof isReadValue === 'boolean' ? isReadValue : Boolean(readAt);
  const createdAt = readString(row, ['created_at', 'createdAt']) || null;

  return {
    id,
    title,
    message,
    href,
    type,
    category,
    is_read: isRead,
    read_at: readAt,
    created_at: createdAt,
  };
}

async function fetchNotificationRows() {
  const supabase = await supabaseAdmin();
  const ordered = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });

  if (!ordered.error) {
    return ordered;
  }

  const missingColumn = missingColumnFromError(ordered.error);
  if (missingColumn === 'created_at') {
    return supabase.from('notifications').select('*');
  }

  return ordered;
}

async function markNotificationRead(notificationId: string) {
  const supabase = await supabaseAdmin();
  const payload: Record<string, unknown> = {
    is_read: true,
    read_at: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (Object.keys(payload).length === 0) {
      return { ok: true, supported: false };
    }

    const { error } = await supabase
      .from('notifications')
      .update(payload)
      .eq('id', notificationId);

    if (!error) {
      return { ok: true, supported: true };
    }

    if (isMissingNotificationsTable(error)) {
      return { ok: true, supported: false, missingTable: true };
    }

    const missingColumn = missingColumnFromError(error);
    if (missingColumn && missingColumn in payload) {
      delete payload[missingColumn];
      continue;
    }

    return {
      ok: false,
      supported: false,
      message: error.message,
    };
  }

  return { ok: true, supported: false };
}

async function handleMarkRead(request: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile.is_active) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Inactive user.',
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { id?: string };
    const notificationId = body.id?.trim();

    if (!notificationId) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Notification id is required.',
        },
        { status: 400 }
      );
    }

    const result = await markNotificationRead(notificationId);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: 'message' in result ? result.message : 'Failed to update notification.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      readSupported: result.supported,
      missingTable: 'missingTable' in result ? Boolean(result.missingTable) : false,
      migrationSql:
        'missingTable' in result && result.missingTable ? NOTIFICATIONS_MIGRATION_SQL : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to update notification.',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile.is_active) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Inactive user.',
        },
        { status: 403 }
      );
    }

    const { data, error } = await fetchNotificationRows();

    if (error) {
      if (isMissingNotificationsTable(error)) {
        return NextResponse.json({
          ok: true,
          notifications: [],
          unreadCount: 0,
          missingTable: true,
          migrationSql: NOTIFICATIONS_MIGRATION_SQL,
        });
      }

      return NextResponse.json(
        {
          ok: false,
          message: error.message,
        },
        { status: 500 }
      );
    }

    const notifications = (data ?? [])
      .map((row) => normalizeNotification((row ?? {}) as NotificationRow))
      .filter((row) => row.id && !row.is_read);

    return NextResponse.json({
      ok: true,
      notifications,
      unreadCount: notifications.length,
      missingTable: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to load notifications.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  return handleMarkRead(request);
}

export async function POST(request: Request) {
  return handleMarkRead(request);
}
