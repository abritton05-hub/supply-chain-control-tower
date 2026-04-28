import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import { canManageDelivery } from '@/lib/auth/roles';
import { logTransaction } from '@/lib/transactions/log-transaction';
import { logActivity } from '@/lib/activity/log-activity';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function assertConfig() {
  if (!SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.');
  if (!SUPABASE_KEY) throw new Error('Missing Supabase API key.');
}

function headers() {
  if (!SUPABASE_KEY) throw new Error('Missing Supabase key.');

  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

type JsonObject = Record<string, unknown>;

const STOP_ITEM_SELECT =
  'id,stop_id,part_number,item_id,description,quantity,box_count,notes,created_at';

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableText(value: unknown) {
  return cleanText(value) || null;
}

function stopReference(payload: JsonObject) {
  return [payload.manifest_number, payload.shipment_transfer_id, payload.reference]
    .map(cleanText)
    .filter(Boolean)
    .join(' | ');
}

async function requireDeliveryAccess() {
  const profile = await getCurrentUserProfile();

  if (!canManageDelivery(profile.role)) {
    return NextResponse.json(
      { ok: false, message: 'Warehouse or admin access is required for shipping records.' },
      { status: 403 }
    );
  }

  return null;
}

function positiveNumber(value: unknown, fallback: number) {
  const numeric = typeof value === 'number' ? value : Number(cleanText(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function positiveInteger(value: unknown, fallback: number) {
  const numeric = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function nonnegativeInteger(value: unknown, fallback: number) {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number.parseInt(String(value), 10);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function lineBoxCount(value: unknown) {
  if (value === '') return 0;
  return nonnegativeInteger(value, 1);
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function extractStopItems(body: JsonObject) {
  if (Array.isArray(body.line_items)) return body.line_items;
  if (Array.isArray(body.stop_items)) return body.stop_items;
  if (Array.isArray(body.delivery_stop_items)) return body.delivery_stop_items;
  return null;
}

function manifestPayload(body: JsonObject) {
  const {
    line_items: _lineItems,
    stop_items: _stopItems,
    delivery_stop_items: _deliveryStopItems,
    ...payload
  } = body;

  if ('box_count' in body) {
    payload.box_count = positiveInteger(body.box_count, 1);
  }

  return payload;
}

function normalizeStopItem(input: unknown, stopId: string) {
  const item = isObject(input) ? input : {};
  const id = cleanText(item.id);

  return {
    ...(id && looksLikeUuid(id) ? { id } : {}),
    stop_id: stopId,
    part_number: nullableText(item.part_number),
    item_id: nullableText(item.item_id),
    description: nullableText(item.description),
    quantity: positiveNumber(item.quantity, 1),
    box_count: lineBoxCount(item.box_count),
    notes: nullableText(item.notes),
  };
}

function isMissingBoxCountColumn(data: unknown) {
  if (!isObject(data)) return false;
  const message = [data.message, data.details, data.hint, data.code]
    .map((value) => (typeof value === 'string' ? value : ''))
    .join(' ');

  return message.includes('box_count') || message.includes('PGRST204');
}

async function writeManifestRow(
  method: 'POST' | 'PATCH',
  payload: JsonObject,
  id?: string
) {
  const url =
    method === 'PATCH' && id
      ? `${SUPABASE_URL}/rest/v1/shipping_manifest_history?id=eq.${encodeURIComponent(id)}`
      : `${SUPABASE_URL}/rest/v1/shipping_manifest_history`;
  const body =
    method === 'PATCH'
      ? {
          ...payload,
          updated_at: new Date().toISOString(),
        }
      : payload;

  const res = await fetch(url, {
    method,
    headers: headers(),
    body: JSON.stringify(body),
  });
  let data = await readJson(res);

  if (!res.ok && 'box_count' in body && isMissingBoxCountColumn(data)) {
    const { box_count: _boxCount, ...fallbackBody } = body;
    const fallbackRes = await fetch(url, {
      method,
      headers: headers(),
      body: JSON.stringify(fallbackBody),
    });
    data = await readJson(fallbackRes);
    return { res: fallbackRes, data };
  }

  return { res, data };
}

async function loadStopItems(stopIds: string[]) {
  const itemsByStopId = new Map<string, unknown[]>();
  if (!stopIds.length) return itemsByStopId;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/delivery_stop_items?select=${STOP_ITEM_SELECT}&order=created_at.asc`,
    {
      method: 'GET',
      headers: headers(),
      cache: 'no-store',
    }
  );
  const data = await readJson(res);

  if (!res.ok) {
    console.warn('Structured delivery stop items could not be loaded.', data);
    return itemsByStopId;
  }

  const stopIdSet = new Set(stopIds);
  for (const item of Array.isArray(data) ? data : []) {
    if (!isObject(item)) continue;
    const stopId = cleanText(item.stop_id);
    if (!stopIdSet.has(stopId)) continue;
    itemsByStopId.set(stopId, [...(itemsByStopId.get(stopId) || []), item]);
  }

  return itemsByStopId;
}

async function replaceStopItems(stopId: string, rawItems: unknown[]) {
  const deleteRes = await fetch(
    `${SUPABASE_URL}/rest/v1/delivery_stop_items?stop_id=eq.${encodeURIComponent(stopId)}`,
    {
      method: 'DELETE',
      headers: headers(),
    }
  );
  const deleteData = await readJson(deleteRes);

  if (!deleteRes.ok) {
    return {
      ok: false,
      status: deleteRes.status,
      message:
        (isObject(deleteData) && cleanText(deleteData.message)) ||
        'Structured stop item delete failed.',
    };
  }

  const rows = rawItems
    .map((item) => normalizeStopItem(item, stopId))
    .filter((item) => item.part_number || item.item_id || item.description || item.notes);

  if (!rows.length) return { ok: true, rows: [] };

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/delivery_stop_items`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(rows),
  });
  const insertData = await readJson(insertRes);

  if (!insertRes.ok) {
    return {
      ok: false,
      status: insertRes.status,
      message:
        (isObject(insertData) && cleanText(insertData.message)) ||
        'Structured stop item save failed.',
    };
  }

  return { ok: true, rows: Array.isArray(insertData) ? insertData : [] };
}

export async function GET() {
  try {
    const forbidden = await requireDeliveryAccess();
    if (forbidden) return forbidden;

    assertConfig();

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/shipping_manifest_history?select=*&order=created_at.desc`,
      {
        method: 'GET',
        headers: headers(),
        cache: 'no-store',
      }
    );

    const data = await readJson(res);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: (isObject(data) && cleanText(data.message)) || 'Load failed.' },
        { status: res.status }
      );
    }

    const rows = Array.isArray(data) ? data : [];
    const stopIds = rows.map((row) => (isObject(row) ? cleanText(row.id) : '')).filter(Boolean);
    const itemsByStopId = await loadStopItems(stopIds);
    const rowsWithItems = rows.map((row) => {
      if (!isObject(row)) return row;
      const lineItems = itemsByStopId.get(cleanText(row.id)) || [];
      return {
        ...row,
        line_items: lineItems,
        stop_items: lineItems,
      };
    });

    return NextResponse.json({ ok: true, rows: rowsWithItems });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Load failed.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const forbidden = await requireDeliveryAccess();
    if (forbidden) return forbidden;

    assertConfig();

    const body = (await request.json()) as JsonObject;
    const stopItems = extractStopItems(body);
    const payload = manifestPayload(body);

    const { res, data } = await writeManifestRow('POST', payload);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: (isObject(data) && cleanText(data.message)) || 'Save failed.' },
        { status: res.status }
      );
    }

    const row = Array.isArray(data) ? data[0] : payload;
    const rowId = isObject(row) ? cleanText(row.id) : cleanText(payload.id);
    let savedStopItems: unknown[] = [];

    if (stopItems) {
      const itemResult = await replaceStopItems(rowId, stopItems);
      if (!itemResult.ok) {
        return NextResponse.json(
          { ok: false, message: itemResult.message },
          { status: itemResult.status || 500 }
        );
      }
      savedStopItems = itemResult.rows ?? [];
    }

    const logResult = await logTransaction({
      transaction_type: 'DELIVERY_STOP_CREATED',
      transaction_date: cleanText(payload.stop_date),
      description:
        cleanText(payload.title) ||
        cleanText(payload.items) ||
        cleanText(payload.reference) ||
        'Delivery stop created',
      quantity: null,
      from_location: cleanText(payload.from_location),
      to_location: cleanText(payload.to_location),
      reference: stopReference(payload),
      notes: cleanText(payload.notes),
      entity_type: 'shipping_manifest_history',
      entity_id: rowId || null,
      details: { ...payload, line_items: savedStopItems },
      write_inventory_transaction: true,
      write_activity_log: true,
    });

    if (logResult.ok === false) {
      console.error('Delivery stop transaction logging failed.', {
        id: rowId,
        message: logResult.message,
      });
    }

    return NextResponse.json({
      ok: true,
      row: isObject(row) ? { ...row, line_items: savedStopItems, stop_items: savedStopItems } : null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Save failed.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const forbidden = await requireDeliveryAccess();
    if (forbidden) return forbidden;

    assertConfig();

    const body = (await request.json()) as JsonObject;

    if (!body.id) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }

    const { id, ...updates } = body;
    const stopId = String(id);
    const stopItems = extractStopItems(updates);
    const payload = manifestPayload(updates);

    const { res, data } = await writeManifestRow('PATCH', payload, stopId);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: (isObject(data) && cleanText(data.message)) || 'Update failed.' },
        { status: res.status }
      );
    }

    const row = Array.isArray(data) ? data[0] : body;
    let savedStopItems: unknown[] =
      isObject(row) && Array.isArray(row.line_items) ? row.line_items : [];

    if (stopItems) {
      const itemResult = await replaceStopItems(stopId, stopItems);
      if (!itemResult.ok) {
        return NextResponse.json(
          { ok: false, message: itemResult.message },
          { status: itemResult.status || 500 }
        );
      }
      savedStopItems = itemResult.rows ?? [];
    }

    const logResult = await logTransaction({
      transaction_type: 'DELIVERY_STOP_UPDATED',
      transaction_date: cleanText(payload.stop_date),
      description:
        cleanText(payload.title) ||
        cleanText(payload.items) ||
        cleanText(payload.reference) ||
        'Delivery stop updated',
      quantity: null,
      from_location: cleanText(payload.from_location),
      to_location: cleanText(payload.to_location),
      reference: stopReference(payload),
      notes: cleanText(payload.notes),
      entity_type: 'shipping_manifest_history',
      entity_id: isObject(row) && row.id ? String(row.id) : stopId,
      details: { id: stopId, ...payload, line_items: savedStopItems },
      write_inventory_transaction: true,
      write_activity_log: true,
    });

    if (logResult.ok === false) {
      console.error('Delivery stop transaction logging failed.', {
        id: stopId,
        message: logResult.message,
      });
    }

    return NextResponse.json({
      ok: true,
      row: isObject(row) ? { ...row, line_items: savedStopItems, stop_items: savedStopItems } : null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Update failed.' },
      { status: 500 }
    );
  }
}


export async function DELETE(request: Request) {
  try {
    const forbidden = await requireDeliveryAccess();
    if (forbidden) return forbidden;

    assertConfig();

    const { searchParams } = new URL(request.url);
    const id = cleanText(searchParams.get('id'));

    if (!id) {
      return NextResponse.json({ ok: false, message: 'id is required.' }, { status: 400 });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/shipping_manifest_history?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: headers(),
      }
    );

    const data = await readJson(res);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: (isObject(data) && cleanText(data.message)) || 'Delete failed.' },
        { status: res.status }
      );
    }

    const activity = await logActivity({
      actionType: 'MANIFEST_STOP_DROP_REMOVED',
      module: 'manifest',
      recordId: id,
      recordLabel: id,
      notes: 'Manifest stop removed/archived.',
    });

    if (!activity.ok) {
      console.warn('Manifest stop delete logging failed.', activity.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Delete failed.' },
      { status: 500 }
    );
  }
}
