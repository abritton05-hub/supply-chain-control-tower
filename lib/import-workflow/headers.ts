import type { HeaderMatch } from './types';

export type HeaderAliasMap<TField extends string> = Record<TField, string[]>;

export function cleanCell(value: string | number | boolean | null | undefined) {
  return String(value ?? '').trim();
}

export function normalizeHeader(value: string) {
  return cleanCell(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isBlankCells(cells: string[]) {
  return cells.every((cell) => !cleanCell(cell));
}

export function buildHeaderLookup<TField extends string>(aliases: HeaderAliasMap<TField>) {
  const lookup = new Map<string, TField>();

  (Object.entries(aliases) as [TField, string[]][]).forEach(([field, values]) => {
    values.forEach((value) => {
      const key = normalizeHeader(value);
      if (key) lookup.set(key, field);
    });
  });

  return lookup;
}

export function findField<TField extends string>(
  value: string,
  lookup: Map<string, TField>
) {
  return lookup.get(normalizeHeader(value));
}

export function findBestHeaderRow<TField extends string>({
  rows,
  lookup,
  isCandidate,
  score,
  inferField,
}: {
  rows: string[][];
  lookup: Map<string, TField>;
  isCandidate: (fields: Set<TField>, columnToField: Map<number, TField>) => boolean;
  score?: (fields: Set<TField>, columnToField: Map<number, TField>) => number;
  inferField?: (cell: string, columnIndex: number, fields: Set<TField>) => TField | undefined;
}): HeaderMatch<TField> | null {
  let bestMatch: HeaderMatch<TField> | null = null;
  let bestScore = 0;

  rows.forEach((cells, rowIndex) => {
    if (isBlankCells(cells)) return;

    const columnToField = new Map<number, TField>();
    const fields = new Set<TField>();

    cells.forEach((cell, columnIndex) => {
      const field = findField(cell, lookup) ?? inferField?.(cell, columnIndex, fields);
      if (!field || fields.has(field)) return;

      fields.add(field);
      columnToField.set(columnIndex, field);
    });

    if (!isCandidate(fields, columnToField)) return;

    const currentScore = score ? score(fields, columnToField) : fields.size;
    if (currentScore > bestScore) {
      bestMatch = { headerIndex: rowIndex, columnToField, fields };
      bestScore = currentScore;
    }
  });

  return bestMatch;
}

export function mapCellsByHeader<TField extends string>(
  cells: string[],
  header: HeaderMatch<TField>
) {
  const mapped = {} as Record<TField, string>;

  header.columnToField.forEach((field, columnIndex) => {
    mapped[field] = cleanCell(cells[columnIndex]);
  });

  return mapped;
}
