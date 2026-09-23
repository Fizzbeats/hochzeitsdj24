/* =====================================================
   HochzeitsDJ24 — Einheitliche Navigation
   Wird auf jeder Seite eingebunden und erzeugt denselben
   Header inklusive Burger-Menü und Login-Status.
   ===================================================== */

(function () {

  const datei = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const istStart = datei === '' || datei === 'index.html';
  const zuStart = istStart ? '' : 'index.html';

  /* Auf der Startseite liegt der Header über dem dunklen Hero,
     auf allen anderen Seiten ist er von Anfang an hell. */
  const transparent = istStart;

  /* "Angebotserstellung" ist bewusst kein eigener Listenpunkt: der goldene
     Button im Menüfuß führt bereits zu angebot.html, ein zweiter Link mit
     demselben Ziel direkt darüber wäre nur Dopplung. */
  const links = [
    { text: 'Leistungen',   href: zuStart + '#leistungen' },
    { text: 'Ablauf',       href: zuStart + '#ablauf' },
    { text: 'Team',         href: zuStart + '#team' },
    { text: 'Impressionen', href: zuStart + '#galerie' },
    { text: 'Preise',       href: zuStart + '#investition' },
    { text: 'Fragen',       href: zuStart + '#faq' }
  ];

  const aktiv = h => (h === datei || (istStart && h.startsWith('#'))) ? ' class="is-active"' : '';

  const html = `
    <header class="header${transparent ? '' : ' header--solid is-stuck'}" id="header">
      <div class="shell header__inner">

        <!-- links: Wortmarke, daneben das Menü -->
        <div class="header__links">
          <a href="${zuStart || 'index.html'}" class="wordmark" id="wortmarke">Hochzeits<span>DJ</span>24</a>
          <button class="burger" id="burger" aria-label="Menü öffnen" aria-expanded="false" aria-controls="nav">
            <span class="burger__striche" aria-hidden="true"><span></span><span></span><span></span></span>
            <span class="burger__wort">Menü</span>
          </button>
        </div>

        <!-- ganz rechts: Entwicklung/Cockpit-Zugang (nur für Verwalter/Entwickler) und Anmeldung -->
        <div class="header__actions">
          <!-- Nur für Entwickler: schneller Wechsel zwischen allen drei Bereichen
               zum Testen, statt jedes Mal über die Seitenkarte zu gehen. -->
          <a href="kundenbereich.html" class="header__loginlink header__loginlink--text" id="kundenbereichLink" aria-label="Zum Kundenbereich" style="display:none">
            <span>Kundenbereich</span>
          </a>
          <a href="admin.html" class="header__loginlink header__loginlink--text" id="cockpitLink" aria-label="Zum Cockpit" style="display:none">
            <span>Cockpit</span>
          </a>
          <a href="entwicklung.html" class="header__loginlink header__loginlink--text" id="entwicklungLink" aria-label="Zur Entwicklung" style="display:none">
            <span>Entwicklung</span>
          </a>
          <a href="kundenbereich.html" class="header__loginlink" id="loginLink" aria-label="Anmelden">
            <span class="header__loginicon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>
              </svg>
            </span>
            <span id="loginText">Anmelden</span>
          </a>
        </div>

      </div>
    </header>

    <!-- Menü über die ganze Fläche. Bewusst außerhalb von <header>: der Header
         bekommt auf hellen Unterseiten einen backdrop-filter, der sonst einen
         neuen Bezugsrahmen für "position: fixed" erzeugt und das Menü auf die
         Kopfzeilenhöhe zusammenstaucht statt es über den ganzen Bildschirm zu legen. -->
    <nav class="nav" id="nav" aria-label="Hauptmenü">
      <div class="nav__inner">
        <ol class="nav__liste">
          ${links.map((l, i) => `
            <li style="--i:${i}">
              <a href="${l.href}"${aktiv(l.href)}><span class="nav__nr">0${i + 1}</span>${l.text}</a>
            </li>`).join('')}
        </ol>

        <div class="nav__fuss">
          <div class="nav__aktionen">
            <a href="angebot.html" class="btn btn--gold nav__vertrag">Angebot anfragen</a>
            <a href="profil.html" class="nav__login" id="navProfil" style="display:none">Mein Profil</a>
          </div>
          <div class="nav__kontakt">
            <a href="tel:+4917677444888">0176 – 77 444 888</a>
            <a href="mailto:jenswinter@email.de">jenswinter@email.de</a>
          </div>
        </div>
      </div>
    </nav>`;

  const halter = document.getElementById('site-header');
  if (halter) halter.outerHTML = html;
  else document.body.insertAdjacentHTML('afterbegin', html);

  /* ---------- Verhalten ---------- */
  document.addEventListener('DOMContentLoaded', () => {

    const header = document.getElementById('header');
    const nav    = document.getElementById('nav');
    const burger = document.getElementById('burger');

    if (transparent && header) {
      const beimScrollen = () => header.classList.toggle('is-stuck', window.scrollY > 80);
      beimScrollen();
      window.addEventListener('scroll', beimScrollen, { passive: true });
    }

    if (burger && nav) {
      const umschalten = (offen) => {
        nav.classList.toggle('is-open', offen);
        burger.classList.toggle('is-open', offen);
        header.classList.toggle('header--menue', offen);
        burger.setAttribute('aria-expanded', offen);
        burger.setAttribute('aria-label', offen ? 'Menü schließen' : 'Menü öffnen');
        document.body.style.overflow = offen ? 'hidden' : '';
      };

      burger.addEventListener('click', () => umschalten(!nav.classList.contains('is-open')));
      nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => umschalten(false)));
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && nav.classList.contains('is-open')) umschalten(false);
      });
    }

    /* ---------- Logo-Klick: Startseite mit Animation neu laden ---------- */
    const wortmarke = document.getElementById('wortmarke');
    if (wortmarke) {
      wortmarke.addEventListener('click', e => {
        // Nur die Vorhang-Animation läuft erneut. Die geführte Einführung
        // bleibt bewusst aus, sonst sähe man sie bei jedem Klick aufs Logo wieder.
        sessionStorage.removeItem('hdj24_intro');

        if (istStart) {
          e.preventDefault();
          if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
          location.replace('index.html');   // lädt die Seite neu, Intro startet
        }
      });
    }

    /* ---------- Anmeldestatus ----------
       Ein einziger Status für die ganze Seite: derselbe DJ-/Kunden-Zugang
       gilt überall. Angemeldet -> Button meldet direkt ab. Nicht angemeldet
       -> auf Seiten mit eigenem Formular (admin.html, kundenbereich.html)
       dorthin scrollen statt auf eine andere Seite zu wechseln. */
    if (window.DB) {
      const loginLink    = document.getElementById('loginLink');
      const loginText    = document.getElementById('loginText');
      const navProfil       = document.getElementById('navProfil');
      const cockpitLink     = document.getElementById('cockpitLink');
      const entwicklungLink = document.getElementById('entwicklungLink');
      const kundenbereichLink = document.getElementById('kundenbereichLink');
      const eigenesLogin    = !!document.getElementById('auth');

      const abmelden = async (e) => {
        e.preventDefault();
        await DB.abmelden();
        location.reload();
      };

      DB.aktuellerNutzer().then(async nutzer => {
        if (nutzer) {
          if (loginLink) {
            loginLink.setAttribute('href', '#');
            loginLink.setAttribute('aria-label', 'Abmelden');
            loginLink.classList.add('is-angemeldet');
            loginLink.addEventListener('click', abmelden);
          }
          if (loginText) loginText.textContent = 'Abmelden';
          if (navProfil) navProfil.style.display = '';

          const nutzerIstVerwalter  = await DB.istVerwalter().catch(() => false);
          const nutzerIstEntwickler = await DB.istEntwickler().catch(() => false);

          if (nutzerIstEntwickler) {
            // Entwickler bekommen alle drei Bereiche direkt im Header, um
            // beim Testen schnell zwischen ihnen zu wechseln.
            if (kundenbereichLink) kundenbereichLink.style.display = '';
            if (cockpitLink) cockpitLink.style.display = '';
            if (entwicklungLink) entwicklungLink.style.display = '';
          } else if (cockpitLink && nutzerIstVerwalter) {
            cockpitLink.style.display = '';
          }

          const profil = await DB.profilLesen().catch(() => ({}));
          const icon = loginLink?.querySelector('.header__loginicon');
          if (icon && profil?.bild) {
            icon.innerHTML = `<img src="${profil.bild}" alt="" class="header__loginbild">`;
            icon.classList.add('header__loginicon--bild');
          }
        } else {
          const ziel = eigenesLogin ? '#auth' : 'kundenbereich.html';
          loginLink?.setAttribute('href', ziel);
        }
      }).catch(() => {});
    }

    /* Jahreszahl im Footer, falls vorhanden */
    const jahr = document.getElementById('jahr');
    if (jahr) jahr.textContent = new Date().getFullYear();

    /* ---------- Sanfter Seitenübergang ----------
       Beim Klick auf einen internen Link erst kurz ausblenden, dann erst
       wechseln — statt des harten Sprungs zwischen zwei Seiten. Anker auf
       derselben Seite, externe Links, neue Tabs usw. bleiben unangetastet. */
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.addEventListener('click', e => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = e.target.closest('a');
        if (!a) return;
        const href = a.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
        if (a.target && a.target !== '_self') return;
        if (a.hasAttribute('download')) return;

        let ziel;
        try { ziel = new URL(href, location.href); } catch { return; }
        if (ziel.origin !== location.origin) return;
        if (ziel.pathname === location.pathname && ziel.hash) return; // Anker auf derselben Seite

        e.preventDefault();
        document.body.classList.add('seite-verlaesst');
        setTimeout(() => { location.href = ziel.href; }, 220);
      });
    }
  });

})();
