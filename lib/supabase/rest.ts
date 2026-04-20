const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

type QueryParams = Record<string, string | number | boolean | undefined | null>;

export async function supabaseRest<T>(
  table: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    params?: QueryParams;
    body?: unknown;
    prefer?: string;
  } = {}
): Promise<T> {
  const { supabaseUrl: urlBase, supabaseAnonKey: anonKey } = getSupabaseConfig();

  const url = new URL(`${urlBase}/rest/v1/${table}`);

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer ?? 'return=representation',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${errorText}`);
  }

  if (response.status === 204) {
    return [] as T;
  }

  const text = await response.text();

  if (!text.trim()) {
    return [] as T;
  }

  return JSON.parse(text) as T;
}

export async function getNextBomNumber(): Promise<string> {
  const latest = await supabaseRest<{ bom_number: string | null }[]>('boms', {
    params: {
      select: 'bom_number',
      order: 'created_at.desc',
      limit: 200,
    },
  });

  const numbers = latest
    .map((record) => record.bom_number ?? '')
    .map((bomNumber) => {
      const match = bomNumber.match(/^DAI-(\d{6})$/);
      return match ? Number(match[1]) : 0;
    });

  const maxNumber = numbers.length ? Math.max(...numbers) : 0;
  return `DAI-${String(maxNumber + 1).padStart(6, '0')}`;
}

export async function getNextManifestNumber(): Promise<string> {
  const latest = await supabaseRest<{ manifest_number: string | null }[]>('manifests', {
    params: {
      select: 'manifest_number',
      order: 'created_at.desc',
      limit: 100,
    },
  });

  const numbers = latest
    .map((record) => record.manifest_number ?? '')
    .map((manifestNumber) => {
      const match = manifestNumber.match(/^MAN-(\d{6})$/);
      return match ? Number(match[1]) : 0;
    });

  const maxNumber = numbers.length ? Math.max(...numbers) : 0;
  return `MAN-${String(maxNumber + 1).padStart(6, '0')}`;
}