import Link from 'next/link';

export const metadata = { title: 'Impressum — elb-fahrt.de' };

export default function ImpressumPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <Link href="/" className="text-sm text-accent-700 underline">
        ← Zur Übersicht
      </Link>
      <h1 className="text-2xl font-semibold">Impressum</h1>

      <div className="flex flex-col gap-5 text-sm leading-relaxed text-neutral-800">
        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            Angaben gemäß § 5 DDG
          </h2>
          <p>
            Förderverein Binnenmarsch
            <br />
            Mover Str. 15E
            <br />
            21423 Drage, Deutschland
          </p>
          <p className="mt-2">Betreiber des Mitfahrangebots elb-fahrt.de.</p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">Vertreten durch</h2>
          <p>
            Carsten Becker (vertretungsberechtigter Vorstand nach § 26 BGB)
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">Kontakt</h2>
          <p>
            E-Mail:{' '}
            <a
              href="mailto:kontakt@foerderverein-binnenmarsch.de"
              className="text-accent-700 underline"
            >
              kontakt@foerderverein-binnenmarsch.de
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
          </h2>
          <p>Carsten Becker, Anschrift wie oben.</p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            Hinweis zur Mitfahrvermittlung
          </h2>
          <p>
            elb-fahrt.de vermittelt private, nicht gewerbliche
            Mitfahrgelegenheiten. Der Förderverein Binnenmarsch stellt hierfür
            lediglich die technische Plattform bereit und wird nicht
            Vertragspartei der zwischen Fahrer:innen und Mitfahrer:innen
            getroffenen Absprachen. Für die Durchführung der Fahrten,
            Versicherungsschutz und die Einhaltung verkehrsrechtlicher
            Vorschriften sind die Nutzer:innen selbst verantwortlich.
          </p>
        </section>

        <p className="text-xs text-neutral-500">
          Registereintrag und weitere Pflichtangaben werden ergänzt.
        </p>
      </div>
    </main>
  );
}
