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
 *   date:        "2026-06"             // YYYY-MM, used to sort newest-first
 * }
 *
 * Newest items (by `date`) are shown first. This file can be appended to
 * automatically by a project-finishing skill — just push a new object
 * onto PROJECTS.
 */
const PROJECTS = [
  {
    title: "Bio Studieplatform",
    emoji: "🧬",
    category: "Studietools",
    tag: "Studieplatform",
    description: "Interactief oefenplatform voor het biologie-examen: evolutie, genetisch materiaal, van gen tot eiwit, genetica en voortplanting. 142 vragen, 107 begrippen, 33 figuren uit de cursus — met gemixte modus en woordenschattrainer.",
    link: "biologie-studieplatform.html",
    linkLabel: "Open het studieplatform →",
    highlight: true,
    date: "2026-05"
  },
  {
    title: "Verbuga — Verbes Français",
    emoji: "🇫🇷",
    category: "Studietools",
    tag: "Taaltrainer",
    description: "Browserquiz voor Franse werkwoordvervoegingen, gebaseerd op de Verbuga v2z verb list. Oefen vervoegingen per tijd en werkwoordgroep.",
    link: "verbuga.html",
    linkLabel: "Open Verbuga →",
    date: "2025-09"
  },
  {
    title: "Push Unrot — Screentime Block",
    emoji: "📱",
    category: "Apps",
    tag: "iPhone App",
    description: "Een gratis iPhone productiviteitsapp die afleidende apps blokkeert en schermtijd laat ontgrendelen door echte pushups, geteld met de camera.",
    link: "https://apps.apple.com/in/app/push-unrot-screentime-block/id6762221005",
    linkLabel: "Bekijk op de App Store →",
    date: "2026-04"
  },
  {
    title: "Astroleck",
    emoji: "🚀",
    category: "Creator",
    tag: "Creator",
    description: "Mijn creator-identiteit voor astronomie, ruimtevaart en luchtvaart. TikTok, YouTube, Discord en skywatching gear via Linktree.",
    link: "https://linktr.ee/astroleck",
    linkLabel: "Open Linktree →",
    date: "2025-01"
  }
];
