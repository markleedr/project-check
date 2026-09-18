# Project Check

Self-serve campaign progress checker for property developers and marketers.

Five questions, one PDF:

1. What is delivering sales?
2. When do people buy?
3. Why is the marketing working?
4. Who is buying?
5. Where do buyers live?

A sale is a **contract signed**. Enquiry and EOI are leading indicators.

## Trust

Wash happens in the browser. Names, emails, phones and street addresses never upload. Join keys are hashed. You inspect and can download the washed CSV before anything is sent.

First-touch UTM on the marketing enquiry beats a later sales “walk-in” tag.

## Stack

Vite + React + TypeScript, Tailwind, Supabase (`zymomxrjcxxkpfjuyktv`, region `ap-northeast-2`).

## Dev

```bash
bun install
bun dev
bun run test
bun run build
```

Env: copy `.env.example`. Publishable keys are in `src/integrations/supabase/client.ts`.

AI narrative: edge function `generate-commentary`. Set `ANTHROPIC_API_KEY` on the Supabase project. If it is missing, the PDF still builds from calculated figures and templates.

## Product rules

See `CURRENT_OBJECTIVE.md` and `skills/pp-report-commentary/SKILL.md`. Actions live in a labelled block. Guesses live in “Needs testing”.
