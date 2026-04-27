'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type StickyNotePriority = 'info' | 'warning' | 'critical';

type StickyNote = {
  id: string;
  entity_type?: string | null;
  entity_id?: string | null;
  note: string;
  priority: StickyNotePriority;
  is_pinned: boolean;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type StickyNotesResponse = {
  ok?: boolean;
  notes?: StickyNote[];
  stickyNotes?: StickyNote[];
  message?: string;
};

type StickyNoteMutationResponse = StickyNotesResponse & {
  note?: StickyNote;
  stickyNote?: StickyNote;
};

type StickyNotesProps = {
  entityType: string;
  entityId: string;
  title?: string;
};

const priorityOptions: { value: StickyNotePriority; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

const priorityStyles: Record<
  StickyNotePriority,
  {
    callout: string;
    label: string;
    rail: string;
    meta: string;
  }
> = {
  info: {
    callout: 'border-slate-300 bg-slate-50 text-slate-800',
    label: 'border-slate-300 bg-white text-slate-600',
    rail: 'bg-cyan-500',
    meta: 'text-slate-500',
  },
  warning: {
    callout: 'border-amber-300 bg-amber-50 text-amber-950',
    label: 'border-amber-300 bg-amber-100 text-amber-900',
    rail: 'bg-amber-500',
    meta: 'text-amber-800/75',
  },
  critical: {
    callout: 'border-red-400 bg-red-50 text-red-950 shadow-sm ring-1 ring-red-200',
    label: 'border-red-300 bg-red-100 text-red-900',
    rail: 'bg-red-600',
    meta: 'text-red-900/70',
  },
};

const priorityRank: Record<StickyNotePriority, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const emptyForm = {
  note: '',
  priority: 'info' as StickyNotePriority,
  is_pinned: true,
};

function normalizePriority(value: unknown): StickyNotePriority {
  if (value === 'warning' || value === 'critical') {
    return value;
  }

  return 'info';
}

function normalizeNote(note: StickyNote): StickyNote {
  return {
    ...note,
    priority: normalizePriority(note.priority),
    is_pinned: note.is_pinned !== false,
  };
}

function timestamp(value?: string | null): number | null {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function formatDateTime(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function hasMeaningfulUpdate(note: StickyNote) {
  const created = timestamp(note.created_at);
  const updated = timestamp(note.updated_at);

  if (!created || !updated) return false;

  return Math.abs(updated - created) > 1000;
}

function noteMetadata(note: StickyNote) {
  const createdBy = note.created_by?.trim() || 'Unknown user';
  const createdAt = formatDateTime(note.created_at);
  const updatedAt = hasMeaningfulUpdate(note) ? formatDateTime(note.updated_at) : '';
  const details = [createdBy, createdAt ? `Created ${createdAt}` : '', updatedAt ? `Updated ${updatedAt}` : '']
    .filter(Boolean)
    .join(' - ');

  return details || 'No audit details available';
}

function sortStickyNotes(notes: StickyNote[]) {
  return [...notes].sort((a, b) => {
    const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDelta !== 0) return priorityDelta;

    const aTime = timestamp(a.created_at) || 0;
    const bTime = timestamp(b.created_at) || 0;
    return bTime - aTime;
  });
}

function cleanErrorMessage(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes('sticky_notes') &&
    (lower.includes('schema cache') ||
      lower.includes('could not find') ||
      lower.includes('does not exist') ||
      lower.includes('relation'))
  ) {
    return 'Sticky notes table is not installed. Run docs/supabase-sticky-notes.sql in Supabase.';
  }

  return message;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text.trim()) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

export function StickyNotes({ entityType, entityId, title = 'Notes' }: StickyNotesProps) {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<StickyNote | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const pinnedNotes = useMemo(
    () => sortStickyNotes(notes.filter((note) => note.is_pinned)),
    [notes]
  );
  const visibleNotes = isCollapsed ? pinnedNotes.slice(0, 2) : pinnedNotes;
  const hiddenNoteCount = Math.max(pinnedNotes.length - visibleNotes.length, 0);
  const isSetupError = error.includes('Sticky notes table is not installed');

  useEffect(() => {
    let ignore = false;

    async function loadNotes() {
      if (!entityType || !entityId) {
        setNotes([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          entity_type: entityType,
          entity_id: entityId,
        });
        const response = await fetch(`/api/sticky-notes?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = await readJson<StickyNotesResponse>(response);

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.message || 'Failed to load notes.');
        }

        if (!ignore) {
          setNotes((payload.notes || payload.stickyNotes || []).map(normalizeNote));
        }
      } catch (loadError) {
        if (!ignore) {
          setError(
            cleanErrorMessage(
              loadError instanceof Error ? loadError.message : 'Failed to load notes.'
            )
          );
          setNotes([]);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadNotes();

    return () => {
      ignore = true;
    };
  }, [entityType, entityId]);

  function openCreateForm() {
    setEditingNote(null);
    setForm(emptyForm);
    setError('');
    setIsFormOpen(true);
  }

  function openEditForm(note: StickyNote) {
    setEditingNote(note);
    setForm({
      note: note.note,
      priority: normalizePriority(note.priority),
      is_pinned: note.is_pinned,
    });
    setError('');
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSaving) return;

    setIsFormOpen(false);
    setEditingNote(null);
    setForm(emptyForm);
    setError('');
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanNote = form.note.trim();

    if (!cleanNote) {
      setError('Enter a note before saving.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const response = await fetch('/api/sticky-notes', {
        method: editingNote ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingNote?.id,
          entity_type: entityType,
          entity_id: entityId,
          note: cleanNote,
          priority: form.priority,
          is_pinned: form.is_pinned,
        }),
      });
      const payload = await readJson<StickyNoteMutationResponse>(response);

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || 'Failed to save note.');
      }

      const savedNote = payload.note || payload.stickyNote;

      if (savedNote) {
        setNotes((current) => {
          const normalized = normalizeNote(savedNote);

          if (editingNote) {
            return current.map((note) => (note.id === normalized.id ? normalized : note));
          }

          return [normalized, ...current];
        });
      }

      closeForm();
    } catch (saveError) {
      setError(
        cleanErrorMessage(saveError instanceof Error ? saveError.message : 'Failed to save note.')
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    const shouldDelete = window.confirm('Delete this note?');

    if (!shouldDelete) return;

    setIsSaving(true);
    setError('');

    try {
      const response = await fetch('/api/sticky-notes', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: noteId }),
      });
      const payload = await readJson<StickyNoteMutationResponse>(response);

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || 'Failed to delete note.');
      }

      setNotes((current) => current.filter((note) => note.id !== noteId));
      if (editingNote?.id === noteId) {
        closeForm();
      }
    } catch (deleteError) {
      setError(
        cleanErrorMessage(
          deleteError instanceof Error ? deleteError.message : 'Failed to delete note.'
        )
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-2" aria-labelledby={`sticky-notes-${entityType}-${entityId}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2
            id={`sticky-notes-${entityType}-${entityId}`}
            className="break-words text-base font-semibold text-slate-900"
          >
            {title}
          </h2>
          {isLoading ? <p className="text-xs text-slate-500">Loading notes...</p> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {pinnedNotes.length > 2 ? (
            <button
              type="button"
              onClick={() => setIsCollapsed((current) => !current)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {isCollapsed ? `Show all (${pinnedNotes.length})` : 'Collapse'}
            </button>
          ) : null}
          <button type="button" onClick={openCreateForm} className="erp-button w-full sm:w-auto">
            Add Note
          </button>
        </div>
      </div>

      {error ? (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            isSetupError
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {error}
        </div>
      ) : null}

      {pinnedNotes.length > 0 ? (
        <div className="grid gap-2">
          {visibleNotes.map((note) => {
            const styles = priorityStyles[note.priority];

            return (
              <article
                key={note.id}
                className={`overflow-hidden rounded-md border ${styles.callout}`}
              >
                <div className="flex">
                  <div className={`w-1 shrink-0 ${styles.rail}`} aria-hidden="true" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${styles.label}`}
                      >
                        {note.priority}
                      </span>
                    </div>
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">{note.note}</p>
                      <p className={`text-xs ${styles.meta}`}>{noteMetadata(note)}</p>
                    </div>
                    <div className="flex shrink-0 gap-2 self-start">
                      <button
                        type="button"
                        onClick={() => openEditForm(note)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNote(note.id)}
                        disabled={isSaving}
                        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          {hiddenNoteCount > 0 ? (
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Show {hiddenNoteCount} more pinned {hiddenNoteCount === 1 ? 'note' : 'notes'}
            </button>
          ) : null}
        </div>
      ) : !isLoading ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
          No pinned notes for this record.
        </div>
      ) : null}

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-md border border-slate-200 bg-white shadow-xl">
            <form onSubmit={submitNote} className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {editingNote ? 'Edit Note' : 'Add Note'}
                  </h3>
                  <p className="text-xs text-slate-500">{entityType} record</p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSaving}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Close
                </button>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase text-slate-500">Note</span>
                <textarea
                  value={form.note}
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  rows={5}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                  autoFocus
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase text-slate-500">Priority</span>
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        priority: normalizePriority(event.target.value),
                      }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_pinned}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, is_pinned: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-cyan-700"
                  />
                  Pinned
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSaving}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="erp-button">
                  {isSaving ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
