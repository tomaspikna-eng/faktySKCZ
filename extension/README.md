# DETEKTOR Chrome Extension v0.7.8

MVP prerobené z popup rozhrania na natívny Chrome Side Panel.

## Funkcie

- live audio capture z aktívneho tabu bez potreby titulkov
- 40-sekundové spracovacie bloky pre nižšiu spotrebu API
- cache-first fact-check: už overené podobné tvrdenia sa znovu nehľadajú na webe
- OBS/Streamlabs Browser Source URL pre LIVE fact-check
- samostatný aktérsky overlay s priebežnými počtami verdictov; moderátor je vylúčený
- live speaker diarization cez gpt-4o-transcribe-diarize po zachytení 3 s hlasovej referencie
- max. 4 známi rečníci na session; meno a rola sa mapujú na fact-checkované tvrdenia
- automatická detekcia mien hostí/moderátora z title/description/OG metadata stránky
- automatická detekcia predstavenia hostí z úvodu relácie bez extra AI requestu
- detegované mená sa predvyplnia do slotov rečníkov; používateľ už nemusí mená vypisovať ručne
- audio capture pokračuje počas backend spracovania, takže 40 s batching nevytvára medzery
- backend: Supabase FactCTP / Edge Function `process-audio`
- side panel otvorený kliknutím na ikonu rozšírenia
- karty jednotlivých tvrdení
- verdikt + percento istoty zhody/overenia
- čas vo videu, ak je na stránke HTML5 video
- zdroje/detail, pokiaľ ich backend vráti
- taby Prehľad / Tvrdenia / Sporné / Vzorce / Aktéri
- Aktéri = priebežné počty konkrétnych verdictov pre fact-checkované tvrdenia jednotlivých účastníkov; moderátor je vynechaný / Aktéri
- Aktéri = percentuálne rozdelenie verdictov z fact-checkovaných tvrdení každého účastníka; bez jedného celkového skóre osoby
- Vzorce = iba opakované tvrdenia v rámci aktuálnej session
- SK/CZ prepínač UI
- bez agregovaného skóre politika alebo rečníka

## Inštalácia

1. Otvor `chrome://extensions`.
2. Zapni Developer mode.
3. Klikni Load unpacked.
4. Vyber tento priečinok.
5. Klikni na ikonu DETEKTOR a otvorí sa pravý side panel.

- streamer-first sidebar: po otvorení je predvolená záložka Aktéri
- Aktéri relácie sú v kompaktnom rolovateľnom paneli
- LIVE štatistiky aktérov majú väčšie karty a dominantnejšie percentuálne rozdelenie verdictov
- OBS/Streamlabs Browser Source URL sú presunuté úplne naspodok sidebaru

- schválené logo DETEKTOR: modré D v čiernom kruhovom ráme na bielom pozadí

- opravené centrovanie loga a orezávanie spodnej časti v hlavičke webu a sidebaru

- bezpečný vnútorný okraj loga, aby sa kruh neorezával pri škálovaní

- manuálne spustenie fact-checkingu: klik na ikonu iba otvorí sidebar, analýza začne až tlačidlom Spustiť overovanie

- nahradený poškodený PNG asset loga novým čistým vycentrovaným logom bez orezania
