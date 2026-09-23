/* =====================================================
   HochzeitsDJ24 — DJ-Cockpit
   Dashboard, Anfragen, Kalkulation und Freigabe
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  const $ = id => document.getElementById(id);
  const dashboard = $('dashboard'), detail = $('detail');
  let anfragen = [], aktiv = null;

  const euro = b => b.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const MONATE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  // Freitext aus dem öffentlichen, anonym zugänglichen Angebotsformular
  // (Name, Ort, Anmerkungen ...) darf nie ungeprüft ins Cockpit-HTML — sonst
  // könnte jeder Absender Schadcode einschleusen, der im DJ-Login ausgeführt wird.
  const esc = pdfHelfer.escapeHtml;

  if (!DB.konfiguriert()) {
    $('demoHint').textContent = 'Demo-Modus: E-Mail „demo@hochzeitsdj-24.de“, Passwort „demo“. Beispieldaten werden automatisch geladen.';
  }

  /* =====================================================
     Beispieldaten für den Demo-Modus, damit das Cockpit
     direkt gefüllt aussieht. Werden nur einmal angelegt
     und lassen sich normal löschen.
     ===================================================== */
  function demoDatenAnlegen() {
    if (DB.konfiguriert()) return;
    if (localStorage.getItem('hdj24_demo_geladen')) return;
    if (JSON.parse(localStorage.getItem('hdj24_anfragen') || '[]').length) return;

    const heute = new Date();
    const tag = (versatz) => {
      const d = new Date(heute); d.setDate(d.getDate() + versatz);
      return d.toISOString().slice(0, 10);
    };
    const stempel = (versatz) => {
      const d = new Date(heute); d.setDate(d.getDate() + versatz);
      return d.toISOString();
    };
    const basisPreise = { ...CONFIG.preise, rabatt: 0 };

    const eintrag = (id, vorname, nachname, ort, anlass, datum, erstellt, status, extras = {}) => ({
      id, status,
      erstellt: stempel(erstellt),
      kunde_mail: `${vorname.toLowerCase()}@example.de`,
      daten: {
        kunde: { vorname, nachname, strasse: 'Musterweg 1', plz: '09113', ort: 'Chemnitz', email: `${vorname.toLowerCase()}@example.de`, telefon: '0170 1234567' },
        event: { anlass, datum, gaeste: '80', location: ort, location_adresse: '',
                 aufbau_von: '15:00', aufbau_bis: '16:00',
                 empfang_von: '16:00', empfang_bis: '17:00',
                 party_von: '17:00', party_bis: '01:00', open_end: false },
        leistungen: { technik: true, entertainment: true, fotobox: false, remix: false, eroeffnungstanz: '' },
        musik: { stile: 'Charts, 80er, Discofox', wuensche: '', nogos: '', anmerkungen: '' }
      },
      preise: (status === 'freigegeben') ? { ...basisPreise, ...(extras.preise || {}) } : null,
      freigegeben: status === 'freigegeben' ? stempel(erstellt + 2) : null,
      bezahlt: extras.bezahlt || false,
      demo: true
    });

    const daten = [
      eintrag('demo1', 'Lisa', 'Berger', 'Schloss Klaffenbach', 'Hochzeit', tag(18), -12, 'freigegeben'),
      eintrag('demo2', 'Marco', 'Seidel', 'Braugut Hartmannsdorf', 'Hochzeit', tag(39), -20, 'freigegeben'),
      eintrag('demo3', 'Anke', 'Vogel', 'Gasthof Lichtenau', 'Geburtstag', tag(-9), -34, 'freigegeben', { bezahlt: false }),
      eintrag('demo4', 'Firma', 'Hentschel GmbH', 'Stadthalle Chemnitz', 'Firmenevent', tag(-52), -70, 'freigegeben', { bezahlt: true }),
      eintrag('demo5', 'Jana', 'Krause', 'Wasserschloss Klaffenbach', 'Hochzeit', tag(-95), -120, 'freigegeben', { bezahlt: true, preise: { rabatt: 10 } }),
      eintrag('demo6', 'Tobias', 'Franke', 'Scheune Niederwiesa', 'Hochzeit', tag(64), -1, 'neu')
    ];

    localStorage.setItem('hdj24_anfragen', JSON.stringify(daten));
    localStorage.setItem('hdj24_demo_geladen', 'ja');
  }

  /* ---------- Anmeldung ---------- */
  const ladeSchirm = $('ladeSchirm'), ladeText = $('ladeText');

  const ladeschirmWeg = () => {
    ladeSchirm.classList.add('ladeschirm--weg');
    setTimeout(() => ladeSchirm.remove(), 500);
  };

  const zeigeAuth = () => {
    $('auth').style.display = '';
    ladeschirmWeg();
  };

  const zeigePanel = () => {
    $('auth').style.display = 'none';
    $('panel').style.display = 'block';
    demoDatenAnlegen();
    laden();
    window.starteCockpitFuehrung?.();
  };

  // Echtes <form>-Submit statt Button-Klick, damit der Browser anbietet,
  // die Zugangsdaten zu speichern (z. B. auf dem eigenen Gerät des DJs).
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('loginError').textContent = '';
    try {
      await DB.anmelden($('loginMail').value.trim(), $('loginPw').value);
      if (await DB.istEntwickler()) {
        location.href = 'entwicklung.html';
      } else if (await DB.istVerwalter()) {
        location.reload();
      } else {
        $('loginError').textContent = 'Dieser Zugang ist kein DJ-Zugang. Sie werden zu Ihrem Kundenbereich weitergeleitet …';
        setTimeout(() => location.href = 'kundenbereich.html', 1600);
      }
    } catch (e) { $('loginError').textContent = e.message; }
  });

  /* Statt kurz die Anmeldemaske aufblitzen zu lassen, während geprüft wird,
     ob man schon angemeldet ist: erst der Ladeschirm, bei bestehender
     Anmeldung dort auch gleich der persönliche Willkommensgruß. Entwickler
     landen standardmäßig auf ihrer eigenen Seite statt im Geschäfts-Cockpit. */
  (async () => {
    const u = await DB.aktuellerNutzer();
    if (!u) { zeigeAuth(); return; }
    // Nur bei frischer Anmeldung über dieses Formular geht's automatisch nach
    // entwicklung.html (siehe oben) — ist der Entwickler schon angemeldet und
    // navigiert bewusst hierher (z. B. über den Header-Schnelllink), soll er
    // das Cockpit ganz normal zum Testen sehen, ohne rausgeworfen zu werden.
    if (!(await DB.istVerwalter())) { location.href = 'kundenbereich.html'; return; }

    const profil = await DB.profilLesen().catch(() => ({}));
    ladeText.textContent = `Willkommen zurück, ${profil?.name || CONFIG.anbieter.kuenstlername}!`;
    setTimeout(() => { zeigePanel(); ladeschirmWeg(); }, 700);
  })();

  /* ---------- Rechenhilfen ---------- */
  const preiseVon = a => a.preise || CONFIG.preise;

  const vertragsdatenVon = (a, p) => {
    const d = a.daten, e = d.event, l = d.leistungen;
    const bloecke = [];
    if (e.empfang_von && e.empfang_bis && e.empfang_von !== e.empfang_bis)
      bloecke.push({ datum: e.datum, beginn: e.empfang_von, ende: e.empfang_bis, satz: p.satz_empfang });
    if (e.party_von && e.party_bis)
      bloecke.push({ datum: e.datum, beginn: e.party_von, ende: e.party_bis, satz: p.satz_party });
    return { paket: d.paket || null,
             kunde: d.kunde, event: e, bloecke,
             technik: l.technik, technik_variante: l.technik_variante,
             entertainment: l.entertainment, kinderanimation: l.kinderanimation,
             open_end: e.open_end,
             fotobox: l.fotobox, fotobox_variante: l.fotobox_variante,
             remix: l.remix, rabatt: p.rabatt || 0,
             remixKorrekturenExtra: p.remix_korrekturen_extra || 0 };
  };

  const gesamtVon = a => {
    try {
      const p = preiseVon(a);
      return berechneVertrag(vertragsdatenVon(a, p), p).gesamt;
    } catch { return 0; }
  };

  /* =====================================================
     Dashboard
     ===================================================== */
  function dashboardRendern() {
    const heute = new Date(); heute.setHours(0,0,0,0);
    const jahr = heute.getFullYear();

    $('heute').textContent = new Date().toLocaleDateString('de-DE',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Erst mit Kundenzusage zählt ein Angebot als echte Buchung — überall
    // im Dashboard (Einnahmen, Termine, offene Rechnungen).
    const frei = anfragen.filter(a => a.status === 'freigegeben' && a.angenommen);
    const neu = anfragen.filter(a => a.status === 'neu');
    const datumVon = a => a.daten?.event?.datum ? new Date(a.daten.event.datum + 'T12:00:00') : null;

    /* Kennzahlen */
    const dJahr = frei.filter(a => datumVon(a)?.getFullYear() === jahr);
    const umsatzJahr = dJahr.reduce((s, a) => s + gesamtVon(a), 0);
    $('kpiUmsatz').innerHTML = umsatzJahr.toLocaleString('de-DE', {maximumFractionDigits:0}) + ' <em>€</em>';
    $('kpiUmsatzZusatz').textContent = `${dJahr.length} Verträge in ${jahr}, inkl. MwSt.`;

    const offen = frei.filter(a => !a.bezahlt && datumVon(a) && datumVon(a) <= heute);
    const offenSumme = offen.reduce((s, a) => s + gesamtVon(a), 0);
    $('kpiOffen').innerHTML = offen.length + (offen.length ? ` <em>· ${euro(offenSumme)}</em>` : '');
    $('kpiOffenZusatz').innerHTML = offen.length
      ? '<span class="warn">Zahlung ausstehend</span>' : 'Alles bezahlt — sauber.';

    const anstehend = frei.filter(a => datumVon(a) && datumVon(a) >= heute)
                          .sort((x, y) => datumVon(x) - datumVon(y));
    $('kpiTermine').textContent = anstehend.length;
    if (anstehend.length) {
      const tage = Math.round((datumVon(anstehend[0]) - heute) / 86400000);
      $('kpiTermineZusatz').textContent = tage === 0 ? 'Heute geht es los!' : `Nächster in ${tage} Tagen`;
    } else $('kpiTermineZusatz').textContent = 'Aktuell nichts gebucht';

    $('kpiNeu').textContent = neu.length;
    $('kpiNeuZusatz').innerHTML = neu.length
      ? '<strong>Warten auf deine Prüfung</strong>' : 'Alles abgearbeitet';

    /* Dringendster Vorgang: unter den noch nicht geprüften Anfragen die mit
       dem nächstgelegenen Termin — nicht einfach die zuletzt eingegangene.
       Ohne offene Anfragen zeigt die Karte die zuletzt eingegangene. */
    const neuMitTermin = neu.filter(a => datumVon(a)).sort((x, y) => datumVon(x) - datumVon(y));
    const dringendster = neuMitTermin[0] || neu[0] ||
      [...anfragen].sort((x, y) => new Date(y.erstellt || y.created_at) - new Date(x.erstellt || x.created_at))[0];

    if (dringendster) {
      const d = dringendster.daten, k = d.kunde, e = d.event;
      const statusKlasse = dringendster.status === 'freigegeben' ? 'feature__status--frei' : 'feature__status--neu';
      const statusText = dringendster.status === 'freigegeben' ? 'Freigegeben' :
                         dringendster.status === 'geprueft' ? 'In Prüfung' : 'Neu eingegangen';
      const terminDatum = datumVon(dringendster);
      const dringend = dringendster.status !== 'freigegeben' && terminDatum;
      const tageBisTermin = dringend ? Math.round((terminDatum - heute) / 86400000) : null;
      const drittesFeld = dringend
        ? { label: 'Termin', wert: tageBisTermin < 0 ? 'bereits vorbei' : tageBisTermin === 0 ? 'heute!' : `in ${tageBisTermin} Tagen` }
        : { label: 'Eingegangen', wert: new Date(dringendster.erstellt || dringendster.created_at).toLocaleDateString('de-DE') };

      $('featureInhalt').innerHTML = `
        <span class="feature__status ${statusKlasse}">${statusText}</span>
        <p class="feature__name">${esc(k.vorname)} ${esc(k.nachname)}</p>
        <p class="feature__meta">${esc(e.anlass)} · ${e.datum ? pdfHelfer.datumDE(e.datum) : 'Termin offen'} · ${esc(e.location)}</p>
        <div class="feature__zahlen">
          <div class="feature__zahl"><span>Voraussichtlich</span><strong>${euro(gesamtVon(dringendster))}</strong></div>
          <div class="feature__zahl"><span>Gäste</span><strong>${esc(e.gaeste) || '—'}</strong></div>
          <div class="feature__zahl"><span>${drittesFeld.label}</span><strong>${drittesFeld.wert}</strong></div>
        </div>
        <button class="btn btn--gold">Vorgang öffnen</button>`;
      $('featureKarte').onclick = () => oeffne(dringendster.id);
    }

    /* Nächste Veranstaltungen */
    $('termineListe').innerHTML = anstehend.slice(0, 4).map(a => {
      const d = datumVon(a), k = a.daten.kunde, e = a.daten.event;
      return `<li data-id="${a.id}">
        <span class="dliste__datum"><strong>${d.getDate()}</strong><span>${MONATE[d.getMonth()]}</span></span>
        <span class="dliste__text"><strong>${esc(k.vorname)} ${esc(k.nachname)}</strong><span>${esc(e.anlass)} · ${esc(e.location)}</span></span>
        <span class="dliste__wert"><strong>${euro(gesamtVon(a))}</strong><span>${a.bezahlt ? 'bezahlt' : 'offen'}</span></span>
      </li>`;
    }).join('') || '<p class="dliste--leer">Keine anstehenden Termine.</p>';

    /* Offene Rechnungen */
    const alleOffen = frei.filter(a => !a.bezahlt).sort((x, y) => (datumVon(x)||0) - (datumVon(y)||0));
    $('rechnungenListe').innerHTML = alleOffen.slice(0, 4).map(a => {
      const d = datumVon(a), k = a.daten.kunde;
      const vorbei = d && d < heute;
      return `<li data-id="${a.id}">
        <span class="dliste__datum"><strong>${d ? d.getDate() : '–'}</strong><span>${d ? MONATE[d.getMonth()] : ''}</span></span>
        <span class="dliste__text"><strong>${esc(k.vorname)} ${esc(k.nachname)}</strong><span>${esc(a.daten.event.anlass)}</span></span>
        <span class="dliste__wert"><strong>${euro(gesamtVon(a))}</strong><span class="${vorbei ? 'faellig' : ''}">${vorbei ? 'fällig' : 'nach der Feier'}</span></span>
      </li>`;
    }).join('') || '<p class="dliste--leer">Keine offenen Rechnungen. 🎉</p>';

    document.querySelectorAll('.dliste li[data-id]').forEach(li =>
      li.addEventListener('click', () => oeffne(li.dataset.id)));

    /* Umsatzverlauf */
    $('umsatzJahr').textContent = jahr;
    const proMonat = Array(12).fill(0);
    dJahr.forEach(a => { const d = datumVon(a); if (d) proMonat[d.getMonth()] += gesamtVon(a); });
    const max = Math.max(...proMonat, 1);
    $('umsatzSumme').innerHTML = umsatzJahr.toLocaleString('de-DE', {maximumFractionDigits:0}) +
      ' €<small>freigegebene Verträge, inkl. MwSt.</small>';
    $('umsatzBalken').innerHTML = proMonat.map((wert, m) => `
      <div class="umsatz__monat ${wert === 0 ? 'ist-leer' : ''}" title="${MONATE[m]}: ${euro(wert)}">
        <div class="umsatz__balken" style="height:${Math.max(3, wert / max * 100)}%"></div>
        <span class="umsatz__label">${MONATE[m]}</span>
      </div>`).join('');
  }

  /* ---------- Liste ---------- */
  const statusTag = a => {
    if (a.status === 'freigegeben' && a.bezahlt) return '<span class="tag tag--bezahlt">Bezahlt</span>';
    if (a.status === 'freigegeben' && a.angenommen) return '<span class="tag tag--frei">Angenommen</span>';
    if (a.status === 'freigegeben') return '<span class="tag">Wartet auf Kunde</span>';
    if (a.status === 'geprueft') return '<span class="tag">In Prüfung</span>';
    return '<span class="tag tag--neu">Neu</span>';
  };

  async function laden() {
    try {
      anfragen = await DB.ladeAnfragen();
    } catch (e) {
      // Ohne Daten macht das restliche Dashboard keinen Sinn — lieber eine
      // klare Fehlermeldung mit Wiederholen-Knopf als ein leeres Cockpit.
      $('dashboard').style.display = 'none';
      $('ladeFehler').style.display = 'block';
      $('ladeFehlerText').textContent =
        'Das hat nicht geklappt: ' + e.message + ' Bitte prüfe deine Internetverbindung.';
      return;
    }
    $('ladeFehler').style.display = 'none';
    $('dashboard').style.display = '';

    const tbody = $('liste');
    $('leer').style.display = anfragen.length ? 'none' : 'block';

    tbody.innerHTML = anfragen.map(a => {
      const d = a.daten || {}, k = d.kunde || {}, e = d.event || {};
      return `<tr data-id="${a.id}">
        <td data-label="Eingang">${new Date(a.erstellt || a.created_at).toLocaleDateString('de-DE')}</td>
        <td data-label="Kunde">${esc(k.vorname)} ${esc(k.nachname)}</td>
        <td data-label="Anlass">${esc(e.anlass)}</td>
        <td data-label="Termin">${e.datum ? pdfHelfer.datumDE(e.datum) : '—'}</td>
        <td data-label="Betrag">${euro(gesamtVon(a))}</td>
        <td data-label="Status">${statusTag(a)}</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('tr').forEach(tr =>
      tr.addEventListener('click', () => oeffne(tr.dataset.id)));

    dashboardRendern();
  }

  $('reload').addEventListener('click', laden);
  $('tourStart').addEventListener('click', () => {
    detail.classList.remove('is-active');
    dashboard.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.starteCockpitFuehrung?.(true);
  });
  $('ladeFehlerRetry').addEventListener('click', laden);

  /* ---------- Detail ---------- */
  function oeffne(id) {
    aktiv = anfragen.find(a => a.id === id);
    if (!aktiv) return;

    const d = aktiv.daten || {}, k = d.kunde || {}, e = d.event || {}, l = d.leistungen || {}, m = d.musik || {};
    $('detailTitel').textContent = `${k.vorname || ''} ${k.nachname || ''}`.trim();

    const ja = b => b ? 'Ja' : '—';
    // t (Label) ist immer ein eigener String, w (Wert) kann Freitext des
    // Absenders sein — deshalb hier zentral escapen statt an jeder Aufrufstelle.
    const zeile = (t, w) => `<div class="summary__row"><dt>${t}</dt><dd>${w ? esc(w) : '—'}</dd></div>`;

    $('detailSummary').innerHTML =
      (d.paket ? zeile('Gebuchtes Paket', `${d.paket.name} — ${d.paket.preis} € pauschal`) : '') +
      zeile('Anschrift', `${k.strasse || ''}, ${k.plz || ''} ${k.ort || ''}`) +
      zeile('E-Mail', k.email) + zeile('Telefon', k.telefon) +
      zeile('Anlass', e.anlass) +
      (e.anlass === 'Geburtstag' && e.geburtstagszahl ? zeile('Wievielter Geburtstag', `${e.geburtstagszahl}.`) : '') +
      zeile('Datum', e.datum ? `${pdfHelfer.wochentag(e.datum)}, ${pdfHelfer.datumDE(e.datum)}` : '') +
      zeile('Location', [e.location, e.location_adresse].filter(Boolean).join(', ')) +
      zeile('Gäste', e.gaeste) +
      zeile('Aufbau', `${e.aufbau_von || ''} – ${e.aufbau_bis || ''} Uhr`) +
      zeile('Empfang / Dinner', `${e.empfang_von || ''} – ${e.empfang_bis || ''} Uhr`) +
      zeile('Party', e.open_end ? `ab ${e.party_von} Uhr, Open End` : `${e.party_von || ''} – ${e.party_bis || ''} Uhr`) +
      zeile('Technik', l.technik ? `Variante ${l.technik_variante || 'A'}` : 'Eigene Technik') +
      zeile('Programm', ja(l.entertainment)) +
      zeile('Kinderanimation', ja(l.kinderanimation)) +
      zeile('Fotobox', l.fotobox_variante === 'deluxe' ? 'Deluxe' : l.fotobox_variante === 'standard' ? 'Standard' : (l.fotobox ? 'Ja' : '—')) +
      zeile('Hochzeitstanz Produktion', ja(l.remix));

    $('detailMusik').innerHTML =
      zeile('Eröffnungstanz', l.eroeffnungstanz) + zeile('Musikrichtungen', m.stile) +
      zeile('Wunschlieder', m.wuensche) + zeile('No-Gos', m.nogos) + zeile('Anmerkungen', m.anmerkungen);

    const p = aktiv.preise || CONFIG.preise;

    // Kaufmodell: bei Paket-Buchung Pauschalpreis zeigen, Stundensätze treten zurück
    const paket = d.paket || null;
    $('paketInfo').style.display = paket ? '' : 'none';
    $('paketPreisFeld').style.display = paket ? '' : 'none';
    if (paket) {
      $('paketInfoName').textContent = `Paket: ${paket.name}`;
      $('pPaket').value = p.paket_preis ?? paket.preis;
    } else {
      $('pPaket').value = '';
    }

    /* Dieselbe Empfehlung, die der Kunde schon in der Angebotserstellung sah
       (falls er ohne Paket angefragt hat) — damit Kunde und Cockpit nie
       auseinanderlaufen, wird hier dieselbe gespeicherte Empfehlung gezeigt,
       nicht neu berechnet. */
    const empfehlungBox = $('empfehlungHinweis');
    const btnAdmin = $('empfehlungUebernehmenAdmin');
    if (!paket && d.paketEmpfehlung) {
      const emp = d.paketEmpfehlung;
      empfehlungBox.style.display = '';

      if (!emp.paketId) {
        $('empfehlungHinweisText').textContent =
          `Kein Paket passt zu Anlass/Dauer dieser Anfrage — individuelle Berechnung: ${emp.ohnePaketPreis} €.`;
        btnAdmin.style.display = 'none';
        return;
      }
      btnAdmin.style.display = '';

      $('empfehlungHinweisText').textContent =
        emp.ersparnis > 0 ? `Passt zum Paket „${emp.name}“ (${emp.preis} € pauschal) — für den Kunden ${emp.ersparnis} € günstiger als Einzelabrechnung (${emp.ohnePaketPreis} €).`
        : emp.ersparnis < 0 ? `Anlass und Dauer passen zum Paket „${emp.name}“ (${emp.preis} € pauschal) — ${Math.abs(emp.ersparnis)} € mehr als die reine Einzelabrechnung (${emp.ohnePaketPreis} €), dafür z. B. Entertainment inklusive.`
        : `Passt genau zum Paket „${emp.name}“ (${emp.preis} € pauschal) — gleicher Preis wie einzeln (${emp.ohnePaketPreis} €), aber als Festpreis.`;
      btnAdmin.textContent = `Paket „${emp.name}“ übernehmen`;
      btnAdmin.onclick = async () => {
        const paketDaten = CONFIG.pakete[emp.paketId];
        aktiv.daten.paket = { id: emp.paketId, name: paketDaten.name, preis: paketDaten.preis, enthalten: paketDaten.enthalten };
        btnAdmin.disabled = true;
        try {
          await DB.aktualisiere(aktiv.id, { daten: aktiv.daten });
          const i = anfragen.findIndex(a => a.id === aktiv.id);
          if (i > -1) anfragen[i] = aktiv;
          oeffne(aktiv.id);
        } catch (e) {
          alert('Konnte nicht gespeichert werden: ' + e.message);
          btnAdmin.disabled = false;
        }
      };
    } else {
      empfehlungBox.style.display = 'none';
    }

    $('satzEmpfang').value = p.satz_empfang ?? CONFIG.preise.satz_empfang;
    $('satzParty').value = p.satz_party ?? CONFIG.preise.satz_party;

    // Ein Feld je Leistung — vorbelegt mit dem Preis der gewählten Variante
    const technikB = l.technik_variante === 'B';
    $('pTechnikLabel').textContent = `Technik Variante ${technikB ? 'B' : 'A'} (€)`;
    $('pTechnik').value = technikB
      ? (p.technik_b ?? CONFIG.preise.technik_b)
      : (p.technik ?? CONFIG.preise.technik);

    $('pEntertainment').value = p.entertainment ?? CONFIG.preise.entertainment;
    $('pOpenEnd').value = p.open_end ?? CONFIG.preise.open_end;
    $('pKinderanimation').value = p.kinderanimation ?? CONFIG.preise.kinderanimation;

    const fotoDeluxe = l.fotobox_variante === 'deluxe';
    $('pFotoboxLabel').textContent = `Fotobox ${fotoDeluxe ? 'Deluxe' : 'Standard'} (€)`;
    $('pFotobox').value = fotoDeluxe
      ? (p.fotobox_deluxe ?? CONFIG.preise.fotobox_deluxe)
      : (p.fotobox_standard ?? CONFIG.preise.fotobox_standard ?? p.fotobox ?? CONFIG.preise.fotobox);

    $('pRemix').value = p.remix ?? CONFIG.preise.remix;
    $('pRemixKorrektur').value = p.remix_korrektur ?? CONFIG.preise.remix_korrektur;
    $('remixKorrekturenExtra').value = p.remix_korrekturen_extra ?? 0;
    $('rabatt').value = p.rabatt ?? 0;

    $('bezahlt').style.display = aktiv.status === 'freigegeben' && aktiv.angenommen && !aktiv.bezahlt ? 'inline-flex' : 'none';
    $('detailStatus').textContent =
      aktiv.bezahlt ? 'Bezahlt — Vorgang abgeschlossen.' :
      aktiv.status === 'freigegeben' && aktiv.angenommen
        ? 'Angenommen am ' + new Date(aktiv.angenommen).toLocaleDateString('de-DE') + ' — Zahlung offen.'
      : aktiv.status === 'freigegeben'
        ? 'Freigegeben am ' + new Date(aktiv.freigegeben).toLocaleDateString('de-DE') + ' — wartet auf Kundenzusage.'
        : '';

    zeigeChat();
    rechne();
    dashboard.style.display = 'none';
    detail.classList.add('is-active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('zurueckListe').addEventListener('click', () => {
    detail.classList.remove('is-active');
    dashboard.style.display = 'block';
  });

  /* ---------- Feedback-Chat mit dem Kunden ---------- */
  function zeigeChat() {
    const chat = DB.chatVon(aktiv);
    $('chatVerlauf').innerHTML = chat.length
      ? chat.map(n => `
          <div class="chat__nachricht ${n.von === 'dj' ? 'chat__nachricht--ich' : ''}">
            <span class="chat__von">${n.von === 'dj' ? 'Du (DJ)' : 'Kunde'}</span>
            <p>${(n.text || '').replace(/</g, '&lt;')}</p>
            ${n.zeit ? `<span class="chat__zeit">${new Date(n.zeit).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>` : ''}
          </div>`).join('')
      : '<p class="chat__leer">Noch keine Nachrichten vom Kunden.</p>';
    $('chatVerlauf').scrollTop = $('chatVerlauf').scrollHeight;
  }

  $('chatSendenBtn').addEventListener('click', async () => {
    if (!aktiv) return;
    const text = $('chatText').value.trim();
    if (!text) { $('chatStatus').textContent = 'Bitte erst eine Nachricht schreiben.'; return; }
    $('chatSendenBtn').disabled = true;
    $('chatStatus').textContent = '';
    try {
      await DB.chatSenden(aktiv.id, text);
      aktiv = await DB.ladeAnfrage(aktiv.id) || aktiv;
      const i = anfragen.findIndex(a => a.id === aktiv.id);
      if (i > -1) anfragen[i] = aktiv;
      $('chatText').value = '';
      $('chatStatus').textContent = 'Gesendet — der Kunde sieht die Antwort in seinem Bereich.';
      zeigeChat();
    } catch (e) {
      $('chatStatus').textContent = 'Das hat nicht geklappt: ' + e.message;
    } finally {
      $('chatSendenBtn').disabled = false;
    }
  });

  /* ---------- Preise / Berechnung ---------- */
  /* Das Technik- und das Fotobox-Feld gelten immer für die vom Kunden
     gewählte Variante — deshalb werden beide Variantenpreise auf denselben
     Feldwert gesetzt, die Berechnung greift sich den passenden. */
  const preiseAusFormular = () => ({
    paket_preis: $('pPaket').value !== '' ? (parseFloat($('pPaket').value) || 0) : null,
    satz_empfang: parseFloat($('satzEmpfang').value) || 0,
    satz_party: parseFloat($('satzParty').value) || 0,
    technik: parseFloat($('pTechnik').value) || 0,
    technik_b: parseFloat($('pTechnik').value) || 0,
    entertainment: parseFloat($('pEntertainment').value) || 0,
    open_end: parseFloat($('pOpenEnd').value) || 0,
    kinderanimation: parseFloat($('pKinderanimation').value) || 0,
    fotobox: parseFloat($('pFotobox').value) || 0,
    fotobox_standard: parseFloat($('pFotobox').value) || 0,
    fotobox_deluxe: parseFloat($('pFotobox').value) || 0,
    remix: parseFloat($('pRemix').value) || 0,
    remix_korrektur: parseFloat($('pRemixKorrektur').value) || 0,
    remix_korrekturen_extra: parseInt($('remixKorrekturenExtra').value, 10) || 0,
    rabatt: parseFloat($('rabatt').value) || 0,
    mwst_satz: CONFIG.preise.mwst_satz
  });

  function rechne() {
    if (!aktiv) return;
    const p = preiseAusFormular();
    const r = berechneVertrag(vertragsdatenVon(aktiv, p), p);
    const z = (t, w, kl = '') => `<div class="calc__line ${kl}"><span>${t}</span><span>${w}</span></div>`;
    $('rechnung').innerHTML =
      r.zeilen.map(x => z(`${x.beginn} – ${x.ende}`, euro(x.gage))).join('') +
      r.zusatz.map(x => z(x.label.replace(':', ''), euro(x.betrag))).join('') +
      z('Summe', euro(r.summe)) +
      (r.rabattProzent > 0 ? z(`Rabatt ${r.rabattProzent}%`, '−' + euro(r.rabattBetrag)) : '') +
      z('Gesamt (Endpreis)', euro(r.gesamt), 'calc__line--total') +
      z(`davon ${p.mwst_satz}% MwSt. enthalten`, euro(r.mwst));
  }

  ['pPaket','satzEmpfang','satzParty','pTechnik','pEntertainment','pOpenEnd','pKinderanimation','pFotobox','pRemix','pRemixKorrektur','remixKorrekturenExtra','rabatt']
    .forEach(id => $(id).addEventListener('input', rechne));

  /* ---------- PDF, Freigabe, Zahlung, Löschen ---------- */
  const baueConfig = () => ({ anbieter: CONFIG.anbieter, preise: preiseAusFormular() });

  $('vorschau').addEventListener('click', () => {
    if (!aktiv) return;
    const doc = erzeugeVertragsPDF(vertragsdatenVon(aktiv, preiseAusFormular()), baueConfig());
    window.open(doc.output('bloburl'), '_blank');
  });

  $('freigeben').addEventListener('click', async () => {
    if (!aktiv) return;
    if (!confirm('Angebot für den Kunden freigeben?')) return;
    const p = preiseAusFormular();
    await DB.freigeben(aktiv.id, p);
    const doc = erzeugeVertragsPDF(vertragsdatenVon(aktiv, p), baueConfig());
    doc.save(`Angebot_${aktiv.daten.kunde.nachname || 'Kunde'}_${aktiv.daten.event.datum || ''}.pdf`);
    $('detailStatus').textContent = 'Freigegeben — der Kunde kann das Angebot jetzt abrufen.';
    await laden();
    oeffne(aktiv.id);
  });

  $('bezahlt').addEventListener('click', async () => {
    if (!aktiv) return;
    await DB.aktualisiere(aktiv.id, { bezahlt: true });
    await laden();
    oeffne(aktiv.id);
  });

  $('loeschen').addEventListener('click', async () => {
    if (!aktiv) return;
    if (!confirm('Diese Anfrage endgültig löschen?')) return;
    await DB.loeschen(aktiv.id);
    detail.classList.remove('is-active');
    dashboard.style.display = 'block';
    await laden();
  });

});
