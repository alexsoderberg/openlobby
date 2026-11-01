# Projektinstruktioner

Det här projektet drivs av ett team av agenter. Huvudsessionen är **orchestrator** och delegerar arbete till specialistagenterna i `.claude/agents/`. Alla agenter följer reglerna i den här filen.

@.claude/agents/orchestrator.md

---

## Teamet

| Agent | Fil | Ansvar | Äger |
|---|---|---|---|
| Orchestrator | `orchestrator.md` | Planerar, delegerar, samordnar, stänger uppgifter | Uppgiftsflöde |
| Produktägare | `product-owner.md` | Bedömer vad som byggs, förhindrar dubbel funktionalitet, kravspecifikation | `docs/product/` |
| Arkitekt | `architect.md` | Design, tjänstegränser, ADR:er, tolkning av regler | `docs/adr/`, `docs/services.md`, kodstandard |
| Reviewer | `reviewer.md` | Sträng granskning av all kod mot arkitektur och kodprinciper | Granskningsrapporter (ändrar ingen kod) |
| UI/UX-expert | `ui-ux-expert.md` | Gränssnitt, användarflöden, tillgänglighet | `frontend/` |
| Backend-expert | `backend-expert.md` | Tjänster, API, domänlogik, auth, databas | `services/`, `api/`, `pkg/` |
| DevOps-expert | `devops-expert.md` | Bygg, CI/CD, drift, miljöer, övervakning | `infra/`, `.github/`, Dockerfiler, `compose*.yml` |

En agent ändrar bara filer inom sitt eget område. Behövs en ändring utanför området skickas den som en begäran till orchestratorn.

## Modellval

Agenterna använder den svagaste modell som klarar uppgiften. Varje uppgift börjar på steg 1 och går upp ett steg i taget bara när det behövs.

| Steg | Modell | Effort | Används |
|---|---|---|---|
| 1 | Haiku (`haiku`) | medium | Alltid först |
| 2 | Sonnet (`sonnet`) | medium | Efter eskalering från steg 1 |
| 3 | Opus 5.5 (`opus`) | medium | Efter eskalering från steg 2. **Högsta tillåtna nivå.** |

- Agentfilerna har `model: haiku` och `effort: medium` som standard.
- Effort är alltid högst `medium`. Modeller över Opus 5.5 (t.ex. Fable eller Mythos) och effort `high` eller högre används aldrig.
- **Eskalering** sker när:
  - agenten själv returnerar `Status: ESKALERA` med en motivering (den klarar inte uppgiften eller kan inte bedöma den säkert), eller
  - resultatet underkänns av reviewern eller av tester två gånger på samma steg, eller
  - orchestratorn bedömer att resultatet tydligt inte håller måttet.
- Orchestratorn kör då om samma uppgift med nästa modell (`model`-parametern när agenten startas) och ger med den tidigare agentens resultat och problem som kontext.
- Hoppa aldrig över ett steg. Misslyckas steg 3 stoppar orchestratorn och frågar användaren.
- Nästa uppgift börjar på steg 1 igen, även för samma agent.
- Huvudsessionen (orchestratorn) körs också på högst Opus 5.5 med effort medium. Det väljs i sessionen med `/model` och `/effort`.
- Använd modellnamnen (`haiku`, `sonnet`, `opus`) i agentfilerna. Kontrollera i Claude Code att de pekar på de versioner du vill ha.

## Stack

Agenterna utgår från detta och väljer inte egna ramverk. Avvikelse kräver en ADR godkänd av arkitekten.

- **Arkitektur:** microservices bakom en API-gateway
- **Backend:** Go (senaste stabila versionen). Standardbiblioteket först.
- **Frontend:** React + TypeScript (Vite). Annat verktyg bara om React inte kan lösa behovet, och då med en ADR som motiverar varför.
- **Inloggning:** Discord OAuth2. Andra inloggningsmetoder bara om Discord inte räcker för ett konkret krav.
- **Databas:** PostgreSQL, en databas (eller ett schema) per tjänst
- **Drift:** Docker / Docker Compose på Raspberry Pi 5 8GB
- **CI:** GitHub Actions

## Skills först

Innan en agent löser en uppgift själv kontrollerar den om det finns en lämplig skill (lista tillgängliga skills; i Claude Code via `/skills` eller skill-listan i sessionen). Finns en som passar ska den användas och dess instruktioner följas.

- **ponytail** används vid allt kodskrivande för att hålla mängden kod så liten som möjligt.
- Andra skills används när de matchar uppgiften (t.ex. frontend-design för UI, skill för dokumentformat, testning, säkerhet).
- Står en skill i konflikt med `CLAUDE.md` gäller `CLAUDE.md`. Flagga konflikten till arkitekten.
- I överlämningen anges vilka skills som användes.

## Microservices

- **En tjänst = en avgränsad förmåga** (bounded context), inte ett tekniskt lager. "users-service" och "db-service" är fel uppdelning.
- **Börja med få tjänster.** Dela upp när en gräns är tydlig och motiverad (olika ändringstakt, ägarskap, skalbehov). Varje ny tjänst kräver en ADR. Hellre en tjänst för lite än en för mycket.
- **Startuppsättning:** `gateway` (routing, sessionsvalidering) och `auth` (Discord OAuth, sessioner). Domäntjänster tillkommer efter behov.
- **Egen data:** en tjänst läser och skriver bara sin egen databas. Ingen tjänst läser direkt i en annan tjänsts tabeller.
- **Kommunikation:** synkront via HTTP/JSON med kontrakt i `api/`. Asynkrona händelser (kö/broker) bara när ett konkret behov finns, och då med en ADR.
- **Kontrakt först:** API-kontrakt (OpenAPI) ligger i `api/<tjänst>/` och är källan för typer i både Go och TypeScript. Kontrakten genereras, de skrivs inte för hand två gånger.
- **Delad kod** i `pkg/` bara för ren infrastruktur (loggning, konfiguration, HTTP-middleware). Ingen delad domänlogik mellan tjänster, eftersom det kopplar ihop dem.
- **Oberoende driftsättning:** varje tjänst byggs, testas och driftsätts för sig.
- **En tjänst = en container.** Varje microservice har en egen `Dockerfile` och körs i en egen container med en process. Frontend och PostgreSQL körs också i egna containrar; en tjänst bäddar aldrig in en annan tjänst eller sin databas i samma container.
- **Containrarna är tillståndslösa och utbytbara.** All konfiguration kommer från miljövariabler, loggar går till stdout, och inget tillstånd sparas i containerns filsystem. En container ska kunna stoppas, startas om eller köras i flera instanser utan dataförlust.
- **Varje tjänst kan köras ensam.** `docker compose up <tjänst>` startar tjänsten med bara de beroenden den behöver. Tjänster hittar varandra via tjänstenamn och adresser från miljövariabler, aldrig via hårdkodade värdnamn eller `localhost`.
- Varje tjänst har `/healthz` och `/readyz`, strukturerad loggning och ett korrelations-id som skickas vidare i alla anrop.

### Katalogstruktur

```
api/<tjänst>/openapi.yaml        kontrakt
services/<tjänst>/
  cmd/<tjänst>/main.go           uppstart och koppling av beroenden
  internal/                      transport, application, domain, infrastructure
  migrations/                    tjänstens egna migreringar
  Dockerfile                     tjänstens egen image
pkg/                             delad infrastrukturkod (inte domän)
frontend/                        React-app
infra/                           compose, driftkonfiguration
docs/adr/                        arkitekturbeslut
docs/services.md                 tjänstekarta: ansvar, ägd data, beroenden
docs/product/                    vision, funktionsregister, backlog, krav
```

## Kodprinciper

Dessa gäller all kod i projektet. Arkitekten är den som tolkar dem vid oenighet.

### Minsta möjliga kod
- Den bästa koden är den som inte behöver skrivas. Använd standardbiblioteket, befintlig kod och skills (ponytail) innan du skriver nytt.
- Inga lager, abstraktioner eller konfigurationsmöjligheter som inget krav behöver.

### SOLID
- **S – Single Responsibility**: en modul, typ eller funktion har ett skäl att ändras. Blanda inte HTTP-hantering, affärslogik och databasåtkomst i samma enhet. På tjänstenivå: en tjänst har ett ansvar.
- **O – Open/Closed**: utöka beteende genom nya implementationer, inte genom att lägga till `if`-grenar i befintlig kod.
- **L – Liskov Substitution**: en implementation av ett interface ska kunna bytas ut utan att anroparen märker skillnad i kontraktet (inklusive felbeteende).
- **I – Interface Segregation**: små, fokuserade interface som definieras där de *används*, inte där de implementeras (idiomatiskt i Go).
- **D – Dependency Inversion**: domänlogik beror på abstraktioner. Konkreta beroenden (databas, externa API:er, klocka) injiceras i `main.go`. Se avsnittet om modularitet nedan.

### DRY
- Kunskap ska ha en enda auktoritativ plats: valideringsregler, konstanter, typer, konfiguration, API-kontrakt.
- Duplicera hellre två gånger än abstrahera för tidigt. Vid tredje förekomsten: extrahera (*Rule of Three*).
- DRY gäller kunskap, inte kod som råkar se likadan ut. Mellan tjänster är viss duplicering acceptabel, eftersom det är bättre än att koppla ihop dem.

### Även
- **KISS** – den enklaste lösningen som uppfyller kravet vinner.
- **YAGNI** – bygg inte för hypotetiska framtida behov.
- **Separation of concerns** – lager inom en tjänst: transport → application → domain ← infrastructure. Domänen importerar aldrig från infrastruktur.
- **Fail fast** – validera vid systemgränser, lita på data inuti.

## Modularitet och leverantörsoberoende

Koden ska vara tydligt separerad och får inte vara bunden till specifika leverantörer, bibliotek eller ramverk. Varje externt beroende ska gå att byta ut genom att skriva en ny adapter, utan att röra domän- eller applikationskoden.

### Portar och adaptrar
- **Port:** ett interface som beskriver vad koden behöver, i domänens eget språk (t.ex. `IdentityProvider`, `UserRepository`, `Clock`). Porten definieras i det lager som använder den.
- **Adapter:** en implementation av porten mot en specifik teknik (t.ex. `discordIdentityProvider`, `postgresUserRepository`). Adaptrar ligger i `infrastructure/`.
- Kopplingen mellan port och adapter görs på ett enda ställe: i `main.go` för Go och i en provider/kompositionsrot för frontend.

### Var interfaces används
Interfaces används **vid gränser**, inte överallt:
- mot alla externa system: identitetsleverantör (Discord), databas, andra tjänster, e-post, lagring, köer
- mot sådant som gör kod svår att testa: tid, slump, filsystem, miljö
- mellan moduler som ska kunna ändras oberoende av varandra

Interfaces används **inte** för ren domänlogik med en enda implementation och inget externt beroende. Ett interface med en implementation och utan gräns att skydda är onödig kod.

### Regler
- **Inga leverantörstyper läcker.** Typer från Discord, `pgx`, HTTP-ramverk eller UI-bibliotek får bara förekomma i adaptern. Porten använder projektets egna typer (t.ex. `ExternalIdentity{Provider, SubjectID, DisplayName, AvatarURL}` i stället för en Discord-användare).
- **Inga leverantörsnamn i domänen.** Domän- och applikationskod nämner aldrig Discord, Postgres eller liknande. Datamodellen sparar t.ex. `provider` + `provider_subject_id` i stället för `discord_id`, så att fler inloggningsleverantörer kan läggas till utan schemaändring.
- **Ett nytt beroende = en adapter.** Ett nytt bibliotek eller en ny extern tjänst införs bakom en port, inte direkt i domän- eller applikationskoden.
- **Byte ska vara lokalt.** Testfrågan är: om vi byter leverantör, ändras då bara adaptern och kopplingen i `main.go`? Om svaret är nej är separationen fel.
- **Standarder före leverantörer.** Använd öppna standarder och format där det går: OAuth2/OIDC, SQL utan leverantörsspecifika funktioner när det inte behövs, OpenAPI, OCI-images, OpenTelemetry-kompatibel loggning och metrik.
- **Moduler har tydliga publika ytor.** I Go ligger implementationen i `internal/` och bara det som behövs exporteras. I frontend exporterar varje modul via ett eget index och importerar inte andra modulers interna filer.

## Kodstandard

- Namn beskriver *vad*, inte *hur*. Inga förkortningar utöver etablerade (`id`, `url`, `db`, `ctx`).
- Funktioner hålls korta (riktmärke: under 30 rader) och på en abstraktionsnivå.
- Inga magiska tal eller strängar, använd namngivna konstanter.
- Kommentarer förklarar *varför*, inte *vad*.
- Fel hanteras explicit; inga tysta `catch` och inga ignorerade `err`. Logga med kontext och exponera aldrig interna detaljer till klienten.
- Ingen död kod, utkommenterad kod eller TODO utan ärendereferens.
- Linter och formatterare är auktoritativa (`gofmt`, `golangci-lint`, ESLint, Prettier).

## Tester

- Varje ändring av beteende har tester. En buggfix börjar med ett test som reproducerar buggen.
- Testpyramid: många enhetstester på domänlogik, färre integrationstester mot riktig databas, få end-to-end.
- Kontraktstester mellan tjänster: en tjänst som anropar en annan testas mot kontraktet i `api/`.
- Tester beror på interface, inte implementationer.

## Arbetsflöde

1. **Produktägaren** bedömer om och varför något ska byggas, kontrollerar att funktionaliteten inte redan finns och skriver kravet med acceptanskriterier.
2. **Orchestratorn** bryter ner kravet i deluppgifter och anger vilka skills som är relevanta.
3. **Arkitekten** granskar planen om den rör tjänstegränser, nya tjänster, nya beroenden, datamodell eller API-kontrakt. Beslut dokumenteras som ADR.
4. **Specialisterna** implementerar inom sina områden, med lämpliga skills och tester.
5. **Reviewern** granskar all ändrad kod strängt mot arkitekturen och kodprinciperna. Fynd klassas: `BLOCKER` / `BÖR` / `KAN`. Vid `EJ GODKÄND` går uppgiften tillbaka till ägande agent och granskas igen efter åtgärd. Vid oklar regel avgör arkitekten.
6. **Orchestratorn** kontrollerar Definition of Done, och **produktägaren** uppdaterar status i funktionsregistret.

Rena buggfixar och tekniska förbättringar utan ny funktionalitet kan gå direkt till steg 2. Ingen kod hoppar över steg 5.

**Ansvarsgränser:**
- Produktägaren undviker dubbel *funktionalitet* (samma behov löst två gånger).
- Arkitekten designar och äger reglerna, och undviker dubbel *kod* (samma kunskap på flera ställen).
- Reviewern kontrollerar att reglerna följs, men ändrar inga regler och ingen kod.

## Definition of Done

- [ ] Acceptanskriterierna i kravet är uppfyllda
- [ ] Funktionsregistret (`docs/product/features.md`) är uppdaterat
- [ ] Lämpliga skills har använts
- [ ] Tester skrivna och gröna lokalt och i CI
- [ ] Lint och typkontroll utan fel
- [ ] Reviewern har gett `GODKÄND` (inga `BLOCKER`, alla `BÖR` åtgärdade eller motiverade)
- [ ] Inga hemligheter i koden
- [ ] Migreringar är reversibla eller har en dokumenterad rollback-plan
- [ ] API-kontrakt, `docs/services.md` och ADR uppdaterade där något ändrats

## Överlämningsformat

När en agent lämnar tillbaka arbete till orchestratorn:

```
## Resultat: <uppgift>
Status: KLAR | BLOCKERAD | DELVIS | ESKALERA
Modell: <haiku | sonnet | opus>
Eskaleringsskäl: <bara vid ESKALERA: vad som inte gick och varför>
Tjänst(er): <berörda tjänster>
Ändrade filer: <lista>
Skills som användes: <lista>
Tester: <vad som lagts till / körts>
Beslut som behöver ADR: <ja/nej + kort>
Beroenden till andra agenter: <vad som behövs, av vem>
Öppna frågor: <lista>
```

## Säkerhet (gäller alla)

- Hemligheter endast via miljövariabler/secret store, aldrig i repot.
- All extern input valideras vid gränsen.
- Principen om minsta behörighet för tjänster, databasroller och CI-tokens.
- Interna tjänster exponeras inte publikt; all extern trafik går via gatewayen.
- Identitet och roll når tjänsterna bara som `X-User-*`-headers som gatewayen sätter. Gatewayen tar bort klientens `X-User-*` på alla routes. Tjänster litar på dessa headers och på ingen annan header för identitet eller roll (ADR 0002, 0011). Roller i en tjänst kontrolleras i `application`, aldrig bara i UI.
