import type {
  ImportPreview,
  ImportPreviewRow,
  ImportSummary,
} from '@/lib/import-workflow/types';
import type { InventoryImportField, InventoryImportInput } from './types';

type FieldMapping<TField extends string> = {
  targetField: TField;
  sourceHeader: string | null;
  required: boolean;
};

type HeaderAliasMap<TField extends string> = Record<TField, string[]>;

type NormalizedRow = Record<string, unknown>;

export const INVENTORY_FIELD_ALIASES: HeaderAliasMap<InventoryImportField> = {
  item_id: ['item id', 'item_id', 'item', 'inventory id', 'inventory_id', 'sku'],
  part_number: ['part number', 'part_number', 'part no', 'part #', 'pn', 'mpn'],
  description: ['description', 'item description', 'part description', 'material description'],
  category: ['category', 'type', 'commodity', 'class'],
  location: ['location', 'site', 'warehouse', 'stock location'],
  site: ['site', 'location', 'warehouse', 'building', 'facility'],
  bin_location: ['bin', 'bin location', 'bin_location', 'rack', 'shelf', 'storage bin'],
  qty_on_hand: ['qty on hand', 'qty_on_hand', 'quantity', 'qty', 'on hand', 'stock'],
  reorder_point: ['reorder point', 'reorder_point', 'rop', 'minimum', 'min qty'],
};

const REQUIRED_FIELDS: InventoryImportField[] = ['item_id', 'description'];

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildHeaderIndex(headers: string[]) {
  const index = new Map<string, number>();

  headers.forEach((header, position) => {
    index.set(normalizeHeader(header), position);
  });

  return index;
}

function getCellValue(row: NormalizedRow, sourceHeader: string) {
  return row[sourceHeader] ?? '';
}

function parseImportNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;

  const parsed = Number(String(value).replace(/,/g, '').trim());

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSite(value: string) {
  const clean = value.trim().toUpperCase();

  if (clean === 'WH') return 'WH/A13';
  if (clean === 'A13') return 'WH/A13';
  if (clean === 'WH/A13') return 'WH/A13';

  return clean || 'SEA991';
}

function identityForRow(row: InventoryImportInput) {
  return (
    cleanInventoryText(row.item_id) ||
    cleanInventoryText(row.part_number) ||
    `Row ${row.source_row_number ?? '-'}`
  );
}

export function cleanInventoryText(value: unknown) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/\u00a0/g, ' ')
    .trim();
}

export function isBlankInventoryRow(row: Partial<InventoryImportInput>) {
  return ![
    row.item_id,
    row.part_number,
    row.description,
    row.category,
    row.location,
    row.site,
    row.bin_location,
    row.qty_on_hand,
    row.reorder_point,
  ].some((value) => cleanInventoryText(value).length > 0);
}

export function buildInventoryFieldMapping(headers: string[]): FieldMapping<InventoryImportField>[] {
  const headerIndex = buildHeaderIndex(headers);

  return (Object.keys(INVENTORY_FIELD_ALIASES) as InventoryImportField[]).map((field) => {
    const aliases = INVENTORY_FIELD_ALIASES[field];
    const matchedHeader = aliases.find((alias) => headerIndex.has(normalizeHeader(alias)));
    const sourceHeader = matchedHeader
      ? headers[headerIndex.get(normalizeHeader(matchedHeader)) as number]
      : null;

    return {
      targetField: field,
      sourceHeader,
      required: REQUIRED_FIELDS.includes(field),
    };
  });
}

export function toInventoryImportInput(
  row: NormalizedRow,
  mapping: FieldMapping<InventoryImportField>[],
  sourceRowNumber: number
): InventoryImportInput {
  const getValue = (field: InventoryImportField) => {
    const mapped = mapping.find((item) => item.targetField === field);
    return mapped?.sourceHeader ? getCellValue(row, mapped.sourceHeader) : '';
  };

  const location = cleanInventoryText(getValue('location'));
  const site = normalizeSite(cleanInventoryText(getValue('site')) || location);

  return {
    item_id: cleanInventoryText(getValue('item_id')),
    part_number: cleanInventoryText(getValue('part_number')),
    description: cleanInventoryText(getValue('description')),
    category: cleanInventoryText(getValue('category')),
    location: site,
    site,
    bin_location: cleanInventoryText(getValue('bin_location')),
    qty_on_hand: parseImportNumber(getValue('qty_on_hand')),
    reorder_point: parseImportNumber(getValue('reorder_point')),
    is_supply: false,
    source_row_number: sourceRowNumber,
    invalid_reasons: [],
  };
}

export function validateInventoryUsability(row: InventoryImportInput) {
  const reasons: string[] = [];

  if (!cleanInventoryText(row.item_id) && !cleanInventoryText(row.part_number)) {
    reasons.push('Item ID or Part Number is required.');
  }

  if (!cleanInventoryText(row.description)) {
    reasons.push('Description is required.');
  }

  if ((row.qty_on_hand ?? 0) < 0) {
    reasons.push('Quantity cannot be negative.');
  }

  if ((row.reorder_point ?? 0) < 0) {
    reasons.push('Reorder point cannot be negative.');
  }

  return reasons.join(' ');
}

export function toInventoryPayload(row: InventoryImportInput) {
  const itemId =
    cleanInventoryText(row.item_id) ||
    cleanInventoryText(row.part_number) ||
    `INV-${Date.now()}`;

  const site = normalizeSite(row.site || row.location);

  return {
    item_id: itemId,
    part_number: cleanInventoryText(row.part_number) || itemId,
    description: cleanInventoryText(row.description) || cleanInventoryText(row.part_number) || itemId,
    category: cleanInventoryText(row.category) || null,
    location: site,
    site,
    bin_location: cleanInventoryText(row.bin_location) || null,
    qty_on_hand: row.qty_on_hand ?? 0,
    reorder_point: row.reorder_point ?? 0,
  };
}

function makePreviewRow(
  rowNumber: number,
  status: string,
  reason: string,
  record: InventoryImportInput
): ImportPreviewRow<InventoryImportInput> {
  return {
    rowNumber,
    status,
    identity: identityForRow(record),
    reasons: reason ? [reason] : [],
    reason,
    record,
  } as unknown as ImportPreviewRow<InventoryImportInput>;
}

export function buildInventoryPreview({
  rows,
  existingItemIds,
  existingPartNumbers,
}: {
  rows: InventoryImportInput[];
  existingItemIds: Set<string>;
  existingPartNumbers: Set<string>;
}): ImportPreview<InventoryImportInput> {
  const previewRows: ImportPreviewRow<InventoryImportInput>[] = [];
  const skipReasons: Array<{ rowNumber: number; reason: string }> = [];

  let newRecords = 0;
  let updates = 0;
  let skippedBlank = 0;
  let skippedInvalid = 0;
  let incompleteUsable = 0;

  rows.forEach((row, index) => {
    const rowNumber = row.source_row_number ?? index + 2;

    if (isBlankInventoryRow(row)) {
      skippedBlank += 1;
      skipReasons.push({ rowNumber, reason: 'Blank row.' });
      previewRows.push(makePreviewRow(rowNumber, 'skipped', 'Blank row.', row));
      return;
    }

    const invalidReason = validateInventoryUsability(row);

    if (invalidReason) {
      skippedInvalid += 1;
      skipReasons.push({ rowNumber, reason: invalidReason });
      previewRows.push(makePreviewRow(rowNumber, 'skipped', invalidReason, row));
      return;
    }

    const itemId = cleanInventoryText(row.item_id);
    const partNumber = cleanInventoryText(row.part_number);
    const exists =
      (itemId && existingItemIds.has(itemId)) ||
      (partNumber && existingPartNumbers.has(partNumber));

    if (!cleanInventoryText(row.description) || row.qty_on_hand === null) {
      incompleteUsable += 1;
    }

    if (exists) {
      updates += 1;
      previewRows.push(
        makePreviewRow(rowNumber, 'update', 'Existing inventory record will be updated.', row)
      );
    } else {
      newRecords += 1;
      previewRows.push(
        makePreviewRow(rowNumber, 'new', 'New inventory record will be created.', row)
      );
    }
  });

  const summary: ImportSummary = {
    totalRows: rows.length,
    newRecords,
    updates,
    skippedBlank,
    skippedInvalid,
    incompleteUsable,
  };

  return {
    rows: previewRows,
    summary,
    skipReasons,
  };
}