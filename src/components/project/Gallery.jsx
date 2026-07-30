/**
 * Editorial gallery — a staggered grid where every frame reveals with a clip
 * wipe and its image drifts on a slower layer than the page. All transform/
 * clip-path; nothing here can drop a frame.
 */
import { useLayoutEffect, useRef } from "react";
import { gsap, reducedMotion } from "../../lib/motion";
import { project } from "../../data/content";

const SPANS = [
  "sm:col-span-7",
  "sm:col-span-5 sm:mt-24",
  "sm:col-span-5 sm:-mt-10",
  "sm:col-span-7 sm:mt-16",
  "sm:col-span-8",
  "sm:col-span-4 sm:mt-28",
];

/** sizes per span — matched to SPANS so a 4-col slot never downloads a 2560px file. */
const SIZES = [
  "(min-width: 1152px) 660px, (min-width: 640px) 58vw, 100vw",
  "(min-width: 1152px) 470px, (min-width: 640px) 42vw, 100vw",
  "(min-width: 1152px) 470px, (min-width: 640px) 42vw, 100vw",
  "(min-width: 1152px) 660px, (min-width: 640px) 58vw, 100vw",
  "(min-width: 1152px) 755px, (min-width: 640px) 66vw, 100vw",
  "(min-width: 1152px) 375px, (min-width: 640px) 33vw, 100vw",
];

export default function Gallery() {
  const root = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.utils.toArray("[data-frame]").forEach((frame) => {
        gsap.fromTo(
          frame,
          { clipPath: "inset(10% 6% 10% 6%)" },
          {
            clipPath: "inset(0% 0% 0% 0%)",
            duration: 1.2,
            ease: "power3.out",
            scrollTrigger: { trigger: frame, start: "top 85%", once: true },
          },
        );
        gsap.fromTo(
          frame.querySelector("img"),
          { yPercent: -7 },
          {
            yPercent: 7,
            ease: "none",
            scrollTrigger: { trigger: frame, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      });
    }, root.current);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="bg-ink px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="type-eyebrow text-smoke">The building</p>
        <div className="mt-12 grid gap-6 sm:grid-cols-12 sm:gap-x-8 sm:gap-y-2">
          {project.gallery.map((g, i) => (
            <figure key={g.src} className={SPANS[i % SPANS.length]}>
              <div data-frame className="overflow-clip">
                <img
                  src={g.src}
                  srcSet={`${g.small} 1280w, ${g.src} ${g.w}w`}
                  sizes={SIZES[i % SIZES.length]}
                  alt={g.alt}
                  width={g.w}
                  height={g.h}
                  loading="lazy"
                  className="h-full w-full scale-[1.16] object-cover"
                />
              </div>
              <figcaption className="mt-3 font-sans text-xs text-smoke">{g.alt}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
