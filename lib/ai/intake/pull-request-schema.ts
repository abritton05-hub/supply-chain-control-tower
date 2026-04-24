const nullableString = {
  type: ['string', 'null'],
} as const;

const nullableNumber = {
  type: ['number', 'null'],
} as const;

export const pullRequestExtractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    workflow: {
      type: 'string',
      enum: ['pull_request'],
    },
    header: {
      type: 'object',
      additionalProperties: false,
      properties: {
        requestor_name: nullableString,
        request_date: nullableString,
        department: nullableString,
        project_code: nullableString,
        needed_by_date: nullableString,
        location: nullableString,
        notes: nullableString,
      },
      required: [
        'requestor_name',
        'request_date',
        'department',
        'project_code',
        'needed_by_date',
        'location',
        'notes',
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
          qty_requested: nullableNumber,
          uom: nullableString,
        },
        required: ['part_number', 'description', 'qty_requested', 'uom'],
      },
    },
    confidence: {
      type: 'object',
      additionalProperties: false,
      properties: {
        requestor_name: { type: 'number' },
        request_date: { type: 'number' },
        department: { type: 'number' },
        project_code: { type: 'number' },
        needed_by_date: { type: 'number' },
        location: { type: 'number' },
        notes: { type: 'number' },
        line_items: { type: 'number' },
        part_number: { type: 'number' },
        description: { type: 'number' },
        qty_requested: { type: 'number' },
        uom: { type: 'number' },
      },
      required: [
        'requestor_name',
        'request_date',
        'department',
        'project_code',
        'needed_by_date',
        'location',
        'notes',
        'line_items',
        'part_number',
        'description',
        'qty_requested',
        'uom',
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
