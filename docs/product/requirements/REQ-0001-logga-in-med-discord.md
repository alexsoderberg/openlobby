# REQ-0001. Logga in med Discord
Status: Beslutad
Funktion: F-001
Prioritet: Måste

## Problem
Medlemmarna finns redan på Discord och ska inte skapa ett nytt konto. Utan inloggning kan ingen se eller ändra gruppernas tider, och en gemensam vy blir osäker.

## Användarberättelse
Som medlem vill jag logga in med mitt Discord-konto så att jag snabbt kommer in och mina grupper är kopplade till mig.

## Acceptanskriterier
- Givet att jag inte är inloggad, när jag öppnar startsidan, så ser jag knappen "Logga in med Discord" och ingen grupp- eller tidsdata.
- Givet att jag klickar "Logga in med Discord" och godkänner i Discord, när jag återvänder till appen, så är jag inloggad och ser min lista över grupper (tom om jag inte är med i någon).
- Givet att jag är inloggad, när jag ser sidhuvudet, så visas mitt Discord-visningsnamn.
- Givet att jag klickar "Logga in med Discord" och nekar i Discord, när jag återvänder till appen, så är jag utloggad och ser ett begripligt felmeddelande.
- Givet att jag är inloggad, när jag klickar "Logga ut", så är jag utloggad och nästa sidvisning kräver ny inloggning.
- Givet att jag inte är inloggad, när jag öppnar en skyddad sida direkt via länk (t.ex. en inbjudningslänk), så visas inloggningssidan och efter lyckad inloggning återvänder jag till den sida jag ville nå.
- Givet att en användare loggar in första gången, när inloggningen lyckas, så skapas ett medlemskonto med Discord-visningsnamnet, utan att några andra uppgifter behövs.
- Givet att jag loggar in eller använder appen, när data skickas mellan min webbläsare och appen, så sker det över en krypterad anslutning (HTTPS), så att inloggning och gruppdata inte kan läsas av tredje part. Den tekniska lösningen är arkitektens och driftens beslut; kravet är beteendet.

## Utanför omfånget
- Andra inloggningsmetoder (e-post, lösenord, andra leverantörer).
- Synk av Discord-servrar, roller eller vänlistor.
- Avatarbilder och profilredigering.

## Relaterade funktioner
Inga. Detta är grunden för alla andra funktioner; ingen annan funktion hanterar inloggning.

## Öppna frågor
- BESLUT (användaren): Ingen koppling till en specifik Discord-server. Vilket Discord-konto som helst kan logga in.
- BESLUT (användaren): Visningsnamnet uppdateras vid nästa inloggning, inte i realtid.
