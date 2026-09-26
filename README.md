# DETEKTOR

Samostatný MVP projekt pre CZ/SK live fact-checking rozšírenie a web.

## Aktuálny stav

- frontend: schválený old-school informačný layout v0.3
- browser extension: v0.5 — natívny Chrome Side Panel
- backend: existujúci Supabase projekt `FactCTP`
- Supabase project ref: `mexrrchqiehzvrefftym`
- Edge Function: `process-audio`
- audit tabuľka: `public.factcheck_audits`
- finálny produktový názov značky ešte nie je vybraný

## Extension v0.5

Priečinok: `/extension`

- live audio capture z aktívneho tabu bez titulkov
- Prehľad / Tvrdenia / Sporné / Vzorce
- karty jednotlivých tvrdení
- verdikt + confidence pri konkrétnom výroku
- čas vo videu, ak je dostupné HTML5 video
- SK/CZ prepínač UI
- opakované tvrdenia sa zobrazia vo Vzorcoch
- bez agregovaného skóre politika alebo rečníka

## MVP smer

- SK/CZ lokalizácia
- Chrome / Edge ako prvé podporované prehliadače
- Firefox a Opera následne
- jednorazová aktivácia + vlastná peňaženka detektorov
- používateľ nepotrebuje vlastný OpenAI API kľúč
- kreditný backend: wallet + ledger + rezervácia/settlement spotreby
- kreditné účtovanie je zatiaľ v TEST režime; tvrdé blokovanie spotreby je vypnuté do kalibrácie nákladov
- TV / newsroom vrstva neskôr

## Architektúra

- GitHub: `tomaspikna-eng/faktySKCZ`
- Supabase: `FactCTP`
- frontend web a browser extension používajú spoločný backend
- CSP zostáva úplne oddelený projekt

## Dôležité

Nevytvárať ďalší Supabase projekt pre DETEKTOR. Existujúci projekt `FactCTP` je technický backend produktu DETEKTOR.

## Kreditný model

DETEKTOR používa vlastnú obchodnú jednotku `detektor`. Zákazník nekupuje ani nedostáva OpenAI kredity alebo API kľúč. Rozšírenie má stabilné `client_install_id`, backend eviduje peňaženku, kreditné transakcie a surovú spotrebu. Produkčný billing sa zapne až po kalibrácii reálnej ceny jednej minúty a napojení checkoutu.
