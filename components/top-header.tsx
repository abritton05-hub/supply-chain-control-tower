import { GlobalSearch } from '@/components/global-search';
import { currentUser } from '@/lib/data/mock-data';

export function TopHeader() {
  return (
    <header className="mb-4 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="text-xs text-slate-500">User-attributed operations enabled</div>
      <div className="flex items-center gap-3">
        <GlobalSearch />
        <button className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
          {currentUser.name} · {currentUser.role} ▾
        </button>
      </div>
    </header>
  );
}
