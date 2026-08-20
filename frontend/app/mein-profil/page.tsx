'use client';

/**
 * Mein Profil — the signed-in user edits their own details.
 *
 * Editable via PUT /me/profile: name, mobile, address, gender, and the
 * smoker/pets preferences. Email and date of birth are read-only (email is the
 * login; DOB drives the under-18 rules). A danger zone deletes the account
 * (DELETE /me/account), which also removes the user's rides, Gesuche and
 * bookings server-side.
 */

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth/useRequireAuth';
import { useAuth } from '@/lib/auth/context';
import { ApiError } from '@/lib/api/client';
import { updateProfile, deleteAccount } from '@/lib/api/auth';
import type { Gender, User } from '@/lib/api/types';

interface FormState {
  first_name: string;
  last_name: string;
  mobile: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  gender: Gender | '';
  is_smoker: boolean;
  travels_with_pets: boolean;
}

export default function ProfilePage() {
  const { user, isLoading } = useRequireAuth();
  if (isLoading || !user) return null;
  // Inner component so the form state can lazy-init from a guaranteed-present
  // user (no effect syncing props → state).
  return <ProfileForm user={user} />;
}

function ProfileForm({ user }: { user: User }) {
  const { refresh, signOut } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<FormState>(() => ({
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    mobile: user.mobile ?? '',
    street: user.street ?? '',
    house_number: user.house_number ?? '',
    postal_code: user.postal_code ?? '',
    city: user.city ?? '',
    gender: user.gender ?? '',
    is_smoker: !!user.is_smoker,
    travels_with_pets: !!user.travels_with_pets,
  }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateProfile({
        first_name: form.first_name,
        last_name: form.last_name,
        mobile: form.mobile,
        street: form.street,
        house_number: form.house_number,
        postal_code: form.postal_code,
        city: form.city,
        gender: form.gender === '' ? null : form.gender,
        is_smoker: form.is_smoker,
        travels_with_pets: form.travels_with_pets,
      });
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? 'Speichern nicht möglich. Bitte prüfen Sie Ihre Eingaben.'
          : 'Etwas ist schiefgelaufen. Bitte erneut versuchen.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      await signOut();
      router.replace('/');
    } catch {
      setError('Konto konnte nicht gelöscht werden. Bitte erneut versuchen.');
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4">
      <Link href="/" className="text-sm text-accent-700 underline">
        ← Zur Übersicht
      </Link>
      <h1 className="text-2xl font-semibold">Mein Profil</h1>

      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-neutral-700">Angaben</legend>
          <Field label="Vorname">
            <input
              type="text"
              required
              value={form.first_name}
              onChange={(e) => set('first_name', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Nachname">
            <input
              type="text"
              required
              value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="E-Mail (nicht änderbar)">
            <input
              type="email"
              value={user.email}
              readOnly
              className={readOnlyClass}
            />
          </Field>
          <Field label="Geburtsdatum (nicht änderbar)">
            <input
              type="text"
              value={fmtDate(user.date_of_birth)}
              readOnly
              className={readOnlyClass}
            />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-neutral-700">Kontakt</legend>
          <Field label="Mobilnummer">
            <input
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              value={form.mobile}
              onChange={(e) => set('mobile', e.target.value)}
              className={inputClass}
            />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-neutral-700">Adresse</legend>
          <Field label="Straße">
            <input
              type="text"
              required
              value={form.street}
              onChange={(e) => set('street', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Hausnummer">
            <input
              type="text"
              required
              value={form.house_number}
              onChange={(e) => set('house_number', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="PLZ">
            <input
              type="text"
              required
              inputMode="numeric"
              pattern="\d{5}"
              value={form.postal_code}
              onChange={(e) => set('postal_code', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Ort">
            <input
              type="text"
              required
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              className={inputClass}
            />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-neutral-700">
            Präferenzen
          </legend>
          <Field label="Geschlecht (optional)">
            <select
              value={form.gender}
              onChange={(e) => set('gender', e.target.value as Gender | '')}
              className={inputClass}
            >
              <option value="">— keine Angabe —</option>
              <option value="m">männlich</option>
              <option value="w">weiblich</option>
              <option value="non_binaer">non-binär</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={form.is_smoker}
              onChange={(e) => set('is_smoker', e.target.checked)}
            />
            Ich rauche
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={form.travels_with_pets}
              onChange={(e) => set('travels_with_pets', e.target.checked)}
            />
            Ich reise mit Haustier
          </label>
        </fieldset>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
          >
            {error}
          </div>
        )}
        {saved && (
          <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
            Änderungen gespeichert.
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {saving ? 'Wird gespeichert…' : 'Speichern'}
        </button>
      </form>

      <section className="mt-2 flex flex-col gap-3 rounded-md border border-red-200 bg-red-50/50 p-4">
        <h2 className="text-sm font-semibold text-red-900">Konto löschen</h2>
        <p className="text-sm text-neutral-700">
          Dies entfernt Ihr Konto dauerhaft – zusammen mit Ihren Fahrten,
          Gesuchen und Buchungen. Das lässt sich nicht rückgängig machen.
        </p>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="self-start rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 transition hover:bg-red-100"
          >
            Konto löschen
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800 disabled:bg-red-300"
            >
              {deleting ? 'Wird gelöscht…' : 'Endgültig löschen'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="rounded-md px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Abbrechen
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

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

function fmtDate(ymd: string): string {
  if (!ymd) return '';
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

const inputClass =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base ' +
  'focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';

const readOnlyClass =
  'w-full rounded-md border border-neutral-200 bg-neutral-100 px-3 py-2 text-base text-neutral-500';
