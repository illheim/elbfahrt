/**
 * Ride-request (Gesuch) pure rules — the contact-reveal policy.
 *
 * A Gesuch is a passenger's public "I need a lift" post. Posting one means
 * "please contact me", but the requester's number is shown only to an approved
 * driver (the person who can actually give the ride), and only on the
 * single-item read — never in the public list.
 *
 * ROLLBACK SWITCHES (change here, nothing else needed):
 *   GESUCH_CONTACT_ENABLED              false → hide contact entirely again.
 *   GESUCH_CONTACT_GUARDIAN_FOR_MINORS
 *     false → show the requester's own number, incl. teens (current choice).
 *     true  → for under-18 requesters, show the guardian's contact instead.
 */

export const GESUCH_CONTACT_ENABLED = true;
export const GESUCH_CONTACT_GUARDIAN_FOR_MINORS = false;

export interface GesuchPassenger {
  first_name?: string | null;
  last_name?: string | null;
  mobile?: string | null;
  date_of_birth?: string | null;
  parent_first_name?: string | null;
  parent_last_name?: string | null;
  parent_mobile?: string | null;
}

export interface GesuchContact {
  name: string;
  phone: string | null;
  is_guardian: boolean;
}

/** Whole years between `dob` and `now`. `null` if missing/unparseable. */
export function ageYears(
  dob: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

/**
 * True for a verified driver. `driver_status === 'approved'` (passed the ID
 * check, admin-approved) is the source of truth — the same gate the ride-create
 * controller uses. The `roles` array is a soft self-selection (which tab the
 * user prefers), NOT a trust signal, and an admin can approve a driver without
 * it ever containing 'driver' — so we must not gate on it (beta bug B1).
 */
export function isApprovedDriver(
  user: { driver_status?: string; roles?: string[] } | null | undefined
): boolean {
  return !!user && user.driver_status === 'approved';
}

/**
 * The contact to reveal for a Gesuch, or `null` if there's no passenger.
 * When `useGuardianForMinors` is on, under-18 requesters resolve to the
 * guardian's contact; otherwise everyone shows their own. The default reads the
 * module flag so production behaviour flips with the switch above; tests pass it
 * explicitly to cover both policies.
 */
export function gesuchContact(
  p: GesuchPassenger | null | undefined,
  opts: { useGuardianForMinors?: boolean; now?: Date } = {}
): GesuchContact | null {
  if (!p) return null;
  const {
    useGuardianForMinors = GESUCH_CONTACT_GUARDIAN_FOR_MINORS,
    now = new Date(),
  } = opts;

  const age = ageYears(p.date_of_birth, now);
  if (useGuardianForMinors && age !== null && age < 18) {
    return {
      name: [p.parent_first_name, p.parent_last_name].filter(Boolean).join(' '),
      phone: p.parent_mobile ?? null,
      is_guardian: true,
    };
  }
  return {
    name: [p.first_name, p.last_name].filter(Boolean).join(' '),
    phone: p.mobile ?? null,
    is_guardian: false,
  };
}
