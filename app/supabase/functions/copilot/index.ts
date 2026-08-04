// Site Copilot — the team's natural-language console, live version.
// Paste into Supabase: Edge Functions → Deploy new function → name: copilot
// Secrets required: GROQ_API_KEY
//
// The engineer reports in plain words; the model returns STRUCTURED proposed
// actions. It never writes to the database — the client applies each action
// through normal (RLS-guarded) writes only after a human taps Apply. Team-only.

import { createClient } from "jsr:@supabase/supabase-js@2";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return new Response("unauthorized", { status: 401, headers: cors });
    const { data: me } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
    if (me?.role !== "team") return new Response("forbidden", { status: 403, headers: cors });

    const { report, project_id } = await req.json();
    if (!report?.trim() || !project_id) return new Response("bad request", { status: 400, headers: cors });

    const [look, risks, project] = await Promise.all([
      supabase.from("lookahead").select("weeks").eq("project_id", project_id).maybeSingle(),
      supabase.from("risks").select("title, status").eq("project_id", project_id),
      supabase.from("projects").select("milestones, delivery").eq("id", project_id).single(),
    ]);

    const system = [
      "You are the Site Copilot inside PMCC's construction console. A site engineer reports site events in plain, sometimes messy words (typos included). Translate each report into proposed actions.",
      'Return ONLY a JSON object: {"actions": [...]}. Action shapes:',
      '{"kind":"risk","label":"Share a risk: <short title>","detail":"<one line>","title":"<short title>","body":"<what happened, its impact, and mitigation if stated — faithful to the report>"}',
      '{"kind":"outlook","label":"Update the delivery outlook","detail":"<one line>","state":"ontrack|watch|atrisk","note":"<ONE sentence the OWNER reads about delivery impact, keeping any number of days the engineer stated>"}',
      '{"kind":"activity","label":"Mark \\"<exact activity name>\\" as delayed|completed","detail":"<one line>","week":<0|1|2>,"item":<index>,"s":"done|ready|blocked","note":"<days + reason, e.g. Delayed 5 days — supplier failure>"}',
      '{"kind":"note","label":"...","detail":"..."} (informational only, nothing published)',
      "RULES:",
      "1. ANY delay, failure, shortage or problem reported => ALWAYS include a risk action, even when no lookahead activity matches.",
      "2. Include an activity action ONLY when the report clearly refers to one of the provided lookahead items (match by meaning, use exact indices and the item's exact name). s=blocked means delayed. Never force a weak match.",
      "3. If the report states or implies impact on project delivery (e.g. 'will delay delivery by 5 days') => ALWAYS include an outlook action: state=atrisk if delivery moves, watch if float may absorb it; repeat the engineer's number of days plainly.",
      "4. Good news works the same: completed work => activity s=done; if it recovers the programme, an outlook update.",
      "5. Never invent activities, dates or figures not in the report or the provided data. Never move milestone dates.",
      "6. Return {\"actions\":[]} only when the report is not about the site at all.",
    ].join("\n");

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `LOOKAHEAD: ${JSON.stringify(look.data?.weeks ?? [])}\nOPEN RISKS: ${JSON.stringify(risks.data ?? [])}\nMILESTONES: ${JSON.stringify(project.data?.milestones ?? [])}\n\nREPORT: ${report}`,
          },
        ],
      }),
    });
    const out = await res.json();
    let actions = [];
    try {
      actions = JSON.parse(out.choices?.[0]?.message?.content ?? "{}").actions ?? [];
    } catch {
      actions = [];
    }

    return new Response(JSON.stringify({ actions }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
