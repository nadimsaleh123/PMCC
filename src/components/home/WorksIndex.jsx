/**
 * The record as a typographic index — honest, complete, no stock photography.
 * Each row carries its ledger number; the one row with something to sell is
 * printed in red and opens the flagship page.
 */
import { Link } from "react-router-dom";
import { Fade } from "../reveal";
import { works } from "../../data/content";

function Row({ w, index }) {
  const inner = (
    <div className="grid grid-cols-[2.6rem_1fr] items-baseline gap-x-3 px-3 py-6 transition-colors duration-300 group-hover:bg-coal sm:grid-cols-[3.5rem_5rem_1.5fr_1fr_1fr_2rem] sm:gap-x-6 sm:px-4">
      <p className="font-sans text-xs tabular-nums text-smoke/60 transition-colors duration-300 group-hover:text-pmcc">
        {String(index + 1).padStart(2, "0")}
      </p>
      <p className="hidden font-sans text-xs tabular-nums text-stone sm:block">{w.year}</p>
      <h3
        className={`type-display text-2xl transition-transform duration-500 ease-out-expo group-hover:translate-x-2 sm:text-3xl ${
          w.href ? "text-pmcc" : "text-bone"
        }`}
      >
        {w.name}
        {w.status ? (
          <span className="mt-1 block w-fit whitespace-nowrap font-sans text-[0.65rem] font-semibold uppercase tracking-wideish text-stone sm:ml-3 sm:mt-0 sm:inline sm:w-auto sm:align-middle">
            {w.status}
          </span>
        ) : null}
      </h3>
      <p className="col-start-2 font-sans text-xs text-smoke sm:col-start-4">
        <span className="sm:hidden">{w.year} · </span>
        {w.place}
      </p>
      <p className="col-start-2 font-sans text-xs text-smoke sm:col-start-5">{w.scope}</p>
      <p
        aria-hidden="true"
        className="hidden justify-self-end font-sans text-lg text-smoke/0 transition-all duration-300 group-hover:translate-x-1 group-hover:text-bone sm:block"
      >
        →
      </p>
    </div>
  );

  return (
    <Fade className="group border-t border-seam last:border-b">
      {w.href ? (
        <Link to={w.href} data-cursor="view">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </Fade>
  );
}

export default function WorksIndex() {
  return (
    <section className="bg-ink px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-baseline justify-between">
          <p className="type-eyebrow text-smoke">The record</p>
          <p className="font-sans text-xs text-smoke">{works.length} entries · 2002 → today</p>
        </div>
        <h2 className="type-display mt-6 text-[clamp(2rem,4.6vw,3.8rem)] text-bone">
          Every project since 2002, <em className="type-display-it text-stone">on the record.</em>
        </h2>
        <div className="mt-12">
          {works.map((w, i) => (
            <Row key={`${w.name}-${w.year}`} w={w} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
