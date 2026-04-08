import { SectionHeader } from '@/components/section-header';

export default function RootstockPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Rootstock Master"
        subtitle="Global search and audit view for inventory, vendors, POs, shipments, users, and transactions."
      />

      <div className="erp-panel p-6">
        <input
          type="text"
          placeholder="Search inventory, vendors, purchase orders, shipments, users, and transactions"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800"
        />
      </div>

      <div className="erp-panel p-6 text-sm text-slate-600">
        Search results and audit history will live here.
      </div>
    </div>
  );
}