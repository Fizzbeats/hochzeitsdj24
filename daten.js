/* =====================================================
   HochzeitsDJ24 — Datenschicht
   Nutzt Supabase, sobald in config.js eingetragen.
   Ohne Konfiguration läuft alles lokal im Demo-Modus,
   damit die Seite auch ohne Server getestet werden kann.
   ===================================================== */

const DB = (() => {

  const konfiguriert = () =>
    CONFIG.supabase.url && !CONFIG.supabase.url.includes('DEIN-PROJEKT');

  let client = null;
  const sb = () => {
    if (!konfiguriert()) return null;
    if (!client && window.supabase) {
      client = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
    }
    return client;
  };

  /* ---------- Demo-Speicher ---------- */
  const SCHLUESSEL = 'hdj24_anfragen';
  const lokalLesen = () => JSON.parse(localStorage.getItem(SCHLUESSEL) || '[]');
  const lokalSchreiben = a => localStorage.setItem(SCHLUESSEL, JSON.stringify(a));

  const id = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- Anfragen ---------- */

  async function speichereAnfrage(daten) {
    const nutzer = await aktuellerNutzer();

    const satz = {
      id: id(),
      status: 'neu',
      erstellt: new Date().toISOString(),
      kunde_mail: nutzer?.email || daten.kunde?.email || null,
      daten,
      preise: null,
      freigegeben: null
    };

    const c = sb();
    if (c) {
      const zeile = {
        status: satz.status,
        kunde_id: nutzer?.id || null,
        daten: satz.daten,
        event_datum: daten.event?.datum || null
      };

      /* Angemeldete Kunden dürfen ihre eigene Zeile lesen — dann geben wir
         sie direkt zurück. Anonyme Besucher dürfen nichts lesen, deshalb
         wird ihre Anfrage ohne Rücklese eingefügt (sonst lehnt die
         Zeilensicherheit den ganzen Vorgang ab). */
      if (nutzer) {
        const { data, error } = await c.from('anfragen').insert(zeile).select().single();
        if (error) throw error;
        return data;
      }
      const { error } = await c.from('anfragen').insert(zeile);
      if (error) throw error;
      return satz;
    }

    const alle = lokalLesen();
    alle.unshift(satz);
    lokalSchreiben(alle);
    return satz;
  }

  /** Verwalter erhalten alle Anfragen, Kunden nur ihre eigenen.
      Im Echtbetrieb sorgt die Zeilensicherheit der Datenbank dafür. */
  async function ladeAnfragen(nurEigene = false) {
    const c = sb();
    if (c) {
      const { data, error } = await c.from('anfragen')
        .select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }

    const alle = lokalLesen();
    if (!nurEigene) return alle;
    const nutzer = await aktuellerNutzer();
    if (!nutzer) return [];
    return alle.filter(a => a.kunde_mail === nutzer.email);
  }

  async function ladeAnfrage(anfrageId) {
    const c = sb();
    if (c) {
      const { data, error } = await c.from('anfragen').select('*').eq('id', anfrageId).single();
      if (error) throw error;
      return data;
    }
    return lokalLesen().find(a => a.id === anfrageId) || null;
  }

  async function aktualisiere(anfrageId, felder) {
    const c = sb();
    if (c) {
      const { data, error } = await c.from('anfragen').update(felder).eq('id', anfrageId).select().single();
      if (error) throw error;
      return data;
    }
    const alle = lokalLesen();
    const i = alle.findIndex(a => a.id === anfrageId);
    if (i > -1) { alle[i] = { ...alle[i], ...felder }; lokalSchreiben(alle); return alle[i]; }
    return null;
  }

  async function freigeben(anfrageId, preise) {
    return aktualisiere(anfrageId, {
      status: 'freigegeben',
      preise,
      freigegeben: new Date().toISOString()
    });
  }

  async function loeschen(anfrageId) {
    const c = sb();
    if (c) {
      const { error } = await c.from('anfragen').delete().eq('id', anfrageId);
      if (error) throw error;
      return true;
    }
    lokalSchreiben(lokalLesen().filter(a => a.id !== anfrageId));
    return true;
  }

  /** Der Kunde bestätigt ein freigegebenes Angebot verbindlich. Läuft im
      Echtbetrieb über eine eigene Funktion in der Datenbank (nicht über
      ein normales Update), damit ein Kunde ausschließlich seine eigene,
      bereits freigegebene Anfrage annehmen kann. */
  async function angebotAnnehmen(anfrageId) {
    const c = sb();
    if (c) {
      const { error } = await c.rpc('angebot_annehmen', { anfrage_id: anfrageId });
      if (error) throw error;
      return;
    }
    await aktualisiere(anfrageId, { angenommen: new Date().toISOString() });
  }

  /** Rückfrage oder Änderungswunsch des Kunden zu einem freigegebenen
      Angebot — ersetzt eine vorherige Nachricht, kein Verlauf. */
  async function rueckfrageSenden(anfrageId, nachricht) {
    const c = sb();
    if (c) {
      const { error } = await c.rpc('rueckfrage_senden', { anfrage_id: anfrageId, nachricht });
      if (error) throw error;
      return;
    }
    await aktualisiere(anfrageId, { rueckfrage: nachricht, rueckfrage_am: new Date().toISOString() });
  }

  /* ---------- Feedback-Chat zwischen Kunde und DJ ----------
     Nach der Freigabe kann der Kunde Fragen zum Preis oder Änderungswünsche
     direkt an den DJ schreiben; der DJ antwortet im Cockpit. Der Verlauf
     hängt als Liste an der Anfrage und ist für beide Seiten sichtbar. */

  async function chatSenden(anfrageId, text) {
    const absender = (await istVerwalter()) ? 'dj' : 'kunde';
    const eintrag = { von: absender, text, zeit: new Date().toISOString() };

    const c = sb();
    if (c) {
      // Im Echtbetrieb prüft die Datenbankfunktion, dass nur der DJ oder
      // der Besitzer der Anfrage schreiben darf.
      const { error } = await c.rpc('chat_senden', { anfrage_id: anfrageId, nachricht: text });
      if (error) throw error;
      return eintrag;
    }

    const anfrage = await ladeAnfrage(anfrageId);
    const chat = Array.isArray(anfrage?.chat) ? anfrage.chat : [];
    chat.push(eintrag);
    await aktualisiere(anfrageId, { chat });
    return eintrag;
  }

  function chatVon(anfrage) {
    const chat = Array.isArray(anfrage?.chat) ? [...anfrage.chat] : [];
    // Ältere Einzel-Rückfragen erscheinen als erste Chat-Nachricht
    if (anfrage?.rueckfrage && !chat.length) {
      chat.unshift({ von: 'kunde', text: anfrage.rueckfrage, zeit: anfrage.rueckfrage_am || null });
    }
    return chat;
  }

  /* ---------- Anmeldung ---------- */

  async function registrieren(email, passwort) {
    const c = sb();
    if (c) {
      const { data, error } = await c.auth.signUp({
        email,
        password: passwort,
        options: { emailRedirectTo: location.origin + '/kundenbereich.html' }
      });
      if (error) {
        if (/already registered/i.test(error.message))
          throw new Error('Für diese E-Mail besteht bereits ein Konto. Bitte melden Sie sich an.');
        throw new Error(error.message);
      }
      return data.user;
    }
    // Demo-Modus: Konto nur lokal im Browser
    const konten = JSON.parse(localStorage.getItem('hdj24_konten') || '{}');
    if (konten[email]) throw new Error('Für diese E-Mail besteht bereits ein Konto.');
    konten[email] = passwort;
    localStorage.setItem('hdj24_konten', JSON.stringify(konten));
    localStorage.setItem('hdj24_user', email);
    return { email, demo: true };
  }

  async function anmelden(email, passwort) {
    const c = sb();
    if (c) {
      const { data, error } = await c.auth.signInWithPassword({ email, password: passwort });
      if (error) throw new Error('E-Mail oder Passwort ist nicht korrekt.');
      return data.user;
    }
    // Demo-Modus: Verwalterzugang und lokal angelegte Kundenkonten
    if (email === 'demo@hochzeitsdj-24.de' && passwort === 'demo') {
      localStorage.setItem('hdj24_user', email);
      return { email, demo: true };
    }
    const konten = JSON.parse(localStorage.getItem('hdj24_konten') || '{}');
    if (konten[email] && konten[email] === passwort) {
      localStorage.setItem('hdj24_user', email);
      return { email, demo: true };
    }
    throw new Error('E-Mail oder Passwort ist nicht korrekt.');
  }

  async function abmelden() {
    const c = sb();
    if (c) await c.auth.signOut();
    localStorage.removeItem('hdj24_user');
  }

  async function aktuellerNutzer() {
    const c = sb();
    if (c) {
      const { data } = await c.auth.getUser();
      return data?.user || null;
    }
    const e = localStorage.getItem('hdj24_user');
    return e ? { email: e, demo: true } : null;
  }

  /** Ist der angemeldete Nutzer Jens Winter (DJ-Zugang) oder ein Kunde?
      Dieselbe Anmeldung führt je nach Antwort ins Cockpit oder in den
      Kundenbereich – es gibt keinen eigenen "DJ-Modus" beim Anmelden. */
  async function istVerwalter() {
    const nutzer = await aktuellerNutzer();
    if (!nutzer) return false;
    const c = sb();
    if (c) {
      const { data, error } = await c.rpc('ist_verwalter');
      return !error && !!data;
    }
    // Demo-/Lokalmodus: der feste Verwalter-Zugang aus SETUP.md
    return nutzer.email === 'demo@hochzeitsdj-24.de';
  }

  /** Entwickler sind zusätzlich auch Verwalter (können also das Cockpit
      testen), landen nach der Anmeldung aber zuerst auf ihrer eigenen
      Entwicklungsseite statt im Cockpit des Geschäfts. */
  async function istEntwickler() {
    const nutzer = await aktuellerNutzer();
    if (!nutzer) return false;
    const c = sb();
    if (c) {
      const { data, error } = await c.rpc('ist_entwickler');
      return !error && !!data;
    }
    return false; // im Demo-/Lokalmodus nicht relevant
  }

  /* ---------- Profil (Profilbild, Anzeigename) ----------
     Im Echtbetrieb in den user_metadata des angemeldeten Supabase-Nutzers
     abgelegt (kein eigenes Bucket/Tabelle nötig). Im Demo-/Lokalmodus je
     E-Mail-Adresse in localStorage. */

  async function profilLesen() {
    const c = sb();
    if (c) {
      const { data } = await c.auth.getUser();
      const m = data?.user?.user_metadata || {};
      return { bild: m.avatar_url || null, name: m.display_name || null };
    }
    const nutzer = await aktuellerNutzer();
    if (!nutzer) return { bild: null, name: null };
    return JSON.parse(localStorage.getItem('hdj24_profil_' + nutzer.email) || '{}');
  }

  async function profilSchreiben(felder) {
    const c = sb();
    if (c) {
      const patch = {};
      if ('bild' in felder) patch.avatar_url = felder.bild;
      if ('name' in felder) patch.display_name = felder.name;
      const { error } = await c.auth.updateUser({ data: patch });
      if (error) throw error;
      return;
    }
    const nutzer = await aktuellerNutzer();
    if (!nutzer) throw new Error('Nicht angemeldet.');
    const bisher = JSON.parse(localStorage.getItem('hdj24_profil_' + nutzer.email) || '{}');
    localStorage.setItem('hdj24_profil_' + nutzer.email, JSON.stringify({ ...bisher, ...felder }));
  }

  return {
    konfiguriert, speichereAnfrage, ladeAnfragen, ladeAnfrage,
    aktualisiere, freigeben, loeschen, angebotAnnehmen, rueckfrageSenden,
    chatSenden, chatVon,
    registrieren, anmelden, abmelden, aktuellerNutzer, istVerwalter, istEntwickler,
    profilLesen, profilSchreiben
  };
})();

if (typeof window !== 'undefined') window.DB = DB;
