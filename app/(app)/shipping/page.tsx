import { SectionHeader } from '@/components/section-header';

const shipments = [
  {
    item: 'Server Rack',
    from: 'SEA991',
    to: 'A13',
    status: 'REQUESTED',
    tracking: '',
  },
  {
    item: 'Fiber Plate',
    from: 'A13',
    to: 'SEA991',
    status: 'SHIPPED',
    tracking: '1Z999AA10123456784',
  },
];

export default function ShippingPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Shipping Dashboard"
        subtitle="Track all movement between SEA sites and warehouse A13"
        actions={
          <div className="flex gap-2">
            <button className="erp-button">New Request</button>
            <button className="erp-button">Upload</button>
          </div>
        }
      />

      <div className="erp-panel">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tracking</th>
            </tr>
          </thead>

          <tbody>
            {shipments.map((s, i) => (
              <tr key={i} className="border-b">
                <td className="px-4 py-3">{s.item}</td>
                <td className="px-4 py-3">{s.from}</td>
                <td className="px-4 py-3">{s.to}</td>
                <td className="px-4 py-3">{s.status}</td>
                <td className="px-4 py-3">{s.tracking || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}