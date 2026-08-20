'use client';

/**
 * Sign-up form — PLAN.md §2 step 1.
 *
 * Decisions:
 * - Single page, all fields visible. Grouped via <fieldset> for screen
 *   readers and a light visual rhythm.
 * - Mobile-first layout (max-w-md, full-width inputs). The "parent
 *   contact" block appears inline under the DOB when the entered date
 *   indicates age < 18 — not a modal. Modals on mobile during a long
 *   form are jarring.
 * - Client-side validation is HTML5 + a couple of React-driven rules
 *   (minor-aware "required" on parent fields, password length). The
 *   server is the source of truth and will reject anything malformed
 *   that slips past.
 * - Strapi requires a `username`. We set it to the email at registration;
 *   the local-auth identifier accepts either, so login still works with
 *   email. Means no extra UX field.
 * - On success Strapi sends the confirmation email (assuming "Enable
 *   email confirmation" is on under Users & Permissions → Advanced).
 *   We swap the form for a "check your inbox" panel. The user then
 *   clicks the link → Strapi → /verify-email (M3.c).
 */

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { ApiError, getToken } from '@/lib/api/client';
import { PasswordInput } from '@/components/PasswordInput';

function calculateAgeYears(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Turn Strapi's (English) register errors into a German message for the user. */
function signUpErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.';
  }
  const m = (err.message || '').toLowerCase();
  if (m.includes('taken')) {
    return 'Diese E-Mail-Adresse ist bereits mit einem Konto verknüpft. Bitte melden Sie sich an.';
  }
  if (m.includes('password')) {
    return 'Das Passwort erfüllt die Anforderungen nicht (mindestens 6 Zeichen).';
  }
  if (m.includes('email')) {
    return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
  }
  return 'Registrierung nicht möglich. Bitte prüfen Sie Ihre Eingaben.';
}

export default function SignUpPage() {
  const { signUp } = useAuth();
  const router = useRouter();

  // Personal
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Contact + credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');

  // Address
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');

  // Minor branch
  const [parentFirstName, setParentFirstName] = useState('');
  const [parentLastName, setParentLastName] = useState('');
  const [parentMobile, setParentMobile] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const age = useMemo(() => calculateAgeYears(dateOfBirth), [dateOfBirth]);
  const isMinor = age !== null && age < 18 && age >= 0;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (isMinor && (!parentFirstName || !parentLastName || !parentMobile)) {
      setError(
        'Bei einem Alter unter 18 Jahren sind die Eltern-Angaben erforderlich.'
      );
      return;
    }
    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    setSubmitting(true);
    try {
      await signUp({
        username: email,
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        mobile,
        postal_code: postalCode,
        city,
        street,
        house_number: houseNumber,
        ...(isMinor
          ? {
              parent_first_name: parentFirstName,
              parent_last_name: parentLastName,
              parent_mobile: parentMobile,
            }
          : {}),
      });
      // If email confirmation is OFF in Strapi (dev), the register endpoint
      // returns a JWT and we're effectively signed in. Take the user home.
      // If confirmation is ON, no JWT → show the check-inbox panel.
      if (getToken()) {
        router.push('/');
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setError(signUpErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
        <h1 className="text-2xl font-semibold">Fast geschafft!</h1>
        <p>
          Wir haben eine Bestätigungsmail an <strong>{email}</strong> geschickt.
          Klicken Sie auf den Link darin, um Ihr Konto zu aktivieren.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Konto erstellen</h1>
        <p className="text-sm text-neutral-600">
          Alle Felder sind Pflichtfelder.
        </p>
      </header>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-neutral-700">
            Persönliche Angaben
          </legend>

          <Field label="Vorname">
            <input
              type="text"
              required
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Nachname">
            <input
              type="text"
              required
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Geburtsdatum">
            <input
              type="date"
              required
              autoComplete="bday"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={inputClass}
            />
          </Field>

          {isMinor && (
            <div className="mt-2 flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm">
                Da Sie noch nicht 18 sind, benötigen wir Kontaktdaten eines
                Erziehungsberechtigten.
              </p>
              <Field label="Vorname Erziehungsberechtigte/r">
                <input
                  type="text"
                  required
                  value={parentFirstName}
                  onChange={(e) => setParentFirstName(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Nachname Erziehungsberechtigte/r">
                <input
                  type="text"
                  required
                  value={parentLastName}
                  onChange={(e) => setParentLastName(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Mobil Erziehungsberechtigte/r">
                <input
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  value={parentMobile}
                  onChange={(e) => setParentMobile(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-neutral-700">
            Kontakt & Anmeldung
          </legend>

          <Field label="E-Mail">
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Passwort (mind. 6 Zeichen)">
            <PasswordInput
              required
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Mobilnummer">
            <input
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className={inputClass}
            />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-neutral-700">
            Adresse
          </legend>

          <Field label="Straße">
            <input
              type="text"
              required
              autoComplete="address-line1"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Hausnummer">
            <input
              type="text"
              required
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="PLZ">
            <input
              type="text"
              required
              inputMode="numeric"
              pattern="\d{5}"
              autoComplete="postal-code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Ort">
            <input
              type="text"
              required
              autoComplete="address-level2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
            />
          </Field>
        </fieldset>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {submitting ? 'Bitte warten…' : 'Konto erstellen'}
        </button>

        <p className="text-center text-sm text-neutral-600">
          Bereits ein Konto?{' '}
          <Link href="/sign-in" className="text-accent-700 underline">
            Anmelden
          </Link>
        </p>
      </form>
    </main>
  );
}

/** Reusable label + input wrapper for consistent spacing. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-neutral-800">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-base ' +
  'focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
