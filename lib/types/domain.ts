<<<<<<< HEAD
export type UserRole = 'System Admin' | 'Operations Manager' | 'Warehouse' | 'Purchasing' | 'Viewer';
export type Criticality = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
export type PriorityBand = 'ORDER NOW' | 'RISK' | 'REVIEW' | 'OK';
export type SerialLifecycleStatus = 'Received' | 'In Stock' | 'Allocated' | 'In Build' | 'Staged' | 'Shipped' | 'Delivered' | 'Returned' | 'Scrapped';
export type MovementType = 'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'ADJUSTMENT' | 'CYCLE COUNT' | 'BUILD ISSUE' | 'BUILD COMPLETE' | 'SHIP' | 'RETURN' | 'SCRAP' | 'LOCATION MOVE';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface AuditLogEntry {
  id: string;
  entityType: 'item' | 'vendor' | 'project' | 'po' | 'shipment' | 'settings';
  entityId: string;
  actionType: 'CREATE' | 'UPDATE' | 'ARCHIVE' | 'DELETE' | 'OVERRIDE';
  fieldName: string;
  oldValue: string;
  newValue: string;
  changedByUserId: string;
  changedByName: string;
  changedAt: string;
}
=======
export type Criticality = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
export type PriorityBand = 'ORDER NOW' | 'RISK' | 'REVIEW' | 'OK';
>>>>>>> origin/main

export interface InventoryItem {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
<<<<<<< HEAD
  trackingType: 'SERIALIZED' | 'QUANTITY' | 'LOT';
  serialRequired: boolean;
  autoGenerateSerials: boolean;
  serialPrefixOverride?: string;
  nextSerialNumber: number;
=======
  trackingType: 'SERIAL' | 'LOT' | 'QTY';
>>>>>>> origin/main
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
<<<<<<< HEAD
  movementType: MovementType;
=======
  transactionType: 'RECEIVED' | 'TRANSFER' | 'ISSUED' | 'ADJUSTMENT' | 'BUILT' | 'SHIPPED' | 'COUNT';
>>>>>>> origin/main
  quantity: number;
  fromLocation: string;
  toLocation: string;
  reference: string;
  workOrder: string;
<<<<<<< HEAD
  notes: string;
  performedByUserId: string;
  performedByName: string;
  performedByRole: UserRole;
  performedAt: string;
=======
  employee: string;
  notes: string;
>>>>>>> origin/main
}

export interface SerialTraceRecord {
  id: string;
  serialNumber: string;
  itemId: string;
  description: string;
  poNumber: string;
  project: string;
<<<<<<< HEAD
  vendor: string;
  dateReceived: string;
  currentLocation: string;
  workOrder: string;
  shipmentId?: string;
=======
  dateReceived: string;
  currentLocation: string;
  workOrder: string;
>>>>>>> origin/main
  buildStatus: string;
  dateShipped?: string;
  trackingNumber?: string;
  customer: string;
<<<<<<< HEAD
  status: SerialLifecycleStatus;
  notes: string;
=======
  status: 'OPEN' | 'IN_BUILD' | 'SHIPPED' | 'EXCEPTION';
>>>>>>> origin/main
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
