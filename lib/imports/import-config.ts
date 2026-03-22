import { currentUser, departments, freightQuotes, inventoryItems, locations, projectBuilds, purchaseOrders, serialRecords, users, vendors } from '@/lib/data/mock-data';
import { STORAGE_KEYS, appendCollectionRows, readCollectionSnapshot } from '@/lib/state/mock-client-db';
import { AppUser, FreightQuote, InventoryItem, ProjectBuild, PurchaseOrder, SerialTraceRecord, Vendor } from '@/lib/types/domain';

export type ImportTarget = 'Vendors' | 'Inventory Items' | 'Projects' | 'Customers' | 'Locations' | 'Departments' | 'Users' | 'Freight Quotes' | 'Purchase Orders' | 'Serial Numbers';
export type ParsedRow = Record<string, string>;

export const importTargets: { value: ImportTarget; fields: string[]; required: string[] }[] = [
  { value: 'Vendors', fields: ['vendorName', 'category', 'contact', 'email', 'phone', 'leadTimeDays', 'paymentTerms', 'orderingMethod', 'creditCardAccepted', 'poRequired', 'notes'], required: ['vendorName'] },
  { value: 'Inventory Items', fields: ['itemId', 'itemName', 'description', 'trackingType', 'inventoryType', 'currentInventory', 'safetyStock', 'averageDailyUsage', 'leadTimeDays', 'preferredVendor', 'department', 'standardCost', 'orderMethod', 'creditCardAllowed', 'poRequired', 'expirationDate'], required: ['itemId', 'itemName'] },
  { value: 'Projects', fields: ['projectId', 'customer', 'poNumber', 'workOrder', 'buildStatus', 'shipStatus'], required: ['projectId', 'customer'] },
  { value: 'Customers', fields: ['customerId', 'customerName', 'contact', 'email', 'phone', 'notes'], required: ['customerName'] },
  { value: 'Locations', fields: ['name', 'type'], required: ['name'] },
  { value: 'Departments', fields: ['name'], required: ['name'] },
  { value: 'Users', fields: ['name', 'email', 'role', 'department', 'status', 'accessLevel', 'canView', 'canEditRecords', 'canDeleteArchive', 'canManageUsers', 'canApproveChanges', 'canViewFinancialFreight', 'canAccessSettings'], required: ['name', 'email', 'role'] },
  { value: 'Freight Quotes', fields: ['quoteId', 'date', 'originZip', 'destinationZip', 'miles', 'weight', 'palletCount', 'serviceType'], required: ['quoteId'] },
  { value: 'Purchase Orders', fields: ['poNumber', 'vendor', 'itemId', 'project', 'qtyOrdered', 'orderDate', 'expectedDelivery', 'status'], required: ['poNumber', 'vendor'] },
  { value: 'Serial Numbers', fields: ['serialNumber', 'itemId', 'poNumber', 'dateReceived', 'currentLocation', 'status', 'project', 'shipmentId', 'customer'], required: ['serialNumber', 'itemId'] },
];

export function parseDelimitedText(input: string) {
  const rows = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!rows.length) return { headers: [], rows: [] as ParsedRow[] };
  const delimiter = rows[0].includes('\t') ? '\t' : ',';
  const headers = rows[0].split(delimiter).map((cell) => cell.trim());
  const body = rows.slice(1).map((line) => {
    const cells = line.split(delimiter).map((cell) => cell.trim());
    return headers.reduce<ParsedRow>((acc, header, index) => { acc[header] = cells[index] ?? ''; return acc; }, {});
  });
  return { headers, rows: body };
}

function yn(value: string) { return ['yes', 'true', '1', 'active', 'enabled'].includes(value.toLowerCase()); }
function targetMeta(target: ImportTarget) { return importTargets.find((entry) => entry.value === target)!; }

export function validateMappedRows(target: ImportTarget, mappedRows: ParsedRow[]) {
  const meta = targetMeta(target);
  const errors: string[] = [];
  const warnings: string[] = [];
  const keys = new Set<string>();
  const existing = new Set(existingKeysForTarget(target));

  mappedRows.forEach((row, index) => {
    meta.required.forEach((field) => { if (!row[field]) errors.push(`Row ${index + 1}: missing required field ${field}.`); });
    const uniqueField = target === 'Users' ? 'email' : target === 'Vendors' ? 'vendorName' : target === 'Inventory Items' ? 'itemId' : target === 'Projects' ? 'projectId' : target === 'Freight Quotes' ? 'quoteId' : target === 'Purchase Orders' ? 'poNumber' : target === 'Serial Numbers' ? 'serialNumber' : 'name';
    const uniqueValue = row[uniqueField];
    if (uniqueValue) {
      const dedupeKey = `${uniqueField}:${uniqueValue}`.toLowerCase();
      if (keys.has(dedupeKey)) warnings.push(`Row ${index + 1}: duplicate ${uniqueField} detected in this import.`);
      if (existing.has(uniqueValue.toLowerCase())) warnings.push(`Row ${index + 1}: ${uniqueField} already exists in local mock data.`);
      keys.add(dedupeKey);
    }
  });
  return { errors, warnings };
}

export function mapRows(rows: ParsedRow[], fieldMap: Record<string, string>) {
  return rows.map((row) => Object.entries(row).reduce<ParsedRow>((acc, [incoming, value]) => {
    const mapped = fieldMap[incoming];
    if (mapped && mapped !== '__ignore__') acc[mapped] = value;
    return acc;
  }, {}));
}

export function commitImport(target: ImportTarget, mappedRows: ParsedRow[]) {
  switch (target) {
    case 'Users': {
      const typed: AppUser[] = mappedRows.map((row, index) => ({ id: `u-import-${Date.now()}-${index}`, name: row.name, email: row.email, role: (row.role as AppUser['role']) || 'Viewer', active: (row.status ?? 'Active') !== 'Disabled', department: row.department || 'Operations', accessLevel: row.accessLevel || 'Standard', permissions: { canView: row.canView ? yn(row.canView) : true, canEditRecords: yn(row.canEditRecords ?? 'false'), canDeleteArchive: yn(row.canDeleteArchive ?? 'false'), canManageUsers: yn(row.canManageUsers ?? 'false'), canApproveChanges: yn(row.canApproveChanges ?? 'false'), canViewFinancialFreight: yn(row.canViewFinancialFreight ?? 'false'), canAccessSettings: yn(row.canAccessSettings ?? 'false') }, lastLogin: undefined, lastLogout: undefined }));
      appendCollectionRows(STORAGE_KEYS.users, users, typed); return typed.length;
    }
    case 'Vendors': { const typed: Vendor[] = mappedRows.map((row, index) => ({ id: `v-import-${Date.now()}-${index}`, vendorName: row.vendorName, category: row.category || 'Imported', contact: row.contact || '-', phone: row.phone || '-', email: row.email || '-', leadTimeDays: Number(row.leadTimeDays || 0), preferred: false, paymentTerms: row.paymentTerms || 'Net 30', orderingMethod: row.orderingMethod || 'PO + Email', creditCardAccepted: yn(row.creditCardAccepted ?? 'true'), poRequired: yn(row.poRequired ?? 'true'), notes: row.notes || 'Imported via Imports utility' })); appendCollectionRows(STORAGE_KEYS.vendors, vendors, typed); return typed.length; }
    case 'Inventory Items': { const typed: InventoryItem[] = mappedRows.map((row, index) => ({ id: `i-import-${Date.now()}-${index}`, itemId: row.itemId, itemName: row.itemName, description: row.description || '', trackingType: (row.trackingType as InventoryItem['trackingType']) || 'QUANTITY', serialRequired: (row.trackingType || '').toUpperCase() === 'SERIALIZED', autoGenerateSerials: (row.trackingType || '').toUpperCase() === 'SERIALIZED', nextSerialNumber: 1, inventoryType: (row.inventoryType as InventoryItem['inventoryType']) || 'RAW', currentInventory: Number(row.currentInventory || 0), averageDailyUsage: Number(row.averageDailyUsage || 0), leadTimeDays: Number(row.leadTimeDays || 0), safetyStock: Number(row.safetyStock || 0), preferredVendor: row.preferredVendor || '-', department: (row.department as InventoryItem['department']) || 'Assembly', criticality: 'NORMAL' })); appendCollectionRows(STORAGE_KEYS.inventory, inventoryItems, typed); return typed.length; }
    case 'Projects': { const typed: ProjectBuild[] = mappedRows.map((row, index) => ({ id: `p-import-${Date.now()}-${index}`, projectId: row.projectId, customer: row.customer, poNumber: row.poNumber || '-', workOrder: row.workOrder || '-', itemId: 'INV-1001', requiredQty: 0, issuedQty: 0, buildStatus: (row.buildStatus as ProjectBuild['buildStatus']) || 'NOT_STARTED', shipStatus: (row.shipStatus as ProjectBuild['shipStatus']) || 'NOT_READY' })); appendCollectionRows(STORAGE_KEYS.projects, projectBuilds, typed); return typed.length; }
    case 'Locations': { const typed = mappedRows.map((row) => ({ name: row.name, type: row.type || 'Imported' })); appendCollectionRows(STORAGE_KEYS.locations, locations, typed); return typed.length; }
    case 'Departments': { const typed = mappedRows.map((row) => row.name).filter(Boolean); appendCollectionRows(STORAGE_KEYS.departments, departments, typed); return typed.length; }
    case 'Freight Quotes': { const typed: FreightQuote[] = mappedRows.map((row, index) => ({ id: `fq-import-${Date.now()}-${index}`, quoteId: row.quoteId, date: row.date || new Date().toISOString().slice(0, 10), originZip: row.originZip || '', destinationZip: row.destinationZip || '', miles: Number(row.miles || 0), weight: Number(row.weight || 0), palletCount: Number(row.palletCount || 0), serviceType: (row.serviceType as FreightQuote['serviceType']) || 'LTL' })); appendCollectionRows(STORAGE_KEYS.freightQuotes, freightQuotes, typed); return typed.length; }
    case 'Purchase Orders': { const typed: PurchaseOrder[] = mappedRows.map((row, index) => ({ id: `po-import-${Date.now()}-${index}`, poNumber: row.poNumber, vendor: row.vendor, itemId: row.itemId || 'INV-1001', project: row.project || 'PRJ-IMPORT', qtyOrdered: Number(row.qtyOrdered || 0), orderDate: row.orderDate, expectedDelivery: row.expectedDelivery, status: (row.status as PurchaseOrder['status']) || 'OPEN' })); appendCollectionRows(STORAGE_KEYS.purchaseOrders, purchaseOrders, typed); return typed.length; }
    case 'Serial Numbers': { const typed: SerialTraceRecord[] = mappedRows.map((row, index) => ({ id: `sn-import-${Date.now()}-${index}`, serialNumber: row.serialNumber, itemId: row.itemId, description: 'Imported serial record', poNumber: row.poNumber || '-', project: row.project || 'PRJ-IMPORT', vendor: 'Imported', dateReceived: row.dateReceived || new Date().toISOString().slice(0, 10), currentLocation: row.currentLocation || 'Receiving', workOrder: '-', shipmentId: row.shipmentId || undefined, buildStatus: 'IMPORTED', customer: row.customer || 'Imported Customer', status: (row.status as SerialTraceRecord['status']) || 'In Stock', notes: 'Imported from ERP import utility' })); appendCollectionRows(STORAGE_KEYS.serials, serialRecords, typed); return typed.length; }
    case 'Customers': appendCollectionRows('sct.customers', [], mappedRows); return mappedRows.length;
  }
}

export function existingKeysForTarget(target: ImportTarget) {
  switch (target) {
    case 'Users': return readCollectionSnapshot(STORAGE_KEYS.users, users).map((row) => row.email.toLowerCase());
    case 'Vendors': return readCollectionSnapshot(STORAGE_KEYS.vendors, vendors).map((row) => row.vendorName.toLowerCase());
    case 'Inventory Items': return readCollectionSnapshot(STORAGE_KEYS.inventory, inventoryItems).map((row) => row.itemId.toLowerCase());
    case 'Projects': return readCollectionSnapshot(STORAGE_KEYS.projects, projectBuilds).map((row) => row.projectId.toLowerCase());
    case 'Freight Quotes': return readCollectionSnapshot(STORAGE_KEYS.freightQuotes, freightQuotes).map((row) => row.quoteId.toLowerCase());
    case 'Purchase Orders': return readCollectionSnapshot(STORAGE_KEYS.purchaseOrders, purchaseOrders).map((row) => row.poNumber.toLowerCase());
    case 'Serial Numbers': return readCollectionSnapshot(STORAGE_KEYS.serials, serialRecords).map((row) => row.serialNumber.toLowerCase());
    case 'Locations': return readCollectionSnapshot(STORAGE_KEYS.locations, locations).map((row) => row.name.toLowerCase());
    case 'Departments': return readCollectionSnapshot(STORAGE_KEYS.departments, departments).map((row) => row.toLowerCase());
    case 'Customers': return [];
  }
}

export const importActorName = currentUser.name;
