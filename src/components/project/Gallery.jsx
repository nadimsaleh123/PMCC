/**
 * The building as a horizontal journey: one pinned strip, vertical scroll
 * drags the renders past full-height, in the order you would walk the site —
 * arrival, facade, entrance, gardens, rear, the tower from below. On small
 * screens and reduced-motion it is a swipeable snap row; the pin is a
 * desktop instrument.
 */
import { useLayoutEffect, useRef } from "react";
import { gsap, reducedMotion } from "../../lib/motion";
import { project } from "../../data/content";

export default function Gallery() {
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
            trigger: pinTarget.current,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
        // Each image drifts inside its frame against the travel — depth
        // without a single layout-affecting property.
        gsap.utils.toArray("[data-slide] img").forEach((img) => {
          gsap.fromTo(
            img,
            { xPercent: -6 },
            {
              xPercent: 6,
              ease: "none",
              scrollTrigger: {
                trigger: section.current,
                start: "top top",
                end: () => `+=${distance()}`,
                scrub: 1,
              },
            },
          );
        });
      });
    }, section.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={section} className="bg-ink">
      <div ref={pinTarget} className="overflow-clip motion-safe:lg:h-screen">
      <div className="flex items-baseline justify-between px-5 pt-20 sm:px-8 motion-safe:lg:pt-24">
        <p className="type-eyebrow text-smoke">The building</p>
        <p className="hidden font-sans text-xs text-smoke motion-safe:lg:block" aria-hidden="true">
          Keep scrolling →
        </p>
      </div>
      <div
        ref={track}
        className="no-scrollbar mt-8 flex w-auto snap-x snap-mandatory items-center gap-5 overflow-x-auto px-5 pb-16 sm:px-8 motion-safe:lg:w-max motion-safe:lg:snap-none motion-safe:lg:overflow-visible motion-safe:lg:gap-8 motion-safe:lg:pb-0 motion-safe:lg:pr-[18vw]"
      >
        {project.gallery.map((g, i) => (
          <figure key={g.src} data-slide className="w-[86vw] shrink-0 snap-center sm:w-[70vw] motion-safe:lg:w-auto">
            <div className="overflow-clip motion-safe:lg:h-[64vh]">
              <img
                src={g.src}
                srcSet={`${g.small} 1280w, ${g.src} ${g.w}w`}
                sizes="(min-width: 1024px) 60vw, 86vw"
                alt={g.alt}
                width={g.w}
                height={g.h}
                loading="lazy"
                className="h-full w-full scale-[1.14] object-cover"
              />
            </div>
            <figcaption className="mt-3 flex items-baseline gap-3 font-sans text-xs text-smoke">
              <span className="tabular-nums text-pmcc">{String(i + 1).padStart(2, "0")}</span>
              {g.alt}
            </figcaption>
          </figure>
        ))}
      </div>
      </div>
    </section>
  );
}
