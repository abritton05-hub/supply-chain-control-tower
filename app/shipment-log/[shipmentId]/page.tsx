import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataTable } from '@/components/data-table';
import { projectBuilds, serialRecords, shipmentLog, transactions } from '@/lib/data/mock-data';

const linkCls = 'text-cyan-700 hover:underline';

export default function ShipmentDetailPage({ params }: { params: { shipmentId: string } }) {
  const shipment = shipmentLog.find((row) => row.id === params.shipmentId);
  if (!shipment) return notFound();

  const linkedSerials = serialRecords.filter((serial) => serial.shipmentId === shipment.id || serial.serialNumber === shipment.serialNumber);
  const relatedProject = projectBuilds.find((project) => project.projectId === shipment.project);
  const linkedTransactions = transactions.filter((tx) => tx.serialNumber === shipment.serialNumber || tx.itemId === shipment.itemId || tx.reference === shipment.poNumber || tx.reference === shipment.project);

  return (
    <div className="space-y-3">
      <div className="erp-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{shipment.id}</h2>
            <p className="text-sm text-slate-600">{shipment.customer} · {shipment.trackingNumber} · {shipment.status}</p>
          </div>
          <div className="mt-2 flex gap-2 text-xs">
            <button className="rounded border border-slate-300 px-2 py-1">Edit Shipment</button>
            <button className="rounded border border-slate-300 px-2 py-1">Archive Shipment</button>
            <button className="rounded border border-slate-300 px-2 py-1">Delete Shipment</button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-4">
          <p><span className="font-semibold">Project:</span> <Link className={linkCls} href={`/projects-builds/${shipment.project}`}>{shipment.project}</Link></p>
          <p><span className="font-semibold">Customer PO:</span> <Link className={linkCls} href={`/open-pos/${shipment.poNumber}`}>{shipment.poNumber}</Link></p>
          <p><span className="font-semibold">Item:</span> <Link className={linkCls} href={`/inventory/${shipment.itemId}`}>{shipment.itemId}</Link></p>
          <p><span className="font-semibold">Serial:</span> {shipment.serialNumber !== '-' ? <Link className={linkCls} href={`/serial-traceability/${shipment.serialNumber}`}>{shipment.serialNumber}</Link> : '-'}</p>
          <p><span className="font-semibold">Carrier:</span> {shipment.carrier}</p>
          <p><span className="font-semibold">Tracking Number:</span> {shipment.trackingNumber}</p>
          <p><span className="font-semibold">Waybill:</span> {shipment.waybill}</p>
          <p><span className="font-semibold">Estimated Delivery:</span> {shipment.estimatedDelivery}</p>
          <p><span className="font-semibold">Actual Delivery:</span> {shipment.actualDelivery ?? '-'}</p>
          <p><span className="font-semibold">Build Status:</span> {relatedProject?.buildStatus ?? '-'}</p>
          <p><span className="font-semibold">Ship Status:</span> {relatedProject?.shipStatus ?? '-'}</p>
          <p><span className="font-semibold">Customer:</span> {shipment.customer}</p>
        </div>
      </div>

      <DataTable>
        <thead><tr>{['Serial Number', 'Item', 'PO Number', 'Project', 'Current Location', 'Status'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {linkedSerials.map((serial) => (
            <tr key={serial.serialNumber}>
              <td><Link className={linkCls} href={`/serial-traceability/${serial.serialNumber}`}>{serial.serialNumber}</Link></td>
              <td><Link className={linkCls} href={`/inventory/${serial.itemId}`}>{serial.itemId}</Link></td>
              <td><Link className={linkCls} href={`/open-pos/${serial.poNumber}`}>{serial.poNumber}</Link></td>
              <td><Link className={linkCls} href={`/projects-builds/${serial.project}`}>{serial.project}</Link></td>
              <td>{serial.currentLocation}</td>
              <td>{serial.status}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <DataTable>
        <thead><tr>{['Transaction', 'Date/Time', 'Type', 'From', 'To', 'Reference', 'User'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {linkedTransactions.map((tx) => (
            <tr key={tx.id}>
              <td>{tx.id}</td>
              <td>{tx.performedAt}</td>
              <td>{tx.movementType}</td>
              <td>{tx.fromLocation}</td>
              <td>{tx.toLocation}</td>
              <td>{tx.reference.startsWith('PO-') ? <Link className={linkCls} href={`/open-pos/${tx.reference}`}>{tx.reference}</Link> : tx.reference.startsWith('PRJ-') ? <Link className={linkCls} href={`/projects-builds/${tx.reference}`}>{tx.reference}</Link> : tx.reference}</td>
              <td><Link className={linkCls} href={`/users/${tx.performedByUserId}`}>{tx.performedByName}</Link></td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
