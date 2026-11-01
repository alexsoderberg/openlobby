# 0001. Grundläggande arkitektur
Status: Accepterad (2026-11-01)

## Kontext
MVP:n för "Gemensam Gibb Kalender" består av sju krav (REQ-0001–0007) som bygger på varandra i ett kärnflöde: inloggning, grupp, tid, överblick, bokning, lämna grupp och återkalla inbjudningslänk. Stacken är redan bestämd i CLAUDE.md: microservices bakom en API-gateway, Go för backend, React + Vite för frontend, Discord OAuth2, PostgreSQL, Docker Compose på Raspberry Pi 5.

Projektet har få användare (3–15 per grupp) och en liten kodbas. Arkitekturen ska därför vara så liten som möjligt men ändå följa stackens regler.

## Beslut
- **Tjänster i MVP:** `gateway` och `auth` (startuppsättningen) samt en domäntjänst `calendar` (grupper, medlemskap, inbjudningar, tider, bokningar). Se ADR 0002–0004.
- **Frontend** är en egen container med statiskt byggda filer. Den nås via gatewayen.
- **En ingång.** All extern trafik går via `edge` (Nginx, terminerar TLS, ADR 0009) till `gateway`. Gatewayen serverar frontenden på `/` och vidarebefordrar `/api/*` till tjänsterna. Frontend och API delar därmed origin, vilket gör cookies och CORS enkla.
- **Interna tjänster exponeras inte.** Endast `edge` publicerar portar (80 och 443). `gateway` svarar 404 på alla sökvägar som börjar med `/internal/`.
- **Kommunikation:** synkront HTTP/JSON. Inga köer eller händelser i MVP.
- **Kontrakt först.** Publika endpoints beskrivs i `api/<tjänst>/openapi.yaml`. Tjänst-till-tjänst-endpoints beskrivs i `api/<tjänst>/internal.yaml`. Typer genereras till Go och TypeScript. Ingen typ skrivs för hand två gånger.
- **Felformat** (samma för alla tjänster):
  ```
  {"error": {"code": "invite_invalid", "requestId": "..."}}
  ```
  Felet innehåller en maskinläsbar `code` och inte någon löptext. Texterna till användaren ligger i frontend, som mappar koder till svenska meddelanden. Det ger en enda auktoritativ plats för texterna.
- **Korrelations-id:** header `X-Request-Id`. Gatewayen tar emot ett giltigt inkommande id (högst 64 tecken, tecken `[A-Za-z0-9-]`) eller genererar ett nytt. Id:t skickas vidare i alla anrop och skrivs i alla loggar.
- **Tider i API:t** är exakta ögonblick i UTC, RFC 3339 (`2026-11-07T18:00:00Z`). Lokal tid hanteras i frontend. Se ADR 0006.
- **Versionering:** inga `/v1`-prefix i MVP. Ändringar ska vara additiva. Brytande ändring kräver nytt ADR.
- **Generatorer för kontrakt** (Go och TypeScript) är ett nytt beroende. Backend-experten lägger fram två alternativ och ett kort tillägg till denna ADR innan första kontraktet skapas.

## Konsekvenser
- Tre Go-tjänster och en frontend-container är mer driftsättning än en monolit. Det motiveras av kravet om microservices i CLAUDE.md och av att varje tjänst kan köras ensam med `docker compose up <tjänst>`.
- Fel som den interna kedjan tappar i transporten blir synliga via korrelations-id, inte via detaljerade felmeddelanden.
- Alla klienter (frontend och framtida) använder samma kontrakt, så ändringar syns i kompileringen.

## Alternativ som förkastades
- **gRPC mellan tjänster:** mer verktyg och binärt format än behovet motiverar. Stacken säger HTTP/JSON.
- **Händelsebaserad kommunikation (broker):** inget krav i MVP kräver asynkronitet. Krav på detta kräver ADR enligt CLAUDE.md.
- **En monolit:** strider mot stacken. Tjänstegränserna i ADR 0003–0004 är därför de gränser som bär designen.
- **Frontend i gatewayens container:** bryter regeln "en tjänst = en container".
