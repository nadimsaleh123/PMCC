// index-contract — team pastes the contract text; Groq extracts the clauses
// owners ask about; the result is stored per unit and quoted by "ask".
// Deploy as: index-contract. Requires secret GROQ_API_KEY.

import { createClient } from "jsr:@supabase/supabase-js@2";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
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

    const { unit_id, text } = await req.json();
    if (!unit_id || !text || text.trim().length < 200)
      return new Response("bad request", { status: 400, headers: cors });

    const system = [
      "You extract clauses from a real-estate sale contract for a client-facing assistant.",
      'Return ONLY JSON: {"signedOn":"...","parties":"...","unitClause":"...","paymentClause":"...","deliveryClause":"...","variationClause":"...","warrantyClause":"..."}',
      "Each value: 1-3 sentences, faithful to the contract text, plain language, keep exact figures and dates.",
      'If a clause is genuinely absent from the text, use "Not specified in the contract." — never invent terms.',
    ].join("\n");

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `CONTRACT TEXT:\n${text.slice(0, 24000)}` },
        ],
      }),
    });
    const out = await res.json();
    const clauses = JSON.parse(out.choices?.[0]?.message?.content ?? "{}");

    const { error } = await supabase.from("contract_index").upsert({ unit_id, clauses });
    if (error) throw error;

    return new Response(JSON.stringify({ clauses }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
