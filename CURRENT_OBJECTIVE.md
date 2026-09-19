# Current Objective — Project Check (`markleedr/project-check`)
Locked: 2026-09-19

## Objective

After the RVLV mapping/funnel/spend fix, four report notes:

1. “Where the next dollar should go” is confusing because the table is results, not spend direction. Heading and copy must match what is on the page.
2. “What is delivering sales” only names one source — comment on the next two as well (contracts first, then enquiries; include spend / cost per contract when we have it).
3. “Where do buyers live” should show the top 5–10 locations as a table and a map with dots at real Australian postcode locations (no PII, no fake jitter).
4. Save PDF must follow the Project Profile letterhead (yellow `#FFD600`, Montserrat, A4) as in the SPC weekly media report sample and the Ad Proof SMS sheet.
5. “Why is the marketing working?” must not dump ads as a repeated run-on sentence. Short finding plus a ranked table (continue / investigate).

## Done when

- [ ] Next-dollar block is spend direction (`suggestedActions`); the channel table is captioned as results, not spend advice
- [ ] Sales findings name the top three sources, not one
- [ ] Buyer locations: table of top 5–10 postcodes (enquiries, contracts) plus an SVG map with dots at real AU postcode centroids
- [ ] Print/PDF uses PP A4 letterhead, yellow rule, formatted tables; `@page { size: A4; margin: 0 }`
- [ ] Why section: short finding + ads table, no duplicated paragraph
- [ ] Tests cover salesFindings (three sources), next-dollar vs results table, postcode table 5–10, map projection, ads ranking; production build passes

## Explicitly out of scope

- Live Meta/Google/CRM connections
- Parsing EOI/contract out of Asana subtask names
- Inventing buyer personas
- Storing raw PII

## Environment note

No staging — a push to `main` deploys live.
