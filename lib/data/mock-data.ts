import { FreightQuote, InventoryItem, InventoryTransaction, ProjectBuild, PurchaseOrder, SerialTraceRecord, ShipmentLog, Vendor } from '@/lib/types/domain';

export const inventoryItems: InventoryItem[] = [
  { itemId: 'INV-1001', itemName: 'Controller PCB', description: 'Main control board', trackingType: 'SERIAL', inventoryType: 'RAW', currentInventory: 42, averageDailyUsage: 8, leadTimeDays: 14, safetyStock: 25, preferredVendor: 'Apex Electronics', department: 'Assembly', criticality: 'CRITICAL' },
  { itemId: 'INV-1002', itemName: 'Power Module', description: '48V power module', trackingType: 'LOT', inventoryType: 'RAW', currentInventory: 180, averageDailyUsage: 10, leadTimeDays: 10, safetyStock: 35, preferredVendor: 'PowerGrid Supply', department: 'Assembly', criticality: 'HIGH' },
  { itemId: 'INV-1003', itemName: 'Enclosure Kit', description: 'Industrial enclosure', trackingType: 'NONE', inventoryType: 'FG', currentInventory: 24, averageDailyUsage: 3, leadTimeDays: 18, safetyStock: 10, preferredVendor: 'MetalWorks Inc', department: 'Warehouse', criticality: 'NORMAL' },
  { itemId: 'INV-1004', itemName: 'Bearing Set', description: 'Service bearing pack', trackingType: 'LOT', inventoryType: 'MRO', currentInventory: 12, averageDailyUsage: 2, leadTimeDays: 20, safetyStock: 9, preferredVendor: 'BearingHouse', department: 'Service', criticality: 'HIGH' },
  { itemId: 'INV-1005', itemName: 'Harness C', description: 'Wiring harness assembly', trackingType: 'SERIAL', inventoryType: 'WIP', currentInventory: 9, averageDailyUsage: 4, leadTimeDays: 7, safetyStock: 12, preferredVendor: 'WireTech', department: 'Engineering', criticality: 'CRITICAL' },
];

export const transactions: InventoryTransaction[] = [
  { date: '2026-02-28', itemId: 'INV-1001', serialNumber: 'SN-CT-771', transactionType: 'RECEIVED', quantity: 30, fromLocation: 'Vendor Dock', toLocation: 'Main WH', poOrProject: 'PO-9101', workOrder: '-', employee: 'L. Kim', notes: 'Received complete lot' },
  { date: '2026-03-01', itemId: 'INV-1001', serialNumber: 'SN-CT-771', transactionType: 'ISSUED', quantity: 8, fromLocation: 'Main WH', toLocation: 'Line 2', poOrProject: 'PRJ-2026-04', workOrder: 'WO-2211', employee: 'A. Rivera', notes: 'Issued for build' },
  { date: '2026-03-02', itemId: 'INV-1005', serialNumber: 'SN-HC-110', transactionType: 'BUILT', quantity: 3, fromLocation: 'Line 2', toLocation: 'QA', poOrProject: 'PRJ-2026-04', workOrder: 'WO-2211', employee: 'M. Dean', notes: 'Build complete pending QA' },
  { date: '2026-03-03', itemId: 'INV-1003', serialNumber: '-', transactionType: 'TRANSFER', quantity: 5, fromLocation: 'Overflow', toLocation: 'Main WH', poOrProject: '-', workOrder: '-', employee: 'N. Chen', notes: 'Rebalanced stock' },
  { date: '2026-03-04', itemId: 'INV-1004', serialNumber: '-', transactionType: 'COUNT', quantity: 12, fromLocation: 'Service Cage', toLocation: 'Service Cage', poOrProject: '-', workOrder: '-', employee: 'S. Patel', notes: 'Cycle count verified' },
];

export const serialRecords: SerialTraceRecord[] = [
  { serialNumber: 'SN-CT-771', itemId: 'INV-1001', description: 'Controller PCB', poNumber: 'PO-9101', project: 'PRJ-2026-04', dateReceived: '2026-02-28', currentLocation: 'Line 2', workOrder: 'WO-2211', buildStatus: 'IN_PROGRESS', customer: 'Stellar Mining', status: 'IN_BUILD' },
  { serialNumber: 'SN-CT-772', itemId: 'INV-1001', description: 'Controller PCB', poNumber: 'PO-9101', project: 'PRJ-2026-05', dateReceived: '2026-02-28', currentLocation: 'Shipping', workOrder: 'WO-2212', buildStatus: 'COMPLETE', dateShipped: '2026-03-03', trackingNumber: '1Z999AA122', customer: 'North Grid', status: 'SHIPPED' },
  { serialNumber: 'SN-HC-110', itemId: 'INV-1005', description: 'Harness C', poNumber: 'PO-9108', project: 'PRJ-2026-04', dateReceived: '2026-02-25', currentLocation: 'QA', workOrder: 'WO-2211', buildStatus: 'IN_REVIEW', customer: 'Stellar Mining', status: 'OPEN' },
  { serialNumber: 'SN-HC-111', itemId: 'INV-1005', description: 'Harness C', poNumber: 'PO-9108', project: 'PRJ-2026-06', dateReceived: '2026-02-25', currentLocation: 'Exception Hold', workOrder: 'WO-2230', buildStatus: 'HOLD', customer: 'AeroFab', status: 'EXCEPTION' },
];

export const projectBuilds: ProjectBuild[] = [
  { projectId: 'PRJ-2026-04', customer: 'Stellar Mining', poNumber: 'PO-CUST-4120', workOrder: 'WO-2211', itemId: 'INV-1001', requiredQty: 40, issuedQty: 28, buildStatus: 'IN_PROGRESS', shipStatus: 'PARTIAL' },
  { projectId: 'PRJ-2026-05', customer: 'North Grid', poNumber: 'PO-CUST-4124', workOrder: 'WO-2212', itemId: 'INV-1003', requiredQty: 20, issuedQty: 20, buildStatus: 'COMPLETE', shipStatus: 'SHIPPED' },
  { projectId: 'PRJ-2026-06', customer: 'AeroFab', poNumber: 'PO-CUST-4130', workOrder: 'WO-2230', itemId: 'INV-1005', requiredQty: 25, issuedQty: 10, buildStatus: 'IN_PROGRESS', shipStatus: 'NOT_READY' },
];

export const shipmentLog: ShipmentLog[] = [
  { shipDate: '2026-03-02', project: 'PRJ-2026-05', poNumber: 'PO-CUST-4124', customer: 'North Grid', itemId: 'INV-1003', serialNumber: 'SN-CT-772', carrier: 'UPS Freight', trackingNumber: '1Z999AA122', waybill: 'WB-1110', estimatedDelivery: '2026-03-05', actualDelivery: '2026-03-05', status: 'DELIVERED' },
  { shipDate: '2026-03-03', project: 'PRJ-2026-04', poNumber: 'PO-CUST-4120', customer: 'Stellar Mining', itemId: 'INV-1001', serialNumber: 'SN-CT-771', carrier: 'FedEx Freight', trackingNumber: '77766123', waybill: 'WB-1111', estimatedDelivery: '2026-03-06', status: 'IN_TRANSIT' },
  { shipDate: '2026-03-01', project: 'PRJ-2026-06', poNumber: 'PO-CUST-4130', customer: 'AeroFab', itemId: 'INV-1005', serialNumber: 'SN-HC-111', carrier: 'DHL', trackingNumber: 'DHL-8822', waybill: 'WB-1112', estimatedDelivery: '2026-03-03', status: 'DELAYED' },
];

export const freightQuotes: FreightQuote[] = [
  { quoteId: 'FQ-1001', date: '2026-03-01', originZip: '75001', destinationZip: '60601', miles: 925, weight: 6800, palletCount: 8, serviceType: 'LTL' },
  { quoteId: 'FQ-1002', date: '2026-03-02', originZip: '75001', destinationZip: '98101', miles: 2120, weight: 12000, palletCount: 14, serviceType: 'FTL' },
  { quoteId: 'FQ-1003', date: '2026-03-03', originZip: '30301', destinationZip: '33101', miles: 670, weight: 4300, palletCount: 5, serviceType: 'EXPEDITED' },
];

export const vendors: Vendor[] = [
  { vendorName: 'Apex Electronics', category: 'Electronics', contact: 'J. Morris', phone: '555-102-2390', email: 'jmorris@apex.example', leadTimeDays: 14, preferred: true, notes: 'Primary PCB source' },
  { vendorName: 'PowerGrid Supply', category: 'Power', contact: 'D. Young', phone: '555-203-8821', email: 'dyoung@powergrid.example', leadTimeDays: 10, preferred: true, notes: 'Dual source available' },
  { vendorName: 'WireTech', category: 'Cable & Harness', contact: 'K. Liu', phone: '555-888-1222', email: 'kliu@wiretech.example', leadTimeDays: 7, preferred: false, notes: 'MOQ on custom harnesses' },
];

export const purchaseOrders: PurchaseOrder[] = [
  { poNumber: 'PO-9101', vendor: 'Apex Electronics', itemId: 'INV-1001', project: 'PRJ-2026-04', qtyOrdered: 60, orderDate: '2026-02-15', expectedDelivery: '2026-03-01', status: 'PARTIAL' },
  { poNumber: 'PO-9108', vendor: 'WireTech', itemId: 'INV-1005', project: 'PRJ-2026-06', qtyOrdered: 40, orderDate: '2026-02-18', expectedDelivery: '2026-02-28', status: 'LATE' },
  { poNumber: 'PO-9110', vendor: 'MetalWorks Inc', itemId: 'INV-1003', project: 'PRJ-2026-05', qtyOrdered: 22, orderDate: '2026-02-25', expectedDelivery: '2026-03-10', status: 'OPEN' },
];
