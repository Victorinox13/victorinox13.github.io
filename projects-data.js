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
 *   housedeck · verbuga · pushunrot · capclash · astroleck
 * Add a new render function in index.html when you add a genuinely new project.
 *
 * Newest items (by `date`) are shown first.
 */
const PROJECTS = [
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
    title: "Cap Clash",
    emoji: "🧢",
    category: "Apps",
    tag: "Party Game",
    description: "Multiplayer party game: flick bottle caps to score. Play with 2 or 4 players on one phone or link devices for bigger matches. Earn crowns, unlock cosmetic skins.",
    link: "/capclash/",
    linkLabel: "Open Cap Clash",
    highlight: true,
    date: "2026-11",
    widget: "capclash",
    theme: { bg: "#0a1424", fg: "#f4f7fb", accent: "#ffd36e", accent2: "#7ed7ff" }
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
