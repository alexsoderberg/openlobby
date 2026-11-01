# 0002. Tjänst: gateway
Status: Accepterad (2026-11-01)

## Kontext
Alla externa anrop ska gå via en API-gateway (CLAUDE.md). Gatewayen måste validera sessionen för skyddade anrop, men den ska inte äga användardata eller behörighetsregler. Varje ny funktion ska inte kräva en ändring i gatewayen.

## Beslut
`gateway` är en tillståndslös Go-tjänst med ett ansvar: **routing och sessionsvalidering**.

Gatewayen:
- serverar routing mot `frontend` (alla icke-API-sökvägar), `auth` och `calendar` enligt en explicit route-tabell (allowlist). Okänd sökväg ger 404.
- blockerar alla `/internal/*`-sökvägar med 404.
- validerar sessionen för alla `/api/*` utom de publika auth-routerna (se nedan). Validering sker genom anrop till `auth`:s `POST /internal/sessions/validate` med cookie-värdet.
- på **alla** routes, även publika, tar den bort alla inkommande `X-User-*`-headers. Vid giltig session sätter den `X-User-Id` och `X-User-System-Admin` (`true` eller `false`) från svaret (ADR 0011). Ogiltig eller saknad session ger 401 utan att anropet når tjänsten.
- genererar eller validerar `X-Request-Id` och skriver en åtkomstlogg. Loggen skriver inte ut sökvägen för `/api/invites/{token}` i klartext (se ADR 0007).
- litar på `X-Forwarded-For` och `X-Forwarded-Proto` endast från `edge` (ADR 0009). Gatewayen är inte publicerad, så andra anrop kan inte nå den. Värdena används för loggning och aldrig för beslut om session eller behörighet.
- exponerar `/healthz` och `/readyz`. `/readyz` kontrollerar bara gatewayens egna beroenden.

Publika routes (utan sessionskrav): `GET /api/auth/discord/login`, `GET /api/auth/discord/callback`, `POST /api/auth/logout`.

Gatewayen gör **inte**: behörighetskontroll mot grupper eller tider (det är `calendar`:s ansvar), caching av sessioner, rate limiting (inte i MVP, se ADR 0007), eller TLS-terminering (ligger i `edge`, se ADR 0009).

**Implementation:** standardbibliotekets `net/http` och `httputil.ReverseProxy`. Ingen extern router eller ramverk.

**Portar:** `gateway` definierar `SessionValidator` (`Validate(ctx, sessionToken) (Session, error)`, där `Session{UserID, IsSystemAdmin}`) i det paket som använder den. Adaptern `authclient` gör HTTP-anropet till `auth`. Byte av sessionsmodell påverkar bara adaptern, så länge porten bevaras.

**Förtroendemodell:** nedströmstjänster litar på `X-User-Id` och `X-User-System-Admin` och på inga andra headers för identitet eller roll. Det gäller eftersom gatewayen är den enda väg in och tjänsterna inte publiceras. Gatewayen tar bort klientens `X-User-*` på alla routes, så en klient kan inte förfalska dem. Om det ändras (t.ex. en tjänst exponeras) måste identiteten bäras av en signerad token. Det är ett eget ADR.

**Routes för spellistan:** `/api/games` och `/api/games/*` går till `calendar` för alla metoder. Behörighet avgörs i `calendar`, inte i gatewayen (ADR 0010, 0011).

## Konsekvenser
- Varje API-anrop kostar ett extra HTTP-anrop till `auth`. På en Pi med några användare är det försumbart.
- Om `auth` är nere svarar gatewayen 503 på skyddade anrop. Den släpper aldrig igenom osignerade förfrågningar (fail closed).
- Gatewayen har ingen egen databas och ingen session-state. Den kan startas om eller köras i flera instanser.
- En ny tjänst kräver en rad i route-tabellen och ett ADR. En ny publik route i en befintlig tjänst kräver bara route-tabellen.

## Alternativ som förkastades
- **Validera JWT lokalt i gatewayen:** snabbare, men utloggning blir inte omedelbar utan en revocation-lista. REQ-0001 kräver att nästa sidvisning efter utloggning kräver ny inloggning. Ett fast valideringsanrop är enklare.
- **Cache av sessioner i gatewayen:** kan läggas till senare om belastningen kräver det. Det ger fördröjd utloggning, så det införs inte nu (YAGNI).
- **Gatewayen läser `auth`:s databas:** bryter regeln att en tjänst bara läser sin egen data.
- **Auth-logik i gatewayen:** blandar routing och identitet. Auth får egen tjänst (ADR 0003).
