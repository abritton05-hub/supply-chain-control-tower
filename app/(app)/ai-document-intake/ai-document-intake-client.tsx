'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PULL_REQUEST_DRAFT_STORAGE_KEY,
  RECEIVING_DRAFT_STORAGE_KEY,
} from '@/lib/ai/intake/draft-storage';
import {
  confidenceBand,
  confidenceBandLabel,
  isConfirmableWorkflow,
} from '@/lib/ai/intake/types';
import type {
  ConfirmableIntakeWorkflow,
  IntakeClassification,
  IntakeExtraction,
  IntakeReviewDraftPayload,
  PullRequestExtraction,
  ReceivingExtraction,
  SupportedIntakeWorkflow,
  ValidationIssue,
} from '@/lib/ai/intake/types';

type UploadResult = {
  ok: boolean;
  document_id?: string;
  source_type?: 'image' | 'pdf' | 'text';
  original_filename?: string | null;
  mime_type?: string | null;
  message?: string;
};

type ClassifyResult =
  | {
      ok: true;
      classification: IntakeClassification;
    }
  | {
      ok: false;
      message: string;
    };

type ExtractResult =
  | {
      ok: true;
      extraction: IntakeExtraction;
      validation_issues: ValidationIssue[];
    }
  | {
      ok: false;
      message: string;
      manual_selection_needed?: boolean;
      classification?: IntakeClassification;
    };

type ApplyResult =
  | {
      ok: true;
      route: '/receiving' | '/pull-requests' | null;
      draft: IntakeReviewDraftPayload | null;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

type IntakeStage = 'idle' | 'uploaded' | 'classified' | 'extracted' | 'applied' | 'rejected';

type SourcePreview = {
  label: string;
  detail: string;
  text: string;
  imageUrl: string;
};

function workflowLabel(workflow: SupportedIntakeWorkflow) {
  if (workflow === 'receiving') return 'Receiving';
  if (workflow === 'pull_request') return 'Pull Request';
  return 'Unknown';
}

function confidenceClass(value: number | null | undefined) {
  const band = confidenceBand(value);
  if (band === 'high') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (band === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

function FieldConfidence({ value }: { value: number | null | undefined }) {
  return (
    <span className={`rounded border px-2 py-1 text-xs font-semibold ${confidenceClass(value)}`}>
      {confidenceBandLabel(value)}
    </span>
  );
}

function fieldValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function toText(value: string | null) {
  return value ?? '';
}

function fromText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberFromInput(value: string) {
  if (!value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function AiDocumentIntakeClient() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [sourcePreview, setSourcePreview] = useState<SourcePreview | null>(null);
  const [documentId, setDocumentId] = useState('');
  const [classification, setClassification] = useState<IntakeClassification | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<ConfirmableIntakeWorkflow>('receiving');
  const [extraction, setExtraction] = useState<IntakeExtraction | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [editedFields, setEditedFields] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [stage, setStage] = useState<IntakeStage>('idle');
  const [isUploading, setIsUploading] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const canExtract = documentId && classification;
  const weakClassification = !classification || classification.confidence < 0.85 || classification.document_type === 'unknown';

  const issueGroups = useMemo(
    () => ({
      errors: validationIssues.filter((issue) => issue.severity === 'error'),
      warnings: validationIssues.filter((issue) => issue.severity === 'warning'),
    }),
    [validationIssues]
  );

  function markEdited(field: string) {
    setEditedFields((prev) => (prev.includes(field) ? prev : [...prev, field]));
  }

  function resetIntake() {
    setSelectedFile(null);
    setPastedText('');
    setSourcePreview(null);
    setDocumentId('');
    setClassification(null);
    setExtraction(null);
    setValidationIssues([]);
    setEditedFields([]);
    setMessage('');
    setStage('idle');
  }

  function handleFile(file: File | null) {
    setSelectedFile(file);
    setPastedText('');
    setDocumentId('');
    setClassification(null);
    setExtraction(null);
    setValidationIssues([]);
    setEditedFields([]);

    if (!file) {
      setSourcePreview(null);
      return;
    }

    const imageUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    setSourcePreview({
      label: file.name || 'Uploaded file',
      detail: `${file.type || 'Unknown type'} · ${Math.ceil(file.size / 1024)} KB`,
      text: '',
      imageUrl,
    });
  }

  function handleText(value: string) {
    setPastedText(value);
    setSelectedFile(null);
    setDocumentId('');
    setClassification(null);
    setExtraction(null);
    setValidationIssues([]);
    setEditedFields([]);
    setSourcePreview(
      value.trim()
        ? {
            label: 'Pasted Text',
            detail: 'Text intake source',
            text: value,
            imageUrl: '',
          }
        : null
    );
  }

  async function uploadSource() {
    setMessage('');
    setIsUploading(true);

    try {
      let response: Response;

      if (selectedFile) {
        const formData = new FormData();
        formData.set('file', selectedFile);
        response = await fetch('/api/ai/intake/upload', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch('/api/ai/intake/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_text: pastedText }),
        });
      }

      const result = (await response.json()) as UploadResult;

      if (!response.ok || !result.ok || !result.document_id) {
        setMessage(result.message || 'Upload failed.');
        return;
      }

      setDocumentId(result.document_id);
      setStage('uploaded');
      setMessage('Source uploaded. Classify it before extracting fields.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  async function classifyDocument() {
    if (!documentId) return;
    setMessage('');
    setIsClassifying(true);

    try {
      const response = await fetch('/api/ai/intake/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId }),
      });
      const result = (await response.json()) as ClassifyResult;

      if (!response.ok) {
        setMessage(result.ok ? 'Classification failed.' : result.message);
        return;
      }

      if (!result.ok) {
        setMessage(result.message || 'Classification failed.');
        return;
      }

      setClassification(result.classification);
      if (isConfirmableWorkflow(result.classification.document_type)) {
        setSelectedWorkflow(result.classification.document_type);
      }
      setStage('classified');
      setMessage('Classification complete. Review the workflow before extraction.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Classification failed.');
    } finally {
      setIsClassifying(false);
    }
  }

  async function extractDocument() {
    if (!documentId || !classification) return;
    setMessage('');
    setIsExtracting(true);

    try {
      const response = await fetch('/api/ai/intake/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          workflow_type: selectedWorkflow,
        }),
      });
      const result = (await response.json()) as ExtractResult;

      if (!response.ok) {
        setMessage(result.ok ? 'Extraction failed.' : result.message);
        return;
      }

      if (!result.ok) {
        setMessage(result.message || 'Extraction failed.');
        return;
      }

      setExtraction(result.extraction);
      setValidationIssues(result.validation_issues);
      setEditedFields([]);
      setStage('extracted');
      setMessage('Fields extracted. Review, edit, or reject before applying to a draft.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Extraction failed.');
    } finally {
      setIsExtracting(false);
    }
  }

  async function applyReview(status: 'approved' | 'edited' | 'rejected') {
    if (!documentId) return;
    setMessage('');
    setIsApplying(true);

    try {
      const response = await fetch('/api/ai/intake/review/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          selected_workflow_type: selectedWorkflow,
          review_status: status,
          reviewed_data: extraction ?? {},
          edited_fields: editedFields,
        }),
      });
      const result = (await response.json()) as ApplyResult;

      if (!response.ok || !result.ok) {
        setMessage(result.message || 'Review action failed.');
        return;
      }

      if (status === 'rejected') {
        setStage('rejected');
        setMessage(result.message);
        return;
      }

      if (!result.draft || !result.route) {
        setMessage('Review was saved, but no draft payload was returned.');
        return;
      }

      const storageKey =
        result.draft.workflow_type === 'receiving'
          ? RECEIVING_DRAFT_STORAGE_KEY
          : PULL_REQUEST_DRAFT_STORAGE_KEY;
      window.localStorage.setItem(storageKey, JSON.stringify(result.draft.draft));
      setStage('applied');
      router.push(`${result.route}?draft=ai-intake`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Review action failed.');
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
      <section className="space-y-4">
        <div className="erp-panel p-4">
          <h2 className="text-base font-semibold text-slate-900">Source</h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload a PDF or image, or paste operational text from an email or note.
          </p>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">PDF, Image, Screenshot</span>
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Pasted Text</label>
              <textarea
                value={pastedText}
                onChange={(event) => handleText(event.target.value)}
                rows={8}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Paste receiving details, packing slip text, request notes, or email content"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={uploadSource}
              disabled={isUploading || (!selectedFile && !pastedText.trim())}
              className="erp-button"
            >
              {isUploading ? 'Uploading...' : 'Upload Source'}
            </button>
            <button type="button" onClick={resetIntake} className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Reset
            </button>
          </div>
        </div>

        <div className="erp-panel p-4">
          <h2 className="text-base font-semibold text-slate-900">Preview</h2>
          {sourcePreview ? (
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">{sourcePreview.label}</div>
                <div className="text-xs text-slate-500">{sourcePreview.detail}</div>
              </div>

              {sourcePreview.imageUrl ? (
                <img
                  src={sourcePreview.imageUrl}
                  alt="Uploaded intake source"
                  className="max-h-[420px] w-full rounded border border-slate-200 object-contain"
                />
              ) : null}

              {sourcePreview.text ? (
                <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  {sourcePreview.text}
                </pre>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No source selected yet.</p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="erp-panel p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Classification</h2>
              <p className="mt-1 text-sm text-slate-500">
                The workflow must be selected before any fields are extracted.
              </p>
            </div>
            <button
              type="button"
              onClick={classifyDocument}
              disabled={!documentId || isClassifying}
              className="erp-button"
            >
              {isClassifying ? 'Classifying...' : 'Classify'}
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <StatusTile label="Stage" value={stage} />
            <StatusTile label="Document" value={documentId ? 'Uploaded' : 'Not Uploaded'} />
            <StatusTile
              label="AI Classification"
              value={classification ? workflowLabel(classification.document_type) : '-'}
            />
          </div>

          {classification ? (
            <div className="mt-4 rounded border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  {workflowLabel(classification.document_type)}
                </span>
                <FieldConfidence value={classification.confidence} />
                {classification.document_type === 'unknown' ? (
                  <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                    Manual selection needed
                  </span>
                ) : null}
              </div>
              {classification.reason_codes.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {classification.reason_codes.map((reason) => (
                    <span key={reason} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                      {reason}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Workflow {weakClassification ? 'Override' : 'Selection'}
              </span>
              <select
                value={selectedWorkflow}
                onChange={(event) => setSelectedWorkflow(event.target.value as ConfirmableIntakeWorkflow)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="receiving">Receiving</option>
                <option value="pull_request">Pull Request</option>
              </select>
            </label>

            <button
              type="button"
              onClick={extractDocument}
              disabled={!canExtract || isExtracting}
              className="erp-button"
            >
              {isExtracting ? 'Extracting...' : 'Extract Fields'}
            </button>
          </div>
        </div>

        <div className="erp-panel p-4">
          <h2 className="text-base font-semibold text-slate-900">Review</h2>
          <p className="mt-1 text-sm text-slate-500">
            Edit values here before applying them to the target workflow draft.
          </p>

          {extraction?.workflow === 'receiving' ? (
            <ReceivingReview
              extraction={extraction}
              onChange={(next, field) => {
                setExtraction(next);
                markEdited(field);
              }}
            />
          ) : extraction?.workflow === 'pull_request' ? (
            <PullRequestReview
              extraction={extraction}
              onChange={(next, field) => {
                setExtraction(next);
                markEdited(field);
              }}
            />
          ) : (
            <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Extracted fields will appear here after classification and extraction.
            </div>
          )}
        </div>

        {extraction ? (
          <div className="erp-panel p-4">
            <h2 className="text-base font-semibold text-slate-900">Validation</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <ValidationPanel title="Errors" issues={issueGroups.errors} />
              <ValidationPanel title="Warnings" issues={issueGroups.warnings} />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                Apply creates a local draft only. Final save still happens on the workflow page.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyReview('rejected')}
                  disabled={isApplying}
                  className="rounded border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                >
                  Reject Intake
                </button>
                <button
                  type="button"
                  onClick={() => applyReview(editedFields.length ? 'edited' : 'approved')}
                  disabled={isApplying || issueGroups.errors.length > 0}
                  className="erp-button"
                >
                  {isApplying ? 'Applying...' : `Apply to ${workflowLabel(extraction.workflow)} Draft`}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {message ? (
          <div className="rounded border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
            {message}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold capitalize text-slate-900">{value}</div>
    </div>
  );
}

function EditableField({
  label,
  value,
  confidence,
  onChange,
}: {
  label: string;
  value: string;
  confidence: number | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2 text-sm font-medium text-slate-700">
        {label}
        <FieldConfidence value={confidence} />
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function ReceivingReview({
  extraction,
  onChange,
}: {
  extraction: ReceivingExtraction;
  onChange: (extraction: ReceivingExtraction, field: string) => void;
}) {
  function updateHeader<K extends keyof ReceivingExtraction['header']>(key: K, value: string) {
    onChange(
      {
        ...extraction,
        header: {
          ...extraction.header,
          [key]: fromText(value),
        },
      },
      `header.${String(key)}`
    );
  }

  function updateLine<K extends keyof ReceivingExtraction['line_items'][number]>(
    index: number,
    key: K,
    value: ReceivingExtraction['line_items'][number][K]
  ) {
    onChange(
      {
        ...extraction,
        line_items: extraction.line_items.map((line, lineIndex) =>
          lineIndex === index ? { ...line, [key]: value } : line
        ),
      },
      `line_items.${index}.${String(key)}`
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <EditableField label="Vendor" value={toText(extraction.header.vendor_name)} confidence={extraction.confidence.vendor_name} onChange={(value) => updateHeader('vendor_name', value)} />
        <EditableField label="PO Number" value={toText(extraction.header.po_number)} confidence={extraction.confidence.po_number} onChange={(value) => updateHeader('po_number', value)} />
        <EditableField label="Shipment ID" value={toText(extraction.header.shipment_id)} confidence={extraction.confidence.shipment_id} onChange={(value) => updateHeader('shipment_id', value)} />
        <EditableField label="Tracking Number" value={toText(extraction.header.tracking_number)} confidence={extraction.confidence.tracking_number} onChange={(value) => updateHeader('tracking_number', value)} />
        <EditableField label="Carrier" value={toText(extraction.header.carrier)} confidence={extraction.confidence.carrier} onChange={(value) => updateHeader('carrier', value)} />
        <EditableField label="Received Date" value={toText(extraction.header.received_date)} confidence={extraction.confidence.received_date} onChange={(value) => updateHeader('received_date', value)} />
      </div>

      <LineItemsTable
        workflow="receiving"
        rows={extraction.line_items.map((line, index) => ({
          key: `receiving-${index}`,
          cells: [
            {
              label: 'Part Number',
              value: toText(line.part_number),
              confidence: extraction.confidence.part_number,
              onChange: (value) => updateLine(index, 'part_number', fromText(value)),
            },
            {
              label: 'Description',
              value: toText(line.description),
              confidence: extraction.confidence.description,
              onChange: (value) => updateLine(index, 'description', fromText(value)),
            },
            {
              label: 'Qty',
              value: line.qty === null ? '' : String(line.qty),
              confidence: extraction.confidence.qty,
              onChange: (value) => updateLine(index, 'qty', numberFromInput(value)),
            },
            {
              label: 'UOM',
              value: toText(line.uom),
              confidence: extraction.confidence.uom,
              onChange: (value) => updateLine(index, 'uom', fromText(value)),
            },
            {
              label: 'Location',
              value: toText(line.location),
              confidence: extraction.confidence.location,
              onChange: (value) => updateLine(index, 'location', fromText(value)),
            },
          ],
        }))}
      />

      <Warnings extraction={extraction} />
    </div>
  );
}

function PullRequestReview({
  extraction,
  onChange,
}: {
  extraction: PullRequestExtraction;
  onChange: (extraction: PullRequestExtraction, field: string) => void;
}) {
  function updateHeader<K extends keyof PullRequestExtraction['header']>(key: K, value: string) {
    onChange(
      {
        ...extraction,
        header: {
          ...extraction.header,
          [key]: fromText(value),
        },
      },
      `header.${String(key)}`
    );
  }

  function updateLine<K extends keyof PullRequestExtraction['line_items'][number]>(
    index: number,
    key: K,
    value: PullRequestExtraction['line_items'][number][K]
  ) {
    onChange(
      {
        ...extraction,
        line_items: extraction.line_items.map((line, lineIndex) =>
          lineIndex === index ? { ...line, [key]: value } : line
        ),
      },
      `line_items.${index}.${String(key)}`
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <EditableField label="Requestor" value={toText(extraction.header.requestor_name)} confidence={extraction.confidence.requestor_name} onChange={(value) => updateHeader('requestor_name', value)} />
        <EditableField label="Request Date" value={toText(extraction.header.request_date)} confidence={extraction.confidence.request_date} onChange={(value) => updateHeader('request_date', value)} />
        <EditableField label="Department" value={toText(extraction.header.department)} confidence={extraction.confidence.department} onChange={(value) => updateHeader('department', value)} />
        <EditableField label="Project Code" value={toText(extraction.header.project_code)} confidence={extraction.confidence.project_code} onChange={(value) => updateHeader('project_code', value)} />
        <EditableField label="Needed By" value={toText(extraction.header.needed_by_date)} confidence={extraction.confidence.needed_by_date} onChange={(value) => updateHeader('needed_by_date', value)} />
        <EditableField label="Location" value={toText(extraction.header.location)} confidence={extraction.confidence.location} onChange={(value) => updateHeader('location', value)} />
      </div>

      <label className="block">
        <span className="mb-1 flex items-center justify-between gap-2 text-sm font-medium text-slate-700">
          Notes
          <FieldConfidence value={extraction.confidence.notes} />
        </span>
        <textarea
          value={toText(extraction.header.notes)}
          onChange={(event) => updateHeader('notes', event.target.value)}
          className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <LineItemsTable
        workflow="pull_request"
        rows={extraction.line_items.map((line, index) => ({
          key: `pull-request-${index}`,
          cells: [
            {
              label: 'Part Number',
              value: toText(line.part_number),
              confidence: extraction.confidence.part_number,
              onChange: (value) => updateLine(index, 'part_number', fromText(value)),
            },
            {
              label: 'Description',
              value: toText(line.description),
              confidence: extraction.confidence.description,
              onChange: (value) => updateLine(index, 'description', fromText(value)),
            },
            {
              label: 'Qty',
              value: line.qty_requested === null ? '' : String(line.qty_requested),
              confidence: extraction.confidence.qty_requested,
              onChange: (value) => updateLine(index, 'qty_requested', numberFromInput(value)),
            },
            {
              label: 'UOM',
              value: toText(line.uom),
              confidence: extraction.confidence.uom,
              onChange: (value) => updateLine(index, 'uom', fromText(value)),
            },
          ],
        }))}
      />

      <Warnings extraction={extraction} />
    </div>
  );
}

type LineCell = {
  label: string;
  value: string;
  confidence: number | undefined;
  onChange: (value: string) => void;
};

function LineItemsTable({
  rows,
  workflow,
}: {
  rows: Array<{ key: string; cells: LineCell[] }>;
  workflow: ConfirmableIntakeWorkflow;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
        No line items were extracted.
      </div>
    );
  }

  const columns = workflow === 'receiving'
    ? ['Part Number', 'Description', 'Qty', 'UOM', 'Location']
    : ['Part Number', 'Description', 'Qty', 'UOM'];

  return (
    <div className="overflow-x-auto rounded border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Line</th>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key} className="border-t border-slate-100 align-top">
              <td className="px-3 py-3 font-semibold text-slate-700">{index + 1}</td>
              {row.cells.map((cell) => (
                <td key={cell.label} className="min-w-[150px] px-3 py-3">
                  <div className="mb-1">
                    <FieldConfidence value={cell.confidence} />
                  </div>
                  <input
                    aria-label={`${cell.label} line ${index + 1}`}
                    value={cell.value}
                    onChange={(event) => cell.onChange(event.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Warnings({ extraction }: { extraction: IntakeExtraction }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing Fields</div>
        <div className="mt-2 text-sm text-slate-700">
          {extraction.missing_required_fields.length
            ? extraction.missing_required_fields.map((field) => <div key={field}>{field}</div>)
            : 'None reported.'}
        </div>
      </div>
      <div className="rounded border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI Warnings</div>
        <div className="mt-2 text-sm text-slate-700">
          {extraction.warnings.length
            ? extraction.warnings.map((warning) => <div key={warning}>{warning}</div>)
            : 'None reported.'}
        </div>
      </div>
    </div>
  );
}

function ValidationPanel({ title, issues }: { title: string; issues: ValidationIssue[] }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 space-y-2 text-sm text-slate-700">
        {issues.length ? (
          issues.map((issue) => (
            <div key={`${issue.field}-${issue.message}`}>
              <span className="font-semibold">{fieldValue(issue.field)}:</span> {issue.message}
            </div>
          ))
        ) : (
          <div>None.</div>
        )}
      </div>
    </div>
  );
}
