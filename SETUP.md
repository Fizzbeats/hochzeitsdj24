# HochzeitsDJ24 — Einrichtung

## Was ist da

| Datei | Zweck |
|---|---|
| `index.html` | Startseite |
| `angebot.html` | Angebotserstellung für Kunden (öffentlich, auch ohne Konto) |
| `admin.html` | DJ-Cockpit: Dashboard, Anfragen, Kalkulation, Freigabe, Kunden-Chat |
| `kundenbereich.html` | Kunde ruft das freigegebene Angebot ab, nimmt an oder schreibt dem DJ |
| `config.js` | **Alle Stammdaten und Preise — hier wird gepflegt** |
| `pdf.js` | Erzeugt das Vertrags-PDF nach der Vorlage |
| `daten.js` | Verbindung zur Datenbank |
| `schema.sql` | Datenbankstruktur für Supabase |
| `style.css`, `app.css` | Gestaltung |
| `fonts.css`, `fonts/` | Lokal eingebundene Schriften (kein Google-Fonts-Aufruf mehr) |
| `entwicklung.html` | Nur für Jens: Live-Checkliste, was für den Livegang noch fehlt |
| `supabase/functions/` | Fertige Edge Function für die E-Mail-Benachrichtigung |
| `favicon.svg`, `robots.txt`, `sitemap.xml` | Browser-Tab-Symbol und Suchmaschinen-Grundlagen |

## Sofort testen (ohne Server)

`angebot.html` doppelklicken. Ohne eingerichtete Datenbank läuft alles im Demo-Modus:
Anfragen landen lokal im Browser, in `admin.html` meldet man sich mit
**demo@hochzeitsdj-24.de** / **demo** an.

Das DJ-Cockpit füllt sich beim ersten Öffnen automatisch mit Beispieldaten
(Hochzeiten, Termine, eine offene Rechnung), damit man sieht, wie es im
Betrieb aussieht. Die Beispiele lassen sich ganz normal öffnen und löschen.
Im Cockpit gibt es außerdem einen Knopf „Als bezahlt markieren“ — damit
verschwindet eine Rechnung aus der Offen-Liste und zählt als abgeschlossen.

## Preise ändern

Alles in `config.js` unter `preise`. Beispiel aus der Vorlage:

```js
satz_empfang: 35.00,     // Sektempfang, € pro Stunde (interne Kalkulation)
satz_party:   70.00,     // Party, € pro Stunde (interne Kalkulation)
technik:     150.00,     // Technik Variante A
technik_b:   250.00,     // Technik Variante B (große Anlage)
entertainment: 100.00,   // Pauschale
kinderanimation: 50.00,  // Ansatz, 50–250 € je nach Umfang
open_end:    100.00,     // Party Open End, pauschal ab 1 Uhr
fotobox_standard: 200.00,
fotobox_deluxe:   250.00,
mwst_satz:    19
```

**Hinweis Echtbetrieb:** Für den Feedback-Chat braucht die Datenbank eine Funktion
`chat_senden(anfrage_id, nachricht)` sowie eine `chat`-Spalte (jsonb) an `anfragen` —
im Demo-Modus läuft der Chat ohne weitere Einrichtung.

Im internen Bereich lassen sich die Sätze pro Anfrage zusätzlich einzeln anpassen,
ohne die Standardwerte zu verändern.

## Echtbetrieb einrichten

### 1. Supabase (Datenbank und Login, kostenfrei)

1. Auf supabase.com Konto anlegen, neues Projekt erstellen, **Region Frankfurt (eu-central-1)** wählen.
2. Im SQL-Editor den Inhalt von `schema.sql` einfügen und ausführen.
3. Unter *Database → Extensions* die Erweiterung `pg_cron` aktivieren (für die automatische Löschung).
4. Unter *Settings → API* die **Project URL** und den **anon public key** kopieren und in `config.js` unter `supabase` eintragen.
5. Unter *Authentication → Users* einen Benutzer für Jens Winter anlegen.
6. Im SQL-Editor diesen Benutzer als Verwalter eintragen:

```sql
insert into public.verwalter (user_id)
select id from auth.users where email = 'jenswinter@email.de';
```

7. Unter *Settings → Legal* den Auftragsverarbeitungsvertrag (DPA) abschließen — das ist für die DSGVO nötig.

### 2. Hosting (kostenfrei)

Cloudflare Pages oder Netlify: Ordner hochladen bzw. mit einem Git-Repository verbinden, fertig.
Anschließend die Domain `hochzeitsdj-24.de` dort eintragen. Wichtig: Die Seite muss über
**https** laufen.

### 3. Kundenzugänge

Wenn Jens Winter einen Vertrag freigibt, legt er für das Paar in Supabase unter
*Authentication → Users* einen Zugang mit dessen E-Mail-Adresse an (Supabase verschickt die
Einladung automatisch) und trägt im SQL-Editor die Zuordnung ein:

```sql
update public.anfragen
   set kunde_id = (select id from auth.users where email = 'paar@example.de')
 where id = 'ID-DER-ANFRAGE';
```

Das lässt sich später automatisieren; für den Anfang genügt der manuelle Weg.

### 4. E-Mail-Benachrichtigung (optional, aber empfohlen)

Der Code dafür liegt bereits fertig in `supabase/functions/neue-anfrage-email/index.ts`.
Ohne das bekommt Jens Winter neue Anfragen nur mit, wenn er selbst ins Cockpit schaut.

1. Auf resend.com ein kostenfreies Konto anlegen (bis 3.000 Mails/Monat gratis) und
   im Dashboard die eigene Domain oder Absenderadresse verifizieren.
2. Unter *API Keys* einen Schlüssel erstellen.
3. Mit der [Supabase CLI](https://supabase.com/docs/guides/cli) einmalig anmelden
   (`supabase login`) und das Projekt verknüpfen (`supabase link --project-ref DEIN-PROJEKT-REF`,
   die Projekt-Ref steht unter *Settings → General*).
4. Die Funktion bereitstellen:
   ```
   supabase functions deploy neue-anfrage-email
   supabase secrets set RESEND_API_KEY=der-schluessel-von-resend
   supabase secrets set BENACHRICHTIGUNG_EMAIL=jenswinter@email.de
   supabase secrets set ABSENDER_EMAIL=anfragen@hochzeitsdj24.de
   ```
5. Im Supabase-Dashboard unter *Database → Webhooks* einen neuen Webhook anlegen:
   Tabelle `anfragen`, Ereignis `INSERT`, Ziel = die eben bereitgestellte Funktion.

Ab dann kommt bei jeder neuen Anfrage automatisch eine E-Mail an Jens.

### 4b. E-Mail an den Kunden bei Freigabe

Genauso vorbereitet: `supabase/functions/angebot-freigegeben-email/index.ts`. Schickt dem
Kunden automatisch eine E-Mail mit Link zum Kundenbereich, sobald Jens ein Angebot freigibt
(nicht bei jeder weiteren Änderung wie „als bezahlt markieren").

```
supabase functions deploy angebot-freigegeben-email
supabase secrets set SEITE_URL=https://www.hochzeitsdj24.de
```

(nutzt dieselben Secrets `RESEND_API_KEY` und `ABSENDER_EMAIL` von oben)

Dann im Dashboard unter *Database → Webhooks* einen zweiten Webhook anlegen:
Tabelle `anfragen`, Ereignis `UPDATE`, Ziel = `angebot-freigegeben-email`.

## Laufende Kosten

| Posten | Kosten |
|---|---|
| Supabase Free | 0 € |
| Cloudflare Pages | 0 € |
| Resend (optional) | 0 € |
| Domain | wie bisher |

## Datenschutz — was umgesetzt ist

- Server in Frankfurt, Auftragsverarbeitungsvertrag über Supabase verfügbar
- Zeilensicherheit: Kunden sehen ausschließlich ihre eigene Anfrage
- Einwilligung wird im Formular aktiv abgefragt
- Unbestätigte Anfragen werden nach 90 Tagen automatisch gelöscht
- Freigegebene Verträge werden 30 Tage nach der Feier automatisch gelöscht
- Keine Tracking-Dienste, keine Cookies außer der Anmeldesitzung

**Noch zu erledigen:** Datenschutzerklärung und Impressum ergänzen (`datenschutz.html`,
`impressum.html`). Die steuerliche Aufbewahrung der Rechnungen erfolgt außerhalb der
Website über die lokal gespeicherten PDFs — das bitte einmal mit dem Steuerberater abklären.

## Bereit zum Livegang? Diese Punkte fehlen noch

Technisch ist die Seite so weit fertig — alles unten braucht eine Entscheidung oder
einen Zugang, den nur Jens Winter hat, deshalb kann das niemand automatisch erledigen:

1. **Supabase fertig einrichten** — siehe „Echtbetrieb einrichten" oben: Auftragsverarbeitungsvertrag
   (DPA) unter *Settings → Legal* abschließen, das ist für die DSGVO Pflicht.
2. **Hosting + Domain** — Cloudflare Pages oder Netlify anbinden (siehe oben), dort die
   eigene Domain eintragen.
3. **Rechtstexte prüfen lassen** — `impressum.html` und `datenschutz.html` sind als
   Entwurf vollständig ausformuliert, sollten aber von einer fachkundigen Stelle
   gegengelesen werden (Hinweis steht auch direkt auf beiden Seiten).
4. **Eigene Fotos** — `bild-hochzeit.jpg` und `bild-events.jpg` ersetzen (siehe unten),
   dazu die Platzhalterflächen in der Galerie.
5. **Echtes Logo** — für den Vertrags-PDF-Kopf, aktuell ein nachgebauter Rahmen.
6. **Offene Geschäftsentscheidungen** für die FAQ, die die Website nicht selbst festlegen
   darf: Anzahlung nötig? Stornobedingungen? Wer meldet die Musik bei der GEMA an?
   Sobald die Antworten feststehen, lassen sich die passenden FAQ-Einträge in
   `index.html` ergänzen.

Alles andere — Preise, Pakete, Formulare, Kalkulation, Kunden-Chat, Datenbank-Anbindung,
Sicherheit, mobile Darstellung — ist technisch fertig und mehrfach getestet.

## Bilder der Startseite austauschen

Aktuell im Einsatz: `bild-hochzeit.jpg` (tanzendes Brautpaar im Nebel) und
`bild-events.jpg` (Anstoßen vor Bühnenlicht). Beide sind auf 1800 Pixel Breite
gebracht und leicht abgedunkelt, damit die weiße Schrift trägt.

Andere Fotos einsetzen: einfach die beiden Dateien unter gleichem Namen ersetzen.
Empfehlung: Querformat, mindestens 1600 Pixel breit, ruhige und eher dunkle Motive.

Sitzt der Bildausschnitt nicht, lässt er sich in `intro.css` verschieben —
über `background-position` bei `.split__seite--hochzeit .split__bild`
bzw. `.split__seite--events .split__bild`. Der erste Wert regelt links/rechts,
der zweite oben/unten.
