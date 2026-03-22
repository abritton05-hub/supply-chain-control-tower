'use client';

import { ReactNode } from 'react';

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded border border-slate-300 px-2 py-1 text-xs">Close</button>
        </div>
        <div className="max-h-[80vh] overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function SlideOver({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50">
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded border border-slate-300 px-2 py-1 text-xs">Close</button>
        </div>
        <div className="h-[calc(100%-57px)] overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, onCancel, onConfirm }: { open: boolean; title: string; message: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="text-sm text-slate-700">{message}</p>
      <div className="mt-4 flex gap-2">
        <button onClick={onCancel} className="rounded border border-slate-300 px-3 py-1 text-xs">Cancel</button>
        <button onClick={onConfirm} className="rounded border border-rose-300 bg-rose-50 px-3 py-1 text-xs text-rose-700">Delete</button>
      </div>
    </Modal>
  );
}
