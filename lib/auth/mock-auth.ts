import { currentUser, users } from '@/lib/data/mock-data';
import { AppUser, UserRole } from '@/lib/types/domain';

export function getCurrentUser(): AppUser {
  return currentUser;
}

export function listUsers(): AppUser[] {
  return users;
}

export function hasRole(user: AppUser, roles: UserRole[]) {
  return roles.includes(user.role);
}

export function canOverrideRestrictedActions(user: AppUser) {
  return user.role === 'System Admin';
}

export function canDeleteHard(user: AppUser) {
  return user.role === 'System Admin' && user.id !== currentUser.id;
}

export function canArchive(user: AppUser) {
  return user.role !== 'Viewer';
}

export function validateCredentials(login: string, password: string) {
  return users.find((user) => user.login === login && user.password === password) ?? null;
}

export function getAdminCredentials() {
  return { login: currentUser.login, password: currentUser.password };
}
