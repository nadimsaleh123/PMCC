/**
 * The booklet — selected projects as spreads of a monograph, with a real
 * page-turn.
 *
 * The turn is built the way a book actually works, not as a crossfade with
 * perspective sprinkled on. A leaf lifts at the gutter and rotates through
 * 180°; its front face is the page you were looking at and its back face is
 * the page that lands, so at every angle both sides are the truth. Light
 * leaves the page as it tilts away (a shade that peaks at 90°) and the leaf
 * casts a moving shadow on the page it is about to cover. Forward turns the
 * photograph over the words; backward lifts the words back over the
 * photograph — the two directions are mirror images, as they are in hand.
 *
 * The 3D turn runs on large screens with motion allowed. Small screens get a
 * flat wipe from the gutter — a phone shows one page, and half a book
 * flipping over nothing reads as broken — and reduced-motion gets an
 * instant swap.
 *
 * Both leaves are equal halves because a book's are; the photography loses a
 * little width to the text page and gains an object that behaves.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap, reducedMotion } from "../../lib/motion";
import { Fade, Lines } from "../reveal";
import { booklet } from "../../data/content";

const pad = (n) => String(n + 1).padStart(2, "0");

/** One text leaf. Rendered statically and on the faces of the turning page. */
function TextLeaf({ p, index }) {
  return (
    <div className="flex h-full flex-col justify-between gap-10 bg-bone p-8 sm:p-12">
      <div>
        <p className="font-sans text-xs tabular-nums text-ink/45">{pad(index)}</p>
        <h3 className="type-display mt-6 text-[clamp(1.9rem,3vw,2.8rem)] leading-[1.05] text-ink">
          {p.name}
        </h3>
        <p className="mt-3 font-sans text-xs uppercase tracking-[0.14em] text-ink/55">
          {p.place} · {p.year}
        </p>
        <p className="mt-6 max-w-sm font-sans text-sm leading-relaxed text-ink/70">{p.note}</p>
      </div>
      {p.link ? (
        <Link
          to={p.link}
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
    </div>
  );
}

function ImageFace({ p, eager = false }) {
  return (
    <img
      src={p.img.src}
      srcSet={`${p.img.src} 1280w, ${p.img.src2x} 2560w`}
      sizes="(min-width: 1024px) 50vw, 100vw"
      alt={p.img.alt}
      loading={eager ? "eager" : "lazy"}
      className="h-full w-full object-cover"
    />
  );
}

export default function Booklet() {
  const [page, setPage] = useState(0);
  // {from, to, dir} while a leaf is in the air; null when the book is at rest.
  const [turning, setTurning] = useState(null);

  const spread = useRef(null);
  const stack = useRef(null);
  const leafText = useRef(null);
  const turner = useRef(null);
  const shadeFront = useRef(null);
  const shadeBack = useRef(null);
  const cast = useRef(null);
  const busy = useRef(false);
  const skipFlat = useRef(false);
  const previous = useRef(0);

  const setStack = (index) => {
    (stack.current?.querySelectorAll("[data-page]") ?? []).forEach((el, i) => {
      el.style.clipPath = i === index ? "inset(0 0 0 0)" : "inset(0 0 0 100%)";
    });
  };

  const turn = (next) => {
    if (busy.current) return;
    const target = (next + booklet.length) % booklet.length;
    if (target === page) return;

    const canFlip =
      !reducedMotion() && window.matchMedia("(min-width: 1024px)").matches;

    if (!canFlip) {
      previous.current = page;
      setPage(target);
      return;
    }

    busy.current = true;
    setTurning({ from: page, to: target, dir: target > page || (page === booklet.length - 1 && target === 0) ? 1 : -1 });
  };

  // The flat path: a wipe from the gutter on small screens, instant under
  // reduced motion. Runs only when the 3D leaf did not already do the work.
  useLayoutEffect(() => {
    const from = previous.current;
    if (from === page) return undefined;
    if (skipFlat.current) {
      skipFlat.current = false;
      previous.current = page;
      return undefined;
    }
    previous.current = page;

    const images = stack.current?.querySelectorAll("[data-page]") ?? [];
    if (reducedMotion()) {
      setStack(page);
      return undefined;
    }
    const ctx = gsap.context(() => {
      const incoming = images[page];
      images.forEach((el, i) => {
        if (i !== page) gsap.set(el, { clipPath: i === from ? "inset(0 0 0 0)" : "inset(0 0 0 100%)", zIndex: 1 });
      });
      gsap.set(incoming, { zIndex: 2 });
      gsap.fromTo(incoming, { clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0%)", duration: 0.9, ease: "power3.inOut" });
      gsap.fromTo(leafText.current, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.65, delay: 0.15, ease: "power2.out" });
    }, stack.current);
    return () => ctx.revert();
  }, [page]);

  // The 3D turn. Mounts the leaf, flies it, then commits the state - by which
  // point the static spread underneath already looks exactly like the leaf's
  // landing position, so the unmount is invisible.
  useLayoutEffect(() => {
    if (!turning) return undefined;
    const { to, dir } = turning;

    setStack(dir === 1 ? to : turning.from);

    const ctx = gsap.context(() => {
      const rotation = dir === 1 ? -180 : 180;
      gsap.set(turner.current, {
        rotateY: 0,
        transformOrigin: dir === 1 ? "left center" : "right center",
        force3D: true,
      });

      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        onComplete: () => {
          setStack(to);
          skipFlat.current = true;
          busy.current = false;
          setPage(to);
          setTurning(null);
        },
      });

      tl.to(turner.current, { rotateY: rotation, duration: 1.15 }, 0)
        // Light leaves the page as it tilts away, and finds the back face as
        // it tilts in - both peak at the vertical.
        .fromTo(shadeFront.current, { opacity: 0 }, { opacity: 0.45, duration: 0.55, ease: "power1.in" }, 0)
        .set(shadeFront.current, { opacity: 0 }, 0.58)
        .fromTo(shadeBack.current, { opacity: 0.45 }, { opacity: 0, duration: 0.55, ease: "power1.out" }, 0.6)
        // The leaf's shadow sweeps the page it is about to cover.
        .fromTo(cast.current, { opacity: 0 }, { opacity: 0.35, duration: 0.55, ease: "power1.in" }, 0)
        .to(cast.current, { opacity: 0, duration: 0.55, ease: "power1.out" }, 0.6)
        // The book breathes once with the turn.
        .to(spread.current, { scale: 1.005, duration: 0.575, ease: "power1.inOut" }, 0)
        .to(spread.current, { scale: 1, duration: 0.575, ease: "power1.inOut" }, 0.575);
    }, spread.current);

    return () => ctx.revert();
  }, [turning]);

  // While a leaf is in the air the static spread shows what sits beneath it:
  // forward keeps the old words and reveals the new photograph; backward
  // reveals the old words and keeps the new... exactly as the physical pages
  // would stack.
  const leftIndex = turning ? (turning.dir === 1 ? turning.from : turning.to) : page;
  const turnFaces = turning
    ? turning.dir === 1
      ? { front: <ImageFace p={booklet[turning.from]} eager />, back: <TextLeaf p={booklet[turning.to]} index={turning.to} /> }
      : { front: <TextLeaf p={booklet[turning.from]} index={turning.from} />, back: <ImageFace p={booklet[turning.to]} eager /> }
    : null;

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
          <Fade className="flex items-center gap-5 pb-1">
            <p className="font-sans text-xs tabular-nums text-smoke" aria-live="polite">
              <span className="text-bone">{pad(turning ? turning.to : page)}</span> / {pad(booklet.length - 1)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => turn((turning ? turning.to : page) - 1)}
                aria-label="Previous project"
                className="grid h-11 w-11 place-items-center rounded-full border border-seam text-bone transition-colors duration-300 hover:border-bone/60"
              >
                <span aria-hidden>←</span>
              </button>
              <button
                type="button"
                onClick={() => turn((turning ? turning.to : page) + 1)}
                aria-label="Next project"
                className="grid h-11 w-11 place-items-center rounded-full border border-seam text-bone transition-colors duration-300 hover:border-bone/60"
              >
                <span aria-hidden>→</span>
              </button>
            </div>
          </Fade>
        </div>

        {/* The book. Perspective lives on this wrapper so the leaf turns in
            the room, not on the glass. */}
        <Fade className="mt-12">
          <div style={{ perspective: "2400px" }}>
          <div
            ref={spread}
            className="relative grid bg-bone shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] lg:grid-cols-2"
          >
            {/* Left leaf - the words (what sits beneath during a turn) */}
            <div className="relative order-2 lg:order-1">
              <div ref={leafText} className="h-full">
                <TextLeaf p={booklet[leftIndex]} index={leftIndex} />
              </div>
              {/* The gutter fold */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 hidden w-10 bg-gradient-to-l from-ink/15 to-transparent lg:block"
              />
              {/* Shadow cast by a leaf landing here (forward turns) */}
              {turning?.dir === 1 ? (
                <span ref={cast} aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-l from-ink/60 to-ink/10 opacity-0" />
              ) : null}
            </div>

            {/* Right leaf - the photograph stack */}
            <div ref={stack} className="relative order-1 aspect-[4/3] lg:order-2 lg:aspect-auto lg:min-h-[32rem]">
              {booklet.map((p, i) => (
                <img
                  key={p.name}
                  data-page
                  src={p.img.src}
                  srcSet={`${p.img.src} 1280w, ${p.img.src2x} 2560w`}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  alt={p.img.alt}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ clipPath: i === page ? "inset(0 0 0 0)" : "inset(0 0 0 100%)" }}
                />
              ))}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 hidden w-10 bg-gradient-to-r from-ink/20 to-transparent lg:block"
              />
              {/* Shadow cast by a leaf landing here (backward turns) */}
              {turning?.dir === -1 ? (
                <span ref={cast} aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink/60 to-ink/10 opacity-0" />
              ) : null}
            </div>

            {/* The turning leaf. Exists only mid-flight. */}
            {turnFaces ? (
              <div
                ref={turner}
                aria-hidden
                className="absolute inset-y-0 z-20 hidden lg:block"
                style={{
                  left: turning.dir === 1 ? "50%" : 0,
                  width: "50%",
                  transformStyle: "preserve-3d",
                }}
              >
                <div className="absolute inset-0 overflow-hidden bg-bone" style={{ backfaceVisibility: "hidden" }}>
                  {turnFaces.front}
                  <span
                    ref={shadeFront}
                    className="pointer-events-none absolute inset-0 opacity-0"
                    style={{
                      background:
                        turning.dir === 1
                          ? "linear-gradient(to right, rgba(20,17,15,0.9), rgba(20,17,15,0.2))"
                          : "linear-gradient(to left, rgba(20,17,15,0.9), rgba(20,17,15,0.2))",
                    }}
                  />
                </div>
                <div
                  className="absolute inset-0 overflow-hidden bg-bone"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  {turnFaces.back}
                  <span
                    ref={shadeBack}
                    className="pointer-events-none absolute inset-0 opacity-0"
                    style={{
                      background:
                        turning.dir === 1
                          ? "linear-gradient(to left, rgba(20,17,15,0.9), rgba(20,17,15,0.2))"
                          : "linear-gradient(to right, rgba(20,17,15,0.9), rgba(20,17,15,0.2))",
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
          </div>
        </Fade>

        {/* The contents page */}
        <Fade className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
          {booklet.map((p, i) => (
            <button
              key={p.name}
              type="button"
              onClick={() => turn(i)}
              aria-current={i === (turning ? turning.to : page) ? "true" : undefined}
              className={`font-sans text-xs uppercase tracking-[0.14em] transition-colors duration-300 ${
                i === (turning ? turning.to : page) ? "text-pmcc" : "text-smoke hover:text-bone"
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
