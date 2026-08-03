/**
 * Every word and number on the site lives here, sourced from the PMCC company
 * profile (2026) and the A20/partners design set for Daher el Souane 563.
 * Nothing in this file is invented: where a figure is not in those documents
 * (areas in m², prices) the site says "on request" rather than a plausible
 * number. Verify the phone numbers before launch — they are transcribed from
 * the profile PDF.
 */

export const company = {
  name: "PMCC",
  legalName: "Project Management and Construction Company S.A.R.L.",
  since: 2002,
  address: "Al-Bustan Building, Amaret Chalhoub, Nahr El Mot Highway, Metn, Lebanon",
  phone: "+961 1 886 608",
  mobile: "+961 3 616 222",
  whatsapp: "9613616222",
  email: "info@pmcclb.com",
};

export const heroClaim = {
  eyebrow: "Project management · Construction · Lebanon",
  // The claim is the company's actual shape: builder and manager in one.
  lines: ["We manage", "what we build."],
  sub: "Engineering, construction and general contracting on Mount Lebanon and in Beirut — since 2002, under one team.",
};

export const stats = [
  { value: "2002", label: "Founded — first project: Microsoft's regional offices, Beirut" },
  { value: "100+", label: "Projects delivered across Lebanon, from villas to office towers" },
  { value: "13", label: "Engineers, foremen and technicians in-house" },
  { value: "4", label: "Projects under construction today across Lebanon" },
];

export const services = [
  {
    n: "01",
    title: "Construction management",
    body: "Site, concrete, finishes, decoration and MEP, run as one contract with one accountable team — the service most of our projects were built under.",
  },
  {
    n: "02",
    title: "General contracting",
    body: "Full execution from structure to handover, including concrete-works-only engagements where a client needed a frame they could trust.",
  },
  {
    n: "03",
    title: "Project management",
    body: "Owner-side management of larger developments — programmes, procurement and consultants held to the schedule, the way we run our own.",
  },
  {
    n: "04",
    title: "Restoration",
    body: "Heritage mountain houses, a WWII museum, and mid-century villas returned to service without erasing what made them worth keeping.",
  },
];

/**
 * Selected work, grouped the way a prospect actually reads a builder:
 * recognisable names, breadth, and what is on site right now. All entries
 * from the qualification statement; the full record goes out on request.
 */
export const workGroups = [
  {
    title: "Corporate & banking",
    note: "Fit-outs and renovations for clients who audit everything.",
    items: [
      { name: "Microsoft Regional Offices", meta: "Beirut Central District · 2002" },
      { name: "Microsoft Offices, Berytus", meta: "Beirut · 2012" },
      { name: "Arab Investment Bank", meta: "Beirut Central District · 2015" },
    ],
  },
  {
    title: "The MEDCO network",
    note: "One client, thirteen years, six service stations along the coast.",
    items: [
      { name: "Six stations, BCD to Damour", meta: "2003 – 2016 · construction management" },
    ],
  },
  {
    title: "Villas & restoration",
    note: "Two generations of private houses — built new, or brought back.",
    items: [
      { name: "Villa Zreik", meta: "Faqra · 2008" },
      { name: "Villa Fakhoury", meta: "Kfardebian · 2016" },
      { name: "WWII Museum", meta: "Khiam · restoration · 2005" },
      { name: "Villa Tyan", meta: "Baabdath · restoration · 2011" },
    ],
  },
  {
    title: "On site now",
    note: "Four programmes running today, from Jounieh to the high mountains.",
    items: [
      { name: "Marina Gate Tower", meta: "Jounieh · office tower" },
      { name: "Naccache 401–413", meta: "Naccache · residential · 2027" },
      { name: "Bcharreh Heritage Houses", meta: "Bcharreh · restoration · 2026" },
    ],
  },
];

/**
 * Marquee entries. Each renders its logo from /im/logos/<slug>.png when the
 * file exists (bone-monochrome, transparent), and falls back to the serif
 * wordmark when it does not — so a missing file degrades, never breaks.
 */
export const clients = [
  { name: "Microsoft", slug: "microsoft" },
  { name: "MEDCO", slug: "medco" },
  { name: "McDonald's", slug: "mcdonalds" },
  { name: "Arab Investment Bank", slug: "aib" },
  { name: "Mercy Corps", slug: "mercycorps" },
  { name: "Rise Properties", slug: "rise" },
  { name: "JDM", slug: "jdm" },
];

/**
 * The booklet — spreads of an open monograph. Left page features one project;
 * the right page carries a grid of four, captioned, exactly as a printed
 * portfolio lays them out.
 *
 * PLACEHOLDER IMAGES. Every photo is a Daher el Souane render or site
 * photograph standing in until each project's own photography arrives; swap
 * the `img` entries and nothing else changes. Names, places and years are the
 * real record, from the qualification statement.
 */
export const booklet = [
  {
    feature: {
      name: "Villa Zreik",
      meta: "Faqra · 2008",
      img: { src: "/im/entrance-walk-1280.webp", src2x: "/im/entrance-walk-2560.webp", alt: "Stone entrance walk under arches" },
    },
    grid: [
      { name: "Villa Fakhoury", meta: "Kfardebian · 2016", img: { src: "/im/portrait-garden-1280.webp", src2x: "/im/portrait-garden-2189.webp", alt: "Garden elevation in evening light" } },
      { name: "Villa Tyan", meta: "Baabdath · 2011", img: { src: "/im/site-finished-1280.webp", src2x: "/im/site-finished-1280.webp", alt: "Completed house from above" } },
      { name: "WWII Museum", meta: "Khiam · 2005", img: { src: "/im/rear-three-quarter-1280.webp", src2x: "/im/rear-three-quarter-2560.webp", alt: "Stone building, rear three-quarter view" } },
      { name: "Marina Gate", meta: "On site now", img: { src: "/im/site-progress-1280.webp", src2x: "/im/site-progress-1280.webp", alt: "Concrete frame under construction" } },
    ],
  },
  {
    feature: {
      name: "Daher el Souane 563",
      meta: "Our own development · now selling",
      img: { src: "/im/hero-three-quarter-1280.webp", src2x: "/im/hero-three-quarter-2560.webp", alt: "Daher el Souane 563, three-quarter view" },
      link: "/daher-el-souane-563",
    },
    grid: [
      { name: "South elevation", meta: "Daher el Souane 563", img: { src: "/im/elevation-front-1280.webp", src2x: "/im/elevation-front-2560.webp", alt: "South elevation at dusk" } },
      { name: "North elevation", meta: "Daher el Souane 563", img: { src: "/im/elevation-rear-1280.webp", src2x: "/im/elevation-rear-2560.webp", alt: "North elevation" } },
      { name: "Massing study", meta: "Daher el Souane 563", img: { src: "/im/aerial-model-b.webp", src2x: "/im/aerial-model-b.webp", alt: "Aerial massing model" } },
      { name: "Ground floor", meta: "Daher el Souane 563", img: { src: "/im/plan-ground.webp", src2x: "/im/plan-ground.webp", alt: "Ground floor plan" } },
    ],
  },
];

export const timeline = [
  { year: "2002", text: "PMCC is founded by Jihad Saleh. First engagement: managing construction of Microsoft's regional offices in Beirut Central District." },
  { year: "2003–10", text: "The villa years — Fatka, Faqra, Yarze, Baabdath, Dahr El Souane — alongside the MEDCO service-station network across the coast." },
  { year: "2005", text: "Restoration becomes a discipline of its own: the WWII Museum at Khiam, then heritage houses that were built to outlive their owners." },
  { year: "2012–16", text: "Beirut office work compounds — Microsoft again at Berytus, Arab Investment Bank, commercial centers — repeat clients, larger plates." },
  { year: "2017–25", text: "Towers and buildings: Tiresmart, Zalka 208, Marina Gate. Management of programmes measured in years, not seasons." },
  { year: "Today", text: "PMCC builds for itself for the first time: Daher el Souane 563, our own development — alongside contracting at Naccache, Bcharreh and Marina Gate." },
];

/** ——— Daher el Souane 563 ——— */

export const project = {
  name: "Daher el Souane 563",
  short: "563",
  architect: "A20/partners",
  eyebrow: "Daher El Souane · Mount Lebanon",
  claim: ["One residence", "per floor."],
  sub: "A boutique building of four full-floor, four-bedroom residences on a terraced garden site among the umbrella pines — developed, managed and built by PMCC.",
  narrative: [
    "Daher el Souane sits on the green ridge above the Beirut coast, a village of stone houses and pine gardens twenty minutes from the city and a world away from it.",
    "On plot 563, A20/partners drew a building that steps with the slope instead of flattening it: sandstone volumes under a terracotta roof, black metal gables glazed to the view, gardens terraced into the hillside.",
    "There are no corridors of doors here. The building holds four apartments — one per floor, each the full plate, each with four bedrooms. Parking and plant sit in the basement below the garden residence, and an elevator serves every level.",
  ],
  facts: [
    { value: "4", label: "Residences — one full floor each" },
    { value: "4", label: "Bedrooms in every residence" },
    { value: "5", label: "Levels served by elevator" },
    { value: "563", label: "The plot — one terraced garden site in Daher El Souane" },
  ],
  floors: [
    {
      id: "garden",
      level: "Basement 1",
      name: "The Garden Residence",
      availability: "available", // "available" | "reserved" | "sold"
      plan: "/im/plan-basement1.webp",
      brief: "Opens straight onto the terraced gardens. Reception, dining and kitchen along the garden front; two master suites and two bedrooms; a gym and playroom of its own; a walk-in closet off the first master.",
      features: ["Direct garden frontage", "Gym / playroom", "Walk-in master closet", "Wrap-around balcony"],
    },
    {
      id: "ground",
      level: "Ground Floor",
      name: "The Ground Residence",
      availability: "available",
      plan: "/im/plan-ground.webp",
      brief: "The full ground plate with planted balcony borders on every edge. Two master suites with their own baths, two further bedrooms, maid's room and guest WC off the service side.",
      features: ["Full-plate reception & dining", "Two master suites", "Maid's room", "Planted balcony borders"],
    },
    {
      id: "first",
      level: "First Floor",
      name: "The First-Floor Residence",
      availability: "available",
      plan: "/im/plan-first.webp",
      brief: "The same generous plan lifted above the gardens — longer sightlines over the pines, the ridge light in every room, balconies off reception and both masters.",
      features: ["Elevated pine views", "Two master suites", "Maid's room", "Balconies on both fronts"],
    },
    {
      id: "roof",
      level: "Roof Floor",
      name: "The Roof Residence",
      availability: "available",
      plan: "/im/plan-roof.webp",
      brief: "Under the glazed gables of the terracotta roof, with two large terraces in place of balconies — one off the reception, one off the master suite. The building's crown.",
      features: ["Two large terraces", "Glazed gable ceilings", "Four bedrooms", "The top of the ridge"],
    },
  ],
  gallery: [
    { src: "/im/hero-three-quarter-2560.webp", small: "/im/hero-three-quarter-1280.webp", alt: "Daher el Souane 563 — three-quarter view among the umbrella pines", w: 3619, h: 2557 },
    { src: "/im/elevation-front-2560.webp", small: "/im/elevation-front-1280.webp", alt: "Front elevation — sandstone volumes and black metal gables", w: 3945, h: 2374 },
    { src: "/im/entrance-walk-2560.webp", small: "/im/entrance-walk-1280.webp", alt: "Entrance walk between stone walls and hedges", w: 2734, h: 2690 },
    { src: "/im/rear-three-quarter-2560.webp", small: "/im/rear-three-quarter-1280.webp", alt: "Rear three-quarter view with garden pergola", w: 3840, h: 2042 },
    { src: "/im/elevation-rear-2560.webp", small: "/im/elevation-rear-1280.webp", alt: "Rear elevation with vertical louvre screen", w: 4081, h: 1938 },
    { src: "/im/portrait-garden-2189.webp", small: "/im/portrait-garden-1280.webp", alt: "The building above its stone retaining wall", w: 2189, h: 2804 },
  ],
  setting: [
    "Terraced gardens held by natural stone retaining walls",
    "Mature umbrella pines and ornamental planting",
    "Garden pergola in black steel with lounge seating",
    "Sandstone cladding, anthracite metal, terracotta tile",
    "Architecture by A20/partners",
  ],
  onRequest: "Areas, finishes schedule and pricing on request.",
  /** The two facts every buyer asks first — stated, not hidden. */
  terms: {
    delivery: "Delivery summer 2027",
    payment: "Reserve with a deposit — balance on completion",
  },
  /**
   * Drive times are typical light-traffic figures, consistent with the
   * "twenty minutes from the city" already in the narrative. Update here if
   * the owner measures different ones.
   */
  location: {
    line: "On the green ridge above the coast — close enough to use the city, far enough not to hear it.",
    driveTimes: [
      { place: "Beirut", minutes: 20 },
      { place: "ABC Dbayeh", minutes: 15 },
      { place: "Rafic Hariri Int'l Airport", minutes: 35 },
    ],
    note: "Typical driving times in light traffic.",
  },
};
