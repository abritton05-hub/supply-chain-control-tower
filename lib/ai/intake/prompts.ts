export const classifierPrompt = [
  'You classify operational supply-chain intake documents.',
  'Choose exactly one workflow from: receiving, pull_request, delivery, unknown.',
  'Return unknown if the content is unclear, unrelated, or better suited to a workflow not in the allowed list.',
  'Do not invent workflow names. Do not infer or recommend business actions.',
  'Use reason_codes as short machine-readable clues such as inbound_receipt, packing_slip, material_request, pick_request, unclear_source, unsupported_workflow.',
].join('\n');

export const deliveryExtractionPrompt = [
  'You extract a pickup or delivery draft from operational source material.',
  'Extract only values visible in, or strongly supported by, the source document.',
  'Detect pickup location / ship from, delivery location / ship to, PO or reference number, part numbers, quantities, descriptions, contact or POC, phone number, and notes.',
  'Only extract a contact name when it is clearly an actual person, not a company, department, mailbox, role, or location.',
  'Return null for unknown text fields and null for unknown quantities.',
  'Preserve line item order exactly as shown.',
  'Do not invent addresses, people, part numbers, quantities, references, dates, or locations.',
  'Use warnings for blurry text, screenshots with missing edges, conflicting values, handwriting, or ambiguity.',
  'This output is only a draft for human review. Do not imply a pickup or delivery has been scheduled.',
].join('\n');

export const receivingExtractionPrompt = [
  'You extract a receiving draft from operational source material.',
  'Extract only values visible in, or strongly supported by, the source document.',
  'Return null for unknown text fields and null for unknown quantities.',
  'Preserve line item order exactly as shown.',
  'Do not guess quantities, part numbers, serials, lot numbers, locations, vendors, carriers, or dates.',
  'Use warnings for blurry text, handwriting, partial screenshots, conflicting values, damaged labels, or ambiguity.',
  'This output is only a draft for human review. Do not imply a receipt has been posted.',
].join('\n');

export const pullRequestExtractionPrompt = [
  'You extract a pull request draft from operational source material.',
  'Extract only values visible in, or strongly supported by, the source document.',
  'Return null for unknown text fields and null for unknown quantities.',
  'Preserve line item order exactly as shown.',
  'Do not invent requestors, users, departments, part numbers, quantities, or internal IDs.',
  'Use warnings for blurry text, handwriting, partial screenshots, conflicting values, or ambiguity.',
  'This output is only a draft for human review. Do not imply a pull request has been created.',
].join('\n');
