import { NextResponse } from 'next/server';
import { classifyIntakeDocument } from '@/lib/ai/openai-server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  AI_INTAKE_PROMPT_VERSION,
  intakeModelName,
} from '@/lib/ai/intake/constants';
import {
  loadStoredIntakeSource,
  markIntakeDocumentStatus,
} from '@/lib/ai/intake/document-store';
import type { IntakeClassification } from '@/lib/ai/intake/types';

export const runtime = 'nodejs';

type ClassifyResponse =
  | {
      ok: true;
      classification: IntakeClassification;
    }
  | {
      ok: false;
      message: string;
    };

function readDocumentId(body: unknown) {
  if (!body || typeof body !== 'object' || !('document_id' in body)) return '';
  const value = (body as { document_id?: unknown }).document_id;
  return typeof value === 'string' ? value.trim() : '';
}

async function insertRun(input: {
  documentId: string;
  result: unknown;
  latencyMs: number;
  success: boolean;
  workflowType: string | null;
  errorMessage?: string | null;
}) {
  const supabase = supabaseAdmin();
  await supabase.from('ai_intake_runs').insert({
    document_id: input.documentId,
    run_type: 'classify',
    workflow_type: input.workflowType,
    model_name: intakeModelName(),
    prompt_version: AI_INTAKE_PROMPT_VERSION,
    raw_result: input.result,
    latency_ms: input.latencyMs,
    success: input.success,
    error_message: input.errorMessage ?? null,
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  const documentId = readDocumentId(body);

  if (!documentId) {
    return NextResponse.json<ClassifyResponse>(
      { ok: false, message: 'document_id is required.' },
      { status: 400 }
    );
  }

  const startedAt = Date.now();

  try {
    const source = await loadStoredIntakeSource(documentId);
    const classification = await classifyIntakeDocument(source);
    const latencyMs = Date.now() - startedAt;

    await insertRun({
      documentId,
      result: classification,
      latencyMs,
      success: true,
      workflowType: classification.document_type,
    });

    await markIntakeDocumentStatus(documentId, 'classified');

    return NextResponse.json<ClassifyResponse>({
      ok: true,
      classification,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Classification failed.';
    const latencyMs = Date.now() - startedAt;

    await insertRun({
      documentId,
      result: {},
      latencyMs,
      success: false,
      workflowType: null,
      errorMessage: message,
    }).catch(() => undefined);

    await markIntakeDocumentStatus(documentId, 'error').catch(() => undefined);

    return NextResponse.json<ClassifyResponse>({ ok: false, message }, { status: 500 });
  }
}
