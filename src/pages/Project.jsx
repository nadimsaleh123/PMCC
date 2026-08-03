import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { applySeo } from "../lib/seo";
import { gsap, reducedMotion } from "../lib/motion";
import { Lines, Fade } from "../components/reveal";
import Magnetic from "../components/Magnetic";
import WarpImage from "../components/WarpImage";
import FloorStack from "../components/project/FloorStack";
import BeforeAfter from "../components/project/BeforeAfter";
import Gallery from "../components/project/Gallery";
import LeadForm from "../components/LeadForm";
import ShareButton from "../components/ShareButton";
import { project, company } from "../data/content";
import { track } from "../lib/analytics";

function ProjectHero() {
  return (
    <section className="relative h-[100svh]">
      <WarpImage
        src="/im/hero-three-quarter-3200.webp"
        srcSet="/im/hero-three-quarter-1280.webp 1280w, /im/hero-three-quarter-2560.webp 2560w, /im/hero-three-quarter-3200.webp 3200w"
        alt={project.gallery[0].alt}
        className="h-full"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-ink/45" />
      <div className="absolute inset-x-0 bottom-0 px-5 pb-16 sm:px-8">
        <Fade delay={0.3}>
          <p className="type-eyebrow text-bone/90">{project.eyebrow}</p>
        </Fade>
        <Lines
          as="h1"
          trigger={false}
          delay={0.45}
          className="type-display mt-6 max-w-5xl text-[clamp(3rem,10vw,9rem)] text-bone"
        >
          {project.claim[0]}
          <br />
          <em className="type-display-it text-stone">{project.claim[1]}</em>
        </Lines>
        <Fade delay={0.9} className="mt-8 flex flex-wrap items-end justify-between gap-6">
          <p className="max-w-md font-sans text-sm leading-relaxed text-bone/80">{project.sub}</p>
          <p className="type-eyebrow text-smoke" aria-hidden="true">Scroll ↓</p>
        </Fade>
      </div>
    </section>
  );
}

function FactsStrip() {
  return (
    <section className="border-y border-seam bg-ink px-5 py-14 sm:px-8">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 lg:grid-cols-4">
        {project.facts.map((f) => (
          <Fade key={f.label}>
            <p className="type-display text-5xl text-bone">{f.value}</p>
            <p className="mt-3 max-w-[15rem] font-sans text-xs leading-relaxed text-smoke">{f.label}</p>
          </Fade>
        ))}
      </div>
    </section>
  );
}

/**
 * The real photograph from the site, full bleed, with the altitude counting
 * itself up as the section scrolls in. Renders sell the building; this photo
 * sells the reason the building is here.
 */
function TheView() {
  const root = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      const el = root.current.querySelector("[data-altitude]");
      gsap.fromTo(
        el,
        { textContent: 0 },
        {
          textContent: Number(project.location.altitude),
          duration: 2,
          ease: "power2.out",
          snap: { textContent: 1 },
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        },
      );
    }, root.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="relative">
      <div className="relative h-[92svh] overflow-clip">
        <WarpImage
          src="/im/view-ridge-2444.webp"
          srcSet="/im/view-ridge-1280.webp 1280w, /im/view-ridge-2444.webp 2444w"
          alt="The view from the site — the Metn valley and the mountains beyond, photographed at Daher el Souane"
          className="h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-ink/30" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-14 sm:px-8">
          <p className="type-eyebrow text-bone/90">The view · photographed on site</p>
          <p className="type-display mt-4 text-[clamp(3.4rem,11vw,9rem)] leading-none text-bone">
            <span data-altitude>{project.location.altitude}</span>
            <span className="text-stone"> m</span>
          </p>
          <p className="mt-4 max-w-md font-sans text-sm leading-relaxed text-bone/85">
            above the sea. The valley below, the mountains across — and Beirut twenty
            minutes down the hill.
          </p>
        </div>
      </div>
    </section>
  );
}

/** The general specification, verbatim from the project book. */
function TheStandard() {
  const groups = [
    { title: "The residence", items: project.specs.residence },
    { title: "The domain", items: project.specs.domain },
  ];
  return (
    <section className="border-t border-seam bg-coal px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="type-eyebrow text-smoke">The standard</p>
        <Lines className="type-display mt-6 max-w-4xl text-[clamp(1.9rem,4.2vw,3.4rem)] text-bone">
          Specified like a private house,{" "}
          <em className="type-display-it text-stone">secured like a gated estate.</em>
        </Lines>
        <div className="mt-14 grid gap-14 lg:grid-cols-2">
          {groups.map((g) => (
            <Fade key={g.title}>
              <p className="font-sans text-xs font-semibold uppercase tracking-wideish text-stone">
                {g.title}
              </p>
              <ul className="mt-6 space-y-3">
                {g.items.map((item) => (
                  <li key={item} className="flex items-baseline gap-3 border-t border-seam pt-3 font-sans text-sm leading-relaxed text-bone/85">
                    <span aria-hidden className="inline-block h-[3px] w-[14px] shrink-0 translate-y-[-3px] bg-pmcc" />
                    {item}
                  </li>
                ))}
              </ul>
            </Fade>
          ))}
        </div>
      </div>
    </section>
  );
}

function Narrative() {
  return (
    <section className="bg-bone px-5 py-28 text-ink sm:px-8 sm:py-36">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="type-eyebrow text-ink/65">The place</p>
          <Lines className="type-display mt-8 text-[clamp(1.9rem,4vw,3.4rem)]">
            A village above the coast,
            <br />
            <em className="type-display-it">a building that steps with the hill.</em>
          </Lines>
          <div className="mt-10 max-w-xl space-y-6">
            {project.narrative.map((p) => (
              <Fade key={p.slice(0, 24)}>
                <p className="font-sans text-sm leading-relaxed text-ink/75">{p}</p>
              </Fade>
            ))}
          </div>
          <Fade className="mt-10">
            <p className="font-sans text-xs uppercase tracking-wideish text-ink/65">
              Architecture · {project.architect}
            </p>
          </Fade>
        </div>
        <Fade className="self-start lg:sticky lg:top-24">
          <div className="border border-ink/10 p-3">
            <img
              src="/im/plan-site.webp"
              alt="Site plan — the building within its terraced landscape, 1:200"
              width={2200}
              height={1420}
              loading="lazy"
              className="w-full"
            />
            <p className="mt-3 font-sans text-xs text-ink/65">Site plan · 1:200</p>
          </div>
        </Fade>
      </div>
    </section>
  );
}

function AerialModel() {
  const root = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-model]",
        { yPercent: 10, rotate: -3, scale: 0.94 },
        {
          yPercent: -6,
          rotate: 1.5,
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        },
      );
    }, root.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="relative overflow-clip bg-coal px-5 py-32 sm:px-8">
      <p
        aria-hidden="true"
        className="type-display pointer-events-none absolute -top-10 right-0 select-none text-[clamp(10rem,30vw,26rem)] leading-none text-bone/[0.04]"
      >
        563
      </p>
      <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.2fr_0.8fr]">
        <img
          data-model
          src="/im/aerial-model-b.webp"
          alt="Aerial view of Daher el Souane 563 — terracotta roofscape and terraced gardens"
          width={2000}
          height={1111}
          loading="lazy"
          className="w-full drop-shadow-[0_60px_80px_rgba(0,0,0,0.55)]"
        />
        <div>
          <p className="type-eyebrow text-smoke">The setting</p>
          <h2 className="type-display mt-6 text-3xl text-bone sm:text-4xl">
            Gardens first, <em className="type-display-it text-stone">then architecture.</em>
          </h2>
          <ul className="mt-8 space-y-4">
            {project.setting.map((s) => (
              <Fade as="li" key={s} className="flex items-baseline gap-4 border-t border-seam pt-4">
                <span aria-hidden className="inline-block h-[3px] w-[14px] shrink-0 bg-tile" />
                <span className="font-sans text-sm text-bone/85">{s}</span>
              </Fade>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Location() {
  const { location } = project;
  const mapsUrl = "https://www.google.com/maps/search/?api=1&query=Daher+El+Souane,+Mount+Lebanon";
  return (
    <section className="border-t border-seam bg-ink px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="type-eyebrow text-smoke">Getting there</p>
        <Lines className="type-display mt-6 max-w-3xl text-[clamp(1.9rem,4.2vw,3.4rem)] text-bone">
          {location.line}
        </Lines>
        <div className="mt-12 grid border border-seam sm:grid-cols-3">
          {location.driveTimes.map((d) => (
            <Fade
              key={d.place}
              className="border-b border-seam px-8 py-10 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
            >
              <p className="type-display text-5xl text-bone">
                {d.minutes}
                <span className="ml-2 font-sans text-sm font-normal text-smoke">min</span>
              </p>
              <p className="mt-3 font-sans text-xs uppercase tracking-wideish text-smoke">
                {d.place}
              </p>
            </Fade>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="font-sans text-xs text-smoke/70">{location.note}</p>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="font-sans text-xs text-bone underline underline-offset-4 transition-colors hover:text-pmcc"
          >
            Open in Google Maps →
          </a>
        </div>
      </div>
    </section>
  );
}

/** The three-step journey from deposit to keys — the "how does buying work" answer. */
function PaymentPath() {
  const steps = [
    { n: "01", title: "Reserve", body: "Choose your floor and place a deposit. The residence is yours — off the market." },
    { n: "02", title: "Follow the build", body: "We build; you watch it rise. One company is the developer, manager and builder." },
    { n: "03", title: "Move in", body: "Settle the balance on completion. Keys in hand, summer 2027." },
  ];
  return (
    <div className="mx-auto mt-12 grid max-w-4xl gap-px border border-ink/15 bg-ink/15 sm:grid-cols-3">
      {steps.map((s) => (
        <div key={s.n} className="bg-bone px-7 py-8 text-left">
          <p className="font-sans text-xs text-pmcc">{s.n}</p>
          <p className="type-display mt-2 text-2xl text-ink">{s.title}</p>
          <p className="mt-3 font-sans text-xs leading-relaxed text-ink/65">{s.body}</p>
        </div>
      ))}
    </div>
  );
}

function Faq() {
  const items = [
    {
      q: "When is the building delivered?",
      a: "Summer 2027. The programme is managed by PMCC's own project team — the same discipline we've applied to client projects since 2002.",
    },
    {
      q: "How does payment work?",
      a: "A deposit reserves your residence and takes it off the market; the balance is settled on completion. The detailed schedule is shared when we send the price list.",
    },
    {
      q: "Who is behind the project?",
      a: "PMCC is the developer, the project manager and the builder — one company, one name accountable since 2002, with Microsoft, MEDCO, McDonald's and Arab Investment Bank among past clients. Architecture by A20/partners.",
    },
    {
      q: "How private is 'one residence per floor'?",
      a: "The elevator opens to your floor; there is no shared landing and no neighbour behind a facing door. Four families in the whole building, each with a full floor and four bedrooms.",
    },
    {
      q: "Can I visit the site?",
      a: "Yes — and we encourage it. Message us on WhatsApp and we'll arrange a walk of the site and the floor you're considering.",
    },
    {
      q: "Is the project permitted?",
      a: "Fully permitted. And the company that holds the permit is the company that builds — PMCC develops, manages and constructs the project under one name.",
    },
    {
      q: "What do prices start at?",
      a: "From $500,000 for a full-floor, four-bedroom residence of 330 m². The full price list per floor — with gardens, terraces and parking — comes with the floor plans when you leave your number above.",
    },
    {
      q: "How do I get areas, finishes and pricing?",
      a: "Leave your number in the form above or message us on WhatsApp — the full price list, floor areas and finishes schedule come to you the same day.",
    },
  ];
  return (
    <section className="border-t border-seam bg-ink px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="type-eyebrow text-smoke">Before you ask</p>
        <h2 className="type-display mt-6 text-[clamp(1.9rem,4.2vw,3.2rem)] text-bone">
          The questions every buyer asks{" "}
          <em className="type-display-it text-stone">answered straight.</em>
        </h2>
        <div className="mt-10">
          {items.map((item) => (
            <details key={item.q} className="group border-t border-seam last:border-b">
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 py-5 font-sans text-sm font-semibold text-bone transition-colors hover:text-stone [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden className="shrink-0 text-pmcc transition-transform duration-300 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="max-w-xl pb-6 font-sans text-sm leading-relaxed text-smoke">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Availability() {
  const total = project.floors.length;
  const remaining = project.floors.filter((f) => f.availability !== "sold").length;
  const summary =
    remaining === total
      ? "All four residences are currently available."
      : `${remaining} of ${total} residences remain.`;

  return (
    <section id="enquire" className="bg-bone px-5 py-28 text-ink sm:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <p className="type-eyebrow text-ink/65">Availability</p>
        <Lines className="type-display mx-auto mt-8 max-w-3xl text-[clamp(2.2rem,5.4vw,4.6rem)]">
          Four residences. <em className="type-display-it">One per floor.</em>
        </Lines>
        <Fade>
          <p className="type-display mt-6 text-[clamp(1.6rem,3vw,2.2rem)] text-ink">
            From <em className="type-display-it text-pmcc">$500,000</em>
          </p>
        </Fade>
        <Fade className="mx-auto mt-6 max-w-md">
          <p className="font-sans text-sm leading-relaxed text-ink/70">
            {summary} Fully permitted. {project.onRequest}
          </p>
        </Fade>
        <Fade>
          <PaymentPath />
        </Fade>
        <Fade className="mt-12">
          <LeadForm tone="light" source="project" showWhatsApp={false} />
        </Fade>
        <Fade className="mt-8 flex justify-center">
          <Magnetic>
            <a
              href={`https://wa.me/${company.whatsapp}?text=${encodeURIComponent(
                "Hello PMCC — I'm interested in Daher el Souane 563.",
              )}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("whatsapp_click", { source: "project-availability" })}
              className="inline-flex items-center gap-3 bg-ink px-8 py-4 font-sans text-sm font-semibold text-bone"
            >
              Or enquire on WhatsApp →
            </a>
          </Magnetic>
        </Fade>
        <Fade className="mt-10">
          <p className="font-sans text-xs text-ink/55">
            Know someone this would suit?{" "}
            <ShareButton
              url="https://pmcclb.com/daher-el-souane-563"
              className="text-ink underline underline-offset-4 transition-colors hover:text-pmcc"
            />
          </p>
        </Fade>
      </div>
    </section>
  );
}

/**
 * Mobile-only action bar, appearing once the hero has made its case. On a
 * phone the money actions must never be more than a thumb away — scrolling
 * back up to find a button is where enquiries die.
 */
function StickyCta() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 1.1);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[80] flex border-t border-seam bg-ink/95 backdrop-blur-sm transition-transform duration-300 ease-out-expo lg:hidden ${
        visible ? "" : "translate-y-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <a
        href={`https://wa.me/${company.whatsapp}?text=${encodeURIComponent(
          "Hello PMCC — I'm interested in Daher el Souane 563.",
        )}`}
        target="_blank"
        rel="noreferrer"
        onClick={() => track("whatsapp_click", { source: "sticky-bar" })}
        className="flex-1 bg-pmcc py-4 text-center font-sans text-sm font-semibold text-bone"
      >
        WhatsApp
      </a>
      <button
        type="button"
        onClick={() => document.getElementById("enquire")?.scrollIntoView({ behavior: "smooth" })}
        className="flex-1 py-4 text-center font-sans text-sm font-semibold text-bone"
      >
        Price list ↓
      </button>
    </div>
  );
}

export default function Project() {
  // Client-side navigation leaves the baked-in <head> describing the wrong
  // page; put it right. Scrapers read the baked copy, Google reads this.
  useLayoutEffect(() => applySeo("project"), []);

  return (
    <>
      <ProjectHero />
      <FactsStrip />
      <Narrative />
      <TheView />
      <BeforeAfter />
      <FloorStack />
      <Gallery />
      <AerialModel />
      <TheStandard />
      <Location />
      <Availability />
      <Faq />
      <StickyCta />
    </>
  );
}
