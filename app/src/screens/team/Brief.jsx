/**
 * The Brief: the morning read. One page, all text.
 *
 * It is deliberately not the Report. The Report is a document you produce
 * and hand to somebody. This is a page you open with one hand at seven in
 * the morning, and it answers one question: what do I need to know about
 * this project today.
 *
 * Everything below the top line is written by the server, deterministically,
 * from rows in the record. The top line is the only sentence a model wrote,
 * and the page says so out loud — a reader is entitled to know which words
 * came from a machine. When the model is unavailable or its draft fails
 * verification, the line falls back to one the code chose, and the page is
 * no less complete.
 *
 * Briefs are kept. "You were told this, on this date" is evidence, which is
 * why alerts.yaml is committed and why this is a table rather than a render.
 */
import { useCallback, useEffect, useState } from "react";
import { useStore } from "../../store";
import { Screen, TopBar, Card, Btn, Back } from "../../ui";
import { IS_LIVE } from "../../lib/supabase";
import { writeBrief, fetchBriefs } from "../../live/sync";

const fmtWhen = (ts) =>
  new Date(ts).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Fact sentences carry no full stop, so the page adds one — except where
// the sentence ends in a quoted human phrase that brought its own.
const stop = (s) => (/[.!?][")']?$/.test(s.trim()) ? "" : ".");

const TONE = {
  good: "text-[#55996A]",
  warn: "text-[#D9A441]",
  gap: "text-pmcc",
};

export default function Brief() {
  const { state } = useStore();
  const projectId = state.project?.id;

  const [briefs, setBriefs] = useState([]);
  const [idx, setIdx] = useState(0);
  const [period, setPeriod] = useState("day");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!IS_LIVE || !projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchBriefs(projectId);
      setBriefs(rows);
      setIdx(0);
    } catch (e) {
      setErr(String(e.message ?? e));
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setBusy(true);
    setErr("");
    try {
      const fresh = await writeBrief(projectId, period);
      setBriefs((prev) => [fresh, ...prev]);
      setIdx(0);
    } catch (e) {
      const msg = String(e.message ?? e);
      setErr(
        /failed to send|fetch/i.test(msg)
          ? `${msg}. That usually means the brief function is not deployed yet — Supabase, Edge Functions.`
          : msg,
      );
    }
    setBusy(false);
  }

  if (!IS_LIVE) {
    return (
      <Screen>
        <Back to="/team" label="Console" />
        <TopBar eyebrow="The morning read" title="Brief" />
        <p className="font-sans text-sm leading-relaxed text-smoke">
          The Brief is assembled from the permanent record, which lives on the server. Open the
          live app to use it.
        </p>
      </Screen>
    );
  }

  const b = briefs[idx] ?? null;

  return (
    <Screen>
      <div className="print:hidden">
        <Back to="/team" label="Console" />
      </div>
      <TopBar eyebrow="Read from the record — nothing here has been sent" title="Brief" />

      <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex border border-seam">
          {[
            ["day", "Today"],
            ["week", "This week"],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setPeriod(k)}
              className={`px-4 py-2 font-sans text-xs uppercase tracking-wideish transition-colors ${
                period === k ? "bg-bone text-ink" : "text-smoke"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Btn disabled={busy} onClick={generate}>
          {busy ? "Reading the record…" : "Write today's brief"}
        </Btn>
        {briefs.length > 1 && (
          <select
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="border border-seam bg-coal px-3 py-2 font-sans text-xs text-bone outline-none"
          >
            {briefs.map((x, i) => (
              <option key={x.id} value={i}>
                {fmtWhen(x.generated_at)}
              </option>
            ))}
          </select>
        )}
        {b && (
          <Btn tone="ghost" onClick={() => window.print()}>
            Print / PDF
          </Btn>
        )}
      </div>

      {err && (
        <Card className="mb-4 border-pmcc p-4">
          <p className="font-sans text-xs leading-relaxed text-bone/85">{err}</p>
        </Card>
      )}

      {loading ? (
        <p className="font-sans text-sm text-smoke">Reading the record…</p>
      ) : !b ? (
        <Card className="p-5">
          <p className="font-sans text-sm leading-relaxed text-bone/85">
            No brief has been written for {state.project?.name} yet.
          </p>
          <p className="mt-2 font-sans text-sm leading-relaxed text-smoke">
            Press Write today&apos;s brief. It reads the programme snapshots, the reasons logged
            against moved dates, the risks, the open decisions and the site log, and puts them in
            one page of plain sentences. It writes nothing back except the brief itself.
          </p>
        </Card>
      ) : (
        <article className="space-y-4">
          {/* THE LINE */}
          <Card className="p-5">
            <p className="type-eyebrow text-smoke">
              {state.project?.name} · {fmtWhen(b.generated_at)} · the last {b.period}
            </p>
            <p className="type-display mt-3 text-xl leading-snug text-bone">{b.headline}</p>
            <p className="mt-3 font-sans text-[0.65rem] leading-relaxed text-smoke">
              {b.headline_source === "model"
                ? "That sentence was phrased by a language model from the facts below. It was checked for invented figures and for claims about cause before it was shown. Every other word on this page was written by the system from the record."
                : "That sentence was chosen by the system, not written by a model. Everything on this page comes from the record."}
              {b.headline_source === "fallback" && b.violations?.length ? (
                <span className="text-pmcc">
                  {" "}
                  {b.headline_draft
                    ? `The model's draft was rejected: ${b.violations.join("; ")}.`
                    : `No line was written by the model: ${b.violations.join("; ")}.`}
                </span>
              ) : null}
            </p>
          </Card>

          {/* THE BODY — deterministic, in order */}
          {(b.sections ?? []).map((s) => (
            <Card key={s.title} className="p-5">
              <p className={`type-eyebrow ${TONE[s.tone] ?? "text-smoke"}`}>{s.title}</p>
              <ul className="mt-3 space-y-2">
                {(s.lines ?? []).map((line, i) => (
                  <li
                    key={`${s.title}-${i}`}
                    className="font-sans text-sm leading-relaxed text-bone/85"
                  >
                    {line}
                    {stop(line)}
                  </li>
                ))}
              </ul>
            </Card>
          ))}

          {/* PROVENANCE */}
          <Card className="p-5">
            <p className="type-eyebrow text-smoke">Where this came from</p>
            <p className="mt-2 font-sans text-xs leading-relaxed text-smoke">
              {b.stats?.facts ?? 0} facts, drawn from {b.stats?.snapshots ?? 0} programme{" "}
              {b.stats?.snapshots === 1 ? "import" : "imports"}, {b.stats?.reasons ?? 0} logged{" "}
              {b.stats?.reasons === 1 ? "reason" : "reasons"} and {b.stats?.logEntries ?? 0} site
              log entries.
              {b.stats?.comparedFrom
                ? ` Movement is measured against the import of ${new Date(b.stats.comparedFrom).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`
                : " There is no earlier import to measure movement against."}
            </p>
            <p className="mt-2 font-sans text-xs leading-relaxed text-smoke">
              Nothing on this page has been sent to anyone. To put any of it in front of the owner,
              publish an update or draft from the Report.
            </p>
          </Card>
        </article>
      )}
    </Screen>
  );
}
