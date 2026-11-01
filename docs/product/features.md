# Funktionsregister

Enda sanningen om vilken funktionalitet som finns eller är beslutat. Tjänst-kolumnen fylls i av arkitekten.

| ID | Funktion | Status | Tjänst | Krav | Kommentar |
|---|---|---|---|---|---|
| F-001 | Logga in med Discord | Beslutad | auth (+ gateway för sessionsvalidering) | REQ-0001 | Enda inloggningsmetod i MVP. |
| F-002 | Skapa och gå med i grupp via inbjudningslänk | Beslutad | calendar | REQ-0002 | Medlemslista visas för medlemmar. Skaparen blir gruppadmin. Medlemmar skapar länkar på begäran och ser bara sina egna. Länkar gäller 2 timmar (fast) och har alltid max antal användningar, 1–10 (förvalt 10, BESLUT). Obegränsade länkar finns inte (BESLUT, skydd mot missbruk). Gruppadmin ser, kopierar och återkallar alla (BESLUT). |
| F-003 | Lägg upp tillgänglighetstid | Beslutad | calendar | REQ-0003, REQ-0009 | Spel väljs från spellistan (F-024) eller är "Annat" med fritextnamn. Max antal platser sätts vid skapande. Skaparen kan ta bort sin tid. Tid kortare än 24 timmar. |
| F-004 | Se gruppens kommande tider | Beslutad | calendar | REQ-0004 | Lista sorterad på starttid. Visar platsläge (X/Y platser). |
| F-005 | Boka in mig på och avboka en tid | Beslutad | calendar | REQ-0005 | Alla medlemmar kan boka. Avboka går alltid. Boka in går fram till sluttid, även under pågående tid (BESLUT). Inbokning bara om det finns lediga platser (F-018). |
| F-010 | Lämna grupp | Beslutad | calendar | REQ-0006 | MVP. Kommande tider tas bort först. Sista admin som lämnar ger rollen till den som varit med längst (räknat från senaste inträde). Lämnarens länkar återkallas. Sista medlem som lämnar tar bort gruppen. |
| F-011 | Ändra befintlig tid | Förslag | – | – | Senare. I MVP tar man bort och skapar ny. Gäller även max antal platser. |
| F-012 | Ta bort medlem ur grupp | Förslag | – | – | Senare. Bygger på adminrollen (REQ-0002). |
| F-013 | Återkalla inbjudningslänk | Beslutad | calendar | REQ-0007 | MVP. Gruppadmin kan återkalla alla länkar; länkskapare kan återkalla sina egna. Ingen ny länk skapas automatiskt. Utgångna och förbrukade länkar (max antal användningar nått) behandlas som återkallade (404). |
| F-014 | Återkommande tider (t.ex. varje tisdag) | Förslag | – | – | Senare. |
| F-015 | Notiser om nya tider eller bokningar | Förslag | – | – | Senare. Kan kopplas till Discord. |
| F-016 | Publicera tider i Discord-kanal | Förslag | – | – | Senare. Samma behov som F-015 på annat sätt; bedöms när F-015 beslutas. |
| F-017 | Kalendervy (vecka/månad) | Beslutad | calendar | REQ-0004 | MVP: växling mellan lista (standard) och veckovy (måndag–söndag). Månadsvy ej i MVP (BESLUT). |
| F-018 | Max antal platser per tid | Beslutad | calendar | REQ-0005, REQ-0009 | MVP (BESLUT). Max sätts vid skapande och skaparen räknas in. Tomt max = obegränsat. Ingen övre gräns. Fullbokad tid nekar inbokning. Ändras inte efter skapande (F-011). |
| F-019 | Kalenderexport (ics) och synk med externa kalendrar | Förslag | – | – | Senare. Ingen i MVP. |
| F-020 | Historik över passerade tider | Förslag | – | – | Senare. Passerade tider ligger kvar men visas inte i MVP (REQ-0006). |
| F-021 | Svar "kanske" på en tid | Förslag | – | – | Senare. Ökar komplexiteten utan att lösa kärnbehovet. |
| F-022 | Överlåt adminroll till annan medlem | Förslag | – | – | Senare. Avstå egen adminroll i förväg, utan att lämna gruppen. Skiljer sig från F-023. I MVP: ingen kan ta bort en annans adminroll; rollen byter ägare bara när sista admin lämnar (REQ-0006). |
| F-023 | Gör medlem till admin | Beslutad | calendar | REQ-0008 | MVP. Krävs för att en grupp ska kunna ha flera admins (BESLUT). Ingen förlorar sin roll. |
| F-024 | Spellista med förvalt max antal platser | Beslutad | calendar | REQ-0009 | MVP (BESLUT). Gemensam lista som medlemmar väljer ur. Ändras bara av systemadmin i appen (F-025), utan ny version. Medlemmar och gruppadmins kan varken lägga till eller föreslå spel. "Annat" med fritextnamn för spel som saknas. |
| F-025 | Hantera spellistan som systemadmin | Beslutad | calendar (+ auth och gateway för rollen) | REQ-0010 | MVP (BESLUT). Systemadmin är en roll för hela systemet, skild från gruppadmin, och utses av driftaren via konfiguration. Lägg till, ändra (namn, förvalt max) och ta bort spel i appen. Ingen sida för att hantera systemadmins i MVP. |
