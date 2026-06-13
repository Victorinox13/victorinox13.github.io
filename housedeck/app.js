/* ============================================================
   HouseDeck — cyberdeck surveillance console
   Feeds (all keyless + CORS-friendly, static-site safe):
     Open-Meteo (weer + luchtkwaliteit)
     Photon/OSM (geocoding)
     Esri / CARTO / OpenTopoMap / NASA GIBS (kaartlagen)
     OpenSky Network (live vliegtuigen)
     wheretheiss.at (ISS-positie)
     Wikipedia (nabije plekken / geschiedenis)
     USGS (aardbevingen)
   ============================================================ */

/* ---------- weather code lookup ---------- */
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

/* ---------- astronomy ---------- */
function moonPhase(date) {
  const synodic = 29.53058867;
  const known = Date.UTC(2000, 0, 6, 18, 14, 0);
  let phase = (((date.getTime() - known) / 86400000) % synodic) / synodic;
  if (phase < 0) phase += 1;
  return phase;
}
function moonInfo(phase) {
  const steps = [
    [0.02, "Nieuwe maan", "🌑"], [0.25, "Wassende sikkel", "🌒"], [0.27, "Eerste kwartier", "🌓"],
    [0.48, "Wassende maan", "🌔"], [0.52, "Volle maan", "🌕"], [0.73, "Afnemende maan", "🌖"],
    [0.77, "Laatste kwartier", "🌗"], [0.98, "Afnemende sikkel", "🌘"], [1.01, "Nieuwe maan", "🌑"]
  ];
  for (const [limit, name, icon] of steps) if (phase <= limit) return [name, icon];
  return ["Nieuwe maan", "🌑"];
}
function sunPosition(date, lat, lon) {
  const rad = Math.PI / 180, dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;
  const d = (date.valueOf() / dayMs - 0.5 + J1970) - J2000;
  const e = rad * 23.4397;
  const M = rad * (357.5291 + 0.98560028 * d);
  const L = M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
  const lw = rad * -lon, phi = rad * lat;
  const H = (rad * (280.16 + 360.9856235 * d) - lw) - ra;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  let az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  az = (az / rad + 180) % 360;
  return { altitude: alt / rad, azimuth: az };
}

function aqiInfo(aqi) {
  if (aqi == null) return ["—", ""];
  if (aqi <= 20) return ["Goed", "good"];
  if (aqi <= 40) return ["Redelijk", "good"];
  if (aqi <= 60) return ["Matig", ""];
  if (aqi <= 80) return ["Slecht", "warn"];
  if (aqi <= 100) return ["Zeer slecht", "warn"];
  return ["Extreem slecht", "bad"];
}

/* ---------- DOM ---------- */
const els = {
  addressInput: document.getElementById("addressInput"),
  suggestions: document.getElementById("suggestions"),
  gpsBtn: document.getElementById("gpsBtn"),
  clock: document.getElementById("clock"),
  deck: document.getElementById("deck"),
  locName: document.getElementById("locName"),
  coordReadout: document.getElementById("coordReadout"),
  airCount: document.getElementById("airCount"),
  nowIcon: document.getElementById("nowIcon"),
  nowTemp: document.getElementById("nowTemp"),
  nowDesc: document.getElementById("nowDesc"),
  nowFeels: document.getElementById("nowFeels"),
  statGrid: document.getElementById("statGrid"),
  skyInfo: document.getElementById("skyInfo"),
  airInfo: document.getElementById("airInfo"),
  aqInfo: document.getElementById("aqInfo"),
  intelInfo: document.getElementById("intelInfo"),
  seismicInfo: document.getElementById("seismicInfo"),
  sysInfo: document.getElementById("sysInfo"),
  windowScene: document.getElementById("windowScene"),
  windowText: document.getElementById("windowText"),
  hourly: document.getElementById("hourly"),
  daily: document.getElementById("daily"),
  cmdInput: document.getElementById("cmdInput"),
  cmdLog: document.getElementById("cmdLog"),
  cmdLogToggle: document.getElementById("cmdLogToggle"),
};

/* ---------- global state ---------- */
let map = null, marker = null, baseLayer = null;
let planeLayer = null, issMarker = null;
let cur = { lat: 51.2920, lon: 4.5773, label: "Sint-Job-in-'t-Goor, Brecht" };
let airTimer = null, issTimer = null;
const HOUSE_ZOOM = 17;

/* ---------- clock ---------- */
function tickClock() {
  els.clock.textContent = new Date().toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
tickClock(); setInterval(tickClock, 1000);

/* ---------- command log ---------- */
function logLine(text, cls) {
  const span = document.createElement("span");
  span.className = cls || "out";
  span.textContent = text + "\n";
  els.cmdLog.appendChild(span);
  els.cmdLog.scrollTop = els.cmdLog.scrollHeight;
}
function openLog() { els.cmdLog.classList.add("open"); }
els.cmdLogToggle.addEventListener("click", () => els.cmdLog.classList.toggle("open"));

/* ---------- boot sequence ---------- */
function boot() {
  const bootEl = document.getElementById("boot");
  const log = document.getElementById("bootLog");
  const lines = [
    "HOUSEDECK v3.0 // ASTROLECK SURVEILLANCE SUITE",
    "------------------------------------------------",
    "[<span class='hl'>BOOT</span>] kernel ............... <span class='ok'>OK</span>",
    "[<span class='hl'>LINK</span>] open-meteo grid ....... <span class='ok'>OK</span>",
    "[<span class='hl'>LINK</span>] opensky network ....... <span class='ok'>OK</span>",
    "[<span class='hl'>LINK</span>] nasa gibs imagery ..... <span class='ok'>OK</span>",
    "[<span class='hl'>LINK</span>] iss telemetry ........ <span class='ok'>OK</span>",
    "[<span class='hl'>LINK</span>] wikipedia intel ...... <span class='ok'>OK</span>",
    "[<span class='hl'>LINK</span>] usgs seismic ......... <span class='ok'>OK</span>",
    "------------------------------------------------",
    "acquiring target lock ...",
  ];
  let i = 0;
  (function step() {
    if (i < lines.length) {
      log.innerHTML += lines[i] + "\n";
      i++;
      setTimeout(step, 95);
    } else {
      setTimeout(() => {
        bootEl.classList.add("done");
        els.deck.classList.remove("hidden");
        logLine("HouseDeck online. Typ 'help' voor commando's.", "out");
        loadLocation(cur.lat, cur.lon, cur.label);
        setTimeout(() => map && map.invalidateSize(), 200);
      }, 350);
    }
  })();
}

/* ---------- geocoding (Photon) ---------- */
let searchTimer = null, activeSuggestion = -1, currentResults = [];

els.addressInput.addEventListener("input", () => {
  const q = els.addressInput.value.trim();
  clearTimeout(searchTimer);
  if (q.length < 2) { closeSuggestions(); return; }
  searchTimer = setTimeout(() => fetchSuggestions(q), 300);
});
els.addressInput.addEventListener("keydown", (e) => {
  const items = [...els.suggestions.children];
  if (e.key === "ArrowDown") { e.preventDefault(); activeSuggestion = Math.min(activeSuggestion + 1, items.length - 1); highlightSuggestion(items); }
  else if (e.key === "ArrowUp") { e.preventDefault(); activeSuggestion = Math.max(activeSuggestion - 1, 0); highlightSuggestion(items); }
  else if (e.key === "Enter") {
    e.preventDefault();
    if (activeSuggestion >= 0 && currentResults[activeSuggestion]) pickResult(currentResults[activeSuggestion]);
    else if (currentResults[0]) pickResult(currentResults[0]);
    else { const q = els.addressInput.value.trim(); if (q.length >= 2) fetchSuggestions(q, true); }
  } else if (e.key === "Escape") closeSuggestions();
});
document.addEventListener("click", (e) => {
  if (!els.suggestions.contains(e.target) && e.target !== els.addressInput) closeSuggestions();
});
function highlightSuggestion(items) { items.forEach((el, i) => el.classList.toggle("active", i === activeSuggestion)); }
function closeSuggestions() { els.suggestions.classList.remove("open"); els.suggestions.innerHTML = ""; activeSuggestion = -1; }

async function fetchSuggestions(q, autoSelect) {
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=en`);
    const data = await res.json();
    currentResults = (data && data.features) || [];
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
  currentResults.forEach((f) => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    const [main, sub] = addressLines(f);
    div.innerHTML = `<span>${main}</span><span class="muted">${sub}</span>`;
    div.addEventListener("click", () => pickResult(f));
    els.suggestions.appendChild(div);
  });
  activeSuggestion = -1; els.suggestions.classList.add("open");
}
function pickResult(f) {
  closeSuggestions();
  const [main, sub] = addressLines(f);
  const label = [main, sub].filter(Boolean).join(", ");
  els.addressInput.value = label;
  const [lon, lat] = f.geometry.coordinates;
  logLine(`> target lock: ${label}`, "echo");
  loadLocation(lat, lon, label);
}

/* ---------- GPS ---------- */
els.gpsBtn.addEventListener("click", fixGps);
function fixGps() {
  if (!navigator.geolocation) { logLine("geolocatie niet ondersteund.", "err"); openLog(); return; }
  logLine("> GPS-fix opvragen...", "echo"); openLog();
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    let label = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    try {
      const res = await fetch(`https://photon.komoot.io/reverse?lon=${longitude}&lat=${latitude}&lang=en`);
      const data = await res.json();
      if (data && data.features && data.features[0]) {
        const [main, sub] = addressLines(data.features[0]);
        label = [main, sub].filter(Boolean).join(", ");
      }
    } catch {}
    els.addressInput.value = label;
    logLine(`> fix: ${label}`, "out");
    loadLocation(latitude, longitude, label);
  }, (err) => logLine("GPS-fout: " + err.message, "err"), { enableHighAccuracy: true, timeout: 10000 });
}

/* ---------- map + layers ---------- */
const yesterday = (() => { const d = new Date(Date.now() - 86400000); return d.toISOString().slice(0, 10); })();
const LAYERS = {
  aerial: () => L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Esri · Maxar · Earthstar" }),
  dark: () => L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    { subdomains: "abcd", maxZoom: 19, attribution: "CARTO · OSM" }),
  terrain: () => L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    { subdomains: "abc", maxZoom: 17, attribution: "OpenTopoMap · OSM" }),
  nasa: () => L.tileLayer(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${yesterday}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    { maxNativeZoom: 9, maxZoom: 19, attribution: `NASA GIBS · MODIS Terra ${yesterday}` }),
};
let currentLayerName = "aerial";

function initMap(lat, lon) {
  if (map) return;
  map = L.map("map", { zoomControl: false, attributionControl: true }).setView([lat, lon], HOUSE_ZOOM);
  L.control.zoom({ position: "bottomleft" }).addTo(map);
  setLayer("aerial");
  planeLayer = L.layerGroup().addTo(map);

  document.querySelectorAll(".lyr").forEach((btn) => {
    btn.addEventListener("click", () => setLayer(btn.dataset.layer, true));
  });

  // keep tile bounds in sync with any container size change (resize, rotate, layout shift)
  if (window.ResizeObserver) {
    let rsTimer = null;
    new ResizeObserver(() => {
      clearTimeout(rsTimer);
      rsTimer = setTimeout(() => map && map.invalidateSize(), 120);
    }).observe(document.getElementById("map"));
  }
  window.addEventListener("resize", () => map && map.invalidateSize());
}
function setLayer(name, fromClick) {
  if (!LAYERS[name]) return;
  if (baseLayer && map) map.removeLayer(baseLayer);
  baseLayer = LAYERS[name]();
  if (map) baseLayer.addTo(map).bringToBack();
  currentLayerName = name;
  document.querySelectorAll(".lyr").forEach((b) => b.classList.toggle("active", b.dataset.layer === name));
  if (fromClick) { logLine(`> kaartlaag → ${name.toUpperCase()}`, "out"); }
}
function setMarker(lat, lon) {
  const icon = L.divIcon({ className: "house-marker", iconSize: [18, 18] });
  if (marker) marker.setLatLng([lat, lon]);
  else marker = L.marker([lat, lon], { icon, zIndexOffset: 1000 }).addTo(map);
}

/* ---------- main load ---------- */
function loadLocation(lat, lon, label) {
  cur = { lat, lon, label };
  els.locName.textContent = label;
  els.coordReadout.textContent = `LAT ${lat.toFixed(4)} · LON ${lon.toFixed(4)}`;

  initMap(lat, lon);
  map.invalidateSize();
  map.setView([lat, lon], HOUSE_ZOOM);
  setMarker(lat, lon);
  // robust re-sync of tile bounds after layout settles (map may have been built while hidden)
  [80, 300, 700, 1400].forEach((t) => setTimeout(() => { map.invalidateSize(); }, t));

  loadWeather(lat, lon);
  loadAircraft(); loadISS();
  loadIntel(lat, lon); loadSeismic(lat, lon);

  clearInterval(airTimer); airTimer = setInterval(loadAircraft, 20000);
  clearInterval(issTimer); issTimer = setInterval(loadISS, 10000);
}

/* ---------- weather feed ---------- */
async function loadWeather(lat, lon) {
  try {
    const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,precipitation,is_day` +
      `&hourly=temperature_2m,precipitation_probability,weather_code,visibility,cloud_cover` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max` +
      `&timezone=auto&forecast_days=7`;
    const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,uv_index&timezone=auto`;
    const [wRes, aqRes] = await Promise.all([fetch(wUrl), fetch(aqUrl)]);
    const weather = await wRes.json();
    const aq = aqRes.ok ? await aqRes.json() : null;
    renderCurrent(weather); renderHourly(weather); renderDaily(weather);
    renderSky(weather, lat, lon); renderAirQuality(aq); renderSystem(weather, lat, lon); renderWindow(weather);
  } catch (e) {
    logLine("weerfeed offline: " + e.message, "err");
  }
}

function renderCurrent(data) {
  const c = data.current;
  const [desc, icon] = describe(c.weather_code);
  els.nowIcon.textContent = icon;
  els.nowTemp.textContent = Math.round(c.temperature_2m) + "°";
  els.nowDesc.textContent = desc;
  els.nowFeels.textContent = "voelt als " + Math.round(c.apparent_temperature) + "°C";
  const stats = [
    ["Wind", `${Math.round(c.wind_speed_10m)} km/h ${compass(c.wind_direction_10m)}`],
    ["Stoten", `${Math.round(c.wind_gusts_10m || 0)} km/h`],
    ["Vocht", `${c.relative_humidity_2m}%`],
    ["Druk", `${Math.round(c.surface_pressure)} hPa`],
    ["Wolken", `${c.cloud_cover}%`],
    ["Neerslag", `${c.precipitation} mm`],
  ];
  els.statGrid.innerHTML = stats.map(([l, v]) => `<div class="stat"><span class="label">${l}</span><span class="value">${v}</span></div>`).join("");
}
function renderHourly(data) {
  const times = data.hourly.time, now = new Date();
  let start = times.findIndex((t) => new Date(t) >= now); if (start === -1) start = 0;
  let html = "";
  for (let i = start; i < start + 24 && i < times.length; i++) {
    const t = new Date(times[i]), temp = Math.round(data.hourly.temperature_2m[i]);
    const precip = data.hourly.precipitation_probability[i], [, icon] = describe(data.hourly.weather_code[i]);
    html += `<div class="hour-card"><div class="time">${t.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}</div><div class="icon">${icon}</div><div class="temp">${temp}°</div><div class="precip">💧${precip}%</div></div>`;
  }
  els.hourly.innerHTML = html;
}
function renderDaily(data) {
  const days = data.daily.time; let html = "";
  for (let i = 0; i < days.length; i++) {
    const date = new Date(days[i]), [desc, icon] = describe(data.daily.weather_code[i]);
    const max = Math.round(data.daily.temperature_2m_max[i]), min = Math.round(data.daily.temperature_2m_min[i]);
    const precip = data.daily.precipitation_probability_max[i];
    const dayName = i === 0 ? "Vandaag" : date.toLocaleDateString("nl-BE", { weekday: "long" });
    html += `<div class="day-row"><div class="day-name">${dayName}</div><div class="icon">${icon}</div><div class="precip">${desc} · 💧${precip}%</div><div class="range"><span>${max}°</span><span class="lo">${min}°</span></div></div>`;
  }
  els.daily.innerHTML = html;
}

/* ---------- sky / astronomy ---------- */
function renderSky(data, lat, lon) {
  const now = new Date();
  const sunrise = new Date(data.daily.sunrise[0]), sunset = new Date(data.daily.sunset[0]);
  const dayLen = sunset - sunrise, progress = Math.min(1, Math.max(0, (now - sunrise) / dayLen));
  const isDay = now >= sunrise && now <= sunset;
  const sun = sunPosition(now, lat, lon);
  const phase = moonPhase(now), [moonName, moonIcon] = moonInfo(phase);
  const illum = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100);

  // stargazing index: needs night + clear + dark moon
  const cloud = data.current.cloud_cover;
  let starScore = 0, starLabel = "—", starCls = "";
  if (isDay) { starLabel = "dag — niet zichtbaar"; }
  else {
    starScore = Math.round((100 - cloud) * 0.7 + (100 - illum) * 0.3);
    starLabel = starScore >= 70 ? "uitstekend ✦✦✦" : starScore >= 45 ? "redelijk ✦✦" : "zwak ✦";
    starCls = starScore >= 70 ? "good" : starScore >= 45 ? "" : "warn";
  }

  els.skyInfo.innerHTML = `
    <div class="kv"><span class="k">Status</span><span class="v ${isDay ? "good" : ""}">${isDay ? "☀️ Dag" : "🌙 Nacht"}</span></div>
    <div class="daylight-bar"><span style="width:${(progress * 100).toFixed(1)}%"></span></div>
    <div class="kv"><span class="k">Zon hoogte / az.</span><span class="v">${sun.altitude.toFixed(1)}° · ${compass(sun.azimuth)}</span></div>
    <div class="kv"><span class="k">Op / onder</span><span class="v">${sunrise.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })} · ${sunset.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}</span></div>
    <div class="kv"><span class="k">UV (max)</span><span class="v ${data.daily.uv_index_max[0] >= 6 ? "warn" : "good"}">${data.daily.uv_index_max[0]}</span></div>
    <div class="kv"><span class="k">Maan</span><span class="v">${moonIcon} ${moonName} · ${illum}%</span></div>
    <div class="kv"><span class="k">Sterren-index</span><span class="v ${starCls}">${starLabel}</span></div>
    <div class="kv"><span class="k">ISS</span><span class="v" id="issLine">scannen…</span></div>
  `;
}

/* ---------- air quality ---------- */
function renderAirQuality(aq) {
  if (!aq || !aq.current) { els.aqInfo.innerHTML = `<div class="kv"><span class="k">Status</span><span class="v warn">geen data</span></div>`; return; }
  const c = aq.current, [label, cls] = aqiInfo(c.european_aqi);
  els.aqInfo.innerHTML = `
    <div class="kv"><span class="k">EAQI</span><span class="v ${cls}">${c.european_aqi ?? "—"} · ${label}</span></div>
    <div class="kv"><span class="k">PM2.5</span><span class="v">${c.pm2_5 ?? "—"} µg/m³</span></div>
    <div class="kv"><span class="k">PM10</span><span class="v">${c.pm10 ?? "—"} µg/m³</span></div>
    <div class="kv"><span class="k">Ozon O₃</span><span class="v">${c.ozone ?? "—"} µg/m³</span></div>
    <div class="kv"><span class="k">NO₂</span><span class="v">${c.nitrogen_dioxide ?? "—"} µg/m³</span></div>
    <div class="kv"><span class="k">UV nu</span><span class="v">${c.uv_index ?? "—"}</span></div>
  `;
}

/* ---------- air traffic (airplanes.live, CORS-friendly ADS-B) ---------- */
async function loadAircraft() {
  const { lat, lon } = cur;
  const url = `https://api.airplanes.live/v2/point/${lat.toFixed(4)}/${lon.toFixed(4)}/70`; // 70 nm ~ 130 km
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("rate limit");
    const data = await res.json();
    const states = (data.ac || []).map((a) => ({
      call: (a.flight || a.r || "").trim() || "—",
      reg: a.r, type: a.t,
      lat: a.lat, lon: a.lon,
      alt: a.alt_baro === "ground" ? 0 : (a.alt_baro != null ? a.alt_baro * 0.3048 : 0), // ft → m
      onGround: a.alt_baro === "ground",
      kmh: a.gs != null ? a.gs * 1.852 : 0, // kts → km/h
      track: a.track || a.true_heading || 0,
    })).filter((p) => p.lat != null && p.lon != null && !p.onGround);
    states.forEach((p) => { p.dist = haversine(lat, lon, p.lat, p.lon); });
    states.sort((a, b) => a.dist - b.dist);
    renderAircraft(states);
  } catch (e) {
    els.airInfo.innerHTML = `<div class="feed-empty">luchtfeed tijdelijk offline — opnieuw over 20s</div>`;
    els.airCount.textContent = "✈ --";
  }
}
function renderAircraft(states) {
  els.airCount.textContent = `✈ ${states.length}`;
  if (planeLayer) {
    planeLayer.clearLayers();
    states.slice(0, 50).forEach((p) => {
      const icon = L.divIcon({ className: "plane-marker", html: `<div style="transform:rotate(${p.track}deg)">✈</div>`, iconSize: [18, 18] });
      L.marker([p.lat, p.lon], { icon }).addTo(planeLayer)
        .bindTooltip(`${p.call}${p.type ? " · " + p.type : ""} · ${Math.round(p.alt)} m · ${Math.round(p.kmh)} km/h`, { direction: "top" });
    });
  }
  if (!states.length) { els.airInfo.innerHTML = `<div class="feed-empty">geen vliegtuigen binnen ~130 km</div>`; return; }
  els.airInfo.innerHTML = states.slice(0, 8).map((p) => `
    <div class="feed-item">
      <div class="fi-top"><span class="fi-main">✈ ${p.call}</span><span class="fi-tag">${p.dist.toFixed(0)} km</span></div>
      <div class="fi-sub">${Math.round(p.alt)} m · ${Math.round(p.kmh)} km/h · koers ${compass(p.track)}${p.type ? " · " + p.type : ""}</div>
    </div>`).join("");
}

/* ---------- ISS (wheretheiss.at) ---------- */
async function loadISS() {
  try {
    const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544");
    const d = await res.json();
    const dist = haversine(cur.lat, cur.lon, d.latitude, d.longitude);
    const issLine = document.getElementById("issLine");
    if (issLine) issLine.textContent = `${dist.toFixed(0)} km · ${Math.round(d.altitude)} km hoog`;
    const icon = L.divIcon({ className: "iss-marker", html: "🛰️", iconSize: [22, 22] });
    if (issMarker) issMarker.setLatLng([d.latitude, d.longitude]);
    else if (map) issMarker = L.marker([d.latitude, d.longitude], { icon, zIndexOffset: 900 }).addTo(map).bindTooltip("ISS", { direction: "top" });
    window._iss = { lat: d.latitude, lon: d.longitude, alt: d.altitude, vel: d.velocity, dist };
  } catch {
    const issLine = document.getElementById("issLine");
    if (issLine) issLine.textContent = "feed offline";
  }
}

/* ---------- intel (Wikipedia geosearch) ---------- */
async function loadIntel(lat, lon) {
  els.intelInfo.innerHTML = `<div class="feed-empty">scannen…</div>`;
  try {
    const url = `https://nl.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=10000&gslimit=12&format=json&origin=*`;
    const res = await fetch(url);
    const data = await res.json();
    const places = (data.query && data.query.geosearch) || [];
    if (!places.length) { els.intelInfo.innerHTML = `<div class="feed-empty">geen nabije artikels gevonden</div>`; return; }
    els.intelInfo.innerHTML = places.map((p) => `
      <div class="feed-item">
        <div class="fi-top"><a class="fi-main" href="https://nl.wikipedia.org/?curid=${p.pageid}" target="_blank" rel="noopener">⌬ ${p.title}</a><span class="fi-tag">${p.dist < 1000 ? p.dist + " m" : (p.dist / 1000).toFixed(1) + " km"}</span></div>
      </div>`).join("");
  } catch {
    els.intelInfo.innerHTML = `<div class="feed-empty">intel-feed offline</div>`;
  }
}

/* ---------- seismic (USGS) ---------- */
async function loadSeismic(lat, lon) {
  els.seismicInfo.innerHTML = `<div class="feed-empty">scannen…</div>`;
  try {
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=600&minmagnitude=1.5&orderby=time&limit=10`;
    const res = await fetch(url);
    const data = await res.json();
    const quakes = (data.features || []);
    if (!quakes.length) { els.seismicInfo.innerHTML = `<div class="feed-empty">geen seismiek binnen 600 km — rustig</div>`; return; }
    els.seismicInfo.innerHTML = quakes.map((q) => {
      const m = q.properties.mag, [qlon, qlat] = q.geometry.coordinates;
      const dist = haversine(lat, lon, qlat, qlon);
      const when = new Date(q.properties.time).toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      const color = m >= 4 ? "var(--bad)" : m >= 2.5 ? "var(--warn)" : "var(--good)";
      return `<div class="feed-item">
        <div class="fi-top"><span class="fi-main"><span class="mag-pill" style="color:${color}">M${m?.toFixed(1)}</span> ${q.properties.place || "onbekend"}</span><span class="fi-tag">${dist.toFixed(0)} km</span></div>
        <div class="fi-sub">${when}</div>
      </div>`;
    }).join("");
  } catch {
    els.seismicInfo.innerHTML = `<div class="feed-empty">seismische feed offline</div>`;
  }
}

/* ---------- telemetry ---------- */
function renderSystem(data, lat, lon) {
  const now = new Date();
  els.sysInfo.innerHTML = `
    <div class="kv"><span class="k">Latitude</span><span class="v">${lat.toFixed(5)}</span></div>
    <div class="kv"><span class="k">Longitude</span><span class="v">${lon.toFixed(5)}</span></div>
    <div class="kv"><span class="k">Hoogte</span><span class="v">${Math.round(data.elevation)} m</span></div>
    <div class="kv"><span class="k">Tijdzone</span><span class="v">${data.timezone}</span></div>
    <div class="kv"><span class="k">Kaartlaag</span><span class="v">${currentLayerName.toUpperCase()}</span></div>
    <div class="kv"><span class="k">Laatste sync</span><span class="v good">${now.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></div>
  `;
}

/* ---------- window scene ---------- */
function renderWindow(data) {
  const c = data.current, isDay = c.is_day === 1, cloud = c.cloud_cover;
  const visM = data.hourly.visibility[0], visKm = visM ? (visM / 1000).toFixed(1) : "?";
  const [desc] = describe(c.weather_code);
  const isRain = c.precipitation > 0 || (c.weather_code >= 51 && c.weather_code <= 99 && ![71, 73, 75].includes(c.weather_code));
  let skyTop, skyBottom;
  if (!isDay) { skyTop = "#03040d"; skyBottom = "#0a1430"; }
  else if (cloud > 70) { skyTop = "#2a2f44"; skyBottom = "#4a5575"; }
  else if (cloud > 30) { skyTop = "#1f3a6e"; skyBottom = "#5a7fc9"; }
  else { skyTop = "#0d2f6e"; skyBottom = "#3a72d6"; }
  let scene = `<div class="sky" style="background:linear-gradient(180deg,${skyTop},${skyBottom})"></div>`;
  scene += `<div class="${isDay ? "sun" : "moon"}"></div>`;
  const cloudCount = Math.round(cloud / 25);
  for (let i = 0; i < cloudCount; i++) {
    const w = 60 + Math.random() * 80, h = w * 0.4, top = 10 + Math.random() * 50, left = (i * 28 + Math.random() * 15) % 90;
    scene += `<div class="cloud" style="width:${w}px;height:${h}px;top:${top}%;left:${left}%;"></div>`;
  }
  if (isRain) scene += `<div class="rain"></div>`;
  els.windowScene.innerHTML = scene;
  let visText = visKm === "?" ? "onbekend zicht" : visKm > 15 ? `helder zicht tot ver aan de horizon (${visKm} km)` : visKm > 5 ? `goed zicht tot ~${visKm} km` : visKm > 1 ? `beperkt zicht, ~${visKm} km` : `sterk beperkt zicht (${visKm} km)`;
  let cloudText = cloud < 15 ? "een vrijwel onbewolkte hemel" : cloud < 50 ? "een licht bewolkte hemel" : cloud < 85 ? "een overwegend bewolkte hemel" : "een dicht wolkendek";
  els.windowText.innerHTML = `Buiten zie je <strong>${desc.toLowerCase()}</strong>: ${cloudText}, met ${visText}.${isRain ? " Houd een paraplu bij de hand." : ""}`;
}

/* ============================================================
   command line
   ============================================================ */
const COMMANDS = {
  help() {
    openLog();
    logLine("commando's:", "hl");
    logLine("  goto <adres>   target lock op een locatie", "out");
    logLine("  fix            GPS-fix op je huidige positie", "out");
    logLine("  map <laag>     aerial | dark | terrain | nasa", "out");
    logLine("  zoom <n>       kaartzoom (1-19)", "out");
    logLine("  scan           alle feeds verversen", "out");
    logLine("  air            vliegtuigen overhead", "out");
    logLine("  iss            centreer op het ISS", "out");
    logLine("  sky            zon / maan / sterren-status", "out");
    logLine("  wx             huidige condities", "out");
    logLine("  intel          nabije plekken & geschiedenis", "out");
    logLine("  quake          seismiek in de regio", "out");
    logLine("  clear          logboek wissen", "out");
  },
  clear() { els.cmdLog.innerHTML = ""; },
  scan() { logLine("> alle feeds verversen...", "out"); loadLocation(cur.lat, cur.lon, cur.label); },
  refresh() { this.scan(); },
  fix() { fixGps(); },
  here() { fixGps(); },
  goto(args) {
    const q = args.join(" ").trim();
    if (!q) { logLine("gebruik: goto <adres>", "err"); return; }
    logLine(`> zoeken: ${q}`, "echo"); fetchSuggestions(q, true);
  },
  map(args) {
    const l = (args[0] || "").toLowerCase();
    if (!LAYERS[l]) { logLine("lagen: aerial | dark | terrain | nasa", "err"); return; }
    setLayer(l, true);
  },
  zoom(args) {
    const z = parseInt(args[0], 10);
    if (isNaN(z) || z < 1 || z > 19) { logLine("zoom 1-19", "err"); return; }
    if (map) { map.setZoom(z); logLine(`> zoom → ${z}`, "out"); }
  },
  air() { loadAircraft(); logLine(`> ${els.airCount.textContent} binnen bereik`, "out"); },
  planes() { this.air(); },
  iss() {
    if (window._iss && map) { map.setView([window._iss.lat, window._iss.lon], 4); logLine(`> ISS: ${window._iss.dist.toFixed(0)} km · ${Math.round(window._iss.alt)} km hoog · ${Math.round(window._iss.vel)} km/h`, "out"); }
    else logLine("ISS-positie nog niet geladen", "err");
  },
  sky() {
    const sun = sunPosition(new Date(), cur.lat, cur.lon);
    const phase = moonPhase(new Date()), [mn] = moonInfo(phase);
    logLine(`> zon ${sun.altitude.toFixed(1)}° ${compass(sun.azimuth)} · maan ${mn}`, "out");
  },
  wx() {
    logLine(`> ${els.nowTemp.textContent} ${els.nowDesc.textContent} · ${els.nowFeels.textContent}`, "out");
  },
  weer() { this.wx(); },
  intel() { loadIntel(cur.lat, cur.lon); logLine("> intel verversen...", "out"); },
  quake() { loadSeismic(cur.lat, cur.lon); logLine("> seismiek verversen...", "out"); },
  whoami() { logLine("Victor Deleeck // Astroleck. Bouwer, ruimtevaart-enthousiast, toekomstig oprichter van Astroleck Technologies. 🚀", "hl"); },
};

els.cmdInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const raw = els.cmdInput.value.trim();
  els.cmdInput.value = "";
  if (!raw) return;
  openLog();
  logLine(`$ ${raw}`, "echo");
  const [cmd, ...args] = raw.split(/\s+/);
  const fn = COMMANDS[cmd.toLowerCase()];
  if (fn) { try { fn.call(COMMANDS, args); } catch (err) { logLine("fout: " + err.message, "err"); } }
  else logLine(`onbekend commando: ${cmd} — typ 'help'`, "err");
});

/* ---------- go ---------- */
boot();
