/**
 * Project cards for the homepage "Projects" grid.
 *
 * Each project renders a BESPOKE widget (see index.html → WIDGETS) drawn in the
 * palette of the actual app behind it. Clicking anywhere on the card opens `link`.
 *
 * To add a project, append an object with this shape:
 * {
 *   title, emoji, category, tag, description,
 *   link, linkLabel, highlight, date,
 *   widget: "engels",          // key into the WIDGETS renderer in index.html
 *   theme: {                   // palette pulled from the app's own page
 *     bg, fg, accent, accent2
 *   }
 * }
 *
 * Available widgets (each is unique, do not reuse loosely):
 *   engels · geschiedenis · frans · chemie · aardrijkskunde · bio
 *   housedeck · verbuga · pushunrot · astroleck
 * Add a new render function in index.html when you add a genuinely new project.
 *
 * Newest items (by `date`) are shown first.
 */
const PROJECTS = [
  {
    title: "Engels Studieplatform",
    emoji: "🇬🇧",
    category: "Studietools",
    tag: "Studieplatform",
    description: "Interactief oefenplatform voor het examen Engels (New Strike 5, units 3·4·5·6·8): woordenschat, flashcards, woordtraining als invuloefening, een grammatica-tabblad én de échte examenoefeningen met modelantwoorden. 383 woorden.",
    link: "engels-studieplatform.html",
    linkLabel: "Open het studieplatform",
    highlight: true,
    date: "2026-06",
    widget: "engels",
    theme: { bg: "#f3f5fa", fg: "#1b1e2a", accent: "#4f6ef7", accent2: "#0fb89a" }
  },
  {
    title: "Geschiedenis Studieplatform",
    emoji: "📜",
    category: "Studietools",
    tag: "Studieplatform",
    description: "Oefenplatform voor het examen geschiedenis (5 TWE, H6–H12): ideologieën van de 19de eeuw, modern imperialisme & Congo, en de Eerste Wereldoorlog. 7 hoofdstukken, 97 vragen, 83 begrippen — rechtstreeks uit je samenvattingen.",
    link: "geschiedenis-studieplatform.html",
    linkLabel: "Open het studieplatform",
    highlight: true,
    date: "2026-06",
    widget: "geschiedenis",
    theme: { bg: "#f3ead9", fg: "#7a2820", accent: "#a23b2d", accent2: "#e8c79a" }
  },
  {
    title: "Frans Studieplatform",
    emoji: "🇫🇷",
    category: "Studietools",
    tag: "Studieplatform",
    description: "Oefenplatform voor het examen Frans (5 TWE): de vier examenonderdelen (Été 89, Le Bénévolat, Paris, Jallé), een volledig grammatica-tabblad en gedeelde tools zoals de subjonctif-spiekkaart en schrijfchecklist.",
    link: "frans-examen-studieplatform.html",
    linkLabel: "Open het studieplatform",
    highlight: true,
    date: "2026-06",
    widget: "frans",
    theme: { bg: "#16161c", fg: "#e8e8f0", accent: "#7c6fef", accent2: "#6fefd4" }
  },
  {
    title: "Chemie Studieplatform",
    emoji: "🧪",
    category: "Studietools",
    tag: "Studieplatform",
    description: "Oefenplatform voor het chemie-examen (Focus Chemie 5): organische stoffen, materieaspecten en reactiesnelheid. 167 vragen met structuurformules én PowerPoint-figuren, een triviale-namen-trainer en 108 begrippen.",
    link: "chemie-studieplatform.html",
    linkLabel: "Open het studieplatform",
    highlight: true,
    date: "2026-06",
    widget: "chemie",
    theme: { bg: "#f3effb", fg: "#4c1d95", accent: "#6d28d9", accent2: "#22c3a6" }
  },
  {
    title: "Aardrijkskunde Studieplatform",
    emoji: "🌍",
    category: "Studietools",
    tag: "Studieplatform",
    description: "Oefenplatform voor het aardrijkskunde-examen (H7–H15): de atmosfeer, stralingsbalans, wind & luchtdruk, neerslag, extreem weer, de weerkaart en oceanen. 126 vragen, 86 begrippen en de schema's uit de cursus.",
    link: "aardrijkskunde-studieplatform.html",
    linkLabel: "Open het studieplatform",
    highlight: true,
    date: "2026-06",
    widget: "aardrijkskunde",
    theme: { bg: "#eef2f6", fg: "#1e3a5f", accent: "#1f6f8b", accent2: "#7fc8b8" }
  },
  {
    title: "HouseDeck",
    emoji: "🛰️",
    category: "Tools",
    tag: "Surveillance Console",
    description: "Cyberdeck-console die alles boven en rond je huis volgt: satellietbeelden, live vliegtuigen overhead, het ISS, weer & luchtkwaliteit, een sterren-index en seismiek — met ingebouwde commandobalk en mobiele UI.",
    link: "housedeck/index.html",
    linkLabel: "Open HouseDeck",
    highlight: true,
    date: "2026-06",
    widget: "housedeck",
    theme: { bg: "#06060f", fg: "#e8eaff", accent: "#b14dff", accent2: "#22e0ff" }
  },
  {
    title: "Bio Studieplatform",
    emoji: "🧬",
    category: "Studietools",
    tag: "Studieplatform",
    description: "Oefenplatform voor het biologie-examen: evolutie, genetisch materiaal, van gen tot eiwit, genetica en voortplanting. 142 vragen, 107 begrippen, 33 figuren uit de cursus — met gemixte modus en woordenschattrainer.",
    link: "biologie-studieplatform.html",
    linkLabel: "Open het studieplatform",
    highlight: true,
    date: "2026-05",
    widget: "bio",
    theme: { bg: "#f5f7fa", fg: "#0f4a28", accent: "#0f5046", accent2: "#5fcf8f" }
  },
  {
    title: "Verbuga — Verbes Français",
    emoji: "🇫🇷",
    category: "Studietools",
    tag: "Taaltrainer",
    description: "Browserquiz voor Franse werkwoordvervoegingen, gebaseerd op de Verbuga v2z verb list. Oefen vervoegingen per tijd en werkwoordgroep.",
    link: "verbuga.html",
    linkLabel: "Open Verbuga",
    date: "2025-09",
    widget: "verbuga",
    theme: { bg: "#eef3f7", fg: "#22324a", accent: "#1769e0", accent2: "#ae1c28" }
  },
  {
    title: "Push Unrot — Screentime Block",
    emoji: "📱",
    category: "Apps",
    tag: "iPhone App",
    description: "Een gratis iPhone-productiviteitsapp die afleidende apps blokkeert en schermtijd laat ontgrendelen door echte pushups, geteld met de camera.",
    link: "https://apps.apple.com/in/app/push-unrot-screentime-block/id6762221005",
    linkLabel: "Bekijk op de App Store",
    date: "2026-04",
    widget: "pushunrot",
    theme: { bg: "#0c1424", fg: "#f4f7fb", accent: "#ff7a59", accent2: "#ffd36e" }
  },
  {
    title: "Astroleck",
    emoji: "🚀",
    category: "Creator",
    tag: "Creator",
    description: "Mijn creator-identiteit voor astronomie, ruimtevaart en luchtvaart. TikTok, YouTube, Discord en skywatching gear via Linktree.",
    link: "https://linktr.ee/astroleck",
    linkLabel: "Open Linktree",
    date: "2025-01",
    widget: "astroleck",
    theme: { bg: "#07111f", fg: "#f4f7fb", accent: "#7ed7ff", accent2: "#ffd36e" }
  }
];
