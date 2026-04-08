import Link from 'next/link';
import { vendors } from '@/lib/data/mock-data';
import { SectionHeader } from '@/components/section-header';

export default function VendorsPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Vendors"
        subtitle="Supplier master data and performance overview"
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="erp-button">Add Vendor</button>
            <button className="erp-button">Paste</button>
            <button className="erp-button">Upload CSV</button>
            <button className="erp-button">Import Preview</button>
          </div>
        }
      />

      <div className="erp-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Lead Time</th>
                <th className="px-4 py-3">Preferred</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/vendors/${vendor.id}`} className="hover:underline">
                      {vendor.vendorName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{vendor.category}</td>
                  <td className="px-4 py-3 text-slate-700">{vendor.contact}</td>
                  <td className="px-4 py-3 text-slate-700">{vendor.email}</td>
                  <td className="px-4 py-3 text-slate-700">{vendor.phone}</td>
                  <td className="px-4 py-3 text-slate-700">{vendor.leadTimeDays} days</td>
                  <td className="px-4 py-3 text-slate-700">
                    {vendor.preferred ? 'YES' : 'NO'}
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