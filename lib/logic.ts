import { FreightQuote, InventoryItem, PurchaseOrder, ShipmentLog } from '@/lib/types/domain';

const today = new Date('2026-03-05');

export const formatDate = (date: Date) => date.toISOString().slice(0, 10);

function clampRiskScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function criticalityWeight(criticality: InventoryItem['criticality']) {
  if (criticality === 'CRITICAL') return 25;
  if (criticality === 'HIGH') return 15;
  if (criticality === 'NORMAL') return 8;
  return 0;
}

function daysCoverWeight(daysCover: number) {
  if (daysCover <= 0) return 45;
  if (daysCover <= 5) return 35;
  if (daysCover <= 10) return 22;
  if (daysCover <= 20) return 10;
  return 0;
}

function getPriorityBand(riskScore: number) {
  if (riskScore >= 90) return 'URGENT';
  if (riskScore >= 75) return 'ORDER NOW';
  if (riskScore >= 50) return 'RISK';
  if (riskScore >= 25) return 'REVIEW';
  return 'OK';
}

export function inventoryMetrics(item: InventoryItem) {
  const reorderPoint = item.averageDailyUsage * item.leadTimeDays + item.safetyStock;
  const reorderNeeded = item.currentInventory <= reorderPoint ? 'YES' : 'OK';
  const daysCover = item.averageDailyUsage === 0 ? 999 : item.currentInventory / item.averageDailyUsage;
  const suggestedOrderQty = Math.max(0, reorderPoint - item.currentInventory);
  const quantityAboveSafetyStock = item.currentInventory - item.safetyStock;

  const projectedStockoutDate = formatDate(
    new Date(today.getTime() + Math.max(daysCover, 0) * 24 * 60 * 60 * 1000),
  );

  const nextSuggestedOrderDate = formatDate(
    new Date(new Date(projectedStockoutDate).getTime() - item.leadTimeDays * 24 * 60 * 60 * 1000),
  );

  const todayString = formatDate(today);
  const pastReorderDate = nextSuggestedOrderDate < todayString;
  const willRunOutBeforeNextReceipt = pastReorderDate && reorderNeeded === 'YES' && daysCover < item.leadTimeDays;

  let riskScore =
    daysCoverWeight(daysCover) +
    criticalityWeight(item.criticality) +
    (quantityAboveSafetyStock <= 0 ? 10 : 0) +
    (pastReorderDate ? 10 : 0) +
    (willRunOutBeforeNextReceipt ? 20 : 0);

  // Absolute worst-case condition = 100
  if (pastReorderDate && reorderNeeded === 'YES' && willRunOutBeforeNextReceipt) {
    riskScore = Math.max(riskScore, 100);
  }

  riskScore = clampRiskScore(riskScore);

  const priority = getPriorityBand(riskScore);

  return {
    reorderPoint,
    reorderNeeded,
    daysCover,
    suggestedOrderQty,
    quantityAboveSafetyStock,
    projectedStockoutDate,
    nextSuggestedOrderDate,
    pastReorderDate,
    willRunOutBeforeNextReceipt,
    riskScore,
    priority,
  };
}

export function generateSerialNumbers(
  prefix: string,
  separator: string,
  start: number,
  paddingLength: number,
  count: number,
) {
  return Array.from(
    { length: count },
    (_, idx) => `${prefix}${separator}${String(start + idx).padStart(paddingLength, '0')}`,
  );
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
  return {
    low,
    avg,
    high,
    costPerMile: (avg / quote.miles).toFixed(2),
    costPerLb: (avg / quote.weight).toFixed(2),
  };
}

export function poDaysLate(po: PurchaseOrder) {
  if (!po.expectedDelivery || (po.status !== 'OPEN' && po.status !== 'PARTIAL' && po.status !== 'LATE')) return '';
  if (po.expectedDelivery >= formatDate(today)) return '';
  const diff = Math.floor((today.getTime() - new Date(po.expectedDelivery).getTime()) / (24 * 60 * 60 * 1000));
  return diff > 0 ? String(diff) : '';
}