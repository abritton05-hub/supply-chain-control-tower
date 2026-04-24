import { AppUser, UserRole } from '@/lib/types/domain';
import { getCurrentUserRecord, getUsers } from '@/lib/state/mock-users';

function stripUser(user: ReturnType<typeof getCurrentUserRecord>): AppUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
  };
}

export function getCurrentUser(): AppUser {
  return stripUser(getCurrentUserRecord());
}

export function listUsers(): AppUser[] {
  return getUsers().map(stripUser);
}

export function hasRole(user: AppUser, roles: UserRole[]) {
  return roles.includes(user.role);
}

export function canOverrideRestrictedActions(user: AppUser) {
  return user.role === 'System Admin';
}

export function canDeleteHard(user: AppUser) {
  return user.role === 'System Admin';
}

export function canArchive(user: AppUser) {
  return user.role !== 'Viewer';
}