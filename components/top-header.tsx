import { GlobalSearch } from '@/components/global-search';

export function TopHeader() {
  return (
    <header className="mb-4 flex h-14 items-center justify-end border-b border-slate-200 bg-white px-4">
      <GlobalSearch />
    </header>
  );
}
