import type { UserRole } from '@/types/api';

export function hasRole(roles: readonly UserRole[] | undefined, role: UserRole): boolean {
  return Array.isArray(roles) && roles.includes(role);
}

export function isAdmin(roles: readonly UserRole[] | undefined): boolean {
  return hasRole(roles, 'ADMIN');
}

export function isStaff(roles: readonly UserRole[] | undefined): boolean {
  return hasRole(roles, 'ADMIN') || hasRole(roles, 'LIBRARIAN');
}

export function isMemberOnly(roles: readonly UserRole[] | undefined): boolean {
  return hasRole(roles, 'MEMBER') && !isStaff(roles);
}

export function getPrimaryRole(roles: readonly UserRole[] | undefined): UserRole | 'GUEST' {
  if (hasRole(roles, 'ADMIN')) return 'ADMIN';
  if (hasRole(roles, 'LIBRARIAN')) return 'LIBRARIAN';
  if (hasRole(roles, 'MEMBER')) return 'MEMBER';
  return 'GUEST';
}

export function formatRoleLabel(role: UserRole | 'GUEST'): string {
  switch (role) {
    case 'ADMIN':
      return 'Administrator';
    case 'LIBRARIAN':
      return 'Librarian';
    case 'MEMBER':
      return 'Member';
    case 'GUEST':
      return 'Guest Viewer';
  }
}
