# REQ-0003. Lägg upp tillgänglighetstid
Status: Beslutad
Funktion: F-003
Prioritet: Måste

## Problem
Den som kan spela vill kunna säga "jag är ledig då" utan att skriva i chatten. Gruppen behöver en tydlig, strukturerad tid att utgå från.

## Användarberättelse
Som medlem vill jag lägga upp en tid då jag kan spela ett visst spel så att andra i gruppen ser när vi kan ses.

## Acceptanskriterier
- Givet att jag är medlem i en grupp, när jag lägger upp en tid med spel, datum, starttid, sluttid och max antal platser, så sparas tiden och visas för alla medlemmar i gruppen. Spelet väljs och max antal platser sätts enligt REQ-0009.
- Givet att jag lägger upp en tid, när den sparas, så är jag skapare av tiden, bokad på den och tar en av tidens platser.
- Givet att jag anger en sluttid som klockslag som är tidigare på dygnet än starttiden, när jag försöker spara, så räknas sluttiden som nästa dygn och tiden sparas, under förutsättning att tiden är kortare än 24 timmar (BESLUT). Exempel: start 22:00 och slut 02:00 ger en tid på 4 timmar som slutar nästa dygn.
- Givet att tiden skulle bli 24 timmar eller längre, inklusive när sluttiden har samma klockslag som starttiden, när jag försöker spara, så nekas det med ett felmeddelande och ingen tid sparas (BESLUT: exakt 24 timmar nekas).
- Givet att starttiden redan har passerat, när jag försöker spara, så nekas det med ett felmeddelande.
- Givet att inget spel är valt, eller att "Annat" är valt med ett namn som är tomt eller över 50 tecken, när jag försöker spara, så nekas det med ett felmeddelande och ingen tid sparas.
- Givet att jag inte är medlem i gruppen, när jag försöker lägga upp en tid, så nekas det och ingen tid sparas.
- Givet att jag är skapare av en tid, när jag tar bort den, så försvinner den för alla medlemmar i gruppen.
- Givet att jag inte är skapare av en tid, när jag försöker ta bort den, så nekas det.
- Givet att två tider överlappar varandra, när båda sparas, så får båda vara kvar. Inga konfliktkontroller i MVP.
- Givet att jag skapar en tid i en tidszon och en annan medlem i en annan tidszon öppnar gruppen, när hen ser tiden, så visas den i hens lokala tid och motsvarar exakt samma verkliga ögonblick.

## Utanför omfånget
- Ändra en befintlig tid, inklusive dess max antal platser (ta bort och skapa ny i MVP, se F-011).
- Återkommande tider (F-014).
- Beskrivning, länk eller anteckning på tiden.
- Notiser, kalenderexport, Discord-publicering.
- Tider som är 24 timmar eller längre, och tider med flera spel.
- Max antal tider per medlem.

## Relaterade funktioner
F-004 (Se gruppens tider) visar det som skapas här. F-005 (Boka in mig) används för att skaparen är bokad från start men kan avboka sig som alla andra; detta är inte en dubblett utan en följd av F-005. F-011 (Ändra tid) är ett eventuellt framtida tillägg och ersätts i MVP av borttagning och ny skapelse. F-024 (Spellista med förvalt max antal platser) levererar spelvalet och det förvalda max-värdet som används här. F-018 (Max antal platser per tid) är gränsen som bokningen respekterar. F-024 föreslår värden, F-018 bestämmer vad som gäller när platserna är slut, så de är inte dubbletter.

## Öppna frågor
- BESLUT (tidszon): Användaren anger datum och klockslag i sin egen lokala tidszon. Tiden sparas som ett exakt ögonblick och visas för varje medlem i dennes lokala tidszon.
- BESLUT (över midnatt): Sluttid som klockslag före starttiden tolkas som nästa dygn. Följd: ett felskrivet klockslag (t.ex. 09:00 i stället för 21:00) ger en lång tid utan varning.
- BESLUT (varning): Ingen varning för långa tider, även inte över 12 timmar. Felskrivna klockslag accepteras i MVP.
- BESLUT (spel): Spel väljs från spellistan (REQ-0009) eller är "Annat" med ett fritextnamn. Spel är obligatoriskt. Samma spel kan stavas olika under "Annat"; det accepteras i MVP. Ersätter tidigare beslut att spel är fritext.
- BESLUT (max antal platser): Max antal platser sätts vid skapande och ändras inte i MVP. Ersätter tidigare beslut att det inte finns någon max-gräns för bokade (REQ-0005).
- ANTAGANDE (felaktigt max): Ett felaktigt max-värde rättas genom att ta bort tiden och skapa en ny (F-011).
- BESLUT (tid i det förflutna): Det går inte att skapa en tid vars starttid redan passerat.
- BESLUT (samtidig redigering): Ingen låsning. Två medlemmar kan skapa tider samtidigt.
