'use client';

import { useEffect, useMemo, useState } from 'react';
import { currentUser, departments as seedDepartments, freightQuotes, inventoryItems, locations as seedLocations, projectBuilds, purchaseOrders, serialRecords, users, vendors } from '@/lib/data/mock-data';
import { AppUser, FreightQuote, InventoryItem, ProjectBuild, PurchaseOrder, SerialTraceRecord, Vendor } from '@/lib/types/domain';

export const STORAGE_KEYS = {
  users: 'sct.users',
  vendors: 'sct.vendors',
  inventory: 'sct.inventory',
  projects: 'sct.projects',
  freightQuotes: 'sct.freightQuotes',
  purchaseOrders: 'sct.purchaseOrders',
  serials: 'sct.serials',
  locations: 'sct.locations',
  departments: 'sct.departments',
  importHistory: 'sct.importHistory',
} as const;

export type ImportHistoryEntry = {
  id: string;
  createdAt: string;
  target: string;
  fileName: string;
  rowsImported: number;
  rowsRejected: number;
  importedBy: string;
  status: 'Completed' | 'Completed with warnings' | 'Validation blocked';
  notes?: string;
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function usePersistedCollection<T>(key: string, seed: T[]) {
  const [rows, setRows] = useState<T[]>(seed);

  useEffect(() => {
    const stored = readStorage<T[]>(key, seed);
    setRows(stored.length ? stored : seed);
  }, [key, seed]);

  useEffect(() => {
    writeStorage(key, rows);
  }, [key, rows]);

  return [rows, setRows] as const;
}

export function useUsersStore() { return usePersistedCollection<AppUser>(STORAGE_KEYS.users, users); }
export function useVendorsStore() { return usePersistedCollection<Vendor>(STORAGE_KEYS.vendors, vendors); }
export function useInventoryStore() { return usePersistedCollection<InventoryItem>(STORAGE_KEYS.inventory, inventoryItems); }
export function useProjectsStore() { return usePersistedCollection<ProjectBuild>(STORAGE_KEYS.projects, projectBuilds); }
export function useFreightQuotesStore() { return usePersistedCollection<FreightQuote>(STORAGE_KEYS.freightQuotes, freightQuotes); }
export function usePurchaseOrdersStore() { return usePersistedCollection<PurchaseOrder>(STORAGE_KEYS.purchaseOrders, purchaseOrders); }
export function useSerialsStore() { return usePersistedCollection<SerialTraceRecord>(STORAGE_KEYS.serials, serialRecords); }
export function useLocationsStore() { return usePersistedCollection<{ name: string; type: string }>(STORAGE_KEYS.locations, seedLocations); }
export function useDepartmentsStore() { return usePersistedCollection<string>(STORAGE_KEYS.departments, seedDepartments); }
export function useImportHistoryStore() { return usePersistedCollection<ImportHistoryEntry>(STORAGE_KEYS.importHistory, []); }

export function getCurrentAdminUser(usersState?: AppUser[]) {
  const pool = usersState ?? users;
  return pool.find((user) => user.id === currentUser.id) ?? currentUser;
}

export function readCollectionSnapshot<T>(key: string, seed: T[]) { return readStorage<T[]>(key, seed); }
export function appendCollectionRows<T>(key: string, seed: T[], rows: T[]) {
  const current = readCollectionSnapshot<T>(key, seed);
  const next = [...current, ...rows];
  writeStorage(key, next);
  return next;
}
export function replaceCollectionRows<T>(key: string, rows: T[]) { writeStorage(key, rows); }
export function useCurrentAdminUser() {
  const [usersState] = useUsersStore();
  return useMemo(() => getCurrentAdminUser(usersState), [usersState]);
}
