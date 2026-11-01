# 0005. Inloggning med Discord och sessionsmodell
Status: Accepterad (2026-11-01)

## Kontext
REQ-0001 kräver inloggning med Discord, utloggning som kräver ny inloggning vid nästa sidvisning, och en återgång till den sida användaren ville nå. Användaren har bekräftat att ingen Discord-server krävs. CLAUDE.md kräver att Discord OAuth2 används bakom en port, och att inloggningen är leverantörsoberoende i datamodellen.

## Beslut

**Flöde:** OAuth2 authorization code, med gatewayen som publik ingång och `auth` som konfidentiell klient.
1. `GET /api/auth/discord/login?returnTo=/grupper/123` skapar en `login_attempt` med slumpat `state` (sparas som hash, giltig 10 minuter, används en gång). Svaret är en redirect till Discord med `state` och PKCE-challenge (S256).
2. Discord redirectar till `GET /api/auth/discord/callback?code&state`. `auth` verifierar `state`, byter `code` mot token och hämtar användaren.
3. Användaren skapas eller uppdateras. `display_name` sätts från Discord vid varje inloggning (antagande i REQ-0001).
4. En session skapas och cookien sätts. Redirect till `returnTo`.

**Returnerar till rätt sida:** `returnTo` måste vara en relativ sökväg som börjar med `/` och inte med `//`. Annars används `/`. Det förhindrar öppna redirects.

**Discord-adapter:**
- Scope: `identify` enbart. Ingen `guilds`, eftersom ingen serverkoppling krävs.
- `provider` = `"discord"`, `provider_subject_id` = Discord-användarens id.
- `display_name` = `global_name` om det finns, annars `username`.
- Avatar hämtas inte. REQ-0001 utesluter avatarer, så fältet införs inte (YAGNI).
- Porten `IdentityProvider` definieras i `auth/internal/application`. `ExternalIdentity{Provider, SubjectID, DisplayName}`. Discord-typerna stannar i adaptern.

**Vid nekad inloggning** (Discord returnerar `error=access_denied`): redirect till `/?loginError=login_denied`. Frontend visar ett begripligt meddelande.

**Session:**
- Token: 32 slumpade bytes (`crypto/rand`), base64url-kodade. Lagras som SHA-256-hash i `sessions.token_hash`. SHA-256 räcker eftersom token är högentropisk och inte ett lösenord.
- Cookie: namn `gk_session`, `HttpOnly`, `Secure`, `SameSite=Lax` (krävs för att cookien ska följa med redirecten från Discord), `Path=/`.
- Utgång: 30 dagar från skapande. Ingen glidande förnyelse i MVP (YAGNI).
- Utloggning: `revoked_at` sätts och cookien rensas. Nästa anrop med samma token ger 401.
- Valideringen sker i `auth` via `POST /internal/sessions/validate`. Gatewayen anropar den per API-anrop (se ADR 0002). Svaret innehåller `userId` och `isSystemAdmin`.
- Systemadminrollen lagras varken i sessionen eller i cookien. `auth` avgör den vid varje validering från konfigurationen (ADR 0011), så en borttagen systemadmin tappar rollen när `auth` startas om med ny konfiguration.
- `SameSite=Lax` skyddar också skrivmetoder (`POST`, `PUT`, `DELETE`) mot anrop från andra sajter, eftersom webbläsaren inte skickar cookien då. Ändras inte till `None`.

**Varför opak token och inte JWT:** REQ-0001 kräver omedelbar utloggning. Med ett fält i databasen är det en uppdatering. Med JWT krävs en återkallningslista, som ändå måste kontrolleras, så fördelen försvinner.

**Hemligheter:** `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` och `DISCORD_REDIRECT_URI` läses från miljövariabler i `auth`. De kommer aldrig i repot.

## Konsekvenser
- Discord är ett nytt externt beroende. Det är motiverat av kravet och stacken.
- Varje API-anrop kräver ett valideringsanrop till `auth`. Se ADR 0002.
- Eftersom `Secure` används kräver produktion HTTPS. Lokal utveckling på `localhost` fungerar med webbläsarens undantag. Driftfrågan hanteras i ADR 0009.
- Discord-redirect-URI:n måste vara HTTPS i produktion. Se ADR 0009.
- Byte av leverantör (t.ex. en annan OIDC-leverantör) är en ny adapter bakom `IdentityProvider` och ett nytt `provider`-värde. Ingen schemaändring och ingen ändring i `calendar`.

## Alternativ som förkastades
- **JWT i cookie:** snabbare validering, men utloggning kräver en återkallningslista. Se ovan.
- **Token i `localStorage`:** exponeras för skript. `HttpOnly`-cookie är säkrare.
- **Sessioner i gatewayen:** gatewayen blir tillståndsbärande och får en databas. Strider mot ADR 0002.
- **Inloggning med e-post eller lösenord:** REQ-0001 utesluter det. Discord räcker.
- **Discord-serverkoppling via `guilds`:** ett antagande i REQ-0001 är att det inte behövs. Det ger dessutom fler behörigheter än nödvändigt (minsta behörighet).
