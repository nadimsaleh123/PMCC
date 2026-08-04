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

  const tasks = [...doc.getElementsByTagName("Task")]
    .map((t) => {
      const g = (n) => t.getElementsByTagName(n)[0]?.textContent;
      return {
        name: g("Name"),
        milestone: g("Milestone") === "1",
        start: g("Start"),
        finish: g("Finish"),
        pct: Number(g("PercentComplete") ?? 0),
        summary: g("Summary") === "1",
        active: g("Active") !== "0",
      };
    })
    .filter((t) => t.name && t.active && !t.summary);

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
      .map((t) => ({ t: t.name, s: t.pct >= 100 ? "done" : "ready" }));
    return {
      label: w === 0 ? "This week" : w === 1 ? "Next week" : "Week after",
      range: `${fmtDay(from)} – ${fmtDay(to)}`,
      items,
    };
  });

  return { taskCount: tasks.length, milestones, weeks };
}
