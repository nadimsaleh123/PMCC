/**
 * The booklet — selected projects as spreads of a monograph.
 *
 * The reference was a photographed coffee-table book. A literal 3D book is
 * kitsch on the web and collapses on a phone, so this keeps what made the
 * reference work — paper, a gutter, one project per spread, a page number —
 * and drops the object: a bone spread sitting on the ink page, left leaf
 * carrying the words, right leaf the photograph, and a page-turn you drive
 * yourself. No autoplay; a book does not turn its own pages.
 *
 * Every image stays mounted in a stack and the turn only moves clip-paths,
 * so there is nothing to load mid-transition and nothing for React to
 * unmount — the state change touches text alone.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap, reducedMotion } from "../../lib/motion";
import { Fade, Lines } from "../reveal";
import { booklet } from "../../data/content";

const pad = (n) => String(n + 1).padStart(2, "0");

export default function Booklet() {
  const [page, setPage] = useState(0);
  const stack = useRef(null);
  const leaf = useRef(null);
  const previous = useRef(0);

  const turn = (next) => {
    const target = (next + booklet.length) % booklet.length;
    previous.current = page;
    setPage(target);
  };

  useLayoutEffect(() => {
    const from = previous.current;
    if (from === page) return undefined;

    const images = stack.current?.querySelectorAll("[data-page]") ?? [];
    if (reducedMotion()) {
      images.forEach((el, i) => {
        el.style.clipPath = i === page ? "inset(0 0 0 0)" : "inset(0 0 0 100%)";
      });
      return undefined;
    }

    const ctx = gsap.context(() => {
      // The incoming photograph wipes from the gutter outward - the closest a
      // flat surface gets to a page being turned. The outgoing one stays put
      // beneath it, exactly as the previous page does in a real book.
      const incoming = images[page];
      images.forEach((el, i) => {
        if (i !== page) gsap.set(el, { clipPath: i === from ? "inset(0 0 0 0)" : "inset(0 0 0 100%)", zIndex: 1 });
      });
      gsap.set(incoming, { zIndex: 2 });
      gsap.fromTo(
        incoming,
        { clipPath: "inset(0 0 0 100%)" },
        { clipPath: "inset(0 0 0 0%)", duration: 0.9, ease: "power3.inOut" },
      );
      gsap.fromTo(
        leaf.current,
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.65, delay: 0.15, ease: "power2.out" },
      );
    }, stack.current);
    return () => ctx.revert();
  }, [page]);

  const current = booklet[page];

  return (
    <section className="bg-ink px-5 py-28 sm:px-8" aria-label="Project booklet">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="type-eyebrow text-smoke">The portfolio</p>
            <Lines className="type-display mt-6 text-[clamp(2rem,4.6vw,3.8rem)] text-bone">
              Spaces <em className="type-display-it text-stone">that last.</em>
            </Lines>
          </div>
          {/* The controls read as the object they operate: page number, then turn. */}
          <Fade className="flex items-center gap-5 pb-1">
            <p className="font-sans text-xs tabular-nums text-smoke" aria-live="polite">
              <span className="text-bone">{pad(page)}</span> / {pad(booklet.length - 1)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => turn(page - 1)}
                aria-label="Previous project"
                className="grid h-11 w-11 place-items-center rounded-full border border-seam text-bone transition-colors duration-300 hover:border-bone/60"
              >
                <span aria-hidden>←</span>
              </button>
              <button
                type="button"
                onClick={() => turn(page + 1)}
                aria-label="Next project"
                className="grid h-11 w-11 place-items-center rounded-full border border-seam text-bone transition-colors duration-300 hover:border-bone/60"
              >
                <span aria-hidden>→</span>
              </button>
            </div>
          </Fade>
        </div>

        {/* The spread. One paper object, two leaves, a gutter between them. */}
        <Fade className="mt-12">
          <div className="grid overflow-clip bg-bone lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            {/* Left leaf - the words */}
            <div ref={leaf} className="relative flex flex-col justify-between gap-10 p-8 sm:p-12">
              <div>
                <p className="font-sans text-xs tabular-nums text-ink/45">{pad(page)}</p>
                <h3 className="type-display mt-6 text-[clamp(1.9rem,3.4vw,3rem)] leading-[1.05] text-ink">
                  {current.name}
                </h3>
                <p className="mt-3 font-sans text-xs uppercase tracking-[0.14em] text-ink/55">
                  {current.place} · {current.year}
                </p>
                <p className="mt-6 max-w-sm font-sans text-sm leading-relaxed text-ink/70">{current.note}</p>
              </div>
              {current.link ? (
                <Link
                  to={current.link}
                  data-cursor="view"
                  className="group inline-flex items-center gap-3 font-sans text-xs uppercase tracking-[0.14em] text-pmcc"
                >
                  View the project
                  <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
                </Link>
              ) : (
                <p className="font-sans text-xs uppercase tracking-[0.14em] text-ink/40">
                  Full record with every proposal
                </p>
              )}
              {/* The gutter: a fold shadow, not a border - paper, not UI. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 hidden w-10 bg-gradient-to-l from-ink/15 to-transparent lg:block"
              />
            </div>

            {/* Right leaf - the photograph */}
            <div ref={stack} className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[30rem]">
              {booklet.map((p, i) => (
                <img
                  key={p.name}
                  data-page
                  src={p.img.src}
                  srcSet={`${p.img.src} 1280w, ${p.img.src2x} 2560w`}
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  alt={p.img.alt}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ clipPath: i === page ? "inset(0 0 0 0)" : "inset(0 0 0 100%)" }}
                />
              ))}
            </div>
          </div>
        </Fade>

        {/* The index - the contents page, always visible, one line per project. */}
        <Fade className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
          {booklet.map((p, i) => (
            <button
              key={p.name}
              type="button"
              onClick={() => turn(i)}
              aria-current={i === page ? "true" : undefined}
              className={`font-sans text-xs uppercase tracking-[0.14em] transition-colors duration-300 ${
                i === page ? "text-pmcc" : "text-smoke hover:text-bone"
              }`}
            >
              {pad(i)} {p.name}
            </button>
          ))}
        </Fade>
      </div>
    </section>
  );
}
