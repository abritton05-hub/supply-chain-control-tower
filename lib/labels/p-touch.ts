export type PTouchLabelRow = {
  identifier: string;
  part_number: string;
  description: string;
  qty: string;
  location: string;
  reference: string;
};

type InventoryLabelInput = {
  partNumber?: string | null;
  itemId?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  location?: string | null;
  binLocation?: string | null;
  reference?: string | null;
  po?: string | null;
  tracking?: string | null;
  date?: string | null;
};

type LocationLabelInput = {
  location?: string | null;
  binLocation?: string | null;
  reference?: string | null;
  date?: string | null;
};

type ReceivingLabelInput = InventoryLabelInput;

type ShippingManifestLabelInput = InventoryLabelInput & {
  manifestNumber?: string | null;
  stopId?: string | null;
  destinationName?: string | null;
  destinationAddress?: string | null;
  contactLine?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  cityStateZip?: string | null;
};

const DESCRIPTION_MAX_LENGTH = 80;
const EXPORT_FILENAME = 'ptouch-label-export.csv';

function clean(value: string | number | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return value?.toString().trim() || '';
}

function joinLocation(location?: string | null, binLocation?: string | null) {
  return [clean(location), clean(binLocation)].filter(Boolean).join(' / ');
}

function truncateDescription(value: string) {
  if (value.length <= DESCRIPTION_MAX_LENGTH) return value;
  return `${value.slice(0, DESCRIPTION_MAX_LENGTH - 1)}…`;
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function buildInventoryItemLabelPayload(input: InventoryLabelInput): PTouchLabelRow {
  const partNumber = clean(input.partNumber);
  const identifier = clean(input.itemId) || partNumber || joinLocation(input.location, input.binLocation);

  return {
    identifier,
    part_number: partNumber,
    description: truncateDescription(clean(input.description)),
    qty: clean(input.quantity),
    location: joinLocation(input.location, input.binLocation),
    reference: clean(input.reference),
  };
}

export function buildLocationLabelPayload(input: LocationLabelInput): PTouchLabelRow {
  const location = joinLocation(input.location, input.binLocation);

  return {
    identifier: location,
    part_number: '',
    description: '',
    qty: '',
    location,
    reference: clean(input.reference),
  };
}

export function buildReceivingLabelPayload(input: ReceivingLabelInput): PTouchLabelRow {
  return buildInventoryItemLabelPayload(input);
}

export function buildShippingManifestLabelPayload(
  input: ShippingManifestLabelInput
): PTouchLabelRow {
  const reference = clean(input.reference) || clean(input.manifestNumber) || clean(input.stopId);

  return buildInventoryItemLabelPayload({
    ...input,
    reference,
  });
}

export function labelPayloadsToCsv(rows: PTouchLabelRow[]) {
  const columns: Array<keyof PTouchLabelRow> = [
    'identifier',
    'part_number',
    'description',
    'qty',
    'location',
    'reference',
  ];

  const header = columns.join(',');
  const dataRows = rows.map((row) => columns.map((column) => csvEscape(row[column] ?? '')).join(','));

  return [header, ...dataRows].join('\r\n');
}

export function downloadPtouchLabelsCsv(rows: PTouchLabelRow[]) {
  if (typeof window === 'undefined') return;

  const csv = labelPayloadsToCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = EXPORT_FILENAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function downloadLabelPayloadsCsv(rows: PTouchLabelRow[]) {
  downloadPtouchLabelsCsv(rows);
}
