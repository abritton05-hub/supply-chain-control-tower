import { NextResponse } from 'next/server';
import { mapToPullRequestDraft } from '@/lib/ai/intake/map-to-pull-request-draft';
import { mapToReceivingDraft } from '@/lib/ai/intake/map-to-receiving-draft';
import { markIntakeDocumentStatus } from '@/lib/ai/intake/document-store';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type {
  ConfirmableIntakeWorkflow,
  IntakeReviewDraftPayload,
  PullRequestExtraction,
  ReceivingExtraction,
} from '@/lib/ai/intake/types';

export const runtime = 'nodejs';

type ApplyResponse =
  | {
      ok: true;
      route: '/receiving' | '/pull-requests' | null;
      draft: IntakeReviewDraftPayload | null;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

type ApplyBody = {
  document_id?: unknown;
  selected_workflow_type?: unknown;
  reviewed_data?: unknown;
  edited_fields?: unknown;
  review_status?: unknown;
};

function workflow(value: unknown): ConfirmableIntakeWorkflow | '' {
  if (value === 'receiving' || value === 'pull_request') return value;
  return '';
}

function reviewStatus(value: unknown): 'approved' | 'edited' | 'rejected' | '' {
  if (value === 'approved' || value === 'edited' || value === 'rejected') return value;
  return '';
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ApplyBody;
    const documentId = typeof body.document_id === 'string' ? body.document_id.trim() : '';
    const selectedWorkflow = workflow(body.selected_workflow_type);
    const status = reviewStatus(body.review_status) || 'approved';
    const reviewedData = body.reviewed_data;
    const editedFields = stringArray(body.edited_fields);

    if (!documentId) {
      return NextResponse.json<ApplyResponse>(
        { ok: false, message: 'document_id is required.' },
        { status: 400 }
      );
    }

    if (!selectedWorkflow) {
      return NextResponse.json<ApplyResponse>(
        { ok: false, message: 'selected_workflow_type must be receiving or pull_request.' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();
    const { error } = await supabase.from('ai_intake_reviews').insert({
      document_id: documentId,
      selected_workflow_type: selectedWorkflow,
      review_status: status,
      reviewed_data: reviewedData && typeof reviewedData === 'object' ? reviewedData : {},
      edited_fields: editedFields,
    });

    if (error) {
      throw new Error(`Could not save intake review: ${error.message}`);
    }

    if (status === 'rejected') {
      await markIntakeDocumentStatus(documentId, 'rejected');
      return NextResponse.json<ApplyResponse>({
        ok: true,
        route: null,
        draft: null,
        message: 'Intake rejected. No workflow draft was created.',
      });
    }

    await markIntakeDocumentStatus(documentId, 'reviewed');

    if (selectedWorkflow === 'receiving') {
      const draft: IntakeReviewDraftPayload = {
        workflow_type: 'receiving',
        draft: mapToReceivingDraft(reviewedData as ReceivingExtraction),
      };

      return NextResponse.json<ApplyResponse>({
        ok: true,
        route: '/receiving',
        draft,
        message: 'Receiving draft is ready for review.',
      });
    }

    const draft: IntakeReviewDraftPayload = {
      workflow_type: 'pull_request',
      draft: mapToPullRequestDraft(reviewedData as PullRequestExtraction),
    };

    return NextResponse.json<ApplyResponse>({
      ok: true,
      route: '/pull-requests',
      draft,
      message: 'Pull request draft is ready for review.',
    });
  } catch (error) {
    return NextResponse.json<ApplyResponse>(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Could not apply intake review.',
      },
      { status: 500 }
    );
  }
}
