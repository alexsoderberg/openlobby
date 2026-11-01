# Backlog

Prioriterad ordning för MVP. Ordningen följer kärnflödet och beroenden: varje krav bygger på de ovan.

| Ordning | Krav | Titel | Prioritet | Beroende av |
|---|---|---|---|---|
| 1 | REQ-0001 | Logga in med Discord | Måste | – |
| 2 | REQ-0002 | Skapa och gå med i grupp via inbjudningslänk | Måste | REQ-0001 |
| 3 | REQ-0009 | Spellista med förvalt max antal platser | Måste | REQ-0001 |
| 4 | REQ-0010 | Hantera spellistan som systemadmin | Måste | REQ-0001, REQ-0009 |
| 5 | REQ-0003 | Lägg upp tillgänglighetstid | Måste | REQ-0002, REQ-0009 |
| 6 | REQ-0004 | Se gruppens kommande tider (lista och kalender) | Måste | REQ-0003 |
| 7 | REQ-0005 | Boka in mig på och avboka en tid | Måste | REQ-0004 |
| 8 | REQ-0007 | Återkalla inbjudningslänk | Måste | REQ-0002 |
| 9 | REQ-0006 | Lämna grupp | Måste | REQ-0002, REQ-0005, REQ-0007 |
| 10 | REQ-0008 | Gör medlem till admin | Måste | REQ-0002 |

Alla tio krav är nödvändiga för MVP, så samtliga är `Måste`. Inget MVP-krav är `Kan` eller `Bör`.

REQ-0009 ligger före REQ-0003 eftersom spelvalet och det förvalda max-värdet i REQ-0003 läser spellistan.

REQ-0010 ligger direkt efter REQ-0009 eftersom det är det enda sättet att ändra spellistan i appen. Inget annat krav beror på REQ-0010, så det blockerar inte kärnflödet; startinnehållet i REQ-0009 räcker för att komma igång.

REQ-0007 ligger före REQ-0006. Lämnande återkallar lämnarens länkar (beslut i REQ-0006), och det kräver återkallningen från REQ-0007.

REQ-0006 kommer efter REQ-0005 eftersom lämnandet tar bort bokningar.

REQ-0004 innehåller både listvyn (F-004) och kalendervyn (F-017). Dessa levereras tillsammans eftersom de visar samma data.

REQ-0002 och REQ-0007 har utökats med max antal användningar på inbjudningslänk (obligatoriskt, 1–10) och gruppadmins överblick över alla länkar. Beroendena i tabellen är oförändrade.

## Senare

Idéer utanför MVP ligger i `features.md` med status `Föreslagen`. De prioriteras först när MVP är levererad och användaren har sett hur den används.
