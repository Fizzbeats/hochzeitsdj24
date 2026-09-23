/* =====================================================
   HochzeitsDJ24 — Geführte Einführung
   Zeigt einmal pro Besuch, wie die Seite bedient wird:
   Hintergrund wird weichgezeichnet, ein Zeiger fährt zum
   Menü, öffnet es, zeigt die Bereiche und die Anmeldung.
   ===================================================== */

(function () {

  /* -----------------------------------------------------
     SCHALTER
     false = die Einführung läuft bei jedem Aufruf
             (praktisch zum Ausprobieren)
     true  = sie läuft nur einmal überhaupt, auch bei
             späteren Besuchen (für echte Besucher)
     ----------------------------------------------------- */
  const NUR_EINMAL = true;

  const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduziert) return;

  /* Nur auf der Startseite */
  const datei = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (datei !== '' && datei !== 'index.html') return;

  const markup = `
    <div class="fuehrung" id="fuehrung" aria-hidden="true">
      <div class="fuehrung__schleier" id="fSchleier"></div>
      <div class="fuehrung__kegel" id="fKegel"></div>

      <!-- Ankündigung vor der eigentlichen Führung -->
      <div class="fuehrung__ansage" id="fAnsage">
        <span class="fuehrung__ansageZeile"></span>
        <p class="fuehrung__ansageTitel">Eine kurze Einführung</p>
        <p class="fuehrung__ansageText">Wir zeigen Ihnen in wenigen Sekunden, wie Sie sich hier zurechtfinden.</p>
      </div>

      <div class="fuehrung__ebene">
        <div class="fuehrung__blase" id="fBlase">
          <span class="fuehrung__schritt" id="fSchritt">1 von 3</span>
          <p id="fText">Über dieses Menü navigieren Sie durch die Seite.</p>
          <span class="fuehrung__balken" id="fBalken"></span>
        </div>
        <div class="fuehrung__zeiger" id="fZeiger">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M5 2 L5 19 L9.2 15.2 L11.8 21.4 L14.6 20.2 L12 14.2 L18 14 Z"
                  fill="#fff" stroke="#0e0d0c" stroke-width="1.1" stroke-linejoin="round"/>
          </svg>
          <span class="fuehrung__welle"></span>
        </div>
        <button class="fuehrung__ende" id="fEnde">Überspringen</button>
      </div>
    </div>`;

  let schritte = [];
  let abgebrochen = false;

  function starte() {
    if (NUR_EINMAL && localStorage.getItem('hdj24_fuehrung') === 'ja') return;
    localStorage.setItem('hdj24_fuehrung', 'ja');

    /* Falls ein früherer Durchlauf noch offen ist, zuerst aufräumen */
    document.getElementById('fuehrung')?.remove();
    document.documentElement.classList.remove('fuehrung-laeuft');
    schritte.forEach(clearTimeout);
    schritte = [];
    abgebrochen = false;

    const burger = document.getElementById('burger');
    const nav    = document.getElementById('nav');
    const login  = document.getElementById('loginLink');
    if (!burger || !nav) return;

    document.body.insertAdjacentHTML('beforeend', markup);

    const box     = document.getElementById('fuehrung');
    const zeiger  = document.getElementById('fZeiger');
    const blase   = document.getElementById('fBlase');
    const text    = document.getElementById('fText');
    const schritt = document.getElementById('fSchritt');

    const schleier = document.getElementById('fSchleier');
    const kegel    = document.getElementById('fKegel');
    const wurzel   = document.documentElement;

    /* Zeiger an ein Element setzen */
    const zuElement = (el, versatzX = 12, versatzY = 12) => {
      const r = el.getBoundingClientRect();
      zeiger.style.transform =
        `translate(${r.left + r.width / 2 + versatzX}px, ${r.top + r.height / 2 + versatzY}px)`;
    };

    /* Lichtkegel und Kamerafahrt folgen dem Zeiger Bild für Bild */
    let lauf = null;
    const verfolgen = () => {
      const r = zeiger.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;

      schleier.style.setProperty('--sx', x + 'px');
      schleier.style.setProperty('--sy', y + 'px');
      kegel.style.setProperty('--sx', x + 'px');
      kegel.style.setProperty('--sy', y + 'px');

      /* Ursprung der Kamerafahrt in Prozent der Fensterfläche */
      wurzel.style.setProperty('--fx', (x / window.innerWidth * 100).toFixed(2) + '%');
      wurzel.style.setProperty('--fy', (y / window.innerHeight * 100).toFixed(2) + '%');

      lauf = requestAnimationFrame(verfolgen);
    };

    /* Sprechblase neben ein Element setzen */
    const blaseZu = (el, seite = 'links') => {
      const r = el.getBoundingClientRect();
      blase.style.top = (r.bottom + 22) + 'px';
      if (seite === 'links') {
        blase.style.left = Math.max(20, r.left) + 'px';
        blase.style.right = 'auto';
      } else {
        blase.style.right = Math.max(20, window.innerWidth - r.right) + 'px';
        blase.style.left = 'auto';
      }
    };

    /* Startposition des Zeigers: aus der Bildmitte heraus */
    zeiger.style.transform = `translate(${window.innerWidth / 2}px, ${window.innerHeight * 0.68}px)`;

    const menueAuf = (auf) => {
      nav.classList.toggle('is-open', auf);
      burger.classList.toggle('is-open', auf);
      document.getElementById('header').classList.toggle('header--menue', auf);
      burger.setAttribute('aria-expanded', auf);
      document.body.style.overflow = auf ? 'hidden' : '';
    };

    const nach = (ms, fn) => schritte.push(setTimeout(() => { if (!abgebrochen) fn(); }, ms));

    const ansage = document.getElementById('fAnsage');
    const balken = document.getElementById('fBalken');

    /* Fortschrittsbalken für die Lesedauer eines Schrittes */
    const balkenLaufen = (dauer) => {
      balken.style.animation = 'none';
      void balken.offsetWidth;                       // Neustart erzwingen
      balken.style.animation = `balkenFuellen ${dauer}ms linear forwards`;
    };

    /* ---------- Ablauf ---------- */

    // 0 — Ankündigung
    requestAnimationFrame(() => {
      box.classList.add('is-da');
      box.classList.add('zeigt-ansage');
      wurzel.classList.add('fuehrung-laeuft');
      verfolgen();
    });

    nach(3200, () => box.classList.remove('zeigt-ansage'));
    nach(3900, () => ansage.remove());

    // 1 — Hinweis am Menü
    nach(3400, () => {
      blaseZu(burger, 'links');
      box.classList.add('zeigt-blase');
      balkenLaufen(4200);
    });

    // 2 — Zeiger fährt zum Menü
    nach(4300, () => zuElement(burger));

    // 3 — Klick andeuten
    nach(6900, () => zeiger.classList.add('klickt'));

    // 4 — Menü öffnet sich
    nach(7300, () => {
      zeiger.classList.remove('klickt');
      menueAuf(true);
      schritt.textContent = '2 von 3';
      text.textContent = 'Hier liegen alle Bereiche — Leistungen, Ablauf, Preise, Ihre Angebotserstellung und Ihr Zugang.';
      blase.classList.add('ist-hell');
      balkenLaufen(9200);
    });

    // 5 — Zeiger wandert in Ruhe über die Menüpunkte
    nach(8900, () => {
      const punkte = nav.querySelectorAll('.nav__liste a');
      if (punkte[0]) zuElement(punkte[0], 40, 4);
    });
    nach(11400, () => {
      const punkte = nav.querySelectorAll('.nav__liste a');
      if (punkte[5]) zuElement(punkte[5], 40, 4);
    });
    nach(13900, () => {
      const knopf = nav.querySelector('.nav__vertrag');
      if (knopf) zuElement(knopf, 20, 4);
    });

    // 6 — Menü schließt wieder
    nach(16600, () => {
      menueAuf(false);
      blase.classList.remove('ist-hell');
    });

    // 7 — Hinweis auf die Anmeldung rechts oben
    nach(17300, () => {
      if (!login) return;
      schritt.textContent = '3 von 3';
      text.textContent = 'Ihr persönlicher Zugang liegt oben rechts — dort sehen Sie später Ihr Angebot.';
      blaseZu(login, 'rechts');
      zuElement(login);
      login.classList.add('wird-gezeigt');
      balkenLaufen(5600);
    });

    nach(19400, () => zeiger.classList.add('klickt'));
    nach(19750, () => zeiger.classList.remove('klickt'));

    // 8 — Ende
    nach(23000, beenden);

    document.getElementById('fEnde').addEventListener('click', beenden);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') beenden(); });

    function beenden() {
      if (abgebrochen) return;
      abgebrochen = true;
      schritte.forEach(clearTimeout);
      if (lauf) cancelAnimationFrame(lauf);

      menueAuf(false);
      login?.classList.remove('wird-gezeigt');
      // zeigt-ansage/zeigt-blase separat entfernen: sie hängen nicht an is-da,
      // sonst blieb der zuletzt sichtbare Text beim Überspringen noch kurz stehen.
      box.classList.remove('is-da', 'zeigt-ansage', 'zeigt-blase');
      wurzel.classList.remove('fuehrung-laeuft');   // Kamera fährt zurück

      setTimeout(() => {
        box.remove();
        wurzel.style.removeProperty('--fx');
        wurzel.style.removeProperty('--fy');
      }, 1100);
    }
  }

  /* Startet unmittelbar, sobald der Vorhang offen ist */
  document.addEventListener('intro-fertig', starte);
  document.addEventListener('DOMContentLoaded', () => {
    if (document.documentElement.classList.contains('intro-uebersprungen')) {
      setTimeout(starte, 300);
    }
  });

})();
