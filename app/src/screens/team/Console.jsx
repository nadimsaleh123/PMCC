/**
 * The site team's console. Deliberately unglamorous: big buttons, dense
 * lists, everything two taps — it gets used standing on a slab. The one
 * rule that matters is enforced by the UI itself: nothing reaches an owner
 * without a human pressing Publish after seeing exactly what the owner
 * will see.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, usd } from "../../store";
import { Screen, TopBar, Card, Row, Stamp, Btn, Icon, StateDot, Back } from "../../ui";
import { PHASES, PHOTO_LIBRARY } from "../../data/seed";
import { IS_LIVE } from "../../lib/supabase";
import { createProjectLive } from "../../live/sync";
import { loadTeam } from "../../live/load";

/* ------------------------------------------------ Today (dashboard) */
export function Today() {
  const { state, dispatch } = useStore();
  const nav = useNavigate();
  const unanswered = state.questions.filter((q) => !q.a).length;
  // Variations/payments belong to owners; a project with no owners has none.
  const hasOwners = state.team.owners.some((o) => o.state === "active");
  const offered = hasOwners ? state.variations.filter((v) => v.state === "offered").length : 0;
  const openRisks = state.risks.filter((r) => r.status !== "closed").length;
  const meta = state.projectsMeta ?? [{ id: "d563", name: "Daher el Souane 563" }];
  const activeId = state.activeProjectId ?? "d563";

  return (
    <Screen>
      <TopBar eyebrow="PMCC site console" title="Today" />

      {/* The project this console is pointed at — switch or start a new one. */}
      <div className="rise rise-1 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <select
            value={activeId}
            onChange={async (e) => {
              const id = e.target.value;
              if (IS_LIVE) {
                dispatch({ type: "boot", slices: await loadTeam(id) });
              } else {
                dispatch({ type: "switchProject", id });
              }
            }}
            aria-label="Active project"
            className="w-full appearance-none border border-seam bg-coal px-4 py-3.5 pr-10 font-sans text-sm font-semibold text-bone outline-none focus:border-stone"
          >
            {meta.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <Icon.chevron className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-smoke" />
        </div>
        <Btn tone="ghost" onClick={() => nav("/team/new")} aria-label="New project">
          <Icon.plus className="h-4 w-4" /> New
        </Btn>
      </div>

      <div className="rise rise-2 mt-4 grid grid-cols-3 gap-3">
        {[
          [String(state.diary.length), "updates published"],
          [String(openRisks), "open risks"],
          [String(unanswered), "open questions"],
        ].map(([v, l]) => (
          <Card key={l} className="p-4 text-center">
            <p className="type-display text-3xl text-bone">{v}</p>
            <p className="mt-1 font-sans text-[0.62rem] uppercase tracking-wideish text-smoke">{l}</p>
          </Card>
        ))}
      </div>

      <div className="rise rise-3 mt-5 flex gap-3">
        <Btn full onClick={() => nav("/team/publish")}>
          <Icon.camera className="h-4 w-4" /> New update
        </Btn>
        <Btn full tone="ghost" onClick={() => nav("/team/copilot")}>
          <Icon.chat className="h-4 w-4" /> Copilot
        </Btn>
      </div>

      <div className="rise rise-4 mt-6">
        <Row icon={Icon.plan} title="Look-ahead" meta={`Updated ${state.lookahead.updated} — tick as built`} onClick={() => nav("/team/plan")} />
        <Row icon={Icon.inbox} title="Inbox" meta="Owner questions & chatbot escalations" badge={unanswered} onClick={() => nav("/team/inbox")} />
        <Row icon={Icon.money} title="Payments" meta="Record receipts against milestones" onClick={() => nav("/team/money")} />
        <Row icon={Icon.shield} title="Risks & notices" meta="Share, update, close" onClick={() => nav("/team/risks")} />
        <Row icon={Icon.compass} title="Variations" meta={!hasOwners ? "No owners yet" : offered ? `${offered} awaiting owner decision` : "All settled"} badge={offered} onClick={() => nav("/team/owners")} />
        <Row icon={Icon.home} title="Owners & units" meta="Access, read receipts, invitations" onClick={() => nav("/team/owners")} />
        <Row icon={Icon.doc} title="Project & programme" meta="Contract, milestones, MS Project / P6 import" onClick={() => nav("/team/project")} />
      </div>
    </Screen>
  );
}

/* ------------------------------------------------ New project */
export function NewProject() {
  const { dispatch } = useStore();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [delivery, setDelivery] = useState("");
  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="A new client, a new record" title="New project" />
      <label className="block">
        <span className="type-eyebrow text-smoke">Project name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bcharreh Villa"
          className="mt-2 w-full border border-seam bg-transparent px-4 py-3.5 font-sans text-sm text-bone outline-none placeholder:text-smoke/40 focus:border-stone"
        />
      </label>
      <label className="mt-4 block">
        <span className="type-eyebrow text-smoke">Location</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Town · District"
          className="mt-2 w-full border border-seam bg-transparent px-4 py-3.5 font-sans text-sm text-bone outline-none placeholder:text-smoke/40 focus:border-stone"
        />
      </label>
      <label className="mt-4 block">
        <span className="type-eyebrow text-smoke">Target delivery</span>
        <input
          value={delivery}
          onChange={(e) => setDelivery(e.target.value)}
          placeholder="e.g. Winter 2028"
          className="mt-2 w-full border border-seam bg-transparent px-4 py-3.5 font-sans text-sm text-bone outline-none placeholder:text-smoke/40 focus:border-stone"
        />
      </label>
      <Btn
        full
        className="mt-6"
        disabled={!name.trim() || !location.trim() || !delivery.trim()}
        onClick={async () => {
          const meta = { name: name.trim(), location: location.trim(), delivery: delivery.trim() };
          if (IS_LIVE) {
            try {
              const created = await createProjectLive(meta);
              dispatch({ type: "boot", slices: await loadTeam(created.id) });
            } catch (e) {
              alert(`Could not create the project: ${e.message ?? e}`);
              return;
            }
          } else {
            dispatch({ type: "createProject", meta: { id: `p${Date.now()}`, ...meta } });
          }
          nav("/team");
        }}
      >
        Create project
      </Btn>
      <p className="mt-4 font-sans text-xs leading-relaxed text-smoke">
        The project starts empty: import its programme, upload the contract, define units and
        invite owners from the console. Everything you publish stays inside this project only.
      </p>
    </Screen>
  );
}

/* ------------------------------------------------ Publish */
export function Publish() {
  const { state, dispatch } = useStore();
  const nav = useNavigate();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState(PHASES[2]);
  const [photo, setPhoto] = useState(PHOTO_LIBRARY[0]);
  const [preview, setPreview] = useState(false);

  const entry = {
    id: crypto.randomUUID(),
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    phase,
    photo,
    text: text.trim(),
  };

  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="Owners see this after Publish — not before" title="New update" />
      {!preview ? (
        <>
          <p className="type-eyebrow text-smoke">Photo</p>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-2">
            {PHOTO_LIBRARY.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPhoto(p)}
                className={`h-20 w-28 shrink-0 border-2 ${photo === p ? "border-pmcc" : "border-seam"}`}
              >
                <img src={p} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <p className="mt-1 font-sans text-[0.65rem] text-smoke">Demo library — the live console takes site photos from the camera roll.</p>

          <p className="type-eyebrow mt-6 text-smoke">Phase</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PHASES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPhase(p)}
                className={`border px-3 py-1.5 font-sans text-xs transition-colors ${phase === p ? "border-stone text-bone" : "border-seam text-smoke"}`}
              >
                {p}
              </button>
            ))}
          </div>

          <p className="type-eyebrow mt-6 text-smoke">What happened</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Level 1 slab poured Thursday at first light — 74 m³…"
            className="mt-2 w-full border border-seam bg-transparent px-4 py-3 font-sans text-sm text-bone outline-none placeholder:text-smoke/40 focus:border-stone"
          />
          <Btn full className="mt-4" disabled={!text.trim()} onClick={() => setPreview(true)}>
            Preview as the owner sees it
          </Btn>
        </>
      ) : (
        <>
          <Card>
            <img src={entry.photo} alt="" className="aspect-[16/10] w-full object-cover" />
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="type-eyebrow text-stone">{entry.date}</p>
                <Stamp tone="stone">{entry.phase}</Stamp>
              </div>
              <p className="mt-2.5 font-sans text-sm leading-relaxed text-bone/90">{entry.text}</p>
            </div>
          </Card>
          <div className="mt-5 flex gap-3">
            <Btn
              full
              onClick={() => {
                dispatch({ type: "publish", entry });
                nav("/team");
              }}
            >
              Publish to owners
            </Btn>
            <Btn tone="ghost" onClick={() => setPreview(false)}>
              Edit
            </Btn>
          </div>
          <p className="mt-4 font-sans text-xs leading-relaxed text-smoke">
            Publishing timestamps the entry into the project record. Owners are notified; the entry
            cannot be silently deleted.
          </p>
        </>
      )}
    </Screen>
  );
}

/* ------------------------------------------------ Plan editor */
export function PlanEditor() {
  const { state, dispatch } = useStore();
  const [adding, setAdding] = useState(null);
  const [text, setText] = useState("");
  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="Tap a task to cycle done → planned → waiting" title="Look-ahead" />
      {state.lookahead.weeks.map((w, wi) => (
        <Card key={w.label} className="mb-4 p-5">
          <div className="flex items-baseline justify-between">
            <p className="type-display text-xl text-bone">{w.label}</p>
            <p className="font-sans text-xs tabular-nums text-smoke">{w.range}</p>
          </div>
          <ul className="mt-4 space-y-1">
            {w.items.map((it, ii) => (
              <li key={`${it.t}-${ii}`}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "tick", week: wi, item: ii })}
                  className="flex w-full items-start gap-3 border-t border-seam py-2.5 text-left first:border-t-0"
                >
                  <StateDot s={it.s} />
                  <span className={`font-sans text-sm ${it.s === "done" ? "text-smoke line-through" : "text-bone/90"}`}>
                    {it.t}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {adding === wi ? (
            <div className="mt-2 flex gap-2">
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && text.trim()) {
                    dispatch({ type: "addActivity", week: wi, text: text.trim() });
                    setText("");
                    setAdding(null);
                  }
                }}
                placeholder="New activity…"
                className="min-w-0 flex-1 border border-seam bg-transparent px-3 py-2 font-sans text-sm text-bone outline-none focus:border-stone"
              />
              <Btn
                tone="ghost"
                onClick={() => {
                  if (text.trim()) dispatch({ type: "addActivity", week: wi, text: text.trim() });
                  setText("");
                  setAdding(null);
                }}
              >
                Add
              </Btn>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(wi)}
              className="mt-2 inline-flex items-center gap-2 font-sans text-xs text-stone"
            >
              <Icon.plus className="h-3.5 w-3.5" /> Add activity
            </button>
          )}
        </Card>
      ))}
      <p className="px-1 pb-4 font-sans text-xs text-smoke">
        Owners see this plan live. In the wired version it is seeded from the imported programme.
      </p>
    </Screen>
  );
}

/* ------------------------------------------------ Money */
export function MoneyDesk() {
  const { state, dispatch } = useStore();
  const paid = state.payments.filter((p) => p.state === "paid").reduce((s, p) => s + p.amount, 0);
  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="Rami K. — The Roof Residence" title="Payments desk" />
      <Card className="p-5">
        <p className="font-sans text-xs text-smoke">
          Collected <span className="tabular-nums text-bone">{usd(paid)}</span> of{" "}
          <span className="tabular-nums text-bone">{usd(state.owner.price)}</span>
        </p>
        <div className="mt-2 h-1 bg-seam">
          <div className="h-full bg-pmcc" style={{ width: `${(paid / state.owner.price) * 100}%` }} />
        </div>
      </Card>
      <div className="mt-4">
        {state.payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 border-b border-seam py-4">
            <div className="min-w-0">
              <p className="truncate font-sans text-sm font-semibold text-bone">{p.name}</p>
              <p className="font-sans text-xs text-smoke">
                {p.link} · {usd(p.amount)}
              </p>
            </div>
            {p.state === "paid" ? (
              <Stamp tone="stone">paid {p.date}</Stamp>
            ) : (
              <Btn tone="ghost" onClick={() => dispatch({ type: "pay", id: p.id })}>
                Mark paid
              </Btn>
            )}
          </div>
        ))}
      </div>
      <p className="mt-5 pb-4 font-sans text-xs leading-relaxed text-smoke">
        Marking paid attaches today's date and a receipt slot, and updates the owner's Money tab
        instantly.
      </p>
    </Screen>
  );
}

/* ------------------------------------------------ Inbox */
export function InboxDesk() {
  const { state, dispatch } = useStore();
  const [drafts, setDrafts] = useState({});
  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="Questions & chatbot escalations" title="Inbox" />
      {state.questions.map((q) => (
        <Card key={q.id} className="mb-4 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-sans text-xs font-semibold text-stone">{q.from}</p>
            <p className="font-sans text-xs text-smoke">{q.asked}</p>
          </div>
          <p className="mt-2 font-sans text-sm leading-relaxed text-bone">{q.q}</p>
          {q.a ? (
            <div className="mt-3 border-l-2 border-stone pl-4">
              <p className="font-sans text-sm text-bone/80">{q.a}</p>
              <p className="mt-1 font-sans text-xs text-smoke">Answered {q.answered}</p>
            </div>
          ) : (
            <div className="mt-3">
              <textarea
                rows={2}
                value={drafts[q.id] ?? ""}
                onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })}
                placeholder="Write the answer…"
                className="w-full border border-seam bg-transparent px-3 py-2 font-sans text-sm text-bone outline-none focus:border-stone"
              />
              <Btn
                className="mt-2"
                disabled={!(drafts[q.id] ?? "").trim()}
                onClick={() => dispatch({ type: "answer", id: q.id, text: drafts[q.id].trim() })}
              >
                Send answer
              </Btn>
            </div>
          )}
        </Card>
      ))}
    </Screen>
  );
}

/* ------------------------------------------------ Risks desk */
export function RisksDesk() {
  const { state, dispatch } = useStore();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="Owners see shared risks immediately" title="Risks & notices" />
      <Card className="p-5">
        <p className="type-eyebrow text-smoke">Share a new notice</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title — e.g. Aggregate delivery slippage"
          className="mt-3 w-full border border-seam bg-transparent px-3 py-2.5 font-sans text-sm text-bone outline-none focus:border-stone"
        />
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What, the impact, and the mitigation — plainly."
          className="mt-2 w-full border border-seam bg-transparent px-3 py-2.5 font-sans text-sm text-bone outline-none focus:border-stone"
        />
        <Btn
          className="mt-3"
          disabled={!title.trim() || !body.trim()}
          onClick={() => {
            dispatch({
              type: "shareRisk",
              risk: { id: crypto.randomUUID(), title: title.trim(), body: body.trim(), status: "watching", shared: "Today" },
            });
            setTitle("");
            setBody("");
          }}
        >
          Share with owners
        </Btn>
      </Card>
      <div className="mt-5">
        {state.risks.map((r) => (
          <div key={r.id} className="border-b border-seam py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-sans text-sm font-semibold text-bone">{r.title}</p>
              {r.status === "closed" ? (
                <Stamp tone="stone">closed</Stamp>
              ) : (
                <Btn tone="ghost" onClick={() => dispatch({ type: "closeRisk", id: r.id })}>
                  Close
                </Btn>
              )}
            </div>
            <p className="mt-1 font-sans text-xs text-smoke">Shared {r.shared}</p>
          </div>
        ))}
      </div>
    </Screen>
  );
}

/* ------------------------------------------------ Owners */
export function OwnersDesk() {
  const { state } = useStore();
  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="Access, activity, read receipts" title="Owners & units" />
      {state.team.owners.map((o) => (
        <Card key={o.unit} className="mb-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-sans text-sm font-semibold text-bone">{o.unit}</p>
              <p className="mt-0.5 font-sans text-xs text-smoke">{o.name}</p>
            </div>
            {o.state === "active" ? <Stamp tone="stone">active</Stamp> : <Stamp tone="smoke">available</Stamp>}
          </div>
          {o.lastSeen && (
            <p className="mt-3 border-t border-seam pt-3 font-sans text-xs leading-relaxed text-smoke">
              Last opened: <span className="text-bone">{o.lastSeen}</span>
              <br />
              {o.opened}
            </p>
          )}
          {o.state !== "active" && (
            <Btn tone="ghost" className="mt-3" onClick={() => {}}>
              <Icon.plus className="h-4 w-4" /> Invite owner on contract
            </Btn>
          )}
        </Card>
      ))}
      <p className="px-1 pb-4 font-sans text-xs leading-relaxed text-smoke">
        "Owner viewed the update on this date" is quiet legal gold — the record shows what was
        communicated, and when it was seen.
      </p>
    </Screen>
  );
}

/* ------------------------------------------------ Project & programme */
export function ProjectDesk() {
  const { state } = useStore();
  const [imported, setImported] = useState(false);
  return (
    <Screen>
      <Back to="/team" label="Console" />
      <TopBar eyebrow="The source of the milestones" title="Project & programme" />
      <Card className="p-5">
        <p className="type-eyebrow text-smoke">Project</p>
        <p className="type-display mt-1 text-2xl text-bone">{state.project.name}</p>
        <p className="mt-1 font-sans text-xs text-smoke">
          {state.project.location} · Delivery {state.project.delivery}
        </p>
      </Card>

      <Card className="mt-4 p-5">
        <p className="type-eyebrow text-smoke">Contract upload</p>
        <p className="mt-2 font-sans text-sm leading-relaxed text-bone/85">
          Upload the signed contract — its clauses are indexed into the chat brain, so the owner's
          "Ask PMCC" answers contract questions from the document itself, never from memory.
        </p>
        <label className="mt-4 block cursor-pointer border border-dashed border-seam p-4 text-center transition-colors active:border-stone">
          <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.value && null} />
          <p className="font-sans text-xs text-smoke">Tap to choose the contract PDF</p>
        </label>
        <p className="mt-3 border-l-2 border-stone pl-3 font-sans text-xs leading-relaxed text-smoke">
          Demo: Rami's contract is already indexed — try asking the owner chatbot "what does my
          contract say about late delivery?"
        </p>
      </Card>

      <Card className="mt-4 p-5">
        <p className="type-eyebrow text-smoke">Programme import</p>
        <p className="mt-2 font-sans text-sm leading-relaxed text-bone/85">
          Upload the MS Project (XML) or Primavera P6 (XER) file — milestones, phase progress and
          the three-week look-ahead are derived automatically.
        </p>
        <label className="mt-4 block cursor-pointer border border-dashed border-seam p-5 text-center transition-colors active:border-stone">
          <input
            type="file"
            accept=".xml,.xer,.mpp"
            className="hidden"
            onChange={() => setImported(true)}
          />
          <Icon.doc className="mx-auto h-6 w-6 text-stone" />
          <p className="mt-2 font-sans text-xs text-smoke">Tap to choose the programme file</p>
        </label>
        {imported && (
          <p className="mt-3 border-l-2 border-stone pl-3 font-sans text-xs leading-relaxed text-bone/85">
            Programme parsed (demo): 214 activities · critical path 96 · structure top-out Nov 12,
            2026 · look-ahead refreshed. The live version runs PMCC's own XER/MSPDI parser.
          </p>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <p className="type-eyebrow text-smoke">Milestones</p>
        <ul className="mt-3">
          {state.project.milestones.map((m) => (
            <li key={m.name} className="flex items-center gap-3 border-t border-seam py-2.5 first:border-t-0">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center border ${m.done ? "border-stone text-stone" : "border-seam text-smoke/40"}`}>
                {m.done && <Icon.check className="h-3 w-3" />}
              </span>
              <span className={`flex-1 font-sans text-sm ${m.done ? "text-bone/80" : m.next ? "text-bone" : "text-smoke"}`}>
                {m.name}
              </span>
              <span className="font-sans text-xs tabular-nums text-smoke">{m.date}</span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-4 px-1 pb-4 font-sans text-xs text-smoke">
        New project, blocks, units and owner invitations live here in the wired version.
      </p>
    </Screen>
  );
}
