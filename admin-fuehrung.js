/* =====================================================
   HochzeitsDJ24 — Geführte Einführung: DJ-Cockpit
   Läuft einmalig, sobald der DJ zum ersten Mal im Cockpit
   landet — und lässt sich über den Button "Tour ansehen"
   jederzeit erneut abspielen (z. B. für Jens' Vater).

   Wie auf der Startseite (fuehrung.js) fährt ein Zeiger
   sichtbar zu jedem Ziel und deutet dort einen Klick an,
   bevor die jeweilige Box hervorgehoben wird — statt dass
   die Hervorhebung einfach kommentarlos springt.
   ===================================================== */

(function () {

  const FUNKE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 0c0 6.2 1.9 9.9 12 12-10.1 2.1-12 5.8-12 12 0-6.2-1.9-9.9-12-12 10.1-2.1 12-5.8 12-12Z"/></svg>';

  const ZEIGER_SVG = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">' +
    '<path d="M5 2 L5 19 L9.2 15.2 L11.8 21.4 L14.6 20.2 L12 14.2 L18 14 Z" ' +
    'fill="#fff" stroke="#0e0d0c" stroke-width="1.1" stroke-linejoin="round"/></svg>';

  async function starte(erzwingen) {
    if (!erzwingen) {
      if (localStorage.getItem('hdj24_cockpit_fuehrung') === 'ja') return;
      localStorage.setItem('hdj24_cockpit_fuehrung', 'ja');
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Vorherigen Lauf sauber entfernen, falls die Tour erneut gestartet wird
    document.getElementById('cFuehrung')?.remove();

    const ziele = {
      kpis:    document.querySelector('.dash__kpis'),
      feature: document.getElementById('featureKarte'),
      liste:   document.getElementById('listenBereich'),
      reload:  document.getElementById('reload')
    };
    if (!ziele.kpis || !ziele.feature || !ziele.liste || !ziele.reload) return;

    const ersteZeile = document.querySelector('#liste tr');

    const markup = `
      <div class="fuehrung" id="cFuehrung" aria-hidden="true">
        <div class="fuehrung__ebene">
          <div class="fuehrung__blase" id="cBlase">
            <span class="fuehrung__schritt"><span class="fuehrung__funke" aria-hidden="true">${FUNKE_SVG}</span><span id="cSchritt">1 von 4</span></span>
            <p id="cText"></p>
            <span class="fuehrung__balken" id="cBalken"></span>
          </div>
          <div class="fuehrung__zeiger" id="cZeiger">
            ${ZEIGER_SVG}
            <span class="fuehrung__welle"></span>
          </div>
          <button class="fuehrung__ende" id="cEnde">Überspringen</button>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', markup);

    const box      = document.getElementById('cFuehrung');
    const blase    = document.getElementById('cBlase');
    const text     = document.getElementById('cText');
    const schrittEl = document.getElementById('cSchritt');
    const balken   = document.getElementById('cBalken');
    const zeiger   = document.getElementById('cZeiger');

    let abgebrochen = false;
    let aktuellesZiel = null;
    const gesamt = ersteZeile ? 6 : 4;

    const warte = ms => new Promise(res => {
      const id = setTimeout(res, ms);
      wartenAbbrechen.push(() => { clearTimeout(id); res(); });
    });
    const wartenAbbrechen = [];

    /* Hebt die ganze Box hervor (statt nur eines kleinen Kreises) und
       dimmt alles ringsherum ab. */
    const zeigeZiel = el => {
      aktuellesZiel?.classList.remove('cockpit-tour-ziel');
      aktuellesZiel = el;
      el?.classList.add('cockpit-tour-ziel');
    };

    /* Sprechblase neben das Ziel setzen — oberhalb, wenn darunter kein Platz ist */
    const blaseZu = el => {
      const r = el.getBoundingClientRect();
      if (window.innerHeight - r.bottom > 200) {
        blase.style.top = (r.bottom + 22) + 'px';
        blase.style.bottom = 'auto';
      } else {
        blase.style.bottom = (window.innerHeight - r.top + 22) + 'px';
        blase.style.top = 'auto';
      }
      blase.style.left = Math.max(20, Math.min(r.left, window.innerWidth - 360)) + 'px';
    };

    /* Zeiger sichtbar zum Ziel fahren lassen — genau wie auf der Startseite */
    const zeigerZu = (el, versatzX = 16, versatzY = 16) => {
      const r = el.getBoundingClientRect();
      zeiger.style.transform =
        `translate(${r.left + r.width / 2 + versatzX}px, ${r.top + r.height / 2 + versatzY}px)`;
    };

    const balkenLaufen = dauer => {
      balken.style.animation = 'none';
      void balken.offsetWidth; // Neustart erzwingen
      balken.style.animation = `balkenFuellen ${dauer}ms linear forwards`;
    };

    /* Ein voller Schritt: hinscrollen, Zeiger fährt hin, deutet Klick an,
       erst dann wird die Box hervorgehoben und der Text angezeigt. */
    const schrittZeigen = async (nr, ziel, dauer, satz) => {
      if (abgebrochen || !ziel) return;
      ziel.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await warte(500);
      if (abgebrochen) return;
      zeigerZu(ziel);
      await warte(950);
      if (abgebrochen) return;
      zeiger.classList.add('klickt');
      await warte(350);
      if (abgebrochen) return;
      zeiger.classList.remove('klickt');
      zeigeZiel(ziel);
      blaseZu(ziel);
      schrittEl.textContent = `${nr} von ${gesamt}`;
      text.textContent = satz;
      box.classList.add('zeigt-blase');
      balkenLaufen(dauer);
      await warte(dauer);
    };

    document.getElementById('cEnde').addEventListener('click', () => beenden());
    document.addEventListener('keydown', escHoerer);
    function escHoerer(e) { if (e.key === 'Escape') beenden(); }

    box.classList.add('is-da');
    zeiger.style.transform = `translate(${window.innerWidth / 2}px, ${window.innerHeight * 0.75}px)`;
    await warte(400);
    if (abgebrochen) return;

    await schrittZeigen(1, ziele.kpis, 4200,
      'Hier siehst du auf einen Blick Einnahmen, offene Rechnungen, anstehende Termine und neue Anfragen.');
    await schrittZeigen(2, ziele.feature, 4200,
      'Diese Karte zeigt automatisch, was gerade am dringendsten ist — nicht einfach nur die neueste Anfrage.');
    await schrittZeigen(3, ziele.liste, 4600,
      'Hier findest du alle Anfragen. Klick einfach drauf, um Details zu sehen und den Preis zu berechnen.');
    await schrittZeigen(4, ziele.reload, 3600,
      'Mit „Aktualisieren" holst du dir jederzeit den neuesten Stand.');

    if (abgebrochen) return;

    if (!ersteZeile) {
      beenden();
      return;
    }

    /* 5–6 — In eine Anfrage springen, um Freigeben/Chat zu zeigen */
    zeigerZu(ersteZeile, 20, 4);
    await warte(950);
    if (abgebrochen) return;
    zeiger.classList.add('klickt');
    await warte(350);
    if (abgebrochen) return;
    zeiger.classList.remove('klickt');
    ersteZeile.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await warte(600);
    if (abgebrochen) return;

    const freigeben = document.getElementById('freigeben');
    const chatKarte = document.getElementById('chatKarte');

    if (freigeben) {
      await schrittZeigen(5, freigeben, 5200,
        'In der Detailansicht stellst du die Preise ein und gibst das Angebot mit diesem Knopf für den Kunden frei.');
    }
    if (chatKarte && !abgebrochen) {
      await schrittZeigen(6, chatKarte, 4600,
        'Hier schreibst du direkt mit dem Kunden — Fragen und Antworten sieht er in seinem eigenen Bereich.');
    }

    if (abgebrochen) return;
    document.getElementById('zurueckListe')?.click();
    beenden(true);

    /* Kleiner Funken-Gruß am Ende der Tour — kein Streifen, nur ein
       ruhiges Aufblitzen von 4 kleinen Funken um die Sprechblase. */
    function jubelZeigen() {
      const jubel = document.createElement('span');
      jubel.className = 'fuehrung__jubel';
      jubel.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 4; i++) {
        const f = document.createElement('span');
        f.className = 'fuehrung__jubel-funke';
        f.innerHTML = FUNKE_SVG;
        jubel.appendChild(f);
      }
      blase.appendChild(jubel);
      setTimeout(() => jubel.remove(), 1200);
    }

    function beenden(mitJubel) {
      if (abgebrochen) return;
      abgebrochen = true;
      wartenAbbrechen.forEach(fn => fn());
      document.removeEventListener('keydown', escHoerer);
      if (mitJubel) jubelZeigen();
      aktuellesZiel?.classList.remove('cockpit-tour-ziel');
      const wegVerzoegerung = mitJubel ? 750 : 0;
      setTimeout(() => {
        box.classList.remove('is-da', 'zeigt-blase');
        setTimeout(() => box.remove(), 500);
      }, wegVerzoegerung);
    }
  }

  window.starteCockpitFuehrung = starte;

})();
