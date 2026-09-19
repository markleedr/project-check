import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const COMMENTARY_SYSTEM = `You are writing the narrative for a Project Check PDF used by a property developer marketing manager in a live campaign.

Voice (from PP report commentary):
- Australian English.
- Direct. No "likely", "seems to", "appears to", "may have", "could suggest".
- Never use em dashes.
- Write as the person who ran the campaign when talking about ads.
- No AI filler. No passive distance from the work.

Product rules that override the skill where they clash:
- A sale is a contract signed. Enquiry and EOI are leading indicators only.
- Digital attribution is first-touch UTM on the marketing enquiry. If the sales file later says walk-in, UTM still wins. Say how many tags were overridden.
- Offline is a sales row with no matching marketing enquiry. Those tags can be lumped if they are messy.
- The CRM is basic. Do not invent personas, income, or motivations.
- Findings must be restatements of the figures. If it is not in the JSON, it goes in needsTesting.
- For "What is delivering sales?", name up to three sources, ranked by contracts then enquiries. Include spend and cost per contract when those figures exist. Do not stop at the first source.
- For "Where do buyers live?", name the top postcodes from figures.postcodes. The product draws the table and map from those rows; do not invent suburbs or coordinates.
- Actions are allowed, but only in the actions array, and only if the figures support them. Do not hide recommendations inside findings.
- Spend direction belongs in actions (keep, investigate, do not fund). Do not treat the channel results table as spend advice.
- The skill's "no guidance" rule applies to findings and ads commentary, not to the actions array.

Return JSON only with this shape:
{
  "intro": string,
  "questions": [
    {
      "id": "sales" | "timing" | "why" | "who" | "where",
      "title": string,
      "findings": string,
      "adsCommentary": string | null
    }
  ],
  "actions": string[],
  "needsTesting": string[]
}

For the why question, write two or three sentences only: cheapest cost per result, most results, most expensive. Do not list every ad in prose; the product draws a table from ads[]. adsCommentary is always null.
`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return json({ error: "You must be signed in." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "You must be signed in." }, 401);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ commentary: null, reason: "no_key" });

  const payload = await req.json();
  const user =
    `Project: ${payload.projectName}\n\nFigures:\n${JSON.stringify(payload.figures, null, 2)}\n\nCalculated actions:\n${JSON.stringify(payload.actions, null, 2)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-5",
      max_tokens: 4096,
      system: COMMENTARY_SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    return json({ commentary: null, reason: "anthropic_error", status: res.status });
  }

  const body = await res.json() as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = body.content?.filter((b) => b.type === "text").map((b) => b.text ?? "").join("") ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return json({ commentary: null, reason: "parse" });
  try {
    return json({ commentary: JSON.parse(match[0]) });
  } catch {
    return json({ commentary: null, reason: "parse" });
  }
});
