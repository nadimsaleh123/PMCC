import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap, reducedMotion } from "../lib/motion";
import { Lines, Fade } from "../components/reveal";
import WarpImage from "../components/WarpImage";
import Timeline from "../components/home/Timeline";
import SelectedWork from "../components/home/SelectedWork";
import { heroClaim, stats, services, clients, project } from "../data/content";

function Hero() {
  const root = useRef(null);
  const pinTarget = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-hero-strip]",
        { clipPath: "inset(0 0 100% 0)" },
        { clipPath: "inset(0 0 0% 0)", duration: 1.2, delay: 0.5, ease: "power4.inOut" },
      );
      gsap.fromTo(
        "[data-hero-sub]",
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 1, delay: 0.7 },
      );

      // The smart bit: scrolling grows the image band upward over the claim
      // until the dawn frame fills the screen, then the page releases.
      // Desktop only; the pin targets an inner wrapper so React keeps owning
      // the section.
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: pinTarget.current,
            start: "top top",
            end: () => `+=${window.innerHeight * 1.1}`,
            pin: true,
            scrub: 0.5,
            invalidateOnRefresh: true,
          },
        });
        tl.to("[data-hero-strip]", { height: "100svh", ease: "power1.inOut", duration: 1 }, 0)
          .to("[data-hero-copy]", { autoAlpha: 0, y: -40, duration: 0.45 }, 0.05);
      });
    }, root.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="bg-ink">
      <div ref={pinTarget} className="grid h-[100svh] grid-rows-[minmax(0,1fr)_auto] pt-[64px]">
      <div data-hero-copy className="flex min-h-0 flex-col justify-center overflow-clip px-5 sm:px-8">
        <Fade delay={0.35}>
          <p className="type-eyebrow text-smoke">{heroClaim.eyebrow}</p>
        </Fade>
        <Lines
          as="h1"
          trigger={false}
          delay={0.35}
          className="type-display mt-[2svh] text-[clamp(2.4rem,min(8vw,10.5svh),7.2rem)] text-bone"
        >
          {heroClaim.lines[0]}
          <br />
          <em className="type-display-it text-stone">{heroClaim.lines[1]}</em>
        </Lines>
        <div className="mt-[3svh] flex items-end justify-between gap-8 pb-[2svh]">
          <p data-hero-sub className="max-w-md font-sans text-sm leading-relaxed text-smoke">
            {heroClaim.sub}
          </p>
          <p className="type-eyebrow hidden shrink-0 text-smoke sm:block" aria-hidden="true">
            Scroll ↓
          </p>
        </div>
      </div>
      <div data-hero-strip className="relative z-10 h-[38svh]">
        <WarpImage
          src="/im/hero-reveal-2560.webp"
          srcSet="/im/hero-reveal-1280.webp 1280w, /im/hero-reveal-2560.webp 2560w"
          alt="A concrete frame at first light — the quiet hours of a build"
          className="h-full"
          priority
        />
      </div>
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
  // Slugs whose /im/logos/<slug>.png failed to load fall back to wordmarks.
  const [failed, setFailed] = useState(() => new Set());
  const row = [...clients, ...clients, ...clients];
  return (
    <section className="overflow-clip bg-ink pb-6 pt-16" aria-label="Selected clients">
      <p className="type-eyebrow px-5 text-smoke sm:px-8">They trusted us with their name</p>
      <div className="marquee mt-8 flex w-max items-center pr-0">
        {row.map((c, i) => (
          <span
            key={`${c.slug}-${i}`}
            className="flex items-center"
            aria-hidden={i >= clients.length}
          >
            {failed.has(c.slug) ? (
              <span className="type-display whitespace-nowrap text-[clamp(1.7rem,3.8vw,3.1rem)] text-stone">
                {c.name}
              </span>
            ) : (
              <img
                src={`/im/logos/${c.slug}.png`}
                alt={c.name}
                // grayscale+invert turns any dark-on-light logo into a light
                // mark, and screen blending sinks white/black backgrounds
                // into the dark strip - raw downloads render as one bone set.
                className="h-8 w-auto opacity-80 mix-blend-screen [filter:grayscale(1)_invert(1)_brightness(1.05)] sm:h-10"
                loading="lazy"
                onError={() =>
                  setFailed((prev) => {
                    const next = new Set(prev);
                    next.add(c.slug);
                    return next;
                  })
                }
              />
            )}
            <span aria-hidden className="mx-8 inline-block h-1.5 w-1.5 rounded-full bg-pmcc sm:mx-10" />
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
      <Clients />
      <Stats />
      <Manifesto />
      <Services />
      <Timeline />
      <SelectedWork />
      <FlagshipPromo />
    </>
  );
}
