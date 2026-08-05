import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "./index.css";
import { StoreProvider } from "./store";
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <BrowserRouter basename="/app">
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </ErrorBoundary>,
);
