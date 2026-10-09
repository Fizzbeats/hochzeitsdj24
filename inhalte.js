/* =====================================================
   HochzeitsDJ24 — Kundenzitate & Leistungs-Texte
   Lädt beides aus der Datenbank (im Entwickler-Bereich
   bearbeitbar) statt fest im HTML zu stehen. Gleiches
   Prinzip wie faq.js.
   ===================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const esc = text => {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
  };

  /* ---------- Kundenzitate ---------- */
  const zitateListe = document.getElementById('zitateListe');
  if (zitateListe) {
    const STANDARD_ZITATE = [
      { text: 'Die Tanzfläche war den ganzen Abend voll — und niemand hat gemerkt, wie viel Planung dahintersteckt.', name: 'Julia & Thomas, Schloss Klaffenbach' },
      { text: 'Du hast unseren Abend wieder wunderbar musikalisch gestaltet.', name: 'Alexandra' },
      { text: 'Es war wirklich eine mega Stimmung … herzlichen Dank für Deine wunderbare Musik.', name: 'Isabel' }
    ];
    let zitate;
    try {
      zitate = await DB.zitateLaden();
      if (!zitate || !zitate.length) zitate = STANDARD_ZITATE;
    } catch {
      zitate = STANDARD_ZITATE;
    }
    zitateListe.innerHTML = zitate.map(z => `
      <blockquote class="quote__karte">
        <p>„${esc(z.text)}“</p>
        <cite>${esc(z.name)}</cite>
      </blockquote>`).join('');
  }

  /* ---------- Leistungs-Texte ---------- */
  const leistungBodies = [0, 1, 2].map(i => document.getElementById('leistungBody' + i));
  if (leistungBodies.some(Boolean)) {
    const STANDARD_LEISTUNGEN = [
      { titel: 'Hochzeiten', text: 'Rund 25 Hochzeiten begleiten wir jedes Jahr — und trotzdem ist keine wie die andere. Wir setzen uns vorher mit Ihnen zusammen, sprechen mit Ihren Trauzeugen und wissen am großen Tag genau, wann Ihr Lied dran ist. Sie müssen an nichts denken.', bullets: ['Persönliches Musikprofil nach Ihren Wünschen', 'Stilvolle Moderation nach Ihren Vorgaben', 'Zwei Technik-Varianten: kompakt mit Funkmikrofon — oder groß mit vier Funkmikrofonen'] },
      { titel: 'Firmenevents & Geburtstage', text: 'Eine Firmenfeier tickt anders als eine Hochzeit — und ein 70. Geburtstag anders als beides. Wir schauen, wer im Raum ist, und spielen danach: beim Essen zurückhaltend, auf der Tanzfläche mit allem, was dazugehört.', bullets: ['Abgestimmte Hintergrundmusik für Empfang und Dinner', 'Moderation für Reden, Ehrungen und Programmpunkte', 'Deko-Licht, Floorspots in Wunschfarbe optional zubuchbar'] },
      { titel: 'Personalisierte Remixe', text: 'Ihr Lied, aber so, wie es sonst niemand hat: Wir bauen den Titel für Ihren ersten Tanz um — langsamer zum Einstieg, mit eigenem Arrangement oder fließendem Übergang in die Party. Davon reden Ihre Gäste noch Jahre später.', bullets: ['Individuelles Arrangement Ihres Wunschtitels', 'Abstimmung auf Ihre Choreografie', 'Auf Wunsch als Aufnahme für Sie zum Behalten'] }
    ];
    let leistungen;
    try {
      leistungen = await DB.leistungenLaden();
      if (!leistungen || !leistungen.length) leistungen = STANDARD_LEISTUNGEN;
    } catch {
      leistungen = STANDARD_LEISTUNGEN;
    }
    leistungBodies.forEach((body, i) => {
      const l = leistungen[i];
      if (!body || !l) return;
      body.innerHTML = `
        <h3>${esc(l.titel)}</h3>
        <p>${esc(l.text)}</p>
        <ul class="service__list">${(l.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>`;
    });
  }
});
