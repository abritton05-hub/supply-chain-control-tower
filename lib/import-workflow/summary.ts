import type { ImportPreview, ImportSummary } from './types';

export function emptyImportSummary(): ImportSummary {
  return {
    totalRows: 0,
    newRecords: 0,
    updates: 0,
    incompleteUsable: 0,
    skippedBlank: 0,
    skippedInvalid: 0,
  };
}

export function summarizePreview<TRecord>(preview: ImportPreview<TRecord>) {
  const { summary } = preview;

  return [
    `${summary.newRecords} new`,
    `${summary.updates} update${summary.updates === 1 ? '' : 's'}`,
    `${summary.incompleteUsable} incomplete but usable`,
    `${summary.skippedBlank + summary.skippedInvalid} skipped`,
  ].join(', ');
}
