'use client';

import { useState } from 'react';
import {
  DELIVERY_DRAFT_STORAGE_KEY,
  PULL_REQUEST_DRAFT_STORAGE_KEY,
  RECEIVING_DRAFT_STORAGE_KEY,
} from '@/lib/ai/intake/draft-storage';

type Workflow = 'receiving' | 'pull_request' | 'delivery';

export default function AiDocumentIntakeClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [workflow, setWorkflow] = useState<Workflow>('delivery');
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  async function safeJson(response: Response) {
    try {
      return await response.json();
    } catch {
      return { ok: false, message: 'Server returned a non-JSON response.' };
    }
  }

  async function processIntake() {
    if (!file && !pastedText.trim()) {
      setMessage('Choose a file or paste email text first.');
      return;
    }

    setIsBusy(true);
    setMessage('Processing intake...');

    try {
      const formData = new FormData();

      if (file) formData.append('file', file);
      if (pastedText.trim()) formData.append('raw_text', pastedText.trim());

      const uploadResponse = await fetch('/api/ai/intake/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await safeJson(uploadResponse);

      if (!uploadResponse.ok || !uploadResult.ok) {
        setMessage(uploadResult.message || 'Upload failed.');
        return;
      }

      const documentId = uploadResult.document_id || `local-${Date.now()}`;

      setMessage('Extracting fields...');

      const extractResponse = await fetch('/api/ai/intake/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          workflow_type: workflow,
          raw_text: pastedText,
        }),
      });

      const extractResult = await safeJson(extractResponse);

      if (!extractResponse.ok || !extractResult.ok) {
        setMessage(extractResult.message || 'Extraction failed.');
        return;
      }

      setMessage('Creating draft...');

      const applyResponse = await fetch('/api/ai/intake/review/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          selected_workflow_type: workflow,
          review_status: 'approved',
          extraction: extractResult.extraction,
        }),
      });

      const applyResult = await safeJson(applyResponse);

      if (!applyResponse.ok || !applyResult.ok) {
        setMessage(applyResult.message || 'Apply failed.');
        return;
      }

      if (!applyResult.draft || !applyResult.route) {
        setMessage('Draft was not returned.');
        return;
      }

      const storageKey =
        applyResult.draft.workflow_type === 'receiving'
          ? RECEIVING_DRAFT_STORAGE_KEY
          : applyResult.draft.workflow_type === 'pull_request'
            ? PULL_REQUEST_DRAFT_STORAGE_KEY
            : DELIVERY_DRAFT_STORAGE_KEY;

      window.localStorage.setItem(storageKey, JSON.stringify(applyResult.draft.draft));

      setMessage('Draft created. Redirecting...');
      window.location.href = applyResult.route;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Intake failed.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <section className="erp-card p-5">
        <h2 className="text-lg font-semibold text-slate-900">AI Intake</h2>
        <p className="mt-1 text-sm text-slate-500">
          Paste email text or upload a source file, then process it into the correct workflow draft.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Workflow Type
            </span>
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
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Source File Optional
            </span>
            <input
              type="file"
              accept="application/pdf,image/*,.heic,.heif,.eml,.msg,text/plain"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">
            Email / Request Text
          </span>
          <textarea
            value={pastedText}
            onChange={(event) => setPastedText(event.target.value)}
            rows={9}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Paste email, Teams message, shipment request, POC, SHIP number, S-number, from/to, item, and quantity here."
          />
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={processIntake}
            disabled={isBusy}
            className="rounded-md bg-cyan-700 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-60"
          >
            {isBusy ? 'Processing...' : 'Process Intake'}
          </button>

          <button
            type="button"
            onClick={() => {
              setFile(null);
              setPastedText('');
              setMessage('');
            }}
            disabled={isBusy}
            className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Reset
          </button>
        </div>
      </section>

      {message ? (
        <section className="erp-card p-4 text-sm text-slate-700">{message}</section>
      ) : null}
    </div>
  );
}