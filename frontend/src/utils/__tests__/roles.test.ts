import { describe, expect, it } from 'vitest';
import { formatRoleLabel, getPrimaryRole, hasRole, isAdmin, isStaff } from '@/utils/roles';

describe('roles utilities', () => {
  it('evaluates ADMIN, LIBRARIAN, and MEMBER capabilities accurately', () => {
    expect(isAdmin(['ADMIN'])).toBe(true);
    expect(isStaff(['ADMIN'])).toBe(true);
    expect(isAdmin(['LIBRARIAN'])).toBe(false);
    expect(isStaff(['LIBRARIAN'])).toBe(true);
    expect(isStaff(['MEMBER'])).toBe(false);
    expect(hasRole(['MEMBER'], 'MEMBER')).toBe(true);
  });

  it('resolves primary role and human-readable label', () => {
    expect(getPrimaryRole(['ADMIN'])).toBe('ADMIN');
    expect(getPrimaryRole(['LIBRARIAN'])).toBe('LIBRARIAN');
    expect(getPrimaryRole(['MEMBER'])).toBe('MEMBER');
    expect(getPrimaryRole(undefined)).toBe('GUEST');
    expect(formatRoleLabel('ADMIN')).toBe('Administrator');
    expect(formatRoleLabel('GUEST')).toBe('Guest Viewer');
  });
});
