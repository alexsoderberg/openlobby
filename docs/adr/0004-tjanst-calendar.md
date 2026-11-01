# 0004. Tjänst: calendar (grupper, roller, inbjudningslänkar, tider, bokningar)
Status: Accepterad (2026-11-01)

## Kontext
Kärnflödet (REQ-0002–0007) hanterar begreppen Grupp, Medlem, Admin, Inbjudningslänk, Tid och Bokning (ordlistan i `docs/product/vision.md`). Varje tid hör till en grupp, och varje skrivning kräver att användaren är medlem i just den gruppen. Användarens beslut sedan första designen: gruppen har en eller flera admins (skaparen från start, fler kan utses av en admin), flera medlemmar kan skapa egna inbjudningslänkar, och en bokning fungerar som ett öppet rum: man kan gå in till tidens sluttid och alltid gå ut (REQ-0005). Tider har ett max antal platser (F-018) och spel väljs från en spellista (F-024, REQ-0009, ADR 0010). Frågan är fortfarande om grupper och tider/bokningar ska vara en eller flera domäntjänster.

Utgångsläget i CLAUDE.md är få tjänster. En ny tjänst kräver tydlig avgränsning, egen data och skäl för separat driftsättning.

## Beslut
En domäntjänst: **`calendar`**. Den äger grupper, medlemskap med roll, inbjudningslänkar, tider och bokningar.

**Äger data (schema `calendar`):** `groups`, `group_members`, `invite_links`, `times`, `bookings`. Se ADR 0006.

**Varför en och inte flera:**
- **Invarianterna spänner över begreppen.** Att boka en tid kräver medlemskap i tidens grupp. Att lämna en grupp påverkar tider, bokningar och länkar. I en tjänst är det lokala kontroller i samma databas, utan anrop i skrivvägen.
- **Samma förändringsskäl.** Alla krav beskriver ett enda flöde och ändras tillsammans.
- **Borttagningstestet.** Om medlemskap bröts ut skulle medlemskontrollen återuppstå som ett HTTP-anrop i varje skrivning i `calendar`.
- **Skala.** 3–15 medlemmar per grupp. Inget belastningsskäl för att dela upp.

**Interna sömmar i tjänsten:**
- `GroupRepository` (grupper, medlemskap, roller, inbjudningslänkar) och `TimeRepository` (tider och bokningar) är separata portar i `application`. `GameCatalog` (läsning) och `GameCatalogEditor` (skrivning) för spellistan (ADR 0010) är tredje och fjärde port.
- Medlems- och adminkontroller görs i `application` (domänregler), inte i SQL eller transportlagret. Tester använder fakes för portarna.

**Lager** (`services/calendar/internal/`):
- `transport`: HTTP-handlers. Läser `X-User-Id` och `X-User-System-Admin` från gatewayen (ADR 0002, 0011) och bygger en `Actor{UserID, IsSystemAdmin}` som skickas till use cases. Saknas eller är ogiltig `X-User-Id` → 401. Validerar indata och översätter fel till koder.
- `application`: use cases `CreateGroup`, `GetGroup`, `LeaveGroup`, `MakeAdmin`, `CreateInviteLink`, `ListInviteLinks`, `RevokeInviteLink`, `GetInvite`, `JoinByInvite`, `ListUpcomingTimes`, `CreateTime`, `DeleteTime`, `Book`, `Unbook`, `ListGames`, `CreateGame`, `ReplaceGame`, `DeleteGame` (de tre sista kräver systemadmin, ADR 0010). Definierar portarna `GroupRepository`, `TimeRepository`, `GameCatalog`, `GameCatalogEditor`, `UserDirectory` och `Clock`.
- `domain`: `Group`, `Time`, `Role` och deras regler (se nedan).
- `infrastructure`: `postgres` (repositories och `GameCatalog` mot tabellen `games`, ADR 0010), `authclient` (`UserDirectory` mot `auth`), `systemclock`.

**Regler som fastslås här (så att reviewern kan kontrollera dem):**

1. **Namn och spel** trimmas innan validering. Längd mäts i Unicode-tecken (kodpunkter). En trimmad tom sträng är ogiltig.
2. **Medlemskap:** en icke-medlem som anropar grupp- eller tidsendpoints får `404 group_not_found`, inte 403.
3. **Länkar:** en okänd, återkallad, utgången, lämnad eller uttömd (max användningar nått) länk ger `404 invite_invalid`. Samma svar i alla fall, ingen gruppinformation. Giltighet kontrolleras vid visning och vid join. Se ADR 0007.
4. **Roller:** den som skapar gruppen blir admin. En grupp kan ha flera admins. Så länge gruppen har medlemmar finns minst en admin (punkt 5e). En admin kan göra en medlem till admin med `PUT /api/groups/{groupId}/admins/{userId}` (idempotent, 204; icke-admin får `403 not_allowed`, okänd medlem `404 member_not_found`). Ingen kan ta bort en adminroll i MVP. Admin-rollen ger rätt att återkalla vilken länk som helst i gruppen och att göra en medlem till admin. I övrigt har alla medlemmar samma rättigheter. Ersätter tidigare antagandena "exakt en admin" och "ingen admin-roll".
5. **Lämna grupp** (REQ-0006), i den här ordningen i en transaktion (låsning enligt ADR 0006):
   a. Om medlemmen har skapat kommande tider (`ends_at > nu`, samma definition som punkt 8) → `409 own_upcoming_times_exist`, ingenting ändras.
   b. Ta bort medlemmens bokningar på kommande tider och de inbjudningslänkar hen har skapat.
   c. Ta bort medlemskapet.
   d. Om inga medlemmar finns kvar → ta bort gruppen med tider, bokningar och länkar.
   e. Om inga admins finns kvar men medlemmar finns → medlemmen med tidigast `joined_at` (vid lika tid: lägst `user_id`) blir admin. Lämnar en admin och andra admins finns kvar: ingen rolländring.
6. **Tider:** servern tar emot två ögonblick i UTC (`startsAt`, `endsAt`). Kontroller:
   - `startsAt` ligger i framtiden (`Clock`) → annars `time_in_past`.
   - `endsAt` är efter `startsAt` → annars `time_end_not_after_start`.
   - `endsAt - startsAt` är under 24 timmar → annars `time_too_long`.
   - Exakt ett av `gameId` (id i spellistan) och `customGameName` (fritext) anges. Okänt id, eller ett fritextnamn som är tomt eller över 50 tecken efter trim → `invalid_game`. Spelnamnet kopieras till tiden (`game_name`). Tiden har ingen referens till spellistan (ADR 0010).
   - `maxPlayers` är `null` (obegränsat) eller ett heltal ≥ 1 → annars `invalid_capacity`. Värdet ändras inte efter skapande.
   - Regeln "sluttid med klockslag före starttid räknas som nästa dygn" tillämpas bara i frontend. Det är den enda platsen för den regeln. Servern ser aldrig klockslag.
   - Skapandet sparar tiden och skaparens bokning i samma transaktion (REQ-0005). Skaparen tar en plats, och max ≥ 1 gör att den alltid ryms.
7. **Bokning och avbokning:**
   - **Inbokning** (`PUT .../booking`), efter gruppens lås i denna ordning: a. tiden saknas → `time_not_found`. b. `endsAt` har passerat (`endsAt <= nu`, `Clock`) → `time_has_ended`. c. anroparen är redan bokad → 204, ingenting ändras. d. `maxPlayers` är satt och antalet bokningar är ≥ `maxPlayers` → `time_full`. e. annars sparas bokningen. Inbokning fungerar medan tiden pågår.
   - **Avbokning** (`DELETE .../booking`): om tiden finns → 204 för medlem, även efter sluttid och även om anroparen inte var bokad (idempotent). Ingen tidskontroll. Om tiden saknas → `404 time_not_found`. Avbokning efter sluttid är alltid tillåten (användarens beslut, REQ-0005). Regeln om saknad tid ersätter det tidigare antagandet "alltid 204 även om tiden saknas" och kräver att REQ-0005 formuleras om (se `docs/services.md`).
   - Icke-medlem får `group_not_found` för både in- och avbokning (regel 2).
8. **Kommande tider:** listan visar tider med `ends_at > nu` (`Clock`). Ingen sidning.
9. **Samtidighet:** varje skrivning som rör en grupp låser gruppraden först (ADR 0006).
10. **Återinträde:** medlemskapet raderas när medlemmen lämnar. Ett nytt inträde är en ny rad med `joined_at` = nu. Ingen historik. Join för en befintlig medlem ändrar ingenting och räknas inte som användning av länken. Ett nytt inträde räknas (ADR 0007).
11. **Systemadmin:** `Actor.IsSystemAdmin` ger rätt att förvalta spellistan (ADR 0010) och ingen rätt i en grupp. Grupp- och tidskontroller ignorerar flaggan, så en systemadmin som inte är medlem får `404 group_not_found` precis som vem som helst. Kontrollen görs i `application`, inte i transport. Se ADR 0011.

**Listning av tider utan intervallfilter (F-017).** `GET /api/groups/{groupId}/times` returnerar alla kommande tider, både för listvyn och veckovyn. Ett `from`/`to`-filter läggs inte till nu, eftersom:
- veckogränsen (måndag 00:00) är en lokal tid som bara frontend känner till. Servern skulle ändå behöva få gränserna från klienten.
- listan är ändå osidad i MVP, så filtret sparar ingen hämtning i praktiken.
- veckovyn filtrerar i frontend på överlapp med veckans intervall i lokal tid. En tid som startar söndag 22:00 och slutar måndag 02:00 syns i båda veckorna där den överlappar.

Tillägget görs additivt (valfria query-parametrar) när listan blir stor.

**Leverantörsberoende:** calendar känner bara till användarens `id` (uuid) och får namn via porten `UserDirectory`. Den vet ingenting om Discord.

**Antaganden och hur de påverkar designen:**
- *Admin-roll (ersätter "en admin per grupp"):* en roll-kolumn `role` i `group_members` utan unikt index på roll. Flera admins är tillåtna. Ingen separat roll-tabell. "Minst en admin" är en applikationsregel i lämna-transaktionen (punkt 5e), eftersom databasen inte kan uttrycka den.
- *Flera inbjudningslänkar (ersätter "en länk per grupp"):* egen tabell `invite_links` (ADR 0006, 0007). Länkar gäller 2 timmar från skapandet (användarens beslut). Länkar skapas bara på begäran, inte vid gruppskapande eller återkallning.
- *Länklistan: medlemmar ser egna länkar, admin ser alla gruppens aktiva länkar, med token så att admin kan kopiera och återkalla dem.* Användarens beslut. Eftersom listan bara innehåller länkar som anroparen får återkalla, finns inget `canRevoke`-fält. Länkar har valfritt max antal användningar (ADR 0007).
- *Tidszon (REQ-0003):* tider lagras som exakta ögonblick. Ändras kravet till fast tidszon per grupp påverkar det bara inmatning och visning i frontend. Ingen migrering.
- *Över midnatt (REQ-0003):* användaren har beslutat att tider får gå över midnatt. REQ-0003 är fortfarande markerat som ANTAGANDE. Produktägaren bör ta bort markeringen.
- *Max 24 timmar:* användaren har bekräftat "under 24 timmar". Exakt 24 timmar nekas (`time_too_long`). Kravtexten i REQ-0003 ska formuleras så att exakt 24 timmar också är utanför omfånget (produktägaren).
- *Max antal platser per tid (F-018, REQ-0005, REQ-0009):* varje tid har `max_players`, tomt = obegränsat. Gränskontrollen görs i `application` (regel 7d) efter gruppens lås (ADR 0006). Ingen max-gräns för medlemmar i gruppen (REQ-0002).
- *Lista utan paginering:* `shortcut: ingen sidning av kommande tider, uppgradera när en grupps lista blir stor (lägg till from/to som valfria parametrar)`.
- *Lämna grupp:* regeln i punkt 5 ovan. Bekräftelsesteget är frontends sak (REQ-0006).
- *Sista medlemmen:* gruppen tas bort. Inbjudningslänkar till den försvinner med den.

**Så här hanteras framtida utökning:** en ny konsument som behöver medlemskap (t.ex. notiser, F-015) börjar med att läsa via API. Först om en andra konsument har ett annat förändringstempo eller en egen databas bryts medlemskap ut, och då med ADR.

## Konsekvenser
- Calendar är beroende av `auth` för namn vid läsning. Det är den enda synkrona beroendekanten för domänlogiken.
- Ett domänschema gör migreringar och tester enkla, men kräver disciplin i `application` så att portarna inte vidgas utan skäl.
- Bokningens konsistens (en tid som tagits bort samtidigt) hanteras av databasen och låset per grupp: bokning av en borttagen tid ger `time_not_found`.
- Rollreglerna (minst en admin, överlåtelse när sista admin lämnar) är nya affärsregler som reviewern måste kunna kontrollera. De finns bara här och i ADR 0006.
- Max-gränsen kräver att inbokning räknar bokningarna under gruppens lås. Det är en skrivväg mer än avbokning, och den testas mot riktig PostgreSQL (ADR 0006).

## Alternativ som förkastades
- **`groups` och `schedule` som två tjänster:** medlemskontrollen blir ett synkront anrop i varje tidsskrivning.
- **Fyra tjänster (grupper, inbjudningar, tider, bokningar):** långt under den granularitet som motiveras av ändringstakt eller ägarskap.
- **Händelsebaserad synk mellan tjänsterna:** kräver broker och ett eget ADR. Ingen konsument behöver det i MVP.
- **Roller i en egen tabell (`roles`):** två roller ryms i en kolumn (YAGNI).
- **En admin per grupp (partiellt unikt index):** ersatt av användarens beslut om flera admins.
- **Överlåtelse till äldsta medlem vid varje adminutträde:** ändrar roller när andra admins finns kvar, utan att någon begär det. Ersatt av regeln att överlåtelse sker bara när sista admin lämnar.
- **Adminroll via `PUT .../members/{userId}/role` med roll i body:** öppnar för nedgradering, som MVP inte tillåter. `PUT .../admins/{userId}` gör bara det som krävs.
- **Intervallfilter `from`/`to` i MVP:** se "Listning av tider" ovan.
- **En länk per grupp med rotation:** ersatt av användarens beslut om flera länkar (ADR 0007).
