import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/inter";
// full.css carries every Fraunces axis (opsz, SOFT, WONK) — the wght-only
// files silently ignore the display cut's font-variation-settings.
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "./index.css";
import App from "./App.jsx";

// No StrictMode: its dev-only double-mount duplicates every ScrollTrigger and
// pin-spacer, which makes scroll development lie to you. The animation layer
// cleans up properly via gsap.context throughout.
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
