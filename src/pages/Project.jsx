import { useLayoutEffect, useRef } from "react";
import { gsap, reducedMotion } from "../lib/motion";
import { Lines, Fade } from "../components/reveal";
import WarpImage from "../components/WarpImage";
import FloorStack from "../components/project/FloorStack";
import Gallery from "../components/project/Gallery";
import { project, company } from "../data/content";

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

function Availability() {
  return (
    <section className="bg-bone px-5 py-28 text-ink sm:px-8">
      <div className="mx-auto max-w-6xl text-center">
        <p className="type-eyebrow text-ink/65">Availability</p>
        <Lines className="type-display mx-auto mt-8 max-w-3xl text-[clamp(2.2rem,5.4vw,4.6rem)]">
          Four residences. <em className="type-display-it">One per floor.</em>
        </Lines>
        <Fade className="mx-auto mt-8 max-w-md">
          <p className="font-sans text-sm leading-relaxed text-ink/70">{project.onRequest}</p>
        </Fade>
        <Fade className="mt-10 flex justify-center">
          <a
            href={`https://wa.me/${company.whatsapp}?text=${encodeURIComponent(
              "Hello PMCC — I'm interested in Daher el Souane 563.",
            )}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-3 bg-pmcc px-8 py-4 font-sans text-sm font-semibold text-bone transition-transform duration-300 ease-out-expo hover:scale-[1.03]"
          >
            Enquire on WhatsApp →
          </a>
        </Fade>
      </div>
    </section>
  );
}

export default function Project() {
  return (
    <>
      <ProjectHero />
      <FactsStrip />
      <Narrative />
      <FloorStack />
      <Gallery />
      <AerialModel />
      <Availability />
    </>
  );
}
