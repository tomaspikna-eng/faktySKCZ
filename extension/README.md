# faktySKCZ Chrome Extension v0.6.1

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
- Aktéri = percentuálne rozdelenie verdictov z fact-checkovaných tvrdení každého účastníka; bez jedného celkového skóre osoby
- Vzorce = iba opakované tvrdenia v rámci aktuálnej session
- SK/CZ prepínač UI
- bez agregovaného skóre politika alebo rečníka

## Inštalácia

1. Otvor `chrome://extensions`.
2. Zapni Developer mode.
3. Klikni Load unpacked.
4. Vyber tento priečinok.
5. Klikni na ikonu faktySKCZ a otvorí sa pravý side panel.
