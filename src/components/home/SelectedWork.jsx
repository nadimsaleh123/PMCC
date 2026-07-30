/**
 * Selected work, not an inventory. A prospect reads a builder in three
 * moves — do I recognise the clients, can they do my kind of building, are
 * they busy now — so the section answers exactly those, grouped, with no
 * fake affordances: nothing here pretends to be a link except the one thing
 * that actually opens, the flagship banner at the end.
 */
import { Link } from "react-router-dom";
import { Lines, Fade } from "../reveal";
import { workGroups, project } from "../../data/content";

export default function SelectedWork() {
  return (
    <section className="bg-ink px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="type-eyebrow text-smoke">Selected work</p>
        <Lines className="type-display mt-6 max-w-3xl text-[clamp(2rem,4.6vw,3.8rem)] text-bone">
          Some of the projects, <em className="type-display-it text-stone">on the record.</em>
        </Lines>
        <Fade className="mt-4">
          <p className="max-w-md font-sans text-sm leading-relaxed text-smoke">
            A selection from a hundred-plus projects since 2002. The full record
            travels with every proposal.
          </p>
        </Fade>

        <div className="mt-14">
          {workGroups.map((g) => (
            <Fade
              key={g.title}
              className="grid gap-6 border-t border-seam py-12 lg:grid-cols-[1fr_1.4fr] lg:gap-12"
            >
              <div>
                <h3 className="type-display text-2xl text-bone sm:text-3xl">{g.title}</h3>
                <p className="mt-3 max-w-xs font-sans text-sm leading-relaxed text-smoke">{g.note}</p>
              </div>
              <ul className="self-center">
                {g.items.map((item) => (
                  <li
                    key={item.name}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-seam/60 py-4 last:border-0"
                  >
                    <span className="type-display text-lg text-bone/90 sm:text-xl">{item.name}</span>
                    <span className="font-sans text-xs text-smoke">{item.meta}</span>
                  </li>
                ))}
              </ul>
            </Fade>
          ))}
        </div>

        {/* The one clickable thing, and it looks like it. */}
        <Fade className="mt-4">
          <Link
            to="/daher-el-souane-563"
            data-cursor="view"
            className="group flex flex-col justify-between gap-6 bg-pmcc p-8 transition-transform duration-500 ease-out-expo hover:scale-[1.01] sm:flex-row sm:items-center sm:p-10"
          >
            <div>
              <p className="type-eyebrow text-bone/80">And our own development · now selling</p>
              <p className="type-display mt-3 text-3xl text-bone sm:text-4xl">
                {project.name} — {project.claim[0].toLowerCase()}{" "}
                <em className="type-display-it">{project.claim[1]}</em>
              </p>
            </div>
            <span
              aria-hidden
              className="type-display shrink-0 text-4xl text-bone transition-transform duration-500 ease-out-expo group-hover:translate-x-3"
            >
              →
            </span>
          </Link>
        </Fade>
      </div>
    </section>
  );
}
