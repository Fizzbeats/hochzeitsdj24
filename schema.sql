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
