import { NextResponse } from 'next/server';
import {
  extractPullRequestDocument,
  extractReceivingDocument,
} from '@/lib/ai/openai-server';
import {
  AI_INTAKE_PROMPT_VERSION,
  intakeModelName,
} from '@/lib/ai/intake/constants';
import {
  loadStoredIntakeSource,
  markIntakeDocumentStatus,
} from '@/lib/ai/intake/document-store';
import { isConfirmableWorkflow } from '@/lib/ai/intake/types';
import type {
  ConfirmableIntakeWorkflow,
  IntakeClassification,
  IntakeExtraction,
  SupportedIntakeWorkflow,
  ValidationIssue,
} from '@/lib/ai/intake/types';
import {
  validatePullRequestExtraction,
  validateReceivingExtraction,
} from '@/lib/ai/intake/validate-extraction';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

type ExtractResponse =
  | {
      ok: true;
      extraction: IntakeExtraction;
      validation_issues: ValidationIssue[];
    }
  | {
      ok: false;
      message: string;
      manual_selection_needed?: boolean;
      classification?: IntakeClassification;
    };

type ExtractBody = {
  document_id?: unknown;
  workflow_type?: unknown;
};

type ClassificationRunRow = {
  raw_result: unknown;
  workflow_type: SupportedIntakeWorkflow | null;
};

function normalizeWorkflow(value: unknown): SupportedIntakeWorkflow | '' {
  if (value === 'receiving' || value === 'pull_request' || value === 'unknown') return value;
  return '';
}

function readBody(body: unknown) {
  const candidate = (body ?? {}) as ExtractBody;
  return {
    documentId: typeof candidate.document_id === 'string' ? candidate.document_id.trim() : '',
    workflowType: normalizeWorkflow(candidate.workflow_type),
  };
}

function classificationFromRaw(raw: unknown): IntakeClassification | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<IntakeClassification>;
  const documentType = normalizeWorkflow(candidate.document_type);

  if (!documentType || typeof candidate.confidence !== 'number') return null;

  return {
    document_type: documentType,
    confidence: candidate.confidence,
    alternate_types: Array.isArray(candidate.alternate_types)
      ? candidate.alternate_types.filter(
          (
            item
          ): item is {
            type: SupportedIntakeWorkflow;
            confidence: number;
          } =>
            !!item &&
            typeof item === 'object' &&
            !!normalizeWorkflow((item as { type?: unknown }).type) &&
            typeof (item as { confidence?: unknown }).confidence === 'number'
        )
      : [],
    reason_codes: Array.isArray(candidate.reason_codes)
      ? candidate.reason_codes.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

async function latestClassification(documentId: string) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('ai_intake_runs')
    .select('raw_result,workflow_type')
    .eq('document_id', documentId)
    .eq('run_type', 'classify')
    .eq('success', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load latest classification: ${error.message}`);
  }

  return data ? (data as ClassificationRunRow) : null;
}

async function loadLookups() {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from('inventory')
    .select('part_number,location')
    .limit(5000);

  const partNumbers = new Set<string>();
  const locations = new Set<string>();

  for (const row of data ?? []) {
    if (typeof row.part_number === 'string' && row.part_number.trim()) {
      partNumbers.add(row.part_number.trim());
    }

    if (typeof row.location === 'string' && row.location.trim()) {
      locations.add(row.location.trim());
    }
  }

  return {
    knownPartNumbers: Array.from(partNumbers),
    validLocations: Array.from(locations),
  };
}

async function insertRun(input: {
  documentId: string;
  workflowType: ConfirmableIntakeWorkflow | null;
  result: unknown;
  latencyMs: number;
  success: boolean;
  errorMessage?: string | null;
}) {
  const supabase = supabaseAdmin();
  await supabase.from('ai_intake_runs').insert({
    document_id: input.documentId,
    run_type: 'extract',
    workflow_type: input.workflowType,
    model_name: intakeModelName(),
    prompt_version: AI_INTAKE_PROMPT_VERSION,
    raw_result: input.result,
    latency_ms: input.latencyMs,
    success: input.success,
    error_message: input.errorMessage ?? null,
  });
}

async function storeExtraction(
  documentId: string,
  extraction: IntakeExtraction,
  validationIssues: ValidationIssue[]
) {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from('ai_intake_extractions').insert({
    document_id: documentId,
    workflow_type: extraction.workflow,
    extracted_data: extraction,
    confidence_data: extraction.confidence,
    missing_fields: extraction.missing_required_fields,
    warnings: extraction.warnings,
    validation_issues: validationIssues,
  });

  if (error) {
    throw new Error(`Could not store extraction: ${error.message}`);
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  const { documentId, workflowType } = readBody(body);

  if (!documentId) {
    return NextResponse.json<ExtractResponse>(
      { ok: false, message: 'document_id is required.' },
      { status: 400 }
    );
  }

  const classificationRun = await latestClassification(documentId);
  const classification = classificationRun ? classificationFromRaw(classificationRun.raw_result) : null;

  if (!classification) {
    return NextResponse.json<ExtractResponse>(
      { ok: false, message: 'Classify the document before extraction.' },
      { status: 409 }
    );
  }

  const selectedWorkflow = workflowType || classification.document_type;

  if (!isConfirmableWorkflow(selectedWorkflow)) {
    return NextResponse.json<ExtractResponse>({
      ok: false,
      message: 'Manual workflow selection is needed before extraction.',
      manual_selection_needed: true,
      classification,
    });
  }

  const startedAt = Date.now();

  try {
    const source = await loadStoredIntakeSource(documentId);
    const extraction =
      selectedWorkflow === 'receiving'
        ? await extractReceivingDocument(source)
        : await extractPullRequestDocument(source);

    const lookups = await loadLookups();
    const validationIssues =
      extraction.workflow === 'receiving'
        ? validateReceivingExtraction(extraction, lookups)
        : validatePullRequestExtraction(extraction, lookups);

    const latencyMs = Date.now() - startedAt;

    await insertRun({
      documentId,
      workflowType: selectedWorkflow,
      result: extraction,
      latencyMs,
      success: true,
    });

    await storeExtraction(documentId, extraction, validationIssues);
    await markIntakeDocumentStatus(documentId, 'extracted');

    return NextResponse.json<ExtractResponse>({
      ok: true,
      extraction,
      validation_issues: validationIssues,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Extraction failed.';
    const latencyMs = Date.now() - startedAt;

    await insertRun({
      documentId,
      workflowType: selectedWorkflow,
      result: {},
      latencyMs,
      success: false,
      errorMessage: message,
    }).catch(() => undefined);

    await markIntakeDocumentStatus(documentId, 'error').catch(() => undefined);

    return NextResponse.json<ExtractResponse>({ ok: false, message }, { status: 500 });
  }
}
