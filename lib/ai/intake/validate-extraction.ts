import type {
  PullRequestExtraction,
  ReceivingExtraction,
  ValidationIssue,
} from './types';

type LookupOptions = {
  validLocations?: string[];
  knownPartNumbers?: string[];
  knownUsers?: string[];
};

function clean(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function normalizeSet(values: string[] | undefined) {
  return new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function positiveNumber(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function lookupWarning(
  issues: ValidationIssue[],
  field: string,
  value: string | null,
  knownValues: Set<string>,
  label: string
) {
  const cleaned = clean(value);
  if (!cleaned || knownValues.size === 0) return;

  if (!knownValues.has(cleaned.toLowerCase())) {
    issues.push({
      field,
      severity: 'warning',
      message: `${label} "${cleaned}" was extracted but does not match current lookup data.`,
    });
  }
}

export function validateReceivingExtraction(
  extraction: ReceivingExtraction,
  lookups: LookupOptions = {}
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const knownLocations = normalizeSet(lookups.validLocations);
  const knownPartNumbers = normalizeSet(lookups.knownPartNumbers);

  if (extraction.line_items.length === 0) {
    issues.push({
      field: 'line_items',
      severity: 'error',
      message: 'Receiving intake needs at least one line item before it can be applied.',
    });
  }

  extraction.line_items.forEach((line, index) => {
    const prefix = `line_items.${index}`;

    if (!clean(line.part_number) && !clean(line.description)) {
      issues.push({
        field: `${prefix}.part_number`,
        severity: 'error',
        message: 'Line item needs a part number or description.',
      });
    }

    if (!positiveNumber(line.qty)) {
      issues.push({
        field: `${prefix}.qty`,
        severity: 'error',
        message: 'Receiving quantity must be a positive number.',
      });
    }

    lookupWarning(issues, `${prefix}.part_number`, line.part_number, knownPartNumbers, 'Part number');
    lookupWarning(issues, `${prefix}.location`, line.location, knownLocations, 'Location');
  });

  return issues;
}

export function validatePullRequestExtraction(
  extraction: PullRequestExtraction,
  lookups: LookupOptions = {}
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const knownLocations = normalizeSet(lookups.validLocations);
  const knownPartNumbers = normalizeSet(lookups.knownPartNumbers);
  const knownUsers = normalizeSet(lookups.knownUsers);

  if (!clean(extraction.header.requestor_name)) {
    issues.push({
      field: 'header.requestor_name',
      severity: 'warning',
      message: 'Requestor is missing. User must select or enter a requestor before submit.',
    });
  }

  if (extraction.line_items.length === 0) {
    issues.push({
      field: 'line_items',
      severity: 'error',
      message: 'Pull request intake needs at least one line item before it can be applied.',
    });
  }

  extraction.line_items.forEach((line, index) => {
    const prefix = `line_items.${index}`;

    if (!clean(line.part_number) && !clean(line.description)) {
      issues.push({
        field: `${prefix}.part_number`,
        severity: 'error',
        message: 'Line item needs a part number or description.',
      });
    }

    if (!positiveNumber(line.qty_requested)) {
      issues.push({
        field: `${prefix}.qty_requested`,
        severity: 'error',
        message: 'Requested quantity must be a positive number.',
      });
    }

    lookupWarning(issues, `${prefix}.part_number`, line.part_number, knownPartNumbers, 'Part number');
  });

  lookupWarning(
    issues,
    'header.requestor_name',
    extraction.header.requestor_name,
    knownUsers,
    'Requestor'
  );
  lookupWarning(issues, 'header.location', extraction.header.location, knownLocations, 'Location');

  return issues;
}
