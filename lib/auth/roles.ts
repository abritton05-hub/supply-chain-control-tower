export type AppRole = 'tech' | 'warehouse' | 'admin';

export const ROLE_LABELS: Record<AppRole, string> = {
  tech: 'Tech',
  warehouse: 'Warehouse',
  admin: 'Admin',
};

export function isAdminEmail(email: string | null | undefined) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const currentEmail = email?.trim().toLowerCase();

  if (!adminEmail || !currentEmail) {
    return false;
  }

  return adminEmail === currentEmail;
}

export function isAdmin(role: AppRole | null | undefined) {
  return role === 'admin';
}

export function canManageUsers(role: AppRole | null | undefined) {
  return role === 'admin';
}

export function canViewInventory(role: AppRole | null | undefined) {
  return role === 'tech' || role === 'warehouse' || role === 'admin';
}

export function canSubmitPullRequests(role: AppRole | null | undefined) {
  return role === 'tech' || role === 'warehouse' || role === 'admin';
}

export function canSubmitPullRequest(role: AppRole | null | undefined) {
  return canSubmitPullRequests(role);
}

export function canUseWarehouse(role: AppRole | null | undefined) {
  return role === 'warehouse' || role === 'admin';
}

export function canReceiveInventory(role: AppRole | null | undefined) {
  return role === 'warehouse' || role === 'admin';
}

export function canViewTransactions(role: AppRole | null | undefined) {
  return role === 'warehouse' || role === 'admin';
}

export function canEditInventory(role: AppRole | null | undefined) {
  return role === 'warehouse' || role === 'admin';
}