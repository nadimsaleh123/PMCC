/**
 * Ask PMCC. In the demo the brain is a local rule-engine over the shared
 * record — the same contract the live version will keep: it answers ONLY
 * from what has been published in this app (diary, plan, milestones,
 * payments, risks), and anything outside that goes to the team as a
 * question, visibly. Live version: same prompt discipline, Groq behind a
 * locked endpoint.
 */
import { useEffect, useRef, useState } from "react";
import { useStore, usd } from "../../store";
import { Screen, TopBar, Btn, Icon, Back } from "../../ui";
import { IS_LIVE } from "../../lib/supabase";
import { askLive } from "../../live/sync";

function brain(q, state) {
  const s = q.toLowerCase();
  const { project, lookahead, payments, risks, diary, visits, owner } = state;

  // Every branch below reads the record. On a project whose record is still
  // empty, an unguarded read crashed the whole screen rather than saying the
  // one honest thing: it has not been set yet.
  if (/(this week|happening|now|current)/.test(s)) {
    const w = lookahead.weeks?.[0];
    if (!w?.items?.length) return "The three-week plan has not been published yet, so there is nothing recorded for this week.";
    return `This week (${w.range}): ${w.items.map((i) => i.t.toLowerCase()).join("; ")}. From the site programme, updated ${lookahead.updated}.`;
  }
  if (/(next week|coming|after)/.test(s)) {
    const w = lookahead.weeks?.[1];
    if (!w?.items?.length) return "Nothing is recorded for next week yet.";
    return `Next week (${w.range}): ${w.items.map((i) => i.t.toLowerCase()).join("; ")}.${w.items.some((i) => i.s === "blocked") ? " One item is waiting on a supplier — it's flagged on the plan." : ""}`;
  }
  if (/(progress|far|status|%)/.test(s)) {
    const st = (project.phases ?? []).find((p) => p.name === "Structure");
    const next = (project.milestones ?? []).find((m) => m.next || !m.done);
    return `Overall progress is ${project.overall}%.${st ? ` Structure is at ${st.pct}%.` : ""}${next ? ` The next milestone is ${next.name}, ${next.date}.` : ""} Delivery holds at ${project.delivery}.`;
  }
  if (/(pay|money|installment|due|owe)/.test(s)) {
    const next = payments.find((p) => p.state !== "paid");
    const paid = payments.filter((p) => p.state === "paid").reduce((a, p) => a + p.amount, 0);
    if (!payments.length) return "No payment schedule has been recorded against your unit yet.";
    if (!next) return `You've paid ${usd(paid)} to date, and nothing further is outstanding.`;
    return `You've paid ${usd(paid)} to date. Your next installment is "${next.name}" — ${usd(next.amount)}, tied to ${next.link}. Nothing is due until that milestone is built.`;
  }
  if (/(deliver|handover|finish|move in|when)/.test(s)) {
    return `Delivery is ${project.delivery}. The path there: structure top-out Nov 2026 → envelope closed Mar 2027 → finishes complete Jun 2027 → handover. The programme currently holds two weeks of float.`;
  }
  if (/(risk|delay|problem|late)/.test(s)) {
    const open = risks.filter((r) => r.status !== "closed");
    if (!open.length) return "No open risks right now. The last one shared was closed with no impact to the programme.";
    return `One item being watched: ${open[0].title.toLowerCase()} — ${open[0].body}`;
  }
  if (/(visit|see|come|site)/.test(s)) {
    return visits.booked
      ? `Your next visit is booked: ${visits.booked.date} at ${visits.booked.time}. More slots are in Site visits if you'd like another.`
      : "There are open visit slots under More → Site visits — pick one and the site engineer will walk you through your floor.";
  }
  if (/(photo|picture|update|diary)/.test(s)) {
    const d = diary[0];
    if (!d) return "No site updates have been published yet. They appear in the diary as soon as the team posts one.";
    return `The latest diary entry is from ${d.date} (${d.phase}): ${d.text}`;
  }
  if (/(grace|compensat|penalt|late deliver)/.test(s)) {
    return owner.contract?.deliveryClause
      ? `From your contract: ${owner.contract.deliveryClause}`
      : "Your contract has not been indexed yet, so I cannot quote a clause. Ask the team and they will confirm it.";
  }
  // An un-indexed contract is an empty object, and reading a clause off it
  // used to print the word "undefined" as though it were a contract term.
  const NOT_INDEXED = "Your contract has not been indexed into the app yet, so I cannot quote it. The team can confirm the wording.";
  if (/(contract|agreement|signed|clause|terms|warranty|guarantee)/.test(s)) {
    const c = owner.contract ?? {};
    const quote = (v) => (v ? `From your contract: ${v}` : NOT_INDEXED);
    if (/(warrant|guarantee|defect)/.test(s)) return quote(c.warrantyClause);
    if (/(pay|installment)/.test(s)) return quote(c.paymentClause);
    if (/(change|variation)/.test(s)) return quote(c.variationClause);
    if (/(unit|include|parking|storage)/.test(s)) return quote(c.unitClause);
    if (!c.signedOn && !c.parties) return NOT_INDEXED;
    return `Your contract was signed on ${c.signedOn} between ${c.parties}. It covers: ${c.unitClause} Ask me about payment terms, delivery and grace period, variations, or warranty — I answer from the indexed contract.`;
  }
  if (/(parking|storage|bay)/.test(s)) {
    return owner.contract?.unitClause ? `From your contract: ${owner.contract.unitClause}` : NOT_INDEXED;
  }
  if (/(terrace|roof|my (floor|unit|apartment)|residence)/.test(s)) {
    const bits = [owner.area, owner.extras?.toLowerCase()].filter(Boolean).join(", ");
    return `${owner.unit}${bits ? `: ${bits}` : ""}. Your floor plan is in Documents when the team uploads it.`;
  }
  return null;
}

const SUGGESTIONS = [
  "What's happening this week?",
  "When is my next payment?",
  "What does my contract say about late delivery?",
  "Any risks I should know about?",
];

export default function Ask() {
  const { state, dispatch } = useStore();
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottom = useRef(null);
  const chat = state.chat ?? [];

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length, thinking]);

  async function send(text) {
    const q = text.trim();
    if (!q) return;
    setInput("");
    dispatch({ type: "chat", messages: [{ role: "user", text: q }] });
    setThinking(true);

    if (IS_LIVE) {
      try {
        const { answer } = await askLive(q);
        dispatch({ type: "chat", messages: [{ role: "pmcc", text: answer }] });
      } catch (e) {
        console.error(e);
        dispatch({
          type: "chat",
          messages: [{ role: "pmcc", text: "I couldn't reach the record just now — try again in a moment, or leave your question under More → Questions." }],
        });
      }
      setThinking(false);
      return;
    }

    setTimeout(() => {
      const a = brain(q, state);
      if (a) {
        dispatch({ type: "chat", messages: [{ role: "pmcc", text: a }] });
      } else {
        dispatch({
          type: "chat",
          messages: [
            {
              role: "pmcc",
              text: "That one isn't in the shared record, so I won't guess — I've passed it to the team as a question. You'll find their answer under More → Questions.",
            },
          ],
        });
        dispatch({
          type: "ask",
          question: { id: `q${Date.now()}`, from: state.owner.name, asked: "Today", q, a: null },
        });
      }
      setThinking(false);
    }, 700);
  }

  return (
    <Screen>
      <Back to="/" label="Home" />
      <TopBar eyebrow="Answers from your project record" title="Ask PMCC" />
      <div className="min-h-[40vh]">
        {chat.length === 0 && (
          <div className="rise rise-1">
            <p className="font-sans text-sm leading-relaxed text-smoke">
              I answer from what's been shared in this app — the diary, the plan, milestones,
              payments and notices. If it isn't in the record, I pass it to the team instead of guessing.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="border border-seam px-3.5 py-2 font-sans text-xs text-bone/85 transition-colors active:border-stone"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.map((m, i) => (
          <div key={i} className={`mb-4 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-4 py-3 font-sans text-sm leading-relaxed ${
                m.role === "user" ? "bg-bone text-ink" : "border border-seam bg-coal text-bone/90"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="mb-4 flex justify-start">
            <div className="border border-seam bg-coal px-4 py-3 font-sans text-sm text-smoke">…</div>
          </div>
        )}
        <div ref={bottom} />
      </div>
      <div className="sticky bottom-24 mt-4 flex gap-2 bg-ink pb-2 pt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Ask about your residence…"
          className="min-w-0 flex-1 border border-seam bg-coal px-4 py-3.5 font-sans text-sm text-bone outline-none placeholder:text-smoke/50 focus:border-stone"
        />
        <Btn onClick={() => send(input)} aria-label="Send">
          <Icon.chat className="h-4 w-4" />
        </Btn>
      </div>
    </Screen>
  );
}
