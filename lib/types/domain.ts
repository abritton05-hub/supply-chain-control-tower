export type Criticality = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export interface InventoryItem {
  itemId: string;
  itemName: string;
  description: string;
  trackingType: 'SERIAL' | 'LOT' | 'NONE';
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
  date: string;
  itemId: string;
  serialNumber: string;
  transactionType: 'RECEIVED' | 'TRANSFER' | 'ISSUED' | 'ADJUSTMENT' | 'BUILT' | 'SHIPPED' | 'COUNT';
  quantity: number;
  fromLocation: string;
  toLocation: string;
  poOrProject: string;
  workOrder: string;
  employee: string;
  notes: string;
}

export interface SerialTraceRecord {
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
  poNumber: string;
  vendor: string;
  itemId: string;
  project: string;
  qtyOrdered: number;
  orderDate?: string;
  expectedDelivery?: string;
  status: 'OPEN' | 'PARTIAL' | 'LATE' | 'CLOSED';
}
