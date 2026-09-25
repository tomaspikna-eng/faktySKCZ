# faktySKCZ

Samostatný MVP projekt pre CZ/SK live fact-checking rozšírenie a web.

## Aktuálny stav

- frontend: schválený old-school informačný layout v0.3
- browser extension: live audio fact-checking MVP
- backend: existujúci Supabase projekt `FactCTP`
- Supabase project ref: `mexrrchqiehzvrefftym`
- Edge Function: `process-audio`
- audit tabuľka: `public.factcheck_audits`
- finálny produktový názov značky ešte nie je vybraný

## MVP smer

- SK/CZ lokalizácia
- Chrome / Edge ako prvé podporované prehliadače
- Firefox a Opera následne
- jednorazová aktivácia + kredit podľa spotreby
- TV / newsroom vrstva neskôr

## Architektúra

- GitHub: `tomaspikna-eng/faktySKCZ`
- Supabase: `FactCTP`
- frontend web a browser extension budú používať rovnaký backend
- CSP zostáva úplne oddelený projekt

## Dôležité

Nevytvárať ďalší Supabase projekt pre faktySKCZ. Existujúci projekt `FactCTP` je backend tohto projektu.
