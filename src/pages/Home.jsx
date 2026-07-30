import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap, reducedMotion } from "../lib/motion";
import { Lines, Fade } from "../components/reveal";
import WarpImage from "../components/WarpImage";
import Timeline from "../components/home/Timeline";
import WorksIndex from "../components/home/WorksIndex";
import { heroClaim, stats, services, clients, project } from "../data/content";

function Hero() {
  const root = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-hero-strip]",
        { clipPath: "inset(100% 0 0 0)" },
        { clipPath: "inset(0% 0 0 0)", duration: 1.2, delay: 0.5, ease: "power4.inOut" },
      );
      gsap.fromTo(
        "[data-hero-sub]",
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 1, delay: 0.7 },
      );
    }, root.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="relative flex min-h-[100svh] flex-col justify-between pt-24">
      <div className="px-5 sm:px-8">
        <Fade delay={0.35}>
          <p className="type-eyebrow text-smoke">{heroClaim.eyebrow}</p>
        </Fade>
        <Lines
          as="h1"
          trigger={false}
          delay={0.35}
          className="type-display mt-8 max-w-6xl text-[clamp(3.2rem,11.5vw,10.5rem)] text-bone"
        >
          {heroClaim.lines[0]}
          <br />
          <em className="type-display-it text-stone">{heroClaim.lines[1]}</em>
        </Lines>
        <div className="mt-10 flex items-end justify-between gap-8 pb-10">
          <p data-hero-sub className="max-w-md font-sans text-sm leading-relaxed text-smoke">
            {heroClaim.sub}
          </p>
          <p className="type-eyebrow hidden shrink-0 text-smoke sm:block" aria-hidden="true">
            Scroll ↓
          </p>
        </div>
      </div>
      <div data-hero-strip className="h-[40svh]">
        <WarpImage
          src="/im/elevation-front-2560.webp"
          srcSet="/im/elevation-front-1280.webp 1280w, /im/elevation-front-2560.webp 2560w"
          alt="Daher el Souane 563 by PMCC — front elevation among the pines"
          className="h-full"
          priority
        />
      </div>
    </section>
  );
}

function Stats() {
  const root = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.utils.toArray("[data-stat]").forEach((el) => {
        const raw = el.dataset.stat;
        const num = parseInt(raw, 10);
        if (Number.isNaN(num)) return;
        gsap.fromTo(
          el,
          { textContent: 0 },
          {
            textContent: num,
            duration: 1.6,
            ease: "power2.out",
            snap: { textContent: 1 },
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
            onUpdate() {
              el.textContent = `${Math.round(gsap.getProperty(el, "textContent"))}${raw.replace(/^\d+/, "")}`;
            },
          },
        );
      });
    }, root.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="border-y border-seam bg-ink px-5 py-16 sm:px-8">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-4">
        {stats.map((s) => (
          <Fade key={s.label}>
            <p data-stat={s.value} className="type-display text-5xl text-bone sm:text-6xl">
              {s.value}
            </p>
            <p className="mt-3 max-w-[16rem] font-sans text-xs leading-relaxed text-smoke">
              {s.label}
            </p>
          </Fade>
        ))}
      </div>
    </section>
  );
}

function Manifesto() {
  return (
    <section className="bg-bone px-5 py-28 text-ink sm:px-8 sm:py-40">
      <div className="mx-auto max-w-6xl">
        <p className="type-eyebrow text-ink/65">The difference</p>
        <Lines className="type-display mt-8 text-[clamp(2.2rem,5.6vw,4.8rem)]">
          Most developers hire a builder. Most builders answer to a manager.
          We are all three — so the schedule, the budget and the workmanship
          answer to <em className="type-display-it">one name.</em>
        </Lines>
        <Fade className="mt-12 max-w-xl">
          <p className="font-sans text-sm leading-relaxed text-ink/70">
            More than two decades of managing construction for Microsoft, MEDCO and
            two generations of private clients taught us exactly where projects
            go wrong. Now we put that discipline into buildings we develop
            ourselves — and sign with our own name.
          </p>
        </Fade>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section className="bg-ink px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="type-eyebrow text-smoke">What we do</p>
        <div className="mt-10">
          {services.map((s) => (
            <Fade
              key={s.n}
              className="group grid gap-4 border-t border-seam py-10 last:border-b sm:grid-cols-[6rem_1fr_1.2fr] sm:gap-8"
            >
              <p className="font-sans text-sm text-smoke transition-colors duration-300 group-hover:text-pmcc">
                {s.n}
              </p>
              <h3 className="type-display text-3xl text-bone transition-transform duration-500 ease-out-expo group-hover:translate-x-2 sm:text-4xl">
                {s.title}
              </h3>
              <p className="max-w-md font-sans text-sm leading-relaxed text-smoke sm:pt-2">{s.body}</p>
            </Fade>
          ))}
        </div>
      </div>
    </section>
  );
}

function Clients() {
  const row = [...clients, ...clients, ...clients];
  return (
    <section className="overflow-clip border-y border-seam bg-ink py-10" aria-label="Selected clients">
      <div className="marquee flex w-max items-center gap-16 pr-16">
        {row.map((c, i) => (
          <span
            key={`${c}-${i}`}
            className="type-display whitespace-nowrap text-2xl text-smoke sm:text-3xl"
            aria-hidden={i >= clients.length}
          >
            {c}
          </span>
        ))}
      </div>
      <style>{`
        .marquee { animation: marquee-x 36s linear infinite; }
        @keyframes marquee-x { to { transform: translateX(-33.333%); } }
        @media (prefers-reduced-motion: reduce) { .marquee { animation: none; } }
      `}</style>
    </section>
  );
}

function FlagshipPromo() {
  return (
    <section className="relative">
      <Link to="/daher-el-souane-563" className="group block">
        <div className="relative h-[92svh] overflow-clip">
          <WarpImage
            src="/im/hero-three-quarter-2560.webp"
            srcSet="/im/hero-three-quarter-1280.webp 1280w, /im/hero-three-quarter-2560.webp 2560w"
            alt={project.gallery[0].alt}
            className="h-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-ink/40" />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-14 sm:px-8">
            <p className="type-eyebrow text-stone">Now selling · {project.eyebrow}</p>
            <Lines className="type-display mt-6 max-w-4xl text-[clamp(2.8rem,8vw,7.5rem)] text-bone">
              {project.claim[0]} <em className="type-display-it">{project.claim[1]}</em>
            </Lines>
            <p className="mt-8 inline-flex items-center gap-3 font-sans text-sm font-semibold text-bone">
              Visit {project.name}
              <span
                aria-hidden
                className="inline-block bg-pmcc px-3 py-2 transition-transform duration-300 ease-out-expo group-hover:translate-x-2"
              >
                →
              </span>
            </p>
          </div>
        </div>
      </Link>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <Manifesto />
      <Services />
      <Timeline />
      <WorksIndex />
      <Clients />
      <FlagshipPromo />
    </>
  );
}
