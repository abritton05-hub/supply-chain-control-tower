import Link from 'next/link';
import { SectionHeader } from '@/components/section-header';

const locations = [
  {
    id: 'sea991',
    name: 'SEA991',
    type: 'Facility',
    summary: 'Primary facility for kit work, inbound and outbound movement, and calibration flow.',
    incomingToday: 4,
    outgoingToday: 3,
    blockedItems: 2,
  },
  {
    id: 'a13',
    name: 'A13',
    type: 'Warehouse',
    summary: 'Warehouse partner handling outbound shipments, tracking, and truck coordination.',
    incomingToday: 2,
    outgoingToday: 6,
    blockedItems: 3,
  },
  {
    id: 'sea133',
    name: 'SEA133',
    type: 'Facility',
    summary: 'Secondary site involved in internal transfers and support movement.',
    incomingToday: 1,
    outgoingToday: 2,
    blockedItems: 1,
  },
  {
    id: 'sea99',
    name: 'SEA99',
    type: 'Facility',
    summary: 'Additional facility location for inventory movement and support flow.',
    incomingToday: 0,
    outgoingToday: 1,
    blockedItems: 0,
  },
  {
    id: 'calibration',
    name: 'Calibration Vendor',
    type: 'External Service',
    summary: 'Tracks items sent out for calibration and return-to-site movement.',
    incomingToday: 1,
    outgoingToday: 2,
    blockedItems: 2,
  },
];

function readinessTone(blockedItems: number) {
  if (blockedItems >= 3) return 'text-rose-700 bg-rose-50 border-rose-200';
  if (blockedItems >= 1) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-emerald-700 bg-emerald-50 border-emerald-200';
}

export default function LocationsPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Locations"
        subtitle="Track where material is, where it moved, and which locations are impacting kit readiness"
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="erp-button">Add Location</button>
            <button className="erp-button">Paste</button>
            <button className="erp-button">Upload CSV</button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="erp-panel p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Locations
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{locations.length}</div>
        </div>

        <div className="erp-panel p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Active Movement Today
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {locations.reduce((sum, location) => sum + location.incomingToday + location.outgoingToday, 0)}
          </div>
        </div>

        <div className="erp-panel p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Location Blockers
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {locations.reduce((sum, location) => sum + location.blockedItems, 0)}
          </div>
        </div>
      </div>

      <div className="erp-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3">Incoming Today</th>
                <th className="px-4 py-3">Outgoing Today</th>
                <th className="px-4 py-3">Blocked Items</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => (
                <tr key={location.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/locations/${location.id}`} className="text-cyan-700 hover:underline">
                      {location.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{location.type}</td>
                  <td className="px-4 py-3 text-slate-700">{location.summary}</td>
                  <td className="px-4 py-3 text-slate-700">{location.incomingToday}</td>
                  <td className="px-4 py-3 text-slate-700">{location.outgoingToday}</td>
                  <td className="px-4 py-3 text-slate-700">{location.blockedItems}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${readinessTone(
                        location.blockedItems
                      )}`}
                    >
                      {location.blockedItems >= 3
                        ? 'Needs Attention'
                        : location.blockedItems >= 1
                        ? 'Watch'
                        : 'Stable'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}