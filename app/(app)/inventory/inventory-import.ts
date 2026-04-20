import {
  buildHeaderLookup,
  cleanCell,
  findBestHeaderRow,
  mapCellsByHeader,
  type HeaderAliasMap,
} from '@/lib/import-workflow/headers';
import { emptyImportSummary } from '@/lib/import-workflow/summary';
import type {
  ImportPreview,
  ImportPreviewRow,
  ImportSkipReason,
  ImportSummary,
} from '@/lib/import-workflow/types';
import type { InventoryImportField, InventoryImportInput } from './types';

export const INVENTORY_FIELD_ALIASES: HeaderAliasMap<InventoryImportField> = {
  item_id: ['item id', 'item_id', 'item', 'inventory id', 'inventory_id', 'sku'],
  part_number: ['part number', 'part_number', 'part no', 'part #', 'pn', 'mpn'],
  description: ['description', 'item description', 'part description', 'material description'],
  category: ['category', 'type', 'item category', 'inventory category'],
  location: ['location', 'bin', 'warehouse', 'stock location', 'storage location'],
  qty_on_hand: ['qty on hand', 'qty_on_hand', 'quantity on hand', 'on hand', 'stock', 'qty'],
  reorder_point: ['reorder point', 'reorder_point', 'rop', 'minimum stock', 'min stock'],
};

const INVENTORY_HEADER_LOOKUP = buildHeaderLookup(INVENTORY_FIELD_ALIASES);

export function emptyInventoryImportRow(sourceRowNumber: number): InventoryImportInput {
  return {
    source_row_number: sourceRowNumber,
    item_id: '',
    part_number: '',
    description: '',
    category: '',
    location: '',
    qty_on_hand: null,
    reorder_point: null,
    is_supply: false,
    invalid_reasons: [],
  };
}

export function cleanInventoryText(value: string | null | undefined) {
  return cleanCell(value);
}

export function normalizeInventoryNumber(value: number | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function parseInventoryNumber(value: string, label: string) {
  const text = cleanCell(value);
  if (!text) return { value: null, reason: '' };

  const numeric = Number(text.replace(/,/g, ''));
  if (!Number.isFinite(numeric)) {
    return { value: null, reason: `${label} must be numeric.` };
  }

  if (numeric < 0) {
    return { value: null, reason: `${label} cannot be negative.` };
  }

  return { value: numeric, reason: '' };
}

export function parseInventoryRows(rows: string[][]) {
  const header = findBestHeaderRow<InventoryImportField>({
    rows,
    lookup: INVENTORY_HEADER_LOOKUP,
    isCandidate: (fields) =>
      fields.has('item_id') || fields.has('part_number') || fields.has('description'),
    score: (fields) =>
      fields.size +
      (fields.has('item_id') ? 3 : 0) +
      (fields.has('part_number') ? 2 : 0) +
      (fields.has('description') ? 1 : 0),
  });

  if (!header) return [];

  return rows.slice(header.headerIndex + 1).map((cells, index) => {
    const sourceRowNumber = header.headerIndex + index + 2;
    const mapped = mapCellsByHeader(cells, header);
    const row = emptyInventoryImportRow(sourceRowNumber);

    Object.entries(mapped).forEach(([field, rawValue]) => {
      const key = field as InventoryImportField;
      const value = cleanCell(rawValue);

      if (key === 'qty_on_hand') {
        const parsed = parseInventoryNumber(value, 'Qty on hand');
        row.qty_on_hand = parsed.value;
        if (parsed.reason) row.invalid_reasons?.push(parsed.reason);
      } else if (key === 'reorder_point') {
        const parsed = parseInventoryNumber(value, 'Reorder point');
        row.reorder_point = parsed.value;
        if (parsed.reason) row.invalid_reasons?.push(parsed.reason);
      } else {
        row[key] = value;
      }
    });

    return row;
  });
}

export function isBlankInventoryRow(input: InventoryImportInput) {
  return (
    !cleanInventoryText(input.item_id) &&
    !cleanInventoryText(input.part_number) &&
    !cleanInventoryText(input.description) &&
    !cleanInventoryText(input.category) &&
    !cleanInventoryText(input.location) &&
    input.qty_on_hand === null &&
    input.reorder_point === null
  );
}

export function getInventoryIdentity(input: InventoryImportInput) {
  return (
    cleanInventoryText(input.item_id) ||
    cleanInventoryText(input.part_number) ||
    cleanInventoryText(input.description)
  );
}

export function validateInventoryUsability(input: InventoryImportInput) {
  if (!getInventoryIdentity(input)) {
    return 'Needs item ID, part number, or description.';
  }

  if (input.invalid_reasons?.length) {
    return input.invalid_reasons.join(' ');
  }

  return '';
}

export function getInventoryCompletenessReasons(input: InventoryImportInput) {
  const reasons: string[] = [];

  if (!cleanInventoryText(input.item_id)) reasons.push('Missing item ID.');
  if (!cleanInventoryText(input.part_number)) reasons.push('Missing part number.');
  if (!cleanInventoryText(input.description)) reasons.push('Missing description.');

  return reasons;
}

export function buildGeneratedItemId(input: InventoryImportInput) {
  const itemId = cleanInventoryText(input.item_id);
  if (itemId) return itemId;

  const partNumber = cleanInventoryText(input.part_number);
  if (partNumber) return `IMP-PART-${slugify(partNumber).slice(0, 48)}`;

  const description = cleanInventoryText(input.description);
  if (description) {
    const randomSuffix =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);

    return `IMP-DESC-${slugify(description).slice(0, 36)}-${randomSuffix}`;
  }

  return '';
}

export function toInventoryPayload(input: InventoryImportInput) {
  const generatedItemId = buildGeneratedItemId(input);
  const partNumber = cleanInventoryText(input.part_number);

  return {
    item_id: generatedItemId,
    part_number: partNumber || `PENDING-${generatedItemId.slice(0, 56)}`,
    description: cleanInventoryText(input.description) || 'Pending description',
    category: cleanInventoryText(input.category) || 'Uncategorized',
    location: cleanInventoryText(input.location) || 'Unassigned',
    qty_on_hand: normalizeInventoryNumber(input.qty_on_hand),
    reorder_point: normalizeInventoryNumber(input.reorder_point),
  };
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
  const summary: ImportSummary = emptyImportSummary();
  summary.totalRows = rows.length;

  const previewRows: ImportPreviewRow<InventoryImportInput>[] = [];
  const skipReasons: ImportSkipReason[] = [];

  rows.forEach((row, index) => {
    const rowNumber = row.source_row_number ?? index + 2;

    if (isBlankInventoryRow(row)) {
      summary.skippedBlank += 1;
      previewRows.push({
        rowNumber,
        status: 'skipped',
        record: row,
        identity: '',
        reasons: ['Blank row.'],
      });
      return;
    }

    const invalidReason = validateInventoryUsability(row);
    if (invalidReason) {
      summary.skippedInvalid += 1;
      skipReasons.push({ rowNumber, reason: invalidReason });
      previewRows.push({
        rowNumber,
        status: 'skipped',
        record: row,
        identity: getInventoryIdentity(row),
        reasons: [invalidReason],
      });
      return;
    }

    const itemId = cleanInventoryText(row.item_id);
    const partNumber = cleanInventoryText(row.part_number);
    const matchesExisting =
      (itemId && existingItemIds.has(itemId)) || (partNumber && existingPartNumbers.has(partNumber));

    if (matchesExisting) {
      summary.updates += 1;
      previewRows.push({
        rowNumber,
        status: 'update',
        record: row,
        identity: itemId || partNumber,
        reasons: [],
      });
      return;
    }

    const completenessReasons = getInventoryCompletenessReasons(row);
    if (completenessReasons.length) {
      summary.incompleteUsable += 1;
      previewRows.push({
        rowNumber,
        status: 'incomplete',
        record: row,
        identity: getInventoryIdentity(row),
        reasons: completenessReasons,
      });
      return;
    }

    summary.newRecords += 1;
    previewRows.push({
      rowNumber,
      status: 'insert',
      record: row,
      identity: itemId || partNumber,
      reasons: [],
    });
  });

  return {
    summary,
    rows: previewRows,
    skipReasons,
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ROW';
}
