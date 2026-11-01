# REQ-0006. Lämna grupp
Status: Beslutad
Funktion: F-010
Prioritet: Måste

## Problem
En medlem som inte längre vill vara med i en grupp har idag ingen väg ut. Då syns hen kvar i medlemslistan och kan stå som bokad på tider, trots att hen inte längre är med. Gruppens medlemslista och bokningar blir då inte sanna.

## Användarberättelse
Som medlem vill jag lämna en grupp så att gruppens medlemslista och tider bara visar dem som faktiskt är med.

## Acceptanskriterier
- Givet att jag är medlem i en grupp, när jag klickar "Lämna grupp" och bekräftar, så är jag inte längre medlem, gruppen försvinner från min grupplista och jag ser "Du har lämnat <gruppnamn>" på grupplistan. Lämnandet kräver bekräftelse, eftersom mina bokningar tas bort (BESLUT).
- Givet att jag är bokad på kommande tider i gruppen som jag inte skapat, när jag lämnar gruppen, så tas min bokning bort och antalet bokade minskar med 1 på varje sådan tid.
- Givet att jag har skapat kommande tider i gruppen, när jag försöker lämna gruppen, så nekas det med felmeddelandet "Ta bort dina kommande tider först" och ingenting ändras (BESLUT).
- Givet att jag har skapat eller varit bokad på tider som redan har passerat sin sluttid, när jag lämnar gruppen, så ligger de kvar i systemet men visas för ingen medlem (BESLUT).
- Givet att jag har lämnat gruppen, när en annan medlem laddar om gruppens sida, så saknas jag i medlemslistan.
- Givet att jag har lämnat gruppen, när jag öppnar gruppens sida direkt via adress, så nekas åtkomsten utan att gruppens innehåll visas.
- Givet att jag har lämnat gruppen och är inloggad, när jag öppnar en aktiv inbjudningslänk för gruppen, så ser jag gruppens namn och knappen "Gå med", precis som en annan icke-medlem (REQ-0002).
- Givet att jag har lämnat gruppen och går med igen via en inbjudningslänk, när åtgärden lyckas, så är jag medlem igen och ser de kommande tiderna utan mina tidigare bokningar. Mitt inträde räknas från det nya inträdet (BESLUT). Adminrollen ges inte tillbaka, även om jag var admin före lämnandet (ANTAGANDE).
- Givet att jag är admin i gruppen och andra admins finns kvar, när jag lämnar gruppen, så händer inget med adminrollerna (BESLUT).
- Givet att jag är sista admin i gruppen och andra medlemmar finns kvar, när jag lämnar gruppen, så blir den medlem som varit med längst gruppens admin. "Varit med längst" räknas från senaste inträde (BESLUT).
- Givet att jag har skapat en eller flera inbjudningslänkar i gruppen, när jag lämnar gruppen, så återkallas alla mina länkar i gruppen och slutar fungera. Bekräftelsen vid lämnandet täcker även detta (BESLUT, bekräftelsen ANTAGANDE).
- Givet att jag är sista medlemmen i gruppen, när jag lämnar gruppen, så tas gruppen bort tillsammans med dess tider och alla dess inbjudningslänkar, och länkarna visar 404-sidan (BESLUT).

## Utanför omfånget
- Ta bort en annan medlem ur gruppen (F-012).
- Ångra att man lämnat gruppen eller få tillbaka bokningar.
- Notis till övriga medlemmar när någon lämnar (F-015).
- Historik över passerade tider (F-020).
- Överlåtelse av adminrollen i förväg (F-022). Adminrollen byter bara ägare automatiskt när sista admin lämnar.

## Relaterade funktioner
F-002 (Skapa och gå med i grupp) är motsatsen: medlemskap börjar där och slutar här. Det är inte en dubblett eftersom beteendet, effekterna på tider och bokningar, och de regler som gäller är helt andra. F-012 (Ta bort medlem) är en annan aktör, en admin som tar bort någon annan, och kräver en befogenhet som inte finns i MVP. F-005 (Boka in mig) och F-003 (Lägg upp tid) påverkas av lämnandet, men är inte dubbletter. F-013 (Återkalla länk) används när lämnarens länkar återkallas (se ovan), se REQ-0007.

## Öppna frågor
- BESLUT (bekräftelse): Lämnandet kräver bekräftelse.
- BESLUT (kommande tider): Den som har kommande tider kan inte lämna förrän hen tagit bort dem. Tiderna tas inte bort automatiskt, eftersom andras bokningar då försvinner utan förvarning.
- BESLUT (sista medlemmen): När sista medlemmen lämnar tas gruppen bort.
- BESLUT (adminöverlämning): När sista admin lämnar går adminrollen till den medlem som varit med längst. Lämnar en admin medan andra admins finns kvar händer inget med rollerna.
- BESLUT (varit med längst): Räknas från senaste inträde. Ett återinträde ersätter det tidigare inträdet.
- BESLUT (länkskapare som lämnar): Länkskaparens inbjudningslänkar återkallas när hen lämnar gruppen. Ersätter tidigare antagande om att admin fick återkalla dem.
- ANTAGANDE (återinträde): En medlem som går med igen är inte admin, även om hen var det före lämnandet. Adminrollen byter bara ägare när sista admin lämnar.
