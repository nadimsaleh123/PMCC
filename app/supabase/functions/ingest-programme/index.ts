// ingest-programme — the automatic side of the ingest pipeline.
//
// Fetches each project's programme file from its shared link (Google Drive,
// OneDrive, Dropbox — anything that returns the XML over HTTPS), parses it,
// and if the content actually changed since the last snapshot it does exactly
// what a manual import does: appends a snapshot, updates the milestones,
// phases, overall % and look-ahead, classifies the diff, queues the copilot's
// questions for material deltas, and writes the log line.
//
// Two ways in:
//   • cron  — header `x-ingest-key: <INGEST_KEY secret>`, no body: sweeps every
//             project that has a programme_url.
//   • app   — a signed-in team user with {"project_id": "..."}: one project,
//             on demand ("Check now").
//
// Deploy as: ingest-programme.
// Secrets: INGEST_KEY (any long random string you choose).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are provided.
//
// The file states the WHAT. The WHY still only ever comes from a human
// answering a question — nothing here writes a reason.

import { createClient } from "jsr:@supabase/supabase-js@2";

/* ------------------------------------------------------------------ */
/* MSPDI parser — string-based, so it runs outside a browser.          */

const DEP_TYPE: Record<string, string> = { "0": "FF", "1": "FS", "2": "SF", "3": "SS" };

const block = (xml: string, tag: string): string[] =>
  [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1]);

const field = (xml: string, tag: string): string | undefined => {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m
    ? m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    : undefined;
};

const fmtMonth = (iso?: string) => {
  const d = new Date(iso ?? "");
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};
const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtShort = (iso?: string) => {
  const d = new Date(iso ?? "");
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const okDate = (v?: string) => (v && !Number.isNaN(new Date(v).getTime()) ? v.slice(0, 10) : undefined);

export function parseMSPDI(xmlText: string) {
  if (!/<Project[\s>]/.test(xmlText) || !/<Task[\s>]/.test(xmlText)) {
    throw new Error("Not an MS Project XML (MSPDI) file — check the link returns the file itself.");
  }

  // Resources and assignments, so a task can carry who does it.
  const resNames = new Map<string, string>();
  for (const r of block(xmlText, "Resource")) {
    const uid = field(r, "UID");
    const name = field(r, "Name");
    if (uid && name) resNames.set(uid, name);
  }
  const taskRes = new Map<string, string[]>();
  for (const a of block(xmlText, "Assignment")) {
    const t = field(a, "TaskUID");
    const name = resNames.get(field(a, "ResourceUID") ?? "");
    if (t && name) taskRes.set(t, [...(taskRes.get(t) ?? []), name]);
  }

  const nodes = block(xmlText, "Task")
    .map((raw) => {
      // Nested blocks carry their own <UID>/<Start>/<Finish>: pull them out
      // first, then read the task's own fields from what remains.
      const links = block(raw, "PredecessorLink");
      const baselines = block(raw, "Baseline");
      const clean = raw
        .replace(/<PredecessorLink\b[^>]*>[\s\S]*?<\/PredecessorLink>/g, "")
        .replace(/<Baseline\b[^>]*>[\s\S]*?<\/Baseline>/g, "");

      const preds = links
        .map((p) => {
          const uid = field(p, "PredecessorUID");
          const type = DEP_TYPE[field(p, "Type") ?? "1"] ?? "FS";
          const lag = Number(field(p, "LinkLag") ?? 0) / 4800; // tenths of a minute → 8h days
          return `${uid}${type}${lag ? (lag > 0 ? `+${lag}` : lag) : ""}`;
        })
        .sort()
        .join(";");

      const base = baselines.find((b) => (field(b, "Number") ?? "0") === "0");
      const uid = field(clean, "UID");
      return {
        uid,
        name: field(clean, "Name"),
        wbs: field(clean, "WBS"),
        milestone: field(clean, "Milestone") === "1",
        start: field(clean, "Start"),
        finish: field(clean, "Finish"),
        actualStart: okDate(field(clean, "ActualStart")),
        actualFinish: okDate(field(clean, "ActualFinish")),
        pct: Number(field(clean, "PercentComplete") ?? 0),
        summary: field(clean, "Summary") === "1",
        outline: Number(field(clean, "OutlineLevel") ?? 0),
        active: field(clean, "Active") !== "0",
        preds,
        baselineStart: base ? okDate(field(base, "Start")) : undefined,
        baselineFinish: base ? okDate(field(base, "Finish")) : undefined,
        resources: (taskRes.get(uid ?? "") ?? []).join(", "),
      };
    })
    .filter((t) => t.name && t.active);
  const tasks = nodes.filter((t) => !t.summary);

  let W = 0;
  let S = 0;
  for (const t of tasks) {
    const d = Math.max(1, (+new Date(t.finish ?? "") - +new Date(t.start ?? "")) / 86400000 || 1);
    W += d;
    S += d * (t.pct || 0);
  }
  const overall = W ? Math.round(S / W) : 0;
  const phases = nodes
    .filter((t) => t.summary && t.outline === 1)
    .map((s) => ({ name: s.name, pct: Math.round(s.pct || 0) }));

  const milestones: Array<Record<string, unknown>> = tasks
    .filter((t) => t.milestone)
    .sort((a, b) => +new Date(a.finish ?? a.start ?? "") - +new Date(b.finish ?? b.start ?? ""))
    .map((m) => ({ name: m.name, date: fmtMonth(m.finish ?? m.start), done: m.pct >= 100 }));
  const next = milestones.find((m) => !m.done);
  if (next) next.next = true;

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weeks = [0, 1, 2].map((w) => {
    const from = new Date(weekStart);
    from.setDate(weekStart.getDate() + w * 7);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    const items = tasks
      .filter((t) => {
        if (t.milestone) return false;
        const s = new Date(t.start ?? "");
        return s >= from && s <= to;
      })
      .slice(0, 8)
      .map((t) => ({
        t: t.name,
        s: t.pct >= 100 ? "done" : t.pct > 0 ? "ready" : "todo",
        d: fmtDay(new Date(t.start ?? "")),
        u: t.uid,
      }));
    return {
      label: w === 0 ? "This week" : w === 1 ? "Next week" : "Week after",
      range: `${fmtDay(from)} – ${fmtDay(to)}`,
      items,
    };
  });

  const snapshot = tasks.map((t) => {
    const row: Record<string, unknown> = {
      u: t.uid,
      n: t.name,
      s: (t.start ?? "").slice(0, 10),
      f: (t.finish ?? "").slice(0, 10),
      m: t.milestone,
      p: t.pct,
    };
    if (t.wbs) row.w = t.wbs;
    if (t.actualStart) row.as = t.actualStart;
    if (t.actualFinish) row.af = t.actualFinish;
    if (t.preds) row.d = t.preds;
    if (t.baselineStart) row.bs = t.baselineStart;
    if (t.baselineFinish) row.bf = t.baselineFinish;
    if (t.resources) row.r = t.resources;
    return row;
  });

  return { taskCount: tasks.length, milestones, weeks, snapshot, overall, phases };
}

/* ------------------------------------------------------------------ */
/* The classified diff — identical rules to the in-app engine.         */

type Row = Record<string, any>;

export function diffProgramme(oldSnapshot: Row[], newSnapshot: Row[], thresholdDays = 3) {
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

  const completed: Row[] = [];
  const slipped: Row[] = [];
  const pulled: Row[] = [];
  const depChanged: Row[] = [];

  for (const t of newSnapshot) {
    const o = old.get(key(t)) ?? old.get(nameKey(t));
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
      const entry = {
        u: t.u,
        n: t.n,
        days: Math.abs(delta),
        from: fmtShort(o.f || o.s),
        to: fmtShort(t.f || t.s),
        material: Math.abs(delta) >= thresholdDays,
        text: `${t.n}: ${delta > 0 ? "+" : "−"}${Math.abs(delta)}d (${fmtShort(o.f || o.s)} → ${fmtShort(t.f || t.s)})`,
      };
      (delta > 0 ? slipped : pulled).push(entry);
    }
    if ((o.d ?? "") !== (t.d ?? "")) {
      depChanged.push({ u: t.u, n: t.n, from: o.d || "none", to: t.d || "none" });
    }
  }

  const added = newSnapshot
    .filter((t) => !(old.has(key(t)) || old.has(nameKey(t))))
    .map((t) => ({ u: t.u, n: t.n, s: fmtShort(t.s), f: fmtShort(t.f) }));
  const removed = oldSnapshot.filter((t) => !seen.has(key(t))).map((t) => ({ u: t.u, n: t.n }));

  slipped.sort((a, b) => b.days - a.days);
  pulled.sort((a, b) => b.days - a.days);
  const moved = [...slipped, ...pulled].map((m) => ({ text: m.text, abs: m.days }));
  return { completed, slipped, pulled, added, removed, depChanged, moved };
}

const BASE_REASONS = [
  "Material delivery",
  "Labour availability",
  "Design change",
  "Permit / approvals",
  "Weather",
  "Client decision pending",
];

function learnedOptions(reasons: Row[], taskUid?: string, taskName?: string) {
  const freq = new Map<string, number>();
  const taskFreq = new Map<string, number>();
  for (const r of reasons ?? []) {
    freq.set(r.reason, (freq.get(r.reason) ?? 0) + 1);
    if ((taskUid && r.task_uid === taskUid) || r.task_name === taskName) {
      taskFreq.set(r.reason, (taskFreq.get(r.reason) ?? 0) + 1);
    }
  }
  const rank = (o: string) => (taskFreq.get(o) ?? 0) * 1000 + (freq.get(o) ?? 0);
  const seen = new Set<string>();
  return [...taskFreq.keys(), ...freq.keys(), ...BASE_REASONS]
    .filter((o) => {
      const k = o.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 6);
}

/* ------------------------------------------------------------------ */
/* Google Drive / OneDrive share links → a direct download URL.        */

function driveId(url: string): string | null {
  const m =
    url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/) ??
    url.match(/drive\.usercontent\.google\.com\/.*[?&]id=([^&]+)/) ??
    url.match(/drive\.google\.com\/.*[?&]id=([^&]+)/);
  return m ? m[1] : null;
}

function otherHost(url: string) {
  // OneDrive / SharePoint share links serve the file with download=1.
  if (/1drv\.ms|sharepoint\.com|onedrive\.live\.com/.test(url)) {
    return url.includes("?") ? `${url}&download=1` : `${url}?download=1`;
  }
  if (/dropbox\.com/.test(url)) return url.replace(/[?&]dl=0/, "").concat(url.includes("?") ? "&dl=1" : "?dl=1");
  return url;
}

const isHtml = (s: string) => /^\s*(<!DOCTYPE html|<html)/i.test(s);

/**
 * Get the file itself, not a page about the file. Google has moved public
 * downloads to drive.usercontent.google.com; the old drive.google.com/uc
 * address now often answers with an interstitial, so try the current one
 * first, fall back to the old one, and follow the confirm form if Google
 * shows it. Any HTML that survives all that is reported verbatim — a
 * sign-in page and a quota page need different fixes, so the message says
 * which one arrived.
 */
async function fetchProgramme(url: string): Promise<string> {
  const id = driveId(url);
  const candidates = id
    ? [
        `https://drive.usercontent.google.com/download?id=${id}&export=download`,
        `https://drive.google.com/uc?export=download&id=${id}`,
      ]
    : [otherHost(url)];

  let snippet = "";
  for (const u of candidates) {
    const res = await fetch(u, { redirect: "follow" });
    if (!res.ok) {
      snippet = `HTTP ${res.status}`;
      continue;
    }
    const text = await res.text();
    if (!isHtml(text)) return text;

    // Google's "can't scan this file" / large-file form: resend with its token.
    const conf = text.match(/name="confirm"\s+value="([^"]+)"/) ?? text.match(/[?&]confirm=([\w-]+)/);
    const uuid = text.match(/name="uuid"\s+value="([^"]+)"/);
    if (id && conf) {
      const retry =
        `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=${conf[1]}` +
        (uuid ? `&uuid=${uuid[1]}` : "");
      const r2 = await fetch(retry, { redirect: "follow" });
      const t2 = await r2.text();
      if (!isHtml(t2)) return t2;
      snippet = t2;
    } else {
      snippet = text;
    }
  }

  const title = snippet.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
  throw new Error(
    `the link returned a web page, not the file${title ? ` — Google said: "${title}"` : ""}. ` +
      `Open the file in Drive → Share → General access → "Anyone with the link".`,
  );
}

/* ------------------------------------------------------------------ */

async function ingestOne(admin: any, project: Row) {
  const text = await fetchProgramme(project.programme_url);
  const parsed = parseMSPDI(text);

  // Nothing to do if the file's content is identical to the last snapshot.
  const { data: last } = await admin
    .from("programme_snapshots")
    .select("id, tasks")
    .eq("project_id", project.id)
    .order("taken_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last && JSON.stringify(last.tasks) === JSON.stringify(parsed.snapshot)) {
    return { project: project.name, status: "unchanged" };
  }

  const threshold = project.threshold_days ?? 3;
  const diff = last ? diffProgramme(last.tasks, parsed.snapshot, threshold) : null;

  // Every write is checked. A silent failure here would report "ingested"
  // over a database that never changed — the worst possible lie for a
  // system whose whole job is to be the record.
  const must = async (label: string, p: Promise<{ error: unknown }>) => {
    const { error } = await p;
    if (error) throw new Error(`${label}: ${(error as Row).message ?? JSON.stringify(error)}`);
  };

  await must(
    "projects update",
    admin
      .from("projects")
      .update({
        milestones: parsed.milestones,
        overall: parsed.overall,
        phases: parsed.phases.length ? parsed.phases : project.phases,
        programme: { importedAt: new Date().toISOString(), tasks: parsed.snapshot },
      })
      .eq("id", project.id),
  );

  await must(
    "lookahead upsert",
    admin.from("lookahead").upsert(
      {
        project_id: project.id,
        weeks: parsed.weeks,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" },
    ),
  );

  await must(
    "snapshot insert",
    admin.from("programme_snapshots").insert({
      project_id: project.id,
      source: "auto",
      is_baseline: !last,
      task_count: parsed.taskCount,
      overall: parsed.overall,
      tasks: parsed.snapshot,
    }),
  );

  let queued = 0;
  if (diff) {
    const { data: reasons } = await admin
      .from("task_reasons")
      .select("*")
      .eq("project_id", project.id)
      .limit(400);
    const qs = [
      ...diff.slipped
        .filter((s: Row) => s.material)
        .map((s: Row) => ({
          project_id: project.id,
          task_uid: s.u ?? null,
          task_name: s.n,
          kind: "slip",
          change: `moved out ${s.days} day${s.days > 1 ? "s" : ""} (${s.from} → ${s.to})`,
          options: learnedOptions(reasons ?? [], s.u, s.n),
        })),
      ...diff.pulled
        .filter((s: Row) => s.material)
        .map((s: Row) => ({
          project_id: project.id,
          task_uid: s.u ?? null,
          task_name: s.n,
          kind: "pull",
          change: `pulled forward ${s.days} day${s.days > 1 ? "s" : ""} (${s.from} → ${s.to})`,
          options: learnedOptions(reasons ?? [], s.u, s.n),
        })),
      ...diff.depChanged.map((c: Row) => ({
        project_id: project.id,
        task_uid: c.u ?? null,
        task_name: c.n,
        kind: "dep",
        change: `dependencies changed (${c.from} → ${c.to})`,
        options: ["Resequenced on site", "Design change", "Recovery plan", "Modelling correction"],
      })),
    ];
    if (qs.length) await admin.from("copilot_questions").insert(qs);
    queued = qs.length;
  }

  await admin.from("project_log").insert({
    project_id: project.id,
    author: "Drive sync",
    kind: "note",
    body: `Programme picked up automatically: ${parsed.taskCount} activities, overall ${parsed.overall}%.${
      diff
        ? ` Completed since last: ${diff.completed.length}${
            diff.completed.length
              ? ` (${diff.completed.map((c: Row) => `${c.n}${c.af ? ` on ${c.af}` : ""}`).join("; ")})`
              : ""
          }. Activities: ${diff.moved.length} shifted${
            diff.moved.length ? ` (${diff.moved.map((m: Row) => m.text).join("; ")})` : ""
          }, ${diff.added.length} added, ${diff.removed.length} dropped, ${diff.depChanged.length} dependency change${
            diff.depChanged.length === 1 ? "" : "s"
          }.${queued ? ` ${queued} question${queued > 1 ? "s" : ""} queued.` : ""}`
        : " First import — comparison baseline set."
    }`,
  });

  return {
    project: project.name,
    status: "ingested",
    tasks: parsed.taskCount,
    overall: parsed.overall,
    questions: queued,
  };
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-ingest-key",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const cronKey = req.headers.get("x-ingest-key");
    const isCron = Boolean(cronKey) && cronKey === Deno.env.get("INGEST_KEY");

    let body: Row = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // A person asking: must be a signed-in team member.
    if (!isCron) {
      const authed = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
      );
      const { data: auth } = await authed.auth.getUser();
      if (!auth?.user) return new Response("unauthorized", { status: 401, headers: cors });
      const { data: me } = await authed.from("profiles").select("role").eq("id", auth.user.id).single();
      if (me?.role !== "team") return new Response("forbidden", { status: 403, headers: cors });
    }

    let q = admin
      .from("projects")
      .select("id, name, programme_url, threshold_days, phases")
      .not("programme_url", "is", null)
      .neq("programme_url", "");
    if (body.project_id) q = q.eq("id", body.project_id);
    const { data: projects, error } = await q;
    if (error) throw error;

    const results = [];
    for (const p of projects ?? []) {
      try {
        results.push(await ingestOne(admin, p));
      } catch (e) {
        results.push({ project: p.name, status: "error", error: String((e as Error).message ?? e) });
      }
    }

    return new Response(JSON.stringify({ checked: results.length, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
