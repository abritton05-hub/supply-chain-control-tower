import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { supabaseServer } from '@/lib/supabase/server';
import { logTransaction, type TransactionType } from '@/lib/transactions/log-transaction';

export const runtime = 'nodejs';

type StickyNotePriority = 'info' | 'warning' | 'critical';

type StickyNoteInput = {
  id?: unknown;
  entity_type?: unknown;
  entityType?: unknown;
  entity_id?: unknown;
  entityId?: unknown;
  note?: unknown;
  priority?: unknown;
  is_pinned?: unknown;
  isPinned?: unknown;
};

type StickyNoteRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  note: string;
  priority: StickyNotePriority;
  is_pinned: boolean;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const SELECT_COLUMNS =
  'id,entity_type,entity_id,note,priority,is_pinned,created_by,created_at,updated_at';

const PRIORITY_RANK: Record<StickyNotePriority, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePriority(value: unknown): StickyNotePriority {
  const priority = clean(value).toLowerCase();

  if (priority === 'warning' || priority === 'critical') {
    return priority;
  }

  return 'info';
}

function readPinned(value: unknown, fallback = true) {
  return typeof value === 'boolean' ? value : fallback;
}

function sortNotes(notes: StickyNoteRow[]) {
  return [...notes].sort((a, b) => {
    const priorityDelta = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (priorityDelta !== 0) return priorityDelta;

    const aTime = Date.parse(a.updated_at || a.created_at || '');
    const bTime = Date.parse(b.updated_at || b.created_at || '');
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
}

async function requireActiveProfile() {
  const profile = await getCurrentUserProfile();

  if (!profile.is_active) {
    return {
      profile,
      response: NextResponse.json({ ok: false, message: 'Inactive user.' }, { status: 403 }),
    };
  }

  return { profile, response: null };
}

function createdBy(profile: Awaited<ReturnType<typeof getCurrentUserProfile>>) {
  return profile.full_name || profile.email || 'unknown';
}

function isMissingStickyNotesTable(error: { code?: string; message: string }) {
  const message = error.message.toLowerCase();

  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    (message.includes('sticky_notes') &&
      (message.includes('could not find') ||
        message.includes('does not exist') ||
        message.includes('schema cache') ||
        message.includes('relation')))
  );
}

function databaseErrorResponse(error: { code?: string; message: string }, fallback: string) {
  if (isMissingStickyNotesTable(error)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          'Sticky notes table is not installed. Run docs/supabase-sticky-notes.sql in Supabase.',
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      message: error.message || fallback,
    },
    { status: 500 }
  );
}

function stickyNoteReference(note: StickyNoteRow) {
  return `${note.entity_type}:${note.entity_id}:${note.priority}`;
}

function stickyNoteTitle(actionType: TransactionType, note: StickyNoteRow) {
  const action = actionType
    .replace('STICKY_NOTE_', '')
    .replace(/_/g, ' ')
    .toLowerCase();

  return `Sticky note ${action} for ${note.entity_type} ${note.entity_id}`;
}

async function logStickyNoteTransaction(
  actionType:
    | 'STICKY_NOTE_CREATED'
    | 'STICKY_NOTE_UPDATED'
    | 'STICKY_NOTE_DELETED',
  note: StickyNoteRow,
  userName: string
) {
  const logResult = await logTransaction({
    transaction_type: actionType,
    description: stickyNoteTitle(actionType, note),
    reference: stickyNoteReference(note),
    notes: note.note,
    performed_by: userName,
    entity_type: note.entity_type,
    entity_id: note.entity_id,
    title: stickyNoteTitle(actionType, note),
    details: {
      sticky_note_id: note.id,
      entity_type: note.entity_type,
      entity_id: note.entity_id,
      priority: note.priority,
      is_pinned: note.is_pinned,
    },
    write_inventory_transaction: true,
    write_activity_log: true,
  });

  if (logResult.ok === false) {
    console.error('Sticky note transaction logging failed.', {
      actionType,
      stickyNoteId: note.id,
      entityType: note.entity_type,
      entityId: note.entity_id,
      priority: note.priority,
      message: logResult.message,
    });
  }
}

export async function GET(request: Request) {
  try {
    const { response } = await requireActiveProfile();
    if (response) return response;

    const url = new URL(request.url);
    const entityType = clean(url.searchParams.get('entity_type') || url.searchParams.get('entityType'));
    const entityId = clean(url.searchParams.get('entity_id') || url.searchParams.get('entityId'));

    if (!entityType || !entityId) {
      return NextResponse.json(
        { ok: false, message: 'entity_type and entity_id are required.' },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from('sticky_notes')
      .select(SELECT_COLUMNS)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      return databaseErrorResponse(error, 'Failed to load sticky notes.');
    }

    return NextResponse.json({
      ok: true,
      notes: sortNotes((data ?? []) as StickyNoteRow[]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to load sticky notes.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile, response } = await requireActiveProfile();
    if (response) return response;

    const body = (await request.json()) as StickyNoteInput;
    const entityType = clean(body.entity_type || body.entityType);
    const entityId = clean(body.entity_id || body.entityId);
    const note = clean(body.note);
    const priority = normalizePriority(body.priority);
    const isPinned = readPinned(body.is_pinned ?? body.isPinned);

    if (!entityType || !entityId || !note) {
      return NextResponse.json(
        { ok: false, message: 'entity_type, entity_id, and note are required.' },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from('sticky_notes')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        note,
        priority,
        is_pinned: isPinned,
        created_by: createdBy(profile),
      })
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      return databaseErrorResponse(error, 'Failed to create sticky note.');
    }

    await logStickyNoteTransaction('STICKY_NOTE_CREATED', data as StickyNoteRow, createdBy(profile));

    return NextResponse.json({ ok: true, note: data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to create sticky note.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { profile, response } = await requireActiveProfile();
    if (response) return response;

    const body = (await request.json()) as StickyNoteInput;
    const id = clean(body.id);
    const note = clean(body.note);
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (!id) {
      return NextResponse.json({ ok: false, message: 'Sticky note id is required.' }, { status: 400 });
    }

    if ('note' in body) {
      if (!note) {
        return NextResponse.json({ ok: false, message: 'Note is required.' }, { status: 400 });
      }

      payload.note = note;
    }

    if ('priority' in body) {
      payload.priority = normalizePriority(body.priority);
    }

    if ('is_pinned' in body || 'isPinned' in body) {
      payload.is_pinned = readPinned(body.is_pinned ?? body.isPinned);
    }

    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from('sticky_notes')
      .update(payload)
      .eq('id', id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      return databaseErrorResponse(error, 'Failed to update sticky note.');
    }

    await logStickyNoteTransaction('STICKY_NOTE_UPDATED', data as StickyNoteRow, createdBy(profile));

    return NextResponse.json({ ok: true, note: data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to update sticky note.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { profile, response } = await requireActiveProfile();
    if (response) return response;

    const body = (await request.json()) as StickyNoteInput;
    const id = clean(body.id);

    if (!id) {
      return NextResponse.json({ ok: false, message: 'Sticky note id is required.' }, { status: 400 });
    }

    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from('sticky_notes')
      .delete()
      .eq('id', id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      return databaseErrorResponse(error, 'Failed to delete sticky note.');
    }

    await logStickyNoteTransaction('STICKY_NOTE_DELETED', data as StickyNoteRow, createdBy(profile));

    return NextResponse.json({ ok: true, note: data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to delete sticky note.',
      },
      { status: 500 }
    );
  }
}
