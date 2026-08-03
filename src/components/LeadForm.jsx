/**
 * The lead form: three fields, because every field beyond three costs
 * enquiries. Name, one way to reach them, and country — country because
 * knowing where buyers actually are is what decides where the ad money goes.
 *
 * Submissions go to info@pmcclb.com through FormSubmit's AJAX endpoint — a
 * static site has no server, and this keeps the enquiry in the inbox the
 * company already reads. The WhatsApp line beneath is not decoration: it is
 * the fallback if the service ever fails, and for half of Lebanon it is the
 * preferred channel anyway.
 *
 * NOTE: FormSubmit sends a one-time activation email to info@pmcclb.com on
 * the first real submission. Someone must click that link once; after that,
 * delivery is automatic.
 */
import { useState } from "react";
import { company, project } from "../data/content";
import { track } from "../lib/analytics";

const ENDPOINT = `https://formsubmit.co/ajax/${company.email}`;

/** Palette per background: the form sits on bone on the project page, ink in the footer. */
const TONES = {
  light: {
    label: "text-ink/60",
    input:
      "border-ink/25 bg-transparent text-ink placeholder:text-ink/35 focus:border-ink",
    button: "bg-pmcc text-bone hover:bg-pmcc/90",
    fine: "text-ink/55",
    link: "text-ink underline underline-offset-4 hover:text-pmcc",
    done: "border-ink/20 text-ink",
  },
  dark: {
    label: "text-smoke",
    input:
      "border-seam bg-transparent text-bone placeholder:text-smoke/60 focus:border-stone",
    button: "bg-pmcc text-bone hover:bg-pmcc/90",
    fine: "text-smoke",
    link: "text-bone underline underline-offset-4 hover:text-pmcc",
    done: "border-seam text-bone",
  },
};

export default function LeadForm({ tone = "light", source = "site", showWhatsApp = true }) {
  const t = TONES[tone];
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if (data._honey) return; // bot filled the invisible field
    setStatus("sending");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: data.name,
          "email or phone": data.contact,
          country: data.country,
          _subject: `Price list request — ${project.name} (${data.name})`,
          _template: "table",
          _captcha: "false",
        }),
      });
      if (!res.ok) throw new Error(`FormSubmit ${res.status}`);
      setStatus("sent");
      track("generate_lead", { source, country: data.country });
    } catch {
      setStatus("error");
    }
  }

  const wa = `https://wa.me/${company.whatsapp}?text=${encodeURIComponent(
    `Hello PMCC — please send me the price list and floor plans for ${project.name}.`,
  )}`;

  if (status === "sent") {
    return (
      <div className={`border px-6 py-8 text-center ${t.done}`}>
        <p className="type-display text-2xl">Received.</p>
        <p className={`mt-3 font-sans text-sm leading-relaxed ${t.fine}`}>
          The price list and floor plans are on their way to you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate={false}>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-left">
          <span className={`font-sans text-xs uppercase tracking-wideish ${t.label}`}>Name</span>
          <input
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Your name"
            className={`mt-2 w-full border px-4 py-3 font-sans text-sm outline-none transition-colors ${t.input}`}
          />
        </label>
        <label className="block text-left">
          <span className={`font-sans text-xs uppercase tracking-wideish ${t.label}`}>
            Email or phone
          </span>
          <input
            name="contact"
            type="text"
            required
            autoComplete="email"
            placeholder="How do we reach you?"
            className={`mt-2 w-full border px-4 py-3 font-sans text-sm outline-none transition-colors ${t.input}`}
          />
        </label>
        <label className="block text-left">
          <span className={`font-sans text-xs uppercase tracking-wideish ${t.label}`}>Country</span>
          <input
            name="country"
            type="text"
            required
            autoComplete="country-name"
            placeholder="Where are you based?"
            className={`mt-2 w-full border px-4 py-3 font-sans text-sm outline-none transition-colors ${t.input}`}
          />
        </label>
      </div>

      {/* Honeypot: invisible to people, irresistible to bots. */}
      <input
        type="text"
        name="_honey"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <div className="mt-6 flex flex-col items-center gap-4">
        <button
          type="submit"
          disabled={status === "sending"}
          className={`inline-flex items-center gap-3 px-8 py-4 font-sans text-sm font-semibold transition-colors disabled:opacity-60 ${t.button}`}
        >
          {status === "sending" ? "Sending…" : "Request the price list & floor plans"}
        </button>

        {status === "error" && (
          <p className="font-sans text-xs text-pmcc" role="alert">
            That didn&rsquo;t go through — message us on WhatsApp instead.
          </p>
        )}

        {showWhatsApp && (
          <p className={`font-sans text-xs ${t.fine}`}>
            Prefer to talk?{" "}
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className={t.link}
              onClick={() => track("whatsapp_click", { source: `${source}-form` })}
            >
              Message us on WhatsApp
            </a>
          </p>
        )}
      </div>
    </form>
  );
}
