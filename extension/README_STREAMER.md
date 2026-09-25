# DETEKTOR Streamer Pack v0.6.5

Tento balík je určený pre streamerov, komentátorov a redakcie, ktoré chcú počas živého vysielania zobrazovať LIVE fact-check a priebežný prehľad fact-checkovaných tvrdení jednotlivých účastníkov.

## 1. Inštalácia rozšírenia v Chrome / Edge

1. Rozbaľ ZIP do samostatného priečinka. Po inštalácii tento priečinok nepresúvaj ani nemaž.
2. V Chrome otvor `chrome://extensions`.
3. Zapni **Developer mode / Režim pre vývojárov**.
4. Klikni **Load unpacked / Načítať rozbalené**.
5. Vyber priečinok, v ktorom je súbor `manifest.json`.
6. Pripni rozšírenie DETEKTOR do lišty prehliadača.
7. Otvor video alebo živý stream a klikni na ikonu rozšírenia. Otvorí sa pravý side panel a spustí sa zachytávanie audia.

## 2. Side panel

Sidebar obsahuje päť pohľadov:

- **Prehľad** – posledné zachytené tvrdenia a základné počty.
- **Tvrdenia** – všetky fact-checkované tvrdenia.
- **Sporné** – zavádzajúce, nepravdivé a neoverené tvrdenia.
- **Vzorce** – opakované tvrdenia v aktuálnej relácii.
- **Aktéri** – percentuálne rozdelenie jednotlivých verdictov a zároveň počet fact-checkovaných tvrdení účastníkov. Moderátor sa nezobrazuje. Nejde o celkové hodnotenie osoby.

## 3. Automatické rozpoznanie účastníkov

Rozšírenie skúša nájsť mená hostí a moderátora z názvu videa, popisu stránky a z úvodu relácie, keď sú osoby explicitne predstavené.

Pre presné priraďovanie hlasu k menu:

1. V časti **Aktéri relácie** skontroluj automaticky predvyplnené meno.
2. Nastav rolu **Účastník** alebo **Moderátor**.
3. Keď daná osoba práve hovorí, klikni **Zachytiť hlas**.
4. Nahrajú sa približne 3 sekundy hlasovej referencie.
5. Od ďalších blokov sa systém pokúša priraďovať výroky ku konkrétnemu účastníkovi.

Aktuálne je možné nastaviť maximálne 4 známych rečníkov na session.

## 4. OBS / Streamlabs Browser Source

Po spustení LIVE session sa v side paneli objavia dve URL:

- **LIVE fact-check** – karta posledného fact-checkovaného tvrdenia.
- **Aktéri** – priebežný prehľad verdictov jednotlivých účastníkov bez moderátora.

V OBS:

1. **Sources → + → Browser**.
2. Vlož príslušnú URL z rozšírenia.
3. Odporúčané rozmery: `1920 × 1080` pre celý overlay alebo podľa vlastného layoutu.
4. Pozadie overlayu je transparentné.
5. URL obsahuje read-only token platný pre konkrétnu session. Verejne ho nezdieľaj mimo streamovacieho softvéru.

Browser Source iba zobrazuje už vytvorený výsledok. Nespúšťa ďalší AI fact-check.

## 5. Stream Deck / macro pad

Sidebar je pripravený na ovládanie cez klávesové skratky. Rozšírenie obsahuje príkazy:

- `open-summary` → Prehľad
- `open-facts` → Tvrdenia
- `open-disputed` → Sporné
- `open-patterns` → Vzorce
- `open-actors` → Aktéri

### Nastavenie skratiek

1. Otvor `chrome://extensions/shortcuts`.
2. Pri rozšírení nastav vlastné kombinácie, napríklad:
   - Prehľad → `Ctrl+Alt+1`
   - Tvrdenia → `Ctrl+Alt+2`
   - Sporné → `Ctrl+Alt+3`
   - Vzorce → `Ctrl+Alt+4`
   - Aktéri → `Ctrl+Alt+5`
3. V Stream Deck aplikácii pridaj akciu **Hotkey**.
4. Každému tlačidlu priraď rovnakú kombináciu.
5. Stlačením tlačidla sa otvorí side panel a prepne sa na vybranú sekciu.

Rovnaký princíp funguje aj s inými zariadeniami, ktoré vedia posielať klávesové skratky.

## 6. Náklady a spracovanie

Audio sa spracúva v približne 40-sekundových blokoch. Fact-check používa cache-first logiku: podobné už overené tvrdenia sa najprv hľadajú v databáze a drahší webový fact-check sa používa až ako ďalšia vrstva.

## 7. Dôležité obmedzenia

- Výsledok nie je okamžitý; pri 40-sekundovom batchingu počítaj s oneskorením približne desiatok sekúnd.
- Rozpoznanie rečníka nie je neomylné. Pri dôležitom vysielaní skontroluj automaticky nájdené mená a hlasové referencie.
- Počty v záložke Aktéri sa týkajú iba fact-checkovaných tvrdení v aktuálnej relácii a nie sú celkovým hodnotením osoby.
- Ak API kredit nie je dostupný, spracovanie sa zastaví a rozšírenie zobrazí hlásenie.

## 8. Aktualizácia

Po nahradení súborov novou verziou otvor `chrome://extensions` a pri rozšírení klikni **Reload / Znova načítať**.
