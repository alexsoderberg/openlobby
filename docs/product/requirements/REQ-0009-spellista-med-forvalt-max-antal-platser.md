# REQ-0009. Spellista med förvalt max antal platser
Status: Beslutad
Funktion: F-024
Prioritet: Måste

## Problem
Fritext för spel gör att samma spel stavas olika mellan medlemmar, och ingen vet på förhand hur många som ryms på en tid. Den som lägger upp en tid behöver ett gemensamt urval av spel där ett rimligt max antal platser redan är ifyllt, men fortfarande kan ändras.

## Användarberättelse
Som medlem vill jag välja spel från en gemensam lista där max antal platser är förifyllt, så att jag snabbt kan lägga upp en tid som stämmer med spelet.

## Acceptanskriterier

Spelval och förvalt max:
- Givet att jag lägger upp en tid, när jag öppnar spelvalet, så visas spellistans spel med namn och "Annat".
- Givet att jag väljer ett spel från spellistan som har ett förvalt max, när jag väljer det, så fylls max antal platser i med spelets förvalda värde.
- Givet att jag har valt ett spel från spellistan, när jag ändrar max antal platser till ett annat värde och sparar, så sparas tiden med mitt värde och spellistan ändras inte.
- Givet att jag väljer "Annat", när jag anger ett spelnamn på 1–50 tecken och sparar, så sparas tiden med det namnet, och namnet läggs inte till i spellistan.
- Givet att jag väljer "Annat", när jag lämnar max antal platser tomt och sparar, så sparas tiden utan gräns för antal platser.
- Givet att jag väljer ett spel från spellistan, när jag tömmer max antal platser och sparar, så sparas tiden utan gräns för antal platser.
- Givet att jag anger max antal platser som något annat än ett heltal på minst 1, när jag försöker spara, så nekas det med ett felmeddelande och ingen tid sparas.
- Givet att en tid sparats med ett spel från spellistan, när en annan medlem öppnar tiden, så ser hen samma spelnamn och samma max antal platser.

Dynamisk spellista:
- Givet att systemadmin har lagt till ett spel i spellistan, när en medlem öppnar spelvalet, så visas spelet, utan att appen behöver byggas om eller driftsättas på nytt.
- Givet att systemadmin har tagit bort ett spel från spellistan, när en medlem öppnar spelvalet, så visas spelet inte längre som val.
- Givet att systemadmin har ändrat förvalt max för ett spel, när en tid redan är skapad med spelet, så ligger tidens max antal platser kvar oförändrat.
- Givet att systemadmin har ändrat förvalt max för ett spel, när en medlem väljer spelet för en ny tid, så fylls det nya värdet i.
- Givet att systemadmin har tagit bort ett spel från spellistan, när en tid redan använder spelet, så ligger tiden kvar med sitt spelnamn och sitt max antal platser oförändrade.
- Givet att systemadmin har bytt namn på ett spel, när en tid redan använder spelet, så visas tiden med det namn den sparades med.
- Givet att jag väljer ett spel från spellistan som saknar förvalt max, när jag väljer det, så är max antal platser tomt (obegränsat).

Startinnehåll:
- Givet att spellistan är i startläget, när en medlem öppnar spelvalet, så visas Counter-Strike 2 (förvalt max 5), World of Warcraft (förvalt max 5), League of Legends (förvalt max 5), Overwatch (förvalt max 5) och "Annat".

Förvaltning:
- Givet att jag är medlem eller gruppadmin i en grupp, när jag söker efter en funktion för att ändra spellistan eller föreslå ett nytt spel, så finns den inte. Ändring av spellistan görs bara av systemadmin (REQ-0010).

## Utanför omfånget
- Medlemmar eller gruppadmins föreslår eller lägger till spel i listan.
- Gruppspecifika spellistor.
- Ändra max antal platser efter att tiden är skapad (F-011).
- Fler fält per spel än namn och förvalt max, t.ex. bild, genre eller kategori.
- Koppling till spelens egna system eller API:er.
- Sökning i spellistan.
- Ändra spellistan i appen (lägga till, ändra, ta bort spel). Det beskrivs i REQ-0010. Detta krav gäller bara hur medlemmar ser och väljer ur listan.

## Relaterade funktioner
F-003 (Lägg upp tid) är där spelet väljs och max antal platser sätts. Spellistan är dess datakälla, inte en ny funktion för att lägga upp tider. F-018 (Max antal platser per tid) använder värdet som sätts här och bestämmer vad som händer när platserna är slut. Inte en dubblett: F-024 bestämmer vilket spel och vilket förvalt max som föreslås, F-018 bestämmer bokningsgränsen.
F-025 (Hantera spellistan som systemadmin) är den enda vägen att ändra listan. Inte en dubblett: F-024 är vad medlemmar ser och väljer, F-025 är hur systemadmin underhåller listan.

## Öppna frågor
- BESLUT (dynamisk): Spellistan kan ändras utan ny version. Den förvaltas av systemadmin (REQ-0010) och är gemensam för alla grupper. Medlemmar och gruppadmins kan inte ändra den i MVP. Hur en systemadmin utses ligger utanför appen.
- BESLUT (startinnehåll): Counter-Strike 2 – 5, World of Warcraft – 5, League of Legends – 5, Overwatch – 5. Namnen är de officiella; användaren skrev "Counter-Striker 2" och "WoW". Användaren har bekräftat att "World of Warcraft" i listan är ok.
- BESLUT (Annat): Fritextnamn läggs inte till i spellistan. Samma spel kan därför finnas under både spellistan och "Annat".
- BESLUT (tomt max): Tomt max antal platser betyder obegränsat, både för spel från listan och för "Annat".
- BESLUT (max ändras inte): Max antal platser sätts vid skapande och ändras inte i MVP (F-011).
- BESLUT (övre gräns): Ingen övre gräns för max antal platser. Värdet ska vara ett heltal på minst 1, eller tomt.
- BESLUT (medlemmar föreslår inte): I MVP kan medlemmar inte föreslå spel.
- BESLUT (namnbyte): Om systemadmin byter namn på ett spel behåller befintliga tider det namn de sparades med, i linje med regeln för borttagna spel.
- BESLUT (förvalt max saknas): Ett spel i spellistan får sakna förvalt max. Då är max antal platser tomt (obegränsat), precis som för "Annat".
- ÖPPEN FRÅGA: Ska medlemmar kunna föreslå nya spel i en senare version? Ej beslutat. I MVP: nej.
