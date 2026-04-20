export const intakeClassificationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    document_type: {
      type: 'string',
      enum: ['receiving', 'pull_request', 'unknown'],
    },
    confidence: {
      type: 'number',
    },
    alternate_types: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: {
            type: 'string',
            enum: ['receiving', 'pull_request', 'unknown'],
          },
          confidence: {
            type: 'number',
          },
        },
        required: ['type', 'confidence'],
      },
    },
    reason_codes: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
  required: ['document_type', 'confidence', 'alternate_types', 'reason_codes'],
} as const;
