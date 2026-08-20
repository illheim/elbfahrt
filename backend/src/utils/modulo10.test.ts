import { describe, it, expect } from 'vitest';
import { normaliseIdNumber, isValidFormat, isValidIdNumber } from './modulo10';

/**
 * These tests pin the validator to its documented 7-3-1 mod-10 behaviour — a
 * STRUCTURAL check, not real-world ID legitimacy. Fixtures are hand-computed:
 *
 *   Personalausweis "1234567897": body "123456789"
 *     7·1 + 3·2 + 1·3 + 7·4 + 3·5 + 1·6 + 7·7 + 3·8 + 1·9 = 147; 147 % 10 = 7 ✓
 *
 *   Personalausweis "T220001293": body "T22000129", T→29
 *     7·29 + 3·2 + 1·2 + 7·0 + 3·0 + 1·0 + 7·1 + 3·2 + 1·9 = 233; 233 % 10 = 3 ✓
 *
 *   Führerschein "12345678907": body "1234567890"
 *     (same first nine as above) + 7·0 = 147; 147 % 10 = 7 ✓
 */

describe('normaliseIdNumber', () => {
  it('uppercases and strips non-alphanumerics', () => {
    expect(normaliseIdNumber('t2 2000-129 3')).toBe('T220001293');
    expect(normaliseIdNumber(' abc-123 ')).toBe('ABC123');
  });

  it('leaves an already-clean value unchanged', () => {
    expect(normaliseIdNumber('T220001293')).toBe('T220001293');
  });
});

describe('isValidFormat', () => {
  it('accepts a 10-char Personalausweis ending in a digit', () => {
    expect(isValidFormat('personalausweis', '1234567897')).toBe(true);
    expect(isValidFormat('personalausweis', 'T220001293')).toBe(true);
  });

  it('accepts an 11-char Führerschein ending in a digit', () => {
    expect(isValidFormat('fuehrerschein', '12345678907')).toBe(true);
  });

  it('rejects wrong lengths for the given type', () => {
    expect(isValidFormat('personalausweis', '123456789')).toBe(false); // 9
    expect(isValidFormat('personalausweis', '12345678907')).toBe(false); // 11
    expect(isValidFormat('fuehrerschein', '1234567897')).toBe(false); // 10
  });

  it('rejects when the last char is not a digit', () => {
    expect(isValidFormat('personalausweis', 'T22000129X')).toBe(false);
  });

  it('rejects the empty string', () => {
    expect(isValidFormat('personalausweis', '')).toBe(false);
  });
});

describe('isValidIdNumber', () => {
  it('passes Personalausweis numbers whose check digit matches', () => {
    expect(isValidIdNumber('personalausweis', '1234567897')).toBe(true);
    expect(isValidIdNumber('personalausweis', 'T220001293')).toBe(true);
  });

  it('normalises before checking, so spacing/case/dashes are fine', () => {
    expect(isValidIdNumber('personalausweis', 't2 2000-129 3')).toBe(true);
  });

  it('fails when the Personalausweis check digit is wrong', () => {
    expect(isValidIdNumber('personalausweis', '1234567890')).toBe(false);
  });

  it('fails a structurally valid number under the wrong document type', () => {
    // 10 chars: valid Personalausweis, but a Führerschein must be 11.
    expect(isValidIdNumber('personalausweis', '1234567897')).toBe(true);
    expect(isValidIdNumber('fuehrerschein', '1234567897')).toBe(false);
  });

  it('fails on empty input', () => {
    expect(isValidIdNumber('personalausweis', '')).toBe(false);
  });
});

describe('isValidIdNumber — Führerschein (format only, no checksum)', () => {
  it('accepts a real licence number that the 7-3-1 checksum would reject', () => {
    // The regression: a genuine German licence. Applying the Personalausweis
    // checksum here produced a false negative (PLAN Q2 / §10).
    expect(isValidIdNumber('fuehrerschein', 'M24001K8B32')).toBe(true);
  });

  it('accepts any 11-char alphanumeric ending in a digit', () => {
    expect(isValidIdNumber('fuehrerschein', '12345678900')).toBe(true);
  });

  it('rejects wrong length or a non-digit final character', () => {
    expect(isValidIdNumber('fuehrerschein', 'M24001K8B3')).toBe(false); // 10 chars
    expect(isValidIdNumber('fuehrerschein', 'M24001K8B3X')).toBe(false); // last not a digit
  });
});
