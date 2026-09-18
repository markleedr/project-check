# Parking Lot — Project Check

<!-- Add new entries above this line, newest first -->

## 2026-09-18 — Sydney project is live
**What:** App points at `kuucdtwfneakjbvquecq` (`project-check-production`, ap-southeast-2). The Seoul project `zymomxrjcxxkpfjuyktv` is unused leftover billing until paused.
**Where:** `src/integrations/supabase/client.ts`
**Looks like:** pause Seoul in the dashboard when you confirm Sydney works.

## 2026-09-18 — found while locking v1
**What:** AI commentary needs `ANTHROPIC_API_KEY` on this project. Until then, PDFs use calculated templates.
**Where:** `generate-commentary`
**Looks like:** expected until the secret is set.
