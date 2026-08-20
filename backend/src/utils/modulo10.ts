/**
 * Modulo-10 check-digit validation for the German Personalausweis.
 *
 * NOTE: this 7-3-1 scheme applies to the PERSONALAUSWEIS only. The Führerschein
 * number does not use it (see isValidIdNumber) — it is format-checked only.
 *
 * Algorithm (the 7-3-1 weighted variant used by the Personalausweis since 2010):
 *   1. Strip whitespace, uppercase.
 *   2. Take all characters except the final one (the check digit).
 *   3. Map each char to a number:
 *        '0'..'9' → 0..9
 *        'A'..'Z' → 10..35
 *   4. Multiply by repeating weights [7, 3, 1, 7, 3, 1, ...].
 *   5. Sum products, take sum mod 10.
 *   6. Compare to the final char (which must be a digit 0..9).
 *
 * This is a STRUCTURAL sanity check, not legal proof of identity.
 * Per PLAN.md it's used as a soft-trust gate before admin review,
 * not as compliance evidence.
 *
 * Per-document-type format requirements (length, allowed chars) are
 * checked separately via `isValidFormat`.
 */

export type IdType = 'personalausweis' | 'fuehrerschein';

const WEIGHTS = [7, 3, 1] as const;

/**
 * Map a single char to its numeric value for the checksum.
 * Returns null if the char isn't a digit or A–Z.
 */
function charValue(ch: string): number | null {
  const code = ch.charCodeAt(0);
  // '0'..'9'
  if (code >= 48 && code <= 57) return code - 48;
  // 'A'..'Z'
  if (code >= 65 && code <= 90) return code - 65 + 10;
  return null;
}

/**
 * Normalise input: uppercase, strip non-alphanumeric.
 */
export function normaliseIdNumber(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Quick format check by document type.
 * Personalausweis (post-2010): 10 alphanumeric chars, last must be a digit.
 * Führerschein (EU format since 2013): 11 alphanumeric chars, last must be a digit.
 */
export function isValidFormat(idType: IdType, raw: string): boolean {
  const s = normaliseIdNumber(raw);
  const expectedLength = idType === 'personalausweis' ? 10 : 11;
  if (s.length !== expectedLength) return false;
  if (!/^[0-9]$/.test(s[s.length - 1])) return false;
  return /^[A-Z0-9]+$/.test(s);
}

/**
 * Run the Modulo-10 (7-3-1 weighted) check on a normalised string.
 * Assumes the last char is the check digit.
 */
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

/**
 * Full validation.
 *
 * Personalausweis: format + the 7-3-1 mod-10 check digit (that scheme is
 * genuinely correct for the post-2010 Personalausweis).
 *
 * Führerschein: FORMAT ONLY. The German driving-licence number does NOT use the
 * 7-3-1 scheme — applying it produces false negatives on real licences (e.g.
 * `M24001K8B32`), and there's no simple public checksum we can rely on. Since
 * the number is validate-and-discard anyway (PLAN Q2 — a weak soft-trust
 * signal, not real identity proof), a format check is the honest level here.
 */
export function isValidIdNumber(idType: IdType, raw: string): boolean {
  if (!isValidFormat(idType, raw)) return false;
  if (idType === 'personalausweis') return checksumPasses(normaliseIdNumber(raw));
  return true;
}
