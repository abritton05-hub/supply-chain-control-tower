import {
  buildHeaderLookup,
  cleanCell,
  findBestHeaderRow,
  isBlankCells,
  mapCellsByHeader,
  type HeaderAliasMap,
} from '@/lib/import-workflow/headers';
import { parseNullableBoolean, parseNullableNumber } from '@/lib/import-workflow/parsing';
import { emptyImportSummary } from '@/lib/import-workflow/summary';
import type {
  ImportPreview,
  ImportPreviewRow,
  ImportSkipReason,
  ImportSummary,
} from '@/lib/import-workflow/types';
import type { KitLineField, KitLineImportInput } from './line-item-types';

export const KIT_LINE_FIELD_ALIASES: HeaderAliasMap<KitLineField> = {
  kit_name: ['', 'kit', 'kit name', 'kit_name', 'rack kit', 'build kit', 'first unnamed column'],
  part_number: ['part number', 'part_number', 'part no', 'part #', 'pn', 'item', 'item number'],
  description: ['description', 'part description', 'item description', 'material description'],
  rack_type: ['rack type', 'rack_type', 'rack', 'rack category'],
  vendor: ['vendor', 'supplier'],
  qty_required: ['qty required', 'qty_required', 'quantity required', 'required', 'qty req'],
  qty_on_hand: ['qty on hand', 'qty_on_hand', 'quantity on hand', 'on hand', 'stock'],
  qty_needed: ['qty needed', 'qty_needed', 'quantity needed', 'needed', 'shortage'],
  included_in_first_5_kits: [
    'included in first 5 kits',
    'included_in_first_5_kits',
    'first 5 kits',
    'included',
  ],
  status: ['status', 'line status'],
  eta_if_not_included: [
    'eta / if not included',
    'eta if not included',
    'eta',
    'if not included',
    'eta_if_not_included',
  ],
  order_reference: [
    'order reference',
    'order_reference',
    'po',
    'po number',
    'purchase order',
    'reference',
    'sales number',
    'ticket number',
    'ship number',
  ],
  notes: ['notes', 'comments', 'remarks'],
  risk: ['risk', 'risk level'],
  ready_to_ship: ['ready to ship', 'ready_to_ship', 'ready'],
  fully_shipped: ['fully shipped', 'fully_shipped', 'shipped'],
  build_status: ['build status', 'build_status', 'build'],
  blocked_reason: ['blocked reason', 'blocked_reason', 'block reason', 'blocker'],
};

const KIT_LINE_HEADER_LOOKUP = buildHeaderLookup(KIT_LINE_FIELD_ALIASES);

export function emptyKitLine(sourceRowNumber: number): KitLineImportInput {
  return {
    source_row_number: sourceRowNumber,
    kit_name: '',
    part_number: '',
    description: '',
    rack_type: '',
    vendor: '',
    qty_required: null,
    qty_on_hand: null,
    qty_needed: null,
    included_in_first_5_kits: null,
    status: '',
    eta_if_not_included: '',
    order_reference: '',
    notes: '',
    risk: '',
    ready_to_ship: null,
    fully_shipped: null,
    build_status: '',
    blocked_reason: '',
  };
}

export function buildKitLineSourceKey(input: KitLineImportInput) {
  return [
    input.kit_name,
    input.part_number || input.description || input.order_reference,
    input.rack_type,
    input.vendor,
    input.order_reference,
  ]
    .map((value) =>
      cleanCell(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    )
    .filter(Boolean)
    .join('|');
}

export function isBlankKitLine(input: KitLineImportInput) {
  const textValues = [
    input.kit_name,
    input.part_number,
    input.description,
    input.rack_type,
    input.vendor,
    input.status,
    input.eta_if_not_included,
    input.order_reference,
    input.notes,
    input.risk,
    input.build_status,
    input.blocked_reason,
  ];

  const numberValues = [input.qty_required, input.qty_on_hand, input.qty_needed];
  const booleanValues = [
    input.included_in_first_5_kits,
    input.ready_to_ship,
    input.fully_shipped,
  ];

  return (
    textValues.every((value) => !cleanCell(value)) &&
    numberValues.every((value) => value === null) &&
    booleanValues.every((value) => value === null)
  );
}

export function getKitLineIdentity(input: KitLineImportInput) {
  const orderReference = cleanCell(input.order_reference);
  const text = [
    cleanCell(input.part_number),
    cleanCell(input.description),
    orderReference,
    cleanCell(input.notes),
  ].join(' ');

  const referenceTokens = text.match(/\b(?:PO[-\s]?\w+|SO[-\s]?\w+|SHIP-\w+|S[A-Z0-9][A-Z0-9-]+|TICKET[-\s]?\w+)\b/i);

  if (cleanCell(input.part_number)) return cleanCell(input.part_number);
  if (cleanCell(input.description)) return cleanCell(input.description);
  if (orderReference) return orderReference;
  if (referenceTokens?.[0]) return referenceTokens[0];
  return '';
}

export function validateKitLineUsability(input: KitLineImportInput) {
  if (!getKitLineIdentity(input)) {
    return 'Needs part number, description, PO/sales/ticket/ship reference, SHIP-* reference, or S-prefixed identifier.';
  }

  if (!buildKitLineSourceKey(input)) {
    return 'Could not build a stable update key for this row.';
  }

  return '';
}

export function getKitLineCompletenessReasons(input: KitLineImportInput) {
  const reasons: string[] = [];

  if (!cleanCell(input.part_number)) reasons.push('Missing part number.');
  if (!cleanCell(input.description)) reasons.push('Missing description.');
  if (input.qty_required === null && input.qty_needed === null) {
    reasons.push('Missing required or needed quantity.');
  }

  return reasons;
}

export function parseKitLineRows(rows: string[][]) {
  const header = findBestHeaderRow<KitLineField>({
    rows,
    lookup: KIT_LINE_HEADER_LOOKUP,
    inferField: (cell, columnIndex, fields) => {
      if (columnIndex === 0 && !cleanCell(cell) && !fields.has('kit_name')) return 'kit_name';
      return undefined;
    },
    isCandidate: (fields) =>
      fields.size >= 4 &&
      (fields.has('part_number') ||
        fields.has('description') ||
        fields.has('qty_required') ||
        fields.has('ready_to_ship') ||
        fields.has('build_status')),
    score: (fields) =>
      fields.size +
      (fields.has('part_number') ? 3 : 0) +
      (fields.has('description') ? 3 : 0) +
      (fields.has('qty_required') ? 1 : 0) +
      (fields.has('order_reference') ? 1 : 0),
  });

  if (!header) return [];

  let currentKitName = '';

  return rows.slice(header.headerIndex + 1).map((cells, index) => {
    const sourceRowNumber = header.headerIndex + index + 2;
    const rowIsBlank = isBlankCells(cells);
    const mapped = mapCellsByHeader(cells, header);
    const line = emptyKitLine(sourceRowNumber);

    Object.entries(mapped).forEach(([field, rawValue]) => {
      const key = field as KitLineField;
      const value = cleanCell(rawValue);

      if (key === 'qty_required' || key === 'qty_on_hand' || key === 'qty_needed') {
        line[key] = parseNullableNumber(value);
      } else if (
        key === 'included_in_first_5_kits' ||
        key === 'ready_to_ship' ||
        key === 'fully_shipped'
      ) {
        line[key] = parseNullableBoolean(value);
      } else {
        line[key] = value;
      }
    });

    if (!line.kit_name && currentKitName && !rowIsBlank) {
      line.kit_name = currentKitName;
    }

    if (line.kit_name && !rowIsBlank) {
      currentKitName = line.kit_name;
    }

    return line;
  });
}

export function buildKitLinePreview(
  rows: KitLineImportInput[],
  existingSourceKeys: Set<string>
): ImportPreview<KitLineImportInput> {
  const summary: ImportSummary = emptyImportSummary();
  summary.totalRows = rows.length;

  const previewRows: ImportPreviewRow<KitLineImportInput>[] = [];
  const skipReasons: ImportSkipReason[] = [];

  rows.forEach((row, index) => {
    const rowNumber = row.source_row_number ?? index + 2;
    const blank = isBlankKitLine(row);

    if (blank) {
      summary.skippedBlank += 1;
      previewRows.push({
        rowNumber,
        status: 'skipped',
        record: row,
        identity: '',
        reasons: ['Blank spacer row.'],
      });
      return;
    }

    const invalidReason = validateKitLineUsability(row);
    if (invalidReason) {
      summary.skippedInvalid += 1;
      skipReasons.push({ rowNumber, reason: invalidReason });
      previewRows.push({
        rowNumber,
        status: 'skipped',
        record: row,
        identity: '',
        reasons: [invalidReason],
      });
      return;
    }

    const sourceKey = buildKitLineSourceKey(row);
    const completenessReasons = getKitLineCompletenessReasons(row);

    if (completenessReasons.length) {
      summary.incompleteUsable += 1;
      previewRows.push({
        rowNumber,
        status: 'incomplete',
        record: row,
        identity: getKitLineIdentity(row),
        reasons: completenessReasons,
      });
      return;
    }

    const exists = existingSourceKeys.has(sourceKey);
    if (exists) {
      summary.updates += 1;
    } else {
      summary.newRecords += 1;
    }

    previewRows.push({
      rowNumber,
      status: exists ? 'update' : 'insert',
      record: row,
      identity: getKitLineIdentity(row),
      reasons: [],
    });
  });

  return {
    summary,
    rows: previewRows,
    skipReasons,
  };
}

export function toKitLinePayload(input: KitLineImportInput) {
  return {
    source_key: buildKitLineSourceKey(input),
    kit_name: cleanCell(input.kit_name) || null,
    part_number: cleanCell(input.part_number) || null,
    description: cleanCell(input.description) || null,
    rack_type: cleanCell(input.rack_type) || null,
    vendor: cleanCell(input.vendor) || null,
    qty_required: input.qty_required,
    qty_on_hand: input.qty_on_hand,
    qty_needed: input.qty_needed,
    included_in_first_5_kits: input.included_in_first_5_kits,
    status: cleanCell(input.status) || null,
    eta_if_not_included: cleanCell(input.eta_if_not_included) || null,
    order_reference: cleanCell(input.order_reference) || null,
    notes: cleanCell(input.notes) || null,
    risk: cleanCell(input.risk) || null,
    ready_to_ship: input.ready_to_ship,
    fully_shipped: input.fully_shipped,
    build_status: cleanCell(input.build_status) || null,
    blocked_reason: cleanCell(input.blocked_reason) || null,
  };
}
