/**
 * Live write-through: every approved interaction mirrors to Supabase.
 * The reducer stays the single source of UI truth; this module makes the
 * database agree with it. Failures are logged and surfaced once — the UI
 * never blocks on the network.
 */
import { sb, IS_LIVE } from "../lib/supabase";

let warned = false;
function fail(where, error) {
  console.error(`[live-sync] ${where}:`, error);
  if (!warned) {
    warned = true;
    alert("A change could not reach the server — check your connection. The app will keep working; retry the action.");
  }
}

const iso = () => new Date().toISOString().slice(0, 10);

/** Mirror one dispatched action to the database. Runs after the reducer. */
export function syncAction(action, nextState) {
  if (!IS_LIVE) return;
  const projectId = nextState.project?.id;
  const unitId = nextState.owner?.unitId;

  const run = async () => {
    switch (action.type) {
      case "publish":
        return sb.from("diary").insert({
          id: action.entry.id,
          project_id: projectId,
          phase: action.entry.phase,
          photo_url: action.entry.photo,
          body: action.entry.text,
          published: true,
        });
      case "tick":
      case "setActivity":
      case "addActivity":
        return sb.from("lookahead").upsert({
          project_id: projectId,
          weeks: nextState.lookahead.weeks,
          updated_at: new Date().toISOString(),
        });
      case "choose":
        return sb
          .from("selections")
          .update({ state: "decided", chosen: action.option, chosen_name: action.name, decided_on: iso() })
          .eq("id", action.id);
      case "variation":
        return sb
          .from("variations")
          .update({ state: action.state, approved_on: action.state === "approved" ? iso() : null })
          .eq("id", action.id);
      case "book":
        return sb.from("visits").update({ state: "booked", unit_id: unitId }).eq("id", action.slot.id);
      case "pay":
        return sb.from("payments").update({ state: "paid", paid_on: iso() }).eq("id", action.id);
      case "shareRisk":
        return sb.from("risks").insert({
          id: action.risk.id,
          project_id: projectId,
          title: action.risk.title,
          body: action.risk.body,
          status: action.risk.status,
        });
      case "closeRisk":
        return sb.from("risks").update({ status: "closed" }).eq("id", action.id);
      case "ask":
        return sb.from("questions").insert({ id: action.question.id, unit_id: unitId, q: action.question.q });
      case "answer":
        return sb.from("questions").update({ a: action.text, answered_on: iso() }).eq("id", action.id);
      case "log":
        return sb.from("project_log").insert({
          project_id: projectId,
          author: action.entry.author,
          kind: action.entry.kind,
          body: action.entry.body,
        });
      case "setOutlook":
        return sb.from("projects").update({ outlook: action.outlook }).eq("id", projectId);
      default:
        return null;
    }
  };

  Promise.resolve(run()).then((res) => {
    if (res?.error) fail(action.type, res.error);
  }).catch((e) => fail(action.type, e));
}

/**
 * Create a project server-side. Every project gets its residence (one unit —
 * the common villa case; more can be added later), and when the client's
 * name/email are given, their sign-in is pre-authorized and linked to that
 * unit — the client's first login lands them inside their project with
 * nothing else to do.
 */
export async function createProjectLive(meta) {
  const { data, error } = await sb
    .from("projects")
    .insert({ name: meta.name, location: meta.location, delivery: meta.delivery })
    .select("id, name")
    .single();
  if (error) throw error;
  await sb.from("lookahead").insert({
    project_id: data.id,
    weeks: [
      { label: "This week", range: "—", items: [] },
      { label: "Next week", range: "—", items: [] },
      { label: "Week after", range: "—", items: [] },
    ],
  });
  const unitName = "The Residence";
  const { data: unit, error: uErr } = await sb
    .from("units")
    .insert({ project_id: data.id, name: unitName, level: "", area: "", extras: meta.location })
    .select("id")
    .single();
  if (uErr) throw uErr;
  if (meta.ownerEmail) {
    const { error: pErr } = await sb.from("pre_approved").insert({
      email: meta.ownerEmail.trim().toLowerCase(),
      role: "owner",
      full_name: meta.ownerName?.trim() || "Owner",
      unit_name: unitName,
      unit_id: unit.id,
    });
    if (pErr) throw pErr;
  }
  return data;
}

/** The two Groq brains, via edge functions. */
export async function askLive(question) {
  const { data, error } = await sb.functions.invoke("ask", { body: { question } });
  if (error) throw error;
  return data; // {answer, escalated}
}

export async function copilotLive(report, projectId) {
  const { data, error } = await sb.functions.invoke("copilot", { body: { report, project_id: projectId } });
  if (error) throw error;
  return data.actions ?? [];
}

/** Presence: stamp the caller's last-seen, silently. */
export function touchPresence() {
  if (!IS_LIVE) return;
  sb.auth.getUser().then(({ data }) => {
    if (data?.user)
      sb.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", data.user.id).then(() => {});
  });
}
