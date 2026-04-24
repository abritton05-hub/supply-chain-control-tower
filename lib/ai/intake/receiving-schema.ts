const nullableString = {
  type: ['string', 'null'],
} as const;

const nullableNumber = {
  type: ['number', 'null'],
} as const;

export const receivingExtractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    workflow: {
      type: 'string',
      enum: ['receiving'],
    },
    header: {
      type: 'object',
      additionalProperties: false,
      properties: {
        vendor_name: nullableString,
        po_number: nullableString,
        shipment_id: nullableString,
        tracking_number: nullableString,
        carrier: nullableString,
        received_date: nullableString,
        ship_from: nullableString,
        reference_number: nullableString,
      },
      required: [
        'vendor_name',
        'po_number',
        'shipment_id',
        'tracking_number',
        'carrier',
        'received_date',
        'ship_from',
        'reference_number',
      ],
    },
    line_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          part_number: nullableString,
          description: nullableString,
          qty: nullableNumber,
          uom: nullableString,
          serial_numbers: {
            type: 'array',
            items: { type: 'string' },
          },
          lot_number: nullableString,
          location: nullableString,
        },
        required: [
          'part_number',
          'description',
          'qty',
          'uom',
          'serial_numbers',
          'lot_number',
          'location',
        ],
      },
    },
    confidence: {
      type: 'object',
      additionalProperties: false,
      properties: {
        vendor_name: { type: 'number' },
        po_number: { type: 'number' },
        shipment_id: { type: 'number' },
        tracking_number: { type: 'number' },
        carrier: { type: 'number' },
        received_date: { type: 'number' },
        ship_from: { type: 'number' },
        reference_number: { type: 'number' },
        line_items: { type: 'number' },
        part_number: { type: 'number' },
        description: { type: 'number' },
        qty: { type: 'number' },
        uom: { type: 'number' },
        serial_numbers: { type: 'number' },
        lot_number: { type: 'number' },
        location: { type: 'number' },
      },
      required: [
        'vendor_name',
        'po_number',
        'shipment_id',
        'tracking_number',
        'carrier',
        'received_date',
        'ship_from',
        'reference_number',
        'line_items',
        'part_number',
        'description',
        'qty',
        'uom',
        'serial_numbers',
        'lot_number',
        'location',
      ],
    },
    missing_required_fields: {
      type: 'array',
      items: { type: 'string' },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['workflow', 'header', 'line_items', 'confidence', 'missing_required_fields', 'warnings'],
} as const;
