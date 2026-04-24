import type { ConfirmableIntakeWorkflow, SupportedIntakeWorkflow } from './types';

export const SUPPORTED_INTAKE_WORKFLOWS: SupportedIntakeWorkflow[] = [
  'receiving',
  'pull_request',
  'delivery',
  'unknown',
];

export const CONFIRMABLE_INTAKE_WORKFLOWS: ConfirmableIntakeWorkflow[] = [
  'receiving',
  'pull_request',
  'delivery',
];

export const AI_INTAKE_PROMPT_VERSION = 'ai-intake-phase-1.0';

export const AI_INTAKE_STORAGE_BUCKET = 'ai-intake-documents';

export const DEFAULT_AI_INTAKE_MODEL = 'gpt-4o-mini';

export const AI_INTAKE_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const AI_INTAKE_ORGANIZATION_ID =
  process.env.AI_INTAKE_ORGANIZATION_ID ?? '00000000-0000-0000-0000-000000000000';

export function intakeModelName() {
  return process.env.OPENAI_INTAKE_MODEL ?? DEFAULT_AI_INTAKE_MODEL;
}