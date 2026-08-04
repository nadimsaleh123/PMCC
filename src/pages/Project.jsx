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
import { project, company, book563 } from "../data/content";
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

/**
 * Introduction: the book's opening plate edge to edge, a short summary in
 * place of the long narrative, then the four residences stacked like the
 * building itself — roof at the top, garden at the bottom.
 */
function Introduction() {
  const root = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-intro-img]",
        { scale: 1.14, yPercent: 4 },
        {
          scale: 1,
          yPercent: -3,
          ease: "none",
          scrollTrigger: { trigger: "[data-intro-frame]", start: "top bottom", end: "bottom top", scrub: 1 },
        },
      );
    }, root.current);
    return () => ctx.revert();
  }, []);

  const stack = [...project.floors].reverse();
  const widths = ["sm:w-[70%]", "sm:w-[84%]", "sm:w-[94%]", "sm:w-full"];
  const spec = (f, key) => f.specs.find(([k]) => k === key)?.[1] ?? "—";

  return (
    <section ref={root} className="bg-ink py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="type-eyebrow text-smoke">Introduction</p>
        <Lines className="type-display mt-6 max-w-4xl text-[clamp(2.2rem,5.4vw,4.4rem)] text-bone">
          Dahr el Sawan <em className="type-display-it text-stone">private residences.</em>
        </Lines>
      </div>

      {/* The plate, edge to edge — no margins. */}
      <div data-intro-frame className="mt-12 overflow-clip">
        <img
          data-intro-img
          src={book563.intro.src}
          srcSet={`${book563.intro.small} 1000w, ${book563.intro.src} 1420w`}
          sizes="100vw"
          alt={book563.intro.alt}
          width={book563.intro.w}
          height={book563.intro.h}
          loading="lazy"
          className="h-[58svh] w-full object-cover will-change-transform sm:h-[78svh]"
        />
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Fade className="mt-14">
          <p className="max-w-2xl font-sans text-base leading-relaxed text-bone/85">
            A gated development on the green ridge above the coast, twenty minutes from
            Beirut and a world away from it. One boutique building, four full-floor
            residences, gardens terraced into the hillside, and an elevator to every level.
          </p>
          <p className="mt-4 font-sans text-xs uppercase tracking-wideish text-smoke">
            Architecture · {project.architect}
          </p>
        </Fade>

        {/* What is for sale, drawn as the building: one residence per floor. */}
        <Fade className="mt-20">
          <h3 className="type-display text-center text-2xl text-bone sm:text-3xl">
            Four residences, <em className="type-display-it text-stone">one per floor.</em>
          </h3>
        </Fade>
        <div className="mx-auto mt-10 max-w-3xl">
          {stack.map((f, i) => (
            <Fade key={f.id} className={`mx-auto w-full ${widths[i]} ${i ? "-mt-px" : ""}`}>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border border-seam bg-coal px-5 py-4 transition-colors duration-300 hover:border-stone sm:gap-x-6 sm:px-7 sm:py-5">
                <span className="type-display text-lg text-bone sm:text-xl">{f.level}</span>
                <span className="ml-auto flex shrink-0 items-baseline gap-5 font-sans text-xs tabular-nums sm:gap-7">
                  <span>
                    <span className="mr-1.5 text-[0.6rem] uppercase tracking-wideish text-stone">Indoor</span>
                    <span className="text-bone/90">{spec(f, "Area")}</span>
                  </span>
                  <span>
                    <span className="mr-1.5 text-[0.6rem] uppercase tracking-wideish text-stone">Garden</span>
                    <span className="text-bone/90">{spec(f, "Garden")}</span>
                  </span>
                </span>
              </div>
            </Fade>
          ))}
        </div>
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
          src="/im/view-ridge-3200.webp"
          srcSet="/im/view-ridge-1280.webp 1280w, /im/view-ridge-2444.webp 2444w, /im/view-ridge-3200.webp 3200w"
          alt="The view from the site, over the Metn valley and the mountains beyond, photographed at Daher el Souane"
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
            above the sea. The valley below, the mountains across, and Beirut twenty
            minutes down the hill.
          </p>
        </div>
      </div>
    </section>
  );
}

/** The general specification, in full from the project book. */
function TheStandard() {
  return (
    <section className="border-t border-seam bg-coal px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="type-eyebrow text-smoke">The standard · from the project book</p>
        <Lines className="type-display mt-6 max-w-4xl text-[clamp(1.9rem,4.2vw,3.4rem)] text-bone">
          Specified like a private house,{" "}
          <em className="type-display-it text-stone">secured like a gated estate.</em>
        </Lines>
        <div className="mt-14 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {book563.specs.map((g) => (
            <Fade key={g.title}>
              <p className="font-sans text-xs font-semibold uppercase tracking-wideish text-stone">
                {g.title}
              </p>
              <ul className="mt-5 space-y-3">
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

/**
 * The location, laid out as the project book lays it out: Lebanon in the
 * middle with the site marked, its sight-lines fanning out into the two
 * satellite maps — country, then area, then the site itself. The maps
 * land like pinned photographs, with a slight tilt that rights itself.
 */
function LocationSpread() {
  const root = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-lebanon]",
        { autoAlpha: 0, y: 40 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: "[data-lebanon]", start: "top 88%", once: true },
        },
      );
      gsap.utils.toArray("[data-map]").forEach((el, i) => {
        gsap.fromTo(
          el,
          { y: 70, autoAlpha: 0, rotate: i % 2 ? 2 : -2 },
          {
            y: 0,
            autoAlpha: 1,
            rotate: 0,
            duration: 1.1,
            delay: i * 0.15,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          },
        );
      });
    }, root.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="border-t border-seam bg-ink px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="type-eyebrow text-smoke">From the project book</p>
        <Lines className="type-display mt-6 max-w-3xl text-[clamp(1.9rem,4.2vw,3.4rem)] text-bone">
          The gated <em className="type-display-it text-stone">community.</em>
        </Lines>
        <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12">
          <div>
            <Fade>
              <p className="max-w-xl font-sans text-sm leading-relaxed text-smoke">{book563.community.body}</p>
            </Fade>
            <Fade className="mt-10">
              <h3 className="type-display text-2xl text-bone">The location</h3>
            </Fade>
            {book563.location.map((p) => (
              <Fade key={p.slice(0, 24)} className="mt-4">
                <p className="max-w-xl font-sans text-sm leading-relaxed text-smoke">{p}</p>
              </Fade>
            ))}
          </div>
          {/* Country → area → site, exactly as the book zooms in. */}
          <div className="grid items-center gap-10 sm:grid-cols-[minmax(0,0.72fr)_minmax(0,1.1fr)_minmax(0,1.1fr)] sm:gap-6">
            <img
              data-lebanon
              src="/im/dsw-lebanon.webp"
              alt="Lebanon, with the project location marked in the hills above Beirut at Dahr el Sawan"
              loading="lazy"
              className="mx-auto w-44 sm:w-full sm:max-w-[230px]"
            />
            {book563.maps.map((m) => (
              <figure key={m.src} data-map>
                <div className="border border-seam bg-coal p-2">
                  <img src={m.src} alt={m.alt} loading="lazy" className="w-full" />
                </div>
                <figcaption className="mt-2.5 font-sans text-xs leading-relaxed text-smoke">{m.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * From the project book: the entrance and the roofscape as a diptych.
 * The two plates drift at different speeds — the depth of a page you are
 * walking past, not a flat scan.
 */
function ResidenceCloseUp() {
  const root = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.utils.toArray("[data-bd]").forEach((el, i) => {
        gsap.fromTo(
          el,
          { yPercent: i === 0 ? 6 : 10 },
          {
            yPercent: i === 0 ? -6 : -2,
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: 1 },
          },
        );
      });
    }, root.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="bg-ink px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="type-eyebrow text-smoke">From the project book</p>
        <h2 className="type-display mt-6 text-3xl text-bone sm:text-4xl">
          The residence, <em className="type-display-it text-stone">drawn close.</em>
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {book563.closeUp.map((im, i) => (
            <div key={im.src} className="aspect-[4/3] overflow-clip">
              <img
                data-bd={i}
                src={im.src}
                srcSet={`${im.small} 1000w, ${im.src} 1760w`}
                sizes="(min-width: 640px) 36rem, 100vw"
                alt={im.alt}
                loading="lazy"
                className="h-full w-full scale-[1.14] object-cover will-change-transform"
              />
            </div>
          ))}
        </div>
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
          alt="Aerial view of Daher el Souane 563, terracotta roofscape and terraced gardens"
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
    { n: "01", title: "Reserve", body: "Choose your floor and place a deposit. The residence is yours, off the market." },
    { n: "02", title: "Follow the build", body: "We build, and you watch it rise. One company does it all, start to finish." },
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
      a: "Summer 2027. Our own team runs the programme, the same way we have run client projects since 1996.",
    },
    {
      q: "How does payment work?",
      a: "A deposit reserves your residence. The balance is settled on completion, and the detailed schedule comes with the price list.",
    },
    {
      q: "Who is behind the project?",
      a: "PMCC is the developer, the manager and the builder. One company, accountable since 1996. Past clients include Microsoft, MEDCO, McDonald's and Arab Investment Bank. Architecture by A20/partners.",
    },
    {
      q: "How private is 'one residence per floor'?",
      a: "The elevator opens to your floor. There is no shared landing and no neighbour behind a facing door. Four families in the whole building, each with a full floor.",
    },
    {
      q: "Can I visit the site?",
      a: "Yes, and we encourage it. Message us on WhatsApp and we'll arrange a visit.",
    },
    {
      q: "Is the project permitted?",
      a: "Fully permitted. The company that holds the permit is the same company that builds.",
    },
    {
      q: "How do I get areas, finishes and pricing?",
      a: "Leave your number in the form above or message us on WhatsApp. The full price list, floor areas and finishes come to you the same day.",
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
      <Introduction />
      <LocationSpread />
      <TheView />
      <BeforeAfter />
      <FloorStack />
      <Gallery />
      <AerialModel />
      <ResidenceCloseUp />
      <TheStandard />
      <Location />
      <Availability />
      <Faq />
      <StickyCta />
    </>
  );
}
