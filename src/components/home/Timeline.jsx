/**
 * Pinned horizontal timeline — vertical scroll drags 2002→today sideways.
 * The pin and the overflowing track exist only under `motion-safe:lg:`; small
 * screens and reduced-motion desktops get the same swipeable row, so the
 * later eras are always reachable.
 */
import { useLayoutEffect, useRef } from "react";
import { gsap, reducedMotion } from "../../lib/motion";
import { timeline } from "../../data/content";

export default function Timeline() {
  const section = useRef(null);
  const pinTarget = useRef(null);
  const track = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const distance = () => track.current.scrollWidth - window.innerWidth;
        gsap.to(track.current, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            // Pin the inner wrapper so the section itself is never
            // re-parented out from under React.
            trigger: pinTarget.current,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
      });
    }, section.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={section} className="bg-coal">
      <div ref={pinTarget} className="overflow-clip">
      <div className="px-5 pt-24 sm:px-8">
        <p className="type-eyebrow text-smoke">Since 2002</p>
        <h2 className="type-display mt-6 text-[clamp(2.2rem,5vw,4.2rem)] text-bone">
          One standard, kept for two decades.
        </h2>
      </div>
      {/* Soft edge fade so cells never slice mid-glyph at the viewport edge */}
      <div className="motion-safe:lg:[mask-image:linear-gradient(90deg,transparent,black_4%,black_96%,transparent)]">
        <div
          ref={track}
          className="no-scrollbar mt-16 flex w-auto snap-x snap-mandatory gap-0 overflow-x-auto pb-20 pl-5 pr-[15vw] sm:pl-8 motion-safe:lg:w-max motion-safe:lg:snap-none motion-safe:lg:overflow-visible"
        >
          {timeline.map((t) => (
            <article
              key={t.year}
              className="w-[78vw] shrink-0 snap-start border-l border-seam pl-8 pr-14 sm:w-[46vw] lg:w-[34vw]"
            >
              <p className="type-display text-6xl text-stone sm:text-7xl">{t.year}</p>
              <p className="mt-6 max-w-sm font-sans text-sm leading-relaxed text-smoke">{t.text}</p>
            </article>
          ))}
        </div>
      </div>
      </div>
    </section>
  );
}
