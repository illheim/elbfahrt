/**
 * Modulo-10 check-digit validation for German Personalausweis and
 * Führerschein numbers — kept in sync with backend/src/utils/modulo10.ts.
 * If you change one, change the other.
 *
 * See the backend file for full algorithm notes.
 */

export type IdType = 'personalausweis' | 'fuehrerschein';

const WEIGHTS = [7, 3, 1] as const;

function charValue(ch: string): number | null {
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 65 && code <= 90) return code - 65 + 10;
  return null;
}

export function normaliseIdNumber(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidFormat(idType: IdType, raw: string): boolean {
  const s = normaliseIdNumber(raw);
  const expectedLength = idType === 'personalausweis' ? 10 : 11;
  if (s.length !== expectedLength) return false;
  if (!/^[0-9]$/.test(s[s.length - 1])) return false;
  return /^[A-Z0-9]+$/.test(s);
}

function checksumPasses(s: string): boolean {
  if (s.length < 2) return false;
  const body = s.slice(0, -1);
  const expectedCheck = parseInt(s[s.length - 1], 10);
  if (Number.isNaN(expectedCheck)) return false;

  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const v = charValue(body[i]);
    if (v === null) return false;
    sum += v * WEIGHTS[i % WEIGHTS.length];
  }
  return sum % 10 === expectedCheck;
}

export function isValidIdNumber(idType: IdType, raw: string): boolean {
  if (!isValidFormat(idType, raw)) return false;
  // Personalausweis carries the 7-3-1 mod-10 check digit; the Führerschein
  // number does NOT (7-3-1 rejects real licences like M24001K8B32), so it is
  // format-checked only. Kept in sync with backend/src/utils/modulo10.ts.
  if (idType === 'personalausweis') return checksumPasses(normaliseIdNumber(raw));
  return true;
}
