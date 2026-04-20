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
import type { ReceivingImportField, ReceivingImportInput } from './types';

export type ReceivingMatch = {
  match_type: 'item_id' | 'part_number';
  target_item_id: string;
  target_part_number: string | null;
  target_description: string | null;
};

export const RECEIVING_FIELD_ALIASES: HeaderAliasMap<ReceivingImportField> = {
  item_id: ['item id', 'item_id', 'item', 'inventory id', 'inventory_id', 'sku'],
  part_number: ['part number', 'part_number', 'part no', 'part #', 'pn', 'mpn'],
  description: ['description', 'item description', 'part description', 'material description'],
  quantity: [
    'quantity',
    'qty',
    'received quantity',
    'received qty',
    'receipt quantity',
    'receipt qty',
    'qty received',
  ],
  reference: ['reference', 'ref', 'po', 'po number', 'purchase order', 'tracking', 'rma'],
  performed_by: ['performed by', 'received by', 'receiver', 'user', 'name', 'team'],
  notes: ['notes', 'note', 'comments', 'comment', 'receiving notes'],
};

const RECEIVING_HEADER_LOOKUP = buildHeaderLookup(RECEIVING_FIELD_ALIASES);

export function emptyReceivingImportRow(sourceRowNumber: number): ReceivingImportInput {
  return {
    source_row_number: sourceRowNumber,
    item_id: '',
    part_number: '',
    description: '',
    quantity: null,
    reference: '',
    performed_by: '',
    notes: '',
    is_supply: false,
    invalid_reasons: [],
  };
}

export function cleanReceivingText(value: string | null | undefined) {
  return cleanCell(value);
}

function parseReceivingQuantity(value: string) {
  const text = cleanCell(value);
  if (!text) return { value: null, reason: '' };

  const numeric = Number(text.replace(/,/g, ''));
  if (!Number.isFinite(numeric)) {
    return { value: null, reason: 'Quantity must be numeric.' };
  }

  if (numeric <= 0) {
    return { value: null, reason: 'Quantity must be greater than 0.' };
  }

  return { value: numeric, reason: '' };
}

export function parseReceivingRows(rows: string[][]) {
  const header = findBestHeaderRow<ReceivingImportField>({
    rows,
    lookup: RECEIVING_HEADER_LOOKUP,
    isCandidate: (fields) =>
      fields.has('quantity') &&
      (fields.has('item_id') || fields.has('part_number') || fields.has('description')),
    score: (fields) =>
      fields.size +
      (fields.has('item_id') ? 4 : 0) +
      (fields.has('part_number') ? 3 : 0) +
      (fields.has('quantity') ? 3 : 0) +
      (fields.has('reference') ? 1 : 0),
  });

  if (!header) return [];

  return rows.slice(header.headerIndex + 1).map((cells, index) => {
    const sourceRowNumber = header.headerIndex + index + 2;
    const mapped = mapCellsByHeader(cells, header);
    const row = emptyReceivingImportRow(sourceRowNumber);

    Object.entries(mapped).forEach(([field, rawValue]) => {
      const key = field as ReceivingImportField;
      const value = cleanCell(rawValue);

      if (key === 'quantity') {
        const parsed = parseReceivingQuantity(value);
        row.quantity = parsed.value;
        if (parsed.reason) row.invalid_reasons?.push(parsed.reason);
      } else {
        row[key] = value;
      }
    });

    return row;
  });
}

export function isBlankReceivingRow(input: ReceivingImportInput) {
  return (
    !cleanReceivingText(input.item_id) &&
    !cleanReceivingText(input.part_number) &&
    !cleanReceivingText(input.description) &&
    !cleanReceivingText(input.reference) &&
    !cleanReceivingText(input.performed_by) &&
    !cleanReceivingText(input.notes) &&
    input.quantity === null &&
    !input.invalid_reasons?.length
  );
}

export function getReceivingIdentity(input: ReceivingImportInput) {
  return cleanReceivingText(input.item_id) || cleanReceivingText(input.part_number);
}

export function validateReceivingUsability(input: ReceivingImportInput) {
  if (input.invalid_reasons?.length) {
    return input.invalid_reasons.join(' ');
  }

  if (input.quantity === null || !Number.isFinite(Number(input.quantity)) || Number(input.quantity) <= 0) {
    return 'Quantity must be greater than 0.';
  }

  if (!getReceivingIdentity(input)) {
    return 'Needs item ID or part number. Description alone is not enough for receiving.';
  }

  return '';
}

export function enrichReceivingRow(
  input: ReceivingImportInput,
  match?: ReceivingMatch
): ReceivingImportInput {
  if (!match) {
    return {
      ...input,
      match_type: 'unresolved',
      target_item_id: '',
      target_part_number: null,
      target_description: null,
    };
  }

  return {
    ...input,
    match_type: match.match_type,
    target_item_id: match.target_item_id,
    target_part_number: match.target_part_number,
    target_description: match.target_description,
  };
}

export function isPostableReceivingPreviewRow(row: ImportPreviewRow<ReceivingImportInput>) {
  return row.status === 'update' || row.status === 'insert';
}

export function buildReceivingPreview({
  rows,
  findMatch,
}: {
  rows: ReceivingImportInput[];
  findMatch: (row: ReceivingImportInput) => ReceivingMatch | undefined;
}): ImportPreview<ReceivingImportInput> {
  const summary: ImportSummary = emptyImportSummary();
  summary.totalRows = rows.length;

  const previewRows: ImportPreviewRow<ReceivingImportInput>[] = [];
  const skipReasons: ImportSkipReason[] = [];

  rows.forEach((row, index) => {
    const rowNumber = row.source_row_number ?? index + 2;

    if (isBlankReceivingRow(row)) {
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

    const invalidReason = validateReceivingUsability(row);
    if (invalidReason) {
      summary.skippedInvalid += 1;
      skipReasons.push({ rowNumber, reason: invalidReason });
      previewRows.push({
        rowNumber,
        status: 'skipped',
        record: row,
        identity: getReceivingIdentity(row),
        reasons: [invalidReason],
      });
      return;
    }

    const match = findMatch(row);
    const enriched = enrichReceivingRow(row, match);

    if (match?.match_type === 'item_id') {
      summary.updates += 1;
      previewRows.push({
        rowNumber,
        status: 'update',
        record: enriched,
        identity: match.target_item_id,
        reasons: ['Matched existing inventory by item ID.'],
      });
      return;
    }

    if (match?.match_type === 'part_number') {
      summary.newRecords += 1;
      previewRows.push({
        rowNumber,
        status: 'insert',
        record: enriched,
        identity: match.target_item_id,
        reasons: ['Matched existing inventory by part number.'],
      });
      return;
    }

    summary.incompleteUsable += 1;
    previewRows.push({
      rowNumber,
      status: 'incomplete',
      record: enriched,
      identity: getReceivingIdentity(row),
      reasons: ['No existing inventory item matched item ID or part number.'],
    });
  });

  return {
    summary,
    rows: previewRows,
    skipReasons,
  };
}
