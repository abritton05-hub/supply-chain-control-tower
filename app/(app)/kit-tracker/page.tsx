import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';

const kitRows = [
  {
    kit: 'PAA V6',
    partNumber: '131950-390',
    description: 'HARNESS AS MOBILE RACK',
    rackType: 'Power On',
    vendor: 'MOA',
    qtyRequired: 1,
    qtyOnHand: 0,
    status: 'MISSING',
    eta: 'TBD – pending SC response',
    orderReference: 'MOA 4000012564',
    notes: '',
    risk: 'HIGH',
    readyToShip: 'No',
    fullyShipped: 'No',
    buildStatus: 'BLOCKED',
    blockerReason: 'Waiting on MOA / SC response',
  },
  {
    kit: 'PAA V6',
    partNumber: '131182-390',
    description: 'HARNESS AS PAA PWR_SW LOAD',
    rackType: 'Power On',
    vendor: 'MOA',
    qtyRequired: 1,
    qtyOnHand: 1,
    status: 'ON HAND',
    eta: 'N/A',
    orderReference: 'MOA 4000012564',
    notes: '',
    risk: 'LOW',
    readyToShip: 'Yes',
    fullyShipped: 'Yes',
    buildStatus: 'COMPLETE',
    blockerReason: '',
  },
  {
    kit: 'PAA V6',
    partNumber: 'txs1',
    description: 'Engineering Harness',
    rackType: 'Engineering Harness',
    vendor: 'ALR',
    qtyRequired: 1,
    qtyOnHand: 0,
    status: 'MISSING',
    eta: 'End of April delivery',
    orderReference: 'ALR-8944',
    notes: '',
    risk: 'HIGH',
    readyToShip: 'No',
    fullyShipped: 'No',
    buildStatus: 'BLOCKED',
    blockerReason: 'Engineering harness ETA end of April',
  },
  {
    kit: 'PAA V6',
    partNumber: '150619-203/01',
    description: 'Standoff Pins – RX / TX',
    rackType: 'Gbist',
    vendor: 'B901',
    qtyRequired: 50,
    qtyOnHand: 50,
    status: 'ON HAND',
    eta: 'N/A',
    orderReference: 'B901-20588188',
    notes: 'Shipping full quantity in kit #1',
    risk: 'LOW',
    readyToShip: 'Yes',
    fullyShipped: 'Yes',
    buildStatus: 'COMPLETE',
    blockerReason: '',
  },
];

function rowTone(row: (typeof kitRows)[number]) {
  if (row.fullyShipped === 'Yes') return 'bg-emerald-50';
  if (row.readyToShip === 'Yes') return 'bg-orange-100';
  if (row.buildStatus === 'BLOCKED' || row.risk === 'HIGH') return 'bg-rose-50';
  return '';
}

export default function KitTrackerPage() {
  const blocked = kitRows.filter((row) => row.buildStatus === 'BLOCKED').length;
  const readyToShip = kitRows.filter(
    (row) => row.readyToShip === 'Yes' && row.fullyShipped !== 'Yes'
  ).length;
  const fullyShipped = kitRows.filter((row) => row.fullyShipped === 'Yes').length;
  const missing = kitRows.filter((row) => row.status === 'MISSING').length;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Kit Tracker"
        subtitle="Build readiness, blockers, and shipment status by kit line"
        actions={
          <div className="flex gap-2">
            <button className="erp-button">Add Line</button>
            <button className="erp-button">Upload CSV</button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Blocked Lines" value={blocked} />
        <KpiCard label="Missing Items" value={missing} />
        <KpiCard label="Ready to Ship" value={readyToShip} />
        <KpiCard label="Fully Shipped" value={fullyShipped} />
      </div>

      <div className="erp-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Kit</th>
                <th className="px-4 py-3">Part Number</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Rack Type</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Qty Required</th>
                <th className="px-4 py-3">Qty On Hand</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">ETA</th>
                <th className="px-4 py-3">Build Status</th>
                <th className="px-4 py-3">Blocker Reason</th>
                <th className="px-4 py-3">Ready to Ship</th>
                <th className="px-4 py-3">Fully Shipped</th>
              </tr>
            </thead>

            <tbody>
              {kitRows.map((row) => (
                <tr
                  key={`${row.kit}-${row.partNumber}`}
                  className={`border-b border-slate-100 align-top ${rowTone(row)}`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{row.kit}</td>
                  <td className="px-4 py-3 text-slate-700">{row.partNumber}</td>
                  <td className="px-4 py-3 text-slate-700">{row.description}</td>
                  <td className="px-4 py-3 text-slate-700">{row.rackType}</td>
                  <td className="px-4 py-3 text-slate-700">{row.vendor}</td>
                  <td className="px-4 py-3 text-slate-700">{row.qtyRequired}</td>
                  <td className="px-4 py-3 text-slate-700">{row.qtyOnHand}</td>
                  <td className="px-4 py-3 text-slate-700">{row.status}</td>
                  <td className="px-4 py-3 text-slate-700">{row.eta}</td>
                  <td className="px-4 py-3 text-slate-700">{row.buildStatus}</td>
                  <td className="px-4 py-3 text-slate-700">{row.blockerReason || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{row.readyToShip}</td>
                  <td className="px-4 py-3 text-slate-700">{row.fullyShipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}