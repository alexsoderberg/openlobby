# REQ-0010. Hantera spellistan som systemadmin
Status: Beslutad
Funktion: F-025
Prioritet: Måste

## Problem
Spellistan (REQ-0009) är gemensam för alla grupper och ska kunna ändras utan ny version. Utan en sida i appen måste varje ändring göras utanför appen, där stavning och dubbletter är svåra att kontrollera. Det behövs ett säkert sätt för projektets ansvarige att underhålla listan, och bara den personen ska kunna göra det.

## Användarberättelse
Som systemadmin vill jag lägga till, ändra och ta bort spel i spellistan i appen, så att alla grupper ser rätt spel utan att appen behöver driftsättas om.

## Acceptanskriterier

Behörighet:
- Givet att jag är inloggad som systemadmin, när jag öppnar spellistan, så ser jag alla spel i listan med namn och förvalt max antal platser (tomt om saknas).
- Givet att jag är inloggad men inte systemadmin, när jag ser appens navigation, så syns ingen länk till spellistan.
- Givet att jag är inloggad men inte systemadmin, när jag öppnar spellistans adress direkt, så nekas åtkomsten och ingen del av spellistan visas.
- Givet att jag är gruppadmin eller vanlig medlem i en grupp, när jag försöker lägga till, ändra eller ta bort ett spel, så nekas det och spellistan ändras inte.
- Givet att jag inte är inloggad, när jag öppnar spellistans adress, så visas inloggningen (REQ-0001), och efter lyckad inloggning nekas jag om jag inte är systemadmin.

Lägga till:
- Givet att jag är systemadmin, när jag lägger till ett spel med ett namn på 1–50 tecken och ett förvalt max på minst 1, när jag sparar, så läggs spelet till och visas i spelvalet för medlemmar (REQ-0009) utan att appen byggs om eller driftsätts på nytt.
- Givet att jag är systemadmin, när jag lägger till ett spel utan förvalt max, när jag sparar, så sparas spelet utan förvalt max (tomt = obegränsat).
- Givet att jag är systemadmin, när jag lägger till ett spel med ett tomt namn eller ett namn på över 50 tecken, när jag försöker spara, så nekas det med ett felmeddelande och ingen ändring sparas.
- Givet att jag är systemadmin, när jag lägger till ett spel vars namn redan finns i spellistan, när jag försöker spara, så nekas det med ett felmeddelande och ingen ändring sparas (ANTAGANDE: jämförelsen ignorerar skiftläge och inledande och avslutande mellanslag).
- Givet att jag är systemadmin, när jag anger förvalt max som inte är ett heltal på minst 1 (t.ex. 0, -3, 2,5 eller text), när jag försöker spara, så nekas det med ett felmeddelande och ingen ändring sparas (ANTAGANDE: samma regel som för max antal platser i REQ-0009).
- Givet att två systemadmins lägger till samma spelnamn samtidigt, när båda sparar, så lyckas högst en av dem (ANTAGANDE: samma mönster som för sista platsen i REQ-0005).

Ändra:
- Givet att jag är systemadmin, när jag ändrar namn eller förvalt max på ett spel och sparar, så uppdateras spelet i spellistan. Samma namn-regler och max-regler gäller som vid tillägg.
- Givet att jag är systemadmin, när jag ändrar ett spels namn till ett namn som redan används av ett annat spel i listan, när jag försöker spara, så nekas det med ett felmeddelande och ingen ändring sparas.
- Givet att jag har ändrat förvalt max eller namn på ett spel, när en tid redan är skapad med spelet, så ligger tidens värden kvar (REQ-0009).

Ta bort:
- Givet att jag är systemadmin, när jag väljer "Ta bort" på ett spel och bekräftar, så tas spelet bort från spelvalet (ANTAGANDE: bekräftelse krävs).
- Givet att jag är systemadmin, när jag väljer "Ta bort" och avbryter bekräftelsen, när jag stänger dialogen, så ligger spelet kvar oförändrat.
- Givet att jag är systemadmin, när jag tar bort ett spel som används av en eller flera tider, när det sker, så ligger dessa tider kvar med sitt spelnamn och sitt max antal platser (REQ-0009).

## Utanför omfånget
- Att utse eller ta bort systemadmins i appen. Det sker utanför appen, av driftaren, via konfiguration. Appen har ingen sida för det i MVP.
- Medlemmar eller gruppadmins föreslår eller lägger till spel (REQ-0009).
- Gruppspecifika spellistor.
- Fler fält per spel än namn och förvalt max.
- Historik eller logg över ändringar i spellistan.
- Sökning eller sortering i spellistans sida för systemadmin.
- Ändra förvalt max på redan skapade tider (F-011).
- Att systemadmin ser eller ändrar grupper, medlemmar eller tider. Rollen ger inga rättigheter i grupper.

## Relaterade funktioner
F-024 (Spellista med förvalt max antal platser) är medlemmarnas vy av listan och valet vid tidsskapande. F-025 är enda sättet att ändra listan. Inte en dubblett: F-024 är läsning och val för medlemmar, F-025 är underhåll av själva listan av systemadmin. Gruppadmin (REQ-0002, REQ-0008) och systemadmin är skilda roller och F-025 ger gruppadmin inga rättigheter. F-001 (Logga in med Discord) identifierar systemadmin, och F-003 (Lägg upp tid) använder listan.

## Öppna frågor
- ANTAGANDE (flera systemadmins): Driftaren kan peka ut fler än en systemadmin.
- ANTAGANDE (inloggning): En systemadmin loggar in med samma inloggning som övriga användare (REQ-0001).
- ANTAGANDE (bekräftelse vid borttagning): Ja, bekräftelse krävs vid borttagning av spel, på samma sätt som vid återkallning av länk (REQ-0007).
- ANTAGANDE (dubblettregel): Namn jämförs utan skillnad i skiftläge och utan inledande eller avslutande mellanslag.
- ANTAGANDE ("Annat"): "Annat" är inte en post i spellistan och kan inte ändras eller tas bort här (REQ-0009).
- ANTAGANDE (samtidig ändring): Ingen låsning, precis som i REQ-0003. Vid samtidig ändring av samma spel gäller senast sparad ändring. Dubblettregeln gäller ändå.
- ANTAGANDE (visning av användning): Appen visar inte hur många tider som använder ett spel innan det tas bort. Om det önskas blir det ett eget krav.
