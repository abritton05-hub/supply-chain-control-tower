import { DataTable } from '@/components/data-table';
import { KpiCard } from '@/components/kpi-card';
import { SectionHeader } from '@/components/section-header';
import { StatusChip } from '@/components/status-chip';
import { inventoryItems, projectBuilds, purchaseOrders, shipmentLog } from '@/lib/data/mock-data';
import { inventoryMetrics, poDaysLate, shipmentDelayFlag } from '@/lib/logic';

export default function ControlTowerPage() {
  const risky = inventoryItems.map((i) => ({ ...i, ...inventoryMetrics(i) })).sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
  const latePos = purchaseOrders.filter((po) => poDaysLate(po) !== '');
  const delayed = shipmentLog.filter((s) => shipmentDelayFlag(s) === 'YES');
  const issues = projectBuilds.filter((p) => p.issuedQty < p.requiredQty);

  return (
    <div className="space-y-4">
      <SectionHeader title="Control Tower" subtitle="Operations command center for risk, inbound, outbound, and project exceptions" />
      <div className="erp-banner">
        <p className="text-sm font-semibold">Shift Focus: Inbound risks + outbound delays + build shortages</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Top Risk Items" value={risky.length} helper="Ranked by blended risk score" />
        <KpiCard label="Late Inbound POs" value={latePos.length} helper="Expected date exceeded" />
        <KpiCard label="Delayed Shipments" value={delayed.length} helper="Flagged by delay logic" />
        <KpiCard label="Key Project Issues" value={issues.length} helper="Issued qty below required" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataTable>
          <thead><tr>{['Item ID', 'Item Name', 'Days Cover', 'Reorder Needed', 'Risk Score', 'Priority'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{risky.map((i) => <tr key={i.itemId}><td>{i.itemId}</td><td>{i.itemName}</td><td>{i.daysCover.toFixed(1)}</td><td><StatusChip value={i.reorderNeeded} /></td><td>{i.riskScore}</td><td><StatusChip value={i.priority} /></td></tr>)}</tbody>
        </DataTable>
        <DataTable>
          <thead><tr>{['PO Number', 'Vendor', 'Expected Delivery', 'Status', 'Days Late'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{latePos.map((po) => <tr key={po.poNumber}><td>{po.poNumber}</td><td>{po.vendor}</td><td>{po.expectedDelivery}</td><td><StatusChip value={po.status} /></td><td>{poDaysLate(po)}</td></tr>)}</tbody>
        </DataTable>
      </div>
    </div>
  );
}
