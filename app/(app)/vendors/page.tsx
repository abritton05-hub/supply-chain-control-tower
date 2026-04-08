import { notFound } from 'next/navigation';
import { VendorDetailTabs } from '@/components/vendor-detail-tabs';
import { vendors } from '@/lib/data/mock-data';
import { SectionHeader } from '@/components/section-header';

export default function VendorDetailPage({ params }: { params: { vendorId: string } }) {
  const vendor = vendors.find((row) => row.id === params.vendorId);
  if (!vendor) return notFound();

  return (
    <div className="space-y-4">
      <SectionHeader
        title={vendor.vendorName}
        subtitle={`${vendor.category} supplier · ${vendor.email}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="erp-button">Edit Vendor</button>
            <button className="erp-button">Archive</button>
            <button className="erp-button">Delete</button>
          </div>
        }
      />

      <div className="erp-panel p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Primary Contact
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900">{vendor.contact}</div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Phone
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900">{vendor.phone}</div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Lead Time
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {vendor.leadTimeDays} days
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Preferred
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {vendor.preferred ? 'YES' : 'NO'}
            </div>
          </div>
        </div>
      </div>

      <VendorDetailTabs vendor={vendor} />
    </div>
  );
}