import { describe, expect, it } from 'vitest';
import {
  evaluatePasswordStrength,
  formatCallNumber,
  getInitials,
} from '@/utils/formatting';

describe('formatting utilities', () => {
  it('formats zero-padded catalog call numbers', () => {
    expect(formatCallNumber(1)).toBe('CAT-0001');
    expect(formatCallNumber(42)).toBe('CAT-0042');
    expect(formatCallNumber(12345)).toBe('CAT-12345');
  });

  it('extracts member initials accurately', () => {
    expect(getInitials('Dara Sok')).toBe('DS');
    expect(getInitials('Craig')).toBe('CR');
    expect(getInitials('  ')).toBe('?');
  });

  it('evaluates admin password length and complexity cleanly', () => {
    expect(evaluatePasswordStrength('')).toEqual({
      score: 0,
      label: 'Empty',
      tone: 'neutral',
    });
    expect(evaluatePasswordStrength('short123')).toEqual({
      score: 1,
      label: 'Too short',
      tone: 'danger',
    });
    expect(evaluatePasswordStrength('lowercaseonly12')).toEqual({
      score: 3,
      label: 'Strong',
      tone: 'success',
    });
    expect(evaluatePasswordStrength('V3ryStr0ng!Pass#2026')).toEqual({
      score: 4,
      label: 'Very strong',
      tone: 'success',
    });
  });
});
