import { Navigate, Route, Routes, useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useStore } from "./store";
import { TabBar, Icon, Mark, Btn } from "./ui";
import { IS_LIVE, sb } from "./lib/supabase";
import { loadOwner, loadTeam } from "./live/load";
import { touchPresence } from "./live/sync";
import SignIn from "./screens/SignIn";
import { Home, Diary, Plan, Money, More } from "./screens/owner/Tabs";
import { Risks, Selections, Variations, Visits, Documents, Questions } from "./screens/owner/Sub";
import Ask from "./screens/owner/Ask";
import { Today, Publish, PlanEditor, MoneyDesk, InboxDesk, RisksDesk, OwnersDesk, ProjectDesk, NewProject, LogDesk } from "./screens/team/Console";
import Copilot from "./screens/team/Copilot";
import Report from "./screens/team/Report";
import Brief from "./screens/team/Brief";

const ROLES = ["team", "owner"];

function Guard({ role, children }) {
  const { state } = useStore();
  if (!state.session) return <Navigate to="/signin" replace />;
  const mine = state.session.role;
  // A role that is neither team nor owner has no home to be sent to, and
  // the old line sent it to the very owner route it had just been refused
  // from. That is an infinite redirect, and React Router answers it by
  // tearing down the tree — a black screen with no message, which is the
  // one failure that leaves nobody anything to report. Boot refuses such a
  // session before it gets here; this is the second line of defence.
  if (!ROLES.includes(mine)) return <Navigate to="/signin" replace />;
  if (role && mine !== role) return <Navigate to={mine === "team" ? "/team" : "/"} replace />;
  return children;
}

const OWNER_TABS = [
  { to: "/", label: "Home", icon: Icon.home, end: true },
  { to: "/diary", label: "Diary", icon: Icon.diary },
  { to: "/plan", label: "Plan", icon: Icon.plan },
  { to: "/money", label: "Money", icon: Icon.money },
  { to: "/more", label: "More", icon: Icon.more },
];

const TEAM_TABS = [
  { to: "/team", label: "Today", icon: Icon.home, end: true },
  { to: "/team/publish", label: "Publish", icon: Icon.camera },
  { to: "/team/copilot", label: "Copilot", icon: Icon.chat },
  { to: "/team/plan", label: "Plan", icon: Icon.plan },
  { to: "/team/inbox", label: "Inbox", icon: Icon.inbox },
];

/** Full-screen states used only while live mode establishes itself. */
function Splash({ children }) {
  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center gap-6 px-8 text-center">
      <Mark className="h-12 w-12 text-xl" />
      {children}
    </div>
  );
}

export default function App() {
  const { state, dispatch } = useStore();
  const { pathname } = useLocation();
  const role = state.session?.role;
  const isTeam = pathname.startsWith("/team");
  const onAsk = pathname === "/ask";
  // live: checking → ready | anon | noaccess
  const [live, setLive] = useState(IS_LIVE ? "checking" : "off");
  const [bootError, setBootError] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!IS_LIVE) return undefined;
    // supabase-js re-fires SIGNED_IN on every token refresh and on tab
    // focus. Booting again there threw away whatever the console was
    // pointed at mid-task. Boot once per signed-in user, no more.
    let bootedFor = null;
    const boot = async (session) => {
      if (!session) {
        dispatch({ type: "signout" });
        setLive("anon");
        return;
      }
      try {
        const { data: profile } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
        if (!profile) {
          setLive("noaccess");
          return;
        }
        // Refuse an unroutable session at the door. Everything downstream
        // assumes the role is one of two values, and a profile row whose
        // role is null or misspelled satisfies neither.
        if (!ROLES.includes(profile.role)) {
          setBootError(
            `This account's profile has role ${JSON.stringify(profile.role)}. It must be "team" or "owner".`,
          );
          setLive("broken");
          return;
        }
        const slices = profile.role === "team" ? await loadTeam() : await loadOwner(profile);
        dispatch({ type: "boot", slices });
        dispatch({ type: "signin", session: { role: profile.role, name: profile.full_name } });
        touchPresence();
        setLive("ready");
      } catch (e) {
        // "No residence is linked to this email" is true for a missing unit
        // and a lie for anything else. Saying it over a crash sends the
        // person chasing their contract instead of reporting the fault.
        console.error("[live-boot]", e);
        bootedFor = null; // a failed boot must be retryable
        if (String(e?.message) === "no-unit") setLive("noaccess");
        else {
          setBootError(String(e?.message ?? e));
          setLive("broken");
        }
      }
    };
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        if (session?.user?.id && bootedFor === session.user.id) return;
        bootedFor = session?.user?.id ?? null;
        boot(session);
      }
      if (event === "SIGNED_OUT") {
        bootedFor = null;
        dispatch({ type: "signout" });
        setLive("anon");
      }
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (live === "checking")
    return (
      <Splash>
        <p className="type-eyebrow text-smoke">Opening your record…</p>
      </Splash>
    );
  if (live === "broken")
    return (
      <Splash>
        <p className="type-display text-2xl text-bone">This did not load.</p>
        <p className="max-w-xs font-sans text-sm leading-relaxed text-smoke">
          Your sign-in worked. Reading your project did not, and the app would
          rather say so than show you a half-empty screen. Nothing is lost.
        </p>
        <p className="max-w-xs break-words font-mono text-[0.7rem] leading-relaxed text-pmcc">{bootError}</p>
        <Btn tone="ghost" onClick={() => window.location.reload()}>Try again</Btn>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.clear();
            } catch {
              /* private browsing */
            }
            window.location.reload();
          }}
          className="font-sans text-xs text-smoke underline underline-offset-4"
        >
          Reset this device and try again
        </button>
      </Splash>
    );
  if (live === "noaccess")
    return (
      <Splash>
        <p className="type-display text-2xl text-bone">This portal is by contract.</p>
        <p className="max-w-xs font-sans text-sm leading-relaxed text-smoke">
          Your sign-in worked, but no residence is linked to this email yet. If you hold a contract
          with PMCC, contact us and we'll connect your account.
        </p>
        <Btn tone="ghost" onClick={() => sb.auth.signOut()}>Use a different email</Btn>
      </Splash>
    );

  return (
    <>
      <div className="grain" />
      <Routes>
        {/* Only bounce a signed-in visitor onward if there is somewhere to
            bounce them TO. A session whose role is neither team nor owner is
            refused by every Guard, so sending it on from here is half of an
            infinite redirect — and an infinite redirect is the black screen. */}
        <Route
          path="/signin"
          element={
            state.session && ROLES.includes(role) ? (
              <Navigate to={role === "team" ? "/team" : "/"} replace />
            ) : (
              <SignIn />
            )
          }
        />

        <Route path="/" element={<Guard role="owner"><Home /></Guard>} />
        <Route path="/diary" element={<Guard role="owner"><Diary /></Guard>} />
        <Route path="/plan" element={<Guard role="owner"><Plan /></Guard>} />
        <Route path="/money" element={<Guard role="owner"><Money /></Guard>} />
        <Route path="/more" element={<Guard role="owner"><More /></Guard>} />
        <Route path="/risks" element={<Guard role="owner"><Risks /></Guard>} />
        <Route path="/selections" element={<Guard role="owner"><Selections /></Guard>} />
        <Route path="/variations" element={<Guard role="owner"><Variations /></Guard>} />
        <Route path="/visits" element={<Guard role="owner"><Visits /></Guard>} />
        <Route path="/documents" element={<Guard role="owner"><Documents /></Guard>} />
        <Route path="/questions" element={<Guard role="owner"><Questions /></Guard>} />
        <Route path="/ask" element={<Guard role="owner"><Ask /></Guard>} />

        <Route path="/team" element={<Guard role="team"><Today /></Guard>} />
        <Route path="/team/publish" element={<Guard role="team"><Publish /></Guard>} />
        <Route path="/team/plan" element={<Guard role="team"><PlanEditor /></Guard>} />
        <Route path="/team/money" element={<Guard role="team"><MoneyDesk /></Guard>} />
        <Route path="/team/inbox" element={<Guard role="team"><InboxDesk /></Guard>} />
        <Route path="/team/risks" element={<Guard role="team"><RisksDesk /></Guard>} />
        <Route path="/team/owners" element={<Guard role="team"><OwnersDesk /></Guard>} />
        <Route path="/team/project" element={<Guard role="team"><ProjectDesk /></Guard>} />
        <Route path="/team/copilot" element={<Guard role="team"><Copilot /></Guard>} />
        <Route path="/team/new" element={<Guard role="team"><NewProject /></Guard>} />
        <Route path="/team/log" element={<Guard role="team"><LogDesk /></Guard>} />
        <Route path="/team/report" element={<Guard role="team"><Report /></Guard>} />
        <Route path="/team/brief" element={<Guard role="team"><Brief /></Guard>} />

        <Route path="*" element={<Navigate to={state.session ? (role === "team" ? "/team" : "/") : "/signin"} replace />} />
      </Routes>

      {state.session && role === "owner" && !onAsk && (
        <Link
          to="/ask"
          aria-label="Ask PMCC"
          className="fixed bottom-24 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-pmcc text-bone shadow-xl shadow-black/50 transition-transform active:scale-95"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <Icon.chat className="h-6 w-6" />
        </Link>
      )}
      {state.session && (role === "team" ? isTeam : true) && !onAsk && pathname !== "/signin" && (
        <TabBar tabs={role === "team" ? TEAM_TABS : OWNER_TABS} />
      )}
    </>
  );
}
