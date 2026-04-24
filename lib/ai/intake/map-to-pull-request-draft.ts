import type { PullRequestDraftPayload, PullRequestExtraction } from './types';

function text(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export function mapToPullRequestDraft(extraction: PullRequestExtraction): PullRequestDraftPayload {
  const headerNotes = [
    extraction.header.department && `Department: ${extraction.header.department}`,
    extraction.header.project_code && `Project: ${extraction.header.project_code}`,
    extraction.header.needed_by_date && `Needed by: ${extraction.header.needed_by_date}`,
    extraction.header.location && `Location: ${extraction.header.location}`,
    extraction.header.notes,
    extraction.warnings.length ? `AI warnings: ${extraction.warnings.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    requested_by: text(extraction.header.requestor_name),
    notes: headerNotes,
    lines: extraction.line_items.map((line) => ({
      part_number: text(line.part_number),
      description: text(line.description),
      quantity: line.qty_requested && line.qty_requested > 0 ? line.qty_requested : 1,
      notes: text(line.uom) ? `UOM: ${line.uom}` : '',
    })),
  };
}
