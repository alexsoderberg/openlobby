# REQ-0008. Gör medlem till admin
Status: Beslutad
Funktion: F-023
Prioritet: Måste

## Problem
Ansvaret för att återkalla inbjudningslänkar, t.ex. när en länk läcker en kväll då skaparen inte är inloggad, hamnar idag på en enda person. Gruppen behöver fler än en som kan stänga en läckt länk, men det finns ingen väg att få fler admins än skaparen.

## Användarberättelse
Som admin vill jag göra en medlem till admin så att fler i gruppen kan återkalla läckta inbjudningslänkar.

## Acceptanskriterier
- Givet att jag är admin i en grupp och en annan medlem inte är admin, när jag väljer "Gör till admin" på hen och bekräftar, så blir hen admin och adminmarkeringen visas för alla medlemmar i medlemslistan. Bekräftelse krävs eftersom det inte kan ångras i MVP (ANTAGANDE).
- Givet att en medlem har blivit admin, när hen öppnar gruppen, så har hen samma befogenheter som övriga admins i MVP: att återkalla alla gruppens inbjudningslänkar och att göra andra medlemmar till admin.
- Givet att jag inte är admin, när jag ser gruppens medlemslista, så saknas valet "Gör till admin".
- Givet att jag inte är admin, när jag försöker göra en medlem till admin, så nekas det och ingen roll ändras.
- Givet att jag försöker göra en person till admin som inte längre är medlem i gruppen, när jag bekräftar, så nekas det och ingen roll ändras.
- Givet att jag är admin och ser en annan admin, när jag går igenom gruppens medlemslista, så finns inget val för att ta bort hens adminroll (BESLUT: ingen kan ta bort en annans adminroll i MVP).
- Givet att jag är admin och vill avstå från adminrollen, när jag lämnar gruppen, så gäller REQ-0006. Det finns inget annat sätt att avstå i MVP.

## Utanför omfånget
- Ta bort en annans adminroll (ingen MVP-funktion).
- Överlåtelse av egen adminroll i förväg utan att lämna gruppen (F-022).
- Ångra en adminutnämning.
- Ta bort medlem ur gruppen (F-012).
- Andra admin-befogenheter än att återkalla länkar och göra medlem till admin.

## Relaterade funktioner
F-022 (Överlåt adminroll) är en annan funktion. Den låter en admin avstå sin egen roll, medan F-023 lägger till en admin utan att någon förlorar sin roll. Det är inte en dubblett, men F-022 bygger på att F-023 finns. F-002 (Skapa och gå med i grupp) ger gruppens första admin. F-013 (Återkalla länk) och F-010 (Lämna grupp) använder de adminroller som F-023 ger fler av.

## Öppna frågor
- ANTAGANDE (hur fler blir admin): En admin kan göra en medlem till admin. Det finns ingen annan väg i MVP.
- ANTAGANDE (bekräftelse): Befordran till admin kräver bekräftelse.
- BESLUT (användaren): Ingen kan ta bort en annans adminroll i MVP. Admin avstår genom att lämna gruppen.
- ÖPPEN FRÅGA: Ska en admin kunna ta bort en annans adminroll i en senare version, t.ex. om en admin inte längre bör ha rollen? Ej beslutat.
