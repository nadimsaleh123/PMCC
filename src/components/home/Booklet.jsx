/**
 * The booklet — an open monograph photographed on the table, with a real
 * page-turn.
 *
 * Modelled on the printed object, not on a carousel wearing one: the heading
 * sits beside the book, not inside it; the pages carry a featured plate on
 * the left and a captioned grid on the right, the way a portfolio is actually
 * laid out; and the book has a body — a dark cover proud of the pages, the
 * stacked sheet edges of the closed leaves, a bowed gutter, and a pool of
 * shadow underneath it.
 *
 * The turn is built the way a book works. A leaf lifts at the gutter and
 * rotates through 180° in perspective; its front face is the right-hand page
 * you were looking at and its back face is the left-hand page of the next
 * spread, so at every angle both sides are the truth. Light leaves the page
 * as it tilts away, and the leaf casts a moving shadow on the page it is
 * about to cover.
 *
 * The 3D turn runs on large screens with motion allowed. Small screens show
 * the plates stacked flat with a crossfade — half a book turning over
 * nothing on a phone reads as broken — and reduced-motion swaps instantly.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap, reducedMotion } from "../../lib/motion";
import { Fade, Lines } from "../reveal";
import { booklet } from "../../data/content";

const pad = (n) => String(n + 1).padStart(2, "0");

function Plate({ img, eager = false, className = "" }) {
  return (
    <img
      src={img.src}
      srcSet={`${img.src} 1280w, ${img.src2x} 2560w`}
      sizes="40vw"
      alt={img.alt}
      loading={eager ? "eager" : "lazy"}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

/** The left page: one featured plate with its caption beside it. */
function LeftPage({ spread, eager = false }) {
  const f = spread.feature;
  return (
    <div className="grid h-full grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5 bg-bone p-6 sm:p-8 lg:p-10">
      <div className="flex flex-col justify-center">
        <h3 className="type-display text-[clamp(1.3rem,1.9vw,1.9rem)] leading-tight text-ink">{f.name}</h3>
        <p className="mt-2 font-sans text-[0.7rem] text-ink/55">{f.meta}</p>
        <span aria-hidden className="mt-5 block h-px w-16 bg-ink/25" />
        {f.link ? (
          <Link
            to={f.link}
            data-cursor="view"
            className="group mt-5 inline-flex items-center gap-2 font-sans text-[0.65rem] uppercase tracking-[0.16em] text-ink/70 transition-colors hover:text-pmcc"
          >
            View project
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </Link>
        ) : (
          <p className="mt-5 font-sans text-[0.65rem] uppercase tracking-[0.16em] text-ink/40">Selected plates</p>
        )}
      </div>
      <div className="aspect-[4/5] overflow-hidden lg:aspect-auto">
        <Plate img={f.img} eager={eager} />
      </div>
    </div>
  );
}

/** The right page: four captioned plates, gridded as a printed portfolio. */
function RightPage({ spread, eager = false }) {
  return (
    <div className="grid h-full grid-cols-2 gap-x-5 gap-y-4 bg-bone p-6 sm:p-8 lg:p-10">
      {spread.grid.map((item) => (
        <figure key={item.name} className="flex min-h-0 flex-col">
          <div className="aspect-[4/3] overflow-hidden lg:aspect-auto lg:min-h-0 lg:flex-1">
            <Plate img={item.img} eager={eager} />
          </div>
          <figcaption className="mt-2 shrink-0">
            <p className="type-display text-[0.95rem] leading-tight text-ink">{item.name}</p>
            <p className="mt-0.5 font-sans text-[0.62rem] text-ink/50">{item.meta}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/** The stacked edges of the closed leaves — the tell that this is a book. */
function SheetEdges({ side }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-y-1 ${side === "left" ? "-left-2" : "-right-2"} hidden w-2 lg:block`}
      style={{
        background:
          "repeating-linear-gradient(to right, #efe9dd 0px, #efe9dd 1.5px, #d9d2c2 1.5px, #d9d2c2 2.5px)",
        borderRadius: side === "left" ? "2px 0 0 2px" : "0 2px 2px 0",
        boxShadow: side === "left" ? "inset 2px 0 3px rgba(0,0,0,0.25)" : "inset -2px 0 3px rgba(0,0,0,0.25)",
      }}
    />
  );
}

export default function Booklet() {
  const [page, setPage] = useState(0);
  // {from, to, dir} while a leaf is in the air; null when the book is at rest.
  const [turning, setTurning] = useState(null);

  const book = useRef(null);
  const turner = useRef(null);
  const shadeFront = useRef(null);
  const shadeBack = useRef(null);
  const cast = useRef(null);
  const flat = useRef(null);
  const busy = useRef(false);

  // Warm every plate once so a leaf never turns onto an undecoded image.
  useEffect(() => {
    booklet.forEach((s) => {
      [s.feature.img, ...s.grid.map((g) => g.img)].forEach(({ src }) => {
        const img = new Image();
        img.src = src;
      });
    });
  }, []);

  const turn = (next) => {
    if (busy.current) return;
    const target = (next + booklet.length) % booklet.length;
    if (target === page) return;

    const canFlip = !reducedMotion() && window.matchMedia("(min-width: 1024px)").matches;
    if (!canFlip) {
      setPage(target);
      if (!reducedMotion() && flat.current) {
        gsap.fromTo(flat.current, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" });
      }
      return;
    }

    busy.current = true;
    setTurning({ from: page, to: target, dir: 1 });
  };

  // The 3D turn: mount the leaf, fly it, then commit the state - by which
  // point the static spread beneath already looks like the landing position,
  // so the handoff is invisible.
  useLayoutEffect(() => {
    if (!turning) return undefined;
    const { to } = turning;

    const ctx = gsap.context(() => {
      gsap.set(turner.current, { rotateY: 0, transformOrigin: "left center", force3D: true });

      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        onComplete: () => {
          busy.current = false;
          setPage(to);
          setTurning(null);
        },
      });

      tl.to(turner.current, { rotateY: -180, duration: 1.2 }, 0)
        .fromTo(shadeFront.current, { opacity: 0 }, { opacity: 0.45, duration: 0.58, ease: "power1.in" }, 0)
        .set(shadeFront.current, { opacity: 0 }, 0.6)
        .fromTo(shadeBack.current, { opacity: 0.45 }, { opacity: 0, duration: 0.58, ease: "power1.out" }, 0.62)
        .fromTo(cast.current, { opacity: 0 }, { opacity: 0.4, duration: 0.58, ease: "power1.in" }, 0)
        .to(cast.current, { opacity: 0, duration: 0.58, ease: "power1.out" }, 0.62)
        .to(book.current, { scale: 1.006, duration: 0.6, ease: "power1.inOut" }, 0)
        .to(book.current, { scale: 1, duration: 0.6, ease: "power1.inOut" }, 0.6);
    }, book.current);

    return () => ctx.revert();
  }, [turning]);

  // While a leaf is in the air the static book shows what sits beneath it:
  // the old left page (until the leaf lands on it) and the new right page
  // (revealed as the leaf lifts away).
  const leftSpread = booklet[turning ? turning.from : page];
  const rightSpread = booklet[turning ? turning.to : page];
  const shown = turning ? turning.to : page;

  return (
    <section className="overflow-x-clip bg-ink px-5 py-28 sm:px-8" aria-label="Project booklet">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[minmax(15rem,1fr)_minmax(0,3.4fr)] lg:gap-16">
        {/* The heading lives beside the book, as it does in the photograph. */}
        <div>
          <Lines className="type-display text-[clamp(2rem,3.4vw,3.2rem)] leading-[1.08] text-bone">
            Selected <em className="type-display-it text-stone">Projects</em>
          </Lines>
          <Fade className="mt-6">
            <p className="max-w-[16rem] font-sans text-sm leading-relaxed text-smoke">
              A closer look at the spaces we&rsquo;ve shaped over the years. Timeless design.
              Lasting impact.
            </p>
          </Fade>
          <Fade className="mt-10">
            <a
              href="#record"
              className="group inline-flex items-center gap-3 font-sans text-xs uppercase tracking-[0.16em] text-bone/80 transition-colors hover:text-bone"
            >
              View full portfolio
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
            </a>
          </Fade>
          <Fade className="mt-10 flex items-center gap-4 lg:mt-14">
            <p className="font-sans text-xs tabular-nums text-smoke" aria-live="polite">
              <span className="text-bone">{pad(shown)}</span> / {pad(booklet.length - 1)}
            </p>
          </Fade>
        </div>

        {/* The book, flanked by its page-turn controls. */}
        <Fade>
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => turn(page - 1)}
              aria-label="Previous spread"
              className="hidden h-12 w-12 shrink-0 place-items-center rounded-full border border-seam text-bone transition-colors duration-300 hover:border-bone/60 sm:grid"
            >
              <span aria-hidden>←</span>
            </button>

            <div className="min-w-0 flex-1" style={{ perspective: "2600px" }}>
              <div ref={book} className="relative">
                {/* The cover, proud of the pages on every side */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-x-3 -inset-y-2 rounded-[4px] bg-[#171310] shadow-[0_60px_90px_-30px_rgba(0,0,0,0.85)]"
                />
                <SheetEdges side="left" />
                <SheetEdges side="right" />

                {/* The open spread */}
                <div className="relative grid bg-bone lg:block lg:aspect-[15/7]">
                  {/* Left page (mobile: the feature, stacked) */}
                  <div ref={flat} className="relative lg:absolute lg:inset-y-0 lg:left-0 lg:w-1/2">
                    <div className="lg:h-full">
                      <LeftPage spread={leftSpread} eager />
                    </div>
                    {/* Bow of the page toward the gutter */}
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-16 bg-gradient-to-l from-ink/20 via-ink/5 to-transparent lg:block" />
                    {/* Shadow cast by the landing leaf */}
                    {turning ? (
                      <span ref={cast} aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-l from-ink/60 to-ink/10 opacity-0" />
                    ) : null}
                  </div>

                  {/* Right page */}
                  <div className="hidden lg:absolute lg:inset-y-0 lg:right-0 lg:block lg:w-1/2">
                    <RightPage spread={rightSpread} eager />
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ink/25 via-ink/5 to-transparent" />
                  </div>
                  {/* Mobile: the grid below the feature, flat */}
                  <div className="lg:hidden">
                    <RightPage spread={rightSpread} eager />
                  </div>

                  {/* The turning leaf. Exists only mid-flight. */}
                  {turning ? (
                    <div
                      ref={turner}
                      aria-hidden
                      className="absolute inset-y-0 left-1/2 z-20 hidden w-1/2 lg:block"
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <div className="absolute inset-0 overflow-hidden" style={{ backfaceVisibility: "hidden" }}>
                        <RightPage spread={booklet[turning.from]} eager />
                        <span
                          ref={shadeFront}
                          className="pointer-events-none absolute inset-0 opacity-0"
                          style={{ background: "linear-gradient(to right, rgba(20,17,15,0.9), rgba(20,17,15,0.2))" }}
                        />
                      </div>
                      <div
                        className="absolute inset-0 overflow-hidden"
                        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                      >
                        <LeftPage spread={booklet[turning.to]} eager />
                        <span
                          ref={shadeBack}
                          className="pointer-events-none absolute inset-0 opacity-0"
                          style={{ background: "linear-gradient(to left, rgba(20,17,15,0.9), rgba(20,17,15,0.2))" }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => turn(page + 1)}
              aria-label="Next spread"
              className="hidden h-12 w-12 shrink-0 place-items-center rounded-full border border-seam text-bone transition-colors duration-300 hover:border-bone/60 sm:grid"
            >
              <span aria-hidden>→</span>
            </button>
          </div>

          {/* Mobile turn controls */}
          <div className="mt-6 flex justify-center gap-3 sm:hidden">
            <button
              type="button"
              onClick={() => turn(page - 1)}
              aria-label="Previous spread"
              className="grid h-11 w-11 place-items-center rounded-full border border-seam text-bone"
            >
              <span aria-hidden>←</span>
            </button>
            <button
              type="button"
              onClick={() => turn(page + 1)}
              aria-label="Next spread"
              className="grid h-11 w-11 place-items-center rounded-full border border-seam text-bone"
            >
              <span aria-hidden>→</span>
            </button>
          </div>
        </Fade>
      </div>
    </section>
  );
}
