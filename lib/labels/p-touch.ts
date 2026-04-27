export type LabelWorkflow = 'inventory' | 'receiving' | 'shipping_manifest';

export type LabelPayload = {
  labelTitle?: string;
  workflow: LabelWorkflow;
  partNumber: string;
  itemId: string;
  description: string;
  quantity: string;
  locationBin: string;
  reference: string;
  date: string;
  barcodePayload: string;
};

type InventoryLabelInput = {
  partNumber?: string | null;
  itemId?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  location?: string | null;
  binLocation?: string | null;
  date?: string | null;
};

type ReceivingLabelInput = InventoryLabelInput & {
  reference?: string | null;
};

type ShippingManifestLabelInput = {
  manifestNumber?: string | null;
  stopId?: string | null;
  partNumber?: string | null;
  itemId?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  location?: string | null;
  reference?: string | null;
  date?: string | null;
};

const CSV_COLUMNS: Array<keyof LabelPayload> = [
  'workflow',
  'partNumber',
  'itemId',
  'description',
  'quantity',
  'locationBin',
  'reference',
  'date',
  'barcodePayload',
];

function clean(value: string | number | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return value?.toString().trim() || '';
}

function cleanDate(value: string | null | undefined) {
  const text = clean(value);
  if (!text) return new Date().toISOString().slice(0, 10);

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10);
}

function locationBin(location?: string | null, binLocation?: string | null) {
  return [clean(location), clean(binLocation)].filter(Boolean).join(' / ');
}

function barcodePayload(workflow: LabelWorkflow, values: Record<string, string>) {
  const pairs = Object.entries(values)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${value.replaceAll('|', '/')}`);

  return ['SCCT', `workflow=${workflow}`, ...pairs].join('|');
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function filenameSafe(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'label-data';
}

export function buildInventoryItemLabelPayload(input: InventoryLabelInput): LabelPayload {
  const partNumber = clean(input.partNumber);
  const itemId = clean(input.itemId);
  const description = clean(input.description);
  const quantity = clean(input.quantity);
  const date = cleanDate(input.date);
  const labelLocation = locationBin(input.location, input.binLocation);

  return {
    labelTitle: 'IDENTIFIER',
    workflow: 'inventory',
    partNumber,
    itemId,
    description,
    quantity,
    locationBin: labelLocation,
    reference: '',
    date,
    barcodePayload: barcodePayload('inventory', {
      item_id: itemId,
      part_number: partNumber,
      location: labelLocation,
    }),
  };
}

export function buildReceivingLabelPayload(input: ReceivingLabelInput): LabelPayload {
  const partNumber = clean(input.partNumber);
  const itemId = clean(input.itemId);
  const description = clean(input.description);
  const quantity = clean(input.quantity);
  const reference = clean(input.reference);
  const date = cleanDate(input.date);
  const labelLocation = locationBin(input.location, input.binLocation);

  return {
    workflow: 'receiving',
    partNumber,
    itemId,
    description,
    quantity,
    locationBin: labelLocation,
    reference,
    date,
    barcodePayload: barcodePayload('receiving', {
      item_id: itemId,
      part_number: partNumber,
      qty: quantity,
      reference,
      date,
    }),
  };
}

export function buildShippingManifestLabelPayload(
  input: ShippingManifestLabelInput
): LabelPayload {
  const partNumber = clean(input.partNumber);
  const itemId = clean(input.itemId);
  const description = clean(input.description);
  const quantity = clean(input.quantity);
  const reference = clean(input.reference);
  const date = cleanDate(input.date);
  const labelLocation = clean(input.location);
  const manifestNumber = clean(input.manifestNumber);
  const stopId = clean(input.stopId);

  return {
    workflow: 'shipping_manifest',
    partNumber,
    itemId,
    description,
    quantity,
    locationBin: labelLocation,
    reference: reference || manifestNumber,
    date,
    barcodePayload: barcodePayload('shipping_manifest', {
      manifest: manifestNumber,
      stop_id: stopId,
      item_id: itemId,
      part_number: partNumber,
      reference,
      date,
    }),
  };
}

export function labelPayloadsToCsv(payloads: LabelPayload[]) {
  const columns: Array<keyof LabelPayload> = payloads.some((payload) => payload.labelTitle)
    ? ['labelTitle', ...CSV_COLUMNS]
    : CSV_COLUMNS;
  const header = columns.join(',');
  const rows = payloads.map((payload) =>
    columns.map((column) => csvEscape(String(payload[column] ?? ''))).join(',')
  );

  return [header, ...rows].join('\r\n');
}

export function downloadLabelPayloadsCsv(payloads: LabelPayload[], filenameSeed: string) {
  if (typeof window === 'undefined') return;

  const csv = labelPayloadsToCsv(payloads);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${filenameSafe(filenameSeed)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
