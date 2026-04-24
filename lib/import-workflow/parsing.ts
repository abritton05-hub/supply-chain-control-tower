export function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

export function parseCsvRows(text: string) {
  return text.split(/\r?\n/).map((line) => parseCsvLine(line));
}

export function parseNullableNumber(value: string | number | null | undefined) {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const numeric = Number(text.replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseNullableBoolean(value: string | boolean | null | undefined) {
  if (typeof value === 'boolean') return value;

  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;

  if (['true', 'yes', 'y', '1', 'included', 'ready', 'shipped', 'complete'].includes(normalized)) {
    return true;
  }

  if (
    ['false', 'no', 'n', '0', 'not included', 'not ready', 'not shipped', 'incomplete'].includes(
      normalized
    )
  ) {
    return false;
  }

  return null;
}
