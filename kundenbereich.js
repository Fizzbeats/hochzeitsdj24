/* =====================================================
   HochzeitsDJ24 — Kundenbereich
   Anmelden, Konto anlegen, Vertrag abrufen.
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  const $ = id => document.getElementById(id);
  let anfrage = null;

  if (!DB.konfiguriert()) {
    $('demoHint').textContent =
      'Demo-Modus: Konten und Anfragen liegen nur in diesem Browser. Legen Sie einfach ein Konto an, um den Ablauf zu testen.';
  }

  /* ---------- Umschalter Anmelden / Registrieren ---------- */
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('is-active'));
      document.querySelectorAll('.tabpane').forEach(p => p.classList.remove('is-active'));
      tab.classList.add('is-active');
      $('pane-' + tab.dataset.tab).classList.add('is-active');
    });
  });

  /* ---------- Anmelden ----------
     Echtes <form>-Submit statt reinem Button-Klick, damit der Browser die
     Zugangsdaten anbietet zu speichern (wichtig, wenn sich mehrere Personen,
     z. B. Kunde und Eltern, von ihren eigenen Geräten aus anmelden). */
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('loginError').textContent = '';
    const mail = $('loginMail').value.trim(), pw = $('loginPw').value;
    if (!mail || !pw) { $('loginError').textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
    try {
      await DB.anmelden(mail, pw);
      location.reload();
    } catch (e) {
      $('loginError').textContent = e.message;
    }
  });

  /* ---------- Konto anlegen ---------- */
  $('registerForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('regError').textContent = '';
    const mail = $('regMail').value.trim();
    const pw = $('regPw').value, pw2 = $('regPw2').value;

    if (!mail.includes('@'))   { $('regError').textContent = 'Bitte eine gültige E-Mail-Adresse eingeben.'; return; }
    if (pw.length < 8)         { $('regError').textContent = 'Das Passwort braucht mindestens 8 Zeichen.'; return; }
    if (pw !== pw2)            { $('regError').textContent = 'Die beiden Passwörter stimmen nicht überein.'; return; }

    $('regBtn').disabled = true;
    $('regBtn').textContent = 'Wird angelegt …';

    try {
      await DB.registrieren(mail, pw);
      if (DB.konfiguriert()) {
        $('regError').style.color = 'var(--gold-deep)';
        $('regError').textContent =
          'Konto angelegt. Bitte bestätigen Sie die E-Mail, die wir Ihnen geschickt haben, und melden Sie sich anschließend an.';
        $('regBtn').textContent = 'Konto angelegt';
      } else {
        location.reload();
      }
    } catch (e) {
      $('regError').textContent = e.message;
      $('regBtn').disabled = false;
      $('regBtn').textContent = 'Konto anlegen';
    }
  });

  DB.aktuellerNutzer().then(u => { if (u) start(); });
  $('ladeFehlerRetry')?.addEventListener('click', start);

  /* ---------- Angebot laden ---------- */
  async function start() {
    $('ladeFehlerBereich').style.display = 'none';
    let alle;
    try {
      // Entwickler werden hier bewusst NICHT mehr automatisch weggeleitet —
      // sie sollen über den Header-Schnelllink gezielt herkommen können, um
      // den Kundenbereich zu testen, ohne sofort rausgeworfen zu werden.
      if (await DB.istVerwalter() && !(await DB.istEntwickler())) {
        location.href = 'admin.html';
        return;
      }
      alle = await DB.ladeAnfragen(true);
    } catch (e) {
      // Ohne Daten lieber eine klare Fehlermeldung mit Wiederholen-Knopf,
      // statt dass die Anmeldemaske einfach kommentarlos stehen bleibt.
      $('auth').style.display = 'none';
      $('panel').style.display = 'none';
      $('ladeFehlerBereich').style.display = 'block';
      $('ladeFehlerText').textContent =
        'Das hat nicht geklappt: ' + e.message + ' Bitte prüfen Sie Ihre Internetverbindung.';
      return;
    }

    anfrage = alle[0] || null;

    if (!anfrage) {
      // Noch keine Anfrage: zur normalen Startseite statt direkt in den
      // Vertragsfragebogen zu schicken. Der Header zeigt dort "Abmelden".
      location.href = 'index.html';
      return;
    }

    $('auth').style.display = 'none';
    $('panel').style.display = 'block';

    const d = anfrage.daten || {}, e = d.event || {}, k = d.kunde || {};
    $('titel').textContent = `${e.anlass || 'Feier'} am ${e.datum ? pdfHelfer.datumDE(e.datum) : ''}`;

    // Chat mit dem DJ steht unabhängig vom Freigabe-Status zur Verfügung,
    // damit Rückfragen auch schon während der Prüfung möglich sind.
    zeigeChat();
    aktualisiereSteps();

    if (anfrage.status !== 'freigegeben') {
      $('wartet').style.display = 'block';
      $('statusTag').textContent = 'In Prüfung';
      $('statusTag').className = 'tag';
      return;
    }

    $('vertragBereich').style.display = 'block';

    // w kann Freitext aus dem ursprünglichen Angebotsformular sein — escapen,
    // bevor es ungeprüft im eigenen Browser der Kundin/des Kunden landet.
    const zeile = (t, w) => `<div class="summary__row"><dt>${t}</dt><dd>${w ? pdfHelfer.escapeHtml(w) : '—'}</dd></div>`;
    $('summary').innerHTML =
      (d.paket ? `
        <div class="summary-paket">
          <div>
            <p class="summary-paket__name">${pdfHelfer.escapeHtml(d.paket.name)}</p>
            <p class="summary-paket__hinweis">Gebuchtes Paket — Pauschalpreis</p>
          </div>
          <p class="summary-paket__preis">${d.paket.preis} €</p>
        </div>` : '') +
      zeile('Name', `${k.vorname || ''} ${k.nachname || ''}`) +
      zeile('Anschrift', `${k.strasse || ''}, ${k.plz || ''} ${k.ort || ''}`) +
      zeile('Anlass', e.anlass) +
      zeile('Datum', e.datum ? `${pdfHelfer.wochentag(e.datum)}, ${pdfHelfer.datumDE(e.datum)}` : '') +
      zeile('Location', [e.location, e.location_adresse].filter(Boolean).join(', ')) +
      zeile('Aufbau', `${e.aufbau_von || ''} – ${e.aufbau_bis || ''} Uhr`) +
      zeile('Empfang / Dinner', `${e.empfang_von || ''} – ${e.empfang_bis || ''} Uhr`) +
      zeile('Party', e.open_end ? `ab ${e.party_von} Uhr, Open End` : `${e.party_von || ''} – ${e.party_bis || ''} Uhr`);

    zeigeRechnung();
    zeigeAnnahmeBereich();
  }

  /* ---------- Fortschrittsanzeige ---------- */
  function aktualisiereSteps() {
    const erreicht = anfrage.angenommen ? 'angenommen'
      : anfrage.status === 'freigegeben' ? 'freigegeben' : 'pruefung';
    const reihenfolge = ['angefragt', 'pruefung', 'freigegeben', 'angenommen'];
    const idx = reihenfolge.indexOf(erreicht);
    document.querySelectorAll('#kbSteps .kb-steps__item').forEach((li, i) => {
      li.classList.toggle('is-done', i < idx || (i === idx && erreicht === 'angenommen'));
      li.classList.toggle('is-aktiv', i === idx && erreicht !== 'angenommen');
    });
  }

  /* ---------- Zusage / Feedback-Chat ---------- */
  function zeigeAnnahmeBereich() {
    if (anfrage.angenommen) {
      $('annahmeKarte').style.display = 'none';
      $('angenommenKarte').style.display = 'block';
      $('angenommenText').textContent =
        `Sie haben das Angebot am ${new Date(anfrage.angenommen).toLocaleDateString('de-DE')} angenommen. ` +
        'Wir freuen uns auf Ihre Feier!';
    } else {
      $('annahmeKarte').style.display = 'block';
      $('angenommenKarte').style.display = 'none';
    }
    zeigeChat();
  }

  function zeigeChat() {
    const chat = DB.chatVon(anfrage);
    $('chatVerlauf').innerHTML = chat.length
      ? chat.map(n => `
          <div class="chat__nachricht ${n.von === 'kunde' ? 'chat__nachricht--ich' : ''}">
            <span class="chat__von">${n.von === 'kunde' ? 'Sie' : 'Jens (DJ)'}</span>
            <p>${(n.text || '').replace(/</g, '&lt;')}</p>
            ${n.zeit ? `<span class="chat__zeit">${new Date(n.zeit).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>` : ''}
          </div>`).join('')
      : '<p class="chat__leer">Noch keine Nachrichten — schreiben Sie uns einfach.</p>';
    $('chatVerlauf').scrollTop = $('chatVerlauf').scrollHeight;
  }

  $('chatSenden').addEventListener('click', async () => {
    if (!anfrage) return;
    const text = $('chatText').value.trim();
    if (!text) { $('chatStatus').textContent = 'Bitte kurz schreiben, worum es geht.'; return; }
    $('chatSenden').disabled = true;
    $('chatStatus').textContent = '';
    try {
      await DB.chatSenden(anfrage.id, text);
      anfrage = await DB.ladeAnfrage(anfrage.id) || anfrage;
      $('chatText').value = '';
      $('chatStatus').textContent = 'Gesendet — Jens meldet sich bei Ihnen.';
      zeigeChat();
    } catch (e) {
      $('chatStatus').textContent = 'Das hat nicht geklappt: ' + e.message;
    } finally {
      $('chatSenden').disabled = false;
    }
  });

  $('annehmenBtn').addEventListener('click', async () => {
    if (!anfrage || anfrage.angenommen) return;
    if (!confirm('Angebot verbindlich annehmen?')) return;
    $('annehmenBtn').disabled = true;
    $('annahmeStatus').textContent = '';
    try {
      await DB.angebotAnnehmen(anfrage.id);
      anfrage.angenommen = new Date().toISOString();
      zeigeAnnahmeBereich();
      aktualisiereSteps();
    } catch (e) {
      $('annahmeStatus').textContent = 'Das hat nicht geklappt: ' + e.message;
      $('annehmenBtn').disabled = false;
    }
  });

  /* ---------- Beträge und PDF ---------- */
  const preise = () => anfrage.preise || CONFIG.preise;

  const vertragsdaten = () => {
    const d = anfrage.daten, e = d.event, l = d.leistungen, p = preise();
    const bloecke = [];
    if (e.empfang_von && e.empfang_bis && e.empfang_von !== e.empfang_bis)
      bloecke.push({ datum: e.datum, beginn: e.empfang_von, ende: e.empfang_bis, satz: p.satz_empfang });
    if (e.party_von && e.party_bis)
      bloecke.push({ datum: e.datum, beginn: e.party_von, ende: e.party_bis, satz: p.satz_party });

    return {
      paket: d.paket || null,
      kunde: d.kunde, event: e, bloecke,
      technik: l.technik, technik_variante: l.technik_variante,
      entertainment: l.entertainment, kinderanimation: l.kinderanimation,
      open_end: e.open_end,
      fotobox: l.fotobox, fotobox_variante: l.fotobox_variante,
      remix: l.remix,
      rabatt: p.rabatt || 0,
      remixKorrekturenExtra: p.remix_korrekturen_extra || 0
    };
  };

  function zeigeRechnung() {
    const p = preise();
    const r = berechneVertrag(vertragsdaten(), p);
    const z = (t, w, klasse = '') => `<div class="calc__line ${klasse}"><span>${t}</span><span>${w}</span></div>`;

    $('rechnung').innerHTML =
      z('Summe', pdfHelfer.euro(r.summe)) +
      (r.rabattProzent > 0 ? z(`Rabatt ${r.rabattProzent}%`, '−' + pdfHelfer.euro(r.rabattBetrag)) : '') +
      z('Gesamt (Endpreis)', pdfHelfer.euro(r.gesamt), 'calc__line--total') +
      z(`davon ${p.mwst_satz || 19}% MwSt. enthalten`, pdfHelfer.euro(r.mwst));
  }

  const doc = () => erzeugeVertragsPDF(vertragsdaten(), { anbieter: CONFIG.anbieter, preise: preise() });

  $('download').addEventListener('click', () => {
    const k = anfrage.daten.kunde;
    doc().save(`Angebot_${k.nachname || 'HochzeitsDJ24'}.pdf`);
  });

  $('ansehen').addEventListener('click', () => {
    window.open(doc().output('bloburl'), '_blank');
  });

});
