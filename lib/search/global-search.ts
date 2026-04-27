import type { AppRole } from '@/lib/auth/roles';
import {
  canManageDelivery,
  canSubmitPullRequests,
  canViewInventory,
  canViewTransactions,
} from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type GlobalSearchResultType =
  | 'inventory'
  | 'pull_request'
  | 'delivery_manifest'
  | 'bom'
  | 'address_book'
  | 'transaction';

export type GlobalSearchResult = {
  id: string;
  type: GlobalSearchResultType;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  status?: string;
  matchedField?: string;
  score?: number;
};

type SearchContext = {
  role: AppRole;
  limitPerEntity?: number;
};

type SupabaseClient = Awaited<ReturnType<typeof supabaseAdmin>>;

const DEFAULT_LIMIT_PER_ENTITY = 6;

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function display(value: unknown, fallback = '-') {
  const cleaned = clean(value);
  return cleaned || fallback;
}

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, ' ');
}

function safeIlikeTerm(query: string) {
  return normalizeQuery(query).replace(/[,%]/g, ' ');
}

function orIlike(columns: string[], query: string) {
  const term = `%${safeIlikeTerm(query)}%`;
  return columns.map((column) => `${column}.ilike.${term}`).join(',');
}

function encodeParam(value: unknown) {
  return encodeURIComponent(clean(value));
}

function textIncludes(value: unknown, query: string) {
  const haystack = clean(value).toLowerCase();
  const needle = normalizeQuery(query).toLowerCase();
  return Boolean(haystack && needle && haystack.includes(needle));
}

function matchedField(
  row: Record<string, unknown>,
  query: string,
  fields: Array<[string, string]>
) {
  for (const [key, label] of fields) {
    if (textIncludes(row[key], query)) return label;
  }

  return undefined;
}

function scoreFor(row: Record<string, unknown>, query: string, keys: string[]) {
  const needle = normalizeQuery(query).toLowerCase();

  for (let index = 0; index < keys.length; index += 1) {
    const value = clean(row[keys[index]]).toLowerCase();
    if (value === needle) return 100 - index;
    if (value.startsWith(needle)) return 80 - index;
  }

  return 40;
}

async function optionalSearch<T>(
  label: string,
  search: () => Promise<T[]>
): Promise<T[]> {
  try {
    return await search();
  } catch (error) {
    console.warn(`Global search skipped ${label}.`, {
      message: error instanceof Error ? error.message : 'Unknown search error.',
    });
    return [];
  }
}

async function searchInventory(
  supabase: SupabaseClient,
  query: string,
  limit: number
): Promise<GlobalSearchResult[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select(
      'id,item_id,part_number,description,location,site,bin_location,qty_on_hand,is_supply'
    )
    .or(orIlike(['item_id', 'part_number', 'description', 'location', 'bin_location'], query))
    .order('item_id', { ascending: true })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const itemId = display(row.item_id, String(row.id));
    const partNumber = clean(row.part_number);
    const location = [row.site, row.location, row.bin_location].map(clean).filter(Boolean).join(' / ');

    return {
      id: String(row.id ?? itemId),
      type: 'inventory',
      title: partNumber || itemId,
      subtitle: [display(row.description), location].filter((value) => value !== '-').join(' | '),
      href: `/inventory?search=${encodeParam(partNumber || itemId)}`,
      badge: row.is_supply ? 'Supply' : `Qty ${row.qty_on_hand ?? 0}`,
      matchedField: matchedField(row, query, [
        ['item_id', 'Item ID'],
        ['part_number', 'Part Number'],
        ['description', 'Description'],
        ['location', 'Location'],
        ['bin_location', 'Bin'],
      ]),
      score: scoreFor(row, query, ['item_id', 'part_number', 'description']),
    } satisfies GlobalSearchResult;
  });
}

async function searchPullRequests(
  supabase: SupabaseClient,
  query: string,
  limit: number
): Promise<GlobalSearchResult[]> {
  const { data, error } = await supabase
    .from('pull_requests')
    .select('id,request_number,requested_by,status,created_at')
    .or(orIlike(['request_number', 'requested_by', 'status'], query))
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const requestNumber = display(row.request_number, String(row.id));

    return {
      id: String(row.id ?? requestNumber),
      type: 'pull_request',
      title: requestNumber,
      subtitle: `Requested by ${display(row.requested_by)}`,
      href: `/pull-requests/${encodeParam(row.id)}`,
      badge: display(row.status, 'OPEN'),
      status: clean(row.status) || 'OPEN',
      matchedField: matchedField(row, query, [
        ['request_number', 'Request Number'],
        ['requested_by', 'Requested By'],
        ['status', 'Status'],
      ]),
      score: scoreFor(row, query, ['request_number', 'requested_by', 'status']),
    } satisfies GlobalSearchResult;
  });
}

async function searchPullRequestLines(
  supabase: SupabaseClient,
  query: string,
  limit: number
): Promise<GlobalSearchResult[]> {
  const { data, error } = await supabase
    .from('pull_request_lines')
    .select('id,request_id,item_id,part_number,description,quantity,location,notes')
    .or(orIlike(['item_id', 'part_number', 'description'], query))
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const title = display(row.part_number || row.item_id, 'Pull request line');

    return {
      id: String(row.id ?? `${row.request_id}-${title}`),
      type: 'pull_request',
      title,
      subtitle: [display(row.description), `Qty ${row.quantity ?? '-'}`, display(row.location)]
        .filter((value) => value !== '-')
        .join(' | '),
      href: `/pull-requests/${encodeParam(row.request_id)}`,
      badge: 'Line',
      matchedField: matchedField(row, query, [
        ['item_id', 'Item ID'],
        ['part_number', 'Part Number'],
        ['description', 'Description'],
      ]),
      score: scoreFor(row, query, ['part_number', 'item_id', 'description']),
    } satisfies GlobalSearchResult;
  });
}

async function searchDeliveryStops(
  supabase: SupabaseClient,
  query: string,
  limit: number
): Promise<GlobalSearchResult[]> {
  const { data, error } = await supabase
    .from('shipping_manifest_history')
    .select(
      'id,manifest_number,direction,title,stop_date,shipment_transfer_id,reference,from_location,from_address,to_location,to_address,status'
    )
    .or(
      orIlike(
        [
          'manifest_number',
          'shipment_transfer_id',
          'reference',
          'from_location',
          'from_address',
          'to_location',
          'to_address',
        ],
        query
      )
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const manifestNumber = display(row.manifest_number, 'Unassigned Manifest');
    const direction = clean(row.direction) === 'incoming' ? 'Pickup' : 'Drop Off';

    return {
      id: String(row.id ?? manifestNumber),
      type: 'delivery_manifest',
      title: manifestNumber,
      subtitle: [
        direction,
        display(row.reference || row.shipment_transfer_id, ''),
        `${display(row.from_location, '?')} to ${display(row.to_location, '?')}`,
      ]
        .filter(Boolean)
        .join(' | '),
      href: `/delivery?view=history&manifest=${encodeParam(row.manifest_number)}&stop=${encodeParam(row.id)}`,
      badge: display(row.status, direction),
      status: clean(row.status),
      matchedField: matchedField(row, query, [
        ['manifest_number', 'Manifest'],
        ['shipment_transfer_id', 'Transfer ID'],
        ['reference', 'Reference'],
        ['from_location', 'From Location'],
        ['from_address', 'From Address'],
        ['to_location', 'To Location'],
        ['to_address', 'To Address'],
      ]),
      score: scoreFor(row, query, ['manifest_number', 'shipment_transfer_id', 'reference']),
    } satisfies GlobalSearchResult;
  });
}

async function searchBoms(
  supabase: SupabaseClient,
  query: string,
  limit: number
): Promise<GlobalSearchResult[]> {
  const { data, error } = await supabase
    .from('shipping_bom_history')
    .select('id,bom_number,manifest_number,source_stop_id,reference,ship_from,ship_to,status')
    .or(orIlike(['bom_number', 'manifest_number', 'reference'], query))
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const bomNumber = display(row.bom_number, 'BOM');

    return {
      id: String(row.id ?? row.bom_number ?? row.source_stop_id ?? bomNumber),
      type: 'bom',
      title: bomNumber,
      subtitle: [
        row.manifest_number ? `Manifest ${row.manifest_number}` : '',
        display(row.reference, ''),
        display(row.ship_to, ''),
      ]
        .filter(Boolean)
        .join(' | '),
      href: `/delivery?view=history&bom=${encodeParam(row.bom_number)}`,
      badge: display(row.status, 'BOM'),
      status: clean(row.status),
      matchedField: matchedField(row, query, [
        ['bom_number', 'BOM'],
        ['manifest_number', 'Manifest'],
        ['reference', 'Reference'],
      ]),
      score: scoreFor(row, query, ['bom_number', 'manifest_number', 'reference']),
    } satisfies GlobalSearchResult;
  });
}

async function searchAddressBook(
  supabase: SupabaseClient,
  query: string,
  limit: number
): Promise<GlobalSearchResult[]> {
  const [addressBookRows, shippingLocationRows] = await Promise.all([
    optionalSearch('address_book', async () => {
      const { data, error } = await supabase
        .from('address_book')
        .select(
          'id,company_name,location_name,address_line_1,address_line_2,city,state,postal_code,contact_name,contact_phone,contact_email,location_type,is_active'
        )
        .or(
          orIlike(
            [
              'company_name',
              'location_name',
              'address_line_1',
              'address_line_2',
              'city',
              'state',
              'postal_code',
              'contact_name',
              'contact_phone',
              'contact_email',
            ],
            query
          )
        )
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    }),
    optionalSearch('shipping_locations', async () => {
      const { data, error } = await supabase
        .from('shipping_locations')
        .select(
          'id,code,display_name,address_line_1,city,state,postal_code,contact_name,contact_phone,notes'
        )
        .or(
          orIlike(
            [
              'code',
              'display_name',
              'address_line_1',
              'city',
              'state',
              'postal_code',
              'contact_name',
              'contact_phone',
              'notes',
            ],
            query
          )
        )
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    }),
  ]);

  const addressResults = addressBookRows.map((row) => {
    const title = [row.company_name, row.location_name].map(clean).filter(Boolean).join(' - ');
    const address = [row.address_line_1, row.city, row.state, row.postal_code]
      .map(clean)
      .filter(Boolean)
      .join(', ');

    return {
      id: String(row.id ?? title),
      type: 'address_book',
      title: title || 'Address Book',
      subtitle: [address, display(row.contact_name, '')].filter(Boolean).join(' | '),
      href: `/address-book?search=${encodeParam(title || row.contact_name)}`,
      badge: row.is_active === false ? 'Archived' : display(row.location_type, 'Address'),
      status: row.is_active === false ? 'Archived' : 'Active',
      matchedField: matchedField(row, query, [
        ['company_name', 'Company'],
        ['location_name', 'Location'],
        ['address_line_1', 'Address'],
        ['city', 'City'],
        ['contact_name', 'Contact'],
        ['contact_phone', 'Phone'],
        ['contact_email', 'Email'],
      ]),
      score: scoreFor(row, query, ['company_name', 'location_name', 'contact_name']),
    } satisfies GlobalSearchResult;
  });

  const locationResults = shippingLocationRows.map((row) => {
    const code = display(row.code, String(row.id));
    const address = [row.address_line_1, row.city, row.state, row.postal_code]
      .map(clean)
      .filter(Boolean)
      .join(', ');

    return {
      id: `shipping-location-${String(row.id ?? code)}`,
      type: 'address_book',
      title: [code, clean(row.display_name)].filter(Boolean).join(' - '),
      subtitle: [address, display(row.contact_name || row.contact_phone, '')]
        .filter(Boolean)
        .join(' | '),
      href: `/address-book?search=${encodeParam(code)}`,
      badge: 'Location',
      matchedField: matchedField(row, query, [
        ['code', 'Code'],
        ['display_name', 'Display Name'],
        ['address_line_1', 'Address'],
        ['city', 'City'],
        ['contact_name', 'Contact'],
        ['contact_phone', 'Phone'],
      ]),
      score: scoreFor(row, query, ['code', 'display_name', 'contact_name']),
    } satisfies GlobalSearchResult;
  });

  return [...addressResults, ...locationResults]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

async function searchTransactions(
  supabase: SupabaseClient,
  query: string,
  limit: number
): Promise<GlobalSearchResult[]> {
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select(
      'id,transaction_date,transaction_type,item_id,part_number,description,reference,notes,from_location,to_location,created_at'
    )
    .or(orIlike(['item_id', 'part_number', 'reference', 'transaction_type', 'notes'], query))
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const transactionType = display(row.transaction_type, 'Transaction');
    const subject = display(row.part_number || row.item_id || row.reference, transactionType);

    return {
      id: String(row.id ?? subject),
      type: 'transaction',
      title: subject,
      subtitle: [
        transactionType,
        display(row.transaction_date, ''),
        row.from_location || row.to_location
          ? `${display(row.from_location, '?')} to ${display(row.to_location, '?')}`
          : '',
      ]
        .filter(Boolean)
        .join(' | '),
      href: `/transactions?search=${encodeParam(subject)}`,
      badge: transactionType,
      status: transactionType,
      matchedField: matchedField(row, query, [
        ['item_id', 'Item ID'],
        ['part_number', 'Part Number'],
        ['reference', 'Reference'],
        ['transaction_type', 'Transaction Type'],
        ['notes', 'Notes'],
      ]),
      score: scoreFor(row, query, ['part_number', 'item_id', 'reference', 'transaction_type']),
    } satisfies GlobalSearchResult;
  });
}

export async function runGlobalSearch(
  rawQuery: string,
  context: SearchContext
): Promise<GlobalSearchResult[]> {
  const query = normalizeQuery(rawQuery);

  if (query.length < 2) {
    return [];
  }

  const limit = context.limitPerEntity ?? DEFAULT_LIMIT_PER_ENTITY;
  const supabase = await supabaseAdmin();
  const searches: Array<Promise<GlobalSearchResult[]>> = [];

  if (canViewInventory(context.role)) {
    searches.push(optionalSearch('inventory', () => searchInventory(supabase, query, limit)));
  }

  if (canSubmitPullRequests(context.role)) {
    searches.push(optionalSearch('pull_requests', () => searchPullRequests(supabase, query, limit)));
    searches.push(
      optionalSearch('pull_request_lines', () => searchPullRequestLines(supabase, query, limit))
    );
  }

  if (canViewTransactions(context.role)) {
    searches.push(
      optionalSearch('shipping_manifest_history', () =>
        searchDeliveryStops(supabase, query, limit)
      )
    );
    searches.push(optionalSearch('shipping_bom_history', () => searchBoms(supabase, query, limit)));
    searches.push(optionalSearch('transactions', () => searchTransactions(supabase, query, limit)));
  }

  if (canManageDelivery(context.role)) {
    searches.push(optionalSearch('address_book', () => searchAddressBook(supabase, query, limit)));
  }

  const groupedResults = await Promise.all(searches);

  return groupedResults
    .flat()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.title.localeCompare(b.title));
}
