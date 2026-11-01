# 0008. Drift: containrar, PostgreSQL och resursbudget
Status: Accepterad (2026-11-01)

## Kontext
Systemet ska köras med Docker Compose på en Raspberry Pi 5 med 8 GB RAM. Det är en enda nod, och tjänsterna ska kunna köras och startas om var för sig. Driftsättningen påverkar designen: antal databaser, anslutningar, vilka containrar som finns och vilka beroenden som behövs för att starta en tjänst. Publik ingång och TLS beslutas i ADR 0009.

## Beslut

**Containrar (en tjänst = en container, ett ansvar per container):**

| Container | Image | Stateful | Ansvar |
|---|---|---|---|
| `edge` | officiell Nginx | nej | Publik ingång, TLS (ADR 0009) |
| `certbot` | officiell certbot | ja (certifikatvolym) | Förnyar certifikat (ADR 0009) |
| `gateway` | egen (Go) | nej | Routing, sessionsvalidering |
| `auth` | egen (Go) | nej | Identitet och sessioner |
| `calendar` | egen (Go) | nej | Grupper, tider, bokningar |
| `frontend` | statisk webbserver med byggda filer | nej | Användargränssnittet |
| `postgres` | officiell PostgreSQL | ja (volym) | Data |

Images för egna tjänster byggs för `linux/arm64` (och `amd64` för utveckling) i CI. Varje egen tjänst har en egen `Dockerfile`. Officiella images (`edge`, `certbot`, `postgres`, frontend-webbservern) använder konfiguration i `infra/`.

**PostgreSQL:** en instans i en container. Två databaser, `auth` och `calendar`, med varsin roll (se ADR 0006). Konfigureras med små värden: `shared_buffers` ca 128 MB och lågt `max_connections`. Varje tjänst använder en pool med högst 5 anslutningar, konfigurerbar via miljövariabel.

**Frontend-image:** statisk webbserver (officiell nginx-image) som serverar byggda filer från `frontend/dist`. Konfigurationen är en enda fil. Nytt externt beroende, godkänt här. Alternativet var en egen liten Go-server, men den ger en extra kodbit att underhålla för samma uppgift.

**Konfiguration och tillstånd:** all konfiguration från miljövariabler. Loggar till stdout i JSON. Tillståndsbärande delar är PostgreSQL-volymen och certifikatvolymen (ADR 0009). Sessioner ligger i databasen, inte i containern, så en omstart av `auth` loggar inte ut användare.

**Hälsa:** `/healthz` svarar om processen lever. `/readyz` kontrollerar bara tjänstens egen databas. Den kontrollerar inte andra tjänster, så att en tjänst inte blir oanvändbar av ett fel i en annan tjänst.

**Compose-beroenden** (så att `docker compose up <tjänst>` startar minsta möjliga):
- `edge` → `gateway`
- `gateway` → `auth`, `frontend`
- `auth` → `postgres`
- `calendar` → `postgres`, `auth`
- `frontend` → inga
- `certbot` → inga

**Resursbudget (uppskattning, mäts innan MVP går live):**

| Komponent | Mål RAM |
|---|---|
| PostgreSQL (shared_buffers 128 MB) | ca 250 MB |
| Varje Go-tjänst (gateway, auth, calendar) | ca 30 MB var |
| Frontend-container | ca 20 MB |
| Edge (Nginx) | ca 10 MB |
| Certbot (sover mellan förnyelser) | ca 40 MB |
| Summa | ca 460 MB av 8 GB |

**Säkerhet i drift:** endast `edge` publicerar portar på värden (80 och 443). `gateway`, `auth`, `calendar`, `frontend` och PostgreSQL publiceras inte. För lokal utveckling får `gateway` publiceras på `127.0.0.1` i en separat dev-konfiguration, aldrig på alla gränssnitt.

## Konsekvenser
- En nod är en enkel felpunkt. För 3–15 användare är det godtagbart.
- Varje ny container kostar ungefär ett par tiotals MB och en konfigurationsfil att underhålla. Det är ett skäl att inte dela upp i onödan (ADR 0004).
- Om Postgres-instansen behöver flyttas är det en volymkopia och en miljövariabel per tjänst, inga kodändringar.
- Certifikatförnyelse är ett driftsansvar som ligger utanför koden. Övervakning av certifikatets utgångsdatum är devops-expertens ansvar.

## Alternativ som förkastades
- **Egen PostgreSQL-container per tjänst:** tre instanser av samma sak på en Pi. Onödig resursanvändning.
- **SQLite:** enklare drift, men stacken säger PostgreSQL och flera tjänster skriver samtidigt.
- **Kubernetes eller k3s:** orimligt för en Pi och fem containrar.
