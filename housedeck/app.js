/* ============================================================
   HouseDeck — cyberdeck MAP console
   One big map; everything is a layer you toggle on it.
   Feeds (keyless + CORS-safe for a static site):
     Open-Meteo (weer + luchtkwaliteit, instrumenten)
     RainViewer (animated neerslag-radar)
     airplanes.live (live vliegtuigen → map markers)
     wheretheiss.at (ISS → map marker)
     Wikipedia (nabije intel → map markers)
     USGS (seismiek → map markers)
     Esri / CARTO / OpenTopoMap / NASA GIBS (basislagen)
     Photon/OSM (geocoding)
   ============================================================ */

const WEATHER_CODES = {
  0: ["Helder", "☀️"], 1: ["Overwegend helder", "🌤️"], 2: ["Half bewolkt", "⛅"], 3: ["Bewolkt", "☁️"],
  45: ["Mist", "🌫️"], 48: ["Rijpvorming / mist", "🌫️"],
  51: ["Lichte motregen", "🌦️"], 53: ["Motregen", "🌦️"], 55: ["Dichte motregen", "🌧️"],
  56: ["Onderkoelde motregen", "🌧️"], 57: ["Dichte onderkoelde motregen", "🌧️"],
  61: ["Lichte regen", "🌦️"], 63: ["Regen", "🌧️"], 65: ["Zware regen", "🌧️"],
  66: ["Onderkoelde regen", "🌧️"], 67: ["Zware onderkoelde regen", "🌧️"],
  71: ["Lichte sneeuw", "🌨️"], 73: ["Sneeuw", "🌨️"], 75: ["Zware sneeuw", "❄️"], 77: ["Sneeuwkorrels", "❄️"],
  80: ["Lichte buien", "🌦️"], 81: ["Buien", "🌧️"], 82: ["Zware buien", "⛈️"],
  85: ["Lichte sneeuwbuien", "🌨️"], 86: ["Zware sneeuwbuien", "❄️"],
  95: ["Onweer", "⛈️"], 96: ["Onweer met hagel", "⛈️"], 99: ["Zwaar onweer met hagel", "⛈️"]
};
function describe(code) { return WEATHER_CODES[code] || ["Onbekend", "🌡️"]; }
function compass(deg) {
  const dirs = ["N", "NNO", "NO", "ONO", "O", "OZO", "ZO", "ZZO", "Z", "ZZW", "ZW", "WZW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round((deg % 360) / 22.5) % 16];
}
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function moonPhase(date) {
  const synodic = 29.53058867, known = Date.UTC(2000, 0, 6, 18, 14, 0);
  let phase = (((date.getTime() - known) / 86400000) % synodic) / synodic;
  if (phase < 0) phase += 1; return phase;
}
function moonInfo(phase) {
  const steps = [[0.02, "Nieuwe maan", "🌑"], [0.25, "Wassende sikkel", "🌒"], [0.27, "Eerste kwartier", "🌓"],
    [0.48, "Wassende maan", "🌔"], [0.52, "Volle maan", "🌕"], [0.73, "Afnemende maan", "🌖"],
    [0.77, "Laatste kwartier", "🌗"], [0.98, "Afnemende sikkel", "🌘"], [1.01, "Nieuwe maan", "🌑"]];
  for (const [limit, name, icon] of steps) if (phase <= limit) return [name, icon];
  return ["Nieuwe maan", "🌑"];
}
function sunPosition(date, lat, lon) {
  const rad = Math.PI / 180, dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;
  const d = (date.valueOf() / dayMs - 0.5 + J1970) - J2000;
  const e = rad * 23.4397, M = rad * (357.5291 + 0.98560028 * d);
  const L = M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(e) * Math.sin(L)), ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
  const lw = rad * -lon, phi = rad * lat;
  const H = (rad * (280.16 + 360.9856235 * d) - lw) - ra;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  let az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  az = (az / rad + 180) % 360;
  return { altitude: alt / rad, azimuth: az };
}
function aqiInfo(aqi) {
  if (aqi == null) return ["—", ""];
  if (aqi <= 20) return ["Goed", "good"]; if (aqi <= 40) return ["Redelijk", "good"];
  if (aqi <= 60) return ["Matig", ""]; if (aqi <= 80) return ["Slecht", "warn"];
  if (aqi <= 100) return ["Zeer slecht", "warn"]; return ["Extreem slecht", "bad"];
}

/* ---------- DOM ---------- */
const els = {
  addressInput: document.getElementById("addressInput"), suggestions: document.getElementById("suggestions"),
  gpsBtn: document.getElementById("gpsBtn"), clock: document.getElementById("clock"),
  deck: document.getElementById("deck"), locName: document.getElementById("locName"),
  coordReadout: document.getElementById("coordReadout"), airCount: document.getElementById("airCount"),
  nowIcon: document.getElementById("nowIcon"), nowTemp: document.getElementById("nowTemp"),
  nowDesc: document.getElementById("nowDesc"), nowFeels: document.getElementById("nowFeels"),
  statGrid: document.getElementById("statGrid"), skyInfo: document.getElementById("skyInfo"),
  aqInfo: document.getElementById("aqInfo"), hourly: document.getElementById("hourly"), daily: document.getElementById("daily"),
  cmdInput: document.getElementById("cmdInput"), cmdLog: document.getElementById("cmdLog"), cmdLogToggle: document.getElementById("cmdLogToggle"),
  radarBar: document.getElementById("radarBar"), radarPlay: document.getElementById("radarPlay"),
  radarSlider: document.getElementById("radarSlider"), radarTime: document.getElementById("radarTime"),
};

/* ---------- state ---------- */
let map = null, baseLayer = null, marker = null;
let planeLayer, issLayer, intelLayer, seismicLayer, issMarker = null;
let cur = { lat: 51.2920, lon: 4.5773, label: "Sint-Job-in-'t-Goor, Brecht" };
let airTimer = null, issTimer = null;
const HOUSE_ZOOM = 17;
const overlays = { radar: false, planes: true, iss: false, intel: false, seismic: false };
const radar = { host: "", frames: [], layers: [], idx: 0, timer: null };

/* ---------- clock ---------- */
function tickClock() { els.clock.textContent = new Date().toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
tickClock(); setInterval(tickClock, 1000);

/* ---------- command log ---------- */
function logLine(text, cls) { const s = document.createElement("span"); s.className = cls || "out"; s.textContent = text + "\n"; els.cmdLog.appendChild(s); els.cmdLog.scrollTop = els.cmdLog.scrollHeight; }
function openLog() { els.cmdLog.classList.add("open"); }
els.cmdLogToggle.addEventListener("click", () => els.cmdLog.classList.toggle("open"));

/* ---------- boot ---------- */
function boot() {
  const bootEl = document.getElementById("boot"), log = document.getElementById("bootLog");
  const lines = [
    "HOUSEDECK v4.0 // ASTROLECK MAP SUITE", "------------------------------------------------",
    "[<span class='hl'>BOOT</span>] kernel ............... <span class='ok'>OK</span>",
    "[<span class='hl'>LINK</span>] open-meteo grid ....... <span class='ok'>OK</span>",
    "[<span class='hl'>LINK</span>] rainviewer radar ...... <span class='ok'>OK</span>",
    "[<span class='hl'>LINK</span>] airplanes.live ....... <span class='ok'>OK</span>",
    "[<span class='hl'>LINK</span>] nasa gibs imagery ..... <span class='ok'>OK</span>",
    "[<span class='hl'>LINK</span>] iss telemetry ........ <span class='ok'>OK</span>",
    "[<span class='hl'>LINK</span>] wikipedia + usgs ..... <span class='ok'>OK</span>",
    "------------------------------------------------", "acquiring target lock ...",
  ];
  let i = 0;
  (function step() {
    if (i < lines.length) { log.innerHTML += lines[i] + "\n"; i++; setTimeout(step, 90); }
    else setTimeout(() => {
      bootEl.classList.add("done"); els.deck.classList.remove("hidden");
      logLine("HouseDeck online. Typ 'help' voor commando's.", "out");
      loadLocation(cur.lat, cur.lon, cur.label);
      setTimeout(() => map && map.invalidateSize(), 200);
    }, 350);
  })();
}

/* ---------- geocoding (Photon) ---------- */
let searchTimer = null, activeSuggestion = -1, currentResults = [];
els.addressInput.addEventListener("input", () => {
  const q = els.addressInput.value.trim(); clearTimeout(searchTimer);
  if (q.length < 2) { closeSuggestions(); return; }
  searchTimer = setTimeout(() => fetchSuggestions(q), 300);
});
els.addressInput.addEventListener("keydown", (e) => {
  const items = [...els.suggestions.children];
  if (e.key === "ArrowDown") { e.preventDefault(); activeSuggestion = Math.min(activeSuggestion + 1, items.length - 1); highlightSuggestion(items); }
  else if (e.key === "ArrowUp") { e.preventDefault(); activeSuggestion = Math.max(activeSuggestion - 1, 0); highlightSuggestion(items); }
  else if (e.key === "Enter") { e.preventDefault(); if (activeSuggestion >= 0 && currentResults[activeSuggestion]) pickResult(currentResults[activeSuggestion]); else if (currentResults[0]) pickResult(currentResults[0]); else { const q = els.addressInput.value.trim(); if (q.length >= 2) fetchSuggestions(q, true); } }
  else if (e.key === "Escape") closeSuggestions();
});
document.addEventListener("click", (e) => { if (!els.suggestions.contains(e.target) && e.target !== els.addressInput) closeSuggestions(); });
function highlightSuggestion(items) { items.forEach((el, i) => el.classList.toggle("active", i === activeSuggestion)); }
function closeSuggestions() { els.suggestions.classList.remove("open"); els.suggestions.innerHTML = ""; activeSuggestion = -1; }
async function fetchSuggestions(q, autoSelect) {
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=en`);
    const data = await res.json(); currentResults = (data && data.features) || [];
    if (autoSelect && currentResults[0]) { pickResult(currentResults[0]); return; }
    renderSuggestions();
  } catch { currentResults = []; renderSuggestions(); }
}
function addressLines(f) {
  const p = (f && f.properties) || {};
  const main = [p.street, p.housenumber].filter(Boolean).join(" ") || p.name || "Onbekende locatie";
  const sub = [p.postcode, p.city || p.district || p.county, p.country].filter(Boolean).join(", ");
  return [main, sub];
}
function renderSuggestions() {
  if (!currentResults.length) { closeSuggestions(); return; }
  els.suggestions.innerHTML = "";
  currentResults.forEach((f) => { const div = document.createElement("div"); div.className = "suggestion-item"; const [main, sub] = addressLines(f); div.innerHTML = `<span>${main}</span><span class="muted">${sub}</span>`; div.addEventListener("click", () => pickResult(f)); els.suggestions.appendChild(div); });
  activeSuggestion = -1; els.suggestions.classList.add("open");
}
function pickResult(f) {
  closeSuggestions(); const [main, sub] = addressLines(f); const label = [main, sub].filter(Boolean).join(", ");
  els.addressInput.value = label; const [lon, lat] = f.geometry.coordinates;
  logLine(`> target lock: ${label}`, "echo"); loadLocation(lat, lon, label);
}

/* ---------- GPS ---------- */
els.gpsBtn.addEventListener("click", fixGps);
function fixGps() {
  if (!navigator.geolocation) { logLine("geolocatie niet ondersteund.", "err"); openLog(); return; }
  logLine("> GPS-fix opvragen...", "echo"); openLog();
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords; let label = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    try { const res = await fetch(`https://photon.komoot.io/reverse?lon=${longitude}&lat=${latitude}&lang=en`); const data = await res.json(); if (data && data.features && data.features[0]) { const [main, sub] = addressLines(data.features[0]); label = [main, sub].filter(Boolean).join(", "); } } catch {}
    els.addressInput.value = label; logLine(`> fix: ${label}`, "out"); loadLocation(latitude, longitude, label);
  }, (err) => logLine("GPS-fout: " + err.message, "err"), { enableHighAccuracy: true, timeout: 10000 });
}

/* ---------- base layers ---------- */
const yesterday = (() => { const d = new Date(Date.now() - 86400000); return d.toISOString().slice(0, 10); })();
const BASES = {
  aerial: () => L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri · Maxar" }),
  dark: () => L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 19, attribution: "CARTO · OSM" }),
  terrain: () => L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { subdomains: "abc", maxZoom: 17, attribution: "OpenTopoMap · OSM" }),
  nasa: () => L.tileLayer(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${yesterday}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`, { maxNativeZoom: 9, maxZoom: 19, attribution: `NASA GIBS · MODIS ${yesterday}` }),
};
let currentBase = "aerial";

function initMap(lat, lon) {
  if (map) return;
  map = L.map("map", { zoomControl: false, attributionControl: true }).setView([lat, lon], HOUSE_ZOOM);
  L.control.zoom({ position: "bottomleft" }).addTo(map);
  setBase("aerial");
  planeLayer = L.layerGroup(); issLayer = L.layerGroup(); intelLayer = L.layerGroup(); seismicLayer = L.layerGroup();
  if (overlays.planes) planeLayer.addTo(map);

  document.querySelectorAll(".base").forEach((b) => b.addEventListener("click", () => setBase(b.dataset.layer, true)));
  document.querySelectorAll(".ovl").forEach((b) => b.addEventListener("click", () => toggleOverlay(b.dataset.ovl, true)));

  if (window.ResizeObserver) { let t = null; new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => map && map.invalidateSize(), 120); }).observe(document.getElementById("map")); }
  window.addEventListener("resize", () => map && map.invalidateSize());

  // radar timeline controls
  els.radarPlay.addEventListener("click", toggleRadarPlay);
  els.radarSlider.addEventListener("input", () => { stopRadarAnim(); showRadarFrame(parseInt(els.radarSlider.value, 10)); });
}
function setBase(name, fromClick) {
  if (!BASES[name]) return;
  if (baseLayer && map) map.removeLayer(baseLayer);
  baseLayer = BASES[name](); if (map) baseLayer.addTo(map).bringToBack();
  currentBase = name;
  document.querySelectorAll(".base").forEach((b) => b.classList.toggle("active", b.dataset.layer === name));
  if (fromClick) logLine(`> basislaag → ${name.toUpperCase()}`, "out");
}
function setMarker(lat, lon) {
  const icon = L.divIcon({ className: "house-marker", iconSize: [18, 18] });
  if (marker) marker.setLatLng([lat, lon]); else marker = L.marker([lat, lon], { icon, zIndexOffset: 1000 }).addTo(map);
}

/* ---------- overlay toggles ---------- */
function toggleOverlay(name, fromClick, force) {
  const on = force != null ? force : !overlays[name];
  overlays[name] = on;
  const btn = document.querySelector(`.ovl[data-ovl="${name}"]`);
  if (btn) btn.classList.toggle("active", on);

  if (name === "radar") { on ? enableRadar() : disableRadar(); }
  if (name === "planes") { on ? planeLayer.addTo(map) : map.removeLayer(planeLayer); if (on) loadAircraft(); }
  if (name === "iss") { on ? issLayer.addTo(map) : map.removeLayer(issLayer); if (on) loadISS(); }
  if (name === "intel") { on ? intelLayer.addTo(map) : map.removeLayer(intelLayer); if (on && !intelLayer.getLayers().length) loadIntel(cur.lat, cur.lon); }
  if (name === "seismic") { on ? seismicLayer.addTo(map) : map.removeLayer(seismicLayer); if (on && !seismicLayer.getLayers().length) loadSeismic(cur.lat, cur.lon); }
  if (fromClick) logLine(`> laag ${name.toUpperCase()} ${on ? "AAN" : "uit"}`, "out");
}

/* ---------- RADAR (RainViewer animated) ---------- */
async function enableRadar() {
  try {
    const j = await (await fetch("https://api.rainviewer.com/public/weather-maps.json")).json();
    radar.host = j.host;
    const past = (j.radar && j.radar.past) || [];
    const now = (j.radar && j.radar.nowcast) || [];
    radar.frames = [...past.map((f) => ({ ...f, future: false })), ...now.map((f) => ({ ...f, future: true }))];
    if (!radar.frames.length) { logLine("radar: geen frames beschikbaar", "err"); return; }
    radar.layers = radar.frames.map((f) => L.tileLayer(`${radar.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0, zIndex: 350, attribution: "RainViewer" }));
    radar.layers.forEach((l) => l.addTo(map));
    radar.idx = radar.frames.findIndex((f) => f.future); // start at "now" (first nowcast) or...
    if (radar.idx === -1) radar.idx = radar.frames.length - 1;
    els.radarSlider.max = String(radar.frames.length - 1);
    els.radarBar.classList.remove("hidden");
    // pull back to a regional view so the rain pattern is visible
    if (map.getZoom() >= 12) map.setView(map.getCenter(), 8);
    showRadarFrame(radar.idx); startRadarAnim();
    logLine(`> radar AAN — ${radar.frames.length} frames (verleden → nowcast)`, "out");
  } catch (e) { logLine("radar offline: " + e.message, "err"); }
}
function disableRadar() {
  stopRadarAnim();
  radar.layers.forEach((l) => map.removeLayer(l)); radar.layers = []; radar.frames = [];
  els.radarBar.classList.add("hidden");
}
function showRadarFrame(i) {
  if (!radar.layers.length) return;
  radar.idx = i;
  radar.layers.forEach((l, k) => l.setOpacity(k === i ? 0.62 : 0));
  els.radarSlider.value = String(i);
  const f = radar.frames[i]; const t = new Date(f.time * 1000);
  const hh = t.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
  els.radarTime.textContent = f.future ? `${hh} · verwacht` : `${hh}`;
}
function startRadarAnim() { stopRadarAnim(); els.radarPlay.textContent = "⏸"; radar.timer = setInterval(() => { showRadarFrame((radar.idx + 1) % radar.frames.length); }, 650); }
function stopRadarAnim() { if (radar.timer) { clearInterval(radar.timer); radar.timer = null; } els.radarPlay.textContent = "▶"; }
function toggleRadarPlay() { radar.timer ? stopRadarAnim() : startRadarAnim(); }

/* ---------- main load ---------- */
function loadLocation(lat, lon, label) {
  cur = { lat, lon, label };
  els.locName.textContent = label;
  els.coordReadout.textContent = `LAT ${lat.toFixed(4)} · LON ${lon.toFixed(4)}`;
  initMap(lat, lon);
  map.invalidateSize();
  map.setView([lat, lon], HOUSE_ZOOM);
  setMarker(lat, lon);
  [80, 300, 700, 1400].forEach((t) => setTimeout(() => map.invalidateSize(), t));

  loadWeather(lat, lon);
  if (overlays.planes) loadAircraft();
  if (overlays.iss) loadISS();
  // always refresh intel/seismic data (cheap); markers only shown when overlay on
  loadIntel(lat, lon); loadSeismic(lat, lon);

  clearInterval(airTimer); airTimer = setInterval(() => overlays.planes && loadAircraft(), 20000);
  clearInterval(issTimer); issTimer = setInterval(loadISS, 10000);
}

/* ---------- weather (instrument strip) ---------- */
async function loadWeather(lat, lon) {
  try {
    const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,precipitation,is_day` +
      `&hourly=temperature_2m,precipitation_probability,weather_code,visibility,cloud_cover` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max` +
      `&timezone=auto&forecast_days=7`;
    const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,uv_index&timezone=auto`;
    const [wRes, aqRes] = await Promise.all([fetch(wUrl), fetch(aqUrl)]);
    const weather = await wRes.json(); const aq = aqRes.ok ? await aqRes.json() : null;
    renderCurrent(weather); renderHourly(weather); renderDaily(weather); renderSky(weather, lat, lon); renderAirQuality(aq);
  } catch (e) { logLine("weerfeed offline: " + e.message, "err"); }
}
function renderCurrent(data) {
  const c = data.current, [desc, icon] = describe(c.weather_code);
  els.nowIcon.textContent = icon; els.nowTemp.textContent = Math.round(c.temperature_2m) + "°";
  els.nowDesc.textContent = desc; els.nowFeels.textContent = "voelt als " + Math.round(c.apparent_temperature) + "°C";
  const stats = [["Wind", `${Math.round(c.wind_speed_10m)} ${compass(c.wind_direction_10m)}`], ["Stoten", `${Math.round(c.wind_gusts_10m || 0)} km/h`], ["Vocht", `${c.relative_humidity_2m}%`], ["Druk", `${Math.round(c.surface_pressure)} hPa`], ["Wolken", `${c.cloud_cover}%`], ["Neerslag", `${c.precipitation} mm`]];
  els.statGrid.innerHTML = stats.map(([l, v]) => `<div class="stat"><span class="label">${l}</span><span class="value">${v}</span></div>`).join("");
}
function renderHourly(data) {
  const times = data.hourly.time, now = new Date(); let start = times.findIndex((t) => new Date(t) >= now); if (start === -1) start = 0;
  let html = "";
  for (let i = start; i < start + 24 && i < times.length; i++) { const t = new Date(times[i]), temp = Math.round(data.hourly.temperature_2m[i]), precip = data.hourly.precipitation_probability[i], [, icon] = describe(data.hourly.weather_code[i]); html += `<div class="hour-card"><div class="time">${t.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}</div><div class="icon">${icon}</div><div class="temp">${temp}°</div><div class="precip">💧${precip}%</div></div>`; }
  els.hourly.innerHTML = html;
}
function renderDaily(data) {
  const days = data.daily.time; let html = "";
  for (let i = 0; i < days.length; i++) { const date = new Date(days[i]), [desc, icon] = describe(data.daily.weather_code[i]), max = Math.round(data.daily.temperature_2m_max[i]), min = Math.round(data.daily.temperature_2m_min[i]), precip = data.daily.precipitation_probability_max[i], dayName = i === 0 ? "Vandaag" : date.toLocaleDateString("nl-BE", { weekday: "long" }); html += `<div class="day-row"><div class="day-name">${dayName}</div><div class="icon">${icon}</div><div class="precip">${desc} · 💧${precip}%</div><div class="range"><span>${max}°</span><span class="lo">${min}°</span></div></div>`; }
  els.daily.innerHTML = html;
}
function renderSky(data, lat, lon) {
  const now = new Date(), sunrise = new Date(data.daily.sunrise[0]), sunset = new Date(data.daily.sunset[0]);
  const dayLen = sunset - sunrise, progress = Math.min(1, Math.max(0, (now - sunrise) / dayLen)), isDay = now >= sunrise && now <= sunset;
  const sun = sunPosition(now, lat, lon), phase = moonPhase(now), [moonName, moonIcon] = moonInfo(phase), illum = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100);
  const cloud = data.current.cloud_cover; let starLabel = "—", starCls = "";
  if (isDay) starLabel = "dag";
  else { const s = Math.round((100 - cloud) * 0.7 + (100 - illum) * 0.3); starLabel = s >= 70 ? "uitstekend ✦✦✦" : s >= 45 ? "redelijk ✦✦" : "zwak ✦"; starCls = s >= 70 ? "good" : s >= 45 ? "" : "warn"; }
  els.skyInfo.innerHTML = `
    <div class="kv"><span class="k">Status</span><span class="v ${isDay ? "good" : ""}">${isDay ? "☀️ Dag" : "🌙 Nacht"}</span></div>
    <div class="daylight-bar"><span style="width:${(progress * 100).toFixed(1)}%"></span></div>
    <div class="kv"><span class="k">Zon hoogte/az</span><span class="v">${sun.altitude.toFixed(1)}° · ${compass(sun.azimuth)}</span></div>
    <div class="kv"><span class="k">Op / onder</span><span class="v">${sunrise.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })} · ${sunset.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}</span></div>
    <div class="kv"><span class="k">Maan</span><span class="v">${moonIcon} ${moonName} · ${illum}%</span></div>
    <div class="kv"><span class="k">Sterren</span><span class="v ${starCls}">${starLabel}</span></div>
    <div class="kv"><span class="k">ISS</span><span class="v" id="issLine">—</span></div>`;
}
function renderAirQuality(aq) {
  if (!aq || !aq.current) { els.aqInfo.innerHTML = `<div class="kv"><span class="k">Status</span><span class="v warn">geen data</span></div>`; return; }
  const c = aq.current, [label, cls] = aqiInfo(c.european_aqi);
  els.aqInfo.innerHTML = `
    <div class="kv"><span class="k">EAQI</span><span class="v ${cls}">${c.european_aqi ?? "—"} · ${label}</span></div>
    <div class="kv"><span class="k">PM2.5</span><span class="v">${c.pm2_5 ?? "—"} µg/m³</span></div>
    <div class="kv"><span class="k">PM10</span><span class="v">${c.pm10 ?? "—"} µg/m³</span></div>
    <div class="kv"><span class="k">Ozon O₃</span><span class="v">${c.ozone ?? "—"} µg/m³</span></div>
    <div class="kv"><span class="k">NO₂</span><span class="v">${c.nitrogen_dioxide ?? "—"} µg/m³</span></div>
    <div class="kv"><span class="k">UV nu</span><span class="v">${c.uv_index ?? "—"}</span></div>`;
}

/* ---------- aircraft → map markers ---------- */
async function loadAircraft() {
  const { lat, lon } = cur;
  try {
    const res = await fetch(`https://api.airplanes.live/v2/point/${lat.toFixed(4)}/${lon.toFixed(4)}/70`);
    if (!res.ok) throw new Error("rate limit");
    const data = await res.json();
    const states = (data.ac || []).map((a) => ({ call: (a.flight || a.r || "").trim() || "—", type: a.t, lat: a.lat, lon: a.lon, alt: a.alt_baro === "ground" ? 0 : (a.alt_baro != null ? a.alt_baro * 0.3048 : 0), onGround: a.alt_baro === "ground", kmh: a.gs != null ? a.gs * 1.852 : 0, track: a.track || a.true_heading || 0 })).filter((p) => p.lat != null && p.lon != null && !p.onGround);
    states.forEach((p) => { p.dist = haversine(lat, lon, p.lat, p.lon); });
    states.sort((a, b) => a.dist - b.dist);
    els.airCount.textContent = `✈ ${states.length}`;
    planeLayer.clearLayers();
    states.slice(0, 60).forEach((p) => {
      const icon = L.divIcon({ className: "plane-marker", html: `<div style="transform:rotate(${p.track}deg)">✈</div>`, iconSize: [18, 18] });
      L.marker([p.lat, p.lon], { icon }).addTo(planeLayer).bindPopup(`<b>✈ ${p.call}</b><br>${p.type ? p.type + " · " : ""}${Math.round(p.alt)} m · ${Math.round(p.kmh)} km/h<br>koers ${compass(p.track)} · ${p.dist.toFixed(0)} km`);
    });
  } catch { els.airCount.textContent = "✈ --"; }
}

/* ---------- ISS → map marker ---------- */
async function loadISS() {
  try {
    const d = await (await fetch("https://api.wheretheiss.at/v1/satellites/25544")).json();
    const dist = haversine(cur.lat, cur.lon, d.latitude, d.longitude);
    const issLine = document.getElementById("issLine"); if (issLine) issLine.textContent = `${dist.toFixed(0)} km · ${Math.round(d.altitude)} km`;
    window._iss = { lat: d.latitude, lon: d.longitude, alt: d.altitude, vel: d.velocity, dist };
    if (!overlays.iss) return;
    const icon = L.divIcon({ className: "iss-marker", html: "🛰️", iconSize: [22, 22] });
    if (issMarker) issMarker.setLatLng([d.latitude, d.longitude]);
    else { issMarker = L.marker([d.latitude, d.longitude], { icon, zIndexOffset: 900 }).bindPopup(`<b>🛰️ ISS</b><br>${Math.round(d.altitude)} km hoog · ${Math.round(d.velocity)} km/h<br>${dist.toFixed(0)} km van huis`); issMarker.addTo(issLayer); }
  } catch { const issLine = document.getElementById("issLine"); if (issLine) issLine.textContent = "offline"; }
}

/* ---------- intel (Wikipedia) → map markers ---------- */
async function loadIntel(lat, lon) {
  try {
    const url = `https://nl.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=10000&gslimit=20&format=json&origin=*`;
    const data = await (await fetch(url)).json();
    const places = (data.query && data.query.geosearch) || [];
    intelLayer.clearLayers();
    places.forEach((p) => {
      const icon = L.divIcon({ className: "intel-marker", html: "⌬", iconSize: [16, 16] });
      L.marker([p.lat, p.lon], { icon }).addTo(intelLayer).bindPopup(`<b>⌬ ${p.title}</b><br>${p.dist < 1000 ? p.dist + " m" : (p.dist / 1000).toFixed(1) + " km"}<br><a href="https://nl.wikipedia.org/?curid=${p.pageid}" target="_blank" rel="noopener">Wikipedia →</a>`);
    });
  } catch {}
}

/* ---------- seismic (USGS) → map markers ---------- */
async function loadSeismic(lat, lon) {
  try {
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=1500&minmagnitude=2&orderby=time&limit=25`;
    const data = await (await fetch(url)).json();
    seismicLayer.clearLayers();
    (data.features || []).forEach((q) => {
      const m = q.properties.mag, [qlon, qlat] = q.geometry.coordinates;
      const r = Math.max(8, (m || 1) * 6);
      const color = m >= 4 ? "#ff5d6c" : m >= 2.5 ? "#ffc24d" : "#2bff9e";
      const when = new Date(q.properties.time).toLocaleString("nl-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      L.circleMarker([qlat, qlon], { radius: r, color, weight: 2, fillColor: color, fillOpacity: 0.25 }).addTo(seismicLayer)
        .bindPopup(`<b>⚠ M${m?.toFixed(1)}</b> ${q.properties.place || ""}<br>${when}`);
    });
  } catch {}
}

/* ============================================================ command line ============================================================ */
const COMMANDS = {
  help() {
    openLog(); logLine("commando's:", "hl");
    logLine("  goto <adres>     target lock op een locatie", "out");
    logLine("  fix              GPS-fix op je positie", "out");
    logLine("  base <laag>      aerial | dark | terrain | nasa", "out");
    logLine("  radar [on|off]   neerslag-radar (animatie)", "out");
    logLine("  play / pause     radar-animatie", "out");
    logLine("  planes|iss|intel|seismic   laag aan/uit", "out");
    logLine("  zoom <n>         kaartzoom (1-19)", "out");
    logLine("  scan             alle feeds verversen", "out");
    logLine("  clear            logboek wissen", "out");
  },
  clear() { els.cmdLog.innerHTML = ""; },
  scan() { logLine("> alle feeds verversen...", "out"); loadLocation(cur.lat, cur.lon, cur.label); },
  refresh() { this.scan(); },
  fix() { fixGps(); }, here() { fixGps(); },
  goto(a) { const q = a.join(" ").trim(); if (!q) { logLine("gebruik: goto <adres>", "err"); return; } logLine(`> zoeken: ${q}`, "echo"); fetchSuggestions(q, true); },
  base(a) { const l = (a[0] || "").toLowerCase(); if (!BASES[l]) { logLine("basislagen: aerial | dark | terrain | nasa", "err"); return; } setBase(l, true); },
  map(a) { this.base(a); },
  radar(a) { const v = (a[0] || "").toLowerCase(); const on = v === "off" ? false : v === "on" ? true : !overlays.radar; toggleOverlay("radar", true, on); },
  play() { if (!overlays.radar) toggleOverlay("radar", true, true); startRadarAnim(); logLine("> radar ▶", "out"); },
  pause() { stopRadarAnim(); logLine("> radar ⏸", "out"); },
  planes() { toggleOverlay("planes", true); }, plane() { toggleOverlay("planes", true); },
  iss() { toggleOverlay("iss", true, true); if (window._iss) { map.setView([window._iss.lat, window._iss.lon], 4); logLine(`> ISS: ${window._iss.dist.toFixed(0)} km · ${Math.round(window._iss.alt)} km hoog · ${Math.round(window._iss.vel)} km/h`, "out"); } },
  intel() { toggleOverlay("intel", true, true); logLine("> intel-laag AAN", "out"); },
  seismic() { toggleOverlay("seismic", true, true); logLine("> seismiek-laag AAN", "out"); }, quake() { this.seismic(); },
  zoom(a) { const z = parseInt(a[0], 10); if (isNaN(z) || z < 1 || z > 19) { logLine("zoom 1-19", "err"); return; } if (map) { map.setZoom(z); logLine(`> zoom → ${z}`, "out"); } },
  wx() { logLine(`> ${els.nowTemp.textContent} ${els.nowDesc.textContent} · ${els.nowFeels.textContent}`, "out"); }, weer() { this.wx(); },
  whoami() { logLine("Victor Deleeck // Astroleck. Bouwer, ruimtevaart-enthousiast, toekomstig oprichter van Astroleck Technologies. 🚀", "hl"); },
};
els.cmdInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const raw = els.cmdInput.value.trim(); els.cmdInput.value = ""; if (!raw) return;
  openLog(); logLine(`$ ${raw}`, "echo");
  const [cmd, ...args] = raw.split(/\s+/); const fn = COMMANDS[cmd.toLowerCase()];
  if (fn) { try { fn.call(COMMANDS, args); } catch (err) { logLine("fout: " + err.message, "err"); } }
  else logLine(`onbekend commando: ${cmd} — typ 'help'`, "err");
});

boot();
