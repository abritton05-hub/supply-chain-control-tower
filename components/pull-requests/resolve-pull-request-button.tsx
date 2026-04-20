'use client';

export function ResolvePullRequestButton({ requestId }: { requestId: string }) {
  async function resolve() {
    const res = await fetch('/api/pull-requests/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: requestId,
        performed_by: 'Anthony Britton', // TEMP (we’ll wire real user next)
      }),
    });

    const data = await res.json();

    if (data.ok) {
      alert('Request completed. Inventory updated.');
      window.location.reload();
    } else {
      alert(data.message);
    }
  }

  return (
    <button
      onClick={resolve}
      className="bg-green-600 text-white px-4 py-2 rounded"
    >
      Complete / Fulfill
    </button>
  );
}