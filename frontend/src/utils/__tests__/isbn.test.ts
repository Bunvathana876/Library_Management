import { describe, expect, it } from 'vitest';
import {
  extractIsbnFromBarcode,
  getAutoLookupCandidate,
  isSafeCoverUrl,
  isValidIsbn,
  isValidIsbn10,
  isValidIsbn13,
  normalizeIsbn,
} from '@/utils/isbn';

describe('isbn utilities', () => {
  it('normalizes prefixes, spaces, hyphens, and lowercase X', () => {
    expect(normalizeIsbn('ISBN-13: 978-0-13-235088-4')).toBe('9780132350884');
    expect(normalizeIsbn('isbn 0-8044-2957-x')).toBe('080442957X');
    expect(normalizeIsbn('   ')).toBe('');
  });

  it('validates ISBN-10 and ISBN-13 checksums accurately', () => {
    expect(isValidIsbn13('9780132350884')).toBe(true);
    expect(isValidIsbn13('9780132350885')).toBe(false);
    expect(isValidIsbn10('0134685997')).toBe(true);
    expect(isValidIsbn10('080442957X')).toBe(true);
    expect(isValidIsbn10('0134685998')).toBe(false);
    expect(isValidIsbn('978-1-4493-7332-0')).toBe(true);
    expect(isValidIsbn('1234567890')).toBe(false);
  });

  it('computes auto-lookup candidate timings without premature 978-prefix triggers', () => {
    expect(getAutoLookupCandidate('9780132350884')).toEqual({
      normalized: '9780132350884',
      delayMs: 250,
    });
    expect(getAutoLookupCandidate('0134685997')).toEqual({
      normalized: '0134685997',
      delayMs: 350,
    });
    expect(getAutoLookupCandidate('9780136002')).toEqual({
      normalized: '9780136002',
      delayMs: 750,
    });
    expect(getAutoLookupCandidate('978013235')).toBeNull();
  });

  it('extracts valid ISBN from barcode strings', () => {
    expect(extractIsbnFromBarcode('9780132350884')).toBe('9780132350884');
    expect(extractIsbnFromBarcode('ISBN 978-1-4493-7332-0')).toBe('9781449373320');
    expect(extractIsbnFromBarcode('invalid-barcode')).toBeNull();
  });

  it('allows only safe http(s) or relative cover URLs', () => {
    expect(isSafeCoverUrl('https://covers.openlibrary.org/b/id/15126503-L.jpg')).toBe(
      'https://covers.openlibrary.org/b/id/15126503-L.jpg',
    );
    expect(isSafeCoverUrl('/images/catalog/cover-green-forest.webp')).toBe(
      '/images/catalog/cover-green-forest.webp',
    );
    expect(isSafeCoverUrl('javascript:alert(1)')).toBeNull();
    expect(isSafeCoverUrl('//evil.example.com/a.jpg')).toBeNull();
    expect(isSafeCoverUrl('data:image/png;base64,aaa')).toBeNull();
  });
});
