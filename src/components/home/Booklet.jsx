/**
 * The booklet — a hardbound architecture monograph open on the table, with a
 * real page-turn.
 *
 * Built as the photographed object, not a panel with a book drawn on it. The
 * camera sits slightly above (rotateX inside a deep perspective with a raised
 * origin, so the far edge genuinely foreshortens). The object has a body: a
 * warm-charcoal cloth cover proud of the pages with rim light on its boards,
 * stacked sheet edges at the flanks and fore-edge darkening toward the cover,
 * leaves compressed into fine lines in a shaded gutter valley with a paper
 * highlight where each page rises out of it, uncoated stock carrying a faint
 * fibrous grain, warm afternoon light entering from the left and falling off
 * across the far page, and a lit tabletop with a contact shadow holding the
 * book down.
 *
 * The turn obeys paper. The spread container carries its own perspective -
 * without it the leaf's rotation renders orthographically, as a flat squash,
 * which is the single loudest "CSS mockup" tell. The leaf twists a few
 * degrees off-axis under its own weight mid-flight, shades as it tilts away
 * from the light, catches a warm rim on its free edge, throws a shadow first
 * on the page it lifts from and then on the page it lands on, and settles
 * the last four degrees softly. Turning back mirrors the whole mechanism,
 * because a book does.
 *
 * The 3D turn runs on large screens with motion allowed. Small screens show
 * the plates stacked flat with a fade — half a book turning over nothing on
 * a phone reads as broken — and reduced-motion swaps instantly.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap, reducedMotion } from "../../lib/motion";
import { Fade, Lines } from "../reveal";
import { booklet } from "../../data/content";

const pad = (n) => String(n + 1).padStart(2, "0");

/** Fibrous grain of uncoated stock. One tiled SVG turbulence; alpha baked in,
 *  no blend mode - mix-blend forces per-frame re-rasterisation under an
 *  animating ancestor in WebKit, and at 5% over light paper plain alpha is
 *  indistinguishable from multiply. */
const PAPER_GRAIN =
  "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22180%22 height=%22180%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22180%22 height=%22180%22 filter=%22url(%23n)%22 opacity=%220.55%22/></svg>')";

const CLOTH_WEAVE =
  "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px)";

function PaperGrain() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.05]"
      style={{ backgroundImage: PAPER_GRAIN }}
    />
  );
}

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

/**
 * The left page: one featured plate with its caption beside it.
 * `plain` drops the grain overlay - used for the mid-flight copies, where a
 * blend layer inside a rotating face is a Safari backface-ghosting hazard.
 */
function LeftPage({ spread, eager = false, plain = false }) {
  const f = spread.feature;
  return (
    <div className="relative grid h-full grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5 bg-bone p-6 sm:p-8 lg:p-10">
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
      {plain ? null : <PaperGrain />}
    </div>
  );
}

/** The right page: four captioned plates, gridded as a printed portfolio. */
function RightPage({ spread, eager = false, plain = false }) {
  return (
    <div className="relative grid h-full grid-cols-2 gap-x-5 gap-y-4 bg-bone p-6 sm:p-8 lg:p-10">
      {spread.grid.map((item) => (
        <figure key={item.name} className="flex min-h-0 flex-col">
          <div className="aspect-[4/3] overflow-hidden lg:aspect-auto lg:min-h-0 lg:flex-1">
            <Plate img={item.img} eager={eager} />
          </div>
          <figcaption className="mt-2 shrink-0">
            <p className="type-display text-[0.95rem] leading-tight text-ink">{item.name}</p>
            <p className="mt-0.5 font-sans text-[0.68rem] text-ink/50 lg:text-[0.62rem]">{item.meta}</p>
          </figcaption>
        </figure>
      ))}
      {plain ? null : <PaperGrain />}
    </div>
  );
}

/** The stacked edges of the closed leaves at the flanks, darkening toward the board. */
function SheetEdges({ side }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-y-1 ${side === "left" ? "-left-[9px]" : "-right-[9px]"} hidden w-[9px] lg:block`}
      style={{
        background:
          `linear-gradient(${side === "left" ? "to left" : "to right"}, transparent, rgba(0,0,0,0.28)), ` +
          "repeating-linear-gradient(to right, #f0eadf 0px, #f0eadf 1.4px, #d6cfbf 1.4px, #d6cfbf 2.6px)",
        borderRadius: side === "left" ? "2px 0 0 2px" : "0 2px 2px 0",
        boxShadow:
          side === "left"
            ? "inset 2px 0 3px rgba(0,0,0,0.3), inset -1px 0 1px rgba(0,0,0,0.12)"
            : "inset -2px 0 3px rgba(0,0,0,0.3), inset 1px 0 1px rgba(0,0,0,0.12)",
      }}
    />
  );
}

/** A page's self-shading while it stands in the light, keyed by direction. */
const shadeGradient = (towardGutter) =>
  `linear-gradient(to ${towardGutter}, rgba(20,17,15,0.9), rgba(20,17,15,0.2))`;

export default function Booklet() {
  const [page, setPage] = useState(0);
  // {from, to, dir} while a leaf is in the air; null when the book is at rest.
  const [turning, setTurning] = useState(null);

  const book = useRef(null);
  const turner = useRef(null);
  const shadeFront = useRef(null);
  const shadeBack = useRef(null);
  const edgeFront = useRef(null);
  const edgeBack = useRef(null);
  const castLift = useRef(null);
  const castLand = useRef(null);
  const flat = useRef(null);
  const busy = useRef(false);

  // Warm every plate with the same candidate selection the render uses -
  // srcset included, decoded, and only where the flip can actually run. A
  // preload of the 1x file alone leaves every retina screen (the exact place
  // the flip is enabled) turning onto an undecoded 2x image.
  useEffect(() => {
    if (reducedMotion() || !window.matchMedia("(min-width: 1024px)").matches) return;
    booklet.forEach((s) => {
      [s.feature.img, ...s.grid.map((g) => g.img)].forEach(({ src, src2x }) => {
        const img = new Image();
        img.srcset = `${src} 1280w, ${src2x} 2560w`;
        img.sizes = "40vw";
        img.src = src;
        img.decode?.().catch(() => {});
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
    setTurning({ from: page, to: target, dir: next - page > 0 ? 1 : -1 });
  };

  // The 3D turn: mount the leaf, fly it, then commit the state - by which
  // point the static spread beneath already looks like the landing position,
  // so the handoff is invisible.
  useLayoutEffect(() => {
    if (!turning) return undefined;
    const { to, dir } = turning;

    const ctx = gsap.context(() => {
      gsap.set(turner.current, {
        rotateY: 0,
        rotateX: 0,
        rotateZ: 0,
        transformOrigin: dir === 1 ? "left center" : "right center",
        force3D: true,
      });

      const end = dir === 1 ? -180 : 180;

      const tl = gsap.timeline({
        onComplete: () => {
          busy.current = false;
          setPage(to);
          setTurning(null);
        },
      });

      // The arc, then the landing: paper does not stop dead - it lays down.
      tl.to(turner.current, { rotateY: end * (176 / 180), duration: 1.15, ease: "power2.inOut" }, 0)
        .to(turner.current, { rotateY: end, duration: 0.16, ease: "power1.out" }, 1.15)
        // Gravity twists the free leaf a few degrees off-axis mid-flight.
        .to(turner.current, { rotateX: 2.6, duration: 0.5, ease: "sine.in" }, 0.1)
        .to(turner.current, { rotateX: 0, duration: 0.55, ease: "sine.out" }, 0.62)
        .to(turner.current, { rotateZ: dir === 1 ? -0.9 : 0.9, duration: 0.5, ease: "sine.inOut" }, 0.18)
        .to(turner.current, { rotateZ: 0, duration: 0.5, ease: "sine.out" }, 0.72)
        // Light leaves the page as it tilts away and finds the back face as
        // it tilts in; both peak at the vertical.
        .fromTo(shadeFront.current, { opacity: 0 }, { opacity: 0.45, duration: 0.56, ease: "power1.in" }, 0)
        .set(shadeFront.current, { opacity: 0 }, 0.6)
        .fromTo(shadeBack.current, { opacity: 0.45 }, { opacity: 0, duration: 0.56, ease: "power1.out" }, 0.64)
        // The free edge catches the warm light while the leaf stands in it.
        .fromTo(edgeFront.current, { opacity: 0 }, { opacity: 0.9, duration: 0.45, ease: "sine.in" }, 0.12)
        .to(edgeFront.current, { opacity: 0, duration: 0.2 }, 0.58)
        .fromTo(edgeBack.current, { opacity: 0.9 }, { opacity: 0, duration: 0.5, ease: "sine.out" }, 0.62)
        // The leaf shadows the page it lifts from, then the page it lands on.
        .fromTo(castLift.current, { opacity: 0 }, { opacity: 0.32, duration: 0.4, ease: "power1.in" }, 0.05)
        .to(castLift.current, { opacity: 0, duration: 0.3, ease: "power1.out" }, 0.5)
        .fromTo(castLand.current, { opacity: 0 }, { opacity: 0.42, duration: 0.4, ease: "power1.in" }, 0.5)
        .to(castLand.current, { opacity: 0, duration: 0.3, ease: "power1.out" }, 0.98)
        // The book breathes once with the turn.
        .to(book.current, { scale: 1.005, duration: 0.62, ease: "power1.inOut" }, 0)
        .to(book.current, { scale: 1, duration: 0.62, ease: "power1.inOut" }, 0.62);
    }, book.current);

    return () => ctx.revert();
  }, [turning]);

  // While a leaf is in the air the static book shows what sits beneath it.
  // Forward: the old words stay (until the leaf lands on them) and the new
  // plates are revealed. Backward: the mirror. Exactly as the pages stack.
  const dir = turning?.dir ?? 1;
  const leftSpread = booklet[turning ? (dir === 1 ? turning.from : turning.to) : page];
  const rightSpread = booklet[turning ? (dir === 1 ? turning.to : turning.from) : page];
  const shown = turning ? turning.to : page;

  const faceStyle = (isBack) => ({
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    // Both faces own a 3D transform: WebKit's backface culling is unreliable
    // for a face inside a rotating preserve-3d parent that has none.
    transform: isBack ? "rotateY(180deg)" : "translateZ(0)",
  });

  return (
    <section className="overflow-x-clip bg-ink px-5 py-28 sm:px-8" aria-label="Project booklet">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[minmax(13rem,1fr)_minmax(0,4fr)] lg:gap-14">
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

            <div className="relative min-w-0 flex-1">
              {/* The lit tabletop and the shadows that hold the book to it.
                  Outside the perspective, so the book tilts and the table
                  does not. */}
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-x-24 -inset-y-16 hidden lg:block"
                style={{ background: "radial-gradient(58% 72% at 49% 52%, rgba(66,56,45,0.5), rgba(32,26,21,0.22) 58%, transparent 78%)" }}
              />
              <span aria-hidden className="pointer-events-none absolute -bottom-8 left-[53%] hidden h-16 w-[94%] -translate-x-1/2 rounded-[50%] bg-black/60 blur-2xl lg:block" />
              <span aria-hidden className="pointer-events-none absolute -bottom-2.5 left-[52%] hidden h-5 w-[99%] -translate-x-1/2 rounded-[50%] bg-black/50 blur-md lg:block" />

              <div style={{ perspective: "1800px", perspectiveOrigin: "50% 20%" }}>
                {/* The camera: slightly above the table, looking down the spine. */}
                <div className="lg:[transform:rotateX(7deg)]" style={{ transformStyle: "preserve-3d" }}>
                  <div ref={book} className="relative" style={{ transformStyle: "preserve-3d" }}>
                    {/* The cloth-bound boards, proud of the pages, rim-lit
                        along the top where the light grazes them. */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -inset-x-[15px] -inset-y-[11px] hidden lg:block"
                      style={{
                        borderRadius: "6px 10px 10px 6px",
                        background: `linear-gradient(105deg, #322a22, #241e18 30%, #2b241c 47%, #17120e 51%, #2b241c 55%, #241e18 76%, #150f0c), ${CLOTH_WEAVE}`,
                        boxShadow:
                          "inset 1px 1px 0 rgba(255,235,200,0.09), inset -1px -1px 0 rgba(0,0,0,0.55), inset 0 -3px 4px rgba(0,0,0,0.4)",
                      }}
                    />
                    <SheetEdges side="left" />
                    <SheetEdges side="right" />
                    {/* Fore-edge: the sheet stack along the bottom */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -bottom-[8px] inset-x-1 hidden h-[8px] lg:block"
                      style={{
                        background:
                          "linear-gradient(to bottom, transparent, rgba(0,0,0,0.26)), repeating-linear-gradient(to bottom, #ece5d8 0px, #ece5d8 1.3px, #d2cabb 1.3px, #d2cabb 2.4px)",
                        borderRadius: "0 0 2px 2px",
                        boxShadow: "inset 0 -2px 3px rgba(0,0,0,0.38)",
                      }}
                    />

                    {/* The open spread. Its own perspective is load-bearing:
                        this div is transform-style flat, so without a
                        perspective here the leaf's rotation renders
                        orthographically - a flat squash, the loudest single
                        "CSS mockup" tell there is. */}
                    <div ref={flat} className="relative grid bg-bone lg:block lg:aspect-[15/7]" style={{ perspective: "2400px" }}>
                      {/* Left page (mobile: the feature, stacked) */}
                      <div className="relative lg:absolute lg:inset-y-0 lg:left-0 lg:w-1/2">
                        <div className="lg:h-full">
                          <LeftPage spread={leftSpread} eager />
                        </div>
                        {/* The page bows into the binding */}
                        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-24 lg:block" style={{ background: "linear-gradient(to left, rgba(20,17,15,0.34), rgba(20,17,15,0.12) 45%, transparent)" }} />
                        {/* Light off the curved paper as it rises from the fold */}
                        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 z-10 hidden w-1.5 bg-gradient-to-l from-white/20 to-transparent lg:block" />
                        {turning ? (
                          <span
                            ref={dir === 1 ? castLand : castLift}
                            aria-hidden
                            className="pointer-events-none absolute inset-0 z-20 opacity-0"
                            style={{ background: "linear-gradient(to left, rgba(28,22,15,0.6), rgba(28,22,15,0.12) 55%, transparent)" }}
                          />
                        ) : null}
                      </div>

                      {/* Right page */}
                      <div className="hidden lg:absolute lg:inset-y-0 lg:right-0 lg:block lg:w-1/2">
                        <RightPage spread={rightSpread} eager />
                        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24" style={{ background: "linear-gradient(to right, rgba(20,17,15,0.38), rgba(20,17,15,0.14) 45%, transparent)" }} />
                        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 z-10 w-1.5 bg-gradient-to-r from-white/25 to-transparent" />
                        {turning ? (
                          <span
                            ref={dir === 1 ? castLift : castLand}
                            aria-hidden
                            className="pointer-events-none absolute inset-0 z-20 opacity-0"
                            style={{ background: "linear-gradient(to right, rgba(28,22,15,0.6), rgba(28,22,15,0.12) 55%, transparent)" }}
                          />
                        ) : null}
                      </div>
                      {/* Mobile: the grid below the feature, flat */}
                      <div className="lg:hidden">
                        <RightPage spread={rightSpread} eager />
                      </div>

                      {/* The gutter: a shaded valley with the compressed
                          leaves packed into the fold, and a paper highlight
                          where each page rises out of it. */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-1/2 z-10 hidden w-14 -translate-x-1/2 lg:block"
                        style={{
                          background:
                            "linear-gradient(to right, transparent, rgba(58,48,34,0.2) 34%, rgba(34,27,19,0.5) 50%, rgba(58,48,34,0.2) 66%, transparent), " +
                            "linear-gradient(to right, transparent 24%, rgba(255,252,244,0.22) 26%, transparent 30%, transparent 70%, rgba(255,252,244,0.22) 74%, transparent 76%), " +
                            "repeating-linear-gradient(to right, transparent 0 3px, rgba(0,0,0,0.12) 3px 3.8px)",
                          maskImage: "linear-gradient(to right, transparent, black 25%, black 75%, transparent)",
                          WebkitMaskImage: "linear-gradient(to right, transparent, black 25%, black 75%, transparent)",
                        }}
                      />

                      {/* Afternoon light entering from the left, falling off
                          across the far page. */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-10 hidden lg:block"
                        style={{
                          background:
                            "linear-gradient(100deg, rgba(255,241,212,0.16), rgba(255,241,212,0.05) 32%, transparent 50%, rgba(20,16,12,0.08) 76%, rgba(20,16,12,0.16))",
                        }}
                      />

                      {/* The turning leaf. Exists only mid-flight. */}
                      {turning ? (
                        <div
                          ref={turner}
                          aria-hidden
                          className={`absolute inset-y-0 z-30 hidden w-1/2 lg:block ${dir === 1 ? "left-1/2" : "left-0"}`}
                          style={{ transformStyle: "preserve-3d" }}
                        >
                          <div className="absolute inset-0 overflow-hidden" style={faceStyle(false)}>
                            {dir === 1 ? (
                              <RightPage spread={booklet[turning.from]} eager plain />
                            ) : (
                              <LeftPage spread={booklet[turning.from]} eager plain />
                            )}
                            <span
                              ref={shadeFront}
                              className="pointer-events-none absolute inset-0 opacity-0"
                              style={{ background: shadeGradient(dir === 1 ? "right" : "left") }}
                            />
                            <span
                              ref={edgeFront}
                              className={`pointer-events-none absolute inset-y-0 w-[3px] opacity-0 ${dir === 1 ? "right-0" : "left-0"}`}
                              style={{ background: `linear-gradient(to ${dir === 1 ? "left" : "right"}, rgba(255,238,205,0.95), transparent)` }}
                            />
                          </div>
                          <div className="absolute inset-0 overflow-hidden" style={faceStyle(true)}>
                            {dir === 1 ? (
                              <LeftPage spread={booklet[turning.to]} eager plain />
                            ) : (
                              <RightPage spread={booklet[turning.to]} eager plain />
                            )}
                            <span
                              ref={shadeBack}
                              className="pointer-events-none absolute inset-0 opacity-0"
                              style={{ background: shadeGradient(dir === 1 ? "left" : "right") }}
                            />
                            <span
                              ref={edgeBack}
                              className={`pointer-events-none absolute inset-y-0 w-[3px] opacity-0 ${dir === 1 ? "left-0" : "right-0"}`}
                              style={{ background: `linear-gradient(to ${dir === 1 ? "right" : "left"}, rgba(255,238,205,0.95), transparent)` }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
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
