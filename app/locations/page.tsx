import { SectionHeader } from '@/components/section-header';
import { PrintLocationLabelButton } from '@/components/label-print-buttons';

const locations = [
  { name: 'Main WH', type: 'Warehouse' },
  { name: 'Line 2', type: 'Production' },
  { name: 'QA', type: 'Inspection' },
  { name: 'Shipping', type: 'Outbound' },
];

export default function LocationsPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Locations"
        subtitle="Master location registry for inventory movement"
      />

      <div className="erp-card overflow-hidden">
        <ul className="divide-y divide-slate-100 text-sm">
          {locations.map((location) => (
            <li
              key={location.name}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-semibold text-slate-900">{location.name}</div>
                <div className="text-slate-500">{location.type}</div>
              </div>
              <PrintLocationLabelButton
                location={location.name}
                className="erp-action-secondary"
                showMessage={false}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
