'use client';

export function TopHeader() {
  return (
    <header className="flex items-center justify-between border-b border-slate-300 bg-white/80 px-6 py-4 backdrop-blur-sm">
      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
        Supply Chain Control Tower
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700 shadow-sm">
          AB
        </div>
      </div>
    </header>
  );
}