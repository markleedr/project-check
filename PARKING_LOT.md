# Parking Lot — Project Check

<!-- Add new entries above this line, newest first -->

## 2026-09-19 — EOI from Asana child tasks
**What:** RVLV EOI still reads ~1 because EOI lives in child task names while the parent has no pipeline stage. Out of scope for the mapping and report passes.
**Where:** live RVLV sales export / `funnel.ts`
**Looks like:** parse subtask names only if we deliberately take that on.

## 2026-09-19 — No staging
**What:** One Supabase project, Vercel publishes from `main`. Report/PDF changes go live on merge.
**Where:** Vercel `project-check`
**Looks like:** known gap, not a bug.

## 2026-09-18 — Sydney project is live
**What:** App points at `kuucdtwfneakjbvquecq` (`project-check-production`, ap-southeast-2). The Seoul project `zymomxrjcxxkpfjuyktv` is unused leftover billing until paused.
**Where:** `src/integrations/supabase/client.ts`
**Looks like:** pause Seoul in the dashboard when you confirm Sydney works.

## 2026-09-18 — found while locking v1
**What:** AI commentary needs `ANTHROPIC_API_KEY` on this project. Until then, PDFs use calculated templates.
**Where:** `generate-commentary`
**Looks like:** expected until the secret is set.
