/**
 * Lean MS Project (MSPDI XML) reader, in the browser. Derives what the
 * portal needs from the programme file: the milestone arc and a three-week
 * look-ahead. Nothing invented — only what the file states.
 * (Primavera XER export: save via MS Project as XML for now; native XER
 * lands with the pm-agent parser port.)
 */

const fmtMonth = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};
const fmtDay = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function parseMSPDI(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("Not a valid MS Project XML (MSPDI) file.");

  const nodes = [...doc.getElementsByTagName("Task")]
    .map((t) => {
      const g = (n) => t.getElementsByTagName(n)[0]?.textContent;
      return {
        name: g("Name"),
        milestone: g("Milestone") === "1",
        start: g("Start"),
        finish: g("Finish"),
        pct: Number(g("PercentComplete") ?? 0),
        summary: g("Summary") === "1",
        outline: Number(g("OutlineLevel") ?? 0),
        active: g("Active") !== "0",
      };
    })
    .filter((t) => t.name && t.active);
  const tasks = nodes.filter((t) => !t.summary);

  // The progress mechanism: MS Project already carries % complete per task.
  // Overall = duration-weighted average across activities; phases = the
  // file's own top-level summary bars (Structure, Envelope, …), verbatim.
  // The ring therefore moves exactly when the programme says it moved —
  // refreshed on every import, never hand-tuned.
  let W = 0;
  let S = 0;
  for (const t of tasks) {
    const d = Math.max(1, (new Date(t.finish) - new Date(t.start)) / 86400000 || 1);
    W += d;
    S += d * (t.pct || 0);
  }
  const overall = W ? Math.round(S / W) : 0;
  const phases = nodes
    .filter((t) => t.summary && t.outline === 1)
    .map((s) => ({ name: s.name, pct: Math.round(s.pct || 0) }));

  const milestones = tasks
    .filter((t) => t.milestone)
    .sort((a, b) => new Date(a.finish ?? a.start) - new Date(b.finish ?? b.start))
    .map((m) => ({ name: m.name, date: fmtMonth(m.finish ?? m.start), done: m.pct >= 100 }));
  const next = milestones.find((m) => !m.done);
  if (next) next.next = true;

  // Three weeks from the coming Monday-aligned window, activities only.
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // this week's Monday
  const weeks = [0, 1, 2].map((w) => {
    const from = new Date(weekStart);
    from.setDate(weekStart.getDate() + w * 7);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    const items = tasks
      .filter((t) => {
        if (t.milestone) return false;
        const s = new Date(t.start);
        return s >= from && s <= to;
      })
      .slice(0, 8)
      .map((t) => ({ t: t.name, s: t.pct >= 100 ? "done" : t.pct > 0 ? "ready" : "todo" }));
    return {
      label: w === 0 ? "This week" : w === 1 ? "Next week" : "Week after",
      range: `${fmtDay(from)} – ${fmtDay(to)}`,
      items,
    };
  });

  // The snapshot the next import will be compared against — names and dates,
  // nothing derived, so the diff is against what the file actually said.
  const snapshot = tasks.map((t) => ({
    n: t.name,
    s: (t.start ?? "").slice(0, 10),
    f: (t.finish ?? "").slice(0, 10),
    m: t.milestone,
    p: t.pct,
  }));

  return { taskCount: tasks.length, milestones, weeks, snapshot, overall, phases };
}

const day = 86400000;
const fmtShort = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/**
 * The truth between two programmes: which activities moved (and by how many
 * days), which appeared, which vanished. Matched by name; no interpretation.
 */
export function diffProgramme(oldSnapshot, newSnapshot) {
  if (!oldSnapshot?.length) return null; // first import — nothing to compare
  const old = new Map(oldSnapshot.map((t) => [t.n.trim().toLowerCase(), t]));
  const seen = new Set();
  const moved = [];
  for (const t of newSnapshot) {
    const key = t.n.trim().toLowerCase();
    const o = old.get(key);
    seen.add(key);
    if (!o) continue;
    const ds = t.s && o.s ? Math.round((new Date(t.s) - new Date(o.s)) / day) : 0;
    const df = t.f && o.f ? Math.round((new Date(t.f) - new Date(o.f)) / day) : 0;
    const delta = ds !== 0 ? ds : df;
    if (delta !== 0) {
      moved.push({
        text: `${t.n}: ${delta > 0 ? "+" : ""}${delta}d (${fmtShort(o.s || o.f)} → ${fmtShort(t.s || t.f)})`,
        abs: Math.abs(delta),
      });
    }
  }
  moved.sort((a, b) => b.abs - a.abs);
  const added = newSnapshot.filter((t) => !old.has(t.n.trim().toLowerCase())).map((t) => t.n);
  const removed = oldSnapshot.filter((t) => !seen.has(t.n.trim().toLowerCase())).map((t) => t.n);
  return { moved, added, removed };
}
