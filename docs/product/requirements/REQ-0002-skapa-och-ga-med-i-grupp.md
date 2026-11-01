# REQ-0002. Skapa och gå med i grupp via inbjudningslänk
Status: Beslutad
Funktion: F-002
Prioritet: Måste

## Problem
Tider måste höra till en krets av vänner, inte vara synliga för alla. Gruppen behöver en enkel väg in för nya medlemmar som inte redan är med, och en länk som alltid har ett max antal användningar. Utan en övre gräns kan en läckt länk missbrukas, t.ex. av bottar (BESLUT, användaren).

## Användarberättelse
Som medlem vill jag skapa en grupp och bjuda in mina vänner med en länk, begränsad till ett max antal användningar, så att vi alla ser samma tider och bara rätt personer kommer in.

## Acceptanskriterier
- Givet att jag är inloggad, när jag skapar en grupp med ett namn på 1–50 tecken, så blir jag medlem och gruppadmin i gruppen och gruppen visas i min grupplista.
- Givet att jag är inloggad, när jag skapar en grupp med ett tomt namn eller ett namn på över 50 tecken, så nekas skapandet med ett felmeddelande och ingen grupp sparas.
- Givet att jag är medlem i en grupp, när jag väljer "Skapa inbjudningslänk", så skapas en ny länk med mig som länkskapare, och jag kan kopiera den. Länken gäller i 2 timmar från skapandet. Giltigheten går inte att välja (BESLUT). Länkar skapas bara på begäran, inte automatiskt vid gruppskapande (BESLUT).
- Givet att jag skapar en inbjudningslänk och lämnar max antal användningar tomt, när jag sparar, så sparas länken med max 10 användningar (BESLUT, användaren: förvalt värde 10).
- Givet att jag skapar en inbjudningslänk med max antal användningar som ett heltal från 1 till 10, när jag sparar, så gäller länken för högst så många användningar (BESLUT).
- Givet att jag skapar en inbjudningslänk med max antal användningar som inte är ett heltal från 1 till 10 (t.ex. 0, 11, -2, 2,5 eller text), när jag försöker spara, så nekas det med ett felmeddelande och ingen länk skapas (BESLUT).
- Givet att en inbjudningslänk har max 10 användningar och 9 redan har gått med, när den 10:e går med, så blir hen medlem och länken visar 10/10. Givet att länken visar 10/10, när en 11:e öppnar den eller klickar "Gå med", så visas 404-sidan och inget medlemskap skapas (BESLUT).
- Givet att jag är medlem i en grupp, när jag öppnar gruppens sida, så ser jag mina egna aktiva inbjudningslänkar och kan kopiera dem. Varje länk visar när den går ut i min lokala tid och antal användningar som "X/Y", t.ex. "3/10" (BESLUT).
- Givet att jag är gruppadmin, när jag öppnar gruppens sida, så ser jag alla gruppens aktiva inbjudningslänkar, med skapare, antal användningar som "X/Y" och utgångstid, och kan kopiera och återkalla vilken som helst (BESLUT; ersätter tidigare antagande).
- Givet att jag är inloggad men inte medlem, när jag öppnar en aktiv inbjudningslänk, så ser jag gruppens namn och en knapp "Gå med".
- Givet att jag är inloggad och klickar "Gå med", när åtgärden lyckas, så blir jag medlem, gruppen visas i min grupplista och länkens antal användningar ökar med 1 (ANTAGANDE: varje lyckat inträde via länken är en användning).
- Givet att jag står på "Gå med"-sidan och länken går ut eller har nått sitt max antal användningar innan jag klickar, när jag klickar "Gå med", så visas 404-sidan och inget medlemskap skapas. Giltigheten kontrolleras vid klicket, inte bara när sidan öppnas (BESLUT).
- Givet att två personer klickar "Gå med" på länkens sista användning samtidigt, när åtgärderna sker, så blir högst en av dem medlem och den andra får 404-sidan utan medlemskap. Antalet användningar överstiger aldrig max (BESLUT).
- Givet att jag har gått med via inbjudningslänken, när åtgärden lyckas, så ser jag gruppens medlemslista och gruppens kommande tider (REQ-0004). Den som har länken kan alltså se gruppens innehåll efter att ha gått med.
- Givet att jag redan är medlem och länken är aktiv, när jag öppnar inbjudningslänken, så skapas inget nytt medlemskap, länken räknas inte som användning och jag kommer till gruppens sida (ANTAGANDE: nej, räknas inte).
- Givet att en inbjudningslänk har gått ut (mer än 2 timmar efter skapandet) eller har nått sitt max antal användningar, när någon öppnar den, så visas 404-sidan och ingen gruppinformation, samma som för en okänd länk. Även en redan medlem ser 404 (BESLUT: förbrukad fungerar som utgången).
- Givet att en inbjudningslänk inte motsvarar någon grupp, när någon öppnar den, så visas 404-sidan och ingen gruppinformation. Samma 404-sida som för en återkallad, utgången eller förbrukad länk (REQ-0007), så att de inte kan skiljas åt (BESLUT).
- Givet att jag inte är inloggad, när jag öppnar en inbjudningslänk, så visas inloggningen och efter lyckad inloggning hamnar jag på inbjudningssidan.
- Givet att jag är medlem, när jag öppnar gruppens sida, så ser jag medlemslistan med visningsnamn och vilka som är gruppadmin.
- Givet att jag inte är medlem, när jag försöker öppna gruppens sida via direkt adress, så nekas åtkomsten utan att gruppens innehåll visas.

## Utanför omfånget
- Lämna grupp (se REQ-0006), ta bort medlem (F-012), att göra en medlem till gruppadmin (se REQ-0008), att ta bort en annans gruppadminroll, överlåtelse av egen gruppadminroll i förväg (F-022), och andra gruppadmin-befogenheter än att se, kopiera och återkalla länkar och göra medlem till gruppadmin.
- Inbjudan via e-post eller Discord-meddelande. Användaren kopierar länken själv.
- Gruppbeskrivning, bild eller inställningar.
- Gruppnamn som måste vara unikt.
- Förlängning av en länks giltighetstid, eller ändring av max antal användningar efter skapandet (ANTAGANDE, samma som för max antal platser).
- Automatisk ny länk när en länk återkallas, går ut eller förbrukas.

## Relaterade funktioner
F-001 (Logga in med Discord) krävs för att kunna gå med. Inget annat funktionsregister-objekt hanterar grupper, så detta är inte en dubblett. Gruppadminrollen skapas här. F-013 (Återkalla länk), F-010 (Lämna grupp) och F-023 (Gör medlem till admin) använder gruppadminrollen och länkskaparen. Flera gruppadmins hanteras i REQ-0008. Max antal användningar är en egenskap hos samma länk, inte en ny funktion: den använder samma skapande, kopiering och giltighetsregel.

## Öppna frågor
- BESLUT (användaren): Medlemmar kan själva skapa egna inbjudningslänkar. Flera aktiva länkar per grupp är tillåtna.
- BESLUT (användaren): Inbjudningslänkar är temporära och gäller i 2 timmar från skapandet. Giltigheten är statisk: alltid 2 timmar, och användaren kan inte välja annan tid.
- BESLUT (användaren): Inbjudningslänken kan användas av vem som helst som är inloggad och har den, tills den återkallas, går ut eller når sitt max antal användningar.
- BESLUT (användaren): Medlemmar ser bara sina egna länkar, så de kan bara kopiera och dela sina egna. Gruppadmin ser alla och kan kopiera och återkalla dem.
- BESLUT (användaren): Gruppadmin kan kopiera andra medlemmars inbjudningslänkar. Den tidigare öppna frågan om kopiering är därmed stängd.
- BESLUT (användaren): Varje inbjudningslänk har alltid ett max antal användningar. Skaparen väljer 1–10. Förvalt värde är 10 när fältet lämnas tomt. Obegränsade länkar finns inte. Värden utanför 1–10 nekas. Motivering: skydd mot missbruk, t.ex. bottar. När max är nått fungerar länken som en utgången länk: 404-sidan. Ersätter tidigare beslut där max var valfritt och tomt betydde obegränsat.
- BESLUT (användaren): Gruppadmin ser för varje länk skaparen, antal användningar och när länken går ut.
- BESLUT (användaren): Gruppens skapare blir gruppadmin. En grupp kan ha flera gruppadmins (ersätter "en admin per grupp"). En gruppadmin kan göra en medlem till gruppadmin (REQ-0008). Ingen kan ta bort en annans gruppadminroll i MVP; gruppadmin avstår genom att lämna gruppen. Ingen överlåtelse av rollen i förväg i MVP. Gruppadmin har i MVP inga befogenheter utöver att se, kopiera och återkalla länkar och göra medlem till gruppadmin.
- BESLUT (användaren): Länkar skapas bara när en medlem väljer det, inte automatiskt vid gruppskapande.
- BESLUT (användaren): Gränssnittet visar när länken går ut, i varje medlems lokala tid (REQ-0003).
- BESLUT (användaren): Giltigheten kontrolleras vid klicket på "Gå med". En länk som går ut eller förbrukas medan sidan är öppen nekas.
- BESLUT (användaren): Vilka som är gruppadmin visas för alla medlemmar.
- BESLUT (användaren): Ingen gräns för antal medlemmar per grupp i MVP.
- ANTAGANDE: Varje lyckat "Gå med" via en länk räknas som en användning, även om personen tidigare lämnat gruppen och går med igen. Svar krävs om någon annan tolkning önskas.
- ANTAGANDE: En redan medlem som öppnar en aktiv länk räknas inte som användning.
- ANTAGANDE: Förbrukade och utgångna länkar visas inte bland de aktiva länkarna, precis som återkallade.
- ANTAGANDE: Max antal användningar kan inte ändras efter skapandet, på samma sätt som för max antal platser (REQ-0009).
