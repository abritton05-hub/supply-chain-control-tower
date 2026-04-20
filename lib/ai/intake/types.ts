export type SupportedIntakeWorkflow = 'receiving' | 'pull_request' | 'unknown';

export type ConfirmableIntakeWorkflow = Exclude<SupportedIntakeWorkflow, 'unknown'>;

export type IntakeSourceType = 'image' | 'pdf' | 'text';

export type ConfidenceBand = 'high' | 'medium' | 'low';

export type IntakeClassification = {
  document_type: SupportedIntakeWorkflow;
  confidence: number;
  alternate_types: Array<{
    type: SupportedIntakeWorkflow;
    confidence: number;
  }>;
  reason_codes: string[];
};

export type ReceivingExtraction = {
  workflow: 'receiving';
  header: {
    vendor_name: string | null;
    po_number: string | null;
    shipment_id: string | null;
    tracking_number: string | null;
    carrier: string | null;
    received_date: string | null;
    ship_from: string | null;
    reference_number: string | null;
  };
  line_items: Array<{
    part_number: string | null;
    description: string | null;
    qty: number | null;
    uom: string | null;
    serial_numbers: string[];
    lot_number: string | null;
    location: string | null;
  }>;
  confidence: Record<string, number>;
  missing_required_fields: string[];
  warnings: string[];
};

export type PullRequestExtraction = {
  workflow: 'pull_request';
  header: {
    requestor_name: string | null;
    request_date: string | null;
    department: string | null;
    project_code: string | null;
    needed_by_date: string | null;
    location: string | null;
    notes: string | null;
  };
  line_items: Array<{
    part_number: string | null;
    description: string | null;
    qty_requested: number | null;
    uom: string | null;
  }>;
  confidence: Record<string, number>;
  missing_required_fields: string[];
  warnings: string[];
};

export type IntakeExtraction = ReceivingExtraction | PullRequestExtraction;

export type ValidationIssue = {
  field: string;
  severity: 'error' | 'warning';
  message: string;
};

export type IntakeDocumentRecord = {
  id: string;
  organization_id: string;
  uploaded_by: string | null;
  source_type: IntakeSourceType;
  original_filename: string | null;
  mime_type: string | null;
  storage_path: string | null;
  raw_text: string | null;
  status: 'uploaded' | 'classified' | 'extracted' | 'reviewed' | 'rejected' | 'error';
  created_at: string;
  updated_at: string;
};

export type StoredIntakeSource =
  | {
      source_type: 'text';
      raw_text: string;
      original_filename: string | null;
      mime_type: string | null;
    }
  | {
      source_type: 'image' | 'pdf';
      file_base64: string;
      original_filename: string | null;
      mime_type: string;
    };

export type ReceivingDraftPayload = {
  item_id: string;
  part_number: string;
  description: string;
  quantity: number;
  reference: string;
  notes: string;
  is_supply: boolean;
};

export type PullRequestDraftLine = {
  part_number: string;
  description: string;
  quantity: number;
  notes: string;
};

export type PullRequestDraftPayload = {
  requested_by: string;
  notes: string;
  lines: PullRequestDraftLine[];
};

export type IntakeReviewDraftPayload =
  | {
      workflow_type: 'receiving';
      draft: ReceivingDraftPayload;
    }
  | {
      workflow_type: 'pull_request';
      draft: PullRequestDraftPayload;
    };

export function confidenceBand(value: number | null | undefined): ConfidenceBand {
  const confidence = typeof value === 'number' && Number.isFinite(value) ? value : 0;

  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

export function confidenceBandLabel(value: number | null | undefined) {
  const band = confidenceBand(value);
  if (band === 'high') return 'High';
  if (band === 'medium') return 'Medium';
  return 'Low';
}

export function isConfirmableWorkflow(
  workflow: SupportedIntakeWorkflow
): workflow is ConfirmableIntakeWorkflow {
  return workflow === 'receiving' || workflow === 'pull_request';
}
