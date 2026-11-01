# REQ-0005. Boka in mig på och avboka en tid
Status: Beslutad
Funktion: F-005, F-018
Prioritet: Måste

## Problem
En lista med tider räcker inte. Gruppen behöver veta vem som faktiskt kommer, och man måste kunna ta tillbaka sin anmälan när planerna ändras. Tider med begränsat antal platser behöver också en gräns, så att inte fler än det får plats kommer.

## Användarberättelse
Som medlem vill jag boka in mig på en tid och kunna avboka mig, så att gruppen ser vem som kommer och att tiden inte blir överfull.

## Acceptanskriterier
- Givet att jag är medlem, tiden inte har passerat sin sluttid och det finns en ledig plats, när jag klickar "Boka in mig", så visas jag bland de bokade, antalet bokade ökar med 1 och antalet lediga platser minskar med 1. Detta gäller också medan tiden pågår (BESLUT).
- Givet att alla platser på tiden är bokade, när jag klickar "Boka in mig", så nekas det med ett felmeddelande, ingen bokning sparas och jag visas inte bland de bokade.
- Givet att två medlemmar klickar "Boka in mig" på tidens sista lediga plats samtidigt, när åtgärderna sker, så lyckas högst en av dem och den andra nekas enligt föregående punkt. Antalet bokade överstiger aldrig max antal platser.
- Givet att jag redan är bokad på en tid, när jag klickar "Boka in mig" igen, så ändras ingenting och jag står bara en gång bland de bokade.
- Givet att jag är bokad på en tid, när jag klickar "Avboka", så tas jag bort bland de bokade, antalet bokade minskar med 1 och platsen blir ledig. Detta gäller alltid, även när tiden har passerat sin sluttid (BESLUT).
- Givet att jag inte är bokad på en tid, när jag klickar "Avboka", så ändras ingenting och inget felmeddelande visas.
- Givet att tiden har tagits bort av skaparen, när jag avbokar, så visas att tiden inte längre finns, och tiden försvinner ur vyn utan felruta.
- Givet att tiden har passerat sin sluttid, när jag försöker boka in mig, så nekas det med ett felmeddelande.
- Givet att skaparen har tagit bort tiden, när jag försöker boka in mig, så nekas det med meddelandet "Tiden finns inte längre".
- Givet att jag inte är medlem i gruppen, när jag försöker boka in mig, så nekas det och ingen bokning sparas.
- Givet att jag skapar en tid, när den sparats, så är jag bokad på den automatiskt och tar en av tidens platser. Jag kan avboka mig som alla andra, och när jag har avbokat mig kan jag boka in mig igen om det finns en ledig plats. Antalet bokade är 1 från start.
- Givet att två medlemmar bokar samma tid samtidigt och det finns platser för båda, när båda åtgärderna lyckas, så är båda bokade och antalet är 2.

## Utanför omfånget
- Ändra max antal platser efter skapandet (F-011).
- Väntelista för fulla tider.
- Svar "kanske" (F-021).
- Notiser om bokningar (F-015).
- Att boka in någon annan än sig själv.

## Relaterade funktioner
F-003 (Lägg upp tid) och F-004 (Se gruppens tider). Bokning är inte en dubblett av något annat; det är den enda funktionen som visar vem som kommer. F-018 (Max antal platser per tid) är en gräns för denna funktion och ingår i detta krav. Max-värdet kommer från REQ-0009 (F-024), som sätter förvalt värde och inte styr bokningen.

## Öppna frågor
- BESLUT (användaren): Gå ut kan man alltid. Gå in kan man fram till tidens sluttid, även medan tiden pågår. En bokning fungerar som ett öppet rum som man kan gå in i och ut ur.
- NOTERING: Passerade tider visas inte i MVP (REQ-0004), så gränssnittet erbjuder i praktiken avbokning bara medan tiden syns. Regeln ovan gäller ändå alltid.
- BESLUT (användaren): Ingen gräns för antal bokade per tid utgår. Varje tid har i stället ett max antal platser (F-018, REQ-0009). Ersätter tidigare beslut.
- BESLUT (användaren): Det är bara skaparen som tar bort en tid (se REQ-0003). Ingen annan medlem kan ta bort andras tider.
- BESLUT (användaren): Skaparen räknas in i max antal platser, så en tid med max 1 har bara skaparen.
