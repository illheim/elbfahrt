import Link from 'next/link';

export const metadata = { title: 'Mitmachen — elb-fahrt.de' };

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Installieren',
    body: 'Im Play Store nach „StreetComplete“ suchen und installieren.',
  },
  {
    title: 'Anmelden',
    body: 'App öffnen und bei OpenStreetMap anmelden – oder kostenlos registrieren.',
  },
  {
    title: 'Standort erlauben',
    body: 'Die Karte springt zu deinem Ort. Offene Aufgaben erscheinen als bunte Marker.',
  },
  {
    title: 'Hausnummer-Aufgabe finden',
    body: 'Ein Marker an einem Gebäude fragt: „Welche Hausnummer hat dieses Haus?“',
  },
  {
    title: 'Vor Ort nachsehen',
    body: 'Geh zum Gebäude und lies die Hausnummer am Haus ab.',
  },
  {
    title: 'Eintragen',
    body: 'Marker antippen, Nummer eingeben (z. B. 17 oder 17a) und mit dem Häkchen ✓ bestätigen.',
  },
  {
    title: 'Hochladen',
    body: 'Deine Einträge werden automatisch gesendet, sobald du online bist – oder tippe oben auf das Hochladen-Symbol.',
  },
];

export default function MitmachenPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <Link href="/" className="text-sm text-accent-700 underline">
        ← Zur Übersicht
      </Link>
      <h1 className="text-2xl font-semibold">Mitmachen: Hilf mit, die App besser zu machen</h1>

      <p className="text-sm leading-relaxed text-neutral-800">
        Damit <strong>elb-fahrt.de</strong> Adressen genau findet, brauchen wir
        vollständige Hausnummern in der freien Karte{' '}
        <strong>OpenStreetMap</strong>. Mit der kostenlosen App{' '}
        <strong>StreetComplete</strong> trägst du sie beim Spazieren oder Radeln
        in wenigen Sekunden ein – ganz ohne Vorkenntnisse.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-neutral-900">Was du brauchst</h2>
        <ul className="list-disc pl-5 text-sm leading-relaxed text-neutral-800">
          <li>
            Ein <strong>Android-Smartphone</strong> (StreetComplete gibt es
            gratis im Google Play Store und bei F-Droid)
          </li>
          <li>
            Einen kostenlosen <strong>OpenStreetMap-Account</strong> – legst du
            in der App in zwei Minuten an
          </li>
          <li>Etwas Zeit in deiner Nachbarschaft</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-neutral-900">So geht’s</h2>
        <ol className="flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-700 text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-neutral-800">
                <strong className="font-semibold text-neutral-900">
                  {s.title}.
                </strong>{' '}
                {s.body}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-neutral-900">Gut zu wissen</h2>
        <ul className="list-disc rounded-md border border-neutral-200 bg-neutral-50 py-3 pl-8 pr-4 text-sm leading-relaxed text-neutral-700">
          <li>
            Trag nur ein, was du sicher vor Ort siehst. Unsicher? Mit dem
            Doppelpfeil einfach überspringen.
          </li>
          <li>Du kannst nichts kaputt machen, denn Fehler lassen sich leicht korrigieren.</li>
          <li>
            Es dauert ein paar Tage, bis neue Daten in unserer App ankommen, bitte
            hab etwas Geduld.
          </li>
          <li>
            Deine Arbeit hilft nicht nur uns, sondern der ganzen Welt:
            OpenStreetMap ist für alle frei.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-neutral-900">Wo es am meisten hilft</h2>
        <p className="text-sm leading-relaxed text-neutral-800">
          Bitte kümmere dich zuerst um <strong>Wohnstraßen und beliebte
          Treffpunkte</strong> in unseren Orten. Du bist unsicher, wo Hilfe am
          dringendsten ist? Schreib an{' '}
          <a
            href="mailto:kontakt@foerderverein-binnenmarsch.de"
            className="text-accent-700 underline"
          >
            kontakt@foerderverein-binnenmarsch.de
          </a>
          .
        </p>
        <p className="text-sm leading-relaxed text-neutral-800">
          <strong>Kein Android?</strong> Am Computer geht es über{' '}
          <a
            href="https://www.openstreetmap.org/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-700 underline"
          >
            openstreetmap.org → „Bearbeiten“
          </a>{' '}
          (iD-Editor); auf dem iPhone mit der App „Go Map!!“.
        </p>
      </section>

      <p className="border-t border-neutral-200 pt-4 text-sm text-neutral-500">
        Danke fürs Mitmachen – jede Hausnummer macht die Mitfahrt ein Stück
        einfacher.
      </p>
    </main>
  );
}
