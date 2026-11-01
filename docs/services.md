# Tjänstekarta

Status: Accepterad (se ADR 0001–0011). Kontrakt i `api/` skrivs av backend-experten och finns ännu inte.

## Översikt

```
Webbläsare
   │  HTTPS (443). HTTP (80) redirectas till HTTPS
   ▼
edge (Nginx)                          TLS, redirect, säkerhetshuvuden (ADR 0009)
   │
   ▼
gateway ──────────────► frontend      (/ och alla icke-API-sökvägar)
   │  validerar session, sätter X-User-*
   ├──────────────► auth              (/api/auth/*)
   │                 ▲
   └──────────────► calendar          (/api/groups*, /api/invites*, /api/games*)
                     │  namnuppslag (internt HTTP)
                     └────────────► auth

certbot (sidovagn)  förnyar certifikat till en volym som edge läser (ADR 0009)
```

Alla tjänster använder synkront HTTP/JSON. Ingen tjänst läser en annan tjänsts databas. Ingen tjänst exponeras publikt utom `edge`, som bara vidarebefordrar till `gateway`.

## Tjänster

### edge (Nginx, ingen Go-tjänst)
- **Ansvar:** publik ingång. TLS, HTTP→HTTPS-redirect, HSTS, `Referrer-Policy`, vidarebefordrade headers till `gateway`.
- **Äger data:** inget. Certifikat och nycklar ligger i volymen `certs` och finns aldrig i repot.
- **Beroenden:** `gateway`. Delar volymer med `certbot`.
- **Realiserar:** HTTPS för all trafik (REQ-0001) och förutsättningen för `Secure`-cookien.
- **Beslut:** ADR 0009.

### gateway
- **Ansvar:** routing, sessionsvalidering, sätter `X-User-Id` och `X-User-System-Admin` från sessionen och tar bort klientens egna `X-User-*`, korrelations-id, blockering av `/internal/*`, åtkomstlogg.
- **Äger data:** inget.
- **Beroenden:** `auth` (sessionsvalidering), `frontend` och `calendar` (routing).
- **Realiserar:** F-001 (sessionsdelen av inloggningen), och förutsättningen för F-002–F-005, F-010, F-013, F-017, F-018 och F-024.
- **Beslut:** ADR 0002, 0011.

### auth
- **Ansvar:** inloggning med Discord, användarkonton, sessioner, utloggning, visningsnamn, och systemadminrollen (avgörs av konfiguration, `SYSTEM_ADMINS`).
- **Äger data (databas `auth`):** `users`, `sessions`, `login_attempts`.
- **Beroenden:** Discord OAuth2 (extern, bakom porten `IdentityProvider`), PostgreSQL.
- **Realiserar:** F-001 (REQ-0001), och rollen för F-024 (systemadmin, REQ-0009).
- **Beslut:** ADR 0003, 0005, 0011.

### calendar
- **Ansvar:** grupper, medlemskap och roller (en eller flera admins, minst en så länge gruppen har medlemmar), inbjudningslänkar med utgång efter 2 timmar, max antal användningar per länk (1–10, förval 10), tider med spel och max antal platser, bokningar, och spellistan (F-024). Spellistan förvaltas av systemadmin. Behörighetskontroll sker här.
- **Äger data (databas `calendar`):** `groups`, `group_members` (med `role` och `joined_at`), `invite_links` (med `expires_at`, `max_uses`, `use_count`), `times` (med `game_name` och `max_players`), `bookings`, `games` (spellistan, ADR 0010).
- **Beroenden:** `auth` (visningsnamn via internt `POST /internal/users/lookup`), PostgreSQL.
- **Realiserar:** F-002 (REQ-0002), F-003 (REQ-0003, REQ-0009), F-004 och F-017 (REQ-0004), F-005 (REQ-0005), F-018 (REQ-0005, REQ-0009), F-024 (REQ-0009, förvaltning av systemadmin), F-010 (REQ-0006), F-013 (REQ-0007).
- **Beslut:** ADR 0004, 0006, 0007, 0010, 0011.

### frontend
- **Ansvar:** React + TypeScript (Vite). Användargränssnittet, lokal tid, veckovyns filtrering, tolkning av sluttid som nästa dygn, spelval ur `GET /api/games` med förifyllt max från `defaultMaxPlayers`, platsläge ("X/Y platser" eller "X bokade"), länkars utgångstid och användningar, felmeddelanden utifrån felkoder, 404-sida för `invite_invalid`, och sidan `/systemadmin/spellista` för systemadmin (visas när `isSystemAdmin` är sant).
- **Äger data:** inget. Kör i egen container med statiska filer.
- **Beroenden:** `gateway` (allt API-anrop).
- **Realiserar:** gränssnittet för F-001–F-005, F-010, F-013, F-017, F-018 och F-024.
- **Beslut:** ADR 0008 (statisk webbserver), 0001, 0011.

### Gemensamt
- **Databaser:** en PostgreSQL-instans, en databas och en roll per tjänst (`auth`, `calendar`). ADR 0006, 0008.
- **Delad kod i `pkg/`:** endast infrastruktur (loggning, konfiguration från miljövariabler, HTTP-middleware för korrelations-id och fel, hälsoendpoints).

## Endpoints (översikt, ej kontrakt)

Publika endpoints (via `gateway`, som tar emot trafik från `edge`):

| Metod | Sökväg | Tjänst | Session | Krav |
|---|---|---|---|---|
| GET | `/api/auth/discord/login` | auth | nej | REQ-0001 |
| GET | `/api/auth/discord/callback` | auth | nej | REQ-0001 |
| POST | `/api/auth/logout` | auth | nej | REQ-0001 |
| GET | `/api/auth/me` | auth | ja | REQ-0001 (svar `{id, displayName, isSystemAdmin}`, ADR 0011) |
| POST | `/api/groups` | calendar | ja | REQ-0002 (skapar admin-medlemskap, ingen länk) |
| GET | `/api/groups` | calendar | ja | REQ-0002 |
| GET | `/api/groups/{groupId}` | calendar | ja, medlem | REQ-0002 |
| DELETE | `/api/groups/{groupId}/membership` | calendar | ja, medlem | REQ-0006 (överlåter adminrollen när sista admin lämnar) |
| PUT | `/api/groups/{groupId}/admins/{userId}` | calendar | ja, admin | REQ-0008 (gör medlem till admin, idempotent, 204. Icke-medlem `group_not_found`, icke-admin `not_allowed`, okänd medlem `member_not_found`) |
| GET | `/api/groups/{groupId}/invite-links` | calendar | ja, medlem | REQ-0002, REQ-0007 (medlem: egna aktiva länkar; admin: alla aktiva länkar, med token så att de kan kopieras. Fält `id`, `token`, `createdBy`, `createdAt`, `expiresAt`, `useCount`, `maxUses`. Svar `Cache-Control: no-store`) |
| POST | `/api/groups/{groupId}/invite-links` | calendar | ja, medlem | REQ-0002, REQ-0007 (body `{maxUses}`, valfritt heltal 1–10. Utelämnat eller `null` ger 10. Svar 201 med `token`, `expiresAt`, `useCount`, `maxUses`. `invalid_max_uses` vid värde utanför 1–10 eller fel typ. ADR 0007) |
| DELETE | `/api/groups/{groupId}/invite-links/{linkId}` | calendar | ja, skapare eller admin | REQ-0007 (inaktiv länk ger `404 invite_invalid`, ADR 0007) |
| GET | `/api/invites/{token}` | calendar | ja | REQ-0002 (404 `invite_invalid` om utgången, återkallad, uttömd eller okänd) |
| POST | `/api/invites/{token}/join` | calendar | ja | REQ-0002 (404 `invite_invalid` enligt ovan. Räknar en användning vid nytt medlemskap) |
| GET | `/api/games` | calendar | ja | REQ-0009 (spellistan, F-024; svar `[{id, name, defaultMaxPlayers}]`) |
| POST | `/api/games` | calendar | ja, systemadmin | REQ-0009 (ny, ADR 0010. Body `{id, name, defaultMaxPlayers}`, 201. `not_allowed`, `invalid_game`, `invalid_capacity`, `game_taken`) |
| PUT | `/api/games/{gameId}` | calendar | ja, systemadmin | REQ-0009 (ny, ADR 0010. Body `{name, defaultMaxPlayers}`, 200. `not_allowed`, `invalid_game`, `invalid_capacity`, `game_taken`, `game_not_found`) |
| DELETE | `/api/games/{gameId}` | calendar | ja, systemadmin | REQ-0009 (ny, ADR 0010. 204. `not_allowed`, `game_not_found`. Tider behåller sitt spelnamn) |
| GET | `/api/groups/{groupId}/times` | calendar | ja, medlem | REQ-0004 (alla kommande tider, utan intervallfilter; visar `gameName`, `maxPlayers`, `bookedCount`) |
| POST | `/api/groups/{groupId}/times` | calendar | ja, medlem | REQ-0003, REQ-0009 (`startsAt`, `endsAt` i UTC. Exakt ett av `gameId` eller `customGameName`. `maxPlayers` krävs: heltal ≥ 1 eller `null`) |
| GET | `/api/groups/{groupId}/times/{timeId}` | calendar | ja, medlem | REQ-0004, REQ-0005 (visar bokade medlemmar) |
| DELETE | `/api/groups/{groupId}/times/{timeId}` | calendar | ja, skapare | REQ-0003 |
| PUT | `/api/groups/{groupId}/times/{timeId}/booking` | calendar | ja, medlem | REQ-0005, F-018 (`time_has_ended`, `time_full`, `time_not_found`. Idempotent) |
| DELETE | `/api/groups/{groupId}/times/{timeId}/booking` | calendar | ja, medlem | REQ-0005 (204 när tiden finns, även efter sluttid och idempotent. 404 `time_not_found` när tiden saknas) |

Interna endpoints (ej publika, blockeras av `gateway`):

| Metod | Sökväg | Anropare | Tjänst |
|---|---|---|---|
| POST | `/internal/sessions/validate` | gateway | auth (svar `{userId, isSystemAdmin}`) |
| POST | `/internal/users/lookup` | calendar | auth |

Headers från gatewayen till `calendar` (ADR 0002, 0011): `X-User-Id` (uuid) och `X-User-System-Admin` (`true` eller `false`). Gatewayen tar bort klientens `X-User-*` på alla routes.

Noter:
- Icke-medlem får `404 group_not_found` i stället för 403, så att gruppens existens inte röjs.
- Okänd, återkallad, utgången, uttömd eller lämnad inbjudningslänk ger `404 invite_invalid`. Svaret är samma i alla fall.
- Medlemslistan visar roll (`admin` eller `member`).
- En systemadmin har ingen rätt i en grupp. Grupp- och tidsendpoints ger samma svar som för vem som helst (ADR 0004 regel 11).
- Felkoder definieras i `api/calendar/openapi.yaml`. Tidsrelaterade: `time_in_past`, `time_end_not_after_start`, `time_too_long`, `time_not_found`, `time_has_ended` (bara inbokning), `time_full`, `invalid_game`, `invalid_capacity`. Länkar: `invite_invalid`, `invalid_max_uses`. Spellista: `game_taken`, `game_not_found` (`invalid_game` och `invalid_capacity` används också där). Övriga: `own_upcoming_times_exist`, `not_allowed`, `member_not_found`.
- Avbokning ger 204 för medlem när tiden finns, även efter sluttid och även om medlemmen inte var bokad. Tiden saknas → `404 time_not_found` (ADR 0004 regel 7). REQ-0005 måste stämma med detta.
- `GET /api/games` kräver session men ingen grupp. Svaret är sorterat på `name`.

## Öppna frågor och risker

Bekräftade av användaren (stängda, se ADR 0004, 0006, 0007, 0010, 0011):
- **Exakt 24 timmar nekas** (`time_too_long`). Kravtexten i REQ-0003 ska stämma med det.
- **Avbokning är alltid tillåten,** även efter sluttid. **Inbokning** går till sluttid, även under pågående tid, och bara om det finns en ledig plats (`time_full`). Se ADR 0004 regel 7.
- **Max antal platser per tid** (F-018): tomt = obegränsat. Skaparen räknas in. Gränsen gäller bokningar under gruppens lås (ADR 0006).
- **Max användningar per inbjudningslänk:** 1–10, obligatoriskt, förval 10 vid skapande (användarens beslut, för att motverka bottar). Användningar räknas vid nytt medlemskap under gruppens lås. Uttömd länk ger `invite_invalid` (ADR 0007).
- **Admin kopierar andra medlemmars länkar:** ja. Admin ser token för alla aktiva länkar i gruppen (ADR 0007). Ersätter den öppna frågan i REQ-0002.
- **Spellista i calendar** (ADR 0010): tabellen `games`, förvaltas av systemadmin i appen (`/api/games`, ADR 0011). Medlemmar och gruppadmins kan inte ändra den. Driftsrollen `calendar_ops` tas bort.
- **Systemadmin** pekas ut i konfigurationen (`SYSTEM_ADMINS` i `auth`, ADR 0011). Ingen hantering i appen. Ingen rätt i grupper.
- **Över midnatt tillåts.** ANTAGANDE-markeringen i REQ-0003 tas bort av produktägaren.
- **Passerade tider ligger kvar** med `created_by_user_id` för avgångna medlemmar, utan att visas. Ingen rensning i MVP.
- **Länkar från avgångna medlemmar tas bort** när medlemmen lämnar gruppen.
- **Inaktiva inbjudningslänkar städas** (utgångna eller uttömda) vid skapande av ny länk i gruppen. Inaktiva länkar i inaktiva grupper ligger kvar tills gruppen skapar en ny länk eller tas bort (ADR 0007).
- **Måste ta bort kommande egna tider innan man lämnar** (`own_upcoming_times_exist`).
- **Ingen max-gräns** på medlemmar. **Ingen Discord-server** krävs (ADR 0005).
- **Spellista** (ADR 0010, REQ-0009): startinnehåll Counter-Strike 2, World of Warcraft, League of Legends och Overwatch, alla med förvalt max 5. Ingen övre gräns för max. Tiden sparar spelnamnet.

Till produktägaren (kravtexter, ändras inte av arkitekten):
- **REQ-0005, avbokning när tiden saknas:** API:t ger `404 time_not_found` (ADR 0004 regel 7). REQ-0005 säger "avboka alltid" och "inget felmeddelande" när man inte är bokad. Formulera REQ-0005 så att den tid som tagits bort är ett eget fall. Frontend visar ingen felruta för det fallet.
- **REQ-0010 (F-025):** kravet är i linje med ADR 0010 och 0011. Driftloggen i ADR 0010 är inte en användarfunktion. Om "logg över ändringar" ska stå kvar utanför omfånget behöver kravtexten säga "för användaren", eftersom varje skrivning loggas på driftnivå.
- **Begreppet "Systemadmin"** är tillagt i `docs/product/vision.md`. Arkitekten använder "gruppadmin" i ADR:erna där "admin" står i kravtexten.

Arbetsantaganden som produktägaren ska bekräfta i kraven:
- **Flera admins.** En admin kan göra en medlem till admin. Ingen kan ta bort en adminroll i MVP. Skaparen blir admin.
- **Överlåtelse:** när sista admin lämnar går rollen till medlemmen med tidigast `joined_at`. Lämnar en admin och andra admins finns kvar sker ingen ändring.
- **Länkar:** medlemmar ser bara egna länkar. Admin ser alla gruppens aktiva länkar, för att kunna kopiera och återkalla. Kravtexterna REQ-0002, REQ-0006 och REQ-0007 uppdateras av produktägaren.
- **Gruppradslåset** (ADR 0006) gör att två admins som lämnar samtidigt inte kan lämna gruppen utan admin.

Till användaren (kvarstår):
- **Publik ingång (ADR 0009).** Kräver ett domännamn, publik IPv4 och vidarebefordrade portar 80/443. Vid CGNAT behövs en annan väg in. Svaret avgör om driftsättningen går att genomföra.
- **Nya beroenden som kräver egna ADR när de väljs:** OpenAPI-generatorer (Go och TS) och migreringsverktyg. Nginx, certbot och Let's Encrypt är beslutade i ADR 0009.
