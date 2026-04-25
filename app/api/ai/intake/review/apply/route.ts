import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Workflow = 'receiving' | 'pull_request' | 'delivery';

type ApplyBody = {
  document_id?: string;
  selected_workflow_type?: Workflow;
  review_status?: 'approved' | 'edited' | 'rejected';
  extraction?: any;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ApplyBody;

    if (!body.document_id) {
      return NextResponse.json(
        { ok: false, message: 'document_id is required.' },
        { status: 400 }
      );
    }

    if (!body.selected_workflow_type) {
      return NextResponse.json(
        { ok: false, message: 'selected_workflow_type is required.' },
        { status: 400 }
      );
    }

    if (body.review_status === 'rejected') {
      return NextResponse.json({
        ok: true,
        route: null,
        draft: null,
        message: 'Intake rejected.',
      });
    }

    if (body.selected_workflow_type === 'receiving') {
      return NextResponse.json({
        ok: true,
        route: '/receiving',
        draft: {
          workflow_type: 'receiving',
          draft: {
            item_id: '',
            part_number: '',
            description: '',
            quantity: 1,
            reference: body.document_id,
            notes: 'Created from AI Intake upload.',
            is_supply: false,
          },
        },
        message: 'Receiving draft created.',
      });
    }

    if (body.selected_workflow_type === 'pull_request') {
      return NextResponse.json({
        ok: true,
        route: '/pull-requests',
        draft: {
          workflow_type: 'pull_request',
          draft: {
            requested_by: '',
            notes: 'Created from AI Intake upload.',
            lines: [],
          },
        },
        message: 'Pull request draft created.',
      });
    }

    const extraction = body.extraction ?? {};
    const header = extraction.header ?? {};
    const lineItems = Array.isArray(extraction.line_items)
      ? extraction.line_items
      : [];

    const direction =
      header.direction === 'outgoing' || header.direction === 'delivery'
        ? 'delivery'
        : 'pickup';

    const pickupLocation =
      header.pickup_location || (direction === 'pickup' ? 'SEA99' : 'SEA991');

    const dropoffLocation =
      header.dropoff_location || (direction === 'pickup' ? 'SEA991' : '');

    const items =
      lineItems.length > 0
        ? lineItems
            .map((item: any) => {
              const qty = item.qty ?? item.quantity ?? 1;
              const partNumber = item.part_number ?? '';
              const description = item.description ?? '';
              return `${qty}x ${partNumber} ${description}`.trim();
            })
            .filter(Boolean)
            .join(', ')
        : '';

    return NextResponse.json({
      ok: true,
      route: '/delivery?view=pickups',
      draft: {
        workflow_type: 'delivery',
        draft: {
          direction,
          company_name: header.company_name || 'Amazon',
          pickup_location: pickupLocation,
          dropoff_location: dropoffLocation,
          contact_name: header.contact_name || '',
          contact_phone: header.contact_phone || '',
          contact_email: header.contact_email || '',
          requested_date: header.requested_date || '',
          requested_time: header.requested_time || '',
          shipment_transfer_id: body.document_id,
          project_or_work_order: header.project_or_work_order || '',
          carrier_or_driver: header.carrier_or_driver || '',
          items,
          notes: header.notes || 'Generated from AI Intake.',
        },
      },
      message: 'Delivery / pickup draft created.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Apply failed.',
      },
      { status: 500 }
    );
  }
}