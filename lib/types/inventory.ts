export type TrackingType = 'SERIALIZED' | 'LOT' | 'QUANTITY';
export type CriticalityLevel = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export type InventoryOverviewRow = {
  id: string;
  organization_id: string;
  item_id: string;
  item_name: string;
  description: string;
  tracking_type: TrackingType;
  inventory_type: string;
  criticality: CriticalityLevel;
  preferred_vendor: string;
  department: string;
  average_daily_usage: number;
  lead_time_days: number;
  safety_stock: number;
  current_inventory: number;
};

export type AddInventoryInput = {
  organizationId: string;
  itemId: string;
  itemName: string;
  description: string;
  trackingType: TrackingType;
  inventoryType: string;
  criticality: CriticalityLevel;
  preferredVendorId: string | null;
  departmentId: string | null;
  averageDailyUsage: number;
  leadTimeDays: number;
  safetyStock: number;
  openingQuantity: number;
  locationId: string;
  notes?: string;
  performedByUserId?: string | null;
};