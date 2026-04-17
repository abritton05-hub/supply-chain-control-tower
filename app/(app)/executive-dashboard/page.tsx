'use client';

import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';

const kitTrackerRows = [
  {
    kit: 'PAA V6',
    partNumber: '131950-390',
    description: 'HARNESS AS MOBILE RACK',
    rackType: 'Power On',
    status: 'MISSING',
    buildStatus: 'BLOCKED',
    blockerReason: 'Waiting on MOA / SC response',
    eta: 'TBD – pending SC response',
    readyToShip: false,
    fullyShipped: false,
    risk: 'HIGH',
  },
  {
    kit: 'PAA V6',
    partNumber: '131182-390',
    description: 'HARNESS AS PAA PWR_SW LOAD',
    rackType: 'Power On',
    status: 'ON HAND',
    buildStatus: 'COMPLETE',
    blockerReason: '',
    eta: 'N/A',
    readyToShip: true,
    fullyShipped: true,
    risk: 'LOW',
  },
  {
    kit: 'PAA V6',
    partNumber: '131184-390',
    description: 'mobile rack to txs1',
    rackType: 'Power On',
    status: 'MISSING',
    buildStatus: 'BLOCKED',
    blockerReason: 'Waiting on MOA / SC response',
    eta: 'TBD – pending SC response',
    readyToShip: false,
    fullyShipped: false,
    risk: 'HIGH',
  },
  {
    kit: 'PAA V6',
    partNumber: 'txs1',
    description: 'Engineering Harness',
    rackType: 'Engineering Harness',
    status: 'MISSING',
    buildStatus: 'BLOCKED',
    blockerReason: 'Engineering harness ETA end of April',
    eta: 'End of April delivery',
    readyToShip: false,
    fullyShipped: false,
    risk: 'HIGH',
  },
  {
    kit: 'PAA V6',
    partNumber: '150619-203/01',
    description: 'Standoff Pins – RX / TX',
    rackType: 'Gbist',
    status: 'ON HAND',
    buildStatus: 'COMPLETE',
    blockerReason: '',
    eta: 'N/A',
    readyToShip: true,
    fullyShipped: true,
    risk: 'LOW',
  },
  {
    kit: 'PAA V6',
    partNumber: '2389296-2',
    description: '0.8 Meter strada to QSFP',
    rackType: 'Consumable',
    status: 'ON HAND',
    buildStatus: 'COMPLETE',
    blockerReason: '',
    eta: 'N/A',
    readyToShip: true,
    fullyShipped: true,
    risk: 'LOW',
  },
];

const shipments = [
  {
    item: 'Server Rack',
    from: 'SEA991',
    to: 'A13',
    status: 'REQUESTED',
    tracking: '',
    type: 'Outbound',
  },
  {
    item: 'Fiber Plate',
    from: 'A13',
    to: 'SEA991',
    status: 'SHIPPED',
    tracking: '1Z999AA10123456784',
    type: 'Inbound',
  },
  {
    item: 'Calibration Unit',
    from: 'SEA991',
    to: 'Calibration Vendor',
    status: 'IN TRANSIT',
    tracking: 'CAL-2026-001',
    type: 'Calibration',
  },
];

const locationFlow = [
  { name: 'SEA991', incoming: 4, outgoing: 3, blockers: 2 },
  { name: 'A13', incoming: 2, outgoing: 6, blockers: 3 },
  { name: 'SEA133', incoming: 1, outgoing: 2, blockers: 1 },
  { name: 'SEA99', incoming: 0, outgoing: 1, blockers: 0 },
];

function readinessTone(readiness: 'RED' | 'YELLOW' | 'GREEN') {
  if (readiness === 'RED') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (readiness === 'YELLOW') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

function rackSummary() {
  return ['Power On', 'Engineering Harness', 'Gbist', 'Consumable'].map((rackType) => {
    const rows = kitTrackerRows.filter((row) => row.rackType === rackType);
    const missing = rows.filter((row) => row.status === 'MISSING').length;
    const blocked = rows.filter((row) => row.buildStatus === 'BLOCKED').length;
    const ready = rows.filter((row) => row.readyToShip && !row.fullyShipped).length;

    let readiness: 'RED' | 'YELLOW' | 'GREEN' = 'GREEN';
    if (missing > 0 || blocked > 0) readiness = 'RED';
    else if (ready > 0) readiness = 'YELLOW';

    return {
      rackType,
      missing,
      blocked,
      ready,
      readiness,
    };
  });
}

export default function DashboardPage() {
  const blockedLines = kitTrackerRows.filter((row) => row.buildStatus === 'BLOCKED').length;
  const missingItems = kitTrackerRows.filter((row) => row.status === 'MISSING').length;
  const readyToShip = kitTrackerRows.filter((row) => row.readyToShip && !row.fullyShipped).length;
  const fullyShipped = kitTrackerRows.filter((row) => row.fullyShipped).length;
  const highRisk = kitTrackerRows.filter((row) => row.risk === 'HIGH').length;
  const shipmentsInMotion = shipments.filter(
    (shipment) => shipment.status === 'SHIPPED' || shipment.status === 'IN TRANSIT'
  ).length;

  const racks = rackSummary();
  const topBlockers = kitTrackerRows.filter((row) => row.buildStatus === 'BLOCKED').slice(0, 5);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Executive Dashboard"
        subtitle="Leadership view of kit readiness, shipment flow, and location bottlenecks"
      />

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Blocked Lines" value={blockedLines} />
        <KpiCard label="Missing Items" value={missingItems} />
        <KpiCard label="Ready to Ship" value={readyToShip} />
        <KpiCard label="Fully Shipped" value={fullyShipped} />
        <KpiCard label="High Risk" value={highRisk} />
        <KpiCard label="Shipments in Motion" value={shipmentsInMotion} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="erp-panel overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">Rack Readiness</div>
            <div className="text-xs text-slate-500">
              What is stable, what is at risk, and what is blocked
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Rack Type</th>
                  <th className="px-4 py-3">Missing</th>
                  <th className="px-4 py-3">Blocked</th>
                  <th className="px-4 py-3">Ready to Ship</th>
                  <th className="px-4 py-3">Readiness</th>
                </tr>
              </thead>

              <tbody>
                {racks.map((rack) => (
                  <tr key={rack.rackType} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{rack.rackType}</td>
                    <td className="px-4 py-3 text-slate-700">{rack.missing}</td>
                    <td className="px-4 py-3 text-slate-700">{rack.blocked}</td>
                    <td className="px-4 py-3 text-slate-700">{rack.ready}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${readinessTone(
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
              Immediate issues affecting build and shipment readiness
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

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="erp-panel overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">Shipping Flow</div>
            <div className="text-xs text-slate-500">
              Movement between SEA sites, A13, and external service points
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tracking</th>
                </tr>
              </thead>

              <tbody>
                {shipments.map((shipment) => (
                  <tr key={`${shipment.item}-${shipment.to}`} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{shipment.item}</td>
                    <td className="px-4 py-3 text-slate-700">{shipment.from}</td>
                    <td className="px-4 py-3 text-slate-700">{shipment.to}</td>
                    <td className="px-4 py-3 text-slate-700">{shipment.type}</td>
                    <td className="px-4 py-3 text-slate-700">{shipment.status}</td>
                    <td className="px-4 py-3 text-slate-700">{shipment.tracking || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-panel overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">Location Bottlenecks</div>
            <div className="text-xs text-slate-500">
              Incoming, outgoing, and blocker pressure by location
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Incoming</th>
                  <th className="px-4 py-3">Outgoing</th>
                  <th className="px-4 py-3">Blockers</th>
                </tr>
              </thead>

              <tbody>
                {locationFlow.map((location) => (
                  <tr key={location.name} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{location.name}</td>
                    <td className="px-4 py-3 text-slate-700">{location.incoming}</td>
                    <td className="px-4 py-3 text-slate-700">{location.outgoing}</td>
                    <td className="px-4 py-3 text-slate-700">{location.blockers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}