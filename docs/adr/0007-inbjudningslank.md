# 0007. Inbjudningslänkar
Status: Accepterad (2026-11-01)

Reviderad efter användarens beslut (tredje omgången): varje länk har ett max antal användningar, obligatoriskt, 1–10, med förval 10 när skaparen inte väljer. Gränsen finns för att motverka missbruk av bottar. Andra omgången gällde oförändrat: användningar räknas vid join, och admin ser, kopierar och återkallar alla gruppens aktiva länkar, inklusive token. Tidigare beslut gäller oförändrade: flera aktiva länkar per grupp, länkar skapas bara på begäran, återkallning av skaparen av länken eller av gruppens admin, medlemmar ser bara egna länkar, och utgång efter 2 timmar. Återkallad, utgången, uttömd, lämnad och okänd länk ger samma svar (`404 invite_invalid`).

## Kontext
Grupper är privata och nås bara via inbjudningslänk (vision.md, REQ-0002). Länken är därmed den enda åtkomstkontrollen för att gå med i en grupp. Den ska vara omöjlig att gissa, inte loggas i klartext, och kunna visas igen för medlemmar. Medlemmar skapar länkar vid behov. En läckt eller gammal länk ska sluta fungera utan att gruppen påverkas. Användaren vill att länkarna beter sig som Discords: man begränsar hur många som går med via en länk, och alla länkar har en sådan gräns.

## Beslut

**Format:** 32 slumpade bytes från `crypto/rand`, base64url-kodade (43 tecken, ca 256 bitars entropi). Länken är `/inbjudan/{token}` i frontend och `/api/invites/{token}` i API:t.

**Lagring:** tabellen `invite_links` (se ADR 0006). Token lagras i klartext. Medlemmar ser sina egna länkar och admin ser alla gruppens länkar, och båda ska kunna kopiera dem (REQ-0002). En hash skulle göra listan och kopieringen omöjliga. Admin får därmed läsa andra medlemmars token. Det ger ingen åtkomst som admin inte redan har: admin är medlem och kan skapa egna länkar med samma effekt. Token används inte för något annat än att gå med i just den gruppen. Risken begränsas av databasens rollåtkomst och av att token aldrig loggas. Svar som innehåller token får `Cache-Control: no-store`.

**Giltighet:** `expires_at = created_at + 2 timmar`. Tiden sätts när länken skapas och lagras i raden. Varaktigheten är en namngiven domänkonstant i calendar (`InviteLinkLifetime`), inte en miljövariabel, eftersom inget krav säger att den ska ändras per miljö. Att lagra utgångstiden, i stället för att räkna den från `created_at` vid varje läsning, ger två fördelar: kontrollen blir en jämförelse i SQL, och en framtida ändring av konstanten påverkar inte länkar som redan finns.

**Användningar:**
- `max_uses`: heltal 1–10. Obligatoriskt: varje länk har ett max. Skaparen väljer värdet vid skapande. Utelämnat fält eller `null` ger förvalet 10. Värde utanför 1–10, eller fel typ, ger `invalid_max_uses`. Sätts vid skapande och ändras inte.
- Regeln är två namngivna domänkonstanter i calendar: `InviteLinkMaxUsesLimit = 10` (högsta tillåtna värde) och `InviteLinkDefaultMaxUses = InviteLinkMaxUsesLimit` (förvalet). Validering och förval görs på ett ställe, en domänfunktion `NewInviteLinkMaxUses(requested *int) (InviteLinkMaxUses, error)`. Applikationen anropar den, och transporten avkodar bara värdet.
- Databasens check (ADR 0006) speglar gränsen 1–10 som skyddsnät. Den literal som finns i migreringen ska ändras i samma steg som konstanten, med en ny migrering.
- `use_count`: antal lyckade inträden via länken. Startar på 0 och visas alltid tillsammans med `max_uses`.
- Ett inträde är ett nytt medlemskap via join. Befintlig medlem som använder länken igen ändrar ingenting och räknas inte. Ett nytt inträde efter att hen lämnat gruppen räknas, eftersom det är ett nytt medlemskap.

**Aktiv länk:** en länk är aktiv när `expires_at > nu` och `use_count < max_uses`, där `nu` kommer från porten `Clock`. Regeln finns på ett ställe: domänmetoden `InviteLink.IsActive(now)`. Repositoryt lagrar bara, och applikationen använder metoden både vid visning, vid join och vid listning.

**Kontroll och räkning vid join (atomärt):**
1. Hitta länken via token utan lås för att få fram gruppen. Okänd token → `invite_invalid`.
2. Lås gruppen (`SELECT ... FOR UPDATE`, ADR 0006).
3. Läs länken på nytt. Saknas den, eller är den inte aktiv → `invite_invalid`.
4. Om anroparen redan är medlem: svara som vid nytt inträde, men ändra ingenting.
5. Annars: skapa medlemskapet och öka `use_count` i samma transaktion.

Gruppens lås är den enda serialiseringspunkten. Två samtidiga joins på sista användningen: den andra ser `use_count = max_uses` efter låset och får `invite_invalid`. Ingen separat radlås på länken. Ordningen i steg 3 före steg 4 innebär att en uttömd eller utgången länk nekar även en redan medlem, precis som en återkallad länk.

**Städning:** ingen bakgrundsjobb i MVP. Vid skapande av ny länk i en grupp raderas gruppens inaktiva länkar (utgångna eller uttömda) i samma låsta transaktion. Inaktiva tokens är inte giltiga, men ligger kvar i klartext tills dess. `shortcut: inaktiva länkar i inaktiva grupper ligger kvar tills gruppen skapar en ny länk eller tas bort, uppgradera med periodisk städning om databasen växer eller om kravet ändras`.

**Endpoints (calendar, se `docs/services.md`):**
- `POST /api/groups/{groupId}/invite-links`: medlem. Body `{maxUses}` där `maxUses` är valfritt heltal 1–10. Utelämnat eller `null` ger 10. Skapar en ny länk och svarar 201 med `id`, `token`, `createdBy`, `createdAt`, `expiresAt` (RFC 3339, UTC), `useCount` (0) och `maxUses` (alltid ett heltal). Fel: `invalid_max_uses` (400), `group_not_found` (404).
- `GET /api/groups/{groupId}/invite-links`: medlem. Listar de aktiva länkar som anroparen får se: för en medlem de egna länkarna, för admin alla gruppens länkar. Inaktiva visas inte. Varje post har `id`, `token`, `createdBy`, `createdAt`, `expiresAt`, `useCount` och `maxUses`. Svaret har `Cache-Control: no-store`. Inget `canRevoke`: varje länk i listan kan återkallas av den som ser den. Servern avgör vad som listas, så frontend behöver inte avgöra rättigheter. Frontend översätter `createdBy` till visningsnamn med hjälp av medlemslistan.
- `DELETE /api/groups/{groupId}/invite-links/{linkId}`: skaparen av länken eller gruppens admin. Andra medlemmar får `403 not_allowed`. Icke-medlem får `404 group_not_found`. En inaktiv länk (utgången eller uttömd) kan inte återkallas: svaret är `404 invite_invalid` och ingenting ändras (REQ-0007). Övriga fall raderar raden. Länkens id används i sökvägen, inte token, så att token inte hamnar i loggar. Ordningen är behörighet först, sedan aktivitet.

**Ingen automatisk länk:** länkar skapas bara på begäran. `POST /api/groups` skapar gruppen och admin-medlemskapet, men ingen länk. Återkallning skapar ingen ny länk. En grupp kan därför stå utan aktiva länkar.

**Lämna grupp:** länkar som medlemmen skapat raderas i samma transaktion (ADR 0004). Annars skulle en avgången medlems länk fortsätta att släppa in nya medlemmar.

**Gå med:**
- `GET /api/invites/{token}` returnerar gruppens namn om länken är aktiv.
- `POST /api/invites/{token}/join` skapar medlemskapet enligt steglistan ovan.
- Okänd, återkallad, utgången, uttömd eller lämnad länk ger `404 invite_invalid`. Svaret är identiskt i alla fall. Gruppens namn och id visas inte.
- Join är idempotent för befintliga medlemmar: samma svar som vid nytt inträde, och inget nytt medlemskap eller ny användning. Roll och `joined_at` ändras inte.

**Frontend:** `invite_invalid` visas som en 404-sida utan gruppinformation. Texten ligger i frontend (ADR 0001). Gruppens sida visar aktiva länkar med utgångstid (`expiresAt`) och användningar, till exempel "3 av 10 användningar". Formuläret för ny länk har en väljare 1–10 med 10 förvalt, och skickar det valda värdet. Förvalet i formuläret är UI-tillstånd, inte en regel: regeln är förvalet i API:t. Sidan `/inbjudan/{token}` laddar inga resurser från tredje part. `Referrer-Policy: same-origin` sätts av `edge` för alla svar (ADR 0009), så att token inte läcker via Referer.

**Loggning:** token räknas som hemlighet. Gatewayens och calendars loggar skriver `/api/invites/:token` i stället för det faktiska värdet. Samma gäller felloggar. Svarskroppar som innehåller token loggas aldrig.

**Admin-rollen** sätts när gruppen skapas (skaparen) och ges av en admin till en medlem med `PUT /api/groups/{groupId}/admins/{userId}`. Den överlåts automatiskt när sista admin lämnar (ADR 0004). Rollen ger rätt att se, kopiera och återkalla alla gruppens aktiva länkar, och att göra en medlem till admin. Den ger ingen annan befogenhet i MVP.

**Rate limiting:** ingen i MVP för inbjudningsendpoints. Token kan inte gissas, och missbruk kräver antingen ett medlemskap i gruppen eller en läckt länk. Inbjudningsendpoints får därmed ingen extra infrastruktur. Om missbruk syns i drift är nästa steg en domänregel, en gräns för antal aktiva länkar per medlem, inte rate limiting. Den ändrar då detta ADR eller ersätts av en ny.

## Konsekvenser
- En läckt länk ger åtkomst till gruppens medlemslista och tider tills den återkallas, går ut eller når sitt max. Högst 2 timmar efter skapandet, och högst `max_uses` (1–10) inträden.
- **Missbruk (bottar):** gränsen per länk begränsar hur många konton en enskild länk kan föra in. Varje inträde kräver ett Discord-konto och en inloggning. Gränsen per länk begränsar inte antalet länkar: en medlem kan skapa flera länkar inom sina 2 timmar. Det kräver ett medlemskap, och det är den gräns som återstår, se Rate limiting ovan.
- Admin kan läsa andra medlemmars tokens. Det är en följd av beslutet. Admin är redan medlem och kan skapa egna länkar, så ingen ny åtkomst ges.
- Varje länk kräver en skapandehändelse. Gruppen behöver därför en explicit åtgärd för att få en länk, vilket är acceptabelt för små grupper.
- Städningen är en DELETE i en låst transaktion som redan körs vid skapande. Ingen extra infrastruktur.
- Uttömda länkar är en ny väg till `invite_invalid`. Den ger samma svar som utgång och återkallning, så ingen kan skilja dem åt.
- Gränsen 10 ligger både i domänkonstanten och i databasens check. En ändring kräver därför en ny migrering. Det är avsiktligt, eftersom gränsen är en regel och inte en miljöinställning.
- REQ-0002 och REQ-0007 innehåller fortfarande antaganden som är ersatta: "en länk åt gången", "ny länk skapas direkt", "utgångsdatum utanför omfånget", "admin kopierar inte andras länkar", "Länken är inte giltig" som text, och valfritt max antal användningar där tomt betyder obegränsat. Produktägaren uppdaterar kraven. Designen följer användarens beslut.
- Det valda 404-beteendet ger ingen skillnad mellan återkallad, utgången, uttömd och okänd länk. Det är en förutsättning för REQ-0007.

## Alternativ som förkastades
- **En aktiv länk per grupp med rotation** (tidigare förslag): ersatt av användarens beslut om flera länkar.
- **Utgångstid räknad från `created_at` vid varje läsning:** en ändrad konstant skulle då tyst ändra giltigheten för länkar som redan finns, och API:t måste räkna om värdet.
- **Bakgrundsjobb för städning:** en extra process för att radera några rader per grupp. Städningen vid skapande räcker.
- **Hash av token:** listning och kopiering av länkar blir omöjliga, både för medlemmar och admin.
- **`revoked_at` med historik:** REQ-0007 utesluter historik. En radering är enklare.
- **Radering av alla länkar när sista admin lämnar:** tar bort länkar som medlemmar räknar med, utan skäl.
- **Admin ser antal men inte token:** strider mot användarens beslut att admin kopierar andras länkar.
- **Max användningar som kan ändras efter skapande:** ingen sådan begäran finns. Länken återkallas och en ny skapas i stället (YAGNI).
- **Korta koder (t.ex. 6 tecken):** gissningsbara, och kräver då rate limiting och en tabell med försök.
- **Token i query-sträng (`?token=`):** hamnar i loggar och i webbläsarens historik på ett enklare sätt.
- **Signerad JWT som inbjudan:** kan inte återkallas utan en lista, och bär mer data än nödvändigt.
- **Obegränsat som val (tomt max):** användarens beslut är att alla länkar har ett max, för att motverka bottar.
- **Obligatoriskt `maxUses` i body:** skulle tvinga varje klient att välja. Förvalet i API:t räcker, och formuläret visar 10 som förval.
- **Förval i databasen (`default 10`):** regeln skulle ligga på två ställen. Förvalet ligger i domänen.
- **Max som konfiguration (miljövariabel):** inget krav säger att gränsen ska ändras per miljö (samma skäl som `InviteLinkLifetime`).
- **Rate limiting på inbjudningsendpoints i MVP:** skyddar mot gissning, som redan är omöjlig med 256-bitars token. Det kostar infrastruktur utan att skydda mot något som finns i MVP.
