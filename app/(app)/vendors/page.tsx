import Link from 'next/link';
import { DataTable } from '@/components/data-table';
import { SectionHeader } from '@/components/section-header';
import { vendors } from '@/lib/data/mock-data';

export default function VendorsPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Vendors"
        subtitle="Supplier registry prepared for future bulk entry workflows"
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="erp-button">Add Vendor</button>
            <button className="erp-button">Paste Vendors</button>
            <button className="erp-button">Upload CSV</button>
            <button className="erp-button">Import Preview</button>
          </div>
        }
      />

      <DataTable>
        <thead>
          <tr>
            {[
              'Vendor Name',
              'Category',
              'Contact',
              'Phone',
              'Email',
              'Lead Time Days',
              'Preferred',
              'Notes',
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {vendors.map((v) => (
            <tr key={v.vendorName}>
              <td>
                <Link
                  href={`/vendors/${v.id}`}
                  className="font-semibold text-cyan-700 hover:underline"
                >
                  {v.vendorName}
                </Link>
              </td>
              <td>{v.category}</td>
              <td>{v.contact}</td>
              <td>{v.phone}</td>
              <td>{v.email}</td>
              <td>{v.leadTimeDays}</td>
              <td>{v.preferred ? 'YES' : 'NO'}</td>
              <td>{v.notes}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}