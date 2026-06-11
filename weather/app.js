/* WeatherDeck — live weather dashboard
 * Data: Open-Meteo (forecast + air quality), Photon/OpenStreetMap (address geocoding), CARTO (basemap)
 */

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
  return dirs[Math.round(deg / 22.5) % 16];
}

function moonPhase(date) {
  const synodic = 29.53058867;
  const known = Date.UTC(2000, 0, 6, 18, 14, 0); // known new moon
  const diffDays = (date.getTime() - known) / 86400000;
  let phase = (diffDays % synodic) / synodic;
  if (phase < 0) phase += 1;
  return phase;
}

function moonInfo(phase) {
  const steps = [
    [0.02, "Nieuwe maan", "🌑"], [0.25, "Wassende maansikkel", "🌒"], [0.27, "Eerste kwartier", "🌓"],
    [0.48, "Wassende maan", "🌔"], [0.52, "Volle maan", "🌕"], [0.73, "Afnemende maan", "🌖"],
    [0.77, "Laatste kwartier", "🌗"], [0.98, "Afnemende maansikkel", "🌘"], [1.01, "Nieuwe maan", "🌑"]
  ];
  for (const [limit, name, icon] of steps) if (phase <= limit) return [name, icon];
  return ["Nieuwe maan", "🌑"];
}

function aqiInfo(aqi) {
  if (aqi == null) return ["—", ""];
  if (aqi <= 20) return ["Goed", "good"];
  if (aqi <= 40) return ["Redelijk", "good"];
  if (aqi <= 60) return ["Matig", ""];
  if (aqi <= 80) return ["Slecht", "warn"];
  if (aqi <= 100) return ["Zeer slecht", "warn"];
  return ["Extreem slecht", "warn"];
}

const els = {
  addressInput: document.getElementById("addressInput"),
  suggestions: document.getElementById("suggestions"),
  gpsBtn: document.getElementById("gpsBtn"),
  clock: document.getElementById("clock"),
  status: document.getElementById("status"),
  dashboard: document.getElementById("dashboard"),
  locName: document.getElementById("locName"),
  coordReadout: document.getElementById("coordReadout"),
  mapLayerDark: document.getElementById("mapLayerDark"),
  mapLayerSat: document.getElementById("mapLayerSat"),
  nowIcon: document.getElementById("nowIcon"),
  nowTemp: document.getElementById("nowTemp"),
  nowDesc: document.getElementById("nowDesc"),
  nowFeels: document.getElementById("nowFeels"),
  statGrid: document.getElementById("statGrid"),
  windowScene: document.getElementById("windowScene"),
  windowText: document.getElementById("windowText"),
  sunInfo: document.getElementById("sunInfo"),
  aqInfo: document.getElementById("aqInfo"),
  sysInfo: document.getElementById("sysInfo"),
  hourly: document.getElementById("hourly"),
  daily: document.getElementById("daily"),
};

let map = null;
let marker = null;

/* ---------- Clock ---------- */
function tickClock() {
  els.clock.textContent = new Date().toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
tickClock();
setInterval(tickClock, 1000);

/* ---------- Status ---------- */
function setStatus(text, mode) {
  els.status.className = "status-banner" + (mode ? " " + mode : "");
  els.status.innerHTML = `<span class="dot"></span> ${text}`;
}

/* ---------- Geocoding search ---------- */
let searchTimer = null;
let activeSuggestion = -1;
let currentResults = [];

els.addressInput.addEventListener("input", () => {
  const q = els.addressInput.value.trim();
  clearTimeout(searchTimer);
  if (q.length < 2) { closeSuggestions(); return; }
  searchTimer = setTimeout(() => fetchSuggestions(q), 300);
});

els.addressInput.addEventListener("keydown", (e) => {
  const items = [...els.suggestions.children];
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeSuggestion = Math.min(activeSuggestion + 1, items.length - 1);
    highlightSuggestion(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeSuggestion = Math.max(activeSuggestion - 1, 0);
    highlightSuggestion(items);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (activeSuggestion >= 0 && currentResults[activeSuggestion]) {
      pickResult(currentResults[activeSuggestion]);
    } else if (currentResults[0]) {
      pickResult(currentResults[0]);
    } else {
      const q = els.addressInput.value.trim();
      if (q.length >= 2) fetchSuggestions(q, true);
    }
  } else if (e.key === "Escape") {
    closeSuggestions();
  }
});

document.addEventListener("click", (e) => {
  if (!els.suggestions.contains(e.target) && e.target !== els.addressInput) closeSuggestions();
});

function highlightSuggestion(items) {
  items.forEach((el, i) => el.classList.toggle("active", i === activeSuggestion));
}

function closeSuggestions() {
  els.suggestions.classList.remove("open");
  els.suggestions.innerHTML = "";
  activeSuggestion = -1;
}

async function fetchSuggestions(q, autoSelect) {
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=en`);
    const data = await res.json();
    currentResults = (data && data.features) || [];
    if (autoSelect && currentResults[0]) { pickResult(currentResults[0]); return; }
    renderSuggestions();
  } catch {
    currentResults = [];
    renderSuggestions();
  }
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
  currentResults.forEach((r, i) => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    const [main, sub] = addressLines(r);
    div.innerHTML = `<span>${main}</span><span class="muted">${sub}</span>`;
    div.addEventListener("click", () => pickResult(r));
    els.suggestions.appendChild(div);
  });
  activeSuggestion = -1;
  els.suggestions.classList.add("open");
}

function pickResult(f) {
  closeSuggestions();
  const [main, sub] = addressLines(f);
  const label = [main, sub].filter(Boolean).join(", ");
  els.addressInput.value = label;
  const [lon, lat] = f.geometry.coordinates;
  loadLocation(lat, lon, label);
}

/* ---------- GPS ---------- */
els.gpsBtn.addEventListener("click", () => {
  if (!navigator.geolocation) { setStatus("Geolocatie wordt niet ondersteund door deze browser.", "error"); return; }
  setStatus("GPS-positie opvragen…", "loading");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
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
      loadLocation(latitude, longitude, label);
    },
    (err) => setStatus("Kon GPS-positie niet ophalen: " + err.message, "error"),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

/* ---------- Map ---------- */
const HOUSE_ZOOM = 17;

let darkLayer = null;
let satelliteLayer = null;

function initMap(lat, lon) {
  if (map) return;
  map = L.map("map", { zoomControl: false, attributionControl: false, fadeAnimation: false }).setView([lat, lon], HOUSE_ZOOM);

  darkLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd", maxZoom: 19, detectRetina: true,
  }).addTo(map);

  satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
  });

  L.control.attribution({ prefix: false, position: "bottomright" })
    .addAttribution("CARTO &middot; OpenStreetMap &middot; Open-Meteo")
    .addTo(map);

  els.mapLayerDark.addEventListener("click", () => setMapLayer("dark"));
  els.mapLayerSat.addEventListener("click", () => setMapLayer("satellite"));
}

function setMapLayer(layer) {
  const mapEl = document.getElementById("map");
  if (layer === "satellite") {
    map.removeLayer(darkLayer);
    satelliteLayer.addTo(map);
    mapEl.classList.add("satellite");
    els.mapLayerSat.classList.add("active");
    els.mapLayerDark.classList.remove("active");
  } else {
    map.removeLayer(satelliteLayer);
    darkLayer.addTo(map);
    mapEl.classList.remove("satellite");
    els.mapLayerDark.classList.add("active");
    els.mapLayerSat.classList.remove("active");
  }
}

function setMarker(lat, lon) {
  const icon = L.divIcon({ className: "house-marker", iconSize: [16, 16] });
  if (marker) marker.setLatLng([lat, lon]);
  else marker = L.marker([lat, lon], { icon }).addTo(map);
}

/* ---------- Main load ---------- */
async function loadLocation(lat, lon, label) {
  setStatus("Locatiegegevens laden…", "loading");
  els.locName.textContent = label;
  els.coordReadout.textContent = `LAT ${lat.toFixed(4)} · LON ${lon.toFixed(4)}`;

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,precipitation,is_day` +
      `&hourly=temperature_2m,precipitation_probability,weather_code,visibility,cloud_cover` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max` +
      `&timezone=auto&forecast_days=16`;
    const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,uv_index&timezone=auto`;

    const [weatherRes, aqRes] = await Promise.all([fetch(weatherUrl), fetch(aqUrl)]);
    if (!weatherRes.ok) throw new Error("Open-Meteo forecast API gaf een fout");
    const weather = await weatherRes.json();
    const aq = aqRes.ok ? await aqRes.json() : null;

    renderCurrent(weather);
    renderHourly(weather);
    renderDaily(weather);
    renderSun(weather);
    renderAirQuality(aq);
    renderSystem(weather, lat, lon);
    renderWindow(weather);

    els.dashboard.classList.remove("hidden");
    setStatus("Live verbonden — gegevens actueel", null);

    // Wait for the browser to actually lay out the now-visible dashboard
    // before Leaflet measures the map container. Without this, L.map()
    // measures a 0x0 element and places tiles for a tiny viewport,
    // leaving big gaps when the container finally gets its real size.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        initMap(lat, lon);
        map.invalidateSize();
        map.setView([lat, lon], HOUSE_ZOOM);
        setMarker(lat, lon);
      });
    });
  } catch (e) {
    setStatus("Fout bij laden van weerdata: " + e.message, "error");
  }
}

/* ---------- Renderers ---------- */
function renderCurrent(data) {
  const c = data.current;
  const [desc, icon] = describe(c.weather_code);
  els.nowIcon.textContent = icon;
  els.nowTemp.textContent = Math.round(c.temperature_2m) + "°C";
  els.nowDesc.textContent = desc;
  els.nowFeels.textContent = "Voelt als " + Math.round(c.apparent_temperature) + "°C";

  const stats = [
    ["Wind", `${Math.round(c.wind_speed_10m)} km/h ${compass(c.wind_direction_10m)}`],
    ["Windstoten", `${Math.round(c.wind_gusts_10m || 0)} km/h`],
    ["Vochtigheid", `${c.relative_humidity_2m}%`],
    ["Luchtdruk", `${Math.round(c.surface_pressure)} hPa`],
    ["Bewolking", `${c.cloud_cover}%`],
    ["Neerslag", `${c.precipitation} mm`],
  ];
  els.statGrid.innerHTML = stats.map(([label, value]) =>
    `<div class="stat"><span class="label">${label}</span><span class="value">${value}</span></div>`
  ).join("");
}

function renderHourly(data) {
  const times = data.hourly.time;
  const now = new Date();
  let startIdx = times.findIndex(t => new Date(t) >= now);
  if (startIdx === -1) startIdx = 0;

  let html = "";
  for (let i = startIdx; i < startIdx + 24 && i < times.length; i++) {
    const time = new Date(times[i]);
    const temp = Math.round(data.hourly.temperature_2m[i]);
    const precip = data.hourly.precipitation_probability[i];
    const [, icon] = describe(data.hourly.weather_code[i]);
    html += `
      <div class="hour-card">
        <div class="time">${time.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}</div>
        <div class="icon">${icon}</div>
        <div class="temp">${temp}°</div>
        <div class="precip">💧 ${precip}%</div>
      </div>`;
  }
  els.hourly.innerHTML = html;
}

function renderDaily(data) {
  const days = data.daily.time;
  let html = "";
  for (let i = 0; i < days.length; i++) {
    const date = new Date(days[i]);
    const [desc, icon] = describe(data.daily.weather_code[i]);
    const max = Math.round(data.daily.temperature_2m_max[i]);
    const min = Math.round(data.daily.temperature_2m_min[i]);
    const precip = data.daily.precipitation_probability_max[i];
    const dayName = i === 0 ? "Vandaag" : date.toLocaleDateString("nl-BE", { weekday: "long" });
    html += `
      <div class="day-row">
        <div class="day-name">${dayName}</div>
        <div class="icon">${icon}</div>
        <div class="precip">${desc} · 💧 ${precip}%</div>
        <div class="range"><span>${max}°</span> <span class="lo">${min}°</span></div>
      </div>`;
  }
  els.daily.innerHTML = html;
}

function renderSun(data) {
  const sunrise = new Date(data.daily.sunrise[0]);
  const sunset = new Date(data.daily.sunset[0]);
  const now = new Date();
  const dayLenMs = sunset - sunrise;
  const progress = Math.min(1, Math.max(0, (now - sunrise) / dayLenMs));
  const isDay = now >= sunrise && now <= sunset;

  const phase = moonPhase(now);
  const [moonName, moonIcon] = moonInfo(phase);
  const illum = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100);

  els.sunInfo.innerHTML = `
    <div class="kv"><span class="k">Status</span><span class="v ${isDay ? "good" : ""}">${isDay ? "☀️ Dag" : "🌙 Nacht"}</span></div>
    <div class="daylight-bar"><span style="width:${(progress * 100).toFixed(1)}%"></span></div>
    <div class="kv"><span class="k">Zonsopgang</span><span class="v">${sunrise.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}</span></div>
    <div class="kv"><span class="k">Zonsondergang</span><span class="v">${sunset.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}</span></div>
    <div class="kv"><span class="k">UV-index (max)</span><span class="v ${data.daily.uv_index_max[0] >= 6 ? "warn" : "good"}">${data.daily.uv_index_max[0]}</span></div>
    <div class="kv"><span class="k">Maanfase</span><span class="v">${moonIcon} ${moonName}</span></div>
    <div class="kv"><span class="k">Verlichting</span><span class="v">${illum}%</span></div>
  `;
}

function renderAirQuality(aq) {
  if (!aq || !aq.current) {
    els.aqInfo.innerHTML = `<div class="kv"><span class="k">Status</span><span class="v warn">Geen data</span></div>`;
    return;
  }
  const c = aq.current;
  const [label, cls] = aqiInfo(c.european_aqi);
  els.aqInfo.innerHTML = `
    <div class="kv"><span class="k">EAQI</span><span class="v ${cls}">${c.european_aqi ?? "—"} · ${label}</span></div>
    <div class="kv"><span class="k">PM2.5</span><span class="v">${c.pm2_5 ?? "—"} µg/m³</span></div>
    <div class="kv"><span class="k">PM10</span><span class="v">${c.pm10 ?? "—"} µg/m³</span></div>
    <div class="kv"><span class="k">Ozon (O₃)</span><span class="v">${c.ozone ?? "—"} µg/m³</span></div>
    <div class="kv"><span class="k">NO₂</span><span class="v">${c.nitrogen_dioxide ?? "—"} µg/m³</span></div>
    <div class="kv"><span class="k">UV nu</span><span class="v">${c.uv_index ?? "—"}</span></div>
  `;
}

function renderSystem(data, lat, lon) {
  const now = new Date();
  els.sysInfo.innerHTML = `
    <div class="kv"><span class="k">Latitude</span><span class="v">${lat.toFixed(4)}</span></div>
    <div class="kv"><span class="k">Longitude</span><span class="v">${lon.toFixed(4)}</span></div>
    <div class="kv"><span class="k">Hoogte</span><span class="v">${Math.round(data.elevation)} m</span></div>
    <div class="kv"><span class="k">Tijdzone</span><span class="v">${data.timezone}</span></div>
    <div class="kv"><span class="k">Laatste sync</span><span class="v">${now.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></div>
  `;
}

function renderWindow(data) {
  const c = data.current;
  const isDay = c.is_day === 1;
  const cloud = c.cloud_cover;
  const visibilityM = data.hourly.visibility[0];
  const visibilityKm = visibilityM ? (visibilityM / 1000).toFixed(1) : "?";
  const [desc] = describe(c.weather_code);
  const isRain = c.precipitation > 0 || (c.weather_code >= 51 && c.weather_code <= 99 && c.weather_code !== 71 && c.weather_code !== 73 && c.weather_code !== 75);

  let skyTop, skyBottom;
  if (!isDay) { skyTop = "#020912"; skyBottom = "#0a1f33"; }
  else if (cloud > 70) { skyTop = "#3a4a5a"; skyBottom = "#5e7282"; }
  else if (cloud > 30) { skyTop = "#2a5e8a"; skyBottom = "#6fa8c9"; }
  else { skyTop = "#0d3a6e"; skyBottom = "#3aa0d6"; }

  let scene = `<div class="sky" style="background:linear-gradient(180deg, ${skyTop}, ${skyBottom})"></div>`;
  scene += `<div class="${isDay ? "sun" : "moon"}"></div>`;

  const cloudCount = Math.round(cloud / 25);
  for (let i = 0; i < cloudCount; i++) {
    const w = 60 + Math.random() * 80;
    const h = w * 0.4;
    const top = 10 + Math.random() * 50;
    const left = (i * 28 + Math.random() * 15) % 90;
    scene += `<div class="cloud" style="width:${w}px;height:${h}px;top:${top}%;left:${left}%;"></div>`;
  }
  if (isRain) scene += `<div class="rain"></div>`;
  els.windowScene.innerHTML = scene;

  let visText;
  if (visibilityKm === "?" ) visText = "onbekend zicht";
  else if (visibilityKm > 15) visText = `helder zicht tot ver aan de horizon (${visibilityKm} km)`;
  else if (visibilityKm > 5) visText = `goed zicht tot ongeveer ${visibilityKm} km`;
  else if (visibilityKm > 1) visText = `beperkt zicht, ongeveer ${visibilityKm} km`;
  else visText = `sterk beperkt zicht (${visibilityKm} km) — mist of zware neerslag`;

  let cloudText;
  if (cloud < 15) cloudText = "een vrijwel onbewolkte hemel";
  else if (cloud < 50) cloudText = "een licht bewolkte hemel met wat blauw ertussen";
  else if (cloud < 85) cloudText = "een overwegend bewolkte hemel";
  else cloudText = "een dichte, grijze wolkendek";

  els.windowText.innerHTML = `Buiten zie je <strong>${desc.toLowerCase()}</strong>: ${cloudText}, met ${visText}.${isRain ? " Houd een paraplu bij de hand." : ""}`;
}
