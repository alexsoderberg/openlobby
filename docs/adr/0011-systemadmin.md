# 0011. Systemadmin: roll, konfiguration och förtroende
Status: Accepterad (2026-11-01)

## Kontext
Spellistan förvaltas av en systemadmin i appen (ADR 0010, REQ-0010, F-025). Systemadmin är en roll för hela systemet, skild från gruppadmin (ADR 0004, REQ-0002, REQ-0008). I ADR:erna kallas gruppadmin "admin" som kortform. Rollen måste nå `calendar`, frontend ska kunna visa sidan, och ingen klient ska kunna göra sig till systemadmin.

Konfigurationen ska inte innehålla leverantörsnamn i domänen (CLAUDE.md). Den pekar ut användare via `provider` och `provider_subject_id`, eftersom den interna användar-id:n (uuid) inte är kända när konfigurationen skrivs. Bara `auth` kan koppla en extern identitet till en intern användare.

## Beslut

**Vem är systemadmin:** en eller flera användare pekas ut i miljövariabeln `SYSTEM_ADMINS` i `auth`. Formatet är en kommaseparerad lista av `provider:provider_subject_id`, till exempel `discord:<discord-användar-id>`. Tom eller saknad variabel betyder att ingen är systemadmin. Det finns ingen hantering i appen. Värdet är en personuppgift (ett Discord-id). Det hör till driftens `.env`, som redan är ignorerad av git, och ligger inte i repot. Det är ingen hemlighet, men det är inte heller något som ska versioneras.

**Var rollen avgörs: `auth`.** Bara `auth` vet vilken intern användare som har en viss `(provider, provider_subject_id)`. Om `calendar` skulle avgöra rollen själv måste den läsa `auth`s data eller ställa en ny fråga till `auth` för varje skrivning. Båda varianterna bryter mot att en tjänst bara läser sin egen data.
- `cmd/auth/main.go` läser `SYSTEM_ADMINS` och bygger värdetypen `SystemAdmins` (domänen). Värdet är en lista av par `(provider, subjectId)`, utan leverantörstyper.
- Okänt `provider` (som inte är kopplat i `main.go`) eller tomt `provider_subject_id` ger fel vid start (fail fast). Ett felstavat värde får inte tyst ge eller ta bort en roll.
- `SystemAdmins.Includes(user) bool` jämför `user.Provider` och `user.ProviderSubjectID` med listan. Det är ren domänlogik. Ingen port behövs, eftersom ingen extern gräns finns.
- Rollen avgörs vid varje validering och vid `GET /api/auth/me`. Den lagras inte i `users`, `sessions` eller cookien. Då finns ingen kopia av konfigurationen i data, och ingen migrering krävs för att ge eller ta bort rollen. Ändring i variabeln kräver omstart av `auth`.

**Hur rollen når `calendar`: via gatewayen (ADR 0002).**
1. `POST /internal/sessions/validate` returnerar `{userId, isSystemAdmin}` (ADR 0003).
2. `gateway` tar bort alla inkommande `X-User-*`-headers på alla routes.
3. Vid giltig session sätter `gateway` `X-User-Id` och `X-User-System-Admin` till `true` eller `false`.
4. `calendar` bygger `Actor{UserID, IsSystemAdmin}` i `transport`. Bara exakt värdet `true` ger systemadmin. Saknad eller ogiltig `X-User-Id` ger 401.

Tilliten bygger på samma modell som `X-User-Id` i ADR 0002: `calendar` publiceras inte och gatewayen är den enda vägen in.

**Vad rollen ger, och vad den inte ger:**
- Ger rätt att skapa, ändra och ta bort spel i spellistan (ADR 0010) och att öppna sidan för spellistan.
- Ger ingen rätt i en grupp. Grupp- och tidskontroller ignorerar `Actor.IsSystemAdmin` (ADR 0004 regel 11). En systemadmin som inte är medlem får `404 group_not_found`, precis som vem som helst.
- Ger ingen möjlighet att utse andra systemadmins i appen. Ändring sker bara i konfigurationen.

**Frontend:** `GET /api/auth/me` returnerar `isSystemAdmin` (ADR 0003). Frontend visar länken till `/systemadmin/spellista` bara när värdet är sant. Det är bekvämlighet. Servern kontrollerar alltid, och en dold knapp är inget skydd.

**Inloggning:** systemadmin loggar in med samma Discord-inloggning som alla andra (REQ-0001). Det finns inget separat konto eller lösenord. En systemadmin som inte har loggat in en gång har ingen användarrad och därmed ingen roll, vilket är avsiktligt.

**Säkerhetsgenomgång:**

| Hot | Motåtgärd |
|---|---|
| Klienten skickar egen `X-User-System-Admin: true` | Gatewayen tar bort `X-User-*` på alla routes. `calendar` nås inte direkt (ADR 0008). |
| Gatewayen eller `auth` är nere | Skyddade anrop ger 401 eller 503. Ingen roll antas (fail closed). |
| Gammal roll kvar efter borttagning ur konfigurationen | Rollen avgörs per anrop i `auth`. Den gäller när `auth` startats om med ny konfiguration. Sessioner bär ingen roll. |
| Systemadmin används för att läsa grupper | Rollen ger ingen gruppbehörighet (regel 11). Grupper kräver medlemskap. |
| CSRF på skrivningar (`POST`, `PUT`, `DELETE`) | `SameSite=Lax` på cookien (ADR 0005). Webbläsaren skickar inte cookien vid anrop från annan sajt. |
| Felstavat värde i konfigurationen | Ett felstavat subject-id matchar ingen användare, så ingen får rollen (fail closed). Ett okänt provider ger fel vid start. |
| Spårbarhet | Varje ändring i spellistan loggas med `actorUserId` (ADR 0010). |
| För stor eller felaktig indata | Validering i `application` och en gräns för requestens storlek i `transport`. |
| Onödig åtkomst för driftsroller | Runtime-rollen `calendar` får bara DML på `games`. Driftsrollen `calendar_ops` tas bort (ADR 0010). |

**Hemligheter:** ingen ny hemlighet. `SYSTEM_ADMINS` är konfiguration. Discord-klienthemligheterna i ADR 0005 påverkas inte.

## Konsekvenser
- En ändring av gatewayens header-regel (ADR 0002), ett utökat svar från `POST /internal/sessions/validate` (ADR 0003) och en ny fält i `GET /api/auth/me` (ADR 0003). Alla tre är additiva.
- `SYSTEM_ADMINS` måste sättas i driftens `.env` på Pi:n. Devops-experten lägger in variabeln i `compose` och `.env.example` utan värde.
- Att byta eller lägga till systemadmin kräver att `auth` startas om. Ingen annan tjänst berörs.
- Om en systemadmin förlorar sitt Discord-konto eller om konfigurationen är fel måste driftaren ändra konfigurationen. Det finns ingen reservväg i appen. Det är avsiktligt, eftersom en sådan väg vore en ny attackyta.
- Rollen har stor makt över spellistan och ingen över grupper. Det accepteras för en ägare av projektet.

## Alternativ som förkastades
- **Kolumnen `is_system_admin` i `users`:** en andra källa för samma konfiguration (DRY). Ändring kräver migrering eller ett UI för att sätta flaggan.
- **Konfiguration med internt användar-id:** uuid:n är inte känd när konfigurationen skrivs. Dessutom måste id:t kopplas till en identitet, vilket bara `auth` kan.
- **`calendar` läser konfigurationen själv:** `calendar` kan inte koppla identitet till uuid utan `auth`. Det ger två källor för identitet.
- **Gatewayen avgör rollen:** gatewayen får då behörighetsbeslut, vilket ADR 0002 uttryckligen förbjuder, och behöver själv konfigurationen.
- **Roll i en JWT:** utloggning och borttagen roll blir fördröjda (ADR 0002 och 0005).
- **Calendar frågar `auth` vid varje skrivning:** en extra synkron hop för varje skrivning, för en beslutsfråga som gatewayen redan har svaret på.
- **Roll i gruppernas medlemskap (`group_members.role = 'system_admin'`):** blandar gruppbehörighet med systemrollen. Det strider mot kravet att systemrollen är skild från gruppadmin.
- **Separat inloggning för systemadmin:** strider mot REQ-0001 (Discord-inloggning) och ger ett andra konto att skydda.
- **Ett admin-UI för att utse systemadmins:** en ny yta för rättigheter utan krav i MVP (YAGNI). Ändring i konfigurationen räcker.

## Öppna frågor
- Ingen. REQ-0010 och ordlistan i `docs/product/vision.md` stämmer med detta ADR. Driftaren kan peka ut fler än en systemadmin.
