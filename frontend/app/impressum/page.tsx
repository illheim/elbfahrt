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
            Gemeinde Drage
            <br />
            Drennhäuser Straße 27
            <br />
            21423 Drage, Deutschland
          </p>
          <p className="mt-2">Betreiber des Mitfahrangebots elb-fahrt.de.</p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">Kontakt</h2>
          <p>
            E-Mail:{' '}
            <a
              href="mailto:drage@sg-elbmarsch.de"
              className="text-accent-700 underline"
            >
              drage@sg-elbmarsch.de
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
          </h2>
          <p>Michael Hanig, Anschrift wie oben.</p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            Hinweis zur Mitfahrvermittlung
          </h2>
          <p>
            elb-fahrt.de vermittelt private, nicht gewerbliche
            Mitfahrgelegenheiten. Die Gemeinde Drage stellt hierfür
            lediglich die technische Plattform bereit und wird nicht
            Vertragspartei der zwischen Fahrer:innen und Mitfahrer:innen
            getroffenen Absprachen. Für die Durchführung der Fahrten,
            Versicherungsschutz und die Einhaltung verkehrsrechtlicher
            Vorschriften sind die Nutzer:innen selbst verantwortlich.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">Förderung</h2>
          <p>
            Dieses Projekt wurde im Rahmen der Dorfentwicklung ‚Untere Ilmenau‘
            mit Fördermitteln des Landes Niedersachsen und der Europäischen Union
            (ELER) unterstützt.
          </p>
        </section>

      </div>
    </main>
  );
}
