import { FreightQuote, InventoryItem, PurchaseOrder, ShipmentLog } from '@/lib/types/domain';

const today = new Date('2026-03-05');

export const formatDate = (date: Date) => date.toISOString().slice(0, 10);

export function inventoryMetrics(item: InventoryItem) {
  const reorderPoint = item.averageDailyUsage * item.leadTimeDays + item.safetyStock;
  const reorderNeeded = item.currentInventory <= reorderPoint ? 'YES' : 'OK';
  const daysCover = item.averageDailyUsage === 0 ? 999 : item.currentInventory / item.averageDailyUsage;
  const suggestedOrderQty = Math.max(0, reorderPoint - item.currentInventory);
  const quantityAboveSafetyStock = item.currentInventory - item.safetyStock;
  const projectedStockoutDate = formatDate(new Date(today.getTime() + daysCover * 24 * 60 * 60 * 1000));
  const nextSuggestedOrderDate = formatDate(new Date(new Date(projectedStockoutDate).getTime() - item.leadTimeDays * 24 * 60 * 60 * 1000));

  let riskScore = 0;
  riskScore += item.criticality === 'CRITICAL' ? 40 : item.criticality === 'HIGH' ? 25 : item.criticality === 'NORMAL' ? 10 : 0;
  riskScore += daysCover <= 5 ? 30 : daysCover <= 10 ? 20 : daysCover <= 20 ? 10 : 0;
  riskScore += reorderNeeded === 'YES' ? 20 : 0;
  riskScore += item.currentInventory < item.safetyStock ? 25 : 0;
  riskScore += quantityAboveSafetyStock <= 0 ? 20 : 0;
  riskScore += item.leadTimeDays > 30 ? 15 : item.leadTimeDays >= 14 ? 10 : 0;

  const priority = riskScore >= 80 ? 'ORDER NOW' : riskScore >= 55 ? 'RISK' : riskScore >= 30 ? 'REVIEW' : 'OK';

  return { reorderPoint, reorderNeeded, daysCover, suggestedOrderQty, quantityAboveSafetyStock, projectedStockoutDate, nextSuggestedOrderDate, riskScore, priority };
}

export function generateSerialNumbers(prefix: string, separator: string, start: number, paddingLength: number, count: number) {
  return Array.from({ length: count }, (_, idx) => `${prefix}${separator}${String(start + idx).padStart(paddingLength, '0')}`);
}

export function shipmentDelayFlag(ship: ShipmentLog) {
  if (ship.status === 'DELAYED') return 'YES';
  if (!ship.estimatedDelivery) return 'NO';
  if (!ship.actualDelivery && ship.status !== 'DELIVERED') return 'YES';
  if (ship.actualDelivery && ship.actualDelivery > ship.estimatedDelivery) return 'YES';
  return 'NO';
}

export function freightEstimates(quote: FreightQuote) {
  const base = quote.miles * 1.8 + quote.weight * 0.15 + quote.palletCount * 22;
  const low = Math.round(base * 0.9);
  const avg = Math.round(base);
  const high = Math.round(base * 1.12);
  return { low, avg, high, costPerMile: (avg / quote.miles).toFixed(2), costPerLb: (avg / quote.weight).toFixed(2) };
}

export function poDaysLate(po: PurchaseOrder) {
  if (!po.expectedDelivery || (po.status !== 'OPEN' && po.status !== 'PARTIAL' && po.status !== 'LATE')) return '';
  if (po.expectedDelivery >= formatDate(today)) return '';
  const diff = Math.floor((today.getTime() - new Date(po.expectedDelivery).getTime()) / (24 * 60 * 60 * 1000));
  return diff > 0 ? String(diff) : '';
}
