'use client';

export function PrintBomButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 print:hidden"
    >
      Print BOM
    </button>
  );
}
