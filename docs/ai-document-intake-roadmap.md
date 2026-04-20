# AI Document Intake Roadmap

## Goal

Add an AI-assisted intake workflow that accepts screenshots, PDFs, images, pasted text, and email content, then classifies the document and prefills the correct operational form for user review.

The assistant is not a generic chat surface. It is a structured intake helper that turns messy source documents into draft workflow records.

## Target Workflows

- Receiving
- Pull Requests
- BOM / Manifest
- Inventory Add

## Product Principles

- Classify first, extract second.
- Never post or save operational records without explicit user confirmation.
- Prefer form-prefill and review panels over chat responses.
- Show field-level confidence and source evidence.
- Keep the existing import-preview posture: users confirm, edit, reject, or cancel before save.
- Treat low-confidence or missing required fields as incomplete drafts, not failed chats.

## Intake Flow

1. User uploads or pastes source content.
2. System creates a temporary intake draft with source metadata.
3. AI classifies the document as one target workflow or `unknown`.
4. AI extracts into the matching workflow schema.
5. Server validates extracted values against existing business rules.
6. UI opens a review panel with extracted fields, confidence, source snippets, and validation notes.
7. User confirms, edits, rejects individual fields, or cancels the draft.
8. Existing save actions run only after user confirmation.

## AI Contract

Use a structured output response with this top-level shape:

```json
{
  "classification": {
    "workflow": "receiving | pull_request | bom_manifest | inventory_add | unknown",
    "confidence": 0.0,
    "reason": "short operational reason"
  },
  "extraction": {
    "fields": {},
    "line_items": []
  },
  "field_confidence": {},
  "evidence": {},
  "warnings": []
}
```

Implementation notes:

- Use an allowlist enum for workflow classification.
- Require the model to emit `unknown` when the source does not map cleanly to the supported workflows.
- Keep one JSON schema per workflow so the result can hydrate the existing form types.
- Store the raw model result separately from the user-edited draft.
- Persist confidence values as advisory metadata only. Business validation remains server-side.

OpenAI implementation references:

- File inputs can be sent to the Responses API as base64 data, uploaded file IDs, or external URLs. PDF handling can include extracted text plus page images for vision-capable models: https://developers.openai.com/api/docs/guides/file-inputs
- Structured Outputs with the Responses API use `text.format` and a JSON schema: https://developers.openai.com/api/docs/guides/migrate-to-responses
- Image and file inputs have platform data-control considerations that should be reviewed before production rollout: https://developers.openai.com/api/docs/guides/your-data

## Workflow Schemas

### Receiving

Prefill the existing receiving form and import preview fields:

- `item_id`
- `part_number`
- `description`
- `quantity`
- `reference`
- `performed_by`
- `notes`
- line-level `source_row_number`

Validation:

- Match inventory by item ID first, then part number.
- Require positive quantity.
- Mark unmatched item references as incomplete.
- Do not call `receive_inventory_item` until the user confirms.

### Pull Requests

Create a draft material pull request schema before building the save action:

- `requester`
- `department`
- `project_or_work_order`
- `needed_by`
- `priority`
- `delivery_location`
- `line_items`
- `notes`

Line items:

- `item_id`
- `part_number`
- `description`
- `requested_quantity`
- `unit`
- `reason`

Validation:

- Require requester or department.
- Require at least one line item.
- Treat item lookup failures as review-required, not fatal.

### BOM / Manifest

Classify as `bom_manifest` when the document includes build/shipment material lines, release authorization, or manifest-style transfer details.

Header fields:

- `document_title`
- `bom_number` or `manifest_number`
- `project_or_work_order`
- `from_location`
- `to_location`
- `driver_carrier`
- `vehicle`
- `authorized_for_release_by`
- `received_by`
- `notes`

Line items:

- `item_id`
- `part_number`
- `description`
- `quantity`
- `serial_number`
- `lot_number`

Validation:

- Route BOM-like documents to BOM review and manifest-like documents to manifest review.
- Require user selection if classification confidence is low between BOM and manifest.
- Do not print, save, or post movement records until confirmation.

### Inventory Add

Prefill the existing inventory add fields:

- `item_id`
- `part_number`
- `description`
- `category`
- `location`
- `qty_on_hand`
- `reorder_point`

Validation:

- Use existing duplicate detection for `item_id`.
- Treat missing description as incomplete.
- Require user confirmation before creating or updating inventory.

## Confidence UX

Field confidence should be visible beside each prefilled value:

- High: saveable after normal validation.
- Medium: saveable, but visually marked for review.
- Low: require user edit, reject, or explicit acceptance before save.
- Missing: render as blank with a prompt to complete.

Each extracted value should support:

- Accept value.
- Edit value.
- Reject value.
- View source evidence when available.

Suggested UI reuse:

- Extend `ImportReviewModal` with optional field confidence and evidence metadata.
- Add a form-review variant for single-record intake drafts.
- Use the existing summary pattern for counts: high confidence, needs review, missing required, rejected.

## Data Model

Add an intake audit table before production API wiring:

```sql
create table public.ai_intake_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by text,
  source_kind text not null,
  source_name text,
  source_mime_type text,
  classification_workflow text not null,
  classification_confidence numeric not null,
  model_name text not null,
  raw_result jsonb not null,
  user_review jsonb,
  status text not null default 'draft'
);
```

Status values:

- `draft`
- `reviewed`
- `accepted`
- `rejected`
- `expired`

Retention:

- Store only what is needed for audit and review.
- Prefer deleting uploaded source files after extraction unless a business audit requirement says otherwise.
- Avoid sending documents to web-search tools; this is private operational intake.

## API Shape

Recommended route handlers:

- `POST /api/ai-intake/classify` creates a draft classification.
- `POST /api/ai-intake/extract` extracts into a workflow schema.
- `PATCH /api/ai-intake/drafts/[id]` stores user review edits.
- Existing workflow save actions remain the only paths that write business records.

Server actions can call these routes, but the write boundary should stay clear:

- AI routes create or update intake drafts.
- Workflow actions create receiving, pull request, BOM/manifest, or inventory records.

## Phased Delivery

### Phase 1: Foundations

- Add workflow-specific extraction schemas.
- Add `ai_intake_drafts` storage.
- Add shared confidence/evidence types.
- Build a single intake review component.
- Wire pasted text only for Receiving and Inventory Add.

### Phase 2: Files

- Add PDF and image upload support.
- Add source file size and type validation.
- Add evidence snippets or page references.
- Add email paste support with sender, subject, body, and attachment metadata.

### Phase 3: Workflow Coverage

- Add Pull Request draft creation.
- Add BOM / Manifest split review.
- Add inventory matching and duplicate warnings across all workflows.
- Add audit trail entries when user accepts or rejects extracted fields.

### Phase 4: Operational Hardening

- Add eval samples for each document type.
- Add low-confidence regression tests.
- Add retention controls and cleanup job.
- Add rate limiting and cost guardrails.
- Add admin-visible intake history.

## Acceptance Criteria

- Every intake result has one classification before any field extraction is applied.
- Every saved record requires a user click after the review screen is rendered.
- Low-confidence required fields cannot silently pass as confirmed values.
- Users can edit or reject extracted fields before save.
- Unknown documents do not map into arbitrary workflows.
- Existing CSV/Excel import flows still work without AI.
- AI failures leave the app operational through manual forms and existing imports.

## Non-Goals

- No autonomous posting to receiving or inventory.
- No free-form chatbot for operational commands.
- No training on customer documents unless explicitly approved under a separate data policy.
- No replacement for server-side validation or existing Supabase constraints.
