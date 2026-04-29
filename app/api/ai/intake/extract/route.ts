import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/profile';
import {
  canManageDelivery,
  canReceiveInventory,
  canSubmitPullRequests,
  type AppRole,
} from '@/lib/auth/roles';
import { intakeModelName } from '@/lib/ai/intake/constants';
import { deliveryExtractionPrompt } from '@/lib/ai/intake/prompts';
import type { DeliveryExtraction, StoredIntakeSource } from '@/lib/ai/intake/types';

export const runtime = 'nodejs';

type Workflow =
  | 'receiving'
  | 'pull_request'
  | 'delivery'
  | 'pickup'
  | 'pickup_delivery'
  | 'manifest'
  | 'delivery_receipt';

type ExtractedLineItem = {
  part_number: string;
  description: string;
  quantity: number;
  uom: string;
  notes: string;
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

function extractPhone(text: string) {
  return text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] || '';
}

function extractPocName(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
<<<<<<< HEAD
  const explicitPocLine = lines.find((line) =>
    /\b(receiver|poc|point of contact|contact)\b/i.test(line)
  );
=======
  const explicitPocLine = lines.find((line) => /\b(poc|point of contact|contact|attn)\b/i.test(line));
>>>>>>> 23a8eab3 (Fix delivery intake and add P-touch label export)

  if (!explicitPocLine) return '';

  const afterLabel = explicitPocLine
    .replace(/^.*?\b(?:receiver|poc|point of contact|contact)\b\s*[:\-]?\s*/i, '')
    .replace(/[<({].*$/, '')
    .replace(/\b(please|schedule|pickup|pick up|deliver|delivery).*$/i, '')
    .replace(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/, '')
    .trim();

<<<<<<< HEAD
  const nameMatch = afterLabel.match(/^@?([a-z]+(?:\s+[a-z]+){0,2})/i);
  const name = nameMatch?.[1]?.trim() || '';

  if (!name) return '';
  if (/^(team|warehouse|driver|dispatch|shipping|receiving)$/i.test(name)) return '';

  return name;
}

function extractPhone(text: string) {
  return (
    text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] ||
    text.match(/\b\d{3}[-.\s]?\d{4}\b/)?.[0] ||
    ''
  );
}

function extractLocationPhrase(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  const candidate = match?.[1]?.trim() || '';
  if (!candidate) return '';
  return normalizeLocation(candidate.replace(/\s+/g, ' ').replace(/[.,;:]$/, ''));
=======
  if (/\b(team|department|dept|warehouse|shipping|receiving|dispatch|customer|vendor|company)\b/i.test(afterLabel)) {
    return '';
  }

  const nameMatch = afterLabel.match(/^@?([a-z][a-z.'-]+(?:\s+[a-z][a-z.'-]+){1,2})/i);
  return nameMatch?.[1]?.trim() || '';
>>>>>>> 23a8eab3 (Fix delivery intake and add P-touch label export)
}

function extractLabeledLocation(text: string, labels: string[]) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = text.match(new RegExp(`(?:^|\\n)\\s*(?:${escaped})\\s*[:\\-]\\s*([^\\n]+)`, 'i'));
  return match?.[1]?.trim() || '';
}

function extractLocations(text: string) {
  const lower = text.toLowerCase();

  const fromLocation =
<<<<<<< HEAD
    extractLocationPhrase(text, /pick\s*up\s+from\s+(?:the\s+)?([a-z0-9][a-z0-9\s/-]*?)(?=\s+(?:and\s+deliver|to)\b|[.,;\n\r]|$)/i) ||
    extractLocationPhrase(text, /pickup\s+from\s+(?:the\s+)?([a-z0-9][a-z0-9\s/-]*?)(?=\s+(?:and\s+deliver|to)\b|[.,;\n\r]|$)/i) ||
    extractLocationPhrase(text, /\bfrom\s+(?:the\s+)?([a-z0-9][a-z0-9\s/-]*?)(?=\s+(?:to|and)\b|[.,;\n\r]|$)/i) ||
    '';

  const toLocation =
    extractLocationPhrase(text, /taken\s+directly\s+to\s+([a-z0-9][a-z0-9\s/-]*?)(?=[.,;\n\r]|$)/i) ||
    extractLocationPhrase(text, /directly\s+to\s+([a-z0-9][a-z0-9\s/-]*?)(?=[.,;\n\r]|$)/i) ||
    extractLocationPhrase(text, /deliver\s+to\s+([a-z0-9][a-z0-9\s/-]*?)(?=[.,;\n\r]|$)/i) ||
    extractLocationPhrase(text, /\bto\s+([a-z0-9][a-z0-9\s/-]*?)(?=[.,;\n\r]|$)/i) ||
=======
    extractLabeledLocation(text, ['ship from', 'shipping from', 'pickup location', 'pickup from', 'from']) ||
    text.match(/pick\s*up\s+from\s+(?:the\s+)?([a-z0-9-]+)/i)?.[1] ||
    text.match(/pickup\s+from\s+(?:the\s+)?([a-z0-9-]+)/i)?.[1] ||
    text.match(/\bfrom\s+(?:the\s+)?([a-z0-9][a-z0-9\s#.,/-]{1,80})/i)?.[1] ||
    '';

  const toLocation =
    extractLabeledLocation(text, ['ship to', 'shipping to', 'deliver to', 'delivery location', 'drop off', 'dropoff', 'to']) ||
    text.match(/taken\s+directly\s+to\s+([a-z0-9-]+)/i)?.[1] ||
    text.match(/directly\s+to\s+([a-z0-9-]+)/i)?.[1] ||
    text.match(/deliver\s+to\s+([a-z0-9][a-z0-9\s#.,/-]{1,80})/i)?.[1] ||
    text.match(/\bto\s+([a-z0-9][a-z0-9\s#.,/-]{1,80})/i)?.[1] ||
>>>>>>> 23a8eab3 (Fix delivery intake and add P-touch label export)
    '';

  const isPickup =
    lower.includes('pickup') ||
    lower.includes('pick up') ||
    Boolean(fromLocation && toLocation);

  const pickupLocation = fromLocation || 'WH';
  const dropoffLocation = toLocation || 'SEA991';

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
    text.match(/\b(?:ref|reference|request|shipment|transfer)\s*#?\s*[:\-]?\s*([A-Z0-9][A-Z0-9-]{2,})/i)?.[1]?.toUpperCase() ||
    text.match(/\b(B\d{3,}-\d{4,})\b/i)?.[1]?.toUpperCase() ||
    ''
  );
}

function extractLineItems(text: string): ExtractedLineItem[] {
  const items: ExtractedLineItem[] = [];
  const seen = new Set<string>();

  const patterns = [
<<<<<<< HEAD
    /\bqty\s*(\d+)\s+(?:of\s+)?(?:PN\s*#?\s*)?([A-Z0-9][A-Z0-9-_./]{2,})(?:[ \t]+([^\r\n]+))?/gi,
    /\b(\d+)\s*(?:pcs|pc|pieces|piece|ea|each|x)\s+(?:PN\s*#?\s*)?([A-Z0-9][A-Z0-9-_./]{2,})(?:[ \t]+([^\r\n]+))?/gi,
=======
    /\bqty\s*[:#-]?\s*(\d+)\s+(?:of\s+)?(?:PN|P\/N|part(?:\s*number)?|item)?\s*#?\s*([A-Z0-9][A-Z0-9-_./]{2,})(?:\s+([^\r\n]+))?/gi,
    /\b(\d+)\s*(?:pcs|pc|pieces|piece|ea|each|x)\s+(?:PN|P\/N|part(?:\s*number)?|item)?\s*#?\s*([A-Z0-9][A-Z0-9-_./]{2,})(?:\s+([^\r\n]+))?/gi,
    /\b(?:PN|P\/N|part(?:\s*number)?|item)\s*#?\s*[:\-]?\s*([A-Z0-9][A-Z0-9-_./]{2,}).{0,80}?\b(?:qty|quantity)\s*[:#-]?\s*(\d+)(?:\s+([^\r\n]+))?/gi,
>>>>>>> 23a8eab3 (Fix delivery intake and add P-touch label export)
  ];

  patterns.forEach((pattern, patternIndex) => {
    for (const match of Array.from(text.matchAll(pattern))) {
      const qty = Number(patternIndex === 2 ? match[2] : match[1]) || 1;
      const partNumber = (patternIndex === 2 ? match[1] : match[2]).replace(/[,.]$/, '').toUpperCase();
      const description = (match[3] || '').trim();
      const key = `${qty}-${partNumber}-${description}`;

      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        quantity: qty,
        part_number: partNumber,
        description,
        uom: 'EA',
        notes: '',
      });
    }
  });

  return items;
}

<<<<<<< HEAD
function isDeliveryWorkflow(workflow: Workflow) {
  return (
    workflow === 'delivery' ||
    workflow === 'pickup' ||
    workflow === 'pickup_delivery' ||
    workflow === 'manifest' ||
    workflow === 'delivery_receipt'
  );
=======
function coerceDeliveryExtraction(value: any, rawText: string): DeliveryExtraction | null {
  if (!value || typeof value !== 'object') return null;
  const header = value.header && typeof value.header === 'object' ? value.header : {};
  const lineItems = Array.isArray(value.line_items) ? value.line_items : [];

  return {
    workflow: 'delivery',
    header: {
      direction:
        header.direction === 'delivery' || header.direction === 'outgoing'
          ? 'delivery'
          : header.direction === 'pickup' || header.direction === 'incoming'
            ? 'pickup'
            : 'unknown',
      company_name: clean(header.company_name) || null,
      pickup_location: clean(header.pickup_location ?? header.ship_from) || null,
      dropoff_location: clean(header.dropoff_location ?? header.ship_to) || null,
      contact_name: clean(header.contact_name) || null,
      contact_phone: extractPhone(clean(header.contact_phone)) || null,
      contact_email: clean(header.contact_email) || null,
      requested_date: clean(header.requested_date) || null,
      requested_time: clean(header.requested_time) || null,
      shipment_transfer_id: clean(header.shipment_transfer_id) || null,
      project_or_work_order: clean(header.project_or_work_order) || null,
      carrier_or_driver: clean(header.carrier_or_driver) || null,
      notes: clean(header.notes) || rawText || null,
      po_number: clean(header.po_number) || null,
    } as DeliveryExtraction['header'] & { po_number: string | null },
    line_items: lineItems.map((item) => ({
      description: clean(item.description) || null,
      part_number: clean(item.part_number) || null,
      quantity:
        typeof item.quantity === 'number'
          ? item.quantity
          : typeof item.qty === 'number'
            ? item.qty
            : Number(item.quantity ?? item.qty) || null,
      serial_numbers: Array.isArray(item.serial_numbers) ? item.serial_numbers.filter(Boolean) : [],
      notes: clean(item.notes) || null,
    })),
    confidence: value.confidence && typeof value.confidence === 'object' ? value.confidence : {},
    missing_required_fields: Array.isArray(value.missing_required_fields)
      ? value.missing_required_fields.filter(Boolean)
      : [],
    warnings: Array.isArray(value.warnings) ? value.warnings.filter(Boolean) : [],
  };
}

function responseText(data: any) {
  if (typeof data?.output_text === 'string') return data.output_text;

  return (data?.output ?? [])
    .flatMap((item: any) => item?.content ?? [])
    .map((content: any) => content?.text ?? '')
    .filter(Boolean)
    .join('\n');
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

async function extractDeliveryWithOpenAI(source: StoredIntakeSource | undefined, textHint: string) {
  if (!source || source.source_type === 'text' || !source.file_base64 || !process.env.OPENAI_API_KEY) {
    return null;
  }

  const content: any[] = [
    {
      type: 'input_text',
      text: [
        deliveryExtractionPrompt,
        'Return one JSON object matching this shape: {"workflow":"delivery","header":{"direction":"pickup|delivery|unknown","company_name":null,"pickup_location":null,"dropoff_location":null,"contact_name":null,"contact_phone":null,"contact_email":null,"requested_date":null,"requested_time":null,"shipment_transfer_id":null,"project_or_work_order":null,"carrier_or_driver":null,"po_number":null,"notes":null},"line_items":[{"part_number":null,"description":null,"quantity":null,"serial_numbers":[],"notes":null}],"confidence":{},"missing_required_fields":[],"warnings":[]}.',
        textHint ? `Additional pasted text:\n${textHint}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ];

  if (source.source_type === 'pdf') {
    content.push({
      type: 'input_file',
      filename: source.original_filename || 'intake.pdf',
      file_data: source.file_base64,
    });
  } else {
    content.push({
      type: 'input_image',
      image_url: `data:${source.mime_type || 'image/png'};base64,${source.file_base64}`,
    });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: intakeModelName(),
      input: [{ role: 'user', content }],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI intake extraction failed: ${errorText || response.statusText}`);
  }

  const data = await response.json();
  return coerceDeliveryExtraction(parseJsonObject(responseText(data)), textHint);
}

function heuristicDeliveryExtraction(rawText: string, warnings: string[] = []): DeliveryExtraction {
  const locations = extractLocations(rawText);
  const lineItems = extractLineItems(rawText);
  const poNumber = extractPoNumber(rawText);

  return {
    workflow: 'delivery',
    header: {
      direction: locations.direction === 'incoming' ? 'pickup' : 'delivery',
      company_name: null,
      pickup_location: locations.pickup_location,
      dropoff_location: locations.dropoff_location,
      contact_name: extractPocName(rawText) || null,
      contact_phone: extractPhone(rawText) || null,
      contact_email: extractEmail(rawText) || null,
      requested_date: null,
      requested_time: extractRequestedTime(rawText, locations.pickup_location),
      shipment_transfer_id: poNumber || null,
      project_or_work_order: poNumber || null,
      carrier_or_driver: null,
      notes: rawText || null,
      po_number: poNumber || null,
    } as DeliveryExtraction['header'] & { po_number: string | null },
    line_items: lineItems.map((item) => ({
      part_number: item.part_number,
      description: item.description || null,
      quantity: item.quantity,
      serial_numbers: [],
      notes: item.notes || null,
    })),
    confidence: {},
    missing_required_fields: [],
    warnings,
  };
>>>>>>> 23a8eab3 (Fix delivery intake and add P-touch label export)
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
      source?: StoredIntakeSource;
    };

    const documentId = clean(body.document_id);
    const workflow = body.workflow_type || 'delivery';
    const rawText = [body.raw_text, body.source?.raw_text]
      .map(clean)
      .filter(Boolean)
      .join('\n\n');

    if (!canUseWorkflow(profile.role, workflow)) {
      return NextResponse.json(
        { ok: false, message: 'You do not have permission to process that workflow.' },
        { status: 403 }
      );
    }

    if (!documentId) {
      return NextResponse.json({ ok: false, message: 'document_id is required.' }, { status: 400 });
    }

    if (!isDeliveryWorkflow(workflow)) {
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

<<<<<<< HEAD
    const locations = extractLocations(rawText);
    const lineItems = extractLineItems(rawText);
    const poNumber = extractPoNumber(rawText);
    const hasLowConfidence = !lineItems.length || !locations.pickup_location || !locations.dropoff_location;

    return NextResponse.json({
      ok: true,
      extraction: {
        workflow: 'delivery',
        header: {
          direction: locations.direction,
          company_name: '',
          pickup_location: locations.pickup_location,
          dropoff_location: locations.dropoff_location,
          ship_from: locations.pickup_location,
          ship_to: locations.dropoff_location,
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
        confidence: hasLowConfidence
          ? { extraction: 0.5 }
          : { extraction: 0.86 },
        missing_required_fields: [],
        warnings: [
          ...(rawText ? [] : ['No pasted text found. Paste the email text for accurate extraction.']),
          ...(hasLowConfidence
            ? ['Low confidence extraction. Draft fields were populated for review and manual edits.']
            : []),
        ],
      },
=======
    const aiExtraction = await extractDeliveryWithOpenAI(body.source, rawText);
    const extraction =
      aiExtraction ??
      heuristicDeliveryExtraction(
        rawText,
        rawText
          ? []
          : body.source?.source_type === 'image' || body.source?.source_type === 'pdf'
            ? ['Uploaded file was accepted, but no text could be extracted without OCR/vision configuration.']
            : ['No pasted text found. Paste the email text for accurate extraction.']
      );

    return NextResponse.json({
      ok: true,
      extraction,
>>>>>>> 23a8eab3 (Fix delivery intake and add P-touch label export)
      validation_issues: [],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Extraction failed.' },
      { status: 500 }
    );
  }
}
