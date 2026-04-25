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
      return {
        ok: false,
        message: 'Server returned a non-JSON response.',
      };
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
      let response: Response;

      if (file) {
        const formData = new FormData();
        formData.append('file', file);

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

      const result = await safeJson(response);

      if (!response.ok || !result.ok) {
        setMessage(result.message || 'Upload failed.');
        return;
      }

      setDocumentId(result.document_id);
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
      setMessage('Upload a document first.');
      return;
    }

    setIsBusy(true);
    setMessage('Classifying...');

    try {
      const response = await fetch('/api/ai/intake/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          text_hint: pastedText,
        }),
      });

      const result = await safeJson(response);

      if (!response.ok || !result.ok) {
        setMessage(result.message || 'Classification failed.');
        return;
      }

      if (
        result.classification?.document_type &&
        result.classification.document_type !== 'unknown'
      ) {
        setWorkflow(result.classification.document_type);
      }

      setStage('classified');
      setMessage('Classified. Ready to extract.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Classification failed.');
    } finally {
      setIsBusy(false);
    }
  }

  async function extract() {
    if (!documentId) {
      setMessage('Upload a document first.');
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
    if (!documentId) {
      setMessage('Upload a document first.');
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

      if (!result.draft || !result.route) {
        setMessage('Apply succeeded, but no draft was returned.');
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
          Choose the workflow type, upload a source, optionally paste the email text, then apply it into a draft.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Workflow Type
            </span>
            <select
              value={workflow}
              onChange={(event) => setWorkflow(event.target.value as Workflow)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="receiving">Receiving</option>
              <option value="pull_request">Pull Request</option>
              <option value="delivery">Delivery / Pickup</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Source File
            </span>
            <input
              type="file"
              accept="application/pdf,image/*,.heic,.heif,.eml,.msg,text/plain"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">
            Email / Screenshot Text
          </span>
          <textarea
            value={pastedText}
            onChange={(event) => setPastedText(event.target.value)}
            rows={7}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            placeholder="Paste the email text here if the upload is a screenshot. Example: Please schedule pickup from SEA99... Qty 1..."
          />
        </label>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={upload}
            disabled={isBusy}
            className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"
          >
            Upload
          </button>

          <button
            type="button"
            onClick={classify}
            disabled={isBusy || !documentId}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Classify
          </button>

          <button
            type="button"
            onClick={extract}
            disabled={isBusy || stage !== 'classified'}
            className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
          >
            Extract
          </button>

          <button
            type="button"
            onClick={apply}
            disabled={isBusy || stage !== 'extracted'}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </section>

      <section className="erp-card p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Stage</div>
            <div className="mt-1 text-sm font-semibold capitalize text-slate-900">
              {stage}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Document</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {documentId ? 'Uploaded' : 'Not Uploaded'}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Workflow</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {workflow === 'pull_request'
                ? 'Pull Request'
                : workflow === 'delivery'
                  ? 'Delivery / Pickup'
                  : 'Receiving'}
            </div>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {message}
          </div>
        ) : null}
      </section>
    </div>
  );
}