export type Criticality = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
export type PriorityBand = 'ORDER NOW' | 'RISK' | 'REVIEW' | 'OK';

export interface InventoryItem {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  trackingType: 'SERIAL' | 'LOT' | 'QTY';
  inventoryType: 'RAW' | 'WIP' | 'FG' | 'MRO';
  currentInventory: number;
  averageDailyUsage: number;
  leadTimeDays: number;
  safetyStock: number;
  preferredVendor: string;
  department: 'Assembly' | 'Warehouse' | 'Service' | 'Engineering';
  criticality: Criticality;
}

export interface InventoryTransaction {
  id: string;
  date: string;
  itemId: string;
  serialNumber: string;
  transactionType: 'RECEIVED' | 'TRANSFER' | 'ISSUED' | 'ADJUSTMENT' | 'BUILT' | 'SHIPPED' | 'COUNT';
  quantity: number;
  fromLocation: string;
  toLocation: string;
  reference: string;
  workOrder: string;
  employee: string;
  notes: string;
}

export interface SerialTraceRecord {
  id: string;
  serialNumber: string;
  itemId: string;
  description: string;
  poNumber: string;
  project: string;
  dateReceived: string;
  currentLocation: string;
  workOrder: string;
  buildStatus: string;
  dateShipped?: string;
  trackingNumber?: string;
  customer: string;
  status: 'OPEN' | 'IN_BUILD' | 'SHIPPED' | 'EXCEPTION';
}

export interface ProjectBuild {
  id: string;
  projectId: string;
  customer: string;
  poNumber: string;
  workOrder: string;
  itemId: string;
  requiredQty: number;
  issuedQty: number;
  buildStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';
  shipStatus: 'NOT_READY' | 'PARTIAL' | 'SHIPPED';
}

export interface ShipmentLog {
  id: string;
  shipDate: string;
  project: string;
  poNumber: string;
  customer: string;
  itemId: string;
  serialNumber: string;
  carrier: string;
  trackingNumber: string;
  waybill: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  status: 'IN_TRANSIT' | 'DELIVERED' | 'DELAYED';
}

export interface FreightQuote {
  id: string;
  quoteId: string;
  date: string;
  originZip: string;
  destinationZip: string;
  miles: number;
  weight: number;
  palletCount: number;
  serviceType: 'LTL' | 'FTL' | 'EXPEDITED';
}

export interface Vendor {
  id: string;
  vendorName: string;
  category: string;
  contact: string;
  phone: string;
  email: string;
  leadTimeDays: number;
  preferred: boolean;
  notes: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendor: string;
  itemId: string;
  project: string;
  qtyOrdered: number;
  orderDate?: string;
  expectedDelivery?: string;
  status: 'OPEN' | 'PARTIAL' | 'LATE' | 'CLOSED';
}
