/* =====================================================
   HochzeitsDJ24 — FAQ
   Lädt Fragen/Antworten aus der Datenbank (im Entwickler-
   Bereich bearbeitbar) und erzeugt daraus sowohl die
   sichtbare Liste als auch die FAQPage-Suchmaschinendaten —
   beide aus derselben Quelle, bleiben also immer synchron.
   ===================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const liste = document.getElementById('faqListe');
  if (!liste) return;

  // Freitext aus der Datenbank kommt zwar nur von Verwaltern/Entwicklern,
  // wird aber trotzdem escaped — kostet nichts und schützt auch bei einem
  // versehentlichen Tippfehler mit einem "<" vor kaputtem HTML.
  const esc = text => {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
  };

  // Entspricht den sechs ursprünglichen Fragen — greift nur, wenn die
  // Datenbank (noch) nicht konfiguriert ist oder das Laden fehlschlägt,
  // damit die Seite nie ohne FAQ dasteht.
  const STANDARD_FAQ = [
    { frage: 'Was ist im Paketpreis schon enthalten?', antwort: 'Alles, was auf der Paket-Karte steht — Sie zahlen die Pauschale, keine Stundenabrechnung und keine Überraschung danach. Zusatzwünsche wie eine zweite Technik-Variante, Kinderanimation oder Fotobox stehen einzeln mit Preis dabei, bevor Sie sich entscheiden.' },
    { frage: 'Muss ich mich anmelden, um ein Angebot zu bekommen?', antwort: 'Nein. Sie können die Angebotserstellung komplett ohne Konto durchlaufen und wir melden uns per E-Mail. Ein Konto lohnt sich nur, wenn Sie den Stand Ihrer Anfrage jederzeit online sehen möchten — das ist aber optional.' },
    { frage: 'Was, wenn mir das freigegebene Angebot nicht ganz passt?', antwort: 'Bevor Sie verbindlich zusagen, sehen Sie den vollständigen Preis schwarz auf weiß und können direkt im Kundenbereich mit Jens chatten — für Rückfragen oder Änderungswünsche. Erst wenn Sie zufrieden sind, nehmen Sie das Angebot an.' },
    { frage: 'Was passiert, wenn einer von euch krank wird?', antwort: 'Wir sind zu dritt und geben jedem Kollegen vorab Ihr komplettes Musikprofil und alle Absprachen mit. Ihr Abend findet in jedem Fall statt.' },
    { frage: 'Fahrt ihr auch außerhalb von Chemnitz?', antwort: 'Ja, deutschlandweit. Die Anfahrt hängt von der Entfernung ab und steht mit im Angebotsentwurf, bevor Sie sich festlegen.' },
    { frage: 'Wie schnell bekomme ich eine Antwort?', antwort: 'Spätestens übermorgen, meist schneller — und von Jens persönlich, nicht automatisch.' }
  ];

  let eintraege;
  try {
    eintraege = await DB.faqLaden();
    if (!eintraege || !eintraege.length) eintraege = STANDARD_FAQ;
  } catch {
    eintraege = STANDARD_FAQ;
  }

  liste.innerHTML = eintraege.map(f => `
    <details class="faq__item">
      <summary>${esc(f.frage)}</summary>
      <p>${esc(f.antwort)}</p>
    </details>`).join('');

  // Dieselben Daten auch als FAQPage-Suchmaschinendaten eintragen, damit
  // Google einzelne Fragen direkt im Suchergebnis anzeigen kann — ohne
  // zweite, separat zu pflegende Textquelle.
  const jsonLd = document.getElementById('faqJsonLd');
  if (jsonLd) {
    jsonLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: eintraege.map(f => ({
        '@type': 'Question',
        name: f.frage,
        acceptedAnswer: { '@type': 'Answer', text: f.antwort }
      }))
    });
  }
});
