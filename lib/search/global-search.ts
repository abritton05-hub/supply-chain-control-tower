import { freightQuotes, inventoryItems, projectBuilds, purchaseOrders, serialRecords, shipmentLog, vendors } from '@/lib/data/mock-data';

export type SearchGroup = 'Items' | 'Serials' | 'Projects' | 'Purchase Orders' | 'Vendors' | 'Shipments' | 'Freight Quotes' | 'Pages';

export interface SearchResult {
  id: string;
  group: SearchGroup;
  typeLabel: string;
  primary: string;
  secondary?: string;
  route: string;
  haystack: string[];
}

const pages = [
  ['Executive Dashboard', '/executive-dashboard'],
  ['Control Tower', '/control-tower'],
  ['Inventory Risk', '/inventory-risk'],
  ['Freight Dashboard', '/freight-dashboard'],
  ['Project Dashboard', '/project-dashboard'],
  ['Traceability Dashboard', '/traceability-dashboard'],
  ['Inventory Database', '/inventory'],
  ['Inventory Transactions', '/transactions'],
  ['Serial Traceability', '/serial-traceability'],
  ['Projects / Builds', '/projects-builds'],
  ['Shipment Log', '/shipment-log'],
  ['Freight Quotes', '/freight-quotes'],
  ['Vendors', '/vendors'],
  ['Open POs', '/open-pos'],
  ['Locations', '/locations'],
  ['Departments', '/departments'],
] as const;

export const globalSearchIndex: SearchResult[] = [
  ...inventoryItems.map((item) => ({
    id: `item-${item.itemId}`,
    group: 'Items' as const,
    typeLabel: 'Item',
    primary: item.itemId,
    secondary: item.itemName,
    route: `/inventory/${item.itemId}`,
    haystack: [item.itemId, item.itemName, item.description, item.preferredVendor, item.department],
  })),
  ...serialRecords.map((serial) => ({
    id: `serial-${serial.serialNumber}`,
    group: 'Serials' as const,
    typeLabel: 'Serial',
    primary: serial.serialNumber,
    secondary: `${serial.itemId} · ${serial.currentLocation}`,
    route: `/serial-traceability/${serial.serialNumber}`,
    haystack: [serial.serialNumber, serial.itemId, serial.project, serial.customer, serial.currentLocation],
  })),
  ...projectBuilds.map((project) => ({
    id: `project-${project.projectId}`,
    group: 'Projects' as const,
    typeLabel: 'Project',
    primary: project.projectId,
    secondary: `${project.customer} · ${project.workOrder}`,
    route: `/projects/${project.projectId}`,
    haystack: [project.projectId, project.customer, project.poNumber, project.workOrder, project.itemId],
  })),
  ...purchaseOrders.map((po) => ({
    id: `po-${po.poNumber}`,
    group: 'Purchase Orders' as const,
    typeLabel: 'PO',
    primary: po.poNumber,
    secondary: `${po.vendor} · ${po.status}`,
    route: `/open-pos/${po.poNumber}`,
    haystack: [po.poNumber, po.vendor, po.itemId, po.project, po.status],
  })),
  ...vendors.map((vendor) => ({
    id: `vendor-${vendor.id}`,
    group: 'Vendors' as const,
    typeLabel: 'Vendor',
    primary: vendor.vendorName,
    secondary: vendor.category,
    route: `/vendors/${vendor.id}`,
    haystack: [vendor.vendorName, vendor.category, vendor.contact, vendor.email],
  })),
  ...shipmentLog.map((ship) => ({
    id: `shipment-${ship.id}`,
    group: 'Shipments' as const,
    typeLabel: 'Shipment',
    primary: ship.id,
    secondary: `${ship.customer} · ${ship.status}`,
    route: `/shipment-log/${ship.id}`,
    haystack: [ship.id, ship.project, ship.poNumber, ship.customer, ship.trackingNumber, ship.status],
  })),
  ...freightQuotes.map((quote) => ({
    id: `freight-${quote.quoteId}`,
    group: 'Freight Quotes' as const,
    typeLabel: 'Freight',
    primary: quote.quoteId,
    secondary: `${quote.originZip} → ${quote.destinationZip}`,
    route: `/freight-quotes/${quote.quoteId}`,
    haystack: [quote.quoteId, quote.originZip, quote.destinationZip, quote.serviceType],
  })),
  ...pages.map(([name, route]) => ({
    id: `page-${route}`,
    group: 'Pages' as const,
    typeLabel: 'Page',
    primary: name,
    secondary: route,
    route,
    haystack: [name, route],
  })),
];

function scoreField(field: string, query: string) {
  const value = field.toLowerCase();
  if (value === query) return 1000;
  if (value.startsWith(query)) return 700;
  if (value.includes(query)) return 450;
  return 0;
}

export function searchGlobal(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return globalSearchIndex
    .map((row) => {
      const primaryScore = scoreField(row.primary, q);
      const secondaryScore = row.secondary ? scoreField(row.secondary, q) : 0;
      const haystackScore = Math.max(...row.haystack.map((h) => scoreField(h, q)));
      const score = Math.max(primaryScore, secondaryScore, haystackScore);
      return { row, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.row.primary.localeCompare(b.row.primary))
    .map((entry) => entry.row);
}

export function groupSearchResults(results: SearchResult[]) {
  const order: SearchGroup[] = ['Items', 'Serials', 'Projects', 'Purchase Orders', 'Vendors', 'Shipments', 'Freight Quotes', 'Pages'];
  return order
    .map((group) => ({ group, rows: results.filter((row) => row.group === group) }))
    .filter((section) => section.rows.length > 0);
}
