import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Workflow = 'receiving' | 'pull_request' | 'delivery';

function clean(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function extractEmail(text: string) {
  return text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] ?? '';
}

function extractContactName(text: string) {
  const thanksMatch = text.match(/thanks,?\s+([a-z][a-z\s.'-]+)/i);
  if (thanksMatch?.[1]) return thanksMatch[1].trim();

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const emailIndex = lines.findIndex((line) =>
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(line)
  );

  if (emailIndex > 0) return lines[emailIndex - 1];

  return '';
}

function extractQuantity(text: string) {
  const qtyMatch =
    text.match(/\bqty\s*(\d+)/i) ||
    text.match(/\bquantity\s*(\d+)/i) ||
    text.match(/\b(\d+)\s+(?:of|x)\b/i);

  return qtyMatch ? Number(qtyMatch[1]) : 1;
}

function extractPartAndDescription(text: string) {
  const partLine =
    text.match(/qty\s*\d+\s+of\s+(.+)/i)?.[1] ||
    text.match(/qty\s*\d+\s+(.+)/i)?.[1] ||
    text.match(/quantity\s*\d+\s+(.+)/i)?.[1] ||
    '';

  if (!partLine) {
    return {
      part_number: '',
      description: '',
    };
  }

  const cleaned = partLine.trim();
  const pieces = cleaned.split(/\s+/);
  const partNumber = pieces[0] ?? '';

  return {
    part_number: partNumber.replace(/[,.]$/, ''),
    description: cleaned.replace(partNumber, '').trim().replace(/^[-,:\s]+/, ''),
  };
}

function extractLocations(text: string) {
  const pickupMatch =
    text.match(/pickup\s+from\s+([a-z0-9-]+)/i) ||
    text.match(/pick\s+up\s+from\s+([a-z0-9-]+)/i);

  const dropoffMatch =
    text.match(/to\s+([a-z0-9-]+)/i) ||
    text.match(/directly\s+to\s+([a-z0-9-]+)/i);

  const lower = text.toLowerCase();
  const pickupLocation = pickupMatch?.[1]?.toUpperCase() || '';
  const dropoffLocation = dropoffMatch?.[1]?.toUpperCase() || '';

  const isPickup =
    lower.includes('pickup') ||
    lower.includes('pick up') ||
    lower.includes('to sea991') ||
    lower.includes('taken directly to sea991');

  const isDelivery = lower.includes('from sea991') || lower.includes('shipping from sea991');

  return {
    direction: isDelivery && !isPickup ? 'outgoing' : 'incoming',
    pickup_location: pickupLocation || (isPickup ? 'SEA99' : 'SEA991'),
    dropoff_location: dropoffLocation || (isPickup ? 'SEA991' : ''),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      document_id?: string;
      workflow_type?: Workflow;
      raw_text?: string;
    };

    if (!body.document_id) {
      return NextResponse.json(
        { ok: false, message: 'document_id is required.' },
        { status: 400 }
      );
    }

    const workflow = body.workflow_type || 'delivery';
    const rawText = clean(body.raw_text);
    const locationData = extractLocations(rawText);
    const itemData = extractPartAndDescription(rawText);

    if (workflow === 'delivery') {
      return NextResponse.json({
        ok: true,
        extraction: {
          workflow: 'delivery',
          header: {
            direction: locationData.direction,
            company_name: rawText.toLowerCase().includes('amazon') ? 'Amazon' : '',
            pickup_location: locationData.pickup_location,
            dropoff_location: locationData.dropoff_location,
            contact_name: extractContactName(rawText),
            contact_phone: '',
            contact_email: extractEmail(rawText),
            requested_date: '',
            requested_time: '',
            shipment_transfer_id: body.document_id,
            project_or_work_order: '',
            carrier_or_driver: '',
            notes: rawText ? 'Generated from AI Intake.' : 'Generated from AI Intake upload.',
          },
          line_items: [
            {
              part_number: itemData.part_number,
              description: itemData.description,
              qty: extractQuantity(rawText),
            },
          ],
          confidence: {},
          missing_required_fields: [],
          warnings: rawText
            ? []
            : ['No pasted text was provided, so only a generic draft can be created from the upload.'],
        },
        validation_issues: [],
      });
    }

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