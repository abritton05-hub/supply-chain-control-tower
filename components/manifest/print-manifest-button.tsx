'use client';

import { useTransition } from 'react';

export function PrintManifestButton({ markPrinted }: { markPrinted?: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();

  const handlePrint = () => {
    if (!markPrinted) {
      window.print();
      return;
    }

    startTransition(async () => {
      await markPrinted();
      window.print();
    });
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      disabled={isPending}
      className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70 print:hidden"
    >
      {isPending ? 'Preparing Print' : 'Print Manifest'}
    </button>
  );
}
