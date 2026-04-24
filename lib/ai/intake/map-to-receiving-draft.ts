import type { ReceivingDraftPayload, ReceivingExtraction } from './types';

function text(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export function mapToReceivingDraft(extraction: ReceivingExtraction): ReceivingDraftPayload {
  const firstLine = extraction.line_items[0];
  const reference =
    text(extraction.header.po_number) ||
    text(extraction.header.reference_number) ||
    text(extraction.header.shipment_id) ||
    text(extraction.header.tracking_number);

  const notes = [
    extraction.header.vendor_name && `Vendor: ${extraction.header.vendor_name}`,
    extraction.header.carrier && `Carrier: ${extraction.header.carrier}`,
    extraction.header.ship_from && `Ship from: ${extraction.header.ship_from}`,
    extraction.header.tracking_number && `Tracking: ${extraction.header.tracking_number}`,
    extraction.warnings.length ? `AI warnings: ${extraction.warnings.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    item_id: '',
    part_number: text(firstLine?.part_number),
    description: text(firstLine?.description),
    quantity: firstLine?.qty && firstLine.qty > 0 ? firstLine.qty : 1,
    reference,
    notes,
    is_supply: false,
  };
}
