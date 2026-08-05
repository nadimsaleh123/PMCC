// brief — the morning read. One page of plain text assembled from the
// permanent record: what moved, what finished, what nobody has measured,
// and what is waiting on a human.
//
// Deploy as: brief. Requires secret GROQ_API_KEY.
//
// THE DESIGN, AND WHY IT IS THIS SHAPE
//
// A language model writing free prose over construction data is exactly
// where invented figures come from, and the figures on this page end up in
// payment applications and delay notices. So the model is not trusted with
// them, and the page does not depend on the model at all:
//
//   1. Every sentence of the body is rendered by the code below, from rows
//      in the record. With Groq switched off, out of quota, or misbehaving,
//      the brief is still complete and still correct. It loses one line.
//
//   2. The model writes exactly one thing: THE LINE at the top, the read of
//      the situation. It is handed a numbered list of facts and may cite
//      them only as [[F3]] tokens, which are substituted server-side after
//      verification. It never sees a raw number it could retype.
//
//   3. The draft is checked before anyone reads it. Any digit outside a
//      token, any unknown token, any causal claim, any line longer than a
//      short sentence, and the draft is rejected and the deterministic line
//      is used instead. The rejected draft is stored with the reason.
//
//   4. Cause is quoted, never generated. Every "why" on this page is a
//      task_reasons row printed verbatim with its author and date. The
//      model cannot author one, and where no reason exists the brief says
//      so and states plainly that nothing is being inferred. That is the
//      mechanical form of "never infer entitlement" — not a polite request
//      in a prompt, but an absence of any path by which the model could.

import { createClient } from "jsr:@supabase/supabase-js@2";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

type Row = Record<string, any>;

/* ------------------------------------------------------------------ */
/* Formatting                                                          */

const fmtShort = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const daysSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - +new Date(iso)) / 86400000));

/* ------------------------------------------------------------------ */
/* The classified diff — identical rules to the in-app engine and the   */
/* ingest. Three copies of this exist because three runtimes need it;   */
/* they must stay identical, and a change to one is a change to all.    */

function diffProgramme(oldSnapshot: Row[], newSnapshot: Row[], thresholdDays = 3) {
  if (!oldSnapshot?.length) return null;
  const key = (t: Row) => (t.u != null ? `u:${t.u}` : `n:${String(t.n).trim().toLowerCase()}`);
  const nameKey = (t: Row) => `n:${String(t.n).trim().toLowerCase()}`;
  const old = new Map<string, Row>();
  for (const t of oldSnapshot) {
    old.set(nameKey(t), t);
    old.set(key(t), t);
  }
  const seen = new Set<string>();
  const day = 86400000;

  // A name is only a safe identity when one side genuinely carries no UID,
  // which is the legacy case this fallback exists for. Two live activities
  // can share a name — "Screed" appears on every floor — and matching those
  // to each other manufactures a slip that never happened.
  const match = (t: Row) => {
    const byUid = old.get(key(t));
    if (byUid) return byUid;
    const byName = old.get(nameKey(t));
    return byName && (t.u == null || byName.u == null) ? byName : undefined;
  };

  const completed: Row[] = [];
  const slipped: Row[] = [];
  const pulled: Row[] = [];
  const depChanged: Row[] = [];

  for (const t of newSnapshot) {
    const o = match(t);
    if (!o) continue;
    seen.add(key(o));
    seen.add(nameKey(o));

    if ((o.p ?? 0) < 100 && ((t.p ?? 0) >= 100 || t.af)) {
      completed.push({ u: t.u, n: t.n, af: t.af ?? null, pct: t.p });
    }
    const df = t.f && o.f ? Math.round((+new Date(t.f) - +new Date(o.f)) / day) : 0;
    const ds = t.s && o.s ? Math.round((+new Date(t.s) - +new Date(o.s)) / day) : 0;
    const delta = df !== 0 ? df : ds;
    if (delta !== 0 && (t.p ?? 0) < 100) {
      // Print the dates of whichever end actually moved. Reporting the
      // finish pair for a start-only shift shows two identical dates next
      // to a day count, which reads as a contradiction.
      const onFinish = df !== 0;
      (delta > 0 ? slipped : pulled).push({
        u: t.u,
        n: t.n,
        days: Math.abs(delta),
        end: onFinish ? "finish" : "start",
        from: fmtShort(onFinish ? o.f : o.s),
        to: fmtShort(onFinish ? t.f : t.s),
        material: Math.abs(delta) >= thresholdDays,
      });
    }
    if ((o.d ?? "") !== (t.d ?? "")) {
      depChanged.push({ u: t.u, n: t.n, from: o.d || "none", to: t.d || "none" });
    }
  }

  const added = newSnapshot
    .filter((t) => !match(t))
    .map((t) => ({ u: t.u, n: t.n, s: fmtShort(t.s), f: fmtShort(t.f) }));
  const removed = oldSnapshot.filter((t) => !seen.has(key(t))).map((t) => ({ u: t.u, n: t.n }));

  slipped.sort((a, b) => b.days - a.days);
  pulled.sort((a, b) => b.days - a.days);
  return { completed, slipped, pulled, added, removed, depChanged };
}

/* ------------------------------------------------------------------ */
/* Facts. Every one is a finished sentence built from a row. Nothing    */
/* downstream may compose a figure; it may only place one of these.     */

type Fact = { id: string; kind: string; text: string };

function factory() {
  const facts: Fact[] = [];
  const add = (kind: string, text: string) => {
    const id = `F${facts.length + 1}`;
    facts.push({ id, kind, text });
    return id;
  };
  return { facts, add };
}

/* ------------------------------------------------------------------ */
/* The verifier. It runs on the model's draft before a human sees it.  */

// The gate is an ALLOWLIST, not a denylist.
//
// A denylist cannot be enumerated safely. Ban "twelve" and the model writes
// "thirteen"; ban "because" and it writes "held up by the supplier". Every
// list of forbidden words is a list of the ones somebody thought of.
//
// So the model may use only two kinds of word: ordinary connective English
// from the fixed list below, and vocabulary that already appears in the
// system's own fact sentences. Anything else is rejected by construction.
// There is no gap to find, because the permitted set is finite and known.
const CONNECTIVES = `
a an and the of in on at to for with from by is are was were be been being am
it its this that these those there here no not nothing none neither nor
but or if while as so yet still again also only just even though although however meanwhile
all both each other another same such more less
project programme site work works record brief page line item items
thing things story picture position shape state note point focus
quiet steady unchanged open outstanding ahead behind clear
holding moving standing sitting stays stay stands stand remains remain
looks look seems seem reads read says say shows show sits
`.trim().split(/\s+/);

// Subtracted from the permitted set unconditionally, even when the word
// occurs in a fact. Quantities and dates because the model must never
// author one; cause and blame because responsibility is recorded by a
// human or it is not recorded at all.
const NEVER = `
zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen
fifteen sixteen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety
hundred hundreds thousand thousands dozen dozens couple several few many most half quarter
first second third fourth fifth sixth seventh eighth ninth tenth last next every
day days week weeks month months year years percent
january february march april may june july august september october november december
jan feb mar apr jun jul aug sep sept oct nov dec
monday tuesday wednesday thursday friday saturday sunday
mon tue tues wed thu thur thurs fri sat sun today tomorrow yesterday now soon early late
because due owing caused causing cause causes result results resulting therefore thus hence
led leads leading knock consequence consequences blame blamed blaming fault liable liability
entitle entitled entitlement claim claims responsible responsibility attributable
stems driven thanks waiting awaiting pending held holds blocked blocking stalled
delayed delaying slipping failing failure failed missed missing
`.trim().split(/\s+/);

// Facts whose text embeds something a human typed freely. Their vocabulary
// is deliberately NOT lent to the model: it may place the whole quoted
// sentence as a token, but it may not borrow the words and speak them in
// its own voice.
const HUMAN_TEXT_KINDS = new Set(["reason", "outlook", "decision", "risk"]);

const wordsIn = (s: string) => s.toLowerCase().match(/[a-z']+/g) ?? [];

function permitted(facts: Fact[]) {
  const never = new Set(NEVER);
  const ok = new Set<string>();
  for (const w of CONNECTIVES) if (!never.has(w)) ok.add(w);
  for (const f of facts) {
    if (HUMAN_TEXT_KINDS.has(f.kind)) continue;
    for (const w of wordsIn(f.text)) if (!never.has(w)) ok.add(w);
  }
  return ok;
}

function verifyLine(draft: string, facts: Fact[]) {
  const violations: string[] = [];
  const known = new Set(facts.map((f) => f.id));
  const line = String(draft ?? "").trim();

  if (!line) {
    violations.push("empty");
    return { violations, prose: "" };
  }
  if (line.length > 200) violations.push(`too long (${line.length} characters)`);

  // Tokens must all be real.
  const used = [...line.matchAll(/\[\[(F\d+)\]\]/g)].map((m) => m[1]);
  for (const t of used) if (!known.has(t)) violations.push(`unknown fact token ${t}`);
  // A line with no fact in it is a mood, not a headline.
  if (!used.length) violations.push("cites no fact");

  // Everything the model itself typed, with the tokens taken out.
  const prose = line.replace(/\[\[F\d+\]\]/g, " ").replace(/\s+/g, " ").trim();

  if (/\d/.test(prose)) violations.push("contains a digit outside a fact");
  if (/["'“”]/.test(prose.replace(/(\w)'(\w)/g, "$1$2"))) violations.push("quotes something not in a fact");

  const ok = permitted(facts);
  const bad = [...new Set(wordsIn(prose).filter((w) => !ok.has(w)))];
  if (bad.length) violations.push(`used ${bad.map((w) => `"${w}"`).join(", ")}, which ${plural(bad.length, "is", "are")} not permitted`);

  // Hard cap on the model's own words. A short connective cannot smuggle
  // an argument; a paragraph can.
  const count = prose.split(/\s+/).filter(Boolean).length;
  if (count > 14) violations.push(`${count} of its own words, where 14 is the most allowed`);

  return { violations, prose };
}

const render = (line: string, facts: Fact[]) =>
  line.replace(/\[\[(F\d+)\]\]/g, (_m, id) => facts.find((f) => f.id === id)?.text ?? "");

/* ------------------------------------------------------------------ */

/**
 * Ask Groq for one JSON object.
 *
 * gpt-oss-120b is a reasoning model: it thinks before it answers. Strict
 * response_format json_object rejects that whole response — "Failed to
 * validate JSON" — and a small max_tokens makes it certain, because the
 * budget is spent thinking and the object is never finished.
 *
 * So: give it room, keep the reasoning short, and if the provider's
 * validator refuses the response anyway, ask again in plain text and lift
 * the object out ourselves. The verifier downstream does not care how the
 * JSON arrived; it checks the line either way.
 */
async function groqObject(messages: Row[], maxTokens = 1200): Promise<Row> {
  let lastText = "";
  for (const strict of [true, false]) {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: maxTokens,
        reasoning_effort: "low",
        ...(strict ? { response_format: { type: "json_object" } } : {}),
        messages,
      }),
    });
    const out = await res.json();
    if (out.error) {
      const m = String(out.error.message ?? "");
      if (strict && /json/i.test(m)) continue; // try again without the validator
      throw new Error(m || "Groq error");
    }
    lastText = out.choices?.[0]?.message?.content ?? "";
    const brace = lastText.match(/\{[\s\S]*\}/);
    if (brace) {
      try {
        return JSON.parse(brace[0]);
      } catch {
        /* fall through and try the looser call */
      }
    }
  }
  throw new Error(`the model returned no usable JSON: ${lastText.slice(0, 160) || "(empty)"}`);
}

/* ------------------------------------------------------------------ */

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-ingest-key",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // The caller's own JWT: every read below runs under their RLS. This
    // function never holds the service-role key, because a brief is a read
    // of the record and nothing more.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return new Response("unauthorized", { status: 401, headers: cors });
    const { data: me } = await supabase.from("profiles").select("role, full_name").eq("id", auth.user.id).single();
    if (me?.role !== "team") return new Response("forbidden", { status: 403, headers: cors });

    const { project_id, period } = await req.json();
    if (!project_id) return new Response("bad request", { status: 400, headers: cors });
    const span = period === "week" ? "week" : "day";
    const now = new Date();
    const from = new Date(now.getTime() - (span === "week" ? 7 : 1) * 86400000);

    const [projQ, snapQ, reasonQ, riskQ, decQ, diaryQ, lookQ, qQ, logQ] = await Promise.all([
      supabase.from("projects").select("name, delivery, overall, outlook, milestones, threshold_days").eq("id", project_id).single(),
      supabase.from("programme_snapshots").select("id, taken_at, is_baseline, overall, task_count, tasks")
        .eq("project_id", project_id).order("taken_at", { ascending: false }).limit(12),
      supabase.from("task_reasons").select("*").eq("project_id", project_id).order("at", { ascending: false }).limit(400),
      supabase.from("risks").select("*").eq("project_id", project_id).order("shared_on", { ascending: false }),
      supabase.from("decisions").select("*").eq("project_id", project_id).eq("status", "open").order("created_at"),
      supabase.from("diary").select("entry_date, phase, body").eq("project_id", project_id).order("entry_date", { ascending: false }).limit(20),
      supabase.from("lookahead").select("weeks, updated_at").eq("project_id", project_id).maybeSingle(),
      supabase.from("copilot_questions").select("task_name, change, created_at").eq("project_id", project_id).eq("status", "open"),
      supabase.from("project_log").select("at, author, kind, body").eq("project_id", project_id)
        .order("at", { ascending: false }).limit(120),
    ]);

    const project = projQ.data ?? {};
    const snaps = snapQ.data ?? [];
    const reasons = reasonQ.data ?? [];
    const risks = riskQ.data ?? [];
    const decisions = decQ.data ?? [];
    const diary = diaryQ.data ?? [];
    const weeks = lookQ.data?.weeks ?? [];
    const questions = qQ.data ?? [];
    const log = logQ.data ?? [];
    const threshold = project.threshold_days ?? 3;

    const latest = snaps[0] ?? null;
    // Compare against the newest snapshot taken at or before the window
    // opened. If none exists, fall back to the previous one — but then the
    // period is not what was asked for, and every sentence below has to say
    // the real dates rather than "this period".
    const prior = snaps.slice(1).find((s: Row) => new Date(s.taken_at) <= from) ?? snaps[1] ?? null;
    const diff = latest && prior ? diffProgramme(prior.tasks, latest.tasks, threshold) : null;
    // Was there actually an import inside the window? If the last one was a
    // fortnight ago, "nothing moved this period" is true but misleading —
    // nothing moved because nobody imported anything.
    const importedInWindow = Boolean(latest && new Date(latest.taken_at) >= from);
    const window = importedInWindow
      ? `in this period`
      : `between the imports of ${prior ? fmtShort(prior.taken_at) : "?"} and ${latest ? fmtShort(latest.taken_at) : "?"}`;

    const { facts, add } = factory();
    const sections: Array<{ title: string; lines: string[]; tone?: string }> = [];

    /* ---- Where it stands ------------------------------------------ */
    const standing: string[] = [];
    if (latest) {
      // A file that parsed to nothing is not a project at 0%. Saying so
      // would be a fabricated measurement of the worst kind: confident,
      // precise, and wrong.
      if (!latest.task_count) {
        standing.push(add("overall", `The import of ${fmtShort(latest.taken_at)} carried no activities, so overall progress is not measured`));
      } else {
        standing.push(
          add("overall", prior
            ? `Overall progress reads ${latest.overall}%, against ${prior.overall}% at the import of ${fmtShort(prior.taken_at)}`
            : `Overall progress reads ${latest.overall}% at the import of ${fmtShort(latest.taken_at)}`),
        );
      }
    } else {
      standing.push(add("overall", "No programme has been imported yet, so there is no measured progress"));
    }
    if (project.delivery) standing.push(add("delivery", `Delivery reads ${project.delivery}`));
    if (project.outlook?.note) {
      standing.push(add("outlook", `The delivery outlook was set to "${project.outlook.state}" with the note: "${project.outlook.note}"`));
    }
    const nextMs = (project.milestones ?? []).find((m: Row) => m.next || !m.done);
    if (nextMs) standing.push(add("milestone", `The next milestone on the file is ${nextMs.name}, dated ${nextMs.date}`));
    sections.push({ title: "Where it stands", lines: standing });

    /* ---- Finished -------------------------------------------------- */
    const doneLines = (diff?.completed ?? []).map((c: Row) =>
      add("completed", c.af
        ? `${c.n} finished on ${fmtShort(c.af)}, an actual finish date carried in the file`
        : `${c.n} is marked complete, but the file carries no actual finish date, so the date it finished is not measured`),
    );
    if (!doneLines.length) {
      doneLines.push(add("completed-none", diff
        ? `Nothing was marked complete ${window}`
        : "There is no second import to compare against, so nothing can be said to have finished"));
    }
    sections.push({ title: "Finished", lines: doneLines, tone: "good" });

    /* ---- Moved ----------------------------------------------------- */
    // A reason answers ONE movement. Taking the newest reason ever logged
    // against a task and printing it beside today's slip attributes a named
    // person's account of March to a move that happened in August — a dated,
    // attributed statement of cause that nobody made. It would also suppress
    // the "no reason logged" line and the "not inferred here" line, which are
    // the two things on this page that must never be suppressed wrongly.
    //
    // So a reason must clear both bars: it is the same task by identity, and
    // it was logged after the snapshot this move is measured from.
    const since = prior ? +new Date(prior.taken_at) : 0;
    const reasonFor = (uid?: string, name?: string) =>
      reasons.find((r: Row) => {
        // Names collide across floors; a UID on both sides is decisive, and
        // when it disagrees the name must not be allowed to override it.
        const sameTask =
          uid != null && r.task_uid != null ? r.task_uid === uid : r.task_name === name;
        return sameTask && +new Date(r.at) >= since;
      }) ?? null;

    const movedLines: string[] = [];
    const unexplained: string[] = [];
    for (const s of (diff?.slipped ?? []).filter((x: Row) => x.material)) {
      movedLines.push(add("slip", `${s.n} moved out ${s.days} ${plural(s.days, "day", "days")}, from ${s.from} to ${s.to}`));
      const r = reasonFor(s.u, s.n);
      if (r) {
        // Verbatim, attributed, in quotes. The only causal statement on this
        // page, and a human typed it.
        movedLines.push(add("reason", `The reason logged against it by ${r.author || "the team"} on ${fmtShort(r.at)} is: "${r.reason}"`));
      } else {
        movedLines.push(add("no-reason", `No reason has been logged against ${s.n}`));
        unexplained.push(s.n);
      }
    }
    for (const p of (diff?.pulled ?? []).filter((x: Row) => x.material)) {
      movedLines.push(add("pull", `${p.n} came forward ${p.days} ${plural(p.days, "day", "days")}, from ${p.from} to ${p.to}`));
    }
    const minor = (diff?.slipped ?? []).filter((x: Row) => !x.material).length +
      (diff?.pulled ?? []).filter((x: Row) => !x.material).length;
    if (minor) {
      movedLines.push(add("minor", `${minor} other ${plural(minor, "activity", "activities")} moved by less than the ${threshold}-day threshold set for this project and ${plural(minor, "was", "were")} not asked about`));
    }
    if (diff?.added?.length) movedLines.push(add("added", `${diff.added.length} ${plural(diff.added.length, "activity", "activities")} appeared in the programme that ${plural(diff.added.length, "was", "were")} not there before`));
    if (diff?.removed?.length) movedLines.push(add("removed", `${diff.removed.length} ${plural(diff.removed.length, "activity", "activities")} that ${plural(diff.removed.length, "was", "were")} in the programme ${plural(diff.removed.length, "is", "are")} no longer in it`));
    if (diff?.depChanged?.length) movedLines.push(add("dep", `${diff.depChanged.length} ${plural(diff.depChanged.length, "dependency", "dependencies")} changed`));
    if (!movedLines.length) movedLines.push(add("moved-none", diff ? `No dates moved ${window}` : "No comparison is possible yet"));
    if (unexplained.length) {
      // Unsuppressible, and the point of the whole page.
      movedLines.push(add("no-inference", `${plural(unexplained.length, "Whether this move is", "Whether these moves are")} anyone's responsibility is not recorded, and is not inferred here`));
    }
    sections.push({ title: "Moved", lines: movedLines, tone: "warn" });

    /* ---- Not measured ---------------------------------------------- */
    // The gap census. Code-rendered, never abridged, and the section that
    // makes the rest of the page trustworthy: it names what the record does
    // not know, so that silence is never read as zero.
    const gaps: string[] = [];
    for (const n of unexplained) gaps.push(add("gap-reason", `Why ${n} moved is not on the record`));
    const noPct = (latest?.tasks ?? []).filter((t: Row) => !t.m && (t.p ?? 0) === 0 && t.s && new Date(t.s) < now);
    if (noPct.length) {
      gaps.push(add("gap-pct", `${noPct.length} ${plural(noPct.length, "activity", "activities")} that should have started ${plural(noPct.length, "carries", "carry")} no progress in the file. Whether work has happened on site is not measured`));
    }
    if (diary.length) {
      const since = daysSince(diary[0].entry_date);
      if (since >= 2) gaps.push(add("gap-diary", `No site update has been published since ${fmtShort(diary[0].entry_date)}, ${since} days ago`));
    } else {
      gaps.push(add("gap-diary", "No site update has ever been published on this project"));
    }
    if (lookQ.data?.updated_at) {
      const since = daysSince(lookQ.data.updated_at);
      if (since >= 7) gaps.push(add("gap-look", `The look-ahead was last touched ${since} days ago and may no longer describe the site`));
    }
    if (!latest) gaps.push(add("gap-prog", "No programme file has been imported, so nothing on this page is measured against a schedule"));
    else if (snaps.length === 1) gaps.push(add("gap-base", "Only one import is on record, the baseline. Movement can only be seen from the second import onward"));
    if (!gaps.length) gaps.push(add("gap-none", "Nothing is outstanding: every material move has a reason logged, and the site record is current"));
    sections.push({ title: "Not measured", lines: gaps, tone: "gap" });

    /* ---- Waiting on a human ---------------------------------------- */
    const waiting: string[] = [];
    for (const d of decisions) {
      const age = daysSince(d.created_at);
      waiting.push(add("decision", `A decision has been open ${age} ${plural(age, "day", "days")}: "${d.body}"${d.task_name ? `, against ${d.task_name}` : ""}`));
    }
    if (questions.length) {
      waiting.push(add("questions", `${questions.length} ${plural(questions.length, "question", "questions")} raised by a programme import ${plural(questions.length, "is", "are")} still unanswered in the copilot, the oldest from ${fmtShort(questions.map((q: Row) => q.created_at).sort()[0])}: ${questions.map((q: Row) => q.task_name).join(", ")}`));
    }
    const openRisks = risks.filter((r: Row) => r.status !== "closed");
    for (const r of openRisks.slice(0, 5)) {
      waiting.push(add("risk", `An open risk stands against the project: "${r.title}"${r.source === "file-derived" ? ", raised from a programme change" : ""}`));
    }
    if (!waiting.length) waiting.push(add("waiting-none", "Nothing is waiting on a decision"));
    sections.push({ title: "Waiting on a human", lines: waiting });

    /* ---- Next ------------------------------------------------------ */
    const wk = weeks[0];
    const nextLines: string[] = [];
    if (wk?.items?.length) {
      nextLines.push(add("next", `The look-ahead for ${wk.range} carries ${wk.items.length} ${plural(wk.items.length, "activity", "activities")}: ${wk.items.map((i: Row) => i.t).join(", ")}`));
    } else {
      nextLines.push(add("next-none", "The look-ahead has nothing scheduled to start this week"));
    }
    sections.push({ title: "Next", lines: nextLines });

    /* ---- THE LINE -------------------------------------------------- */
    // The deterministic fallback, chosen by rule, in priority order. This
    // is what the page shows whenever the model is unavailable or wrong,
    // and it is never worse than serviceable.
    const worst = (diff?.slipped ?? []).filter((s: Row) => s.material)[0];
    const fallbackId =
      worst ? facts.find((f) => f.kind === "slip" && f.text.startsWith(worst.n))?.id
      : (diff?.completed?.length ? facts.find((f) => f.kind === "completed")?.id
      : (decisions.length ? facts.find((f) => f.kind === "decision")?.id
      : facts.find((f) => f.kind === "overall")?.id));
    const fallbackLine = fallbackId ? `[[${fallbackId}]].` : "The record has not moved.";

    let headline = fallbackLine;
    let headlineSource: "model" | "fallback" = "fallback";
    let draft = "";
    let violations: string[] = [];

    try {
      const system = [
        "You write ONE sentence: the opening line of a construction project's morning brief, read by the contractor on site.",
        'Return ONLY JSON: {"line":"..."}.',
        "You are given numbered FACTS. Each is a complete, already-correct sentence written by the system.",
        "You may place a fact into your sentence ONLY as a token like [[F3]]. The token is replaced by the fact's exact words afterwards.",
        "HARD RULES — a breach means your line is thrown away:",
        "1. Never type a digit, a number in words, a month, a weekday, a percentage, or a date. If you want one, cite the fact that contains it.",
        "2. Never say why something happened, and never imply it. No 'because', 'due to', 'as a result', 'knock-on', 'blame', 'responsible'. Causes are quoted from humans elsewhere on the page, not from you.",
        "3. Cite at least one fact. A line with no [[F]] token is worthless.",
        "4. At most 14 words of your own, outside the tokens. Aim for fewer.",
        "5. Never use quotation marks.",
        "WHAT MAKES A GOOD LINE: it names the single thing that matters most today and lets the fact carry the number. It is flat and unexcited. It never says 'the project is going well' or any judgement the record does not support.",
        'GOOD: {"line":"The slab is the week, and the trades behind it have moved with it: [[F4]]."}',
        'GOOD: {"line":"Quiet period. [[F1]]."}',
        'BAD (typed a number): {"line":"Three activities slipped 5 days."}',
        'BAD (claimed a cause): {"line":"[[F4]], which pushed the blockwork."}',
      ].join("\n");

      const messages: Array<Row> = [
        { role: "system", content: system },
        {
          role: "user",
          content:
            `PROJECT: ${project.name}\nPERIOD: the last ${span}\n` +
            `FACTS:\n${facts.map((f) => `${f.id}: ${f.text}`).join("\n")}\n\n` +
            `Write the line.`,
        },
      ];

      // The gate is deliberately strict, so a good-faith draft can trip it
      // on a single word. One repair round, with the violations handed back
      // verbatim, converts most of those into a usable line. Two strikes and
      // the deterministic line stands — the page never waits on the model.
      for (let attempt = 0; attempt < 2; attempt++) {
        const parsed = await groqObject(messages);
        draft = String(parsed.line ?? "");
        violations = verifyLine(draft, facts).violations;
        if (!violations.length) {
          headline = draft;
          headlineSource = "model";
          break;
        }
        if (attempt === 0) {
          messages.push({ role: "assistant", content: JSON.stringify({ line: draft }) });
          messages.push({
            role: "user",
            content:
              `That line was rejected: ${violations.join("; ")}. ` +
              `Rewrite it obeying every rule. Put the offending information inside a [[F]] token, ` +
              `or leave it out. Return ONLY {"line":"..."}.`,
          });
        }
      }
    } catch (e) {
      // Keep whatever the first attempt was already rejected for. Replacing
      // it with the transport error loses the only record of what the model
      // actually tried to say, which is the point of storing it.
      violations = [...violations, `model unavailable: ${String((e as Error).message ?? e)}`];
    }

    const stats = {
      facts: facts.length,
      snapshots: snaps.length,
      reasons: reasons.length,
      logEntries: log.length,
      openRisks: openRisks.length,
      openDecisions: decisions.length,
      comparedFrom: prior ? prior.taken_at : null,
      comparedTo: latest ? latest.taken_at : null,
      unexplained: unexplained.length,
    };

    const payload = {
      project_id,
      period: span,
      period_from: from.toISOString(),
      period_to: now.toISOString(),
      headline: render(headline, facts),
      headline_source: headlineSource,
      headline_draft: draft,
      violations,
      // Sections are stored already rendered: a brief must read in December
      // exactly as it read this morning, whatever the record does later.
      sections: sections.map((s) => ({
        title: s.title,
        tone: s.tone ?? null,
        lines: s.lines.map((id) => facts.find((f) => f.id === id)?.text ?? ""),
      })),
      facts,
      stats,
    };

    const { data: saved, error } = await supabase.from("briefs").insert(payload).select().single();
    if (error) throw new Error(`brief insert: ${error.message}`);

    return new Response(JSON.stringify(saved), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
