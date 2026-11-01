# REQ-0007. Återkalla inbjudningslänk
Status: Beslutad
Funktion: F-013
Prioritet: Måste

## Problem
En inbjudningslänk som läcker, t.ex. till fel person eller offentligt i en chatt, gör att vem som helst kan gå med i gruppen. Gruppen behöver ett sätt att stänga en läckt länk utan att behöva skapa en ny grupp.

## Användarberättelse
Som gruppadmin eller länkskapare vill jag återkalla en inbjudningslänk så att en läckt länk inte längre ger tillgång till gruppen.

## Acceptanskriterier
- Givet att jag är länkskapare för en aktiv inbjudningslänk, när jag väljer "Återkalla länk" och bekräftar, så slutar just den länken att fungera. Ingen ny länk skapas automatiskt (BESLUT).
- Givet att jag är gruppadmin, när jag väljer "Återkalla länk" på valfri aktiv länk i gruppen och bekräftar, så slutar den länken att fungera.
- Givet att jag är medlem men varken gruppadmin eller skapare av länken, när jag försöker återkalla den, så nekas det med ett felmeddelande och ingen länk ändras.
- Givet att jag väljer "Återkalla länk" och avbryter bekräftelsen, när jag stänger dialogen, så förblir länken aktiv och ingenting ändras. Bekräftelse krävs vid återkallning (BESLUT).
- Givet att en länk har återkallats, gått ut eller nått sitt max antal användningar, när jag öppnar gruppens sida, så visas den inte bland de aktiva länkarna.
- Givet att en länk har återkallats eller nått sitt max antal användningar, när jag som inloggad icke-medlem öppnar den, så visas 404-sidan, exakt samma som för en länk som inte motsvarar någon grupp (REQ-0002). Gruppens namn visas inte.
- Givet att en länk har återkallats eller nått sitt max antal användningar, när någon som redan står på "Gå med"-sidan klickar "Gå med", så visas 404-sidan och inget medlemskap skapas. Giltigheten kontrolleras vid klicket (BESLUT).
- Givet att en länk har gått ut (mer än 2 timmar efter skapandet) eller nått sitt max antal användningar, när någon öppnar den eller klickar "Gå med", så visas 404-sidan, exakt samma som för en återkallad länk. Inget medlemskap skapas vid klicket (BESLUT).
- Givet att en länk har gått ut eller nått sitt max antal användningar, när någon försöker återkalla den, så nekas det med ett felmeddelande och ingen länk ändras. En utgången eller förbrukad länk behandlas som redan död och behöver inte återkallas (BESLUT).
- Givet att en medlem redan är med i gruppen när en länk återkallas, går ut eller förbrukas, när det sker, så påverkas hen inte: hen förblir medlem, behåller sina bokningar och ser gruppens tider som tidigare.
- Givet att jag inte är medlem i gruppen, när jag försöker återkalla en länk, så nekas det och ingen länk ändras.
- Givet att jag är skapare av en länk och lämnar gruppen, när lämnandet lyckas, så återkallas länken (BESLUT, se REQ-0006).

## Utanför omfånget
- Ta bort en medlem ur gruppen (F-012). Återkallning och utgång påverkar bara framtida inträden, inte redan anslutna medlemmar.
- Andra gruppadmin-befogenheter än att se, kopiera och återkalla länkar och göra medlem till gruppadmin (REQ-0002, REQ-0008), och överlåtelse av gruppadminrollen (F-022).
- Förlängning av en länks giltighetstid.
- Historik över återkallade, utgångna och förbrukade länkar.
- Notis till medlemmar när en länk återkallas, går ut eller förbrukas (F-015).

## Relaterade funktioner
F-002 (Skapa och gå med i grupp) skapar länkarna och använder dem. Återkallning och utgång ändrar bara vad som händer med länken efter att den delats, och kräver därför ett eget beteende och eget krav. F-010 (Lämna grupp) utlöser återkallning av lämnarens länkar. F-012 (Ta bort medlem) är annan funktion: den tar bort en specifik person, medan återkallning stänger en länk för alla framtida inträden via den.

## Öppna frågor
- BESLUT (användaren): Endast gruppadmin eller den som skapat en länk får återkalla just den länken. Övriga medlemmar nekas.
- BESLUT (användaren): Den som öppnar en gammal, återkallad länk ser 404-sidan.
- BESLUT (användaren): Inbjudningslänkar gäller i 2 timmar från skapandet. En utgången länk behandlas som återkallad och ger 404-sidan.
- BESLUT (användaren): En länk med max antal användningar som är nådd behandlas som utgången: 404-sidan, ingen i listan över aktiva länkar, och den kan inte återkallas.
- BESLUT (användaren): Giltigheten kontrolleras vid klicket på "Gå med". En länk som går ut medan sidan är öppen nekas.
- BESLUT (användaren): Länkar skapas bara på begäran, inte automatiskt vid gruppskapande. Gränssnittet visar när länken går ut (REQ-0002).
- BESLUT (användaren): Medlemmar kan själva skapa länkar, och flera kan vara aktiva samtidigt (REQ-0002).
- BESLUT (användaren): Återkallning skapar inte en ny länk. Gruppen kan därför sakna aktiv länk tills någon skapar en.
- BESLUT (användaren): När en länkskapare lämnar gruppen återkallas hens länkar (REQ-0006). Ersätter tidigare antagande om att bara gruppadmin kunde återkalla dem.
- BESLUT (användaren): Återkallning kräver en bekräftelse.
