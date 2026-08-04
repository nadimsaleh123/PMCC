import { Navigate, Route, Routes, useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useStore } from "./store";
import { TabBar, Icon } from "./ui";
import SignIn from "./screens/SignIn";
import { Home, Diary, Plan, Money, More } from "./screens/owner/Tabs";
import { Risks, Selections, Variations, Visits, Documents, Questions } from "./screens/owner/Sub";
import Ask from "./screens/owner/Ask";
import { Today, Publish, PlanEditor, MoneyDesk, InboxDesk, RisksDesk, OwnersDesk, ProjectDesk, NewProject } from "./screens/team/Console";
import Copilot from "./screens/team/Copilot";

function Guard({ role, children }) {
  const { state } = useStore();
  if (!state.session) return <Navigate to="/signin" replace />;
  if (role && state.session.role !== role)
    return <Navigate to={state.session.role === "team" ? "/team" : "/"} replace />;
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

export default function App() {
  const { state } = useStore();
  const { pathname } = useLocation();
  const role = state.session?.role;
  const isTeam = pathname.startsWith("/team");
  const onAsk = pathname === "/ask";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <div className="grain" />
      <Routes>
        <Route path="/signin" element={state.session ? <Navigate to={role === "team" ? "/team" : "/"} replace /> : <SignIn />} />

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
