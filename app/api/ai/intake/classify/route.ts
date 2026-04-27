import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';

export const runtime = 'nodejs';

type SupportedWorkflow = 'receiving' | 'pull_request' | 'delivery' | 'unknown';

function classifyFromText(text: string): SupportedWorkflow {
  const value = text.toLowerCase();

  const deliveryWords = [
    'pickup',
    'pick up',
    'drop off',
    'dropoff',
    'delivery',
    'deliver',
    'ship from sea991',
    'shipping from sea991',
    'ship to sea991',
    'going to sea991',
    'driver',
    'manifest',
    'courier',
    'carrier pickup',
  ];

  const receivingWords = [
    'packing slip',
    'received',
    'receiving',
    'po number',
    'purchase order',
    'tracking',
    'carrier',
    'shipment',
    'qty received',
  ];

  const pullRequestWords = [
    'request',
    'needed by',
    'need by',
    'pull request',
    'material request',
    'requested by',
    'requestor',
    'department',
  ];

  const deliveryScore = deliveryWords.filter((word) => value.includes(word)).length;
  const receivingScore = receivingWords.filter((word) => value.includes(word)).length;
  const pullRequestScore = pullRequestWords.filter((word) => value.includes(word)).length;

  if (deliveryScore >= receivingScore && deliveryScore >= pullRequestScore && deliveryScore > 0) {
    return 'delivery';
  }

  if (receivingScore >= pullRequestScore && receivingScore > 0) {
    return 'receiving';
  }

  if (pullRequestScore > 0) {
    return 'pull_request';
  }

  return 'unknown';
}

function confidenceFor(workflow: SupportedWorkflow) {
  if (workflow === 'unknown') return 0.3;
  return 0.82;
}

export async function POST(request: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile.is_active) {
      return NextResponse.json({ ok: false, message: 'Access denied.' }, { status: 403 });
    }

    const body = (await request.json()) as {
      document_id?: string;
      text_hint?: string;
    };

    if (!body.document_id) {
      return NextResponse.json(
        {
          ok: false,
          message: 'document_id is required.',
        },
        { status: 400 }
      );
    }

    const workflow = classifyFromText(body.text_hint ?? '');

    return NextResponse.json({
      ok: true,
      classification: {
        document_type: workflow,
        confidence: confidenceFor(workflow),
        alternate_types: [
          {
            type: workflow === 'delivery' ? 'receiving' : 'delivery',
            confidence: 0.35,
          },
        ],
        reason_codes:
          workflow === 'delivery'
            ? ['delivery_or_pickup_language_detected']
            : workflow === 'receiving'
              ? ['receiving_or_shipment_language_detected']
              : workflow === 'pull_request'
                ? ['request_language_detected']
                : ['manual_selection_recommended'],
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Classification failed.',
      },
      { status: 500 }
    );
  }
}
