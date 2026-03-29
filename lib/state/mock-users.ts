'use client';

import { AppUser, UserRole } from '@/lib/types/domain';
import { currentUser as seededCurrentUser, users as seededUsers } from '@/lib/data/mock-data';

export type EditableUser = AppUser & {
  department: string;
  password: string;
};

const USERS_KEY = 'sct_users_v1';
const CURRENT_USER_KEY = 'sct_current_user_id_v1';
const LOGGED_IN_KEY = 'sct_logged_in_v1';

const deptByRole: Record<UserRole, string> = {
  'System Admin': 'IT / Platform',
  'Operations Manager': 'Operations',
  Warehouse: 'Warehouse',
  Purchasing: 'Supply Chain',
  Viewer: 'Executive',
};

function normalizeSeedUsers(): EditableUser[] {
  const baseUsers = seededUsers.map((u) => ({
    ...u,
    department: deptByRole[u.role] ?? 'Operations',
    password: 'Password123',
  }));

  const adminEmail = 'Abritton05@gmail.com';
  const existingAdminIndex = baseUsers.findIndex((u) => u.email.toLowerCase() === adminEmail.toLowerCase());

  const anthonyAdmin: EditableUser = {
    id: existingAdminIndex >= 0 ? baseUsers[existingAdminIndex].id : 'u-admin-anthony',
    name: 'Anthony Britton',
    email: adminEmail,
    role: 'System Admin',
    active: true,
    department: 'Logistics',
    password: 'Password123',
  };

  if (existingAdminIndex >= 0) {
    baseUsers[existingAdminIndex] = anthonyAdmin;
    return baseUsers;
  }

  return [anthonyAdmin, ...baseUsers];
}

function getSeedCurrentUserId() {
  const admin = normalizeSeedUsers().find((u) => u.email.toLowerCase() === 'abritton05@gmail.com');
  return admin?.id ?? seededCurrentUser.id;
}

export function roleToDepartment(role: UserRole) {
  return deptByRole[role] ?? 'Operations';
}

export function getUsers(): EditableUser[] {
  if (typeof window === 'undefined') return normalizeSeedUsers();

  const raw = window.localStorage.getItem(USERS_KEY);
  if (!raw) {
    const seed = normalizeSeedUsers();
    window.localStorage.setItem(USERS_KEY, JSON.stringify(seed));
    return seed;
  }

  try {
    return JSON.parse(raw) as EditableUser[];
  } catch {
    const seed = normalizeSeedUsers();
    window.localStorage.setItem(USERS_KEY, JSON.stringify(seed));
    return seed;
  }
}

export function saveUsers(users: EditableUser[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getCurrentUserId() {
  if (typeof window === 'undefined') return getSeedCurrentUserId();

  const raw = window.localStorage.getItem(CURRENT_USER_KEY);
  if (!raw) {
    const seedId = getSeedCurrentUserId();
    window.localStorage.setItem(CURRENT_USER_KEY, seedId);
    return seedId;
  }

  return raw;
}

export function setCurrentUserId(userId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CURRENT_USER_KEY, userId);
}

export function isLoggedIn() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(LOGGED_IN_KEY) === 'true';
}

export function loginUser(email: string, password: string) {
  const rows = getUsers();
  const found = rows.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password && u.active,
  );

  if (!found) return null;

  setCurrentUserId(found.id);
  window.localStorage.setItem(LOGGED_IN_KEY, 'true');
  return found;
}

export function logoutUser() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LOGGED_IN_KEY);
}

export function getCurrentUserRecord(): EditableUser {
  const rows = getUsers();
  const currentId = getCurrentUserId();
  return rows.find((u) => u.id === currentId) ?? rows[0];
}

export function addUserRecord(user: EditableUser) {
  const rows = getUsers();
  const next = [user, ...rows];
  saveUsers(next);
  return next;
}

export function updateUserRecord(userId: string, patch: Partial<EditableUser>) {
  const rows = getUsers();
  const next = rows.map((u) => (u.id === userId ? { ...u, ...patch } : u));
  saveUsers(next);
  return next;
}

export function deleteUserRecord(userId: string) {
  const rows = getUsers();
  const next = rows.filter((u) => u.id !== userId);
  saveUsers(next);

  const currentId = getCurrentUserId();
  if (currentId === userId && next.length > 0) {
    setCurrentUserId(next[0].id);
  }

  return next;
}

export function createBlankUser(): EditableUser {
  return {
    id: `u-${Date.now()}`,
    name: '',
    email: '',
    role: 'Viewer',
    active: true,
    department: 'Operations',
    password: 'Password123',
  };
}