import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import {
  canManageDelivery,
  canSubmitPullRequests,
  canViewInventory,
  type AppRole,
} from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/supabase/admin';

const NOTIFICATIONS_MIGRATION_SQL = `
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text,
  message text not null,
  href text,
  link text,
  type text not null default 'general',
  category text,
  severity text,
  reference_id text,
  entity_type text,
  entity_id text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists title text,
  add column if not exists href text,
  add column if not exists link text,
  add column if not exists category text,
  add column if not exists severity text,
  add column if not exists reference_id text,
  add column if not exists entity_type text,
  add column if not exists entity_id text,
  add column if not exists read_at timestamptz;

create index if not exists notifications_unread_created_at_idx
on public.notifications (is_read, created_at desc);

create index if not exists notifications_type_reference_idx
on public.notifications (type, reference_id);

alter table public.notifications enable row level security;
`;

const ALERT_USER_STATES_MIGRATION_SQL = `
create table if not exists public.alert_user_states (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  user_email text not null,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (alert_key, user_email)
);

create index if not exists alert_user_states_user_email_idx
on public.alert_user_states (user_email);

create index if not exists alert_user_states_alert_key_idx
on public.alert_user_states (alert_key);

create or replace function public.set_alert_user_states_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_alert_user_states_updated_at on public.alert_user_states;

create trigger set_alert_user_states_updated_at
before update on public.alert_user_states
for each row
execute function public.set_alert_user_states_updated_at();

alter table public.alert_user_states enable row level security;

drop policy if exists "alert_user_states_select_own" on public.alert_user_states;
create policy "alert_user_states_select_own"
on public.alert_user_states
for select
to authenticated
using (lower(user_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "alert_user_states_insert_own" on public.alert_user_states;
create policy "alert_user_states_insert_own"
on public.alert_user_states
for insert
to authenticated
with check (lower(user_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "alert_user_states_update_own" on public.alert_user_states;
create policy "alert_user_states_update_own"
on public.alert_user_states
for update
to authenticated
using (lower(user_email) = lower(auth.jwt() ->> 'email'))
with check (lower(user_email) = lower(auth.jwt() ->> 'email'));
`;

type AlertType =
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'OPEN_PULL_REQUEST'
  | 'PARTIAL_PULL_REQUEST'
  | 'OVERDUE_DELIVERY_STOP'
  | 'CRITICAL_STICKY_NOTE';

type AlertSeverity = 'info' | 'warning' | 'critical';

type AlertItem = {
  id: string;
  alert_key: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  message: string;
  href: string;
  created_at: string | null;
  detected_at: string;
  is_read: boolean;
  is_dismissed: boolean;
  read_at: string | null;
  dismissed_at: string | null;
  status: 'active' | 'read' | 'dismissed';
  category: string;
  entity_type: string | null;
  entity_id: string | null;
};

type DataRow = Record<string, unknown>;

type DataError = {
  message: string;
  code?: string;
  details?: string | null;
};

type ReadState = {
  id: string;
  alertKey: string;
  type: string;
  href: string;
  referenceId: string;
  entityId: string;
  isRead: boolean;
  readAt: string | null;
  dismissedAt: string | null;
};

const COMPLETE_DELIVERY_STATUSES = new Set([
  'complete',
  'completed',
  'closed',
  'done',
  'delivered',
  'cancelled',
  'canceled',
]);

const ALERT_SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function readString(row: DataRow, keys: string[]) {
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

function readNumber(row: DataRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return 0;
}

function readBoolean(row: DataRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === 'boolean') {
      return value;
    }
  }

  return false;
}

function stockAlertKey(input: {
  type: 'low-stock' | 'out-of-stock';
  itemKey: string;
  qtyOnHand: number;
  reorderPoint: number;
  sourceVersion: string | null;
}) {
  const version = input.sourceVersion || 'current';
  return `${input.type}:${input.itemKey}:qty:${input.qtyOnHand}:reorder:${input.reorderPoint}:updated:${version}`;
}

function isMissingDataSource(error: DataError | null | undefined) {
  if (!error) return false;

  const message = error.message.toLowerCase();

  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST205' ||
    error.code === 'PGRST204' ||
    message.includes('does not exist') ||
    message.includes('could not find') ||
    message.includes('schema cache')
  );
}

function missingColumnFromError(error: DataError) {
  const message = error.message;
  const quotedColumn = message.match(/'([^']+)' column/i)?.[1];
  if (quotedColumn) return quotedColumn;

  const relationColumn = message.match(/column\s+(?:public\.)?notifications\.([a-zA-Z0-9_]+)\s+does not exist/i)?.[1];
  if (relationColumn) return relationColumn;

  const detailsColumn = error.details?.match(/column\s+"?([a-zA-Z0-9_]+)"?/i)?.[1];
  return detailsColumn || '';
}

function todayInPacific() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function readStateMatches(alert: AlertItem, state: ReadState) {
  if (!state.isRead && !state.dismissedAt) return false;

  if (state.alertKey && state.alertKey === alert.alert_key) {
    return true;
  }

  const normalizedType = state.type.toLowerCase();
  const alertType = alert.type.toLowerCase();
  const compatibleType =
    normalizedType === alertType ||
    (normalizedType === 'pull_request' &&
      (alert.type === 'OPEN_PULL_REQUEST' || alert.type === 'PARTIAL_PULL_REQUEST'));

  if (!compatibleType && normalizedType) return false;

  return (
    Boolean(state.href && state.href === alert.href) ||
    Boolean(state.referenceId && state.referenceId === alert.entity_id) ||
    Boolean(state.entityId && state.entityId === alert.entity_id) ||
    Boolean(state.id && state.id === alert.id)
  );
}

function applyReadState(alert: AlertItem, readStates: ReadState[]) {
  const state = readStates.find((item) => readStateMatches(alert, item));
  const readAt = state?.readAt ?? null;
  const dismissedAt = state?.dismissedAt ?? null;
  const isDismissed = Boolean(dismissedAt);
  const isRead = Boolean(readAt) || isDismissed || Boolean(state?.isRead);

  return {
    ...alert,
    is_read: isRead,
    is_dismissed: isDismissed,
    read_at: readAt,
    dismissed_at: dismissedAt,
    status: isDismissed ? 'dismissed' : isRead ? 'read' : 'active',
  };
}

function makeAlert(
  input: Omit<
    AlertItem,
    | 'alert_key'
    | 'message'
    | 'detected_at'
    | 'category'
    | 'is_read'
    | 'is_dismissed'
    | 'read_at'
    | 'dismissed_at'
    | 'status'
  >,
  detectedAt: string
): AlertItem {
  return {
    ...input,
    alert_key: input.id,
    message: input.description,
    detected_at: detectedAt,
    category: input.type.toLowerCase(),
    is_read: false,
    is_dismissed: false,
    read_at: null,
    dismissed_at: null,
    status: 'active',
  };
}

async function safeSelect(
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>,
  table: string,
  select: string
) {
  const { data, error } = await supabase.from(table).select(select).limit(1000);

  if (error) {
    if (isMissingDataSource(error)) {
      return [] as DataRow[];
    }

    throw error;
  }

  return ((data ?? []) as unknown[]).map((row) => (row ?? {}) as DataRow);
}

async function loadNotificationReadStates(
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>
) {
  const { data, error } = await supabase.from('notifications').select('*').limit(1000);

  if (error) {
    if (isMissingDataSource(error)) {
      return [] as ReadState[];
    }

    throw error;
  }

  return ((data ?? []) as unknown[]).map((row) => {
    const record = (row ?? {}) as DataRow;

    return {
      id: readString(record, ['id', 'notification_id']),
      alertKey: readString(record, ['alert_key']),
      type: readString(record, ['type', 'category', 'notification_type']),
      href: readString(record, ['href', 'link', 'url', 'path']),
      referenceId: readString(record, ['reference_id', 'pull_request_id', 'request_id']),
      entityId: readString(record, ['entity_id', 'pull_request_id', 'request_id', 'reference_id']),
      isRead: readBoolean(record, ['is_read', 'read']) || Boolean(readString(record, ['read_at'])),
      readAt: readString(record, ['read_at']) || null,
      dismissedAt: null,
    };
  });
}

async function loadAlertUserStates(
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>,
  userEmail: string | null
) {
  if (!userEmail) return [] as ReadState[];

  const { data, error } = await supabase
    .from('alert_user_states')
    .select('id,alert_key,user_email,read_at,dismissed_at')
    .eq('user_email', userEmail)
    .limit(1000);

  if (error) {
    if (isMissingDataSource(error)) {
      return [] as ReadState[];
    }

    throw error;
  }

  return ((data ?? []) as unknown[]).map((row) => {
    const record = (row ?? {}) as DataRow;

    return {
      id: readString(record, ['id']),
      alertKey: readString(record, ['alert_key']),
      type: '',
      href: '',
      referenceId: '',
      entityId: '',
      isRead: Boolean(readString(record, ['read_at'])),
      readAt: readString(record, ['read_at']) || null,
      dismissedAt: readString(record, ['dismissed_at']) || null,
    };
  });
}

async function inventoryAlerts(
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>,
  detectedAt: string
) {
  const rows = await safeSelect(
    supabase,
    'inventory',
    'id,item_id,part_number,description,qty_on_hand,reorder_point,location,site,bin_location,created_at,updated_at'
  );

  return rows.flatMap((row) => {
    const id = readString(row, ['id']);
    const itemId = readString(row, ['item_id']);
    const partNumber = readString(row, ['part_number']);
    const description = readString(row, ['description']) || partNumber || itemId || 'Inventory item';
    const qtyOnHand = readNumber(row, ['qty_on_hand']);
    const reorderPoint = readNumber(row, ['reorder_point']);
    const place = [readString(row, ['site', 'location']), readString(row, ['bin_location'])]
      .filter(Boolean)
      .join(' / ');
    const href = itemId ? `/inventory/${encodeURIComponent(itemId)}` : '/inventory';
    const createdAt = readString(row, ['updated_at', 'created_at']) || null;
    const entityId = itemId || id || null;
    const itemKey = id || itemId || partNumber || description;

    if (qtyOnHand <= 0) {
      return [
        makeAlert(
          {
            id: stockAlertKey({
              type: 'out-of-stock',
              itemKey,
              qtyOnHand,
              reorderPoint,
              sourceVersion: createdAt,
            }),
            type: 'OUT_OF_STOCK',
            severity: 'critical',
            title: `Out of stock: ${partNumber || itemId || description}`,
            description: `${description} has ${qtyOnHand} on hand${place ? ` at ${place}` : ''}.`,
            href,
            created_at: createdAt,
            entity_type: 'inventory',
            entity_id: entityId,
          },
          detectedAt
        ),
      ];
    }

    if (qtyOnHand > 0 && qtyOnHand <= reorderPoint) {
      return [
        makeAlert(
          {
            id: stockAlertKey({
              type: 'low-stock',
              itemKey,
              qtyOnHand,
              reorderPoint,
              sourceVersion: createdAt,
            }),
            type: 'LOW_STOCK',
            severity: 'warning',
            title: `Low stock: ${partNumber || itemId || description}`,
            description: `${description} has ${qtyOnHand} on hand with reorder point ${reorderPoint}${place ? ` at ${place}` : ''}.`,
            href,
            created_at: createdAt,
            entity_type: 'inventory',
            entity_id: entityId,
          },
          detectedAt
        ),
      ];
    }

    return [];
  });
}

async function pullRequestAlerts(
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>,
  detectedAt: string
) {
  const rows = await safeSelect(
    supabase,
    'pull_requests',
    'id,request_number,status,requested_by,created_at,fulfilled_at,resolved_at'
  );

  return rows.flatMap((row) => {
    const status = readString(row, ['status']).toUpperCase() || 'OPEN';
    if (status !== 'OPEN' && status !== 'PARTIAL') return [];

    const id = readString(row, ['id']);
    const requestNumber = readString(row, ['request_number']) || id || 'Pull request';
    const requestedBy = readString(row, ['requested_by']) || 'Unknown requester';
    const type: AlertType = status === 'PARTIAL' ? 'PARTIAL_PULL_REQUEST' : 'OPEN_PULL_REQUEST';

    return [
      makeAlert(
        {
          id: `${type.toLowerCase()}:${id || requestNumber}`,
          type,
          severity: status === 'PARTIAL' ? 'warning' : 'info',
          title: `${status === 'PARTIAL' ? 'Partial' : 'Open'} pull request ${requestNumber}`,
          description: `${requestedBy} has a ${status.toLowerCase()} pull request awaiting fulfillment.`,
          href: id ? `/pull-requests/${id}` : '/pull-requests',
          created_at: readString(row, ['created_at']) || null,
          entity_type: 'pull_request',
          entity_id: id || null,
        },
        detectedAt
      ),
    ];
  });
}

function isDeliveryComplete(status: string) {
  return COMPLETE_DELIVERY_STATUSES.has(status.trim().toLowerCase());
}

async function deliveryStopAlerts(
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>,
  detectedAt: string,
  today: string
) {
  const rows = await safeSelect(
    supabase,
    'shipping_manifest_history',
    'id,manifest_number,direction,stop_date,stop_time,status,reference,from_location,to_location,created_at,updated_at'
  );

  return rows.flatMap((row) => {
    const stopDate = readString(row, ['stop_date']);
    const status = readString(row, ['status']);

    if (!stopDate || stopDate >= today || isDeliveryComplete(status)) {
      return [];
    }

    const id = readString(row, ['id']);
    const manifestNumber = readString(row, ['manifest_number']) || 'Unassigned manifest';
    const direction = readString(row, ['direction']) === 'incoming' ? 'pickup' : 'delivery';
    const reference = readString(row, ['reference']) || manifestNumber;
    const fromLocation = readString(row, ['from_location']);
    const toLocation = readString(row, ['to_location']);
    const route = [fromLocation, toLocation].filter(Boolean).join(' to ');

    return [
      makeAlert(
        {
          id: `overdue-delivery-stop:${id || manifestNumber}`,
          type: 'OVERDUE_DELIVERY_STOP',
          severity: 'critical',
          title: `Overdue ${direction} stop ${manifestNumber}`,
          description: `${reference} was scheduled for ${stopDate}${route ? ` (${route})` : ''}.`,
          href: '/delivery?view=history',
          created_at: readString(row, ['updated_at', 'created_at']) || null,
          entity_type: 'shipping_manifest_history',
          entity_id: id || null,
        },
        detectedAt
      ),
    ];
  });
}

function stickyNoteHref(entityType: string, entityId: string) {
  const normalized = entityType.trim().toLowerCase();

  if (normalized === 'inventory' && entityId) {
    return `/inventory/${encodeURIComponent(entityId)}`;
  }

  if ((normalized === 'pull_request' || normalized === 'pull_requests') && entityId) {
    return `/pull-requests/${entityId}`;
  }

  if (
    normalized === 'shipping_manifest_history' ||
    normalized === 'delivery_stop' ||
    normalized === 'manifest'
  ) {
    return '/delivery?view=history';
  }

  return '/dashboard';
}

async function stickyNoteAlerts(
  supabase: Awaited<ReturnType<typeof supabaseAdmin>>,
  detectedAt: string
) {
  const rows = await safeSelect(
    supabase,
    'sticky_notes',
    'id,entity_type,entity_id,note,priority,is_pinned,created_by,created_at,updated_at'
  );

  return rows.flatMap((row) => {
    const priority = readString(row, ['priority']).toLowerCase();
    const isPinned = row.is_pinned !== false;

    if (priority !== 'critical' || !isPinned) {
      return [];
    }

    const id = readString(row, ['id']);
    const entityType = readString(row, ['entity_type']);
    const entityId = readString(row, ['entity_id']);
    const note = readString(row, ['note']) || 'Critical sticky note';

    return [
      makeAlert(
        {
          id: `critical-sticky-note:${id || entityType || 'note'}:${entityId || 'record'}`,
          type: 'CRITICAL_STICKY_NOTE',
          severity: 'critical',
          title: 'Critical sticky note',
          description: note,
          href: stickyNoteHref(entityType, entityId),
          created_at: readString(row, ['updated_at', 'created_at']) || null,
          entity_type: entityType || 'sticky_note',
          entity_id: entityId || id || null,
        },
        detectedAt
      ),
    ];
  });
}

async function loadAlerts(options: {
  role: AppRole;
  userEmail: string | null;
  includeDismissed: boolean;
}) {
  const supabase = await supabaseAdmin();
  const detectedAt = new Date().toISOString();
  const today = todayInPacific();

  const [legacyReadStates, userReadStates, inventory, pullRequests, deliveryStops, stickyNotes] = await Promise.all([
    loadNotificationReadStates(supabase),
    loadAlertUserStates(supabase, options.userEmail),
    canViewInventory(options.role) ? inventoryAlerts(supabase, detectedAt) : Promise.resolve([]),
    canSubmitPullRequests(options.role) ? pullRequestAlerts(supabase, detectedAt) : Promise.resolve([]),
    canManageDelivery(options.role) ? deliveryStopAlerts(supabase, detectedAt, today) : Promise.resolve([]),
    stickyNoteAlerts(supabase, detectedAt),
  ]);
  const readStates = [...legacyReadStates, ...userReadStates];
  const visibleStickyNotes = stickyNotes.filter((alert) => {
    if (alert.entity_type === 'inventory') return canViewInventory(options.role);
    if (alert.entity_type === 'pull_request' || alert.entity_type === 'pull_requests') {
      return canSubmitPullRequests(options.role);
    }
    if (
      alert.entity_type === 'shipping_manifest_history' ||
      alert.entity_type === 'delivery_stop' ||
      alert.entity_type === 'manifest'
    ) {
      return canManageDelivery(options.role);
    }

    return true;
  });

  return [...inventory, ...pullRequests, ...deliveryStops, ...visibleStickyNotes]
    .map((alert) => applyReadState(alert, readStates))
    .filter((alert) => options.includeDismissed || !alert.is_dismissed)
    .sort((a, b) => {
      const severityDelta = ALERT_SEVERITY_RANK[a.severity] - ALERT_SEVERITY_RANK[b.severity];
      if (severityDelta !== 0) return severityDelta;

      const aTime = Date.parse(a.created_at || a.detected_at);
      const bTime = Date.parse(b.created_at || b.detected_at);
      return bTime - aTime;
    });
}

async function saveAlertUserState(input: {
  alertKey: string;
  userEmail: string;
  action: 'read' | 'dismiss';
}) {
  const supabase = await supabaseAdmin();
  const now = new Date().toISOString();
  const payload =
    input.action === 'dismiss'
      ? { read_at: now, dismissed_at: now, updated_at: now }
      : { read_at: now, updated_at: now };

  const { data: existing, error: loadError } = await supabase
    .from('alert_user_states')
    .select('id')
    .eq('alert_key', input.alertKey)
    .eq('user_email', input.userEmail)
    .limit(1)
    .maybeSingle();

  if (loadError) {
    if (isMissingDataSource(loadError)) {
      return { ok: true, supported: false, missingTable: true };
    }

    return { ok: false, supported: false, message: loadError.message };
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('alert_user_states')
      .update(payload)
      .eq('id', existing.id);

    if (!error) {
      return { ok: true, supported: true };
    }

    if (isMissingDataSource(error)) {
      return { ok: true, supported: false, missingTable: true };
    }

    return { ok: false, supported: false, message: error.message };
  }

  const { error } = await supabase.from('alert_user_states').insert({
    alert_key: input.alertKey,
    user_email: input.userEmail,
    ...payload,
  });

  if (!error) {
    return { ok: true, supported: true };
  }

  if (isMissingDataSource(error)) {
    return { ok: true, supported: false, missingTable: true };
  }

  return { ok: false, supported: false, message: error.message };
}

async function clearAlertUserStates(input: {
  role: AppRole;
  userEmail: string | null;
  action: 'clear_dismissed' | 'clear_resolved';
}) {
  if (!input.userEmail) {
    return { ok: true, supported: false, clearedCount: 0 };
  }

  const supabase = await supabaseAdmin();
  const currentAlerts = await loadAlerts({
    role: input.role,
    userEmail: input.userEmail,
    includeDismissed: true,
  });
  const currentAlertKeys = new Set(currentAlerts.map((alert) => alert.alert_key));
  const { data, error } = await supabase
    .from('alert_user_states')
    .select('id,alert_key,dismissed_at')
    .eq('user_email', input.userEmail)
    .limit(5000);

  if (error) {
    if (isMissingDataSource(error)) {
      return { ok: true, supported: false, missingTable: true, clearedCount: 0 };
    }

    return { ok: false, supported: false, message: error.message };
  }

  const rows = ((data ?? []) as unknown[]).map((row) => (row ?? {}) as DataRow);
  const staleRows = rows.filter((row) => {
    const key = readString(row, ['alert_key']);
    const isResolved = Boolean(key) && !currentAlertKeys.has(key);
    const isDismissed = Boolean(readString(row, ['dismissed_at']));

    if (!isResolved) return false;
    if (input.action === 'clear_dismissed') return isDismissed;
    return true;
  });
  const staleIds = staleRows.map((row) => readString(row, ['id'])).filter(Boolean);

  for (let index = 0; index < staleIds.length; index += 100) {
    const chunk = staleIds.slice(index, index + 100);
    const { error: deleteError } = await supabase
      .from('alert_user_states')
      .delete()
      .in('id', chunk);

    if (deleteError) {
      if (isMissingDataSource(deleteError)) {
        return { ok: true, supported: false, missingTable: true, clearedCount: index };
      }

      return { ok: false, supported: false, message: deleteError.message };
    }
  }

  return { ok: true, supported: true, clearedCount: staleIds.length };
}

async function markNotificationRead(notificationId: string) {
  if (!isUuid(notificationId)) {
    return { ok: true, supported: false };
  }

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

    if (isMissingDataSource(error)) {
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

    const body = (await request.json()) as {
      id?: string;
      alert_key?: string;
      alertKey?: string;
      alert_keys?: string[];
      alertKeys?: string[];
      action?:
        | 'read'
        | 'dismiss'
        | 'read_all'
        | 'dismiss_all'
        | 'clear_dismissed'
        | 'clear_resolved';
    };
    const notificationId = body.id?.trim();
    const alertKey = body.alert_key?.trim() || body.alertKey?.trim() || notificationId || '';
    const clearAction =
      body.action === 'clear_dismissed' || body.action === 'clear_resolved'
        ? body.action
        : null;
    const action =
      body.action === 'dismiss' || body.action === 'dismiss_all'
        ? 'dismiss'
        : 'read';
    const isBulkAction = body.action === 'read_all' || body.action === 'dismiss_all';

    if (clearAction) {
      const result = await clearAlertUserStates({
        role: profile.role,
        userEmail: profile.email,
        action: clearAction,
      });

      if (!result.ok) {
        return NextResponse.json(
          {
            ok: false,
            message: 'message' in result ? result.message : 'Failed to clear alerts.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        readSupported: result.supported,
        missingTable: 'missingTable' in result ? Boolean(result.missingTable) : false,
        clearedCount: result.clearedCount,
        migrationSql:
          'missingTable' in result && result.missingTable
            ? ALERT_USER_STATES_MIGRATION_SQL
            : undefined,
      });
    }

    if (!alertKey && !isBulkAction) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Alert id is required.',
        },
        { status: 400 }
      );
    }

    if (isBulkAction) {
      const requestedKeys = Array.isArray(body.alert_keys)
        ? body.alert_keys
        : Array.isArray(body.alertKeys)
          ? body.alertKeys
          : [];
      const alertKeys =
        requestedKeys.length > 0
          ? requestedKeys.map((key) => key.trim()).filter(Boolean)
          : (
              await loadAlerts({
                role: profile.role,
                userEmail: profile.email,
                includeDismissed: false,
              })
            )
              .filter((alert) =>
                action === 'dismiss' ? !alert.is_dismissed : !alert.is_read && !alert.is_dismissed
              )
              .map((alert) => alert.alert_key);

      if (!profile.email) {
        return NextResponse.json({
          ok: true,
          readSupported: false,
          updatedCount: 0,
        });
      }

      const uniqueKeys = Array.from(new Set(alertKeys));
      let missingTable = false;

      for (const key of uniqueKeys) {
        const result = await saveAlertUserState({
          alertKey: key,
          userEmail: profile.email,
          action,
        });

        if (!result.ok) {
          return NextResponse.json(
            {
              ok: false,
              message: 'message' in result ? result.message : 'Failed to update alerts.',
            },
            { status: 500 }
          );
        }

        if ('missingTable' in result && result.missingTable) {
          missingTable = true;
        }
      }

      return NextResponse.json({
        ok: true,
        readSupported: !missingTable,
        missingTable,
        updatedCount: uniqueKeys.length,
        migrationSql: missingTable ? ALERT_USER_STATES_MIGRATION_SQL : undefined,
      });
    }

    const userStateResult = profile.email
      ? await saveAlertUserState({ alertKey, userEmail: profile.email, action })
      : { ok: true, supported: false };
    const legacyResult =
      notificationId && isUuid(notificationId) && action === 'read'
        ? await markNotificationRead(notificationId)
        : { ok: true, supported: false };
    const result = userStateResult.supported ? userStateResult : legacyResult;

    if (!userStateResult.ok || !legacyResult.ok) {
      const failed = !userStateResult.ok ? userStateResult : legacyResult;
      return NextResponse.json(
        {
          ok: false,
          message: 'message' in failed ? failed.message : 'Failed to update notification.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      readSupported: userStateResult.supported || legacyResult.supported,
      missingTable:
        ('missingTable' in userStateResult && Boolean(userStateResult.missingTable)) ||
        ('missingTable' in legacyResult && Boolean(legacyResult.missingTable)),
      migrationSql:
        'missingTable' in userStateResult && userStateResult.missingTable
          ? ALERT_USER_STATES_MIGRATION_SQL
          : 'missingTable' in legacyResult && legacyResult.missingTable
            ? NOTIFICATIONS_MIGRATION_SQL
            : undefined,
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

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const includeDismissed = url.searchParams.get('includeDismissed') === 'true';
    const alerts = await loadAlerts({
      role: profile.role,
      userEmail: profile.email,
      includeDismissed,
    });
    const unreadAlerts = alerts.filter((alert) => !alert.is_read);
    const activeAlerts = alerts.filter((alert) => !alert.is_dismissed);

    return NextResponse.json({
      ok: true,
      alerts,
      notifications: unreadAlerts.filter((alert) => !alert.is_dismissed),
      unreadCount: unreadAlerts.filter((alert) => !alert.is_dismissed).length,
      activeCount: activeAlerts.length,
      alertCount: alerts.length,
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
