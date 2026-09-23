/* =====================================================
   HochzeitsDJ24 — Vertrags-PDF nach Vorlage
   Benötigt jsPDF (wird in der HTML-Seite eingebunden)
   ===================================================== */

/* ---------- Hilfsfunktionen ---------- */

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function wochentag(isoDatum) {
  if (!isoDatum) return '';
  const d = new Date(isoDatum + 'T12:00:00');
  return WOCHENTAGE[d.getDay()];
}

function datumDE(isoDatum) {
  if (!isoDatum) return '';
  const [j, m, t] = isoDatum.split('-');
  return `${t}.${m}.${j}`;
}

function euro(betrag) {
  return betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/* ---------- Automatische Paket-Empfehlung ----------
   Baut aus den Wizard-Rohdaten (event/leistungen) dieselbe Struktur, die
   berechneVertrag() erwartet — zentral hier, damit angebot.js, admin.js und
   kundenbereich.js exakt dieselbe Rechnung verwenden und nie auseinanderlaufen. */
function bloeckeAus(event, preise) {
  const bloecke = [];
  if (event.empfang_von && event.empfang_bis && event.empfang_von !== event.empfang_bis) {
    bloecke.push({ datum: event.datum, beginn: event.empfang_von, ende: event.empfang_bis, satz: preise.satz_empfang });
  }
  if (event.party_von && event.party_bis) {
    bloecke.push({ datum: event.datum, beginn: event.party_von, ende: event.party_bis, satz: preise.satz_party });
  }
  return bloecke;
}

function vertragsdatenAusWizard(daten, preise, paket) {
  const e = daten.event || {}, l = daten.leistungen || {};
  return {
    paket: paket || null,
    kunde: daten.kunde, event: e, bloecke: bloeckeAus(e, preise),
    technik: l.technik, technik_variante: l.technik_variante,
    entertainment: l.entertainment, kinderanimation: l.kinderanimation,
    open_end: e.open_end,
    fotobox: l.fotobox, fotobox_variante: l.fotobox_variante,
    remix: l.remix, rabatt: 0, remixKorrekturenExtra: 0
  };
}

/** Prüft für jedes Paket, ob Anlass und Dauer dazu passen, und empfiehlt
    unter den passenden das günstigste — aber nur, wenn es wirklich günstiger
    ist als die individuelle Abrechnung der tatsächlichen Auswahl. */
function empfehlePaket(daten, config) {
  const e = daten.event || {};
  // Ohne Zeiten lässt sich gar nichts berechnen (kommt praktisch nie vor,
  // da die Zeiten-Felder immer mit Standardwerten vorbelegt sind).
  if (!e.party_von || !e.party_bis) return null;

  const partyStd = stunden(e.party_von, e.party_bis);
  const empfangStd = (e.empfang_von && e.empfang_bis && e.empfang_von !== e.empfang_bis)
    ? stunden(e.empfang_von, e.empfang_bis) : 0;

  // Die individuelle Berechnung wird IMMER gezeigt — auch wenn gerade kein
  // Paket zu Anlass/Dauer passt (z. B. Firmenevent oder eine sehr lange Party).
  const ohnePaket = berechneVertrag(vertragsdatenAusWizard(daten, config.preise, null), config.preise);

  let beste = null;
  for (const [id, p] of Object.entries(config.pakete)) {
    if (id === 'hochzeitstanz') continue; // Zusatzprodukt, kein Ersatz für die ganze Feier
    if (p.anlaesse && !p.anlaesse.includes(e.anlass)) continue;
    if (partyStd > (p.partyStundenMax ?? 0)) continue;
    if (empfangStd > (p.empfangStundenMax ?? 0)) continue;

    const mitPaket = berechneVertrag(
      vertragsdatenAusWizard(daten, config.preise, { id, name: p.name, preis: p.preis, enthalten: p.enthalten }),
      config.preise
    );
    if (!beste || mitPaket.gesamt < beste.gesamt) beste = { id, name: p.name, preis: p.preis, gesamt: mitPaket.gesamt };
  }

  if (!beste) {
    // Kein Paket passt zu Anlass/Dauer — trotzdem den individuellen Preis
    // zeigen, statt gar nichts anzuzeigen.
    return { paketId: null, name: null, preis: null, ohnePaketPreis: ohnePaket.gesamt, ersparnis: null };
  }

  // Die Pakete sind bewusst preisneutral zu den Einzelpositionen kalkuliert —
  // ihr Vorteil ist der Festpreis, nicht zwingend ein Rabatt. Sobald Anlass
  // und Dauer passen, lohnt sich der Hinweis fast immer — auch wenn das
  // Paket etwas mehr kostet, weil dann zusätzliche Leistungen inklusive sind.
  const ersparnis = Math.round((ohnePaket.gesamt - beste.gesamt) * 100) / 100;

  return { paketId: beste.id, name: beste.name, preis: beste.preis, gesamtMitPaket: beste.gesamt, ersparnis, ohnePaketPreis: ohnePaket.gesamt };
}

/* Alle Freitext-Felder aus dem öffentlichen Angebotsformular (Name, Anmerkungen,
   Wunschlieder ...) landen später ungeprüft im Cockpit und im Kundenbereich.
   Ohne dieses Escaping könnte jeder anonyme Absender Schadcode einschleusen,
   der im angemeldeten Browser des DJs bzw. des Kunden ausgeführt würde. */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

/** Stunden zwischen zwei Uhrzeiten, über Mitternacht hinweg */
function stunden(beginn, ende) {
  if (!beginn || !ende) return 0;
  const [bh, bm] = beginn.split(':').map(Number);
  const [eh, em] = ende.split(':').map(Number);
  let diff = (eh * 60 + em) - (bh * 60 + bm);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

/* ---------- Berechnung ---------- */

/**
 * Erwartet:
 * daten.bloecke  = [{ datum, beginn, ende, satz }]
 * daten.technik / daten.entertainment  = true/false
 * daten.rabatt   = Prozent (0 = kein Rabatt)
 * preise         = CONFIG.preise
 */
function berechneVertrag(daten, preise) {
  const zeilen = [];
  const zusatz = [];
  let summe = 0;

  /* ---- Kaufmodell: gewähltes Paket mit Pauschalpreis ----
     Ist ein Paket gewählt, ersetzt die Pauschale die Stundenabrechnung.
     Nur Leistungen, die nicht im Paket stecken, kommen obendrauf. */
  const paket = daten.paket && daten.paket.preis > 0 ? daten.paket : null;
  const imPaket = leistung =>
    !!(paket && Array.isArray(paket.enthalten) && paket.enthalten.includes(leistung));

  if (paket) {
    const paketPreis = (preise.paket_preis ?? paket.preis);
    zusatz.push({ label: `Paket „${paket.name}“ (Pauschalpreis):`, betrag: paketPreis });
    summe += paketPreis;
  } else {
    (daten.bloecke || []).forEach(b => {
      const std = stunden(b.beginn, b.ende);
      const satz = Number(b.satz) || 0;
      const betrag = Math.round(std * satz * 100) / 100;
      summe += betrag;
      zeilen.push({
        datum: datumDE(b.datum),
        tag: wochentag(b.datum),
        beginn: b.beginn + ' Uhr',
        ende: `${b.ende} Uhr (${std % 1 === 0 ? std : std.toFixed(2)}h á ${euro(satz)})`,
        gage: betrag
      });
    });
  }

  if (daten.technik) {
    const varianteB = daten.technik_variante === 'B';
    const preisA = preise.technik || 0;
    const preisB = preise.technik_b ?? preisA;
    if (!imPaket('technik')) {
      const betrag = varianteB ? preisB : preisA;
      zusatz.push({ label: `Technik Variante ${varianteB ? 'B' : 'A'}:`, betrag });
      summe += betrag;
    } else if (varianteB && preisB > preisA) {
      // Im Paket steckt Variante A — bei B nur den Aufpreis berechnen
      const betrag = Math.round((preisB - preisA) * 100) / 100;
      zusatz.push({ label: 'Aufpreis Technik Variante B:', betrag });
      summe += betrag;
    }
  }
  if (daten.entertainment && !imPaket('entertainment')) {
    zusatz.push({ label: 'Entertainmentprogramm:', betrag: preise.entertainment });
    summe += preise.entertainment;
  }
  if (daten.kinderanimation && (preise.kinderanimation || 0) > 0) {
    zusatz.push({ label: 'Kinderanimation:', betrag: preise.kinderanimation });
    summe += preise.kinderanimation;
  }
  if (daten.open_end && !imPaket('open_end') && (preise.open_end || 0) > 0) {
    zusatz.push({ label: 'Party Open End (ab 1 Uhr):', betrag: preise.open_end });
    summe += preise.open_end;
  }
  if (daten.fotobox_variante === 'standard' && (preise.fotobox_standard || 0) > 0) {
    zusatz.push({ label: 'Fotobox Standard (Bilder per E-Mail):', betrag: preise.fotobox_standard });
    summe += preise.fotobox_standard;
  } else if (daten.fotobox_variante === 'deluxe' && (preise.fotobox_deluxe || 0) > 0) {
    zusatz.push({ label: 'Fotobox Deluxe (inkl. 108 Ausdrucke):', betrag: preise.fotobox_deluxe });
    summe += preise.fotobox_deluxe;
  } else if (!daten.fotobox_variante && daten.fotobox && preise.fotobox > 0) {
    // Alte Anfragen ohne Varianten-Angabe
    zusatz.push({ label: 'Fotobox:', betrag: preise.fotobox });
    summe += preise.fotobox;
  }
  if (daten.remix) {
    if (!imPaket('remix') && preise.remix > 0) {
      zusatz.push({ label: 'Hochzeitstanz Produktion (inkl. 2 Korrekturen):', betrag: preise.remix });
      summe += preise.remix;
    }
    const extraKorrekturen = Number(daten.remixKorrekturenExtra) || 0;
    if (extraKorrekturen > 0) {
      const betrag = Math.round(extraKorrekturen * (preise.remix_korrektur || 0) * 100) / 100;
      zusatz.push({ label: `Zusätzliche Remix-Korrekturen (${extraKorrekturen}):`, betrag });
      summe += betrag;
    }
  }

  /* Alle Preise (Pakete wie Einzelposten) verstehen sich als Endpreise —
     die MwSt. steckt bereits darin, statt obendrauf zu kommen. "Gesamt" ist
     also der Betrag, den der Kunde tatsächlich zahlt; "mwst" zeigt nur, wie
     viel davon gesetzliche Mehrwertsteuer ist. */
  summe = Math.round(summe * 100) / 100;
  const rabattProzent = Number(daten.rabatt) || 0;
  const rabattBetrag = Math.round(summe * rabattProzent) / 100;
  const gesamt = Math.round((summe - rabattBetrag) * 100) / 100;
  const mwstSatz = preise.mwst_satz || 0;
  const mwst = Math.round((gesamt - gesamt / (1 + mwstSatz / 100)) * 100) / 100;

  return { zeilen, zusatz, summe, rabattProzent, rabattBetrag, gesamt, mwst };
}

/* ---------- PDF ---------- */

function erzeugeVertragsPDF(daten, config) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const A = config.anbieter;
  const R = berechneVertrag(daten, config.preise);

  const L = 15;            // linker Rand
  const RCHT = 195;        // rechter Rand
  let y = 18;

  /* ---- Kopf ---- */
  doc.setDrawColor(30, 60, 110);
  doc.setLineWidth(0.6);
  doc.rect(L, y, 34, 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 60, 110);
  doc.text('W I N T E R', L + 17, y + 7, { align: 'center' });
  doc.setFontSize(5.5);
  doc.text('E N T E R T A I N M E N T', L + 17, y + 11.5, { align: 'center' });

  doc.setFont('times', 'bolditalic');
  doc.setFontSize(17);
  doc.setTextColor(20, 20, 20);
  doc.text(A.kuenstlername, RCHT, y + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('Jens Winter', RCHT, y + 13, { align: 'right' });
  doc.text(A.strasse, RCHT, y + 17, { align: 'right' });
  doc.text(A.plz_ort, RCHT, y + 21, { align: 'right' });

  y += 32;

  /* ---- Titel ---- */
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  doc.text('Angebot / Vertrag / Rechnung', L, y);
  y += 5;
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);
  doc.text('über die Beschallung und Moderation nachfolgend aufgeführter Veranstaltungen:', L, y);

  y += 16;

  /* ---- Vertragspartner ---- */
  const spalte2 = 110;
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'normal');

  doc.text('Vertragspartner 1 ( VP 1 )', L, y);
  doc.line(L, y + 0.8, L + 38, y + 0.8);
  doc.text('Vertragspartner 2 ( VP 2 )', spalte2, y);
  doc.line(spalte2, y + 0.8, spalte2 + 38, y + 0.8);

  const k = daten.kunde || {};
  const vp1 = [
    `${k.vorname || ''} ${k.nachname || ''}`.trim(),
    k.strasse || '',
    `${k.plz || ''} ${k.ort || ''}`.trim(),
    k.email ? `Email: ${k.email}` : ''
  ].filter(Boolean);

  const vp2 = [A.firma, A.vertreten, A.strasse, A.plz_ort];

  let yy = y + 5;
  vp1.forEach(z => { doc.text(z, L, yy); yy += 4.2; });
  yy = y + 5;
  vp2.forEach(z => { doc.text(z, spalte2, yy); yy += 4.2; });

  y = Math.max(y + 5 + vp1.length * 4.2, y + 5 + vp2.length * 4.2) + 10;

  /* ---- Tabelle ---- */
  const spalten = [
    { x: L,    w: 26, align: 'center' },   // Datum
    { x: 41,   w: 22, align: 'center' },   // Tag
    { x: 63,   w: 24, align: 'center' },   // Beginn
    { x: 87,   w: 68, align: 'right'  },   // Ende
    { x: 155,  w: 40, align: 'right'  }    // Gage
  ];
  const zeilenHoehe = 6;

  /* Flächen und Text müssen getrennt gezeichnet werden:
     jsPDF verwirft Rechtecke, die zwischen Textausgaben liegen. */

  // Kopfzeile — erst Flächen
  doc.setFillColor(47, 117, 181);
  spalten.forEach(s => doc.rect(s.x, y, s.w, zeilenHoehe, 'F'));

  // Kopfzeile — dann Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  ['Datum', 'Tag', 'Beginn', 'Ende', 'Gage'].forEach((t, i) => {
    const s = spalten[i];
    const mittig = s.align === 'center';
    doc.text(t, mittig ? s.x + s.w / 2 : s.x + s.w - 2, y + 4.2,
      { align: mittig ? 'center' : 'right' });
  });
  y += zeilenHoehe;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const zeileZeichnen = (werte, hell, fett = false) => {
    // 1. Durchgang: Flächen
    spalten.forEach((s, i) => {
      if (i === 4) doc.setFillColor(47, 117, 181);
      else doc.setFillColor(hell ? 222 : 198, hell ? 232 : 214, hell ? 245 : 235);
      doc.rect(s.x, y, s.w, zeilenHoehe, 'F');
    });

    // 2. Durchgang: Text
    doc.setFont('helvetica', fett ? 'bold' : 'normal');
    werte.forEach((t, i) => {
      if (!t) return;
      const s = spalten[i];
      const mittig = s.align === 'center';
      doc.setTextColor(i === 4 ? 255 : 20, i === 4 ? 255 : 20, i === 4 ? 255 : 20);
      doc.text(String(t), mittig ? s.x + s.w / 2 : s.x + s.w - 2, y + 4.2,
        { align: mittig ? 'center' : 'right' });
    });
    doc.setFont('helvetica', 'normal');
    y += zeilenHoehe;
  };

  R.zeilen.forEach((z, i) => {
    zeileZeichnen([z.datum, z.tag, z.beginn, z.ende, euro(z.gage)], i % 2 === 0);
  });

  R.zusatz.forEach((z, i) => {
    zeileZeichnen(['', '', '', z.label, euro(z.betrag)], i % 2 === 1);
  });

  zeileZeichnen(['', '', '', 'Summe:', euro(R.summe)], true);

  if (R.rabattProzent > 0) {
    zeileZeichnen(['', '', '', `abzgl. Rabatt ${R.rabattProzent}%`, '-' + euro(R.rabattBetrag)], false);
  }

  zeileZeichnen(['', '', '', 'Gesamt:', euro(R.gesamt)], true, true);

  y += 10;

  /* ---- MwSt.-Hinweis ---- */
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(8);
  doc.text('Alle Preise sind Endpreise inklusive der gesetzlichen Mehrwertsteuer.', L, y);
  y += 4;
  doc.text(`(davon enthalten: ${config.preise.mwst_satz}% MwSt. = ${euro(R.mwst)})`, L, y);

  y += 12;

  /* ---- Vertragstext ---- */
  const ev = daten.event || {};
  const hauptDatum = R.zeilen.length ? R.zeilen[0].datum : datumDE(ev.datum);
  const hauptTag = R.zeilen.length ? R.zeilen[0].tag : wochentag(ev.datum);

  const absatz = [
    ...(daten.paket && daten.paket.name
      ? [`Gebuchtes Paket: „${daten.paket.name}“ zum Pauschalpreis laut Aufstellung` +
         (ev.party_von ? ` — Spielzeit ${ev.empfang_von ? ev.empfang_von : ev.party_von} Uhr bis ${ev.open_end ? 'Open End' : (ev.party_bis || '') + ' Uhr'}.` : '.')]
      : []),
    'VP 1 verpflichtet sich zur Alleinvergabe nachfolgend aufgeführter Termine an VP 2. VP 2 verpflichtet sich zur Absicherung nachfolgend aufgeführter Termine und Beschallung, sowie Moderation über den Veranstaltungszeitraum.',
    `Datum: ${hauptTag}, der ${hauptDatum}` + (ev.aufbau_von ? ` / Aufbau erfolgt ${ev.aufbau_von} Uhr bis ${ev.aufbau_bis || ''} Uhr` : ''),
    `Ort der Veranstaltung: ${[ev.location, ev.location_adresse].filter(Boolean).join(', ')}`,
    'VP 1 beauftragt VP 2 zur Durchführung seiner Veranstaltung. Zwischen dem Veranstalter und dem Diskjockey kommt ein Vertrag nach § 611 BGB zustande.'
  ];

  doc.setFontSize(8);
  absatz.forEach(t => {
    const zeilen = doc.splitTextToSize(t, RCHT - L);
    doc.text(zeilen, L, y);
    y += zeilen.length * 3.8 + 1.2;
  });

  doc.setFont('helvetica', 'bold');
  const fael = doc.splitTextToSize(
    'Die Gage ist in bar nach Aufbau fällig. Alternativ auf dem unten aufgeführten Konto bis zum Veranstaltungstag eingehend.',
    RCHT - L);
  doc.text(fael, L, y);
  y += fael.length * 3.8 + 8;
  doc.setFont('helvetica', 'normal');

  doc.text('Mit Ihrer Unterschrift erkennen beide Vertragspartner diese Bedingungen an.', L, y);
  y += 10;

  /* ---- Empfehlungshinweis ---- */
  doc.setDrawColor(201, 162, 39);
  doc.setLineWidth(0.8);
  doc.line(L, y, L, y + 11);
  doc.setFontSize(7.5);
  doc.setTextColor(90, 80, 50);
  const hinweis = doc.splitTextToSize(
    'Hinweis: Dieser Vertrag wurde auf Grundlage Ihrer Angaben erstellt. Wir empfehlen ausdrücklich ein persönliches Gespräch vor Vertragsabschluss, um Ablauf, Musikwünsche und technische Gegebenheiten gemeinsam abzustimmen.',
    RCHT - L - 5);
  doc.text(hinweis, L + 4, y + 3.5);
  y += 18;
  doc.setTextColor(20, 20, 20);

  /* ---- Unterschriften ---- */
  const sigY = Math.max(y + 8, 236);
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([0.8, 0.8], 0);
  doc.line(L + 8, sigY, L + 68, sigY);
  doc.line(spalte2 - 3, sigY, spalte2 + 57, sigY);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text('VP 1', L + 38, sigY + 3.5, { align: 'center' });
  doc.text('VP 2', spalte2 + 27, sigY + 3.5, { align: 'center' });

  /* ---- Fußzeile ---- */
  let fy = sigY + 10;
  doc.setFontSize(6.8);
  doc.setTextColor(40, 40, 40);

  const spA = [A.firma, A.web, 'Jens Winter', A.strasse, A.plz_ort];
  const spB = [`Tel.      ${A.telefon}`, `Fax:      ${A.fax}`, `Mobil: ${A.mobil}`, A.web2, `Email: ${A.email}`];
  const spC = [A.bank, `Blz.:`, `Konto:`, `BIC:`, `IBAN:`];
  const spCw = ['', A.blz, A.konto, A.bic, A.iban];
  const spD = [A.finanzamt, 'Steuernummer', A.steuernummer];

  spA.forEach((t, i) => doc.text(t, L, fy + i * 3.4));
  spB.forEach((t, i) => doc.text(t, 52, fy + i * 3.4));
  spC.forEach((t, i) => doc.text(t, 108, fy + i * 3.4));
  spCw.forEach((t, i) => { if (t) doc.text(t, 152, fy + i * 3.4, { align: 'right' }); });
  spD.forEach((t, i) => doc.text(t, 158, fy + i * 3.4));

  return doc;
}

if (typeof window !== 'undefined') {
  window.erzeugeVertragsPDF = erzeugeVertragsPDF;
  window.berechneVertrag = berechneVertrag;
  window.pdfHelfer = { wochentag, datumDE, euro, stunden, escapeHtml, empfehlePaket, vertragsdatenAusWizard };
}
