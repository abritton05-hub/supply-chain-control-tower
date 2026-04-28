import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import {
  canManageDelivery,
  canReceiveInventory,
  canSubmitPullRequests,
  type AppRole,
} from '@/lib/auth/roles';

export const runtime = 'nodejs';

type Workflow = 'receiving' | 'pull_request' | 'delivery';

type ExtractedLineItem = {
  part_number: string;
  description: string;
  qty: number;
  uom: string;
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLocation(value: string) {
  const cleaned = value
    .trim()
    .replace(/[.,;:)]+$/, '')
    .replace(/^the\s+/i, '')
    .toUpperCase();

  if (cleaned === 'WAREHOUSE') return 'WH';
  if (cleaned === 'WH') return 'WH';

  return cleaned;
}

function extractEmail(text: string) {
  return text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] || '';
}

function extractPocName(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const explicitPocLine = lines.find((line) =>
    /\b(poc|point of contact|contact|receiver)\b/i.test(line)
  );

  if (!explicitPocLine) return '';

  const afterLabel = explicitPocLine
    .replace(/^.*?\b(?:poc|point of contact|contact|receiver)\b\s*[:\-]?\s*/i, '')
    .replace(/[<({].*$/, '')
    .replace(/\b(please|schedule|pickup|pick up|deliver|delivery).*$/i, '')
    .trim();

  const nameMatch = afterLabel.match(/^@?([a-z]+(?:\s+[a-z]+){0,2})/i);
  return nameMatch?.[1]?.trim() || '';
}

function extractPhone(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const phoneLine = lines.find((line) => /\b(phone|tel|cell|mobile)\b/i.test(line)) || '';
  const scopedMatch = phoneLine.match(
    /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/
  );
  if (scopedMatch?.[0]) return scopedMatch[0];

  return text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] || '';
}

function extractLocations(text: string) {
  const lower = text.toLowerCase();
  const fromToMatch =
    text.match(
      /pick\s*up\s+from\s+(?:the\s+)?(.+?)\s+(?:and\s+)?(?:deliver|drop(?:\s*off)?)\s+to\s+(.+?)(?:[.!?]|\r?\n|$)/i
    ) ||
    text.match(/from\s+(?:the\s+)?(.+?)\s+to\s+(.+?)(?:[.!?]|\r?\n|$)/i);

  const fromLocation =
    fromToMatch?.[1] ||
    text.match(/pick\s*up\s+from\s+(?:the\s+)?(.+?)(?:[.!?]|\r?\n|$)/i)?.[1] ||
    text.match(/\bfrom\s+(?:the\s+)?(.+?)(?:[.!?]|\r?\n|$)/i)?.[1] ||
    '';

  const toLocation =
    fromToMatch?.[2] ||
    text.match(/taken\s+directly\s+to\s+(.+?)(?:[.!?]|\r?\n|$)/i)?.[1] ||
    text.match(/directly\s+to\s+(.+?)(?:[.!?]|\r?\n|$)/i)?.[1] ||
    text.match(/deliver\s+to\s+(.+?)(?:[.!?]|\r?\n|$)/i)?.[1] ||
    text.match(/\bto\s+(.+?)(?:[.!?]|\r?\n|$)/i)?.[1] ||
    '';

  const isPickup =
    lower.includes('pickup') ||
    lower.includes('pick up') ||
    Boolean(fromLocation && toLocation);

  const pickupLocation = fromLocation ? normalizeLocation(fromLocation) : 'WH';
  const dropoffLocation = toLocation ? normalizeLocation(toLocation) : 'SEA991';

  return {
    direction: isPickup ? 'incoming' : 'outgoing',
    pickup_location: pickupLocation,
    dropoff_location: dropoffLocation,
  };
}

function extractRequestedTime(text: string, pickupLocation: string) {
  const rangeMatch = text.match(
    /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|–|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i
  );

  if (rangeMatch?.[1] && rangeMatch?.[2]) {
    return `${rangeMatch[1].trim()}-${rangeMatch[2].trim()}`;
  }

  const singleTimeMatch = text.match(/\b(\d{1,2}:\d{2}\s*(?:am|pm)?)\b/i);
  if (singleTimeMatch?.[1]) return singleTimeMatch[1].trim();

  if (pickupLocation === 'WH') return '2:00 PM';

  return '10:30 AM-12:00 PM';
}

function extractPoNumber(text: string) {
  return (
    text.match(/\bPO\s*#?\s*([A-Z0-9-]+)/i)?.[1]?.toUpperCase() ||
    text.match(/\b(B\d{3,}-\d{4,})\b/i)?.[1]?.toUpperCase() ||
    ''
  );
}

function extractLineItems(text: string): ExtractedLineItem[] {
  const items: ExtractedLineItem[] = [];
  const seen = new Set<string>();

  const linePattern =
    /^(?:qty\s*)?(\d+)(?:[ \t]*(?:pcs|pc|pieces|piece|ea|each|x))?[ \t]+(?:of[ \t]+)?(?:PN[ \t]*#?[ \t]*)?([A-Z0-9][A-Z0-9-_./]{2,})(?:[ \t]+(.*))?$/i;

  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(linePattern);
    if (!match) continue;

    const qty = Number(match[1]) || 1;
    const partNumber = match[2].replace(/[,.]$/, '').toUpperCase();
    const description = (match[3] || '').trim();
    const key = `${qty}-${partNumber}-${description}`;

    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      qty,
      part_number: partNumber,
      description,
      uom: 'EA',
    });
  }

  return items;
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

    const body = (await request.json()) as {
      document_id?: string;
      workflow_type?: Workflow;
      raw_text?: string;
    };

    const documentId = clean(body.document_id);
    const workflow = body.workflow_type || 'delivery';
    const rawText = clean(body.raw_text);

    if (!canUseWorkflow(profile.role, workflow)) {
      return NextResponse.json(
        { ok: false, message: 'You do not have permission to process that workflow.' },
        { status: 403 }
      );
    }

    if (!documentId) {
      return NextResponse.json({ ok: false, message: 'document_id is required.' }, { status: 400 });
    }

    if (workflow !== 'delivery') {
      return NextResponse.json({
        ok: true,
        extraction: {
          workflow,
          header: {},
          line_items: [],
          confidence: {},
          missing_required_fields: [],
          warnings: [],
        },
        validation_issues: [],
      });
    }

    const locations = extractLocations(rawText);
    const lineItems = extractLineItems(rawText);
    const poNumber = extractPoNumber(rawText);

    return NextResponse.json({
      ok: true,
      extraction: {
        workflow: 'delivery',
        header: {
          direction: locations.direction,
          company_name: '',
          pickup_location: locations.pickup_location,
          dropoff_location: locations.dropoff_location,
          contact_name: extractPocName(rawText),
          contact_phone: extractPhone(rawText),
          contact_email: extractEmail(rawText),
          requested_date: '',
          requested_time: extractRequestedTime(rawText, locations.pickup_location),
          shipment_transfer_id: poNumber,
          project_or_work_order: poNumber,
          po_number: poNumber,
          notes: rawText,
        },
        line_items: lineItems,
        confidence: {},
        missing_required_fields: [],
        warnings: rawText ? [] : ['No pasted text found. Paste the email text for accurate extraction.'],
      },
      validation_issues: [],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Extraction failed.' },
      { status: 500 }
    );
  }
}
