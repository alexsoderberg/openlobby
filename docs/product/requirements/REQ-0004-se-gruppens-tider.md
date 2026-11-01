# REQ-0004. Se gruppens kommande tider
Status: Beslutad
Funktion: F-004 (lista), F-017 (kalendervy)
Prioritet: Måste

## Problem
Tider som läggs upp är värdelösa om ingen kan se dem. Medlemmarna behöver en snabb överblick över vad som är på gång och vem som är med, och ibland en överblick över tiderna i ett veckoschema.

## Användarberättelse
Som medlem vill jag se alla kommande tider i min grupp, med vem som är bokad, i lista eller kalender, så att jag kan välja en tid som passar.

## Acceptanskriterier

Lista (F-004):
- Givet att jag är medlem och det finns kommande tider, när jag öppnar gruppens sida, så visas tiderna sorterade på starttid, och varje rad visar spel, datum och klockslag, skapare och platsläget: "X/Y platser" om tiden har ett max antal platser, och "X bokade" om den saknar max.
- Givet att en tid slutar nästa dygn, när den visas i listan, så visas sluttidens datum också.
- Givet att jag är medlem, när jag öppnar gruppens sida, så visas en tid först när dess sluttid inte har passerat.
- Givet att en tid har passerat sin sluttid, när jag öppnar gruppens sida, så visas den inte i listan.
- Givet att gruppen inte har några kommande tider, när jag öppnar gruppens sida, så visas texten "Inga tider är upplagda ännu".
- Givet att jag är medlem och klickar på en tid, när detaljvyn öppnas, så ser jag namnen på alla bokade medlemmar.
- Givet att en annan medlem just har bokat eller tagit bort en tid, när jag laddar om gruppens sida, så visas ändringen.
- Givet att jag inte är medlem, när jag försöker se gruppens tider, så nekas åtkomsten utan att någon tidsinformation visas.

Växling mellan lista och kalender (F-017):
- Givet att jag är medlem, när jag öppnar gruppens sida, så visas listvyn (BESLUT: lista är standardvy).
- Givet att jag är på gruppens sida, när jag väljer "Kalender", så visas gruppens kommande tider i en veckovy för aktuell vecka. Veckan börjar på måndag och slutar söndag (BESLUT). Månadsvy ingår inte i MVP (BESLUT).
- Givet att jag är i en vy, när jag väljer "Lista" eller "Kalender", så byts vyn och visar samma tider, samma filter (ej passerade) och samma detaljvy.
- Givet att jag är i kalendervyn, när jag väljer "Nästa vecka", så visas de kommande tiderna i den veckan. Passerade tider visas inte, och det finns ingen bakåtnavigering (BESLUT).
- Givet att en tid startar en dag och slutar nästa dygn, när den visas i kalendern, så visas den på startdagen med start- och sluttid och en markering att den slutar nästa dygn. Tiden delas inte upp över två dagar (BESLUT).
- Givet att jag är i kalendervyn, när jag ser en tid, så visas samma platsläge ("X/Y platser" eller "X bokade") som i listan.
- Givet att två tider överlappar varandra, när kalendern visas, så syns båda sida vid sida, och ingen av dem döljs.
- Givet att jag är i kalendervyn och gruppen inte har några kommande tider, när jag ser kalendern, så visas samma text som i listan: "Inga tider är upplagda ännu".
- Givet att jag använder tangentbord, när jag växlar vy eller väljer "Nästa vecka", så kan jag göra det utan mus.
- Givet att jag har valt en vy, när jag öppnar gruppens sida igen senare, så visas listvyn igen. Vyvalet sparas inte mellan besök (BESLUT).

## Utanför omfånget
- Realtidsuppdatering utan att ladda om sidan.
- Månadsvy, filtrering på spel eller datum, sökning.
- Historik över passerade tider (F-020).
- Visning av tider från flera grupper samlat.
- Kalenderexport (F-019).

## Relaterade funktioner
F-003 (Lägg upp tid), F-005 (Boka in mig) och F-018 (Max antal platser per tid) levererar data som visas här. F-017 är samma data i en annan presentation; det är därför det ligger i detta krav och inte i ett eget. Inget annat funktionsregister-objekt visar grupptider, så detta är inte en dubblett.

## Öppna frågor
- BESLUT: Ingen realtidsuppdatering i MVP. Medlemmar laddar om sidan för att se ändringar.
- BESLUT: Alla kommande tider visas, utan paginering i MVP.
- BESLUT: Veckan börjar på måndag.
