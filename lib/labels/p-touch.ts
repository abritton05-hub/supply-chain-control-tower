export type LabelWorkflow = 'inventory' | 'location' | 'receiving' | 'shipping_manifest';
export type BarcodeType = 'CODE128' | 'QR';

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
  barcodeText: string;
  barcodeType: BarcodeType;
  identifierTitle: string;
  mainTitle: string;
  detailBlock: string;
  destinationTitle: string;
  destinationName: string;
  contactLine: string;
  addressLine1: string;
  addressLine2: string;
  cityStateZip: string;
  labelDate: string;
  denaliLogo: string;
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
  date?: string | null;
};

type ReceivingLabelInput = InventoryLabelInput & {
  reference?: string | null;
  po?: string | null;
  tracking?: string | null;
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
  po?: string | null;
  tracking?: string | null;
  date?: string | null;
  destinationName?: string | null;
  destinationAddress?: string | null;
  contactLine?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  cityStateZip?: string | null;
};

const DENALI_LOGO_SRC = '/denali-logo.png';
const DEFAULT_BARCODE_TYPE: BarcodeType = 'QR';

const LEGACY_CSV_COLUMNS: Array<keyof LabelPayload> = [
  'workflow',
  'partNumber',
  'itemId',
  'description',
  'quantity',
  'locationBin',
  'reference',
  'date',
  'barcodePayload',
  'barcodeText',
  'barcodeType',
];

const OPERATIONAL_CSV_COLUMNS: Array<keyof LabelPayload> = [
  'identifierTitle',
  'mainTitle',
  'detailBlock',
  'destinationTitle',
  'destinationName',
  'contactLine',
  'addressLine1',
  'addressLine2',
  'cityStateZip',
  'labelDate',
  'denaliLogo',
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

function cleanHumanLabelValue(value: string | number | null | undefined) {
  const text = clean(value);
  if (/^SCCT\|/i.test(text)) return '';
  if (/^workflow=/i.test(text)) return '';
  if (/^type=/i.test(text)) return '';
  return text;
}

function detailBlock(input: {
  reference?: string | number | null;
  po?: string | number | null;
  tracking?: string | number | null;
  date?: string | number | null;
}) {
  const reference = cleanHumanLabelValue(input.reference);
  const po = cleanHumanLabelValue(input.po);
  const tracking = cleanHumanLabelValue(input.tracking);
  const date = cleanHumanLabelValue(input.date);

  return [
    reference ? `REF: ${reference}` : '',
    po ? `PO: ${po}` : '',
    tracking ? `Tracking #: ${tracking}` : '',
    date ? `DATE: ${date}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function cleanDestinationName(value: string | null | undefined) {
  return cleanHumanLabelValue(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0] || '';
}

function splitAddressLines(address?: string | null) {
  const lines = clean(address)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    addressLine1: lines[0] || '',
    addressLine2: lines.length > 2 ? lines.slice(1, -1).join(' ') : lines[1] || '',
    cityStateZip: lines.length > 2 ? lines[lines.length - 1] : '',
  };
}

function barcodePayload(
  type: LabelWorkflow,
  values: Record<string, string>,
  options: { includeEmpty?: boolean } = {}
) {
  const pairs = Object.entries(values)
    .filter(([, value]) => options.includeEmpty || value)
    .map(([key, value]) => `${key}=${value.replaceAll('|', '/')}`);

  return ['SCCT', `type=${type}`, ...pairs].join('|');
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function filenameSafe(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'label-data';
}

export type SimplePtouchLabelRow = {
  identifier: string;
  part_number: string;
  description: string;
  qty: string;
  location: string;
  reference: string;
};

export function buildInventoryItemLabelPayload(input: InventoryLabelInput): LabelPayload {
  const partNumber = clean(input.partNumber);
  const itemId = clean(input.itemId);
  const description = clean(input.description);
  const quantity = clean(input.quantity);
  const date = cleanDate(input.date);
  const reference = clean(input.reference);
  const po = clean(input.po);
  const tracking = clean(input.tracking);
  const location = clean(input.location);
  const binLocation = clean(input.binLocation);
  const labelLocation = locationBin(location, binLocation);
  const barcodeText = itemId || partNumber || labelLocation;

  return {
    labelTitle: 'IDENTIFIER',
    workflow: 'inventory',
    partNumber,
    itemId,
    description,
    quantity,
    locationBin: labelLocation,
    reference,
    date,
    barcodePayload: barcodePayload(
      'inventory',
      {
        item_id: itemId,
        part_number: partNumber,
        location,
        bin: binLocation,
      },
      { includeEmpty: true }
    ),
    barcodeText,
    barcodeType: DEFAULT_BARCODE_TYPE,
    identifierTitle: 'IDENTIFIER',
    mainTitle: partNumber || description || itemId,
    detailBlock: detailBlock({ reference, po, tracking, date }),
    destinationTitle: 'DESTINATION',
    destinationName: cleanDestinationName(labelLocation),
    contactLine: '',
    addressLine1: '',
    addressLine2: '',
    cityStateZip: '',
    labelDate: date,
    denaliLogo: DENALI_LOGO_SRC,
  };
}

export function buildLocationLabelPayload(input: LocationLabelInput): LabelPayload {
  const location = clean(input.location);
  const binLocation = clean(input.binLocation);
  const date = cleanDate(input.date);
  const labelLocation = locationBin(location, binLocation);

  return {
    labelTitle: 'LOCATION',
    workflow: 'location',
    partNumber: '',
    itemId: '',
    description: binLocation ? `Bin ${binLocation}` : '',
    quantity: '',
    locationBin: labelLocation,
    reference: '',
    date,
    barcodePayload: barcodePayload(
      'location',
      {
        location,
        bin: binLocation,
      },
      { includeEmpty: true }
    ),
    barcodeText: labelLocation,
    barcodeType: DEFAULT_BARCODE_TYPE,
    identifierTitle: 'LOCATION',
    mainTitle: location || labelLocation,
    detailBlock: binLocation ? `BIN: ${binLocation}` : '',
    destinationTitle: binLocation ? 'BIN LOCATION' : 'SITE / LOCATION',
    destinationName: cleanDestinationName(labelLocation),
    contactLine: '',
    addressLine1: '',
    addressLine2: '',
    cityStateZip: '',
    labelDate: date,
    denaliLogo: DENALI_LOGO_SRC,
  };
}

export function buildReceivingLabelPayload(input: ReceivingLabelInput): LabelPayload {
  const partNumber = clean(input.partNumber);
  const itemId = clean(input.itemId);
  const description = clean(input.description);
  const quantity = clean(input.quantity);
  const reference = clean(input.reference);
  const po = clean(input.po);
  const tracking = clean(input.tracking);
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
    barcodeText: itemId || partNumber || reference,
    barcodeType: DEFAULT_BARCODE_TYPE,
    identifierTitle: 'IDENTIFIER',
    mainTitle: partNumber || description || itemId,
    detailBlock: detailBlock({ reference, po, tracking, date }),
    destinationTitle: 'DESTINATION',
    destinationName: cleanDestinationName(labelLocation),
    contactLine: '',
    addressLine1: '',
    addressLine2: '',
    cityStateZip: '',
    labelDate: date,
    denaliLogo: DENALI_LOGO_SRC,
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
  const po = clean(input.po);
  const tracking = clean(input.tracking);
  const date = cleanDate(input.date);
  const labelLocation = clean(input.location);
  const manifestNumber = clean(input.manifestNumber);
  const stopId = clean(input.stopId);
  const addressParts = splitAddressLines(input.destinationAddress);
  const addressLine1 = clean(input.addressLine1) || addressParts.addressLine1;
  const addressLine2 = clean(input.addressLine2) || addressParts.addressLine2;
  const cityStateZip = clean(input.cityStateZip) || addressParts.cityStateZip;

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
    barcodeText: stopId || manifestNumber || itemId || partNumber,
    barcodeType: DEFAULT_BARCODE_TYPE,
    identifierTitle: 'IDENTIFIER',
    mainTitle: partNumber || description || itemId || manifestNumber,
    detailBlock: detailBlock({ reference, po, tracking, date }),
    destinationTitle: 'DESTINATION',
    destinationName: cleanDestinationName(input.destinationName || labelLocation),
    contactLine: clean(input.contactLine),
    addressLine1,
    addressLine2,
    cityStateZip,
    labelDate: date,
    denaliLogo: DENALI_LOGO_SRC,
  };
}

export function labelPayloadsToCsv(payloads: LabelPayload[]) {
  const columns: Array<keyof LabelPayload> = payloads.some((payload) => payload.labelTitle)
    ? ['labelTitle', ...LEGACY_CSV_COLUMNS, ...OPERATIONAL_CSV_COLUMNS]
    : [...LEGACY_CSV_COLUMNS, ...OPERATIONAL_CSV_COLUMNS];
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

export function simplePtouchRowsToCsv(rows: SimplePtouchLabelRow[]) {
  const columns: Array<keyof SimplePtouchLabelRow> = [
    'identifier',
    'part_number',
    'description',
    'qty',
    'location',
    'reference',
  ];
  const header = columns.join(',');
  const data = rows.map((row) => columns.map((column) => csvEscape(String(row[column] ?? ''))).join(','));
  return [header, ...data].join('\r\n');
}

export function downloadSimplePtouchCsv(rows: SimplePtouchLabelRow[]) {
  if (typeof window === 'undefined') return;

  const csv = simplePtouchRowsToCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'ptouch-label-export.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
