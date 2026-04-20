import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

type SearchResult = {
  type: 'inventory' | 'pull_request' | 'transaction' | 'location';
  label: string;
  description: string;
  href: string;
  meta?: string;
  score: number;
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = (url.searchParams.get('q') ?? '').trim();

    if (query.length < 2) {
      return NextResponse.json({
        ok: true,
        results: [] as SearchResult[],
      });
    }

    const supabase = await supabaseServer();
    const results: SearchResult[] = [];
    const like = `%${query}%`;

    // Inventory: use the exact same source table as the Receiving page
    const { data: inventoryRows, error: inventoryError } = await supabase
      .from('inventory')
      .select('id,item_id,part_number,description,location,qty_on_hand')
      .or(
        [
          `part_number.ilike.${like}`,
          `description.ilike.${like}`,
          `item_id.ilike.${like}`,
          `location.ilike.${like}`,
        ].join(',')
      )
      .limit(25);

    if (!inventoryError && inventoryRows) {
      for (const row of inventoryRows) {
        const partNumber = clean(row.part_number);
        const description = clean(row.description);
        const itemId = clean(row.item_id);
        const location = clean(row.location);

        results.push({
          type: 'inventory',
          label: partNumber || description || itemId || 'Inventory item',
          description: description || 'Inventory item',
          href: `/inventory?search=${encodeURIComponent(
            partNumber || description || itemId
          )}`,
          meta: [
            itemId && `ID ${itemId}`,
            location && `Loc ${location}`,
            typeof row.qty_on_hand === 'number' ? `On hand ${row.qty_on_hand}` : '',
          ]
            .filter(Boolean)
            .join(' • '),
          score: 100,
        });
      }
    }

    const { data: pullRequestRows, error: pullRequestError } = await supabase
      .from('pull_requests')
      .select('*')
      .or(
        [
          `request_number.ilike.${like}`,
          `requested_by.ilike.${like}`,
          `status.ilike.${like}`,
        ].join(',')
      )
      .limit(20);

    if (!pullRequestError && pullRequestRows) {
      for (const row of pullRequestRows) {
        const requestNumber = clean(row.request_number) || clean(row.id) || 'Pull Request';
        const requestedBy = clean(row.requested_by);
        const status = clean(row.status);

        results.push({
          type: 'pull_request',
          label: requestNumber,
          description: requestedBy ? `Requested by ${requestedBy}` : 'Pull request',
          href: `/pull-requests?search=${encodeURIComponent(requestNumber)}`,
          meta: status || undefined,
          score: 80,
        });
      }
    }

    const { data: transactionRows, error: transactionError } = await supabase
      .from('inventory_transactions')
      .select('*')
      .or(
        [
          `part_number.ilike.${like}`,
          `description.ilike.${like}`,
          `reference.ilike.${like}`,
          `location.ilike.${like}`,
          `transaction_type.ilike.${like}`,
          `notes.ilike.${like}`,
        ].join(',')
      )
      .limit(20);

    if (!transactionError && transactionRows) {
      for (const row of transactionRows) {
        const partNumber = clean(row.part_number);
        const description = clean(row.description) || clean(row.notes) || 'Inventory transaction';
        const reference = clean(row.reference);
        const txType = clean(row.transaction_type) || clean(row.type);
        const location = clean(row.location) || clean(row.to_location) || clean(row.from_location);

        results.push({
          type: 'transaction',
          label: reference || partNumber || txType || 'Transaction',
          description,
          href: `/transactions?search=${encodeURIComponent(
            reference || partNumber || description
          )}`,
          meta: [txType, location].filter(Boolean).join(' • '),
          score: 60,
        });
      }
    }

    const { data: locationRows, error: locationError } = await supabase
      .from('locations')
      .select('*')
      .or(
        [
          `name.ilike.${like}`,
          `code.ilike.${like}`,
          `description.ilike.${like}`,
          `type.ilike.${like}`,
        ].join(',')
      )
      .limit(20);

    if (!locationError && locationRows) {
      for (const row of locationRows) {
        const name = clean(row.name) || clean(row.code) || 'Location';
        const description = clean(row.description) || clean(row.type) || 'Location';
        const code = clean(row.code);

        results.push({
          type: 'location',
          label: name,
          description,
          href: `/locations?search=${encodeURIComponent(code || name)}`,
          meta: code || undefined,
          score: 40,
        });
      }
    }

    const deduped = Array.from(
      new Map(
        results.map((item) => [`${item.type}:${item.label}:${item.description}`, item])
      ).values()
    )
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, 12);

    return NextResponse.json({
      ok: true,
      results: deduped,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Search failed.',
        results: [] as SearchResult[],
      },
      { status: 500 }
    );
  }
}