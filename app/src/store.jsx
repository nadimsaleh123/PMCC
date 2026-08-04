/**
 * One store for the whole demo: seed data + every interaction the user makes
 * (publish, tick, approve, choose, book, chat), persisted to localStorage so
 * the app remembers across reloads — it must feel like software, not a mock.
 */
import { createContext, useContext, useEffect, useReducer } from "react";
import { seed } from "./data/seed";

const KEY = "pmcc-app-v1";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Seed evolves between deploys; saved interactions ride on top of it.
      return { ...structuredClone(seed), ...saved, session: saved.session ?? null };
    }
  } catch {
    /* corrupted or unavailable storage: fall through to a clean seed */
  }
  return {
    ...structuredClone(seed),
    session: null,
    chat: [],
    copilot: [],
    activeProjectId: "d563",
    projectsMeta: [{ id: "d563", name: "Daher el Souane 563" }],
    vault: {},
  };
}

/** The slice of state that belongs to one project (the rest is Rami's). */
const PROJECT_FIELDS = ["project", "diary", "lookahead", "risks", "questions", "team"];

function stash(state) {
  const slice = {};
  for (const f of PROJECT_FIELDS) slice[f] = state[f];
  return { ...(state.vault ?? {}), [state.activeProjectId ?? "d563"]: slice };
}

/** A believable empty shell for a freshly created project. */
function shellFor(meta) {
  return {
    project: {
      name: meta.name,
      short: meta.name,
      location: meta.location,
      delivery: meta.delivery,
      hero: "/im/hero-reveal-1280.webp",
      overall: 0,
      phases: [
        { name: "Permits", pct: 0 },
        { name: "Earthworks", pct: 0 },
        { name: "Structure", pct: 0 },
        { name: "Envelope", pct: 0 },
        { name: "Finishes", pct: 0 },
        { name: "Handover", pct: 0 },
      ],
      milestones: [
        { name: "Construction permit", date: "—", done: false, next: true },
        { name: "Handover", date: meta.delivery, done: false },
      ],
    },
    diary: [],
    lookahead: {
      updated: "not yet",
      weeks: [
        { label: "This week", range: "—", items: [] },
        { label: "Next week", range: "—", items: [] },
        { label: "Week after", range: "—", items: [] },
      ],
    },
    risks: [],
    questions: [],
    team: { members: [], owners: [] },
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "signin": {
      let s = state;
      // The owner demo lives in Daher 563 — if the team left the console on
      // another project, bring the flat slice home before Rami sees it.
      if (action.session.role === "owner" && (state.activeProjectId ?? "d563") !== "d563") {
        const vault = stash(state);
        s = { ...state, ...vault.d563, vault, activeProjectId: "d563" };
      }
      return { ...s, session: action.session };
    }
    case "switchProject": {
      if (action.id === (state.activeProjectId ?? "d563")) return state;
      const vault = stash(state);
      const slice = vault[action.id];
      if (!slice) return state;
      return { ...state, ...slice, vault, activeProjectId: action.id };
    }
    case "createProject": {
      const vault = stash(state);
      const shell = shellFor(action.meta);
      return {
        ...state,
        ...shell,
        vault,
        activeProjectId: action.meta.id,
        projectsMeta: [...(state.projectsMeta ?? DEFAULT_META), { id: action.meta.id, name: action.meta.name }],
      };
    }
    case "setActivity": {
      const weeks = state.lookahead.weeks.map((w, wi) =>
        wi !== action.week
          ? w
          : {
              ...w,
              items: w.items.map((it, ii) =>
                ii !== action.item ? it : { ...it, s: action.s, note: action.note ?? it.note },
              ),
            },
      );
      return { ...state, lookahead: { ...state.lookahead, weeks } };
    }
    case "signout":
      return { ...state, session: null };
    case "publish":
      return { ...state, diary: [action.entry, ...state.diary] };
    case "tick": {
      const weeks = state.lookahead.weeks.map((w, wi) =>
        wi !== action.week
          ? w
          : {
              ...w,
              items: w.items.map((it, ii) =>
                ii !== action.item
                  ? it
                  : { ...it, s: it.s === "done" ? "ready" : it.s === "ready" ? "blocked" : "done" },
              ),
            },
      );
      return { ...state, lookahead: { ...state.lookahead, weeks } };
    }
    case "addActivity": {
      const weeks = state.lookahead.weeks.map((w, wi) =>
        wi !== action.week ? w : { ...w, items: [...w.items, { t: action.text, s: "ready" }] },
      );
      return { ...state, lookahead: { ...state.lookahead, weeks } };
    }
    case "choose":
      return {
        ...state,
        selections: state.selections.map((s) =>
          s.id !== action.id
            ? s
            : {
                ...s,
                state: "decided",
                chosen: action.option,
                chosenName: action.name,
                decidedOn: "Today",
              },
        ),
      };
    case "variation":
      return {
        ...state,
        variations: state.variations.map((v) =>
          v.id !== action.id
            ? v
            : { ...v, state: action.state, approvedOn: action.state === "approved" ? "Today" : v.approvedOn },
        ),
      };
    case "book":
      return {
        ...state,
        visits: {
          booked: { ...action.slot, note: "Hard hat and site boots provided at the gate." },
          slots: state.visits.slots.filter((s) => s.id !== action.slot.id),
        },
      };
    case "pay":
      return {
        ...state,
        payments: state.payments.map((p) =>
          p.id !== action.id ? p : { ...p, state: "paid", date: "Today", receipt: true },
        ),
      };
    case "shareRisk":
      return { ...state, risks: [action.risk, ...state.risks] };
    case "closeRisk":
      return {
        ...state,
        risks: state.risks.map((r) => (r.id !== action.id ? r : { ...r, status: "closed" })),
      };
    case "ask":
      return {
        ...state,
        questions: [action.question, ...state.questions],
      };
    case "answer":
      return {
        ...state,
        questions: state.questions.map((q) =>
          q.id !== action.id ? q : { ...q, a: action.text, answered: "Today" },
        ),
      };
    case "chat":
      return { ...state, chat: [...(state.chat ?? []), ...action.messages] };
    case "copilot":
      return { ...state, copilot: [...(state.copilot ?? []), ...action.messages] };
    case "copilotReplace":
      return { ...state, copilot: action.feed };
    case "reset":
      return { ...structuredClone(seed), session: state.session, chat: [] };
    default:
      return state;
  }
}

const DEFAULT_META = [{ id: "d563", name: "Daher el Souane 563" }];

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* private mode: the session just won't persist */
    }
  }, [state]);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  return useContext(Ctx);
}

/** USD, no cents — construction money. */
export const usd = (n) => `$${n.toLocaleString("en-US")}`;
