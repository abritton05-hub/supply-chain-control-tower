import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataTable } from '@/components/data-table';
import { serialRecords, shipmentLog, transactions } from '@/lib/data/mock-data';

export default function SerialDetailPage({ params }: { params: { serialNumber: string } }) {
  const record = serialRecords.find((row) => row.serialNumber === params.serialNumber);
  if (!record) return notFound();

  const movementHistory = transactions.filter((t) => t.serialNumber === record.serialNumber || t.itemId === record.itemId);
  const shipment = shipmentLog.find((s) => s.serialNumber === record.serialNumber || s.id === record.shipmentId);

  return (
    <div className="space-y-3">
      <div className="erp-card p-4">
        <h2 className="text-lg font-semibold">{record.serialNumber}</h2>
        <p className="text-sm text-slate-600">{record.itemId} · {record.status} · {record.currentLocation}</p>
        <div className="mt-2 grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-4">
          <p><span className="font-semibold">Item:</span> <Link className="text-cyan-700 hover:underline" href={`/inventory/${record.itemId}`}>{record.itemId}</Link></p>
          <p><span className="font-semibold">Vendor:</span> {record.vendor}</p>
          <p><span className="font-semibold">PO:</span> <Link className="text-cyan-700 hover:underline" href={`/open-pos/${record.poNumber}`}>{record.poNumber}</Link></p>
          <p><span className="font-semibold">Project:</span> <Link className="text-cyan-700 hover:underline" href={`/projects-builds/${record.project}`}>{record.project}</Link></p>
          <p><span className="font-semibold">Date Received:</span> {record.dateReceived}</p>
          <p><span className="font-semibold">Shipment:</span> {shipment ? <Link className="text-cyan-700 hover:underline" href={`/shipment-log/${shipment.id}`}>{shipment.id}</Link> : '-'}</p>
          <p><span className="font-semibold">Shipped Date:</span> {record.dateShipped ?? shipment?.shipDate ?? '-'}</p>
          <p><span className="font-semibold">Customer:</span> {record.customer}</p>
        </div>
      </div>

      <DataTable>
        <thead><tr>{['Date', 'Movement Type', 'From', 'To', 'Reference', 'Work Order', 'User', 'Notes'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{movementHistory.map((m) => <tr key={m.id}><td>{m.date}</td><td>{m.movementType}</td><td>{m.fromLocation}</td><td>{m.toLocation}</td><td>{m.reference.startsWith('PO-') ? <Link className="text-cyan-700 hover:underline" href={`/open-pos/${m.reference}`}>{m.reference}</Link> : m.reference}</td><td>{m.workOrder}</td><td>{m.performedByName}</td><td>{m.notes}</td></tr>)}</tbody>
      </DataTable>
    </div>
  );
}
