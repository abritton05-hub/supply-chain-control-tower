export type GlobalSearchResult = {
  type: 'page';
  label: string;
  href: string;
  description: string;
  meta?: string;
  score?: number;
};

export async function runGlobalSearch(_query: string): Promise<GlobalSearchResult[]> {
  return [];
}