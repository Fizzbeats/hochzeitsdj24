/* =====================================================
   HochzeitsDJ24 — Profil
   Profilbild und Anzeigename, für DJ- und Kundenzugang gleichermaßen.
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  const $ = id => document.getElementById(id);
  let nutzer = null, aktuellesBild = null;

  const buchstabe = () => (($('anzeigename').value || nutzer?.email || '?').trim().charAt(0) || '?').toUpperCase();

  const zeichneAvatar = () => {
    $('avatarVorschau').innerHTML = aktuellesBild
      ? `<img src="${aktuellesBild}" alt="">`
      : buchstabe();
  };

  async function start() {
    nutzer = await DB.aktuellerNutzer();
    if (!nutzer) { location.href = 'kundenbereich.html'; return; }

    const profil = await DB.profilLesen();
    aktuellesBild = profil.bild || null;
    $('anzeigename').value = profil.name || '';
    $('emailAnzeige').value = nutzer.email;
    zeichneAvatar();
  }
  start();

  $('bildWaehlen').addEventListener('click', () => $('bildInput').click());

  $('bildInput').addEventListener('change', () => {
    const datei = $('bildInput').files[0];
    if (!datei) return;
    if (!datei.type.startsWith('image/')) { $('bildStatus').textContent = 'Bitte eine Bilddatei wählen.'; return; }

    const bild = new Image();
    const leser = new FileReader();
    leser.onload = () => { bild.src = leser.result; };
    bild.onload = () => {
      // Auf ein handliches Quadrat zuschneiden, damit das Bild klein bleibt
      // (im Demo-Modus landet es 1:1 in localStorage, im Echtbetrieb in den
      // Nutzer-Metadaten von Supabase — beides ohne eigenes Speicher-Bucket).
      const groesse = 200;
      const canvas = document.createElement('canvas');
      canvas.width = groesse; canvas.height = groesse;
      const ctx = canvas.getContext('2d');
      const seite = Math.min(bild.width, bild.height);
      const sx = (bild.width - seite) / 2, sy = (bild.height - seite) / 2;
      ctx.drawImage(bild, sx, sy, seite, seite, 0, 0, groesse, groesse);
      aktuellesBild = canvas.toDataURL('image/jpeg', 0.85);
      zeichneAvatar();
      $('bildStatus').textContent = 'Neues Bild ausgewählt — zum Übernehmen auf „Speichern“ klicken.';
    };
    leser.readAsDataURL(datei);
  });

  $('bildEntfernen').addEventListener('click', () => {
    aktuellesBild = null;
    zeichneAvatar();
    $('bildStatus').textContent = 'Bild wird beim Speichern entfernt.';
  });

  $('speichern').addEventListener('click', async () => {
    $('status').textContent = 'Wird gespeichert …';
    try {
      await DB.profilSchreiben({ bild: aktuellesBild, name: $('anzeigename').value.trim() });
      location.reload();
    } catch (e) {
      $('status').textContent = 'Das hat nicht geklappt: ' + e.message;
    }
  });

});
