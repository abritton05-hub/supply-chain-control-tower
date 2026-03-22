import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataTable } from '@/components/data-table';
import { projectBuilds, purchaseOrders, serialRecords, shipmentLog, transactions } from '@/lib/data/mock-data';

const linkCls = 'text-cyan-700 hover:underline';

export default function ProjectDetailPage({ params }: { params: { projectId: string } }) {
  const project = projectBuilds.find((row) => row.projectId === params.projectId);
  if (!project) return notFound();

  const linkedSerials = serialRecords.filter((serial) => serial.project === project.projectId);
  const linkedPos = purchaseOrders.filter((po) => po.project === project.projectId || po.poNumber === project.poNumber);
  const linkedShipments = shipmentLog.filter((shipment) => shipment.project === project.projectId);
  const linkedTransactions = transactions.filter((tx) => tx.reference === project.projectId || tx.workOrder === project.workOrder || tx.itemId === project.itemId);

  return (
    <div className="space-y-3">
      <div className="erp-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{project.projectId}</h2>
            <p className="text-sm text-slate-600">{project.customer} · {project.workOrder}</p>
          </div>
          <div className="mt-2 flex gap-2 text-xs">
            <button className="rounded border border-slate-300 px-2 py-1">Edit Project</button>
            <button className="rounded border border-slate-300 px-2 py-1">Archive Project</button>
            <button className="rounded border border-slate-300 px-2 py-1">Delete Project</button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-4">
          <p><span className="font-semibold">Customer:</span> {project.customer}</p>
          <p><span className="font-semibold">Customer PO:</span> <Link className={linkCls} href={`/open-pos/${project.poNumber}`}>{project.poNumber}</Link></p>
          <p><span className="font-semibold">Work Order:</span> {project.workOrder}</p>
          <p><span className="font-semibold">Primary Item:</span> <Link className={linkCls} href={`/inventory/${project.itemId}`}>{project.itemId}</Link></p>
          <p><span className="font-semibold">Required Qty:</span> {project.requiredQty}</p>
          <p><span className="font-semibold">Issued Qty:</span> {project.issuedQty}</p>
          <p><span className="font-semibold">Build Status:</span> {project.buildStatus}</p>
          <p><span className="font-semibold">Ship Status:</span> {project.shipStatus}</p>
        </div>
      </div>

      <DataTable>
        <thead><tr>{['Serial Number', 'Item', 'Build Status', 'Current Location', 'Shipment', 'Customer'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {linkedSerials.map((serial) => (
            <tr key={serial.serialNumber}>
              <td><Link className={linkCls} href={`/serial-traceability/${serial.serialNumber}`}>{serial.serialNumber}</Link></td>
              <td><Link className={linkCls} href={`/inventory/${serial.itemId}`}>{serial.itemId}</Link></td>
              <td>{serial.buildStatus}</td>
              <td>{serial.currentLocation}</td>
              <td>{serial.shipmentId ? <Link className={linkCls} href={`/shipment-log/${serial.shipmentId}`}>{serial.shipmentId}</Link> : '-'}</td>
              <td>{serial.customer}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <DataTable>
        <thead><tr>{['PO Number', 'Vendor', 'Item', 'Qty Ordered', 'Expected Delivery', 'Status'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {linkedPos.map((po) => (
            <tr key={po.poNumber}>
              <td><Link className={linkCls} href={`/open-pos/${po.poNumber}`}>{po.poNumber}</Link></td>
              <td>{po.vendor}</td>
              <td><Link className={linkCls} href={`/inventory/${po.itemId}`}>{po.itemId}</Link></td>
              <td>{po.qtyOrdered}</td>
              <td>{po.expectedDelivery ?? '-'}</td>
              <td>{po.status}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <DataTable>
        <thead><tr>{['Shipment', 'Ship Date', 'PO Number', 'Item', 'Serial Number', 'Status'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {linkedShipments.map((shipment) => (
            <tr key={shipment.id}>
              <td><Link className={linkCls} href={`/shipment-log/${shipment.id}`}>{shipment.id}</Link></td>
              <td>{shipment.shipDate}</td>
              <td><Link className={linkCls} href={`/open-pos/${shipment.poNumber}`}>{shipment.poNumber}</Link></td>
              <td><Link className={linkCls} href={`/inventory/${shipment.itemId}`}>{shipment.itemId}</Link></td>
              <td>{shipment.serialNumber !== '-' ? <Link className={linkCls} href={`/serial-traceability/${shipment.serialNumber}`}>{shipment.serialNumber}</Link> : '-'}</td>
              <td>{shipment.status}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <DataTable>
        <thead><tr>{['Transaction', 'Date/Time', 'Type', 'Item', 'Reference', 'Work Order', 'User'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {linkedTransactions.map((tx) => (
            <tr key={tx.id}>
              <td>{tx.id}</td>
              <td>{tx.performedAt}</td>
              <td>{tx.movementType}</td>
              <td><Link className={linkCls} href={`/inventory/${tx.itemId}`}>{tx.itemId}</Link></td>
              <td>{tx.reference.startsWith('PO-') ? <Link className={linkCls} href={`/open-pos/${tx.reference}`}>{tx.reference}</Link> : tx.reference === project.projectId ? <Link className={linkCls} href={`/projects-builds/${tx.reference}`}>{tx.reference}</Link> : tx.reference}</td>
              <td>{tx.workOrder}</td>
              <td><Link className={linkCls} href={`/users/${tx.performedByUserId}`}>{tx.performedByName}</Link></td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
