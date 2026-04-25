import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Workflow = 'receiving' | 'pull_request' | 'delivery';

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function extractEmail(text: string) {
  return text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] || '';
}

function extractContactName(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const emailIndex = lines.findIndex((line) =>
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(line)
  );

  if (emailIndex > 0) return lines[emailIndex - 1];

  const thanksMatch = text.match(/thanks,?\s+([a-z][a-z\s.'-]+)/i);
  return thanksMatch?.[1]?.trim() || '';
}

function extractLocations(text: string) {
  const lower = text.toLowerCase();

  const pickupMatch =
    text.match(/pickup\s+from\s+([a-z0-9-]+)/i) ||
    text.match(/pick\s+up\s+from\s+([a-z0-9-]+)/i) ||
    text.match(/\bfrom\s+([a-z0-9-]+)/i);

  const directToMatch = text.match(/directly\s+to\s+([a-z0-9-]+)/i);
  const allToMatches = Array.from(text.matchAll(/\bto\s+([a-z0-9-]+)/gi));

  const pickupLocation = pickupMatch?.[1]?.toUpperCase() || '';
  const dropoffLocation =
    directToMatch?.[1]?.toUpperCase() ||
    allToMatches.at(-1)?.[1]?.toUpperCase() ||
    '';

  const isPickup =
    lower.includes('pickup') ||
    lower.includes('pick up') ||
    Boolean(pickupLocation && dropoffLocation);

  return {
    direction: isPickup ? 'incoming' : 'outgoing',
    pickup_location: pickupLocation,
    dropoff_location: dropoffLocation || (isPickup ? 'SEA991' : ''),
  };
}

function extractQuantity(text: string) {
  const match =
    text.match(/\bqty\s*(\d+)/i) ||
    text.match(/\bquantity\s*(\d+)/i) ||
    text.match(/\b(\d+)\s+of\b/i);

  return match ? Number(match[1]) : 1;
}

function extractItem(text: string) {
  const match =
    text.match(/qty\s*\d+\s+of\s+(.+)/i) ||
    text.match(/quantity\s*\d+\s+of\s+(.+)/i);

  const line = match?.[1]?.trim() || '';
  if (!line) {
    return {
      part_number: '',
      description: '',
    };
  }

  const [partNumber, ...descriptionParts] = line.split(/\s+/);

  return {
    part_number: partNumber.replace(/[,.]$/, ''),
    description: descriptionParts.join(' ').trim(),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      document_id?: string;
      workflow_type?: Workflow;
      raw_text?: string;
    };

    const documentId = clean(body.document_id);
    const workflow = body.workflow_type || 'delivery';
    const rawText = clean(body.raw_text);

    if (!documentId) {
      return NextResponse.json(
        { ok: false, message: 'document_id is required.' },
        { status: 400 }
      );
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
    const item = extractItem(rawText);
    const quantity = extractQuantity(rawText);

    return NextResponse.json({
      ok: true,
      extraction: {
        workflow: 'delivery',
        header: {
          direction: locations.direction,
          company_name: rawText.toLowerCase().includes('amazon') ? 'Amazon' : '',
          pickup_location: locations.pickup_location,
          dropoff_location: locations.dropoff_location,
          contact_name: extractContactName(rawText),
          contact_email: extractEmail(rawText),
          requested_date: '',
          requested_time: '',
          shipment_transfer_id: documentId,
          project_or_work_order: '',
          notes: rawText
            ? `Pickup from ${locations.pickup_location || '-'} - deliver to ${
                locations.dropoff_location || 'SEA991'
              }.`
            : 'Generated from AI Intake upload.',
        },
        line_items: [
          {
            part_number: item.part_number,
            description: item.description,
            qty: quantity,
          },
        ],
        confidence: {},
        missing_required_fields: [],
        warnings: rawText
          ? []
          : ['No pasted text found. Screenshot OCR is not wired yet. Paste the email text for accurate extraction.'],
      },
      validation_issues: [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Extraction failed.',
      },
      { status: 500 }
    );
  }
}