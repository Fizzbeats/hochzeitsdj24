/* =====================================================
   HochzeitsDJ24 — Fragebogen-Logik
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* Kopfzeile, Menü und Jahreszahl werden ausschließlich von nav.js
     gesteuert — ein zweiter Klick-Empfänger hier würde das Menü
     sofort wieder schließen. */

  let nutzer = null;

  const form     = document.getElementById('wizard');
  const schritte = [...document.querySelectorAll('.step')];
  const fill     = document.getElementById('fill');
  const stepNo   = document.getElementById('stepNo');
  const stepName = document.getElementById('stepName');
  const zurueck  = document.getElementById('back');
  const weiter   = document.getElementById('next');
  const navBtns  = document.getElementById('nav-buttons');
  const fertig   = document.getElementById('done');
  const summary  = document.getElementById('summary');

  let aktuell = 0;

  /* Das über die Startseite gewählte Paket (Kaufmodell mit Pauschalpreis).
     Bleibt null, wenn der Kunde die freie Angebotserstellung nutzt. */
  let gewaehltesPaket = null;

  /* Schritte, die je nach gewähltem Paket nicht gebraucht werden
     (z. B. die Uhrzeiten bei der reinen Hochzeitstanz-Produktion). */
  const uebersprungen = new Set();
  const sichtbare = () => schritte.map((s, i) => i).filter(i => !uebersprungen.has(i));

  /* ---------- Anzeige ---------- */
  const zeige = i => {
    schritte.forEach((s, n) => s.classList.toggle('is-active', n === i));
    const reihe = sichtbare();
    const pos = reihe.indexOf(i);
    fill.style.width = ((pos + 1) / reihe.length * 100) + '%';
    stepNo.textContent = pos + 1;
    const total = document.getElementById('stepTotal');
    if (total) total.textContent = reihe.length;
    stepName.textContent = schritte[i].dataset.name;
    zurueck.style.visibility = pos === 0 ? 'hidden' : 'visible';
    weiter.textContent = i === schritte.length - 1 ? 'Anfrage senden' : 'Weiter';
    window.scrollTo({ top: document.querySelector('.progress').offsetTop - 100, behavior: 'smooth' });

    // Empfehlung live zeigen, sobald der Kunde bei "Leistungen" ankommt —
    // da liegen Anlass, Zeiten und Leistungen schon vor.
    if (schritte[i].dataset.name === 'Leistungen') zeigeEmpfehlung();
  };

  /* ---------- Pflichtfelder prüfen ----------
     Der eigene "Weiter"-Button löst keine native Formularvalidierung aus,
     daher wird das Datum hier zusätzlich zum bloßen min-Attribut geprüft. */
  const pruefe = i => {
    let ok = true;
    schritte[i].querySelectorAll('[required]').forEach(feld => {
      // Checkboxen wie "consent" stecken in einem .consent-Label statt .f.
      const gruppe = feld.closest('.f') || feld.closest('.consent');
      // Bei Checkboxen sagt .value nichts über den Haken aus (immer "on") —
      // ohne diese Unterscheidung würde eine Pflicht-Checkbox nie als leer gelten.
      const leer = feld.type === 'checkbox' ? !feld.checked : !feld.value.trim();
      if (gruppe) gruppe.classList.toggle('f--invalid', leer);
      if (leer && ok) { feld.focus(); ok = false; }
    });

    const datumFeld = schritte[i].querySelector('#datum');
    if (ok && datumFeld && datumFeld.value) {
      const heute = new Date().toISOString().slice(0, 10);
      const gruppe = datumFeld.closest('.f');
      const inVergangenheit = datumFeld.value < heute;
      if (gruppe) gruppe.classList.toggle('f--invalid', inVergangenheit);
      if (inVergangenheit) { datumFeld.focus(); ok = false; }
    }

    return ok;
  };

  /* ---------- Wochentag anzeigen ---------- */
  const datum = document.getElementById('datum');
  const tagHint = document.getElementById('tagHint');
  if (datum) {
    // Ein Datum in der Vergangenheit lässt sich für eine Feier nicht buchen.
    datum.min = new Date().toISOString().slice(0, 10);
    datum.addEventListener('change', () => {
      tagHint.textContent = datum.value ? pdfHelfer.wochentag(datum.value) : '';
    });
  }

  /* ---------- Fragen an den Anlass anpassen ----------
     Eröffnungstanz, Brautstraußwerfen & "erster Tanz" sind Hochzeitsbegriffe
     und passen nicht zu Firmenevent/Geburtstag/Sonstiges. */
  const eroeffnungstanzFeld = document.getElementById('eroeffnungstanzFeld');
  const entertainmentDesc   = document.getElementById('entertainmentDesc');
  const remixDesc           = document.getElementById('remixDesc');
  const geburtstagFeld      = document.getElementById('geburtstagFeld');

  const aktualisiereFuerAnlass = () => {
    const anlass = form.querySelector('[name="anlass"]:checked')?.value;
    const hochzeit = anlass === 'Hochzeit';
    const geburtstag = anlass === 'Geburtstag';

    if (eroeffnungstanzFeld) {
      eroeffnungstanzFeld.style.display = hochzeit ? '' : 'none';
      if (!hochzeit) form.elements['eroeffnungstanz'].value = '';
    }
    if (entertainmentDesc) entertainmentDesc.textContent = hochzeit
      ? 'Moderation von Spielen, Torte, Brautstraußwerfen und weiteren Programmpunkten.'
      : 'Moderation von Spielen, Reden und weiteren Programmpunkten.';
    if (remixDesc) remixDesc.textContent = hochzeit
      ? 'Ihr Lied für den ersten Tanz, individuell für Sie produziert. 50 € inklusive zwei Korrekturschleifen, jede weitere 10 €.'
      : 'Ihr Wunschlied, individuell für Sie produziert. 50 € inklusive zwei Korrekturschleifen, jede weitere 10 €.';

    if (geburtstagFeld) {
      geburtstagFeld.style.display = geburtstag ? '' : 'none';
      if (!geburtstag) form.elements['geburtstagszahl'].value = '';
    }
  };

  form.querySelectorAll('[name="anlass"]').forEach(r => r.addEventListener('change', aktualisiereFuerAnlass));
  aktualisiereFuerAnlass();

  /* ---------- Daten einsammeln ---------- */
  const sammle = () => {
    const v = n => (form.elements[n]?.value || '').trim();
    const an = n => !!form.elements[n]?.checked;

    return {
      paket: gewaehltesPaket,
      kunde: {
        vorname: v('vorname'), nachname: v('nachname'), strasse: v('strasse'),
        plz: v('plz'), ort: v('ort'), email: v('email'), telefon: v('telefon')
      },
      event: {
        anlass: form.querySelector('[name="anlass"]:checked')?.value || 'Hochzeit',
        datum: v('datum'),
        gaeste: v('gaeste'),
        geburtstagszahl: v('geburtstagszahl'),
        location: v('location'),
        location_adresse: v('location_adresse'),
        aufbau_von: v('aufbau_von'), aufbau_bis: v('aufbau_bis'),
        empfang_von: v('empfang_von'), empfang_bis: v('empfang_bis'),
        party_von: v('party_von'), party_bis: v('party_bis'),
        open_end: an('open_end')
      },
      leistungen: {
        technik_variante: form.querySelector('[name="technik_variante"]:checked')?.value || 'A',
        technik: (form.querySelector('[name="technik_variante"]:checked')?.value || 'A') !== 'keine',
        entertainment: an('entertainment'),
        kinderanimation: an('kinderanimation'),
        fotobox_variante: an('fotobox_deluxe') ? 'deluxe' : an('fotobox_standard') ? 'standard' : 'keine',
        fotobox: an('fotobox_standard') || an('fotobox_deluxe'),
        remix: an('remix'),
        eroeffnungstanz: v('eroeffnungstanz')
      },
      musik: {
        stile: v('stile'), wuensche: v('wuensche'),
        nogos: v('nogos'), anmerkungen: v('anmerkungen')
      }
    };
  };

  /* ---------- Automatische Paket-Empfehlung ----------
     Nur relevant, wenn der Kunde selbst kein Paket gewählt hat — dann
     schauen wir, ob seine Auswahl komplett einem Paket entspräche und das
     günstiger wäre. Wird mit der Anfrage gespeichert, damit Jens im Cockpit
     dieselbe Empfehlung sieht wie der Kunde. */
  const mitEmpfehlung = d => {
    d.paketEmpfehlung = d.paket ? null : pdfHelfer.empfehlePaket(d, CONFIG);
    return d;
  };

  /* ---------- Empfehlungsbox anzeigen ----------
     Live während Schritt 4 (Leistungen) genutzt, damit der Kunde die
     Empfehlung schon während der Eingabe sieht statt erst am Ende. */
  const zeigeEmpfehlung = () => {
    const d = mitEmpfehlung(sammle());
    const empfehlungBox = document.getElementById('empfehlungBox');
    const btn = document.getElementById('empfehlungUebernehmen');
    const emp = d.paketEmpfehlung;

    if (!emp) { empfehlungBox.style.display = 'none'; return; }
    empfehlungBox.style.display = 'block';

    if (!emp.paketId) {
      // Kein Paket passt zu Anlass/Dauer — trotzdem den Preis zeigen.
      document.getElementById('empfehlungTitel').textContent = 'Ihr voraussichtlicher Preis';
      document.getElementById('empfehlungText').textContent =
        `Nach Ihrer bisherigen Auswahl liegt Ihr Angebot bei etwa ${pdfHelfer.euro(emp.ohnePaketPreis)} ` +
        `(Einzelabrechnung nach Zeit und Leistungen — für Anlass und Dauer gibt es aktuell kein passendes Festpreis-Paket). ` +
        `Der genaue Preis steht im Angebotsentwurf, den Jens Ihnen persönlich zusammenstellt.`;
      btn.style.display = 'none';
      return;
    }

    btn.style.display = '';
    document.getElementById('empfehlungTitel').textContent =
      emp.ersparnis > 0 ? `Tipp: Das Paket „${emp.name}“ wäre günstiger`
      : emp.ersparnis < 0 ? `Tipp: Unser Paket „${emp.name}“ könnte zu Ihnen passen`
      : `Tipp: Ihre Auswahl passt genau zum Paket „${emp.name}“`;
    document.getElementById('empfehlungText').textContent =
      emp.ersparnis > 0
        ? `Nach Ihrer Auswahl würden Sie einzeln abgerechnet ${pdfHelfer.euro(emp.ohnePaketPreis)} zahlen. ` +
          `Mit dem Paket „${emp.name}“ zahlen Sie stattdessen ${pdfHelfer.euro(emp.preis)} pauschal — ` +
          `${pdfHelfer.euro(emp.ersparnis)} gespart. Jens prüft das ohnehin nochmal persönlich.`
      : emp.ersparnis < 0
        ? `Für Anlass und Dauer Ihrer Feier gibt es bei uns das Paket „${emp.name}“ zum Festpreis ` +
          `von ${pdfHelfer.euro(emp.preis)} (Ihre bisherige Auswahl läge einzeln bei ${pdfHelfer.euro(emp.ohnePaketPreis)}). ` +
          `Dafür ist im Paket mehr enthalten, z. B. Entertainmentprogramm. Muss nicht passen — nur als Idee.`
        : `Ihre Auswahl entspricht genau unserem Paket „${emp.name}“ (${pdfHelfer.euro(emp.preis)} pauschal) — ` +
          `derselbe Preis, aber als Festpreis ohne Stundenabrechnung. Jens prüft das ohnehin nochmal persönlich.`;
    btn.textContent = `Paket „${emp.name}“ übernehmen`;
    btn.onclick = () => {
      const paketDaten = CONFIG.pakete[emp.paketId];
      gewaehltesPaket = { id: emp.paketId, name: paketDaten.name, preis: paketDaten.preis, enthalten: paketDaten.enthalten };
      empfehlungBox.style.display = 'none';
    };
  };

  /* ---------- Zusammenfassung ---------- */
  // Statt einer einzigen langen Zeilenliste wird die Übersicht in
  // thematische Blöcke gegliedert — leichter zu überfliegen vor dem Absenden.
  const zeigeSummary = () => {
    const d = mitEmpfehlung(sammle());
    const ja = b => b ? 'Ja' : '—';

    // k (Label) ist immer ein eigener String, w kommt direkt aus den
    // Formularfeldern des Nutzers und muss vor der Vorschau escaped werden.
    const zeile = (k, w) => `<div class="summary__row"><dt>${k}</dt><dd>${w ? pdfHelfer.escapeHtml(w) : '—'}</dd></div>`;
    const gruppe = (titel, zeilen) => `
      <div class="summary-gruppe">
        <h4 class="summary-gruppe__titel">${titel}</h4>
        <dl class="summary">${zeilen.map(([k, w]) => zeile(k, w)).join('')}</dl>
      </div>`;

    const kontakt = [
      ['Name', `${d.kunde.vorname} ${d.kunde.nachname}`],
      ['Anschrift', `${d.kunde.strasse}, ${d.kunde.plz} ${d.kunde.ort}`],
      ['Kontakt', [d.kunde.email, d.kunde.telefon].filter(Boolean).join(' · ')]
    ];

    const termin = [
      ['Anlass', d.event.anlass],
      ...(d.event.anlass === 'Geburtstag' && d.event.geburtstagszahl ? [['Wievielter Geburtstag', `${d.event.geburtstagszahl}.`]] : []),
      ['Datum', d.event.datum ? `${pdfHelfer.wochentag(d.event.datum)}, ${pdfHelfer.datumDE(d.event.datum)}` : '—'],
      ['Location', [d.event.location, d.event.location_adresse].filter(Boolean).join(', ')],
      ['Gäste', d.event.gaeste || '—'],
      ['Aufbau', `${d.event.aufbau_von} – ${d.event.aufbau_bis} Uhr`],
      ['Empfang / Dinner', `${d.event.empfang_von} – ${d.event.empfang_bis} Uhr`],
      ['Party', d.event.open_end ? `ab ${d.event.party_von} Uhr, Open End` : `${d.event.party_von} – ${d.event.party_bis} Uhr`]
    ];

    const leistungen = [
      ['Ton- und Lichttechnik', d.leistungen.technik ? `Variante ${d.leistungen.technik_variante}` : 'Eigene Technik vorhanden'],
      ['Entertainmentprogramm', ja(d.leistungen.entertainment)],
      ['Kinderanimation', ja(d.leistungen.kinderanimation)],
      ['Fotobox', d.leistungen.fotobox_variante === 'deluxe' ? 'Deluxe' : d.leistungen.fotobox_variante === 'standard' ? 'Standard' : '—'],
      ['Hochzeitstanz Produktion', ja(d.leistungen.remix)],
      ...(d.event.anlass === 'Hochzeit' ? [['Eröffnungstanz', d.leistungen.eroeffnungstanz || '—']] : [])
    ];

    const musik = [
      ['Musikrichtungen', d.musik.stile || '—'],
      ['Wunschlieder', d.musik.wuensche || '—'],
      ['No-Gos', d.musik.nogos || '—'],
      ['Anmerkungen', d.musik.anmerkungen || '—']
    ];

    summary.innerHTML =
      (d.paket ? `
        <div class="summary-paket">
          <div>
            <p class="summary-paket__name">${pdfHelfer.escapeHtml(d.paket.name)}</p>
            <p class="summary-paket__hinweis">Gewähltes Paket — Pauschalpreis</p>
          </div>
          <p class="summary-paket__preis">${d.paket.preis} €</p>
        </div>` : '') +
      gruppe('Kontakt', kontakt) +
      gruppe('Termin &amp; Location', termin) +
      gruppe('Leistungen', leistungen) +
      gruppe('Musik &amp; Wünsche', musik);

    // Konto-Bereich je nach Anmeldestatus
    if (nutzer) {
      document.getElementById('angemeldetBox').style.display = 'block';
      document.getElementById('angemeldetMail').textContent = nutzer.email;
      document.getElementById('kontoBox').style.display = 'none';
    } else {
      const box = document.getElementById('kontoBox');
      box.style.display = 'block';
      document.getElementById('kontoMail').textContent = d.kunde.email || 'Ihre E-Mail-Adresse';
    }
  };

  /* ---------- Konto-Felder ein- und ausblenden ---------- */
  const kontoWunsch = document.getElementById('kontoWunsch');
  if (kontoWunsch) kontoWunsch.addEventListener('change', () => {
    document.getElementById('kontoFelder').style.display = kontoWunsch.checked ? 'grid' : 'none';
  });

  /* ---------- Konto anlegen, falls gewünscht ---------- */
  const legeKontoAn = async (email) => {
    if (nutzer || !kontoWunsch || !kontoWunsch.checked) return true;

    const pw = document.getElementById('kontoPw').value;
    const pw2 = document.getElementById('kontoPw2').value;
    const fehler = document.getElementById('kontoError');
    fehler.textContent = '';

    if (pw.length < 8) { fehler.textContent = 'Das Passwort braucht mindestens 8 Zeichen.'; return false; }
    if (pw !== pw2)    { fehler.textContent = 'Die beiden Passwörter stimmen nicht überein.'; return false; }

    try {
      await DB.registrieren(email, pw);
      nutzer = await DB.aktuellerNutzer();
      return true;
    } catch (e) {
      fehler.textContent = e.message + ' Sie können auch ohne Konto absenden – Haken einfach entfernen.';
      return false;
    }
  };

  /* ---------- Absenden ---------- */
  const senden = async () => {
    if (!document.getElementById('consent').checked) {
      alert('Bitte bestätigen Sie die Einwilligung zur Verarbeitung Ihrer Angaben.');
      return;
    }
    const daten = mitEmpfehlung(sammle());

    weiter.disabled = true;
    weiter.textContent = 'Wird gesendet …';

    // Zuerst das Konto anlegen, damit die Anfrage direkt zugeordnet wird
    if (!await legeKontoAn(daten.kunde.email)) {
      weiter.disabled = false;
      weiter.textContent = 'Anfrage senden';
      return;
    }

    try {
      await DB.speichereAnfrage(daten);
      form.style.display = 'none';
      navBtns.style.display = 'none';
      document.querySelector('.progress').style.display = 'none';

      if (nutzer) {
        document.getElementById('doneText').innerHTML =
          'Ihre Angaben sind bei uns eingegangen und Ihrem Konto zugeordnet. Jens Winter prüft ' +
          'Ihr Angebot persönlich und gibt es anschließend frei.<br><br>' +
          '<a href="kundenbereich.html" class="btn btn--gold">Zu meinem Bereich</a>';
      }

      fertig.classList.add('is-active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      alert('Das Senden hat nicht geklappt: ' + e.message + '\nBitte melden Sie sich telefonisch unter 0176 – 77 444 888.');
      weiter.disabled = false;
      weiter.textContent = 'Anfrage senden';
    }
  };

  /* ---------- Navigation ---------- */
  weiter.addEventListener('click', () => {
    if (!pruefe(aktuell)) return;
    if (aktuell === schritte.length - 1) return senden();
    do { aktuell++; } while (uebersprungen.has(aktuell) && aktuell < schritte.length - 1);
    if (aktuell === schritte.length - 1) zeigeSummary();
    zeige(aktuell);
  });

  zurueck.addEventListener('click', () => {
    if (aktuell === 0) return;
    do { aktuell--; } while (uebersprungen.has(aktuell) && aktuell > 0);
    zeige(aktuell);
  });

  form.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      weiter.click();
    }
  });

  /* ---------- Die beiden Fotoboxen schließen sich gegenseitig aus ---------- */
  const fotoStd = form.elements['fotobox_standard'], fotoDlx = form.elements['fotobox_deluxe'];
  if (fotoStd && fotoDlx) {
    fotoStd.addEventListener('change', () => { if (fotoStd.checked) fotoDlx.checked = false; });
    fotoDlx.addEventListener('change', () => { if (fotoDlx.checked) fotoStd.checked = false; });
  }

  /* ---------- Empfehlung live aktualisieren, während der Kunde bei
     "Leistungen" etwas ändert (Technik, Entertainment, Fotobox ...) ---------- */
  ['technik_variante', 'entertainment', 'kinderanimation', 'fotobox_standard', 'fotobox_deluxe', 'remix']
    .forEach(name => {
      form.querySelectorAll(`[name="${name}"]`).forEach(feld =>
        feld.addEventListener('change', () => {
          if (schritte[aktuell]?.dataset.name === 'Leistungen') zeigeEmpfehlung();
        }));
    });

  /* ---------- Vorbelegung aus der Paketwahl ----------
     Ein Klick auf ein Paket der Startseite führt direkt zu den passenden
     Fragen: Anlass und Leistungen sind vorausgewählt, Unpassendes wird
     übersprungen. Ohne Paket bleibt der volle Fragebogen. */
  const params = new URLSearchParams(location.search);

  const setzeRadio = (name, wert) => {
    const r = form.querySelector(`[name="${name}"][value="${wert}"]`);
    if (r) r.checked = true;
  };
  const setzeHaken = (name, wert) => { if (form.elements[name]) form.elements[name].checked = wert; };

  /* Vorbelegung je Paket; Name und Preis kommen aus CONFIG.pakete,
     damit Startseite, Angebot und Cockpit dieselben Zahlen nutzen. */
  /* "Geburtstag & Feier" beschreibt einen Leistungsumfang (5 Std., Technik A,
     ohne Extras) — keinen bestimmten Anlass. Wer z. B. eine kleinere Hochzeit
     plant, aber genau dieses Paket möchte, soll trotzdem "Hochzeit" angeben
     können, ohne dass wir ihm einen falschen Anlass vorgeben. Nur bei den
     Paketen, die "Hochzeit" schon im Namen tragen, macht eine Vorauswahl Sinn. */
  const VORBELEGUNG = {
    'geburtstag':        { technik: 'A',     entertainment: false, open_end: false, remix: false },
    'hochzeit-komplett': { anlass: 'Hochzeit', technik: 'A',     entertainment: true,  open_end: false, remix: false },
    'hochzeit-deluxe':   { anlass: 'Hochzeit', technik: 'A',     entertainment: true,  open_end: true,  remix: false },
    'hochzeitstanz':     { anlass: 'Hochzeit', technik: 'keine', entertainment: false, open_end: false, remix: true, ohneZeiten: true }
  };

  const paketId = params.get('paket');
  const vor = VORBELEGUNG[paketId];
  const paketDaten = CONFIG.pakete?.[paketId];

  if (vor && paketDaten) {
    gewaehltesPaket = { id: paketId, name: paketDaten.name, preis: paketDaten.preis, enthalten: paketDaten.enthalten };

    if (vor.anlass) setzeRadio('anlass', vor.anlass);
    setzeRadio('technik_variante', vor.technik);
    setzeHaken('entertainment', vor.entertainment);
    setzeHaken('open_end', vor.open_end);
    setzeHaken('remix', vor.remix);

    if (vor.ohneZeiten) {
      // Für die reine Tanz-Produktion braucht es keine Auf- und Spielzeiten.
      const zeitenIndex = schritte.findIndex(s => s.dataset.name === 'Zeiten');
      if (zeitenIndex > -1) uebersprungen.add(zeitenIndex);
    }

    const hinweis = document.getElementById('paketHinweis');
    if (hinweis) {
      hinweis.style.display = '';
      hinweis.textContent = vor.anlass
        ? `Ihr gewähltes Paket: ${paketDaten.name} (${paketDaten.preis} € pauschal) — die passenden Leistungen sind bereits vorausgewählt, Sie können alles noch anpassen.`
        : `Ihr gewähltes Paket: ${paketDaten.name} (${paketDaten.preis} € pauschal) — passt zu jedem Anlass. Bitte unten kurz den richtigen Anlass auswählen, alles andere ist schon vorausgewählt.`;
    }
  } else {
    // Ältere Links mit ?anlass=…&open_end=1 funktionieren weiterhin.
    const anlassWahl = params.get('anlass');
    if (anlassWahl) setzeRadio('anlass', anlassWahl);
    if (params.get('open_end') === '1') setzeHaken('open_end', true);
  }
  aktualisiereFuerAnlass();

  /* ---------- Angemeldeten Nutzer erkennen und Felder vorbelegen ---------- */
  DB.aktuellerNutzer().then(async u => {
    if (!u) return;
    nutzer = u;
    const mail = form.elements['email'];
    if (mail && !mail.value) mail.value = u.email || '';

    /* Für Entwickler: alle noch leeren Felder mit Testdaten füllen, damit
       sich der komplette Fragebogen ohne eigene Eingaben durchklicken lässt.
       Bereits gesetzte Werte (z. B. aus der Paketwahl) bleiben unangetastet. */
    if (await DB.istEntwickler().catch(() => false)) {
      const setzeLeeres = (name, wert) => {
        const feld = form.elements[name];
        if (feld && !feld.value) feld.value = wert;
      };
      const inZukunft = tage => {
        const d = new Date(); d.setDate(d.getDate() + tage);
        return d.toISOString().slice(0, 10);
      };

      setzeLeeres('vorname', 'Test');
      setzeLeeres('nachname', 'Entwickler');
      setzeLeeres('strasse', 'Teststraße 1');
      setzeLeeres('plz', '09113');
      setzeLeeres('ort', 'Chemnitz');
      if (!form.elements['email'].value) form.elements['email'].value = 'test@entwicklung.local';
      setzeLeeres('telefon', '0176 00000000');
      setzeLeeres('datum', inZukunft(60));
      setzeLeeres('gaeste', '50');
      setzeLeeres('geburtstagszahl', '30');
      setzeLeeres('location', 'Testlocation');
      setzeLeeres('location_adresse', 'Musterweg 1, 09113 Chemnitz');
      setzeLeeres('eroeffnungstanz', 'Testlied');
      setzeLeeres('stile', 'Charts, 80er');
      setzeLeeres('wuensche', 'Testwunsch');
      setzeLeeres('nogos', '—');
      setzeLeeres('anmerkungen', 'Automatisch ausgefüllte Testdaten (Entwickler-Modus).');
      if (form.elements['consent'] && !form.elements['consent'].checked) form.elements['consent'].checked = true;
      if (datum) datum.dispatchEvent(new Event('change'));

      const testHinweis = document.createElement('p');
      testHinweis.className = 'f__hint';
      testHinweis.style.cssText = 'margin-top:14px;color:var(--gold-deep,#8a6d14)';
      testHinweis.textContent = 'Entwickler-Testmodus: Felder wurden automatisch mit Testdaten gefüllt — einfach durchklicken.';
      document.getElementById('paketHinweis')?.insertAdjacentElement('afterend', testHinweis);
    }
  }).catch(() => {});

  zeige(0);
});
