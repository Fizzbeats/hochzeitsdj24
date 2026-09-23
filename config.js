/* =====================================================
   HochzeitsDJ24 — Zentrale Konfiguration
   Hier trägt Jens Winter alle Stammdaten und Preise ein.
   ===================================================== */

const CONFIG = {

  /* ---- Anbieter (Vertragspartner 2) ---- */
  anbieter: {
    firma: 'Winter Entertainment',
    vertreten: 'vertreten durch Herrn Jens Winter',
    strasse: 'Beyerstraße 31',
    plz_ort: '09113 Chemnitz',
    kuenstlername: 'Dee Jay Double J',
    telefon: '0371 - 46404880',
    fax: '03212 - 4584001',
    mobil: '0176 – 77 444 888',
    web: 'www.HochzeitsDJ24.de',
    web2: 'www.dj-double-j.de',
    email: 'jenswinter@email.de',
    bank: 'Postbank',
    blz: '100 100 10',
    konto: '692 17 11 38',
    bic: 'PBNKDEFFXXX',
    iban: 'DE58 1001 0010 0692 1711 38',
    finanzamt: 'Finanzamt Chemnitz',
    steuernummer: '215 / 287 / 01016'
  },

  /* ---- Preise: nur hier ändern ----
     Alle Beträge sind Endpreise inkl. der gesetzlichen Mehrwertsteuer —
     die MwSt. wird intern herausgerechnet und ausgewiesen, kommt aber
     nicht zusätzlich oben drauf. */
  preise: {
    satz_empfang: 35.00,        // € pro Stunde, Sektempfang / Hintergrundmusik (interne Kalkulation)
    satz_party: 70.00,          // € pro Stunde, Party (interne Kalkulation)
    technik: 150.00,            // Technik Variante A: 2 Boxen, LED-Licht, 1 Funkmikrofon
    technik_b: 250.00,          // Technik Variante B: große Anlage, 4 Funkmikros, Floorspots
    entertainment: 100.00,      // Pauschale Entertainmentprogramm
    kinderanimation: 50.00,     // 30–60 Minuten Programm, 50–250 € je nach Umfang (Ansatz)
    open_end: 100.00,           // Party Open End, pauschal ab 1 Uhr
    fotobox: 0.00,              // veraltet, bleibt für alte Anfragen
    fotobox_standard: 200.00,   // digitale Bilder per E-Mail, ohne Ausdruck
    fotobox_deluxe: 250.00,     // digitale Bilder plus 108 Ausdrucke vor Ort
    remix: 50.00,               // Hochzeitstanz Produktion, inkl. 2 Korrekturen
    remix_korrektur: 10.00,     // je weitere Korrektur über die 2 inklusive hinaus
    mwst_satz: 19               // Prozent
  },

  /* ---- Pakete: feste Pauschalpreise von der Startseite ----
     "enthalten" listet die Leistungen, die im Paketpreis bereits
     drinstecken — alles andere kommt im Angebot obendrauf. */
  /* anlaesse: null = passt zu jedem Anlass. partyStundenMax/empfangStundenMax
     grenzen ein, bis zu welcher Dauer das Paket noch passt — wird für die
     automatische Paket-Empfehlung in der freien Angebotserstellung genutzt. */
  pakete: {
    'geburtstag':        { name: 'Geburtstag & Feier',       preis: 500, enthalten: ['technik'],
                            anlaesse: null, partyStundenMax: 5, empfangStundenMax: 0 },
    'hochzeit-komplett': { name: 'Hochzeit Komplett',        preis: 845, enthalten: ['technik', 'entertainment'],
                            anlaesse: ['Hochzeit'], partyStundenMax: 8, empfangStundenMax: 1 },
    'hochzeit-deluxe':   { name: 'Hochzeit Deluxe',          preis: 945, enthalten: ['technik', 'entertainment', 'open_end'],
                            anlaesse: ['Hochzeit'], partyStundenMax: 24, empfangStundenMax: 1 },
    'hochzeitstanz':     { name: 'Hochzeitstanz Produktion', preis: 50,  enthalten: ['remix'] }
  },

  /* ---- Aufbewahrung ---- */
  aufbewahrung: {
    anfrage_tage: 90,           // unbestätigte Anfragen werden nach X Tagen gelöscht
    nach_feier_tage: 30         // Zugang wird X Tage nach der Feier geschlossen
  },

  /* ---- Supabase ---- */
  supabase: {
    url: 'https://ckturqjmpmnmdhprcofd.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrdHVycWptcG1ubWRocHJjb2ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMDg5MTksImV4cCI6MjEwMDg4NDkxOX0.yaefDYHU-oL6i0clG723VeolRbGY5Ai22jVlbHYvhGo'
  }
};

if (typeof window !== 'undefined') window.CONFIG = CONFIG;
