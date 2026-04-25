'use client';

import { useState } from 'react';
import { DELIVERY_DRAFT_STORAGE_KEY } from '@/lib/ai/intake/draft-storage';

type WorkflowType = 'receiving' | 'pull_request' | 'delivery';

export default function AIDocumentIntakePage() {
  const [workflow, setWorkflow] = useState<WorkflowType>('delivery');
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');

  async function handleExtract() {
    setMessage('Extracting...');

    const documentId = `text-${Date.now()}`;

    const extractRes = await fetch('/api/ai/intake/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: documentId,
        raw_text: text,
        workflow_type: workflow,
      }),
    });

    const extractData = await extractRes.json();

    if (!extractData.ok) {
      setMessage(extractData.message || 'Extraction failed');
      return;
    }

    const applyRes = await fetch('/api/ai/intake/review/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: documentId,
        selected_workflow_type: workflow,
        review_status: 'approved',
        extraction: extractData.extraction,
      }),
    });

    const applyData = await applyRes.json();

    if (!applyData.ok) {
      setMessage(applyData.message || 'Apply failed');
      return;
    }

    if (workflow === 'delivery') {
      const draft = applyData.draft?.draft ?? {};

      const normalizedDraft = {
        ...draft,
        direction:
          draft.direction === 'pickup' || draft.direction === 'incoming'
            ? 'incoming'
            : 'outgoing',
      };

      localStorage.setItem(DELIVERY_DRAFT_STORAGE_KEY, JSON.stringify(normalizedDraft));
      window.location.href = applyData.route || '/delivery';
      return;
    }

    setMessage('Draft created.');
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Document Intake</h1>
        <p className="text-sm text-slate-500">
          Paste email text to extract structured workflow data.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setWorkflow('delivery')}
          className={`px-4 py-2 rounded-md ${
            workflow === 'delivery' ? 'bg-cyan-700 text-white' : 'bg-slate-200'
          }`}
        >
          Pickup / Delivery
        </button>

        <button
          type="button"
          onClick={() => setWorkflow('receiving')}
          className={`px-4 py-2 rounded-md ${
            workflow === 'receiving' ? 'bg-cyan-700 text-white' : 'bg-slate-200'
          }`}
        >
          Receiving
        </button>

        <button
          type="button"
          onClick={() => setWorkflow('pull_request')}
          className={`px-4 py-2 rounded-md ${
            workflow === 'pull_request' ? 'bg-cyan-700 text-white' : 'bg-slate-200'
          }`}
        >
          Pull Request
        </button>
      </div>

      {workflow !== 'delivery' ? (
        <div className="border border-slate-300 p-4 rounded-md">
          <p className="text-sm text-slate-600">Upload</p>
          <input type="file" className="mt-2" />
        </div>
      ) : null}

      <div>
        <label className="text-sm font-semibold text-slate-700">
          Paste Email / Text
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-2 w-full min-h-[220px] border rounded-md px-3 py-2 text-sm"
          placeholder="Paste the pickup or delivery email here..."
        />
      </div>

      <button
        type="button"
        onClick={handleExtract}
        className="bg-cyan-700 text-white px-4 py-2 rounded-md"
      >
        Extract
      </button>

      {message ? <div className="text-sm text-slate-600">{message}</div> : null}
    </div>
  );
}