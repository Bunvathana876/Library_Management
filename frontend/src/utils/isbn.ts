export function normalizeIsbn(raw: string): string {
  return raw
    .trim()
    .replace(/^isbn(?:[-\s]?(?:10|13))?[:\s-]*/i, '')
    .replace(/[\s-]+/g, '')
    .toUpperCase();
}

export function isValidIsbn10(normalized: string): boolean {
  if (!/^[0-9]{9}[0-9X]$/.test(normalized)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const ch = normalized[i];
    const digit = ch === 'X' ? 10 : Number(ch);
    sum += (10 - i) * digit;
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(normalized: string): boolean {
  if (!/^(978|979)[0-9]{10}$/.test(normalized)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 13; i += 1) {
    const digit = Number(normalized[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return sum % 10 === 0;
}

export function isValidIsbn(raw: string): boolean {
  const normalized = normalizeIsbn(raw);
  return isValidIsbn10(normalized) || isValidIsbn13(normalized);
}

export interface AutoLookupCandidate {
  normalized: string;
  delayMs: number;
}

export function getAutoLookupCandidate(raw: string): AutoLookupCandidate | null {
  const normalized = normalizeIsbn(raw);
  if (isValidIsbn13(normalized)) {
    return { normalized, delayMs: 250 };
  }
  if (isValidIsbn10(normalized)) {
    const startsWithIsbn13Prefix = normalized.startsWith('978') || normalized.startsWith('979');
    return {
      normalized,
      delayMs: startsWithIsbn13Prefix ? 750 : 350,
    };
  }
  return null;
}

export function extractIsbnFromBarcode(rawValue: string): string | null {
  const normalized = normalizeIsbn(rawValue);
  if (isValidIsbn13(normalized) || isValidIsbn10(normalized)) {
    return normalized;
  }
  const match = rawValue.match(/(97[89][\d-\s]{10,16}|\d{9}[\dX])/i);
  if (match) {
    const candidate = normalizeIsbn(match[1]);
    if (isValidIsbn13(candidate) || isValidIsbn10(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function isSafeCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || /[\s\u0000-\u001f]/.test(trimmed)) return null;
  if (trimmed.startsWith('/')) {
    return trimmed.startsWith('//') ? null : trimmed;
  }
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
      return trimmed;
    } catch {
      return null;
    }
  }
  return null;
}
