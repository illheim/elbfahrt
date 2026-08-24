import Link from 'next/link';

export const metadata = { title: 'Datenschutzerklärung — elb-fahrt.de' };

export default function DatenschutzPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <Link href="/" className="text-sm text-accent-700 underline">
        ← Zur Übersicht
      </Link>
      <h1 className="text-2xl font-semibold">Datenschutzerklärung</h1>

      <div className="flex flex-col gap-5 text-sm leading-relaxed text-neutral-800">
        <p>
          Der Schutz Ihrer personenbezogenen Daten ist uns wichtig. Nachfolgend
          informieren wir Sie gemäß Art. 13 und 14 der
          Datenschutz-Grundverordnung (DSGVO) über die Verarbeitung
          personenbezogener Daten bei der Nutzung des Mitfahrangebots{' '}
          <strong>elb-fahrt.de</strong>.
        </p>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            1. Verantwortlicher
          </h2>
          <p>
            Verantwortlich im Sinne der DSGVO ist:
            <br />
            <strong>Förderverein Binnenmarsch e. V.</strong>
            <br />
            Mover Str. 15E, 21423 Drage, Deutschland
            <br />
            Vertreten durch: Carsten Becker
            <br />
            E-Mail:{' '}
            <a
              href="mailto:kontakt@foerderverein-binnenmarsch.de"
              className="text-accent-700 underline"
            >
              kontakt@foerderverein-binnenmarsch.de
            </a>
          </p>
          <p className="mt-2">
            Ein Datenschutzbeauftragter wurde nicht benannt, da die gesetzlichen
            Voraussetzungen nach Art. 37 DSGVO i. V. m. § 38 BDSG nicht
            vorliegen. Bei Fragen zum Datenschutz wenden Sie sich bitte an die
            oben genannte Stelle.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            2. Welche Daten wir verarbeiten
          </h2>

          <h3 className="mt-2 font-medium text-neutral-900">
            a) Registrierung und Nutzerkonto
          </h3>
          <p>
            Bei der Registrierung erheben wir: Vorname, Nachname, Geburtsdatum,
            E-Mail-Adresse, Passwort (nur verschlüsselt/gehasht gespeichert),
            Mobiltelefonnummer sowie Ihre Anschrift (Straße, Hausnummer,
            Postleitzahl, Ort).
          </p>

          <h3 className="mt-3 font-medium text-neutral-900">
            b) Angaben zu Minderjährigen
          </h3>
          <p>
            Ist die registrierte Person minderjährig (unter 18 Jahren), erheben
            wir zusätzlich Vorname, Nachname und Mobiltelefonnummer eines
            Elternteils bzw. einer erziehungsberechtigten Person. Siehe hierzu
            Abschnitt 5.
          </p>

          <h3 className="mt-3 font-medium text-neutral-900">
            c) Fahrer-Verifizierung
          </h3>
          <p>
            Wer Fahrten anbieten möchte, gibt zur Verifizierung eine
            Personalausweis- oder Führerscheinnummer ein.{' '}
            <strong>
              Die eingegebene Nummer wird ausschließlich zur einmaligen
              Plausibilitätsprüfung verarbeitet und anschließend unverzüglich
              verworfen.
            </strong>{' '}
            Dauerhaft gespeichert werden nur die Art des Dokuments
            (Personalausweis/Führerschein), der Verifizierungsstatus sowie der
            Zeitpunkt der Verifizierung.
          </p>

          <h3 className="mt-3 font-medium text-neutral-900">
            d) Fahrtenangebote, -gesuche und Buchungen
          </h3>
          <p>
            Zur Vermittlung verarbeiten wir die von Ihnen eingegebenen Fahrt-
            bzw. Gesuchsdaten: Start- und Zieladresse (inkl. der zugehörigen
            Geokoordinaten), Datum/Uhrzeit, Anzahl der Plätze,
            Wiederholungsmuster sowie freiwillige Notizen. Bei einer Buchung wird
            gespeichert, welche Person welche Fahrt gebucht bzw. zur Buchung
            angeboten hat. Nach einer bestätigten Buchung werden den beteiligten
            Personen gegenseitig Name und Mobilnummer angezeigt, damit die Fahrt
            abgesprochen werden kann.
          </p>

          <h3 className="mt-3 font-medium text-neutral-900">
            e) Technische Daten
          </h3>
          <p>
            Beim Aufruf und der Nutzung des Dienstes verarbeitet der Server
            technisch notwendige Daten (z. B. IP-Adresse, Zeitpunkt der Anfrage,
            aufgerufene Ressource, Fehlerprotokolle). Nach erfolgreicher
            Anmeldung wird ein Authentifizierungstoken (JWT) im lokalen Speicher
            Ihres Browsers (localStorage) abgelegt; dieser wird beim Abmelden
            entfernt.{' '}
            <strong>
              Das Token dient ausschließlich der Authentifizierung während der
              Anmeldung.
            </strong>
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            3. Zwecke und Rechtsgrundlagen
          </h2>
          <div className="mt-1 flex flex-col gap-2">
            {[
              {
                z: 'Bereitstellung des Nutzerkontos und Vermittlung von Mitfahrgelegenheiten (Registrierung, Fahrten, Gesuche, Buchungen, Anzeige der Kontaktdaten nach Buchung)',
                r: 'Art. 6 Abs. 1 lit. b DSGVO (Vertrag/Nutzungsverhältnis)',
              },
              {
                z: 'E-Mail-Bestätigung der Registrierung',
                r: 'Art. 6 Abs. 1 lit. b DSGVO',
              },
              {
                z: 'Freiwillige Angaben (z. B. Notizen)',
                r: 'Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)',
              },
              {
                z: 'Verarbeitung von Daten Minderjähriger',
                r: 'Art. 6 Abs. 1 lit. a i. V. m. Art. 8 DSGVO (Einwilligung der/des Sorgeberechtigten)',
              },
              {
                z: 'Fahrer-Verifizierung zur Erhöhung der Sicherheit (insb. beim Mitnehmen Minderjähriger)',
                r: 'Art. 6 Abs. 1 lit. b und lit. f DSGVO (berechtigtes Interesse an einer vertrauenswürdigen Plattform)',
              },
              {
                z: 'Betrieb, Sicherheit und Stabilität des Dienstes (Server-/Fehlerprotokolle)',
                r: 'Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)',
              },
            ].map((row) => (
              <div
                key={row.z}
                className="rounded-md border border-neutral-200 p-2"
              >
                <p>{row.z}</p>
                <p className="mt-1 text-xs text-neutral-500">{row.r}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            4. Empfänger und Auftragsverarbeiter
          </h2>
          <p>
            Wir setzen sorgfältig ausgewählte Dienstleister ein, mit denen
            jeweils ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO besteht:
          </p>
          <ul className="mt-2 list-disc pl-5">
            <li>
              <strong>Hosting/Server:</strong> Hetzner Online GmbH, Deutschland.
              Auf diesem Server werden Anwendung und Datenbank betrieben.
            </li>
            <li>
              <strong>E-Mail-Versand:</strong> Hetzner Online GmbH, Deutschland.
            </li>
          </ul>
          <p className="mt-2">
            Eine Übermittlung Ihrer Daten an weitere Dritte findet nicht statt,
            es sei denn, wir sind gesetzlich dazu verpflichtet.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            5. Minderjährige
          </h2>
          <p>
            Der Dienst darf von Minderjährigen nur mit Einwilligung der/des
            Sorgeberechtigten genutzt werden. Für die Verarbeitung der Daten
            Minderjähriger stützen wir uns auf die Einwilligung der/des
            Sorgeberechtigten (Art. 8 DSGVO). Die bei der Registrierung
            anzugebenden Kontaktdaten eines Elternteils dienen der
            Rückversicherung und Kontaktaufnahme. Die Einwilligung kann jederzeit
            für die Zukunft widerrufen werden.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            6. Adressverarbeitung (Geocoding) und Routenberechnung
          </h2>
          <p>
            Zur Umwandlung von Adressen in Geokoordinaten und zur Berechnung von
            Entfernung und Fahrzeit betreiben wir eigene, selbst gehostete
            Dienste (Nominatim und OSRM) auf unserem eigenen Server. Ihre Adress-
            und Standorteingaben werden hierbei{' '}
            <strong>nicht an Dritte übermittelt.</strong>
          </p>
          <p className="mt-2">
            Auch die Kartendarstellung (Kartenkacheln, Schriften und Symbole)
            wird vollständig von unserem eigenen Server ausgeliefert. Es werden
            hierfür keine Inhalte von Dritten nachgeladen.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            7. Cookies und lokale Speicherung
          </h2>
          <p>
            Wir verwenden <strong>keine</strong> Tracking-Cookies und{' '}
            <strong>keine</strong> Analyse- oder Werbedienste. Technisch
            notwendig ist lediglich die Speicherung des Anmeldetokens im lokalen
            Speicher (localStorage) Ihres Browsers (siehe 2 e).
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            8. Speicherdauer
          </h2>
          <p>
            Wir speichern Ihre Daten, solange Ihr Nutzerkonto besteht bzw.
            solange dies zur Erfüllung der genannten Zwecke erforderlich ist.
            Nach Löschung des Kontos werden Ihre personenbezogenen Daten
            gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten
            entgegenstehen. Server- und Fehlerprotokolle werden nach 7 Tagen
            gelöscht. Fahrtdaten können aus gesetzlichen oder berechtigten
            Gründen für einen begrenzten Zeitraum auch nach Abschluss einer Fahrt
            gespeichert werden.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            9. Automatisierte Entscheidungen
          </h2>
          <p>
            Eine automatisierte Entscheidungsfindung einschließlich Profiling
            gemäß Art. 13 DSGVO findet nicht statt.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            10. Ihre Rechte
          </h2>
          <p>Sie haben nach der DSGVO das Recht auf:</p>
          <ul className="mt-2 list-disc pl-5">
            <li>
              Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
              Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit
              (Art. 20),
            </li>
            <li>
              Widerspruch gegen die Verarbeitung (Art. 21), soweit diese auf
              einem berechtigten Interesse beruht,
            </li>
            <li>
              Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft
              (Art. 7 Abs. 3).
            </li>
          </ul>
          <p className="mt-2">
            Zur Ausübung genügt eine formlose Nachricht an die in Abschnitt 1
            genannte Adresse. Ihnen steht zudem ein Beschwerderecht bei einer
            Datenschutzaufsichtsbehörde zu (Art. 77 DSGVO). Zuständig ist die{' '}
            <strong>
              Landesbeauftragte für den Datenschutz Niedersachsen
            </strong>
            , Prinzenstraße 5, 30159 Hannover (
            <a
              href="https://lfd.niedersachsen.de"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-700 underline"
            >
              lfd.niedersachsen.de
            </a>
            ).
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            11. Datensicherheit
          </h2>
          <p>
            Die Übertragung erfolgt verschlüsselt (HTTPS/TLS). Passwörter werden
            nur in gehashter Form gespeichert. Zugriff auf die Daten haben nur
            berechtigte Personen.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-neutral-900">
            12. Änderungen dieser Datenschutzerklärung
          </h2>
          <p>
            Wir passen diese Datenschutzerklärung an, wenn sich die
            Datenverarbeitung oder die Rechtslage ändert. Es gilt die jeweils auf
            elb-fahrt.de veröffentlichte Fassung.
          </p>
        </section>

        <p className="text-xs text-neutral-500">Stand: 24. August 2026</p>
      </div>
    </main>
  );
}
