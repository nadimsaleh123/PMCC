/**
 * The record as a typographic index — honest, complete, no stock photography.
 * The one row with something to sell is the one row printed in red.
 */
import { Link } from "react-router-dom";
import { Fade } from "../reveal";
import { works } from "../../data/content";

function Row({ w }) {
  const inner = (
    <div className="grid grid-cols-[4.5rem_1fr] items-baseline gap-x-4 gap-y-1 py-5 sm:grid-cols-[6rem_1.4fr_1fr_1fr] sm:gap-x-8">
      <p className="font-sans text-xs tabular-nums text-smoke">{w.year}</p>
      <h3
        className={`type-display text-xl transition-transform duration-500 ease-out-expo group-hover:translate-x-2 sm:text-2xl ${
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
      <p className="col-start-2 font-sans text-xs text-smoke sm:col-start-3">{w.place}</p>
      <p className="col-start-2 font-sans text-xs text-smoke sm:col-start-4">{w.scope}</p>
    </div>
  );

  return (
    <Fade className="group border-t border-seam last:border-b">
      {w.href ? <Link to={w.href}>{inner}</Link> : inner}
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
        <div className="mt-10">
          {works.map((w) => (
            <Row key={`${w.name}-${w.year}`} w={w} />
          ))}
        </div>
      </div>
    </section>
  );
}
