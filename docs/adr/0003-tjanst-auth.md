# 0003. Tjänst: auth
Status: Accepterad (2026-11-01)

## Kontext
REQ-0001 kräver inloggning med Discord och ett medlemskonto som skapas vid första inloggningen. Sessioner måste kunna valideras av gatewayen och återkallas vid utloggning. Calendar behöver visningsnamn för medlemmar. Identitet är ett eget ansvar med egen ändringstakt (leverantörer, sessionsregler) och delas av framtida domäntjänster.

## Beslut
`auth` är en Go-tjänst med ansvaret **identitet och sessioner**.

**Äger data (schema `auth`):**
- `users`: id (uuid), provider, provider_subject_id, display_name, created_at, updated_at. Unik på (provider, provider_subject_id).
- `sessions`: token_hash (primärnyckel), user_id, created_at, expires_at, revoked_at.
- `login_attempts`: state_hash (primärnyckel), return_to, expires_at. Används en gång under inloggningen.

**Publika endpoints** (via gatewayen, se `api/auth/openapi.yaml`):
- `GET /api/auth/discord/login?returnTo=` startar inloggningen och redirectar till Discord.
- `GET /api/auth/discord/callback` tar emot Discords svar, skapar eller uppdaterar användaren, sätter session-cookien och redirectar till `returnTo`.
- `POST /api/auth/logout` återkallar sessionen och rensar cookien. Kräver inte giltig session.
- `GET /api/auth/me` returnerar `{id, displayName, isSystemAdmin}`. `isSystemAdmin` styr bara om frontend visar sidan för spellistan. Servern kontrollerar alltid själv (ADR 0011).

**Interna endpoints** (`api/auth/internal.yaml`, endast för gateway och calendar):
- `POST /internal/sessions/validate` tar `{token}` och returnerar `{userId, isSystemAdmin}` eller 401. Rollen avgörs vid varje validering (ADR 0011).
- `POST /internal/users/lookup` tar `{userIds}` och returnerar `{users: [{id, displayName}]}`. Calendar använder den för att visa namn i medlemslistor och bokningar.

**Lager** (`services/auth/internal/`):
- `transport`: HTTP-handlers, validering av indata (returnTo, token, id-listor).
- `application`: `LoginService`, `SessionService`, `UserDirectory`-logik. Definierar portarna:
  - `IdentityProvider` (`AuthorizationURL`, `Exchange`), returnerar `ExternalIdentity{Provider, SubjectID, DisplayName}`
  - `UserRepository`, `SessionRepository`, `LoginAttemptRepository`
  - `Clock`, `TokenGenerator`
- `domain`: `User`, `Session`, regler för utgång och återkallelse, och värdetypen `SystemAdmins` med `Includes(User) bool` (ADR 0011).
- `infrastructure`: `discord` (IdentityProvider), `postgres` (repositories), `systemclock`, `cryptotoken`.

Discord-specifika typer stannar i `infrastructure/discord`. Domänen vet bara om `provider` som en sträng.

**Leverantörsbyte:** en ny inloggningsleverantör är en ny adapter bakom `IdentityProvider` och ett nytt värde i `provider`. Ingen schemaändring krävs. Inloggningsmetoden beslutas i ADR 0005.

## Konsekvenser
- Calendar är beroende av `auth` för namnuppslag. Om `auth` är nere fungerar inte grupp- och tidsvyer. Gatewayen är ändå beroende av `auth` för all inloggad trafik, så det ökar inte den totala felytan mycket.
- Namn uppdateras vid nästa inloggning (ett antagande i REQ-0001). Eftersom calendar slår upp namn i `auth` vid varje läsning visas alltid det senaste namnet. En kopia i calendar hade blivit inaktuell.
- `users`-tabellen är den enda källan för visningsnamn. Ingen annan tjänst har en kopia.

## Alternativ som förkastades
- **Auth inbäddad i gatewayen:** gatewayen skulle då äga databas och OAuth-flöde, och tappa sin enkelhet. Den ska vara tillståndslös.
- **Användarkonton i calendar:** identitet skulle då ligga i domäntjänsten. Framtida tjänster skulle behöva läsa calendars tabeller eller kopiera användardata.
- **Kopia av namn i calendar** (uppdateras vid varje inloggning): tar bort anropet vid läsning, men introducerar två källor för samma kunskap (DRY-brott) och kräver synk.
