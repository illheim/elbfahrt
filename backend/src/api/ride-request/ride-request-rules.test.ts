import { describe, it, expect } from 'vitest';
import {
  ageYears,
  isApprovedDriver,
  gesuchContact,
  type GesuchPassenger,
} from './ride-request-rules';

// Fixed "today" so age boundaries are deterministic.
const NOW = new Date('2026-06-01T12:00:00Z');

const adult: GesuchPassenger = {
  first_name: 'Anna',
  last_name: 'Albers',
  mobile: '+49 170 1111111',
  date_of_birth: '1990-01-01',
  parent_first_name: null,
  parent_last_name: null,
  parent_mobile: null,
};

const teen: GesuchPassenger = {
  first_name: 'Tim',
  last_name: 'Timm',
  mobile: '+49 170 2222222',
  date_of_birth: '2012-01-01', // 14 on NOW
  parent_first_name: 'Petra',
  parent_last_name: 'Timm',
  parent_mobile: '+49 170 9999999',
};

describe('ageYears', () => {
  it('computes whole years', () => {
    expect(ageYears('1990-01-01', NOW)).toBe(36);
    expect(ageYears('2012-01-01', NOW)).toBe(14);
  });

  it('has not had this year\'s birthday yet → one less', () => {
    // Birthday is Dec 31, NOW is June → not yet 36.
    expect(ageYears('1990-12-31', NOW)).toBe(35);
  });

  it('turns 18 exactly today → counts as 18 (not a minor)', () => {
    expect(ageYears('2008-06-01', NOW)).toBe(18);
  });

  it('is null for missing or unparseable input', () => {
    expect(ageYears(null, NOW)).toBeNull();
    expect(ageYears(undefined, NOW)).toBeNull();
    expect(ageYears('not-a-date', NOW)).toBeNull();
  });
});

describe('isApprovedDriver', () => {
  it('true only for approved status AND the driver role', () => {
    expect(isApprovedDriver({ driver_status: 'approved', roles: ['driver'] })).toBe(true);
  });

  it('false when the role is missing', () => {
    expect(isApprovedDriver({ driver_status: 'approved', roles: ['passenger'] })).toBe(false);
    expect(isApprovedDriver({ driver_status: 'approved', roles: [] })).toBe(false);
    expect(isApprovedDriver({ driver_status: 'approved' })).toBe(false);
  });

  it('false when not approved', () => {
    expect(isApprovedDriver({ driver_status: 'pending_review', roles: ['driver'] })).toBe(false);
    expect(isApprovedDriver({ roles: ['driver'] })).toBe(false);
  });

  it('false for no user', () => {
    expect(isApprovedDriver(null)).toBe(false);
    expect(isApprovedDriver(undefined)).toBe(false);
  });
});

describe('gesuchContact', () => {
  it('returns null with no passenger', () => {
    expect(gesuchContact(null)).toBeNull();
    expect(gesuchContact(undefined)).toBeNull();
  });

  it('adult → own name + mobile', () => {
    expect(gesuchContact(adult, { now: NOW })).toEqual({
      name: 'Anna Albers',
      phone: '+49 170 1111111',
      is_guardian: false,
    });
  });

  // The chosen policy (Option 2): a teen who posts their own Gesuch shows THEIR
  // own number, not a guardian's.
  it('minor with default policy → own number (Option 2)', () => {
    expect(gesuchContact(teen, { now: NOW })).toEqual({
      name: 'Tim Timm',
      phone: '+49 170 2222222',
      is_guardian: false,
    });
  });

  // The rollback: flipping GESUCH_CONTACT_GUARDIAN_FOR_MINORS reverts minors to
  // the guardian's contact.
  it('minor with guardian policy → guardian contact', () => {
    expect(gesuchContact(teen, { useGuardianForMinors: true, now: NOW })).toEqual({
      name: 'Petra Timm',
      phone: '+49 170 9999999',
      is_guardian: true,
    });
  });

  it('adult is unaffected by the guardian policy', () => {
    expect(gesuchContact(adult, { useGuardianForMinors: true, now: NOW })).toEqual({
      name: 'Anna Albers',
      phone: '+49 170 1111111',
      is_guardian: false,
    });
  });

  it('joins the name cleanly when last_name is missing', () => {
    const noLast: GesuchPassenger = { ...adult, last_name: null };
    expect(gesuchContact(noLast, { now: NOW }).name).toBe('Anna');
  });

  it('phone is null (not undefined) when absent', () => {
    const noPhone: GesuchPassenger = { ...adult, mobile: null };
    expect(gesuchContact(noPhone, { now: NOW }).phone).toBeNull();
  });
});
