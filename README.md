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
- jednorazová aktivácia + kredit podľa spotreby
- TV / newsroom vrstva neskôr

## Architektúra

- GitHub: `tomaspikna-eng/faktySKCZ`
- Supabase: `FactCTP`
- frontend web a browser extension používajú spoločný backend
- CSP zostáva úplne oddelený projekt

## Dôležité

Nevytvárať ďalší Supabase projekt pre DETEKTOR. Existujúci projekt `FactCTP` je technický backend produktu DETEKTOR.
