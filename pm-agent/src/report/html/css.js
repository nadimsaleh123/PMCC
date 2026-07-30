/**
 * The print stylesheet.
 *
 * Written for paper, not for a screen that happens to be printed. Sizes are in mm
 * and pt because that is what the output is measured in, and every colour is
 * checked to survive a black-and-white photocopy - which is what a client's
 * document controller will do to it.
 *
 * Chromium does not implement CSS @page margin boxes (@bottom-center et al), so
 * page numbering comes from Playwright's footerTemplate, not from here. Page
 * margins are likewise set by page.pdf() so the two never fight.
 */

/** Chart palette. Validated with the dataviz skill's validator against white paper:
 *  lightness band, chroma floor, and 3:1 contrast all pass.
 *
 *  Deliberately ONE hue. Actual and forecast are the same entity in two time
 *  regimes, so they share a colour and separate by line style; the baseline is a
 *  neutral reference rather than a competing series. That keeps identity readable
 *  in greyscale and avoids borrowing a status colour for a data series. */
export const CHART = {
  series: '#1D4ED8',
  seriesWash: 'rgba(29, 78, 216, 0.10)',
  reference: '#9CA3AF',
};

export function stylesheet(brand, { fontCss }) {
  const c = brand.colours;
  const page = brand.page;

  return `
${fontCss}

/* Tinted panels and coloured rules are information here, not decoration, so they
   must not be stripped by the print pipeline. */
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

html, body {
  margin: 0;
  padding: 0;
  background: #FFFFFF;
  color: ${c.body};
  font-family: 'IBM Plex Sans', 'Liberation Sans', 'Helvetica Neue', Arial, sans-serif;
  font-size: 8.6pt;
  line-height: 1.42;
  -webkit-font-smoothing: antialiased;
}

/* Every column of numbers aligns; standalone display figures do not use tabular
   digits, because equal-width digits make a large number look loose. */
table, .tabular { font-variant-numeric: tabular-nums; }

h1, h2, h3, h4 { margin: 0; color: ${c.ink}; font-weight: 600; }

a { color: inherit; text-decoration: none; }

.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }

/* ---------- letterhead ---------- */

.letterhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 8mm; }
.letterhead .mark { display: flex; align-items: center; gap: 4mm; }
.letterhead img { height: ${page.logoHeightMm ?? brand.company.logoHeightMm ?? 14}mm; width: auto; display: block; }
.letterhead .company { font-size: 13pt; font-weight: 600; color: ${c.ink}; letter-spacing: -0.01em; }
.letterhead .descriptor { font-size: 7.4pt; color: ${c.muted}; margin-top: 0.6mm; }
.letterhead .doctype { text-align: right; }
.letterhead .doctype .kind {
  font-size: 9pt; font-weight: 600; color: ${c.ink};
  text-transform: uppercase; letter-spacing: 0.09em;
}
.letterhead .doctype .no { font-size: 7.4pt; color: ${c.muted}; margin-top: 0.8mm; }

/* The one genuine brand device carried over from the website: a 120x6 yellow rule. */
.rule { height: 1.6mm; width: 32mm; background: ${c.accent}; margin: 3mm 0 0; }
.rule.full { width: 100%; height: 0.35mm; background: ${c.rule}; }

.projectline { display: flex; justify-content: space-between; align-items: baseline; margin-top: 3mm; }
.projectline .name { font-size: 15pt; font-weight: 600; color: ${c.ink}; letter-spacing: -0.015em; }
.projectline .meta { font-size: 7.6pt; color: ${c.muted}; text-align: right; }

/* ---------- sections ---------- */

.section { margin-top: 4.5mm; break-inside: avoid; }
.section > .eyebrow {
  font-size: 7pt; font-weight: 600; color: ${c.ink};
  text-transform: uppercase; letter-spacing: 0.11em;
  padding-bottom: 1.4mm; border-bottom: 0.35mm solid ${c.rule};
  margin-bottom: 2.2mm;
}
.section > .eyebrow .count { color: ${c.muted}; font-weight: 400; letter-spacing: 0.04em; }

.cols { display: flex; gap: 6mm; align-items: flex-start; }
.cols > * { min-width: 0; }
.col-60 { flex: 0 0 58%; }
.col-40 { flex: 1 1 auto; }

/* ---------- hero + stat tiles ---------- */

.headline { display: flex; gap: 4mm; margin-top: 4mm; align-items: stretch; }

.hero {
  flex: 0 0 62mm;
  border: 0.35mm solid ${c.rule};
  border-left: 1.4mm solid ${c.accent};
  padding: 3mm 4mm;
  background: ${c.panel};
}
.hero .label {
  font-size: 6.8pt; color: ${c.muted}; text-transform: uppercase;
  letter-spacing: 0.1em; font-weight: 500;
}
/* Hero figure: same sans as everything else, proportional digits. A serif or a
   display face here reads as decoration. */
.hero .value {
  font-size: 21pt; font-weight: 600; color: ${c.ink};
  margin-top: 1.4mm; letter-spacing: -0.02em; line-height: 1.1;
}
.hero .delta { font-size: 7.6pt; margin-top: 1.2mm; font-weight: 500; }
.hero .sub { font-size: 6.8pt; color: ${c.muted}; margin-top: 0.8mm; }

.tiles { flex: 1 1 auto; display: flex; gap: 4mm; }
.tile {
  flex: 1 1 0;
  border: 0.35mm solid ${c.rule};
  padding: 3.4mm 3.4mm;
  display: flex; flex-direction: column; justify-content: space-between;
}
.tile .label {
  font-size: 6.6pt; color: ${c.muted}; text-transform: uppercase;
  letter-spacing: 0.09em; font-weight: 500;
}
.tile .value { font-size: 14pt; font-weight: 600; color: ${c.ink}; margin-top: 1.6mm; letter-spacing: -0.015em; }
.tile .sub { font-size: 6.6pt; color: ${c.muted}; margin-top: 0.8mm; line-height: 1.3; }

/* Not-measured is stated, never rendered as zero. It reads as an admitted gap. */
.unmeasured { font-size: 9.5pt; font-weight: 500; color: ${c.muted}; font-style: italic; letter-spacing: 0; }
.unmeasured-note { font-size: 6.4pt; color: ${c.muted}; font-style: normal; margin-top: 0.6mm; }

/* ---------- status ---------- */

/* Never colour alone: every pill carries its word, so it survives greyscale. */
.pill {
  display: inline-block; padding: 0.6mm 2mm; border-radius: 0.8mm;
  font-size: 6.8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em;
  border: 0.3mm solid currentColor;
}
.pill.green { color: ${c.green}; background: rgba(21, 128, 61, 0.07); }
.pill.amber { color: ${c.amber}; background: rgba(180, 83, 9, 0.07); }
.pill.red   { color: ${c.red};   background: rgba(185, 28, 28, 0.07); }
.pill.grey  { color: ${c.muted}; background: ${c.panel}; }

.dot { display: inline-block; width: 1.8mm; height: 1.8mm; border-radius: 50%; margin-right: 1.2mm; vertical-align: middle; }
.dot.green { background: ${c.green}; } .dot.amber { background: ${c.amber}; } .dot.red { background: ${c.red}; }

/* ---------- movements ---------- */

.movements { list-style: none; margin: 0; padding: 0; }
.movements li {
  position: relative; padding-left: 4mm; margin-bottom: 1.2mm; font-size: 8.4pt;
}
.movements li::before {
  content: ''; position: absolute; left: 0; top: 1.5mm;
  width: 1.4mm; height: 1.4mm; border-radius: 50%; background: ${c.rule};
}
.movements li.emphasis { font-weight: 500; color: ${c.ink}; }
.movements li.emphasis::before { background: ${c.accent}; }
.movements li.flag::before { background: ${c.amber}; }

/* ---------- tables ---------- */

table { width: 100%; border-collapse: collapse; font-size: 7.6pt; table-layout: fixed; }
thead th {
  text-align: left; font-size: 6.5pt; font-weight: 600; color: ${c.muted};
  text-transform: uppercase; letter-spacing: 0.08em;
  padding: 0 2mm 1.4mm 0; border-bottom: 0.35mm solid ${c.rule};
}
tbody td { padding: 1.3mm 2mm 1.3mm 0; word-wrap: break-word; border-bottom: 0.25mm solid ${c.rule}; vertical-align: top; }
tbody tr:last-child td { border-bottom: none; }
/* Right-aligned columns keep a gutter unless they are the last column, otherwise
   a right-aligned value butts straight into the next heading. */
td.num, th.num { text-align: right; padding-right: 3mm; }
tr > td.num:last-child, tr > th.num:last-child { padding-right: 0; }
td.strong { color: ${c.ink}; font-weight: 500; }
.muted { color: ${c.muted}; }
.tight { font-size: 6.8pt; line-height: 1.3; }

/* ---------- callout ---------- */

.callout {
  border: 0.35mm solid ${c.rule}; border-left: 1.4mm solid ${c.amber};
  background: ${c.panel}; padding: 2.6mm 3.4mm; font-size: 7.4pt; margin-bottom: 3mm;
}
.callout .title {
  font-weight: 600; color: ${c.ink}; text-transform: uppercase;
  letter-spacing: 0.08em; font-size: 6.6pt; margin-bottom: 1mm;
}

.empty { font-size: 7.6pt; color: ${c.muted}; font-style: italic; padding: 1.5mm 0; }

/* ---------- chart ---------- */

.chart { width: 100%; }
.chart svg { display: block; width: 100%; height: auto; }
.legend { display: flex; gap: 5mm; margin-top: 1.6mm; font-size: 6.8pt; color: ${c.muted}; }
.legend .key { display: flex; align-items: center; gap: 1.4mm; }
.legend .swatch { width: 5mm; height: 0; border-top-width: 0.6mm; border-top-style: solid; }

/* ---------- photos ---------- */

.photos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4mm; }
.photo { break-inside: avoid; }
.photo img { width: 100%; height: 52mm; object-fit: cover; border: 0.35mm solid ${c.rule}; display: block; }
.photo .caption { font-size: 6.8pt; color: ${c.muted}; margin-top: 1.2mm; line-height: 1.35; }
.photo .caption .ref { color: ${c.ink}; font-weight: 500; }

/* ---------- appendix ---------- */

.appendix { page-break-before: always; }
.appendix .appendix-title {
  font-size: 10pt; font-weight: 600; color: ${c.ink};
  text-transform: uppercase; letter-spacing: 0.08em;
}
.appendix .appendix-sub { font-size: 7.4pt; color: ${c.muted}; margin-top: 1mm; }

/* ---------- provenance footnote ---------- */

.provenance {
  margin-top: 3.5mm; padding-top: 1.8mm; border-top: 0.35mm solid ${c.rule};
  font-size: 6.4pt; color: ${c.muted}; line-height: 1.4;
}
`;
}
