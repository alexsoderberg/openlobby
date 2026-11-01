# 0009. Publik ingång och TLS
Status: Accepterad (2026-11-01)

## Kontext
Systemet ska nås från internet via hemmets Pi (ADR 0008). Discord kräver HTTPS för redirect-URI i produktion (ADR 0005), `Secure`-cookien kräver HTTPS, och REQ-0001 kräver att data mellan webbläsare och appen skyddas av en krypterad anslutning. Gatewayen behåller routing och sessionsvalidering (ADR 0002) och ska inte hantera TLS. Användaren har beslutat att Nginx terminerar TLS och skickar trafiken vidare till gatewayen.

## Beslut

**Container `edge`:** officiell Nginx-image. Ett ansvar: publik ingång. Den gör TLS, HTTP→HTTPS-redirect, säkerhetshuvuden och vidarebefordran till `gateway`. Den har ingen applikationslogik, serverar inga byggda filer och routar inte till andra tjänster. Konfigurationen ligger i `infra/edge/` och ägs av devops-experten. Inga nycklar eller certifikat i repot.

**Flöde:** webbläsare → `edge` (443) → `gateway` → `frontend`, `auth` eller `calendar`. Port 80 används bara för redirect och för ACME-utmaningen.

**Varför en egen Nginx-container och inte frontends:**
- Ansvaret skiljer sig: `edge` är TLS och publik ingång, `frontend` är byggda filer. De ändras i olika takt och av olika skäl (certifikatkonfiguration respektive UI-bygge).
- Frontend-containern ska kunna bytas ut utan att TLS-konfigurationen rörs, och tvärtom.
- En sammanslagen container skulle innehålla både TLS-nycklar och frontend-artefakter. Den skulle också bli publik ingång för statiska filer, vilket bryter mot "all trafik via gatewayen".
- Kostnaden är ca 10 MB RAM och en extra hop på några millisekunder. Det är det enklaste som följer "en container, ett ansvar".

**Portar:** `edge` publicerar 80 och 443 på värden. Ingen annan container publiceras (ADR 0008).

**HTTP→HTTPS:** all trafik på port 80 besvaras med `301` till samma adress på https. Undantaget är `/.well-known/acme-challenge/`, som serveras från en webroot-volym för ACME-utmaningen.

**TLS:**
- Endast TLS 1.2 och 1.3.
- Certifikat från Let's Encrypt (antagande, se nedan), hämtat med certbot i HTTP-01-läge.
- Containern `certbot` (officiell image) kör `certbot renew` med ett fast intervall (förslag: 12 timmar). Den skriver certifikat till volymen `certs`, som `edge` läser i read-only-läge. `certbot` och `edge` delar volymen `acme-webroot`.
- Privata nycklar och ACME-kontots nyckel ligger bara i volymerna. De finns aldrig i repot, i en image eller i en miljövariabel.
- Let's Encrypt-certifikat gäller 90 dagar och förnyas när 30 dagar återstår. Edge läser om certifikatet vid reload. Devops-experten väljer mekanism för reload efter förnyelse, t.ex. en cron på värden som kör `docker compose kill -s HUP edge`. Marginalen är 30 dagar.
- Första certifikatet: `edge` startar inte med HTTPS förrän ett certifikat finns. Devops-experten beskriver ett bootstrap-steg för första installationen.

**HSTS:** `Strict-Transport-Security` sätts på HTTPS-svar. Införs i två steg: `max-age=300` tills HTTPS är stabilt, sedan `max-age=31536000`. Ingen `includeSubDomains` och ingen preload i MVP, eftersom de binder hela domänen längre än behovet.

**Vidarebefordrade headers (edge → gateway):** `edge` sätter alltid dessa värden och ersätter klientens egna:
- `X-Forwarded-Proto: https`
- `X-Forwarded-For: $remote_addr`
- `X-Forwarded-Host: $host`

Gatewayen använder dem bara i åtkomstloggen (ADR 0002). De används aldrig för beslut om session eller behörighet. `X-Request-Id` skickas vidare oförändrat, och gatewayen validerar det (ADR 0001).

**Säkerhetshuvuden:** `Referrer-Policy: same-origin` sätts av `edge` för alla svar. Det är den enda platsen för den headern (ADR 0007). Innehållspolicy (CSP) är frontends beslut.

**Proxy-konfiguration:**
- Adressen till `gateway` kommer från en miljövariabel, inte hårdkodas. Nginx-imagens mall-stöd kan användas för det.
- Nginx löser värdnamnet via Dockers inbyggda DNS vid varje anrop (variabel i `proxy_pass` och `resolver`), inte bara vid start. Annars får `edge` en gammal IP när `gateway` startas om, och det bryter mot kravet att containrar kan startas om utan följdfel.

**Antaganden som inte är beslutade av användaren:**
- ANTAGANDE: ett eget domännamn (eller ett DDNS-namn) som pekar på hemmets publika IPv4, och att port 80 och 443 vidarebefordras från routern till Pi:n.
- ANTAGANDE: Let's Encrypt med HTTP-01. DNS-01 kräver en API-token hos DNS-leverantören, vilket är ytterligare en hemlighet. Det väljs först om port 80 inte kan nås.
- Om internetleverantören använder CGNAT (ingen publik IPv4) eller blockerar 80/443 finns ingen direkt väg in. Då krävs en tunnel (nytt externt beroende, eget ADR) eller en annan lösning. Frågan till användaren, eftersom den avgör om designen går att driftsätta.

**Påverkan på andra ADR:** ADR 0001 (en ingång är nu `edge`), ADR 0002 (TLS-terminering är inte gatewayens; gatewayen litar på `X-Forwarded-*` från `edge`), ADR 0005 (driftfrågan hänvisas hit), ADR 0008 (containrar, portar och resursbudget). Ingen av dem påverkas av produktens antaganden.

## Konsekvenser
- Två Nginx-konfigurationer (`edge` och `frontend`) måste underhållas. Det accepteras för separationen.
- En extra hop per anrop. Det är försumbart för 3–15 användare.
- Gatewayen kan inte nås utifrån, eftersom den inte publiceras. `X-Forwarded-*` kan därför litas på som sätts av `edge`.
- Förnyelse av certifikat är ett driftsansvar. En missad reload ger inget avbrott förrän marginalen (30 dagar) är slut, men det måste övervakas.
- Byte av TLS-lösning (t.ex. till Caddy eller en tunnel) påverkar bara `infra/` och containern `edge`. Ingen kod i tjänsterna ändras.
- Tillståndsbärande: certifikatvolymen. Den ingår i driftens backup-beslut (ADR 0008).

## Alternativ som förkastades
- **Nginx i frontend-containern:** blandar ansvar, TLS-nycklar och byggartefakter, och gör frontend-containern till publik ingång.
- **`edge` serverar frontend direkt, förbi gatewayen:** bryter kravet att all extern trafik går via gatewayen och att routing bor där.
- **Caddy:** automatisk TLS i en container, färre rörliga delar. Tekniskt enklare. Användaren har valt Nginx. Byte är lokalt i `infra/` och `edge` och kan göras senare utan kodändringar.
- **Traefik eller k3s ingress:** för stort för en Pi (ADR 0008).
- **Certbot som cron på värden:** certifikatet ligger då utanför den versionerade containerdriften. Containern är enklare att flytta och underhålla.
- **TLS i gatewayen (Go):** gatewayen blir en TLS-server med certifikathantering och måste startas om vid förnyelse. Blandar routing med drift.
- **Extern tunnel (t.ex. Cloudflare Tunnel):** kräver en extern leverantör och ett eget ADR. Ej valt nu, och används bara om CGNAT blockerar en direkt väg in.
