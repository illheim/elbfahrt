import Link from 'next/link';

export const metadata = { title: 'Datenschutzerklärung — elb-fahrt.de' };

export default function DatenschutzPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4">
      <Link href="/" className="text-sm text-accent-700 underline">
        ← Zur Übersicht
      </Link>
      <h1 className="text-2xl font-semibold">Datenschutzerklärung</h1>

      <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        Entwurf — wird vor dem öffentlichen Start finalisiert und geprüft.
      </p>

      <div className="flex flex-col gap-5 text-sm leading-relaxed text-neutral-800">
        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            1. Verantwortlicher
          </h2>
          <p>
            Förderverein Binnenmarsch, Mover Str. 15E, 21423 Drage, vertreten
            durch Carsten Becker. Kontakt:{' '}
            <a
              href="mailto:kontakt@foerderverein-binnenmarsch.de"
              className="text-accent-700 underline"
            >
              kontakt@foerderverein-binnenmarsch.de
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            2. Welche Daten wir verarbeiten
          </h2>
          <p>
            Zur Registrierung: Vor- und Nachname, Geburtsdatum, E-Mail-Adresse,
            Passwort (nur verschlüsselt gespeichert), Mobilnummer und Anschrift;
            das Geschlecht ist freiwillig. Bei Minderjährigen zusätzlich die
            Kontaktdaten einer erziehungsberechtigten Person. Zur Vermittlung:
            die von Ihnen eingegebenen Fahrt-/Gesuchsdaten (Start und Ziel,
            Zeit, Plätze, Notizen) und Buchungen. Zur Fahrer-Verifizierung wird
            eine Ausweis-/Führerscheinnummer nur geprüft und{' '}
            <strong>nicht gespeichert</strong> — dauerhaft bleibt nur der
            Verifizierungsstatus.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            3. Zwecke und Rechtsgrundlagen
          </h2>
          <p>
            Bereitstellung des Kontos und Vermittlung von Mitfahrgelegenheiten
            (Art. 6 Abs. 1 lit. b DSGVO), freiwillige Angaben auf Grundlage Ihrer
            Einwilligung (lit. a), Daten Minderjähriger mit Einwilligung der
            Sorgeberechtigten (Art. 8), Betrieb und Sicherheit des Dienstes aus
            berechtigtem Interesse (lit. f).
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            4. Empfänger, Hosting und Selbst-Hosting
          </h2>
          <p>
            Anwendung und Datenbank laufen auf einem eigenen Server; der Versand
            von Bestätigungs-E-Mails erfolgt über einen Dienstleister (jeweils
            mit Auftragsverarbeitungsvertrag). Adressumwandlung und
            Routenberechnung erfolgen über selbst gehostete Dienste — Ihre
            Adress- und Standorteingaben werden dabei nicht an Dritte
            übermittelt. Wir verwenden keine Tracking-Cookies und keine
            Analyse-Dienste.
          </p>
          <p className="mt-2">
            Zur Vermittlung werden Kontaktdaten innerhalb der Nutzergemeinschaft
            weitergegeben: Wenn Sie ein Gesuch einstellen, werden Ihr Name und
            Ihre Mobilnummer verifizierten Fahrer:innen angezeigt, damit diese
            die Mitfahrt mit Ihnen abstimmen können — dies gilt auch, wenn ein:e
            Minderjährige:r selbst ein Gesuch einstellt. Bei einer Buchung werden
            die Kontaktdaten zwischen Fahrer:in und Mitfahrer:in ausgetauscht.
            Sie können jederzeit ein eingestelltes Gesuch wieder entfernen.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            5. Speicherdauer
          </h2>
          <p>
            Wir speichern Ihre Daten, solange Ihr Konto besteht bzw. dies zur
            Erfüllung der Zwecke erforderlich ist. Nach Löschung des Kontos
            werden Ihre Daten gelöscht, soweit keine gesetzlichen
            Aufbewahrungspflichten entgegenstehen.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">6. Ihre Rechte</h2>
          <p>
            Sie haben das Recht auf Auskunft, Berichtigung, Löschung,
            Einschränkung, Datenübertragbarkeit und Widerspruch sowie das Recht,
            erteilte Einwilligungen zu widerrufen. Es genügt eine formlose
            Nachricht an die oben genannte Adresse. Zudem können Sie sich bei der
            Landesbeauftragten für den Datenschutz Niedersachsen (Hannover)
            beschweren.
          </p>
        </section>
      </div>
    </main>
  );
}
