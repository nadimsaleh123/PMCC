/**
 * React unmounts the entire tree when a render throws. With nothing to catch
 * it, the app becomes a black screen: no message, no route, no way for the
 * person holding the phone to tell you what happened. That is the worst
 * failure this app can have, because it is the only one that produces no
 * evidence at all.
 *
 * This catches it and shows what broke, with a way out that does not require
 * clearing site data by hand.
 */
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("[app-crash]", error, info?.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const detail = [
      String(error?.stack ?? error),
      info?.componentStack ? `\nComponent stack:${info.componentStack}` : "",
    ].join("");

    return (
      <div className="min-h-[100svh] bg-ink px-6 py-10 text-bone">
        <p className="type-eyebrow text-pmcc">Something broke on this screen</p>
        <p className="type-display mt-2 text-2xl">The app stopped rather than show you something wrong.</p>
        <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-smoke">
          Nothing has been lost. The record lives on the server, not in this
          page. Send the text below and it can be fixed.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="border border-seam px-4 py-2 font-sans text-xs uppercase tracking-wideish text-bone"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => {
              // The commonest cause of a screen that crashes every time is a
              // stale local preference pointing at something that no longer
              // exists. Clearing it is safe: none of it is the record.
              try {
                localStorage.clear();
                sessionStorage.clear();
              } catch {
                /* private browsing — nothing to clear */
              }
              window.location.replace("/app/signin");
            }}
            className="border border-seam px-4 py-2 font-sans text-xs uppercase tracking-wideish text-bone"
          >
            Reset this device and sign in again
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(detail)}
            className="border border-seam px-4 py-2 font-sans text-xs uppercase tracking-wideish text-smoke"
          >
            Copy the details
          </button>
        </div>

        <pre className="mt-6 max-h-[45vh] overflow-auto whitespace-pre-wrap break-words border border-seam bg-coal p-4 font-mono text-[0.7rem] leading-relaxed text-smoke">
          {detail}
        </pre>
      </div>
    );
  }
}
