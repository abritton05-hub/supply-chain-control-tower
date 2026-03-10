<<<<<<< HEAD
import { AppUser, AuditLogEntry, FreightQuote, InventoryItem, InventoryTransaction, ProjectBuild, PurchaseOrder, SerialTraceRecord, ShipmentLog, Vendor } from '@/lib/types/domain';

export const users: AppUser[] = [
  { id: 'u1', name: 'S. Admin', email: 'admin@dai.example', role: 'System Admin', active: true },
  { id: 'u2', name: 'M. Ortega', email: 'ops@dai.example', role: 'Operations Manager', active: true },
  { id: 'u3', name: 'L. Kim', email: 'warehouse@dai.example', role: 'Warehouse', active: true },
  { id: 'u4', name: 'D. Young', email: 'purchasing@dai.example', role: 'Purchasing', active: true },
  { id: 'u5', name: 'A. Viewer', email: 'viewer@dai.example', role: 'Viewer', active: true },
];

export const currentUser: AppUser = users[1];

export const inventoryItems: InventoryItem[] = [
  { id: '1', itemId: 'INV-1001', itemName: 'Controller PCB', description: 'Main control board', trackingType: 'SERIALIZED', serialRequired: true, autoGenerateSerials: true, serialPrefixOverride: 'DAI', nextSerialNumber: 1201, inventoryType: 'RAW', currentInventory: 42, averageDailyUsage: 8, leadTimeDays: 14, safetyStock: 25, preferredVendor: 'Apex Electronics', department: 'Assembly', criticality: 'CRITICAL' },
  { id: '2', itemId: 'INV-1002', itemName: 'Power Module', description: '48V power module', trackingType: 'LOT', serialRequired: false, autoGenerateSerials: false, nextSerialNumber: 1, inventoryType: 'RAW', currentInventory: 180, averageDailyUsage: 10, leadTimeDays: 10, safetyStock: 35, preferredVendor: 'PowerGrid Supply', department: 'Assembly', criticality: 'HIGH' },
  { id: '3', itemId: 'INV-1003', itemName: 'Enclosure Kit', description: 'Industrial enclosure', trackingType: 'QUANTITY', serialRequired: false, autoGenerateSerials: false, nextSerialNumber: 1, inventoryType: 'FG', currentInventory: 24, averageDailyUsage: 3, leadTimeDays: 18, safetyStock: 10, preferredVendor: 'MetalWorks Inc', department: 'Warehouse', criticality: 'NORMAL' },
  { id: '4', itemId: 'INV-1004', itemName: 'Bearing Set', description: 'Service bearing pack', trackingType: 'LOT', serialRequired: false, autoGenerateSerials: false, nextSerialNumber: 1, inventoryType: 'MRO', currentInventory: 12, averageDailyUsage: 2, leadTimeDays: 20, safetyStock: 9, preferredVendor: 'BearingHouse', department: 'Service', criticality: 'HIGH' },
  { id: '5', itemId: 'INV-1005', itemName: 'Harness C', description: 'Wiring harness assembly', trackingType: 'SERIALIZED', serialRequired: true, autoGenerateSerials: true, serialPrefixOverride: 'HC', nextSerialNumber: 811, inventoryType: 'WIP', currentInventory: 9, averageDailyUsage: 4, leadTimeDays: 7, safetyStock: 12, preferredVendor: 'WireTech', department: 'Engineering', criticality: 'CRITICAL' },
];

export const transactions: InventoryTransaction[] = [
  { id: 't1', date: '2026-02-28', itemId: 'INV-1001', serialNumber: 'SN-CT-771', movementType: 'RECEIPT', quantity: 30, fromLocation: 'Vendor Dock', toLocation: 'Main WH', reference: 'PO-9101', workOrder: '-', notes: 'Received complete lot', performedByUserId: 'u3', performedByName: 'L. Kim', performedByRole: 'Warehouse', performedAt: '2026-02-28T09:15:00Z' },
  { id: 't2', date: '2026-03-01', itemId: 'INV-1001', serialNumber: 'SN-CT-771', movementType: 'ISSUE', quantity: 8, fromLocation: 'Main WH', toLocation: 'Line 2', reference: 'PRJ-2026-04', workOrder: 'WO-2211', notes: 'Issued for build', performedByUserId: 'u3', performedByName: 'L. Kim', performedByRole: 'Warehouse', performedAt: '2026-03-01T10:02:00Z' },
  { id: 't3', date: '2026-03-02', itemId: 'INV-1005', serialNumber: 'SN-HC-110', movementType: 'BUILD COMPLETE', quantity: 3, fromLocation: 'Line 2', toLocation: 'QA', reference: 'PRJ-2026-04', workOrder: 'WO-2211', notes: 'Build complete pending QA', performedByUserId: 'u2', performedByName: 'M. Ortega', performedByRole: 'Operations Manager', performedAt: '2026-03-02T14:20:00Z' },
  { id: 't4', date: '2026-03-03', itemId: 'INV-1003', serialNumber: '-', movementType: 'TRANSFER', quantity: 5, fromLocation: 'Overflow', toLocation: 'Main WH', reference: '-', workOrder: '-', notes: 'Rebalanced stock', performedByUserId: 'u3', performedByName: 'L. Kim', performedByRole: 'Warehouse', performedAt: '2026-03-03T11:11:00Z' },
  { id: 't5', date: '2026-03-04', itemId: 'INV-1004', serialNumber: '-', movementType: 'CYCLE COUNT', quantity: 12, fromLocation: 'Service Cage', toLocation: 'Service Cage', reference: '-', workOrder: '-', notes: 'Cycle count verified', performedByUserId: 'u1', performedByName: 'S. Admin', performedByRole: 'System Admin', performedAt: '2026-03-04T08:40:00Z' },
];

export const auditLog: AuditLogEntry[] = [
  { id: 'a1', entityType: 'item', entityId: 'INV-1001', actionType: 'UPDATE', fieldName: 'safetyStock', oldValue: '20', newValue: '25', changedByUserId: 'u1', changedByName: 'S. Admin', changedAt: '2026-03-01T12:30:00Z' },
  { id: 'a2', entityType: 'vendor', entityId: 'v3', actionType: 'UPDATE', fieldName: 'leadTimeDays', oldValue: '9', newValue: '7', changedByUserId: 'u4', changedByName: 'D. Young', changedAt: '2026-03-02T09:10:00Z' },
  { id: 'a3', entityType: 'shipment', entityId: 'sh3', actionType: 'ARCHIVE', fieldName: 'status', oldValue: 'IN_TRANSIT', newValue: 'DELAYED', changedByUserId: 'u2', changedByName: 'M. Ortega', changedAt: '2026-03-03T16:05:00Z' },
];

export const serialRecords: SerialTraceRecord[] = [
  { id: 's1', serialNumber: 'SN-CT-771', itemId: 'INV-1001', description: 'Controller PCB', poNumber: 'PO-9101', project: 'PRJ-2026-04', vendor: 'Apex Electronics', dateReceived: '2026-02-28', currentLocation: 'Line 2', workOrder: 'WO-2211', buildStatus: 'IN_PROGRESS', customer: 'Stellar Mining', shipmentId: 'sh2', status: 'In Build', notes: 'Allocated to build' },
  { id: 's2', serialNumber: 'SN-CT-772', itemId: 'INV-1001', description: 'Controller PCB', poNumber: 'PO-9101', project: 'PRJ-2026-05', vendor: 'Apex Electronics', dateReceived: '2026-02-28', currentLocation: 'Shipping', workOrder: 'WO-2212', buildStatus: 'COMPLETE', dateShipped: '2026-03-03', trackingNumber: '1Z999AA122', customer: 'North Grid', shipmentId: 'sh1', status: 'Shipped', notes: 'Shipped to customer' },
  { id: 's3', serialNumber: 'SN-HC-110', itemId: 'INV-1005', description: 'Harness C', poNumber: 'PO-9108', project: 'PRJ-2026-04', vendor: 'WireTech', dateReceived: '2026-02-25', currentLocation: 'QA', workOrder: 'WO-2211', buildStatus: 'IN_REVIEW', customer: 'Stellar Mining', status: 'In Stock', notes: 'QA hold complete' },
  { id: 's4', serialNumber: 'SN-HC-111', itemId: 'INV-1005', description: 'Harness C', poNumber: 'PO-9108', project: 'PRJ-2026-06', vendor: 'WireTech', dateReceived: '2026-02-25', currentLocation: 'Exception Hold', workOrder: 'WO-2230', buildStatus: 'HOLD', customer: 'AeroFab', shipmentId: 'sh3', status: 'Staged', notes: 'Awaiting carrier handoff' },
=======
import { FreightQuote, InventoryItem, InventoryTransaction, ProjectBuild, PurchaseOrder, SerialTraceRecord, ShipmentLog, Vendor } from '@/lib/types/domain';

export const inventoryItems: InventoryItem[] = [
  { id: '1', itemId: 'INV-1001', itemName: 'Controller PCB', description: 'Main control board', trackingType: 'SERIAL', inventoryType: 'RAW', currentInventory: 42, averageDailyUsage: 8, leadTimeDays: 14, safetyStock: 25, preferredVendor: 'Apex Electronics', department: 'Assembly', criticality: 'CRITICAL' },
  { id: '2', itemId: 'INV-1002', itemName: 'Power Module', description: '48V power module', trackingType: 'LOT', inventoryType: 'RAW', currentInventory: 180, averageDailyUsage: 10, leadTimeDays: 10, safetyStock: 35, preferredVendor: 'PowerGrid Supply', department: 'Assembly', criticality: 'HIGH' },
  { id: '3', itemId: 'INV-1003', itemName: 'Enclosure Kit', description: 'Industrial enclosure', trackingType: 'QTY', inventoryType: 'FG', currentInventory: 24, averageDailyUsage: 3, leadTimeDays: 18, safetyStock: 10, preferredVendor: 'MetalWorks Inc', department: 'Warehouse', criticality: 'NORMAL' },
  { id: '4', itemId: 'INV-1004', itemName: 'Bearing Set', description: 'Service bearing pack', trackingType: 'LOT', inventoryType: 'MRO', currentInventory: 12, averageDailyUsage: 2, leadTimeDays: 20, safetyStock: 9, preferredVendor: 'BearingHouse', department: 'Service', criticality: 'HIGH' },
  { id: '5', itemId: 'INV-1005', itemName: 'Harness C', description: 'Wiring harness assembly', trackingType: 'SERIAL', inventoryType: 'WIP', currentInventory: 9, averageDailyUsage: 4, leadTimeDays: 7, safetyStock: 12, preferredVendor: 'WireTech', department: 'Engineering', criticality: 'CRITICAL' },
];

export const transactions: InventoryTransaction[] = [
  { id: 't1', date: '2026-02-28', itemId: 'INV-1001', serialNumber: 'SN-CT-771', transactionType: 'RECEIVED', quantity: 30, fromLocation: 'Vendor Dock', toLocation: 'Main WH', reference: 'PO-9101', workOrder: '-', employee: 'L. Kim', notes: 'Received complete lot' },
  { id: 't2', date: '2026-03-01', itemId: 'INV-1001', serialNumber: 'SN-CT-771', transactionType: 'ISSUED', quantity: 8, fromLocation: 'Main WH', toLocation: 'Line 2', reference: 'PRJ-2026-04', workOrder: 'WO-2211', employee: 'A. Rivera', notes: 'Issued for build' },
  { id: 't3', date: '2026-03-02', itemId: 'INV-1005', serialNumber: 'SN-HC-110', transactionType: 'BUILT', quantity: 3, fromLocation: 'Line 2', toLocation: 'QA', reference: 'PRJ-2026-04', workOrder: 'WO-2211', employee: 'M. Dean', notes: 'Build complete pending QA' },
  { id: 't4', date: '2026-03-03', itemId: 'INV-1003', serialNumber: '-', transactionType: 'TRANSFER', quantity: 5, fromLocation: 'Overflow', toLocation: 'Main WH', reference: '-', workOrder: '-', employee: 'N. Chen', notes: 'Rebalanced stock' },
  { id: 't5', date: '2026-03-04', itemId: 'INV-1004', serialNumber: '-', transactionType: 'COUNT', quantity: 12, fromLocation: 'Service Cage', toLocation: 'Service Cage', reference: '-', workOrder: '-', employee: 'S. Patel', notes: 'Cycle count verified' },
];

export const serialRecords: SerialTraceRecord[] = [
  { id: 's1', serialNumber: 'SN-CT-771', itemId: 'INV-1001', description: 'Controller PCB', poNumber: 'PO-9101', project: 'PRJ-2026-04', dateReceived: '2026-02-28', currentLocation: 'Line 2', workOrder: 'WO-2211', buildStatus: 'IN_PROGRESS', customer: 'Stellar Mining', status: 'IN_BUILD' },
  { id: 's2', serialNumber: 'SN-CT-772', itemId: 'INV-1001', description: 'Controller PCB', poNumber: 'PO-9101', project: 'PRJ-2026-05', dateReceived: '2026-02-28', currentLocation: 'Shipping', workOrder: 'WO-2212', buildStatus: 'COMPLETE', dateShipped: '2026-03-03', trackingNumber: '1Z999AA122', customer: 'North Grid', status: 'SHIPPED' },
  { id: 's3', serialNumber: 'SN-HC-110', itemId: 'INV-1005', description: 'Harness C', poNumber: 'PO-9108', project: 'PRJ-2026-04', dateReceived: '2026-02-25', currentLocation: 'QA', workOrder: 'WO-2211', buildStatus: 'IN_REVIEW', customer: 'Stellar Mining', status: 'OPEN' },
  { id: 's4', serialNumber: 'SN-HC-111', itemId: 'INV-1005', description: 'Harness C', poNumber: 'PO-9108', project: 'PRJ-2026-06', dateReceived: '2026-02-25', currentLocation: 'Exception Hold', workOrder: 'WO-2230', buildStatus: 'HOLD', customer: 'AeroFab', status: 'EXCEPTION' },
>>>>>>> origin/main
];

export const projectBuilds: ProjectBuild[] = [
  { id: 'p1', projectId: 'PRJ-2026-04', customer: 'Stellar Mining', poNumber: 'PO-CUST-4120', workOrder: 'WO-2211', itemId: 'INV-1001', requiredQty: 40, issuedQty: 28, buildStatus: 'IN_PROGRESS', shipStatus: 'PARTIAL' },
  { id: 'p2', projectId: 'PRJ-2026-05', customer: 'North Grid', poNumber: 'PO-CUST-4124', workOrder: 'WO-2212', itemId: 'INV-1003', requiredQty: 20, issuedQty: 20, buildStatus: 'COMPLETE', shipStatus: 'SHIPPED' },
  { id: 'p3', projectId: 'PRJ-2026-06', customer: 'AeroFab', poNumber: 'PO-CUST-4130', workOrder: 'WO-2230', itemId: 'INV-1005', requiredQty: 25, issuedQty: 10, buildStatus: 'IN_PROGRESS', shipStatus: 'NOT_READY' },
];

export const shipmentLog: ShipmentLog[] = [
  { id: 'sh1', shipDate: '2026-03-02', project: 'PRJ-2026-05', poNumber: 'PO-CUST-4124', customer: 'North Grid', itemId: 'INV-1003', serialNumber: 'SN-CT-772', carrier: 'UPS Freight', trackingNumber: '1Z999AA122', waybill: 'WB-1110', estimatedDelivery: '2026-03-05', actualDelivery: '2026-03-05', status: 'DELIVERED' },
  { id: 'sh2', shipDate: '2026-03-03', project: 'PRJ-2026-04', poNumber: 'PO-CUST-4120', customer: 'Stellar Mining', itemId: 'INV-1001', serialNumber: 'SN-CT-771', carrier: 'FedEx Freight', trackingNumber: '77766123', waybill: 'WB-1111', estimatedDelivery: '2026-03-06', status: 'IN_TRANSIT' },
  { id: 'sh3', shipDate: '2026-03-01', project: 'PRJ-2026-06', poNumber: 'PO-CUST-4130', customer: 'AeroFab', itemId: 'INV-1005', serialNumber: 'SN-HC-111', carrier: 'DHL', trackingNumber: 'DHL-8822', waybill: 'WB-1112', estimatedDelivery: '2026-03-03', status: 'DELAYED' },
];

export const freightQuotes: FreightQuote[] = [
  { id: 'f1', quoteId: 'FQ-1001', date: '2026-03-01', originZip: '75001', destinationZip: '60601', miles: 925, weight: 6800, palletCount: 8, serviceType: 'LTL' },
  { id: 'f2', quoteId: 'FQ-1002', date: '2026-03-02', originZip: '75001', destinationZip: '98101', miles: 2120, weight: 12000, palletCount: 14, serviceType: 'FTL' },
  { id: 'f3', quoteId: 'FQ-1003', date: '2026-03-03', originZip: '30301', destinationZip: '33101', miles: 670, weight: 4300, palletCount: 5, serviceType: 'EXPEDITED' },
];

export const vendors: Vendor[] = [
  { id: 'v1', vendorName: 'Apex Electronics', category: 'Electronics', contact: 'J. Morris', phone: '555-102-2390', email: 'jmorris@apex.example', leadTimeDays: 14, preferred: true, notes: 'Primary PCB source' },
  { id: 'v2', vendorName: 'PowerGrid Supply', category: 'Power', contact: 'D. Young', phone: '555-203-8821', email: 'dyoung@powergrid.example', leadTimeDays: 10, preferred: true, notes: 'Dual source available' },
  { id: 'v3', vendorName: 'WireTech', category: 'Cable & Harness', contact: 'K. Liu', phone: '555-888-1222', email: 'kliu@wiretech.example', leadTimeDays: 7, preferred: false, notes: 'MOQ on custom harnesses' },
];

export const purchaseOrders: PurchaseOrder[] = [
  { id: 'po1', poNumber: 'PO-9101', vendor: 'Apex Electronics', itemId: 'INV-1001', project: 'PRJ-2026-04', qtyOrdered: 60, orderDate: '2026-02-15', expectedDelivery: '2026-03-01', status: 'PARTIAL' },
  { id: 'po2', poNumber: 'PO-9108', vendor: 'WireTech', itemId: 'INV-1005', project: 'PRJ-2026-06', qtyOrdered: 40, orderDate: '2026-02-18', expectedDelivery: '2026-02-28', status: 'LATE' },
  { id: 'po3', poNumber: 'PO-9110', vendor: 'MetalWorks Inc', itemId: 'INV-1003', project: 'PRJ-2026-05', qtyOrdered: 22, orderDate: '2026-02-25', expectedDelivery: '2026-03-10', status: 'OPEN' },
];
