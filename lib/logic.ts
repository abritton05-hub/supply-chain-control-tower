import { FreightQuote, InventoryItem, PurchaseOrder, ShipmentLog } from '@/lib/types/domain';

const today = new Date('2026-03-05');

export const formatDate = (date: Date) => date.toISOString().slice(0, 10);

export function inventoryMetrics(item: InventoryItem) {
  const reorderPoint = item.averageDailyUsage * item.leadTimeDays + item.safetyStock;
  const reorderNeeded = item.currentInventory <= reorderPoint ? 'YES' : 'OK';
  const daysCover = item.averageDailyUsage === 0 ? 999 : item.currentInventory / item.averageDailyUsage;
  const suggestedOrderQty = Math.max(0, reorderPoint - item.currentInventory);
  const projectedStockoutDate = formatDate(new Date(today.getTime() + daysCover * 24 * 60 * 60 * 1000));
  const nextSuggestedOrderDate = formatDate(new Date(new Date(projectedStockoutDate).getTime() - item.leadTimeDays * 24 * 60 * 60 * 1000));
  const riskScore = Math.round((item.criticality === 'CRITICAL' ? 40 : item.criticality === 'HIGH' ? 30 : item.criticality === 'NORMAL' ? 20 : 10) + item.leadTimeDays + Math.max(0, 25 - daysCover));
  const priority = riskScore > 70 ? 'ORDER NOW' : riskScore > 55 ? 'RISK' : riskScore > 40 ? 'REVIEW' : 'OK';
  return { reorderPoint, reorderNeeded, daysCover, suggestedOrderQty, projectedStockoutDate, nextSuggestedOrderDate, riskScore, priority };
}

export function shipmentDelayFlag(ship: ShipmentLog) {
  if (ship.status === 'DELAYED') return 'YES';
  if (!ship.actualDelivery) return 'PENDING';
  return ship.actualDelivery > ship.estimatedDelivery ? 'YES' : 'NO';
}

export function freightEstimates(quote: FreightQuote) {
  const base = quote.miles * 1.8 + quote.weight * 0.15 + quote.palletCount * 22;
  const low = Math.round(base * 0.9);
  const avg = Math.round(base);
  const high = Math.round(base * 1.12);
  return {
    low,
    avg,
    high,
    costPerMile: (avg / quote.miles).toFixed(2),
    costPerLb: (avg / quote.weight).toFixed(2),
  };
}

export function poDaysLate(po: PurchaseOrder) {
  if (!po.poNumber || !po.expectedDelivery || po.status === 'CLOSED') return '';
  if (po.expectedDelivery >= formatDate(today)) return '';
  const diff = Math.floor((today.getTime() - new Date(po.expectedDelivery).getTime()) / (24 * 60 * 60 * 1000));
  return diff > 0 ? String(diff) : '';
}
