/* =====================================================
   HochzeitsDJ24 — Entwicklung
   Nur für eingetragene Entwickler-Zugänge zugänglich.
   Prüft bei jedem Aufruf live gegen Datenbank und Dateien,
   was steht, was fehlt — und erzeugt automatische Vorschläge.
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {
  DB.aktuellerNutzer().then(async nutzer => {
    if (!nutzer) { location.href = 'kundenbereich.html'; return; }
    if (!(await DB.istEntwickler())) {
      location.href = (await DB.istVerwalter()) ? 'admin.html' : 'kundenbereich.html';
      return;
    }
    liveChecks();
    // Live-Nachprüfung, solange die Seite offen bleibt — wie im DJ-Cockpit,
    // damit sich z. B. die Anzahl unbearbeiteter Anfragen von selbst aktualisiert.
    setInterval(liveChecks, 60000);
  });

  const $ = id => document.getElementById(id);

  /* ---------- Eigene Notizen & ausgeblendete Vorschläge ----------
     Nur in diesem Browser gespeichert (localStorage) — reicht für eine
     persönliche Entwickler-Checkliste, die du selbst von einem Gerät aus
     pflegst. Ausgeblendete automatische Vorschläge bleiben dauerhaft
     verborgen (per ID, nicht per Text, da sich Texte mit Live-Werten
     ändern können), eigene Notizen werden beim Entfernen ganz gelöscht. */
  const NOTIZEN_KEY = 'hdj24_entw_notizen';
  const AUSGEBLENDET_KEY = 'hdj24_entw_ausgeblendet';

  const leseJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const leseNotizen = () => leseJson(NOTIZEN_KEY, []);
  const schreibeNotizen = n => localStorage.setItem(NOTIZEN_KEY, JSON.stringify(n));
  const leseAusgeblendet = () => leseJson(AUSGEBLENDET_KEY, []);
  const schreibeAusgeblendet = a => localStorage.setItem(AUSGEBLENDET_KEY, JSON.stringify(a));

  $('notizForm').addEventListener('submit', e => {
    e.preventDefault();
    const feld = $('notizEingabe');
    const text = feld.value.trim();
    if (!text) return;
    const notizen = leseNotizen();
    notizen.push({ id: 'notiz-' + Date.now(), text });
    schreibeNotizen(notizen);
    feld.value = '';
    liveChecks();
  });

  $('vorschlagListe').addEventListener('click', e => {
    const btn = e.target.closest('.vorschlag__x');
    if (!btn) return;
    if (btn.dataset.notiz) {
      schreibeNotizen(leseNotizen().filter(n => n.id !== btn.dataset.notiz));
    } else if (btn.dataset.ausblenden) {
      const ausgeblendet = leseAusgeblendet();
      if (!ausgeblendet.includes(btn.dataset.ausblenden)) ausgeblendet.push(btn.dataset.ausblenden);
      schreibeAusgeblendet(ausgeblendet);
    }
    liveChecks();
  });

  $('wiederEinblenden').addEventListener('click', () => {
    schreibeAusgeblendet([]);
    liveChecks();
  });

  /* ---------- FAQ bearbeiten ----------
     Landet direkt in der Datenbank und erscheint beim nächsten Laden der
     Startseite live dort — keine zweite Textquelle, kein Deploy nötig. */

  async function ladeFaqEditor() {
    const container = $('faqListeEntw');
    let eintraege;
    try {
      eintraege = await DB.faqLaden();
    } catch (e) {
      container.innerHTML = `<p class="live-hinweis">Konnte nicht geladen werden: ${e.message}</p>`;
      return;
    }
    if (!eintraege || !eintraege.length) {
      container.innerHTML = '<p class="live-hinweis">Noch keine Fragen in der Datenbank — unten eine hinzufügen.</p>';
      return;
    }

    container.innerHTML = eintraege.map((f, i) => `
      <div class="faq-karte" data-id="${f.id}">
        <label>Frage</label>
        <input class="faq-frage" value="${f.frage.replace(/"/g, '&quot;')}">
        <label>Antwort</label>
        <textarea class="faq-antwort">${f.antwort.replace(/</g, '&lt;')}</textarea>
        <div class="faq-karte__zeile">
          <button type="button" class="btn btn--line faq-speichern">Speichern</button>
          <span class="faq-karte__status"></span>
          <button type="button" class="faq-karte__loeschen">Löschen</button>
        </div>
      </div>`).join('');
  }

  $('faqListeEntw').addEventListener('click', async e => {
    const karte = e.target.closest('.faq-karte');
    if (!karte) return;
    const faqId = karte.dataset.id;
    const status = karte.querySelector('.faq-karte__status');

    if (e.target.classList.contains('faq-speichern')) {
      status.textContent = 'Speichert …';
      try {
        await DB.faqSpeichern(faqId, {
          frage: karte.querySelector('.faq-frage').value.trim(),
          antwort: karte.querySelector('.faq-antwort').value.trim()
        });
        status.textContent = 'Gespeichert ✓';
        setTimeout(() => { if (status.textContent === 'Gespeichert ✓') status.textContent = ''; }, 2500);
      } catch (err) {
        status.textContent = 'Fehler: ' + err.message;
      }
    }

    if (e.target.classList.contains('faq-karte__loeschen')) {
      if (!confirm('Diese Frage wirklich von der Startseite entfernen?')) return;
      try {
        await DB.faqLoeschen(faqId);
        karte.remove();
      } catch (err) {
        status.textContent = 'Fehler: ' + err.message;
      }
    }
  });

  $('faqNeuForm').addEventListener('submit', async e => {
    e.preventDefault();
    const frageFeld = $('faqNeuFrage'), antwortFeld = $('faqNeuAntwort'), status = $('faqNeuStatus');
    const frage = frageFeld.value.trim(), antwort = antwortFeld.value.trim();
    if (!frage || !antwort) return;
    status.textContent = 'Wird hinzugefügt …';
    try {
      const anzahl = $('faqListeEntw').querySelectorAll('.faq-karte').length;
      await DB.faqErstellen(frage, antwort, anzahl);
      frageFeld.value = '';
      antwortFeld.value = '';
      status.textContent = '';
      await ladeFaqEditor();
    } catch (err) {
      status.textContent = 'Fehler: ' + err.message;
    }
  });

  ladeFaqEditor();

  /* ---------- Kundenzitate bearbeiten ---------- */

  async function ladeZitateEditor() {
    const container = $('zitateListeEntw');
    let zitate;
    try {
      zitate = await DB.zitateLaden();
    } catch (e) {
      container.innerHTML = `<p class="live-hinweis">Konnte nicht geladen werden: ${e.message}</p>`;
      return;
    }
    if (!zitate || !zitate.length) {
      container.innerHTML = '<p class="live-hinweis">Noch keine Zitate in der Datenbank — unten eins hinzufügen.</p>';
      return;
    }
    container.innerHTML = zitate.map(z => `
      <div class="faq-karte" data-id="${z.id}">
        <label>Zitat</label>
        <textarea class="zitat-text">${z.text.replace(/</g, '&lt;')}</textarea>
        <label>Name (und optional Ort)</label>
        <input class="zitat-name" value="${z.name.replace(/"/g, '&quot;')}">
        <div class="faq-karte__zeile">
          <button type="button" class="btn btn--line zitat-speichern">Speichern</button>
          <span class="faq-karte__status"></span>
          <button type="button" class="faq-karte__loeschen">Löschen</button>
        </div>
      </div>`).join('');
  }

  $('zitateListeEntw').addEventListener('click', async e => {
    const karte = e.target.closest('.faq-karte');
    if (!karte) return;
    const zId = karte.dataset.id;
    const status = karte.querySelector('.faq-karte__status');

    if (e.target.classList.contains('zitat-speichern')) {
      status.textContent = 'Speichert …';
      try {
        await DB.zitateSpeichern(zId, {
          text: karte.querySelector('.zitat-text').value.trim(),
          name: karte.querySelector('.zitat-name').value.trim()
        });
        status.textContent = 'Gespeichert ✓';
        setTimeout(() => { if (status.textContent === 'Gespeichert ✓') status.textContent = ''; }, 2500);
      } catch (err) {
        status.textContent = 'Fehler: ' + err.message;
      }
    }

    if (e.target.classList.contains('faq-karte__loeschen')) {
      if (!confirm('Dieses Zitat wirklich von der Startseite entfernen?')) return;
      try {
        await DB.zitateLoeschen(zId);
        karte.remove();
      } catch (err) {
        status.textContent = 'Fehler: ' + err.message;
      }
    }
  });

  $('zitatNeuForm').addEventListener('submit', async e => {
    e.preventDefault();
    const textFeld = $('zitatNeuText'), nameFeld = $('zitatNeuName'), status = $('zitatNeuStatus');
    const text = textFeld.value.trim(), name = nameFeld.value.trim();
    if (!text || !name) return;
    status.textContent = 'Wird hinzugefügt …';
    try {
      const anzahl = $('zitateListeEntw').querySelectorAll('.faq-karte').length;
      await DB.zitateErstellen(text, name, anzahl);
      textFeld.value = '';
      nameFeld.value = '';
      status.textContent = '';
      await ladeZitateEditor();
    } catch (err) {
      status.textContent = 'Fehler: ' + err.message;
    }
  });

  ladeZitateEditor();

  /* ---------- Leistungs-Texte bearbeiten ----------
     Immer genau drei (an die feste Startseiten-Struktur gebunden) — darum
     hier kein Hinzufügen/Löschen, nur Bearbeiten der drei vorhandenen. */

  async function ladeLeistungenEditor() {
    const container = $('leistungenListeEntw');
    let leistungen;
    try {
      leistungen = await DB.leistungenLaden();
    } catch (e) {
      container.innerHTML = `<p class="live-hinweis">Konnte nicht geladen werden: ${e.message}</p>`;
      return;
    }
    if (!leistungen || !leistungen.length) {
      container.innerHTML = '<p class="live-hinweis">Noch keine Leistungs-Texte in der Datenbank.</p>';
      return;
    }
    container.innerHTML = leistungen.map(l => `
      <div class="faq-karte" data-id="${l.id}">
        <label>Titel</label>
        <input class="leistung-titel" value="${l.titel.replace(/"/g, '&quot;')}">
        <label>Beschreibung</label>
        <textarea class="leistung-text">${l.text.replace(/</g, '&lt;')}</textarea>
        <label>Stichpunkte (eine Zeile je Stichpunkt)</label>
        <textarea class="leistung-bullets">${(l.bullets || []).join('\n').replace(/</g, '&lt;')}</textarea>
        <div class="faq-karte__zeile">
          <button type="button" class="btn btn--line leistung-speichern">Speichern</button>
          <span class="faq-karte__status"></span>
        </div>
      </div>`).join('');
  }

  $('leistungenListeEntw').addEventListener('click', async e => {
    if (!e.target.classList.contains('leistung-speichern')) return;
    const karte = e.target.closest('.faq-karte');
    const lId = karte.dataset.id;
    const status = karte.querySelector('.faq-karte__status');
    status.textContent = 'Speichert …';
    try {
      const bullets = karte.querySelector('.leistung-bullets').value
        .split('\n').map(z => z.trim()).filter(Boolean);
      await DB.leistungenSpeichern(lId, {
        titel: karte.querySelector('.leistung-titel').value.trim(),
        text: karte.querySelector('.leistung-text').value.trim(),
        bullets
      });
      status.textContent = 'Gespeichert ✓';
      setTimeout(() => { if (status.textContent === 'Gespeichert ✓') status.textContent = ''; }, 2500);
    } catch (err) {
      status.textContent = 'Fehler: ' + err.message;
    }
  });

  ladeLeistungenEditor();

  /* ---------- Hilfen ---------- */

  const dateiVorhanden = async pfad => {
    try { return (await fetch(pfad, { method: 'HEAD' })).ok; }
    catch { return false; }
  };

  /** Supabase-Client OHNE Anmeldesitzung — testet exakt das, was ein
      anonymer Besucher darf (Anfrage ohne Konto absenden). Einmal pro
      Seitenaufruf erzeugt und mit eigenem storageKey: verhindert, dass
      dieser Testclient mit dem echten Anmelde-Client um dieselbe
      Sitzung konkurriert (mehrere Supabase-Clients auf einer Seite
      können sich sonst gegenseitig die Anmeldesitzung invalidieren). */
  let _anonClient = null;
  const anonClient = () => {
    if (!_anonClient) {
      _anonClient = window.supabase.createClient(
        CONFIG.supabase.url, CONFIG.supabase.anonKey,
        { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'hdj24-entwickler-selbsttest' } }
      );
    }
    return _anonClient;
  };

  /** Testet, ob ein Besucher ohne Konto eine Anfrage anlegen darf — genau
      wie DB.speichereAnfrage es für echte Kunden macht: anonym darf nur
      eingefügt, nicht zurückgelesen werden (sonst lehnt die Zeilensicherheit
      den ganzen Vorgang ab). Die Testzeile wird danach als Verwalter über
      ihre bekannte Kennung wiedergefunden und gelöscht. */
  async function testeAnonymeAnfrage() {
    if (!DB.konfiguriert()) return { ok: false, grund: 'Datenbank nicht konfiguriert' };
    const kennung = 'Entwickler-Selbsttest ' + Date.now();
    try {
      const { error } = await anonClient().from('anfragen').insert({
        status: 'neu',
        daten: { kunde: { vorname: 'Selbsttest' }, event: {}, musik: { anmerkungen: kennung } }
      });
      if (error) return { ok: false, grund: error.message };

      // Aufräumen als Verwalter — läuft über die normale Leseerlaubnis,
      // ist aber kein Teil des eigentlichen Tests mehr.
      const alle = await DB.ladeAnfragen().catch(() => []);
      const meine = alle.find(a => a.daten?.musik?.anmerkungen === kennung);
      if (meine) await DB.loeschen(meine.id).catch(() => {});

      return { ok: true };
    } catch (e) { return { ok: false, grund: e.message }; }
  }

  /** Prüft nur, ob die Chat-Funktion in der Datenbank existiert. */
  async function testeChatFunktion() {
    if (!DB.konfiguriert()) return { ok: false, grund: 'Datenbank nicht konfiguriert' };
    try {
      const { error } = await anonClient().rpc('chat_senden',
        { anfrage_id: '00000000-0000-0000-0000-000000000000', nachricht: 'ping' });
      if (error && /could not find the function/i.test(error.message)) {
        return { ok: false, grund: 'Funktion chat_senden fehlt in der Datenbank' };
      }
      return { ok: true }; // auch "permission denied" heißt: Funktion ist da
    } catch (e) { return { ok: false, grund: e.message }; }
  }

  /* ---------- Live-Checks ---------- */

  async function liveChecks() {
    const erledigt = [];
    const offen = [];
    const vorschlaege = [];

    const online = location.protocol === 'https:' && !/localhost|127\.0\.0\.1/.test(location.hostname);

    /* Datenbank */
    const dbKonfiguriert = DB.konfiguriert();
    if (dbKonfiguriert) erledigt.push('Supabase verbunden — Anfragen landen in der echten Datenbank');
    else offen.push('Supabase in config.js eintragen (läuft aktuell im Demo-Modus)');

    const [anon, chatFn, bildHochzeit, bildEvents] = await Promise.all([
      testeAnonymeAnfrage(),
      testeChatFunktion(),
      dateiVorhanden('bild-hochzeit.jpg'),
      dateiVorhanden('bild-events.jpg')
    ]);

    if (anon.ok) {
      erledigt.push('Angebotsanfrage ohne Konto funktioniert (live getestet)');
    } else if (dbKonfiguriert) {
      offen.push('Anfragen ohne Konto werden von der Datenbank abgelehnt');
      vorschlaege.push({
        id: 'anon-anfrage-blockiert', wichtig: true,
        text: 'Kunden ohne Konto können aktuell keine Anfrage absenden — im Supabase-SQL-Editor die Policy <code>"anfrage anlegen"</code> aus schema.sql ausführen. Gemessene Antwort der Datenbank: „' + (anon.grund || '') + '“'
      });
    }

    if (chatFn.ok) {
      erledigt.push('Feedback-Chat-Funktion in der Datenbank vorhanden');
    } else if (dbKonfiguriert) {
      offen.push('Feedback-Chat: Datenbankfunktion fehlt noch');
      vorschlaege.push({
        id: 'chat-funktion-fehlt', wichtig: true,
        text: 'Den Chat-Block aus <code>schema.sql</code> (Spalte <code>chat</code> + Funktion <code>chat_senden</code>) im Supabase-SQL-Editor ausführen — sonst läuft der Kunden-Chat nur im Demo-Modus.'
      });
    }

    /* Veröffentlichung */
    if (online) erledigt.push('Seite läuft öffentlich über https');
    else {
      offen.push('Seite veröffentlichen und Domain verbinden (läuft gerade lokal)');
      vorschlaege.push({ id: 'nicht-veroeffentlicht', text: 'Cloudflare Pages oder Netlify anbinden (Anleitung in SETUP.md) — erst dann können echte Kunden anfragen.' });
    }

    /* Bilder */
    if (bildHochzeit && bildEvents) erledigt.push('Startseiten-Bilder vorhanden (bild-hochzeit.jpg, bild-events.jpg)');
    else offen.push('Startseiten-Bilder fehlen: ' + [!bildHochzeit && 'bild-hochzeit.jpg', !bildEvents && 'bild-events.jpg'].filter(Boolean).join(', '));
    vorschlaege.push({ id: 'galerie-platzhalter', text: 'Galerie zeigt noch Platzhalterflächen — eigene Aufnahmen von Feiern einsetzen wirkt deutlich überzeugender.' });

    /* Anfragen-Lage (Entwickler ist auch Verwalter und darf alles lesen) */
    try {
      const anfragen = await DB.ladeAnfragen();
      const neue = anfragen.filter(a => a.status === 'neu');
      erledigt.push(`${anfragen.length} Anfrage${anfragen.length === 1 ? '' : 'n'} in der Datenbank, davon ${neue.length} unbearbeitet`);
      const alt = neue.filter(a => (Date.now() - new Date(a.erstellt || a.created_at)) > 3 * 86400000);
      if (alt.length) vorschlaege.push({
        id: 'alte-anfragen', wichtig: true,
        text: `${alt.length} neue Anfrage${alt.length === 1 ? ' wartet' : 'n warten'} seit über 3 Tagen auf Prüfung — die Startseite verspricht eine Antwort binnen zwei Tagen.`
      });
    } catch { /* ohne Rechte einfach überspringen */ }

    /* Statische, aus der Konfiguration abgeleitete Vorschläge */
    if (document.querySelector('link[href*="fonts.googleapis"]')) {
      vorschlaege.push({ id: 'google-fonts', text: 'Schriften werden von Google geladen (IP-Übertragung) — für den Echtbetrieb lokal einbinden, das steht auch so in der Datenschutzerklärung.' });
    }
    if (!document.querySelector('link[rel*="icon"]')) {
      vorschlaege.push({ id: 'kein-favicon', text: 'Es gibt noch kein Favicon — ein kleines „HDJ24“-Zeichen macht die Seite im Browser-Tab wiedererkennbar.' });
    }
    vorschlaege.push({ id: 'email-benachrichtigung', text: 'E-Mail-Benachrichtigung bei neuen Anfragen einrichten (resend.com + Supabase Edge Function, siehe SETUP.md) — sonst muss Jens täglich ins Cockpit schauen.' });
    vorschlaege.push({ id: 'pdf-logo', text: 'PDF-Kopf nutzt einen nachgebauten Rahmen — das echte Winter-Entertainment-Logo als Bilddatei einbinden.' });

    /* Recherche bei vergleichbaren DJ-Websites (dj-acki.de, djsvenwiggermann.de u.a.):
       diese Fragen tauchen dort typischerweise auf, fehlen aber bei uns. Bewusst nicht
       selbst beantwortet in der FAQ — Anzahlung/Storno sind Vertragsbedingungen, die nur
       Jens festlegen kann, nicht die Website eigenständig erfinden darf. */
    vorschlaege.push({
      id: 'faq-anzahlung-storno',
      text: 'FAQ-Lücke im Vergleich zu anderen DJ-Websites: Es fehlt eine Antwort auf „Ist eine Anzahlung nötig?“ und „Was, wenn ich stornieren muss?“ — beides wird bei Kunden häufig nachgefragt. Da das echte Vertragsbedingungen sind, sollte Jens die Antwort vorgeben, bevor sie in die FAQ kommt.'
    });
    vorschlaege.push({
      id: 'faq-vorlauf',
      text: 'FAQ könnte noch „Wie früh sollte ich buchen?“ ergänzen — bei mehreren vergleichbaren Hochzeits-DJ-Websites wird zur Hochsaison ein Vorlauf von 1–1,5 Jahren empfohlen. Nur als Orientierung, die tatsächliche Antwort sollte von Jens kommen.'
    });
    vorschlaege.push({
      id: 'gema-anmeldung', wichtig: true,
      text: 'Thema GEMA-Anmeldung fehlt komplett auf der Seite — bei praktisch allen vergleichbaren DJ-Websites (djcrosscut.de u.a.) wird das in der FAQ beantwortet, da es bei Musik auf Veranstaltungen in Deutschland fast immer relevant ist. Sollte geklärt werden, wer die Anmeldung übernimmt (DJ, Location oder Kunde), bevor eine Antwort dazu ergänzt wird.'
    });

    offen.push('Auftragsverarbeitungsvertrag (DPA) in Supabase abschließen');
    offen.push('Impressum & Datenschutzerklärung juristisch prüfen lassen');

    /* ---------- Ausgabe ---------- */
    $('standZeit').textContent = '· geprüft ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
    $('standErledigt').innerHTML = erledigt.map(t => `<li>${t}</li>`).join('') || '<li>Noch nichts erledigt</li>';
    $('standOffen').innerHTML = offen.map(t => `<li>${t}</li>`).join('') || '<li>Nichts offen — sauber!</li>';

    const ausgeblendet = leseAusgeblendet();
    const sichtbareVorschlaege = vorschlaege.filter(v => !ausgeblendet.includes(v.id));
    const notizen = leseNotizen().map(n => ({ ...n, notiz: true }));
    const eintraege = [...sichtbareVorschlaege.sort((a, b) => (b.wichtig ? 1 : 0) - (a.wichtig ? 1 : 0)), ...notizen];

    $('vorschlagListe').innerHTML = eintraege.length
      ? eintraege.map(v => `
          <li${v.wichtig ? ' class="wichtig"' : v.notiz ? ' class="notiz"' : ''}>
            <span>${v.text}</span>
            <button type="button" class="vorschlag__x" ${v.notiz ? `data-notiz="${v.id}"` : `data-ausblenden="${v.id}"`} aria-label="Entfernen">✕</button>
          </li>`).join('')
      : '<li>Keine offenen Vorschläge — alles ausgeblendet oder erledigt.</li>';

    const fuss = $('vorschlaegeFuss'), einblendenBtn = $('wiederEinblenden');
    if (ausgeblendet.length) {
      fuss.style.display = '';
      einblendenBtn.textContent = ausgeblendet.length === 1
        ? '1 ausgeblendeten Vorschlag wieder einblenden'
        : `${ausgeblendet.length} ausgeblendete Vorschläge wieder einblenden`;
    } else {
      fuss.style.display = 'none';
    }

    /* Status-Pillen oben */
    const pille = (gut, text) => `<span class="status-pille ${gut ? 'gut' : 'offen'}">${text}</span>`;
    $('statusZeile').innerHTML =
      pille(dbKonfiguriert, dbKonfiguriert ? 'Datenbank live (Supabase)' : 'Demo-Modus ohne Datenbank') +
      pille(anon.ok, anon.ok ? 'Anfragen ohne Konto möglich' : 'Anfragen ohne Konto blockiert') +
      pille(chatFn.ok, chatFn.ok ? 'Feedback-Chat bereit' : 'Feedback-Chat fehlt in der DB') +
      pille(online, online ? 'Öffentlich erreichbar' : 'Noch nicht veröffentlicht');
  }
});
