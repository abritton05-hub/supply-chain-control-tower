export type ImportRowStatus = 'insert' | 'update' | 'incomplete' | 'skipped';

export type ImportSummary = {
  totalRows: number;
  newRecords: number;
  updates: number;
  incompleteUsable: number;
  skippedBlank: number;
  skippedInvalid: number;
};

export type ImportSkipReason = {
  rowNumber: number;
  reason: string;
};

export type ImportPreviewRow<TRecord> = {
  rowNumber: number;
  status: ImportRowStatus;
  record: TRecord;
  identity: string;
  reasons: string[];
};

export type ImportPreview<TRecord> = {
  summary: ImportSummary;
  rows: ImportPreviewRow<TRecord>[];
  skipReasons: ImportSkipReason[];
};

export type ImportActionResult<TRecord = never> =
  | { ok: true; message: string; summary?: ImportSummary; preview?: ImportPreview<TRecord> }
  | { ok: false; message: string; summary?: ImportSummary; preview?: ImportPreview<TRecord> };

export type HeaderMatch<TField extends string> = {
  headerIndex: number;
  columnToField: Map<number, TField>;
  fields: Set<TField>;
};
