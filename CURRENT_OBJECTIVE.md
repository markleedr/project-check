# Current Objective — Project Check (`markleedr/project-check`)
Locked: 2026-09-18

## Objective

Ship v1 of Project Check: a self-serve mid-campaign checker for a developer marketing manager. File uploads only. One development per project. Output is a PDF answering five questions in plain language, with actions and a “needs testing” list.

## Done when

- [x] Wash/hash/join/aggregate with tests (UTM wins walk-in; no PII in washed rows)
- [x] Upload wizard: map columns, wash on device, preview, download CSV, phone spot-check, send washed JSON only
- [x] Supabase schema + RLS for projects/checks
- [ ] Auth + new-check + PDF path verified in the browser
- [ ] `generate-commentary` deployed (falls back if no Anthropic key)

## Explicitly out of scope

- Live Meta/Google/CRM connections
- Rich personas beyond basic CRM columns
- Dashboard they live in all week (PDF is v1)
- AppSwitcher URLs on the other eight products
- Moving Supabase from ap-northeast-2 to Sydney
