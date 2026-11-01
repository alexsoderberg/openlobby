# Vision: Gemensam Gibb Kalender

## Problem
Vänner som spelar tillsammans online vill veta när de kan ses. Idag sker det i chatt eller på minnet: tider drunknar i meddelanden, ingen ser vem som faktiskt kommer, och det tar tid att samordna varje gång.

## Målgrupp
Små vänkretsar, ungefär 3–15 personer, som spelar samma spel tillsammans och redan kommunicerar via Discord. Alla medlemmar är likvärdiga inom sin grupp, med ett undantag: var och en kan återkalla sina egna inbjudningslänkar, och gruppadmin kan dessutom se, kopiera och återkalla alla gruppens länkar och göra en medlem till admin (se Begrepp). En systemadmin är en roll för hela systemet, inte för en grupp. Hen underhåller spellistan och har inga rättigheter i grupperna. Ingen är betalande kund.

## Värde
En gemensam, överblickbar vy över när gruppen kan spela och vem som är med. Mindre samordning i chatten, snabbare beslut om "ses vi ikväll?".

## Vad produkten INTE är
- Ingen matchmaking eller sökning efter okända spelare.
- Ingen chatt, röst eller notiser i MVP. Samtalet sker kvar i Discord.
- Ingen integration mot spelen (ingen API-koppling, ingen automatisk synk av speltillstånd).
- Ingen publik kalender. Grupper är privata och nås bara via inbjudningslänk.
- Ingen kalendersynk mot Google, Outlook eller Discord-events i MVP.
- Ingen native mobilapp i MVP. Webbläsare räcker.
- Inget betalmoment, inga premiumnivåer.
- Ingen användarstyrd spellista i MVP. Medlemmar lägger inte till eller föreslår spel i listan.

## MVP-avgränsning
Kärnflödet, i ordning:

1. Logga in med Discord.
2. Skapa en grupp eller gå med i en grupp via inbjudningslänk. Medlemmar skapar länkar på begäran. Varje länk gäller i 2 timmar och har alltid ett max antal användningar (1–10). Medlemmar ser bara sina egna länkar; gruppadmin ser, kopierar och återkallar alla. Länkar kan återkallas: gruppadmin kan återkalla alla gruppens länkar, och var och en kan återkalla de länkar hen själv skapat. Gruppadmin kan göra en medlem till admin.
3. Lägga upp en tillgänglighetstid (spel, start, slut, max antal platser).
4. Se gruppens kommande tider, som lista eller kalender.
5. Boka in mig på en tid (om det finns lediga platser), eller avboka.
6. Lämna en grupp.

Därutöver, för driften: en systemadmin underhåller spellistan i appen (lägga till, ändra och ta bort spel), REQ-0010.

Allt annat är utanför MVP och finns i `features.md` med status `Föreslagen` eller i listan "Senare".

## Begrepp (ordlista)

Kraven använder "admin" som kortform för gruppadmin. Systemadmin är en separat roll.

| Begrepp | Betydelse | Undviks |
|---|---|---|
| Grupp | En privat krets med medlemmar där tider läggs upp. | Server, klan, lag |
| Medlem | En inloggad användare som ingår i en grupp. Slutar vara medlem när hen lämnar gruppen. | Användare (i gruppkontext), spelare |
| Gruppadmin | En medlem i en grupp med två befogenheter: att se, kopiera och återkalla alla gruppens inbjudningslänkar, och att göra en medlem till gruppadmin. Gruppens skapare är gruppadmin från start. En grupp kan ha flera gruppadmins. Ingen kan ta bort en annans gruppadminroll; gruppadmin avstår genom att lämna gruppen. När sista gruppadmin lämnar går rollen till den medlem som varit med längst (räknat från senaste inträde). | Admin utan prefix, ägare, moderator, ledare, systemadmin |
| Systemadmin | En roll för hela systemet, inte för en grupp. Utses av driftaren via konfiguration, inte i appen. Får lägga till, ändra och ta bort spel i spellistan (REQ-0010). Ger ingen rätt i grupperna: systemadmin är inte gruppadmin. | Admin utan prefix, superadmin, driftare |
| Inträde | Tidpunkten då en medlem senast gick med i gruppen (för skaparen: när gruppen skapades). Ett återinträde ersätter det tidigare inträdet. | Anslutning, join |
| Inbjudningslänk | Länk som ger åtkomst till att gå med i en grupp. Skapas av en medlem på begäran och gäller i 2 timmar från skapandet (fast, går inte att välja). Har alltid ett max antal användningar, 1–10 (förvalt 10). En återkallad, utgången eller förbrukad länk (max antal användningar nått) slutar fungera direkt och visar 404. Flera kan vara aktiva samtidigt. Ersätts inte automatiskt. Medlemmar ser bara sina egna länkar; gruppadmin ser alla. | Kod, invite |
| Användning | Ett lyckat "Gå med" via en inbjudningslänk som ger ett nytt medlemskap. Att en redan medlem öppnar länken räknas inte. | Klick, visning, träff |
| Länkskapare | Medlemmen som skapade en viss inbjudningslänk. Kan återkalla just den länken. När länkskaparen lämnar gruppen återkallas hens länkar. | Skapare (betyder tidens skapare) |
| Tid | En tillgänglighetstid: spel, start, slut, max antal platser, skapad av en medlem. Sluttiden kan vara nästa dygn, men tiden måste vara kortare än 24 timmar (exakt 24 timmar nekas). Visas för medlemmar fram till sluttid. | Event, session, slot |
| Skapare | Medlemmen som lade upp en tid. Enda som får ta bort den. Är automatiskt bokad på sin tid och tar en plats. | Ägare, admin |
| Bokning | Att en medlem är med på en tid ("Jag är med") och tar en plats. Tiden fungerar som ett öppet rum: man går in (Boka in mig) och ut (Avboka). Att gå ut går alltid. Att gå in går också fram till sluttid, även medan tiden pågår, och bara om det finns en ledig plats. | RSVP, anmälan |
| Spel | Det spel en tid gäller: ett val från spellistan (t.ex. "World of Warcraft"), eller "Annat" med ett fritextnamn. Tiden kopierar spelets namn och förvalda max vid skapandet; senare ändringar i listan påverkar inte tiden. | Titel, speltyp |
| Spellista | Gemensam lista över spel där varje spel har ett förvalt max antal platser. Gemensam för alla grupper. Ändras av systemadmin i appen, utan ny version (REQ-0010). Medlemmar och gruppadmins kan inte ändra den i MVP. | Spelkatalog |
| Plats | En bokningsplats på en tid. Tidens max antal platser är hur många som kan vara bokade samtidigt; skaparen tar en plats. Tomt max betyder obegränsat. Visas som "X/Y platser". | Slot, kapacitet |
| Max antal platser | Tidens gräns för antal platser. Förvalt från spellistan och kan ändras av skaparen vid skapande. Ändras inte efter skapande i MVP. | Max deltagare, kapacitet |
| Lämna grupp | Medlemmen slutar vara med i gruppen och tas bort från bokningarna på kommande tider. Kommande tider som hen skapat måste tas bort först. Hens inbjudningslänkar återkallas. | Gå ur, avsluta grupp |

## Beslut
Gäller för hela produkten. Detaljer och acceptanskriterier finns i kraven.

- Tidszon: varje medlem ser tider i sin lokala tid (REQ-0003).
- Ingen gräns för antal medlemmar i en grupp i MVP (REQ-0002). Antal bokade per tid begränsas av tidens max antal platser (se nedan).
- Max antal platser: varje tid har ett max antal platser. Förvalt värde kommer från spellistan och skaparen kan ändra det vid skapande. Skaparen räknas in i max. Max ändras inte efter skapande i MVP. Ingen får gå in när tiden är full. Ingen övre gräns för max; tomt max betyder obegränsat (REQ-0003, REQ-0005, REQ-0009). Ersätter tidigare beslut om ingen gräns för bokade per tid.
- Spellista: spel väljs från en gemensam spellista med förvalt max antal platser, eller som "Annat" med fritextnamn. Spellistan är dynamisk: systemadmin ändrar den i appen utan ny version (REQ-0010). Den är gemensam för alla grupper; medlemmar och gruppadmins kan inte ändra den i MVP. Ett spel får sakna förvalt max (tomt = obegränsat). Byter systemadmin namn eller tar bort ett spel påverkas inte redan skapade tider (REQ-0009). Ersätter tidigare beslut att spel är fritext.
- Systemadmin: en roll för hela systemet, skild från gruppadmin. Utses av driftaren via konfiguration, inte i appen. Appen har ingen sida för att hantera systemadmins i MVP. Systemadmin har inga rättigheter i grupper (REQ-0010).
- Ingen koppling till en specifik Discord-server: vilket Discord-konto som helst kan logga in (REQ-0001).
- Gruppadmin: gruppens skapare blir gruppadmin. En grupp kan ha flera gruppadmins, och en gruppadmin kan göra en medlem till gruppadmin (REQ-0002, REQ-0008). Ingen kan ta bort en annans gruppadminroll. När sista gruppadmin lämnar går rollen till den medlem som varit med längst, räknat från senaste inträde (REQ-0006).
- Länkar: medlemmar skapar länkar på begäran, flera kan vara aktiva, och varje länk gäller i 2 timmar (fast). Länken har alltid ett max antal användningar, 1–10 (förvalt 10), för att skydda mot missbruk som bottar; när max är nått fungerar den som en utgången länk. Medlemmar ser bara sina egna länkar. Gruppadmin ser, kopierar och återkallar alla. När länkskapare lämnar återkallas hens länkar (REQ-0002, REQ-0006, REQ-0007).
- Bekräftelse krävs vid återkallning av länk och vid lämna grupp (REQ-0006, REQ-0007).
- Tid: måste vara kortare än 24 timmar. Sluttid före starttid som klockslag tolkas som nästa dygn. Ingen varning för långa tider (REQ-0003).
- Bokning: att gå ut ur en bokning går alltid, även efter tidens sluttid. Passerade tider visas inte i MVP, så gränssnittet erbjuder i praktiken avbokning bara medan tiden syns. Att gå in går fram till tidens sluttid, även medan tiden pågår, och bara om det finns en ledig plats (REQ-0005).
- Passerade tider från avgångna medlemmar ligger kvar men visas inte (REQ-0006).
- Kommande tider måste tas bort innan man kan lämna gruppen (REQ-0006).
- Listvy är standard. Kalendervyn är veckovy, måndag–söndag. Tid som går över midnatt visas på startdagen med markering (REQ-0004).
- Samtidig redigering av tider sker utan låsning (REQ-0003).

## Öppna frågor
- Ska medlemmar kunna föreslå spel i en senare version? (REQ-0009)
- Ska en gruppadmin kunna ta bort en annans gruppadminroll i en senare version? Ej beslutat, MVP tillåter det inte. (REQ-0008)

Följande antaganden gäller tills användaren beslutar annat:
- Ett återinträde ger ingen tillbaka gruppadminroll, även om hen var gruppadmin före lämnandet (REQ-0006).
- Bekräftelsen vid lämna grupp täcker även att hens länkar återkallas (REQ-0006).
- Befordran till gruppadmin kräver bekräftelse (REQ-0008).
- Driftaren kan utse flera systemadmins (REQ-0010).
