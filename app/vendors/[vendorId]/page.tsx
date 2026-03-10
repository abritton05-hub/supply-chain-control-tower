import { notFound } from 'next/navigation';
<<<<<<< HEAD
import { VendorDetailTabs } from '@/components/vendor-detail-tabs';
=======
>>>>>>> origin/main
import { vendors } from '@/lib/data/mock-data';

export default function VendorDetailPage({ params }: { params: { vendorId: string } }) {
  const vendor = vendors.find((row) => row.id === params.vendorId);
  if (!vendor) return notFound();
<<<<<<< HEAD

  return (
    <div className="space-y-3">
      <div className="erp-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{vendor.vendorName}</h2>
            <p className="text-sm text-slate-600">{vendor.category} · {vendor.email}</p>
          </div>
          <div className="flex gap-2 text-xs">
            <button className="rounded border border-slate-300 px-2 py-1">Edit</button>
            <button className="rounded border border-slate-300 px-2 py-1">Archive</button>
            <button className="rounded border border-slate-300 px-2 py-1">Delete</button>
          </div>
        </div>
      </div>
      <VendorDetailTabs vendor={vendor} />
    </div>
  );
=======
  return <div className="erp-card p-4"><h2 className="text-lg font-semibold">{vendor.vendorName}</h2><p className="text-sm text-slate-600">{vendor.category} · {vendor.email}</p></div>;
>>>>>>> origin/main
}
