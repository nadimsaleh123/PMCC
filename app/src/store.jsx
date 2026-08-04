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
  return { ...structuredClone(seed), session: null, chat: [] };
}

function reducer(state, action) {
  switch (action.type) {
    case "signin":
      return { ...state, session: action.session };
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
    case "reset":
      return { ...structuredClone(seed), session: state.session, chat: [] };
    default:
      return state;
  }
}

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
