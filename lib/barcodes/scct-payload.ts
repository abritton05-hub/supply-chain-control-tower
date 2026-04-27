export type ScctBarcodePayload =
  | {
      type: 'inventory';
      itemId: string;
      partNumber: string;
      location: string;
      bin: string;
      fields: Record<string, string>;
    }
  | {
      type: 'location';
      location: string;
      bin: string;
      fields: Record<string, string>;
    };

function clean(value: string | undefined) {
  return value?.trim() || '';
}

export function parseScctBarcodePayload(value: string): ScctBarcodePayload | null {
  const parts = value
    .trim()
    .split('|')
    .map((part) => part.trim());

  if (parts[0]?.toUpperCase() !== 'SCCT') return null;

  const fields: Record<string, string> = {};

  for (const part of parts.slice(1)) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = part.slice(0, separatorIndex).trim().toLowerCase();
    const fieldValue = part.slice(separatorIndex + 1).trim();

    if (key) fields[key] = fieldValue;
  }

  if (fields.type === 'inventory') {
    return {
      type: 'inventory',
      itemId: clean(fields.item_id),
      partNumber: clean(fields.part_number),
      location: clean(fields.location),
      bin: clean(fields.bin),
      fields,
    };
  }

  if (fields.type === 'location') {
    return {
      type: 'location',
      location: clean(fields.location),
      bin: clean(fields.bin),
      fields,
    };
  }

  return null;
}

export function inventoryScanHref(payload: ScctBarcodePayload) {
  if (payload.type !== 'inventory') return '';

  if (payload.itemId) {
    return `/inventory/${encodeURIComponent(payload.itemId)}`;
  }

  if (payload.partNumber) {
    return `/inventory?search=${encodeURIComponent(payload.partNumber)}`;
  }

  return '';
}

export function locationScanHref(payload: ScctBarcodePayload) {
  if (payload.type !== 'location') return '';

  const params = new URLSearchParams();
  if (payload.location) params.set('location', payload.location);
  if (payload.bin) params.set('bin', payload.bin);

  const query = params.toString();
  return query ? `/inventory?${query}` : '';
}

export function searchTextForScctPayload(payload: ScctBarcodePayload) {
  if (payload.type === 'inventory') {
    return payload.itemId || payload.partNumber || [payload.location, payload.bin].filter(Boolean).join(' ');
  }

  return [payload.location, payload.bin].filter(Boolean).join(' ');
}
