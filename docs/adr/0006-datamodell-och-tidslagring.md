# 0006. Datamodell och tidslagring
Status: Accepterad (2026-11-01)

## Kontext
CLAUDE.md kräver en databas eller ett schema per tjänst, och inga leverantörsnamn i domänens datamodell. REQ-0003 kräver att en tid visas i varje medlems lokala tid och motsvarar samma verkliga ögonblick. Tidszonsantagandet kan ändras till en fast tidszon per grupp, så lagringen ska inte bero på det antagandet.

Efter användarens beslut behöver datamodellen också roller (flera admins, minst en så länge gruppen har medlemmar), flera inbjudningslänkar per grupp och regler för att lämna gruppen (REQ-0006). Det kräver atomära skrivningar, eftersom två medlemmar kan göra motstridiga saker samtidigt (t.ex. en bokning och att bokaren lämnar). Varje tid har också ett max antal platser (F-018), och inbokning måste vara atomär mot det: två medlemmar får inte få den sista platsen.

## Beslut

**Tid:** alla tidpunkter lagras som `timestamptz` (exakt ögonblick, UTC internt). API:t tar och returnerar RFC 3339 i UTC. Frontend konverterar användarens lokala datum och klockslag till ett ögonblick innan anropet, och visar tider i webbläsarens lokala tidszon.

**Databaser:** en PostgreSQL-instans (se ADR 0008) med två databaser, `auth` och `calendar`. Varje tjänst har en egen roll med åtkomst bara till sin databas. Inga främmande nycklar över databasgränser. Referenser mellan tjänster är uuid:er (`user_id`).

**Migreringar:** varje tjänst äger sina migreringar i `services/<tjänst>/migrations/`. Varje migrering har en `down`-fil (DoD). Migreringsverktyg väljs av backend-experten. Ett nytt beroende kräver ett tillägg till detta ADR.

**Datamodell `auth`:** oförändrad.
- `users`: `id uuid pk`, `provider text`, `provider_subject_id text`, `display_name text`, `created_at`, `updated_at`. Unik `(provider, provider_subject_id)`.
- `sessions`: `token_hash bytea pk`, `user_id uuid fk users`, `created_at`, `expires_at`, `revoked_at null`.
- `login_attempts`: `state_hash bytea pk`, `return_to text`, `expires_at`.

**Datamodell `calendar`:**
- `groups`: `id uuid pk`, `name text` (`char_length` 1–50), `created_at`. Ingen länk- eller rollkolumn här.
- `group_members`: `group_id uuid fk groups on delete cascade`, `user_id uuid`, `role text not null` med check `role in ('admin', 'member')`, `joined_at timestamptz not null`, satt vid inträde. Primärnyckel `(group_id, user_id)`. Inget index på `role`: flera admins är tillåtna. Att minst en admin finns upprätthålls av applikationen (se invarianter). Medlemskapet raderas vid lämnande, så återinträde ger ett nytt `joined_at`.
- `invite_links`: `id uuid pk`, `group_id uuid fk groups on delete cascade`, `token text unique not null`, `created_by_user_id uuid not null`, `created_at`, `expires_at timestamptz not null` (= `created_at` + 2 timmar, ADR 0007), `max_uses integer not null` med check `max_uses between 1 and 10` (obligatoriskt, gränsen per ADR 0007), `use_count integer not null default 0` med check `use_count >= 0 and use_count <= max_uses`. Index på `group_id`. Återkallning är en radering. Ingen `revoked_at`, eftersom ingen historik krävs (REQ-0007).
- `times`: `id uuid pk`, `group_id fk groups on delete cascade`, `created_by_user_id uuid`, `game_name text not null` (`char_length` 1–50), `max_players integer null`, `starts_at timestamptz`, `ends_at timestamptz`, `created_at`. Check `ends_at > starts_at and ends_at - starts_at < interval '24 hours'` och `max_players is null or max_players >= 1`. Intervallet är standard-SQL. `game_name` är en kopia av spelnamnet, utan främmande nyckel till spellistan. Ett borttaget spel i spellistan lämnar därmed tiden orörd (ADR 0010, REQ-0009).
- `bookings`: `time_id fk times on delete cascade`, `user_id uuid`, `booked_at`. Primärnyckel `(time_id, user_id)`.
- `games` (spellistan, ADR 0010): `id text pk` (slug), `name text not null` med check `name = btrim(name) and char_length(name) between 1 and 50` och unikt index på `lower(name)`, `default_max_players integer null` med check `is null or >= 1`. Ingen relation till andra tabeller. Skrivs av tjänsten `calendar` via systemadmin-endpoints (ADR 0010, 0011).

**Invarianter som applikationen upprätthåller** (databasen kan inte uttrycka dem):
- Varje inbjudningslänk och varje kommande tid har en skapare som är medlem. Lämna-regeln (ADR 0004) säkerställer det: den som har skapat kommande tider kan inte lämna, och länkar som medlemmen skapat tas bort när hen lämnar.
- Varje grupp med medlemmar har minst en admin. Om sista admin lämnar sker överlåtelsen i samma transaktion som lämnandet.
- En bokning finns bara för en medlem i tidens grupp.
- Antalet bokningar på en tid är högst `max_players` när den är satt. Kontrollen görs i transaktionen efter gruppens lås, se nedan. En trigger skulle räkna i databasen, men då skulle regeln ligga på två ställen.
- Antalet användningar av en inbjudningslänk är högst `max_uses`, som alltid är satt. Kontrollen och ökningen görs i join, efter gruppens lås (ADR 0007). Databasens check är ett skyddsnät, inte den enda kontrollen.

**Samtidighet:** varje skrivning som rör en grupp (tider, bokningar, medlemskap, länkar, roller) börjar i en transaktion med `SELECT ... FROM groups WHERE id = $1 FOR UPDATE` som första sats. Gruppen är därmed en serialiseringspunkt. Join låser gruppen som länken pekar på och kontrollerar länken igen efter låset (ADR 0007). Utan lås kan en bokning eller länk skapas för en medlem som samtidigt lämnar. Med 3–15 medlemmar per grupp kostar låsningen inget i praktiken.
- Regler som läser medlemmar eller roller (admin-kontroll, val av ny admin, kontroll av kommande tider) körs efter låset. Skrivningar i grupp använder standardnivån READ COMMITTED, så att de ser de värden som committats av en transaktion som väntat. Under REPEATABLE READ skulle läsningen se ett gammalt snapshot, och regeln bryts.
- Två admins som lämnar samtidigt: den andra transaktionen väntar på låset och ser sedan att den första redan lämnat. Den sista admin som lämnar överlåter rollen, och ingen transaktion kan lämna gruppen utan admin. Utan låset kunde båda lämna samtidigt och gruppen bli utan admin.
- **Inbokning mot max:** gruppens lås tas först, sedan räknas bokningar på tiden och jämförs med `max_players`. En samtidig inbokning väntar på låset och ser den första transaktionens committade rad. Två medlemmar på sista platsen: en lyckas, den andra får `time_full`. Lås på tidsraden (`FOR UPDATE` på `times`) skulle ge samma skydd, men det vore en andra låspunkt per skrivning, och gruppens lås finns redan. Testas med två samtidiga anrop mot riktig PostgreSQL.
- **Join mot max användningar:** samma mönster. Gruppens lås tas först, länken läses om, `use_count < max_uses` kontrolleras och `use_count` ökas i samma transaktion. Ingen separat radlås på länken. Två samtidiga joins på sista användningen: en lyckas, den andra får `invite_invalid`. Testas mot riktig PostgreSQL.


**Återkallade och lämnade data:** vid lämnande raderas bara bokningar på kommande tider och länkar. Passerade tider ligger kvar med `created_by_user_id` och syns inte för någon medlem.

**Drivrutin:** `database/sql` med en PostgreSQL-drivrutin (`pgx`) bakom repository-adaptrarna. Drivrutinen används bara i `infrastructure/postgres`.

## Konsekvenser
- Tidszonsantagandet påverkar bara inmatning och visning. Om gruppen i stället får en fast tidszon ändras frontend, inte schemat.
- `ends_at > starts_at` och längdgränsen 24 timmar kontrolleras både i domänen och i databasen, så att ett felaktigt intervall är omöjligt även vid buggar.
- Roll är en kolumn med två värden. Flera admins kräver ingen migrering. Fler roller kräver en ändrad check-constraint.
- Låset per grupp gör skrivningar i samma grupp seriella. Det är acceptabelt för gruppstorlekar i MVP och ska bara ändras om mätning visar problem.
- Gruppradering vid sista medlemmens lämnande sker via cascade. Inga separata raderingsanrop.
- Inaktiva inbjudningslänkar (utgångna eller uttömda) städas i samma låsta transaktion när en ny länk skapas (ADR 0007).
- Passerade tider med `created_by_user_id` för en avgången medlem ligger kvar. Ingen rensning i MVP. Se öppna frågor i `docs/services.md`.
- Ingen cross-service-join. Visningsnamn hämtas från `auth` (ADR 0003).
- Spellistan (`games`) har ingen gruppkoppling och tar därför inget gruppslås. Dubbletter av namn förhindras av det unika indexet, som ger `game_taken` (ADR 0010). Runtime-rollen `calendar` får DML på `games`. Driftsrollen `calendar_ops` finns inte längre (ADR 0010).
- Invite-räknaren ökas i samma transaktion som medlemskapet. Om något av stegen misslyckas rullas båda tillbaka, så räknaren kan inte hamna fel.
- Migreringen av `invite_links` sätter `max_uses` till `not null` med check 1–10. Ingen version är driftsatt, så det finns inga rader att fylla i. Skulle rader med null finnas före migreringen sätts de till 10 först.
- Migreringen av `times` byter `game` mot `game_name` och lägger till `max_players`. Migreringen är reversibel: down-filen återställer `game` och tar bort `max_players`. Befintliga rader får `max_players` = null (obegränsat).

## Alternativ som förkastades
- **Lokal tid plus tidszonskolumn per tid:** två källor för ett ögonblick och risk för fel vid sommar-/vintertid. Ett exakt ögonblick är enklare.
- **Ett schema per tjänst i en databas:** tillåtet enligt CLAUDE.md. Valt bort till fördel för separata roller och databaser.
- **Delad databas för alla tjänster:** bryter regeln "egen data".
- **Snapshot av visningsnamn i `group_members`:** blir inaktuellt efter byte av namn. Se ADR 0003.
- **Revoked_at på inbjudningslänkar:** historik som ingen krav begär (REQ-0007 utesluter historik).
- **Enum-typ för roll:** `text` med check är lika tydligt och lättare att migrera.
- **Roll i en egen tabell:** en kolumn räcker för två roller (YAGNI).
- **Partiellt unikt index på admin per grupp:** ersatt av beslutet om flera admins. Det kan inte uttrycka "minst en admin" ändå.
- **Optimistisk låsning (versionskolumn) i stället för lås per grupp:** fler återförsök i koden för samma skydd. Lås per grupp är enklare att granska.
- **Radlås på `times` för inbokning:** samma skydd, men en andra låspunkt. Se Samtidighet.
- **Trigger eller constraint som räknar bokningar:** en räkning i transaktionen under låset är mindre kod än en trigger och ligger på samma ställe som övriga regler.
- **Främmande nyckel från `times` till spellistan:** borttagna spel skulle antingen blockera tiden eller kaskadera bort den, men REQ-0009 kräver att tiden ligger kvar.
- **Räknare med villkorad `UPDATE` på länken (radlås):** fungerar, men ger en andra låspunkt per join. Gruppens lås finns redan och ger samma skydd.
- **Tabell `invite_uses` med en rad per användning:** historik som ingen krav begär. En räknare räcker (YAGNI).
