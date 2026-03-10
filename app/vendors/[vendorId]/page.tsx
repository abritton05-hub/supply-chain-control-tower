import { notFound } from 'next/navigation';
import { vendors } from '@/lib/data/mock-data';

export default function VendorDetailPage({ params }: { params: { vendorId: string } }) {
  const vendor = vendors.find((row) => row.id === params.vendorId);
  if (!vendor) return notFound();
  return <div className="erp-card p-4"><h2 className="text-lg font-semibold">{vendor.vendorName}</h2><p className="text-sm text-slate-600">{vendor.category} · {vendor.email}</p></div>;
}
