'use client';

import { useState } from 'react';

type Workflow = 'receiving' | 'pull_request' | 'delivery';

export default function AiDocumentIntakeClient() {
  const [file, setFile] = useState<File | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<Workflow>('receiving');

  const [stage, setStage] = useState<'idle' | 'uploaded' | 'classified' | 'extracted'>('idle');
  const [message, setMessage] = useState('');

  async function upload() {
    if (!file) {
      setMessage('Select a file');
      return;
    }

    setMessage('Uploading...');
    setStage('idle');

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/ai/intake/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    if (!data.ok) {
      setMessage(data.message);
      return;
    }

    setDocId(data.document_id);
    setStage('uploaded');
    setMessage('Uploaded. Ready to classify.');
  }

  async function classify() {
    if (!docId) return;

    setMessage('Classifying...');

    const res = await fetch('/api/ai/intake/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: docId }),
    });

    const data = await res.json();

    if (!data.ok) {
      setMessage(data.message);
      return;
    }

    if (data.classification?.document_type !== 'unknown') {
      setWorkflow(data.classification.document_type);
    }

    setStage('classified');
    setMessage('Classified. Ready to extract.');
  }

  async function extract() {
    if (!docId) return;

    setMessage('Extracting...');

    const res = await fetch('/api/ai/intake/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: docId,
        workflow_type: workflow,
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      setMessage(data.message);
      return;
    }

    setStage('extracted');
    setMessage('Extraction complete. Ready to apply.');
  }

  async function apply() {
    if (!docId) return;

    setMessage('Applying...');

    const res = await fetch('/api/ai/intake/review/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: docId,
        selected_workflow_type: workflow,
        review_status: 'approved',
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      setMessage(data.message);
      return;
    }

    setMessage('Draft created → redirecting...');
    window.location.href = data.route + '?draft=ai-intake';
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">AI Document Intake</h2>
        <p className="text-sm text-gray-500">
          Upload → Classify → Extract → Apply
        </p>
      </div>

      {/* Upload */}
      <div className="space-y-2">
        <input
          type="file"
          accept="application/pdf,image/*,.heic,.heif"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button onClick={upload} className="px-4 py-2 bg-blue-600 text-white rounded">
          Upload
        </button>
      </div>

      {/* Workflow */}
      {stage !== 'idle' && (
        <div>
          <label className="text-sm font-medium">Workflow</label>
          <select
            value={workflow}
            onChange={(e) => setWorkflow(e.target.value as Workflow)}
            className="block mt-1 border px-3 py-2 rounded"
          >
            <option value="receiving">Receiving</option>
            <option value="pull_request">Pull Request</option>
            <option value="delivery">Delivery / Pickup</option>
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={classify}
          disabled={!docId}
          className="px-3 py-2 bg-gray-800 text-white rounded"
        >
          Classify
        </button>

        <button
          onClick={extract}
          disabled={stage !== 'classified'}
          className="px-3 py-2 bg-gray-700 text-white rounded"
        >
          Extract
        </button>

        <button
          onClick={apply}
          disabled={stage !== 'extracted'}
          className="px-3 py-2 bg-green-600 text-white rounded"
        >
          Apply
        </button>
      </div>

      <div className="text-sm text-gray-600">{message}</div>

      <div className="text-xs text-gray-400">Stage: {stage}</div>
    </div>
  );
}