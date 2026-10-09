-- =====================================================
-- HochzeitsDJ24 — Datenbankschema für Supabase
-- Im Supabase-Dashboard unter "SQL Editor" einmal ausführen.
-- =====================================================

-- ---------- Tabelle ----------
create table if not exists public.anfragen (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  status        text not null default 'neu'
                check (status in ('neu', 'geprueft', 'freigegeben')),
  kunde_id      uuid references auth.users(id) on delete set null,
  event_datum   date,
  daten         jsonb not null,          -- Angaben aus dem Fragebogen
  preise        jsonb,                   -- von Jens Winter gesetzte Sätze
  freigegeben   timestamptz,
  angenommen    timestamptz,             -- vom Kunden verbindlich bestätigt
  rueckfrage    text,                    -- Rückfrage/Änderungswunsch des Kunden (alt)
  rueckfrage_am timestamptz,
  chat          jsonb not null default '[]'::jsonb  -- Feedback-Chat Kunde <-> DJ
);

create index if not exists anfragen_kunde_idx on public.anfragen (kunde_id);
create index if not exists anfragen_datum_idx on public.anfragen (event_datum);

-- ---------- Wer ist Verwalter? ----------
create table if not exists public.verwalter (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.ist_verwalter()
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.verwalter v where v.user_id = auth.uid());
$$;

-- ---------- Zeilensicherheit ----------
alter table public.anfragen enable row level security;
alter table public.verwalter enable row level security;

-- Jeder darf eine neue Anfrage anlegen (öffentliches Formular)
drop policy if exists "anfrage anlegen" on public.anfragen;
create policy "anfrage anlegen" on public.anfragen
  for insert to anon, authenticated with check (true);

-- Kunden sehen ausschließlich ihre eigene Anfrage
drop policy if exists "eigene anfrage lesen" on public.anfragen;
create policy "eigene anfrage lesen" on public.anfragen
  for select to authenticated
  using (kunde_id = auth.uid() or public.ist_verwalter());

-- Nur Verwalter dürfen ändern und löschen
drop policy if exists "verwalter aendern" on public.anfragen;
create policy "verwalter aendern" on public.anfragen
  for update to authenticated using (public.ist_verwalter());

drop policy if exists "verwalter loeschen" on public.anfragen;
create policy "verwalter loeschen" on public.anfragen
  for delete to authenticated using (public.ist_verwalter());

drop policy if exists "verwalter liste" on public.verwalter;
create policy "verwalter liste" on public.verwalter
  for select to authenticated using (user_id = auth.uid());

-- ---------- Wer ist Entwickler? ----------
-- Entwickler sind zusätzlich Verwalter (können also das Cockpit testen),
-- landen nach der Anmeldung aber zuerst auf ihrer eigenen Seite
-- (entwicklung.html) statt im Geschäfts-Cockpit.
create table if not exists public.entwickler (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.ist_entwickler()
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.entwickler e where e.user_id = auth.uid());
$$;

alter table public.entwickler enable row level security;

drop policy if exists "entwickler liste" on public.entwickler;
create policy "entwickler liste" on public.entwickler
  for select to authenticated using (user_id = auth.uid());

-- ---------- Zusage / Rückfrage des Kunden ----------
-- Läuft bewusst über eigene Funktionen statt einer offenen Update-Regel,
-- damit ein Kunde ausschließlich diese beiden Felder seiner eigenen,
-- bereits freigegebenen Anfrage ändern kann — sonst nichts.

create or replace function public.angebot_annehmen(anfrage_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.anfragen
     set angenommen = now()
   where id = anfrage_id
     and kunde_id = auth.uid()
     and status = 'freigegeben';
end;
$$;

create or replace function public.rueckfrage_senden(anfrage_id uuid, nachricht text)
returns void language plpgsql security definer as $$
begin
  update public.anfragen
     set rueckfrage = nachricht,
         rueckfrage_am = now()
   where id = anfrage_id
     and kunde_id = auth.uid();
end;
$$;

-- ---------- Feedback-Chat Kunde <-> DJ ----------
-- Kunde und Verwalter schreiben in denselben Verlauf. Der Kunde darf nur
-- an seiner eigenen Anfrage schreiben, der Verwalter an jeder.
create or replace function public.chat_senden(anfrage_id uuid, nachricht text)
returns void language plpgsql security definer as $$
declare
  absender text;
begin
  if public.ist_verwalter() then
    absender := 'dj';
  else
    absender := 'kunde';
  end if;

  update public.anfragen
     set chat = coalesce(chat, '[]'::jsonb) || jsonb_build_object(
           'von', absender,
           'text', nachricht,
           'zeit', now()
         )
   where id = anfrage_id
     and (public.ist_verwalter() or kunde_id = auth.uid());
end;
$$;

-- Postgres gewährt EXECUTE bei neuen Funktionen standardmäßig an PUBLIC —
-- erst explizit entziehen, dann gezielt nur an angemeldete Nutzer vergeben.
revoke execute on function public.angebot_annehmen(uuid) from public;
revoke execute on function public.rueckfrage_senden(uuid, text) from public;
revoke execute on function public.chat_senden(uuid, text) from public;
grant execute on function public.angebot_annehmen(uuid) to authenticated;
grant execute on function public.rueckfrage_senden(uuid, text) to authenticated;
grant execute on function public.chat_senden(uuid, text) to authenticated;

-- ---------- FAQ (bearbeitbar im Entwickler-Bereich) ----------
-- Liegt in der Datenbank statt fest im HTML, damit Jens die Fragen und
-- Antworten selbst pflegen kann, ohne jedes Mal den Code zu ändern.
create table if not exists public.faq (
  id          uuid primary key default gen_random_uuid(),
  reihenfolge int  not null default 0,
  frage       text not null,
  antwort     text not null,
  geaendert_am timestamptz not null default now()
);

create index if not exists faq_reihenfolge_idx on public.faq (reihenfolge);

alter table public.faq enable row level security;

-- Jeder darf die FAQ lesen (öffentliche Startseite, auch ohne Anmeldung)
drop policy if exists "faq lesen" on public.faq;
create policy "faq lesen" on public.faq
  for select to anon, authenticated using (true);

-- Nur Verwalter (Jens, und Entwickler sind ja auch Verwalter) dürfen ändern
drop policy if exists "faq verwalten" on public.faq;
create policy "faq verwalten" on public.faq
  for all to authenticated
  using (public.ist_verwalter()) with check (public.ist_verwalter());

-- Die sechs aktuellen Fragen einmalig übernehmen — läuft nur, wenn die
-- Tabelle noch leer ist, damit ein erneutes Ausführen nichts verdoppelt.
insert into public.faq (reihenfolge, frage, antwort)
select * from (values
  (0, 'Was ist im Paketpreis schon enthalten?', 'Alles, was auf der Paket-Karte steht — Sie zahlen die Pauschale, keine Stundenabrechnung und keine Überraschung danach. Zusatzwünsche wie eine zweite Technik-Variante, Kinderanimation oder Fotobox können optional dazugebucht werden.'),
  (1, 'Muss ich mich anmelden, um ein Angebot zu bekommen?', 'Nein. Sie können die Angebotserstellung komplett ohne Anmeldung durchlaufen und wir melden uns per E-Mail. Eine Anmeldung lohnt sich nur, wenn Sie den Stand Ihrer Anfrage jederzeit online sehen möchten — das ist aber optional.'),
  (2, 'Was, wenn mir das freigegebene Angebot nicht ganz passt?', 'Bevor Sie verbindlich zusagen, sehen Sie das komplette Angebot schwarz auf weiß und können direkt im Kundenbereich mit uns chatten. Für Rückfragen und Änderungswünsche stehen wir Ihnen jederzeit gern zur Verfügung — erst wenn Sie zufrieden sind, nehmen Sie das Angebot an.'),
  (3, 'Was passiert, wenn einer von euch krank wird?', 'Wir sind zu dritt und geben jedem Kollegen vorab Ihr komplettes Musikprofil und alle Absprachen mit. Ihr Abend findet in jedem Fall statt.'),
  (4, 'Fahrt ihr auch außerhalb von Chemnitz?', 'Ja, deutschlandweit. Die Anfahrt hängt von der Entfernung ab und steht mit im Angebotsentwurf, bevor Sie sich festlegen.'),
  (5, 'Wie schnell bekomme ich eine Antwort?', 'Spätestens übermorgen, meist schneller — und von uns persönlich, nicht automatisch.')
) as v(reihenfolge, frage, antwort)
where not exists (select 1 from public.faq);

-- ---------- Kundenzitate (bearbeitbar im Entwickler-Bereich) ----------
create table if not exists public.zitate (
  id          uuid primary key default gen_random_uuid(),
  reihenfolge int  not null default 0,
  text        text not null,
  name        text not null,
  geaendert_am timestamptz not null default now()
);

create index if not exists zitate_reihenfolge_idx on public.zitate (reihenfolge);

alter table public.zitate enable row level security;

drop policy if exists "zitate lesen" on public.zitate;
create policy "zitate lesen" on public.zitate
  for select to anon, authenticated using (true);

drop policy if exists "zitate verwalten" on public.zitate;
create policy "zitate verwalten" on public.zitate
  for all to authenticated
  using (public.ist_verwalter()) with check (public.ist_verwalter());

insert into public.zitate (reihenfolge, text, name)
select * from (values
  (0, 'Die Tanzfläche war den ganzen Abend voll — und niemand hat gemerkt, wie viel Planung dahintersteckt.', 'Julia & Thomas, Schloss Klaffenbach'),
  (1, 'Du hast unseren Abend wieder wunderbar musikalisch gestaltet.', 'Alexandra'),
  (2, 'Es war wirklich eine mega Stimmung … herzlichen Dank für Deine wunderbare Musik.', 'Isabel')
) as v(reihenfolge, text, name)
where not exists (select 1 from public.zitate);

-- ---------- Leistungs-Texte (bearbeitbar im Entwickler-Bereich) ----------
-- Nur die Texte — die zugehörigen Bilder bleiben fest im Code, da deren
-- Austausch ohnehin über Dateien läuft, nicht über Texteingabe.
create table if not exists public.leistungen (
  id          uuid primary key default gen_random_uuid(),
  reihenfolge int  not null default 0,
  titel       text not null,
  text        text not null,
  bullets     text[] not null default '{}',
  geaendert_am timestamptz not null default now()
);

create index if not exists leistungen_reihenfolge_idx on public.leistungen (reihenfolge);

alter table public.leistungen enable row level security;

drop policy if exists "leistungen lesen" on public.leistungen;
create policy "leistungen lesen" on public.leistungen
  for select to anon, authenticated using (true);

drop policy if exists "leistungen verwalten" on public.leistungen;
create policy "leistungen verwalten" on public.leistungen
  for all to authenticated
  using (public.ist_verwalter()) with check (public.ist_verwalter());

insert into public.leistungen (reihenfolge, titel, text, bullets)
select * from (values
  (0, 'Hochzeiten',
   'Rund 25 Hochzeiten begleiten wir jedes Jahr — und trotzdem ist keine wie die andere. Wir setzen uns vorher mit Ihnen zusammen, sprechen mit Ihren Trauzeugen und wissen am großen Tag genau, wann Ihr Lied dran ist. Sie müssen an nichts denken.',
   array['Persönliches Musikprofil nach Ihren Wünschen', 'Stilvolle Moderation nach Ihren Vorgaben', 'Zwei Technik-Varianten: kompakt mit Funkmikrofon — oder groß mit vier Funkmikrofonen']),
  (1, 'Firmenevents & Geburtstage',
   'Eine Firmenfeier tickt anders als eine Hochzeit — und ein 70. Geburtstag anders als beides. Wir schauen, wer im Raum ist, und spielen danach: beim Essen zurückhaltend, auf der Tanzfläche mit allem, was dazugehört.',
   array['Abgestimmte Hintergrundmusik für Empfang und Dinner', 'Moderation für Reden, Ehrungen und Programmpunkte', 'Deko-Licht, Floorspots in Wunschfarbe optional zubuchbar']),
  (2, 'Personalisierte Remixe',
   'Ihr Lied, aber so, wie es sonst niemand hat: Wir bauen den Titel für Ihren ersten Tanz um — langsamer zum Einstieg, mit eigenem Arrangement oder fließendem Übergang in die Party. Davon reden Ihre Gäste noch Jahre später.',
   array['Individuelles Arrangement Ihres Wunschtitels', 'Abstimmung auf Ihre Choreografie', 'Auf Wunsch als Aufnahme für Sie zum Behalten'])
) as v(reihenfolge, titel, text, bullets)
where not exists (select 1 from public.leistungen);

-- =====================================================
-- Automatische Löschung (DSGVO)
-- Benötigt die Erweiterung pg_cron (in Supabase aktivierbar)
-- =====================================================

create or replace function public.alte_daten_loeschen()
returns void language plpgsql security definer as $$
begin
  -- Unbestätigte Anfragen nach 90 Tagen entfernen
  delete from public.anfragen
   where status <> 'freigegeben'
     and created_at < now() - interval '90 days';

  -- Freigegebene Verträge 30 Tage nach der Feier entfernen.
  -- Das Rechnungs-PDF liegt dann bereits lokal bei Jens Winter
  -- und unterliegt dort den steuerlichen Aufbewahrungsfristen.
  delete from public.anfragen
   where status = 'freigegeben'
     and event_datum is not null
     and event_datum < current_date - interval '30 days';
end;
$$;

-- Täglich um 03:00 Uhr ausführen
-- (vorher im Dashboard unter Database → Extensions "pg_cron" aktivieren)
select cron.schedule(
  'hdj24-aufraeumen',
  '0 3 * * *',
  $$ select public.alte_daten_loeschen(); $$
);
