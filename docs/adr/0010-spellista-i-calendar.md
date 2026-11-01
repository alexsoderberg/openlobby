# 0010. Spellista: tabell i calendar, förvaltad av systemadmin i appen
Status: Accepterad (2026-11-01)

## Kontext
REQ-0009 (F-024) kräver en gemensam spellista där varje spel har ett förvalt max antal platser. Listan är gemensam för alla grupper och förvaltas av projektet, inte av medlemmar eller gruppadmins. En tid sparar spelnamnet och ligger kvar oförändrad om spelet tas bort ur listan.

Användaren har uttryckligen avvisat en fil i repot: listan ska vara dynamisk och ändras utan commit och utan ny release. Startinnehållet är Counter-Strike 2, World of Warcraft, League of Legends och Overwatch, alla med förvalt max 5. Det finns ingen övre gräns för max.

Användaren har nu beslutat att förvaltningen sker i appen, av en systemadmin (ADR 0011). Den tidigare rekommendationen (psql mot en egen driftsroll `calendar_ops`) ersätts. Eftersom 0010 ännu inte är accepterad skrivs den om i stället för att ersättas med ett nytt nummer.

## Beslut
- **Listan är en tabell** `games` i databasen `calendar` (ADR 0006):
  ```sql
  create table games (
      id text primary key,
      name text not null,
      default_max_players integer check (default_max_players is null or default_max_players >= 1)
  );
  create unique index games_name_lower_key on games (lower(name));
  ```
  `id` är en stabil slug som används i API:t. Den väljs vid skapande och ändras aldrig. Ingen sorteringskolumn och ingen `active`-kolumn, eftersom REQ-0009 inte kräver något av dem. Listan sorteras på `name`.
- **Databasen har bara schemats egna invarianter:** primärnyckel, unikt index på namn (skiftlägesoberoende) och max ≥ 1. Format- och längdregler för `id` och `name` finns bara i `application`. Ingen annan skrivväg finns, så regeln ligger på en plats (DRY).
- **Startinnehåll** läggs in av en seed-migrering i `services/calendar/migrations/` (nästa löpnummer, `*_games`). `up` skapar tabellen och lägger in de fyra raderna. `down` droppar tabellen. Ingen annan tabell påverkas, eftersom `times` saknar referens till `games`.
- **Portar** i `application`, uppdelade efter användning (ISP):
  - `GameCatalog`: `List(ctx) ([]Game, error)` och `Find(ctx, id) (Game, error)`. Används av `ListGames` och `CreateTime`.
  - `GameCatalogEditor`: `Create(ctx, Game) error`, `Replace(ctx, Game) error` och `Delete(ctx, id) error`. Används av de tre systemadmin-use cases.
  - `Game{ID, Name, DefaultMaxPlayers *int}` är en domäntyp. Sentinel-fel i `application`: `ErrGameNotFound` och `ErrGameTaken`. Alla implementationer ger samma felbeteende (LSP).
- **Adapter** `infrastructure/postgres` implementerar båda portarna. Unikt-fel (SQLSTATE `23505`) översätts till `ErrGameTaken`. En uppdatering eller radering som påverkar 0 rader ger `ErrGameNotFound`.
- **Use cases:** `ListGames` och `CreateTime` är oförändrade. Nya: `CreateGame`, `ReplaceGame` och `DeleteGame`.
- **API:**

  | Metod | Sökväg | Behörighet | Svar |
  |---|---|---|---|
  | GET | `/api/games` | session | 200 `[{id, name, defaultMaxPlayers}]`, sorterat på `name`. Oförändrat. |
  | POST | `/api/games` | systemadmin | 201 `{id, name, defaultMaxPlayers}`. Body `{id, name, defaultMaxPlayers}` |
  | PUT | `/api/games/{gameId}` | systemadmin | 200 `{id, name, defaultMaxPlayers}`. Body `{name, defaultMaxPlayers}` |
  | DELETE | `/api/games/{gameId}` | systemadmin | 204 |

  PUT ersätter hela spelet. `id` i sökvägen kan inte ändras. Båda fälten i body krävs, och `defaultMaxPlayers` kan vara `null` (obegränsat). Ett saknat fält ger `invalid_capacity` eller `invalid_game`, inte ett tyst `null`. PUT valdes framför PATCH, eftersom PATCH då behöver skilja "saknas" från "null" och det blir mer kod för samma sak.
- **Regler** i `application`, i den här ordningen:
  1. Behörighet först: `Actor.IsSystemAdmin` falskt → `403 not_allowed`. Ingen valideringsinformation ges till en icke-admin.
  2. Format: `id` är ett slug, `^[a-z0-9]+(-[a-z0-9]+)*$`, högst 50 tecken → annars `400 invalid_game`. (Gäller bara vid POST. Ett felaktigt id i sökvägen ger `404 game_not_found`.)
  3. Namn trimmas (ADR 0004 regel 1), mäts i kodpunkter och måste vara 1–50 tecken → annars `400 invalid_game`.
  4. `defaultMaxPlayers` är `null` eller heltal ≥ 1 → annars `400 invalid_capacity`. Ingen övre gräns.
  5. Id eller namn (skiftlägesoberoende) finns redan → `409 game_taken`.
  6. Okänt id vid PUT eller DELETE → `404 game_not_found`.
- **Loggning:** varje lyckad skrivning loggas på info-nivå med `actorUserId`, `gameId` och åtgärd (`create`, `replace`, `delete`). Det är driftloggen enligt CLAUDE.md, inte en funktion för användaren. REQ-0010 utesluter användarvänd historik, och den gränsen hålls. Ingen historiktabell införs.
- **Borttagning = radering.** Ingen FK från `times` till `games`, så en radering kan inte blockera eller kaskadera tider. Tiden har kopian `game_name` och `max_players` och påverkas inte.
- **Ändring** av namn eller förvalt max påverkar bara tider som skapas efter ändringen. Befintliga tider behåller sina värden.
- **Gateway:** `/api/games` och `/api/games/*` går till `calendar` för alla metoder (ADR 0002).
- **Tester:**
  - Application mot fakes: behörighet före validering, varje felkod i regel 2–6, trimning, och att radering av ett spel inte rör tider.
  - Adaptern mot riktig PostgreSQL: sortering på namn, `ErrGameNotFound`, skiftlägesoberoende dubblettnamn ger `ErrGameTaken`, check på max ≥ 1, och migreringen `up` och `down`.
  - Transport: `X-User-System-Admin` med annat värde än `true` ger icke-admin. Saknad `X-User-Id` ger 401 (ADR 0011).
  - Kontraktstest mot `api/calendar/openapi.yaml` när kontraktet finns.

## Konsekvenser
- Ändring av listan kräver ingen commit, ingen release och ingen ny container. Förvaltningen sker i appen av systemadmin.
- Förvaltningen loggas men inte versioneras. Det är godtagbart för en lista med några rader. Ingen historik finns att återställa från. Om det blir ett behov görs det med ny ADR.
- Runtime-rollen `calendar` får `select`, `insert`, `update` och `delete` på `games`. Det är nödvändigt eftersom tjänsten nu skriver listan. Om migreringarna körs av samma roll äger den tabellen. Devops-experten avgör om migreringsrollen skiljs från runtime-rollen (minsta behörighet).
- Driftsrollen `calendar_ops` tas bort (YAGNI). Det finns ingen psql-väg kvar för förvaltning. Åtkomst för nödlägen är driftens databasadministratör, inte en förvaltningsväg, och devops-experten dokumenterar den i driftsrutinerna.
- Gränssnittet för förvaltning är lokalt i frontend (route `/systemadmin/spellista`) och bygger på ADR 0011.
- API-kontrakt för tider och `GET /api/games` är oförändrade. `docs/services.md` uppdateras.
- Migreringen är reversibel (`down` droppar tabellen, inga tider påverkas).

## Alternativ som förkastades
- **Fil inbäddad med `go:embed` (tidigare beslut):** ändring kräver commit och release. Användaren har avvisat det.
- **Konfigurationsfil i `infra/` eller miljövariabel:** ändring kräver omdeploy eller omstart, och listan är data, inte konfiguration (CLAUDE.md).
- **psql mot en driftsroll `calendar_ops` (tidigare rekommendation):** kräver driftåtkomst för varje ändring, en extra roll med lösenord, och går förbi all validering i `application`. Ersatt av användarens beslut.
- **CLI i calendar-containern:** en andra ingång till samma funktion. Ersatt av systemadmin-UI.
- **Förvaltning av gruppadmins:** REQ-0009 utesluter det. Listan är gemensam för alla grupper.
- **Egen tjänst `games`:** ingen egen ändringstakt eller ägarskap, och en extra container på Pi:n (ADR 0004, 0008).
- **Kolumnen `active` (inaktivera i stället för radera):** onödig så länge ingen tid refererar till spelet och ingen historik krävs (YAGNI).
- **Främmande nyckel från `times` till `games`:** borttagna spel skulle antingen blockera tiden eller kaskadera bort den, vilket REQ-0009 utesluter (ADR 0006).
- **Härleda `id` från namnet:** kräver Unicode-regler och hanterar kollisioner dåligt. Systemadmin väljer id, och det ändras aldrig.
- **PATCH med tre tillstånd för `defaultMaxPlayers`:** absent, null eller värde. PUT med hela spelet är enklare och stämmer med övriga skrivningar i API:t.
- **Historiktabell för förvaltningen:** loggen räcker för en lista som ändras sällan (YAGNI).
- **Trigger eller databasregel som kontrollerar max mot bokningar:** hör till F-018 och ligger redan i `application` under gruppens lås (ADR 0006).

## Öppna frågor för användaren
- **Namnet "World of Warcraft":** användaren skrev "World of Warcraft/WoW". Startinnehållet använder "World of Warcraft". Om "WoW" ska vara namnet är det en ändring i data, inte i designen. Ingen alias-modell införs.

## Beroenden till andra agenter
- **Backend-expert:** migrering, portar och `postgres`-adapter, use cases, transport (`Actor`), endpoints enligt tabellen och tester enligt ovan. Kontraktet i `api/calendar/openapi.yaml` uppdateras först.
- **Devops-expert:** `SYSTEM_ADMINS` i `auth`-containerns miljö (ADR 0011), grant för runtime-rollen på `games`, borttagning av `calendar_ops`, och bedömning av separat migrationsroll. Gatewayns route för `/api/games/*` (ADR 0002).
- **UI/UX-expert:** sidan `/systemadmin/spellista` och dess felmeddelanden utifrån koderna `not_allowed`, `invalid_game`, `invalid_capacity`, `game_taken` och `game_not_found`. Sidan visas bara när `isSystemAdmin` är sant (ADR 0011).
- **Produktägare:** inget kvar. REQ-0009 och REQ-0010 (F-025) är uppdaterade i linje med detta ADR. Driftloggens omfattning beskrivs ovan.
