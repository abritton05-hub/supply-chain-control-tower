import 'server-only';

import OpenAI from 'openai';
import type {
  ResponseFormatTextJSONSchemaConfig,
  ResponseInput,
  ResponseInputContent,
} from 'openai/resources/responses/responses';
import { intakeClassificationSchema } from '@/lib/ai/intake/classification-schema';
import { intakeModelName } from '@/lib/ai/intake/constants';
import { pullRequestExtractionSchema } from '@/lib/ai/intake/pull-request-schema';
import { receivingExtractionSchema } from '@/lib/ai/intake/receiving-schema';
import {
  classifierPrompt,
  pullRequestExtractionPrompt,
  receivingExtractionPrompt,
} from '@/lib/ai/intake/prompts';
import type {
  IntakeClassification,
  PullRequestExtraction,
  ReceivingExtraction,
  StoredIntakeSource,
} from '@/lib/ai/intake/types';

type StructuredFormat = {
  name: string;
  description: string;
  schema: Record<string, unknown>;
};

function openAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY. Add it to .env.local before using AI intake.');
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function sourceContent(source: StoredIntakeSource): ResponseInputContent[] {
  if (source.source_type === 'text') {
    return [
      {
        type: 'input_text',
        text: `Source kind: pasted text\n\n${source.raw_text}`,
      },
    ];
  }

  const filename = source.original_filename ?? `intake.${source.source_type === 'pdf' ? 'pdf' : 'png'}`;

  if (source.source_type === 'pdf') {
    return [
      {
        type: 'input_text',
        text: `Source kind: uploaded PDF\nFilename: ${filename}`,
      },
      {
        type: 'input_file',
        filename,
        file_data: source.file_base64,
      },
    ];
  }

  return [
    {
      type: 'input_text',
      text: `Source kind: uploaded image or screenshot\nFilename: ${filename}`,
    },
    {
      type: 'input_image',
      detail: 'high',
      image_url: `data:${source.mime_type};base64,${source.file_base64}`,
    },
  ];
}

async function structuredResponse<T>(
  prompt: string,
  source: StoredIntakeSource,
  format: StructuredFormat
): Promise<T> {
  const input: ResponseInput = [
    {
      role: 'user',
      content: sourceContent(source),
    },
  ];

  const textFormat: ResponseFormatTextJSONSchemaConfig = {
    type: 'json_schema',
    name: format.name,
    description: format.description,
    strict: true,
    schema: format.schema,
  };

  const response = await openAIClient().responses.create({
    model: intakeModelName(),
    instructions: prompt,
    input,
    text: {
      format: textFormat,
    },
  });

  if (!response.output_text.trim()) {
    throw new Error('OpenAI returned an empty structured output.');
  }

  return JSON.parse(response.output_text) as T;
}

export async function classifyIntakeDocument(source: StoredIntakeSource) {
  return structuredResponse<IntakeClassification>(classifierPrompt, source, {
    name: 'ai_intake_classification',
    description: 'Classifies an operational intake document into a supported workflow.',
    schema: intakeClassificationSchema,
  });
}

export async function extractReceivingDocument(source: StoredIntakeSource) {
  return structuredResponse<ReceivingExtraction>(receivingExtractionPrompt, source, {
    name: 'receiving_intake_extraction',
    description: 'Extracts a receiving draft for human review.',
    schema: receivingExtractionSchema,
  });
}

export async function extractPullRequestDocument(source: StoredIntakeSource) {
  return structuredResponse<PullRequestExtraction>(pullRequestExtractionPrompt, source, {
    name: 'pull_request_intake_extraction',
    description: 'Extracts a pull request draft for human review.',
    schema: pullRequestExtractionSchema,
  });
}
