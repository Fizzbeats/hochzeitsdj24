/* =====================================================
   HochzeitsDJ24 — Intro der Startseite
   Eine gezeichnete Klangwelle, die sich zur Tanzfläche
   aufbaut, dann öffnet sich der Vorhang zum Hero.
   ===================================================== */

(function () {

  const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Das Intro läuft bei jedem Aufruf der Startseite.
     Beim zweiten Mal in derselben Sitzung etwas kürzer,
     damit es Wiederkehrende nicht aufhält.             */
  const schonGesehen = sessionStorage.getItem('hdj24_intro') === 'ja';

  if (reduziert) {
    document.documentElement.classList.add('intro-uebersprungen');
    return;
  }

  document.documentElement.classList.add('intro-laeuft');

  const markup = `
    <div class="intro" id="intro" aria-hidden="true">
      <div class="intro__half intro__half--oben"></div>
      <div class="intro__half intro__half--unten"></div>
      <div class="intro__mitte">
        <canvas class="intro__welle" id="introWelle"></canvas>
        <div class="intro__wort">
          <span class="intro__zeile" id="introZeile1">Hochzeits<em>DJ</em>24</span>
          <span class="intro__zeile intro__zeile--klein" id="introZeile2">seit 1986</span>
        </div>
        <div class="intro__fortschritt"><span id="introBalken"></span></div>
      </div>
      <button class="intro__skip" id="introSkip">Überspringen</button>
    </div>`;

  document.addEventListener('DOMContentLoaded', () => {
    document.body.insertAdjacentHTML('afterbegin', markup);

    const intro   = document.getElementById('intro');
    const canvas  = document.getElementById('introWelle');
    const balken  = document.getElementById('introBalken');
    const ctx     = canvas.getContext('2d');

    let breite, hoehe, dpr;
    const groesse = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      breite = canvas.clientWidth;
      hoehe  = canvas.clientHeight;
      canvas.width  = breite * dpr;
      canvas.height = hoehe * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    groesse();
    window.addEventListener('resize', groesse);

    const start = performance.now();
    const DAUER = schonGesehen ? 1600 : 2800;   // beim Wiederkommen kürzer
    let laeuft = true;

    /* Weiche Beschleunigung */
    const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    function zeichne(jetzt) {
      if (!laeuft) return;

      const p = Math.min((jetzt - start) / DAUER, 1);
      const e = ease(p);
      const t = jetzt / 1000;

      ctx.clearRect(0, 0, breite, hoehe);

      const mitte = hoehe / 2;
      const sichtbar = breite * e;

      /* Drei übereinanderliegende Wellen, die mit dem Fortschritt
         von einer ruhigen Linie zur vollen Amplitude wachsen. */
      const wellen = [
        { amp: 46, freq: 0.011, geschw: 2.2, farbe: 'rgba(180,144,31,0.95)', dicke: 1.6 },
        { amp: 30, freq: 0.017, geschw: -1.6, farbe: 'rgba(180,144,31,0.45)', dicke: 1 },
        { amp: 18, freq: 0.026, geschw: 3.1, farbe: 'rgba(255,255,255,0.22)', dicke: 1 }
      ];

      wellen.forEach(w => {
        ctx.beginPath();
        ctx.lineWidth = w.dicke;
        ctx.strokeStyle = w.farbe;
        ctx.lineCap = 'round';

        for (let x = 0; x <= sichtbar; x += 2) {
          /* Amplitude läuft zu den Rändern hin aus */
          const rand = Math.sin((x / breite) * Math.PI);
          const aufbau = Math.min(1, (e - x / breite) * 3.2);
          const a = w.amp * rand * Math.max(0, aufbau) * (0.55 + 0.45 * Math.sin(t * 1.7));
          const y = mitte + Math.sin(x * w.freq + t * w.geschw) * a;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      /* Leuchtpunkt an der Spitze der Linie */
      if (p < 1) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(180,144,31,1)';
        ctx.arc(sichtbar, mitte, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = 'rgba(180,144,31,0.18)';
        ctx.arc(sichtbar, mitte, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      balken.style.width = (e * 100) + '%';

      if (p < 1) requestAnimationFrame(zeichne);
      else beenden();
    }

    const VORHANG_DAUER = 1150; // muss zur transition-Dauer von .intro__half in intro.css passen

    function beenden() {
      if (!laeuft) return;
      laeuft = false;
      sessionStorage.setItem('hdj24_intro', 'ja');

      intro.classList.add('is-oeffnend');

      /* Der Hero-Inhalt startet erst, wenn der Vorhang wirklich offen ist.
         Lief er sofort mit, war die Textanimation teils noch vom Vorhang
         verdeckt und wirkte beim Erscheinen ruckartig statt fließend. */
      setTimeout(() => {
        document.documentElement.classList.remove('intro-laeuft');
        document.documentElement.classList.add('intro-fertig');
      }, VORHANG_DAUER);

      setTimeout(() => document.dispatchEvent(new Event('intro-fertig')), VORHANG_DAUER + 620);
      setTimeout(() => intro.remove(), VORHANG_DAUER + 350);
    }

    document.getElementById('introSkip').addEventListener('click', beenden);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') beenden(); }, { once: true });

    requestAnimationFrame(zeichne);
  });

})();
