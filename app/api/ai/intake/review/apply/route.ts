import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import {
  canManageDelivery,
  canReceiveInventory,
  canSubmitPullRequests,
  type AppRole,
} from '@/lib/auth/roles';

export const runtime = 'nodejs';

type Workflow =
  | 'receiving'
  | 'pull_request'
  | 'delivery'
  | 'pickup'
  | 'pickup_delivery'
  | 'manifest'
  | 'delivery_receipt';

type ApplyBody = {
  document_id?: string;
  selected_workflow_type?: Workflow;
  review_status?: 'approved' | 'edited' | 'rejected';
  extraction?: any;
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanPhone(value: unknown) {
  const raw = clean(value);
  if (!raw) return '';

  return (
    raw.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] ?? ''
  );
}

function isDeliveryWorkflow(workflow: Workflow) {
  return (
    workflow === 'delivery' ||
    workflow === 'pickup' ||
    workflow === 'pickup_delivery' ||
    workflow === 'manifest' ||
    workflow === 'delivery_receipt'
  );
}

function buildContact(nameValue: unknown, phoneValue: unknown) {
  const name = clean(nameValue);
  const phone = cleanPhone(phoneValue);

  if (name && phone) return `${name} - ${phone}`;
  if (name) return name;
  if (phone) return phone;

  return '';
}

function formatLineItems(lineItems: any[]) {
  return lineItems
    .map((item) => {
      const qty = item.qty ?? item.quantity ?? item.qty_requested ?? 1;
      const part = clean(item.part_number);
      const desc = clean(item.description);
      const uom = clean(item.uom);

      return [`${qty}x`, part, desc, uom && uom !== 'EA' ? uom : '']
        .filter(Boolean)
        .join(' ')
        .trim();
    })
    .filter(Boolean)
    .join('\n');
}

function canUseWorkflow(role: AppRole, workflow: Workflow) {
  if (workflow === 'pull_request') return canSubmitPullRequests(role);
  if (workflow === 'receiving') return canReceiveInventory(role);
  return canManageDelivery(role);
}

export async function POST(request: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile.is_active) {
      return NextResponse.json({ ok: false, message: 'Access denied.' }, { status: 403 });
    }

    const body = (await request.json()) as ApplyBody;

    if (!body.document_id) {
      return NextResponse.json({ ok: false, message: 'document_id is required.' }, { status: 400 });
    }

    if (!body.selected_workflow_type) {
      return NextResponse.json(
        { ok: false, message: 'selected_workflow_type is required.' },
        { status: 400 }
      );
    }

    if (!canUseWorkflow(profile.role, body.selected_workflow_type)) {
      return NextResponse.json(
        { ok: false, message: 'You do not have permission to create that workflow draft.' },
        { status: 403 }
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
            notes: '',
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
            notes: '',
            lines: [],
          },
        },
        message: 'Pull request draft created.',
      });
    }

    if (!isDeliveryWorkflow(body.selected_workflow_type)) {
      return NextResponse.json(
        { ok: false, message: 'Unsupported workflow type for draft creation.' },
        { status: 400 }
      );
    }

    const extraction = body.extraction ?? {};
    const header = extraction.header ?? {};
    const lineItems = Array.isArray(extraction.line_items) ? extraction.line_items : [];

    const direction =
      header.direction === 'outgoing' || header.direction === 'delivery' ? 'delivery' : 'pickup';

    const pickupLocation = clean(header.pickup_location) || (direction === 'pickup' ? 'WH' : 'SEA991');
    const dropoffLocation = clean(header.dropoff_location) || (direction === 'pickup' ? 'SEA991' : '');

    return NextResponse.json({
      ok: true,
      route: direction === 'delivery' ? '/delivery?view=deliveries' : '/delivery?view=pickups',
      draft: {
        workflow_type: 'delivery',
        draft: {
          direction,
          company_name: '',
          pickup_location: pickupLocation,
          dropoff_location: dropoffLocation,
          contact_name: buildContact(header.contact_name, header.contact_phone),
          contact_phone: '',
          contact_email: clean(header.contact_email),
          requested_date: clean(header.requested_date),
          requested_time: clean(header.requested_time),
          shipment_transfer_id: clean(header.po_number) || clean(header.shipment_transfer_id),
          project_or_work_order: clean(header.project_or_work_order),
          carrier_or_driver: '',
          items: formatLineItems(lineItems),
          notes: clean(header.notes).replace(/\bai intake\b/gi, '').trim(),
        },
      },
      message: 'Manifest draft created.',
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Apply failed.' },
      { status: 500 }
    );
  }
}
