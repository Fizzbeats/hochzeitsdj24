/* =====================================================
   HochzeitsDJ24 — Interaktion & Animation
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Header, Burger-Menü und Jahreszahl werden von nav.js gesteuert. */

  /* ---- Kopfzeile färbt sich mit der aufgeklappten Hälfte ---- */
  const seiten = {
    hochzeit: document.getElementById('seiteHochzeit'),
    events:   document.getElementById('seiteEvents')
  };
  const wurzel = document.documentElement;

  Object.entries(seiten).forEach(([name, el]) => {
    if (!el) return;
    const an  = () => {
      wurzel.classList.remove('wahl-hochzeit', 'wahl-events');
      wurzel.classList.add('wahl-' + name);
    };
    const aus = () => wurzel.classList.remove('wahl-' + name);

    el.addEventListener('mouseenter', an);
    el.addEventListener('mouseleave', aus);
    el.addEventListener('focus', an);
    el.addEventListener('blur', aus);
  });

  /* ---- Scroll-Hinweis ausblenden, sobald gescrollt wird ---- */
  const hinweis = document.getElementById('scrollhinweis');
  if (hinweis) {
    const pruefen = () => hinweis.classList.toggle('is-weg', window.scrollY > 180);
    pruefen();
    window.addEventListener('scroll', pruefen, { passive: true });
  }

  /* ---- Reveal beim Scrollen ---- */
  const revealEls = document.querySelectorAll('.reveal');
  if (reduced) {
    revealEls.forEach(el => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(el => io.observe(el));
  }

  /* ---- Pakete: Pack-Opening beim Scrollen ----
     Wie beim Aufreißen mehrerer Packs: Karten öffnen sich nacheinander von
     links nach rechts, nicht alle gleichzeitig. Start 2 Sekunden nachdem der
     Abschnitt sichtbar wird (damit man ihn erst wahrnimmt), dann läuft jede
     Karte einzeln durch Anspannung → Riss → Aufdecken, zeitversetzt zur
     nächsten. */
  const paketReihe = document.querySelector('.tiers');
  const packs = paketReihe ? Array.from(paketReihe.querySelectorAll('.tier.pack')) : [];
  if (packs.length) {
    if (reduced) {
      packs.forEach(el => el.classList.add('is-offen'));
    } else {
      const ANSPANNUNG = 700, RISS = 550, VERSATZ = 950;
      const oeffnen = el => {
        el.classList.add('is-anspannung');
        setTimeout(() => {
          el.classList.remove('is-anspannung');
          el.classList.add('is-riss');
        }, ANSPANNUNG);
        setTimeout(() => el.classList.add('is-offen'), ANSPANNUNG + RISS);
      };
      const packIO = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          obs.unobserve(entry.target);
          setTimeout(() => {
            packs.forEach((el, i) => setTimeout(() => oeffnen(el), i * VERSATZ));
          }, 2000);
        });
      }, { threshold: 0.3 });
      packIO.observe(paketReihe);
    }
  }

  /* ---- Pakete: Karte per Klick/Tastatur umdrehen ----
     Die Karte selbst ist kein Link mehr, sondern ein umschaltbarer Kippkörper
     — nur der "Paket wählen"-Link auf der Rückseite navigiert wirklich weg.
     Klicks auf diesen Link dürfen die Karte also nicht mehr zusätzlich
     umdrehen.
     Der Button sitzt bewusst nicht auf der ganzen Karte, sondern nur auf dem
     "Bitte klicken"-Hinweis vorn bzw. dem "Schließen"-Hinweis hinten: ein
     role="button" darf laut ARIA keine eigenen interaktiven Kinder haben,
     und der echte "Paket wählen"-Link saß vorher genau in so einem
     verschachtelten Button. Die jeweils abgewandte Seite bekommt
     tabindex="-1", sonst lässt sie sich mit Tab anspringen, obwohl sie wegen
     backface-visibility unsichtbar ist. */
  packs.forEach(el => {
    const hinweis = el.querySelector('.tier__hinweis');
    const zurueck = el.querySelector('.tier__zurueck');
    const link = el.querySelector('.tier__cta');
    if (!hinweis || !zurueck) return;

    const zustandSetzen = (offen) => {
      el.classList.toggle('ist-geflippt', offen);
      hinweis.setAttribute('tabindex', offen ? '-1' : '0');
      zurueck.setAttribute('tabindex', offen ? '0' : '-1');
      if (link) link.setAttribute('tabindex', offen ? '0' : '-1');
    };
    const umdrehen = () => zustandSetzen(!el.classList.contains('ist-geflippt'));

    el.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      umdrehen();
    });
    [hinweis, zurueck].forEach(trigger => {
      trigger.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        umdrehen();
      });
    });
  });

  /* ---- Zahlen hochzählen ---- */
  const counters = document.querySelectorAll('[data-count]:not([data-plain])');
  const countIO = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.count, 10);
      if (reduced) { el.textContent = target; obs.unobserve(el); return; }
      const duration = 1400;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(el => countIO.observe(el));

  /* ---- Sanfter Parallax im Hero ---- */
  const parallax = document.querySelector('[data-parallax]');
  if (parallax && !reduced) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < window.innerHeight * 1.2) {
          parallax.style.transform = `translate3d(0, ${y * 0.22}px, 0)`;
        }
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---- Anker zu "#team" zeigt sonst nur die Köpfe, nicht die Namen ----
     Die Köpfe + Kicker + Überschrift sind auf kürzeren Bildschirmen (z.B.
     1366×768) zusammen schon höher als der Viewport, der normale
     Anker-Sprung landet also genau an der Falz. Nach dem Sprung notfalls
     um den fehlenden Rest nachscrollen, damit der erste Name sichtbar ist. */
  const teamNachjustieren = () => {
    if (location.hash !== '#team') return;
    const name = document.querySelector('#team .team__grid h3');
    if (!name) return;
    const fertig = () => {
      const ueberstand = name.getBoundingClientRect().bottom - window.innerHeight;
      if (ueberstand > 0) {
        window.scrollBy({ top: ueberstand + 16, behavior: reduced ? 'auto' : 'smooth' });
      }
    };
    if ('onscrollend' in window) {
      const einmal = () => { window.removeEventListener('scrollend', einmal); setTimeout(fertig, 30); };
      window.addEventListener('scrollend', einmal);
    } else {
      setTimeout(fertig, 500);
    }
  };
  window.addEventListener('hashchange', teamNachjustieren);
  document.querySelectorAll('a[href$="#team"]').forEach(a => a.addEventListener('click', teamNachjustieren));

});
