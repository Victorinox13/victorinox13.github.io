/**
 * Project cards for the homepage "Projects" grid.
 *
 * To add a new project, append an object with this shape:
 * {
 *   title:       "Display name",
 *   emoji:       "🧬",                 // shown as a small icon on the card
 *   category:    "Studietools",        // free text — filter pills are generated from this
 *   tag:         "Studieplatform",     // short badge text shown on the card
 *   description: "1-3 sentence description of what it is / does.",
 *   link:        "some-page.html",     // relative page or full URL
 *   linkLabel:   "Open het studieplatform →", // optional, defaults to "Open"
 *   highlight:   true,                 // optional — gives the card a green accent
 *   date:        "2026-06",            // YYYY-MM, used to sort newest-first
 *   preview: {                         // mini "site preview" rendered on the card
 *     kind:    "quiz",                 // "quiz" | "table" | "app" | "space" | "plain"
 *     bg:      "#f5f7fa",              // preview background color
 *     fg:      "#0f4a28",              // preview text/line color
 *     accent:  "#0f5046",              // primary accent (highlighted option / header / ring)
 *     accent2: "#a8edca"               // optional secondary accent (used by "table" kind)
 *   }
 *   // Pick `kind` based on what the project actually looks like:
 *   //  - "quiz":  question + answer-option rows (study platforms, exam tools)
 *   //  - "table": grid of cells with an accented header row (data drills, dictionaries)
 *   //  - "app":   circular progress ring + text bars (mobile apps)
 *   //  - "space": starfield with a play button (creator/video content)
 *   //  - "plain": flat color block, no extra shapes (fallback)
 *   // Pull bg/fg/accent colors from the project's own page so the preview
 *   // actually looks like a tiny screenshot of it.
 * }
 *
 * Newest items (by `date`) are shown first. This file can be appended to
 * automatically by a project-finishing skill — just push a new object
 * onto PROJECTS.
 */
const PROJECTS = [
  {
    title: "Aardrijkskunde Studieplatform",
    emoji: "🌍",
    category: "Studietools",
    tag: "Studieplatform",
    description: "Interactief oefenplatform voor het aardrijkskunde-examen, thema Atmosfeer (H7–H14): de atmosfeer, stralingsbalans, temperatuurverschillen, wind & luchtdruk, neerslag & wolken, extreem weer en de weerkaart. 73 vragen en 73 begrippen uit de cursus — met gemixte modus en woordenschattrainer.",
    link: "aardrijkskunde-studieplatform.html",
    linkLabel: "Open het studieplatform →",
    highlight: true,
    date: "2026-06",
    preview: { kind: "quiz", bg: "#f0f2f5", fg: "#1e3a5f", accent: "#173a5c", accent2: "#bfe0d8" }
  },
  {
    title: "WeatherDeck",
    emoji: "🛰️",
    category: "Tools",
    tag: "Live Weerdashboard",
    description: "Mission-control weerdashboard: zoek je adres en krijg direct een ingezoomde kaart van je huis, plus actuele condities, uurlijkse en 7-daagse voorspelling, luchtkwaliteit, zon/maan-cyclus en zicht-uit-je-raam.",
    link: "weather/index.html",
    linkLabel: "Open WeatherDeck →",
    highlight: true,
    date: "2026-06",
    preview: { kind: "orbit", bg: "#0a0c11", fg: "#f3f5f8", accent: "#6ea8fe", accent2: "#ffb46b" }
  },
  {
    title: "Bio Studieplatform",
    emoji: "🧬",
    category: "Studietools",
    tag: "Studieplatform",
    description: "Interactief oefenplatform voor het biologie-examen: evolutie, genetisch materiaal, van gen tot eiwit, genetica en voortplanting. 142 vragen, 107 begrippen, 33 figuren uit de cursus — met gemixte modus en woordenschattrainer.",
    link: "biologie-studieplatform.html",
    linkLabel: "Open het studieplatform →",
    highlight: true,
    date: "2026-05",
    preview: { kind: "quiz", bg: "#f5f7fa", fg: "#0f4a28", accent: "#0f5046", accent2: "#a8edca" }
  },
  {
    title: "Verbuga — Verbes Français",
    emoji: "🇫🇷",
    category: "Studietools",
    tag: "Taaltrainer",
    description: "Browserquiz voor Franse werkwoordvervoegingen, gebaseerd op de Verbuga v2z verb list. Oefen vervoegingen per tijd en werkwoordgroep.",
    link: "verbuga.html",
    linkLabel: "Open Verbuga →",
    date: "2025-09",
    preview: { kind: "table", bg: "#eef3f7", fg: "#22324a", accent: "#1769e0", accent2: "#ae1c28" }
  },
  {
    title: "Push Unrot — Screentime Block",
    emoji: "📱",
    category: "Apps",
    tag: "iPhone App",
    description: "Een gratis iPhone productiviteitsapp die afleidende apps blokkeert en schermtijd laat ontgrendelen door echte pushups, geteld met de camera.",
    link: "https://apps.apple.com/in/app/push-unrot-screentime-block/id6762221005",
    linkLabel: "Bekijk op de App Store →",
    date: "2026-04",
    preview: { kind: "app", bg: "#0c1424", fg: "#f4f7fb", accent: "#ff7a59" }
  },
  {
    title: "Astroleck",
    emoji: "🚀",
    category: "Creator",
    tag: "Creator",
    description: "Mijn creator-identiteit voor astronomie, ruimtevaart en luchtvaart. TikTok, YouTube, Discord en skywatching gear via Linktree.",
    link: "https://linktr.ee/astroleck",
    linkLabel: "Open Linktree →",
    date: "2025-01",
    preview: { kind: "space", bg: "#07111f", fg: "#f4f7fb", accent: "#7ed7ff" }
  }
];
