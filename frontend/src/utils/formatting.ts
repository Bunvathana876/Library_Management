export function formatCallNumber(bookId: number): string {
  return `CAT-${String(Math.max(0, bookId)).padStart(4, '0')}`;
}

export function formatMemberCardCode(memberId: number): string {
  return `MEM-${String(Math.max(0, memberId)).padStart(4, '0')}`;
}

export function formatLoanCode(loanId: number): string {
  return `LOAN-${String(Math.max(0, loanId)).padStart(4, '0')}`;
}

export function formatCurrency(amount: number | null | undefined): string {
  const num = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return `$${num.toFixed(2)}`;
}

export function getInitials(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Empty' | 'Too short' | 'Fair' | 'Strong' | 'Very strong';
  tone: 'neutral' | 'danger' | 'warning' | 'success';
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  if (password.length === 0) {
    return { score: 0, label: 'Empty', tone: 'neutral' };
  }
  if (password.length < 12) {
    return { score: 1, label: 'Too short', tone: 'danger' };
  }

  let classes = 0;
  if (/[a-z]/.test(password)) classes += 1;
  if (/[A-Z]/.test(password)) classes += 1;
  if (/\d/.test(password)) classes += 1;
  if (/[^\w\s]|_/.test(password)) classes += 1;

  if (password.length >= 16 && classes >= 3) {
    return { score: 4, label: 'Very strong', tone: 'success' };
  }
  if (classes >= 3 || password.length >= 14) {
    return { score: 3, label: 'Strong', tone: 'success' };
  }
  return { score: 2, label: 'Fair', tone: 'warning' };
}
