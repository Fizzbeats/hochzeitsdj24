// =====================================================
// HochzeitsDJ24 — E-Mail-Benachrichtigung bei neuer Anfrage
// Wird per Datenbank-Webhook bei jedem INSERT in "anfragen" aufgerufen
// (Einrichtung siehe SETUP.md, Abschnitt "E-Mail-Benachrichtigung").
// =====================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ZIEL_EMAIL = Deno.env.get("BENACHRICHTIGUNG_EMAIL") ?? "jenswinter@email.de";
// Muss bei Resend als verifizierter Absender/Domain eingetragen sein.
const ABSENDER_EMAIL = Deno.env.get("ABSENDER_EMAIL") ?? "anfragen@hochzeitsdj24.de";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Nur POST erlaubt", { status: 405 });
  }
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY fehlt als Supabase-Secret.");
    return new Response("Konfiguration unvollständig", { status: 500 });
  }

  let payload: { record?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return new Response("Ungültiger Payload", { status: 400 });
  }

  // Der Datenbank-Webhook liefert die neue Zeile im Feld "record".
  const anfrage = payload.record;
  if (!anfrage) return new Response("Kein Datensatz im Payload", { status: 400 });

  const daten = (anfrage.daten ?? {}) as Record<string, any>;
  const kunde = daten.kunde ?? {};
  const event = daten.event ?? {};
  const paket = daten.paket ?? null;

  const name = [kunde.vorname, kunde.nachname].filter(Boolean).join(" ") || "Unbekannt";
  const anlass = event.anlass || "Anlass unbekannt";
  const datum = event.datum
    ? new Date(event.datum + "T12:00:00").toLocaleDateString("de-DE", {
        weekday: "long", day: "2-digit", month: "2-digit", year: "numeric"
      })
    : "Datum offen";
  const ort = [event.location, event.location_adresse].filter(Boolean).join(", ") || "—";
  const paketZeile = paket ? `Gewähltes Paket: ${paket.name} (${paket.preis} € pauschal)<br>` : "";

  const betreff = `Neue Angebotsanfrage — ${name} (${anlass})`;
  const html = `
    <div style="font-family:sans-serif;font-size:15px;color:#222">
      <p><strong>Neue Angebotsanfrage über HochzeitsDJ24.de</strong></p>
      <p>
        Name: ${escapeHtml(name)}<br>
        Anlass: ${escapeHtml(anlass)}<br>
        Datum: ${escapeHtml(datum)}<br>
        Ort: ${escapeHtml(ort)}<br>
        ${paketZeile}
        E-Mail: ${escapeHtml(kunde.email || "—")}<br>
        Telefon: ${escapeHtml(kunde.telefon || "—")}
      </p>
      <p>Details und Kalkulation wie gewohnt im DJ-Cockpit.</p>
    </div>`;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `HochzeitsDJ24 <${ABSENDER_EMAIL}>`,
      to: [ZIEL_EMAIL],
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

/** Nur zur eigenen Absicherung im HTML der E-Mail — verhindert, dass
    Freitext aus dem öffentlichen Formular als HTML interpretiert wird. */
function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
