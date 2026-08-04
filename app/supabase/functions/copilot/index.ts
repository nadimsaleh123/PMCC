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
      "You are the Site Copilot inside PMCC's construction console. A site engineer reports in plain words.",
      "Return ONLY a JSON object: {\"actions\": [...]}. Each action is one of:",
      '{"kind":"activity","label":"...","detail":"...","week":<0|1|2>,"item":<index>,"s":"done|ready|blocked","note":"..."}',
      '{"kind":"risk","label":"...","detail":"...","title":"...","body":"..."}',
      '{"kind":"note","label":"...","detail":"..."}  (informational only, e.g. milestone impact assessment)',
      "Match activities to the provided lookahead weeks/items by meaning; use exact indices. If a delay is reported, propose the activity state change AND a risk. Assess milestone impact honestly in a note — never move dates yourself.",
      "Never invent activities that are not in the lookahead; if nothing matches, return {\"actions\":[]}.",
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
