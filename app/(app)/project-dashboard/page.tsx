import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';

const kitTrackerRows = [
  {
    kit: 'PAA V6',
    rackType: 'Power On',
    status: 'MISSING',
    buildStatus: 'BLOCKED',
    readyToShip: false,
    fullyShipped: false,
    blockerReason: 'Waiting on MOA / SC response',
    eta: 'TBD – pending SC response',
    description: 'HARNESS AS MOBILE RACK',
    partNumber: '131950-390',
  },
  {
    kit: 'PAA V6',
    rackType: 'Power On',
    status: 'ON HAND',
    buildStatus: 'COMPLETE',
    readyToShip: true,
    fullyShipped: true,
    blockerReason: '',
    eta: 'N/A',
    description: 'HARNESS AS PAA PWR_SW LOAD',
    partNumber: '131182-390',
  },
  {
    kit: 'PAA V6',
    rackType: 'Engineering Harness',
    status: 'MISSING',
    buildStatus: 'BLOCKED',
    readyToShip: false,
    fullyShipped: false,
    blockerReason: 'Engineering harness ETA end of April',
    eta: 'End of April delivery',
    description: 'Engineering Harness',
    partNumber: 'txs1',
  },
  {
    kit: 'PAA V6',
    rackType: 'Gbist',
    status: 'ON HAND',
    buildStatus: 'COMPLETE',
    readyToShip: true,
    fullyShipped: true,
    blockerReason: '',
    eta: 'N/A',
    description: 'Standoff Pins – RX / TX',
    partNumber: '150619-203/01',
  },
  {
    kit: 'PAA V6',
    rackType: 'Consumable',
    status: 'ON HAND',
    buildStatus: 'COMPLETE',
    readyToShip: true,
    fullyShipped: true,
    blockerReason: '',
    eta: 'N/A',
    description: '0.8 Meter strada to QSFP',
    partNumber: '2389296-2',
  },
];

function rackTone(readiness: 'RED' | 'YELLOW' | 'GREEN') {
  if (readiness === 'RED') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (readiness === 'YELLOW') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

export default function ProjectDashboardPage() {
  const activeProjects = [...new Set(kitTrackerRows.map((row) => row.kit))].length;
  const blockedLines = kitTrackerRows.filter((row) => row.buildStatus === 'BLOCKED').length;
  const readyToShip = kitTrackerRows.filter((row) => row.readyToShip && !row.fullyShipped).length;
  const fullyShipped = kitTrackerRows.filter((row) => row.fullyShipped).length;

  const rackSummary = ['Power On', 'Engineering Harness', 'Gbist', 'Consumable'].map((rackType) => {
    const rows = kitTrackerRows.filter((row) => row.rackType === rackType);
    const missing = rows.filter((row) => row.status === 'MISSING').length;
    const partial = rows.filter((row) => row.status === 'PARTIAL').length;
    const blocked = rows.filter((row) => row.buildStatus === 'BLOCKED').length;
    const ready = rows.filter((row) => row.readyToShip && !row.fullyShipped).length;

    let readiness: 'RED' | 'YELLOW' | 'GREEN' = 'GREEN';
    if (missing > 0 || blocked > 0) readiness = 'RED';
    else if (partial > 0 || ready > 0) readiness = 'YELLOW';

    return {
      rackType,
      missing,
      partial,
      blocked,
      ready,
      readiness,
    };
  });

  const topBlockers = kitTrackerRows.filter((row) => row.buildStatus === 'BLOCKED').slice(0, 6);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Project Dashboard"
        subtitle="Kit-driven readiness, blockers, and shipment progress"
      />

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Active Projects" value={activeProjects} />
        <KpiCard label="Blocked Lines" value={blockedLines} />
        <KpiCard label="Ready to Ship" value={readyToShip} />
        <KpiCard label="Fully Shipped" value={fullyShipped} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="erp-panel overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">Rack Readiness</div>
            <div className="text-xs text-slate-500">
              Rollup view based on kit tracker lines
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Rack Type</th>
                  <th className="px-4 py-3">Missing</th>
                  <th className="px-4 py-3">Partial</th>
                  <th className="px-4 py-3">Blocked</th>
                  <th className="px-4 py-3">Ready to Ship</th>
                  <th className="px-4 py-3">Readiness</th>
                </tr>
              </thead>

              <tbody>
                {rackSummary.map((rack) => (
                  <tr key={rack.rackType} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{rack.rackType}</td>
                    <td className="px-4 py-3 text-slate-700">{rack.missing}</td>
                    <td className="px-4 py-3 text-slate-700">{rack.partial}</td>
                    <td className="px-4 py-3 text-slate-700">{rack.blocked}</td>
                    <td className="px-4 py-3 text-slate-700">{rack.ready}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${rackTone(
                          rack.readiness
                        )}`}
                      >
                        {rack.readiness}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-panel overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">Top Blockers</div>
            <div className="text-xs text-slate-500">
              Fast read on what is holding the build back
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {topBlockers.map((row) => (
              <div key={`${row.partNumber}-${row.rackType}`} className="px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">
                  {row.partNumber} — {row.description}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {row.rackType} · ETA: {row.eta}
                </div>
                <div className="mt-2 text-sm text-rose-700">{row.blockerReason}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}