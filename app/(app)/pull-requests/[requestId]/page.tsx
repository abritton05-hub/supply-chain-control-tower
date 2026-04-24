export const dynamic = 'force-dynamic';

export default function PullRequestDetailPage({
  params,
}: {
  params: { requestId: string };
}) {
  return (
    <div className="space-y-4">
      <div className="erp-panel p-4">
        <h1 className="text-lg font-semibold">Pull Request {params.requestId}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Pull request detail page is temporarily in safe mode.
        </p>
      </div>
    </div>
  );
}