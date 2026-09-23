// =====================================================
// HochzeitsDJ24 — E-Mail an den Kunden, sobald Jens das Angebot freigibt
// Wird per Datenbank-Webhook bei jedem UPDATE in "anfragen" aufgerufen
// (Einrichtung siehe SETUP.md, Abschnitt "E-Mail-Benachrichtigung").
// Feuert nur beim Übergang zu status = 'freigegeben', nicht bei jeder
// weiteren Änderung (z. B. "als bezahlt markieren").
// =====================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ABSENDER_EMAIL = Deno.env.get("ABSENDER_EMAIL") ?? "anfragen@hochzeitsdj24.de";
const SEITE_URL = Deno.env.get("SEITE_URL") ?? "https://www.hochzeitsdj24.de";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Nur POST erlaubt", { status: 405 });
  }
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY fehlt als Supabase-Secret.");
    return new Response("Konfiguration unvollständig", { status: 500 });
  }

  let payload: { record?: Record<string, unknown>; old_record?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return new Response("Ungültiger Payload", { status: 400 });
  }

  const neu = payload.record;
  const alt = payload.old_record;
  if (!neu) return new Response("Kein Datensatz im Payload", { status: 400 });

  // Nur beim ersten Wechsel auf "freigegeben" eine Mail schicken.
  if (neu.status !== "freigegeben" || alt?.status === "freigegeben") {
    return new Response("Kein relevanter Übergang — keine Mail nötig.", { status: 200 });
  }

  const daten = (neu.daten ?? {}) as Record<string, any>;
  const kunde = daten.kunde ?? {};

  // kunde_mail deckt sowohl angemeldete Kunden als auch anonyme Anfragen ab.
  const empfaenger = (neu.kunde_mail as string | undefined) || kunde.email;
  if (!empfaenger) {
    console.error("Keine E-Mail-Adresse für diese Anfrage gefunden:", neu.id);
    return new Response("Keine Empfänger-Adresse vorhanden", { status: 200 });
  }

  const event = daten.event ?? {};
  const anlass = event.anlass || "Ihre Feier";
  const datum = event.datum
    ? new Date(event.datum + "T12:00:00").toLocaleDateString("de-DE", {
        weekday: "long", day: "2-digit", month: "2-digit", year: "numeric"
      })
    : "";
  const name = kunde.vorname ? `Liebe/r ${escapeHtml(kunde.vorname)}` : "Hallo";

  const betreff = `Ihr Angebot ist da — ${anlass}${datum ? ' am ' + datum : ''}`;
  const html = `
    <div style="font-family:sans-serif;font-size:15px;color:#222;line-height:1.6">
      <p>${name},</p>
      <p>
        Jens Winter hat Ihr persönliches Angebot für ${escapeHtml(anlass)}${datum ? ' am ' + escapeHtml(datum) : ''}
        geprüft und freigegeben. Sie können es jetzt in Ihrem Kundenbereich ansehen,
        als PDF herunterladen und verbindlich annehmen.
      </p>
      <p>
        <a href="${SEITE_URL}/kundenbereich.html" style="color:#b4901f;font-weight:600">
          Jetzt Angebot ansehen →
        </a>
      </p>
      <p>
        Passt etwas noch nicht ganz? Schreiben Sie uns einfach direkt im Kundenbereich
        über den Chat — Jens meldet sich persönlich.
      </p>
      <p>Herzliche Grüße<br>Jens Winter · HochzeitsDJ24</p>
    </div>`;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `HochzeitsDJ24 <${ABSENDER_EMAIL}>`,
      to: [empfaenger],
      subject: betreff,
      html
    })
  });

  if (!resendResponse.ok) {
    const fehler = await resendResponse.text();
    console.error("Resend-Fehler:", fehler);
    return new Response("E-Mail-Versand fehlgeschlagen: " + fehler, { status: 502 });
  }

  return new Response("OK", { status: 200 });
});

/** Nur zur eigenen Absicherung im HTML der E-Mail. */
function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
