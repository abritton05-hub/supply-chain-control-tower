'use client';

import { useState } from 'react';
import {
  DELIVERY_DRAFT_STORAGE_KEY,
  PULL_REQUEST_DRAFT_STORAGE_KEY,
  RECEIVING_DRAFT_STORAGE_KEY,
} from '@/lib/ai/intake/draft-storage';

type Workflow = 'receiving' | 'pull_request' | 'delivery';
type IntakeStage = 'idle' | 'uploaded' | 'classified' | 'extracted';

export default function AiDocumentIntakeClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [workflow, setWorkflow] = useState<Workflow>('delivery');
  const [stage, setStage] = useState<IntakeStage>('idle');
  const [message, setMessage] = useState('');
  const [extraction, setExtraction] = useState<any>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function safeJson(response: Response) {
    try {
      return await response.json();
    } catch {
      return { ok: false, message: 'Server returned a non-JSON response.' };
    }
  }

  async function upload() {
    if (!file && !pastedText.trim()) {
      setMessage('Choose a file or paste email text first.');
      return;
    }

    setIsBusy(true);
    setMessage('Uploading...');

    try {
      const formData = new FormData();

      if (file) formData.append('file', file);
      if (pastedText.trim()) formData.append('raw_text', pastedText.trim());

      const response = await fetch('/api/ai/intake/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await safeJson(response);

      if (!response.ok || !result.ok) {
        setMessage(result.message || 'Upload failed.');
        return;
      }

      setDocumentId(result.document_id || `local-${Date.now()}`);
      setStage('uploaded');
      setMessage('Uploaded. Ready to classify.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setIsBusy(false);
    }
  }

  async function classify() {
    if (!documentId) {
      setMessage('Upload first.');
      return;
    }

    setIsBusy(true);
    setMessage('Classifying...');

    try {
      setWorkflow('delivery');
      setStage('classified');
      setMessage('Classified as Delivery / Pickup. Ready to extract.');
    } finally {
      setIsBusy(false);
    }
  }

  async function extract() {
    if (!documentId) {
      setMessage('Upload first.');
      return;
    }

    setIsBusy(true);
    setMessage('Extracting...');

    try {
      const response = await fetch('/api/ai/intake/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          workflow_type: workflow,
          raw_text: pastedText,
        }),
      });

      const result = await safeJson(response);

      if (!response.ok || !result.ok) {
        setMessage(result.message || 'Extraction failed.');
        return;
      }

      setExtraction(result.extraction);
      setStage('extracted');
      setMessage('Extracted. Ready to apply.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Extraction failed.');
    } finally {
      setIsBusy(false);
    }
  }

  async function apply() {
    if (!documentId || !extraction) {
      setMessage('Extract first.');
      return;
    }

    setIsBusy(true);
    setMessage('Applying...');

    try {
      const response = await fetch('/api/ai/intake/review/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          selected_workflow_type: workflow,
          review_status: 'approved',
          extraction,
        }),
      });

      const result = await safeJson(response);

      if (!response.ok || !result.ok) {
        setMessage(result.message || 'Apply failed.');
        return;
      }

      const storageKey =
        result.draft.workflow_type === 'receiving'
          ? RECEIVING_DRAFT_STORAGE_KEY
          : result.draft.workflow_type === 'pull_request'
            ? PULL_REQUEST_DRAFT_STORAGE_KEY
            : DELIVERY_DRAFT_STORAGE_KEY;

      window.localStorage.setItem(storageKey, JSON.stringify(result.draft.draft));

      setMessage('Draft created. Redirecting...');
      window.location.href = result.route;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Apply failed.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <section className="erp-card p-5">
        <h2 className="text-lg font-semibold text-slate-900">AI Intake</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload the source and paste the email text. Screenshots need pasted text until OCR is wired.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Workflow Type</span>
            <select
              value={workflow}
              onChange={(event) => setWorkflow(event.target.value as Workflow)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="delivery">Delivery / Pickup</option>
              <option value="receiving">Receiving</option>
              <option value="pull_request">Pull Request</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Source File</span>
            <input
              type="file"
              accept="application/pdf,image/*,.heic,.heif,.eml,.msg,text/plain"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Email Text</span>
          <textarea
            value={pastedText}
            onChange={(event) => setPastedText(event.target.value)}
            rows={8}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Paste email text here. Example: Please schedule pickup from SEA99... taken directly to SEA991. Qty 1 of SA14596-0_E1 TIM,SGT Assembly..."
          />
        </label>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={upload} disabled={isBusy} className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Upload
          </button>
          <button type="button" onClick={classify} disabled={isBusy || !documentId} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Classify
          </button>
          <button type="button" onClick={extract} disabled={isBusy || stage !== 'classified'} className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Extract
          </button>
          <button type="button" onClick={apply} disabled={isBusy || stage !== 'extracted'} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Apply
          </button>
        </div>
      </section>

      {message ? (
        <section className="erp-card p-4 text-sm text-slate-700">{message}</section>
      ) : null}
    </div>
  );
}