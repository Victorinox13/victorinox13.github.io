// The playable mat on the Cap Clash home page: drag forward anywhere on the mat to flick the
// gold cap from your corner. Caps slow down, bounce off the rim and knock each other away.
// Gold caps on the pink team's fields score 1, 2 or 3; the BOSS field between the posts is a
// BOSS HIT. Coordinates are the SVG's viewBox units (1000 x 340).
(() => {
  const svg = document.getElementById("mat");
  if (!svg) return;

  const NS = "http://www.w3.org/2000/svg";
  const capsLayer = svg.querySelector("#caps");
  const popLayer = svg.querySelector("#pops");
  const aim = svg.querySelector("#aim");
  const scoreEl = document.getElementById("mat-score");
  const live = document.getElementById("mat-live");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const R = 14;
  const BOUNDS = { x1: 12 + R, x2: 988 - R, y1: 12 + R, y2: 328 - R };
  const FRICTION = 1.7;      // per second, proportional to speed
  const DECEL = 150;         // units/s², constant
  const STOP_SPEED = 6;
  const WALL_BOUNCE = 0.55;
  const CAP_BOUNCE = 0.9;
  const POWER = 6;           // launch speed per unit dragged
  const MAX_SPEED = 2300;
  const MIN_DRAG = 10;
  const DT = 1 / 240;
  const MAX_GOLD = 6;
  const CORNERS = [{ x: 32, y: 308 }, { x: 32, y: 32 }];
  const BOSS = { x1: 925, x2: 981, y1: 116, y2: 224 };

  const fields = [...svg.querySelectorAll("#ff-them polygon")].map((polygon) => ({
    score: Number(polygon.dataset.score),
    points: polygon.getAttribute("points").trim().split(/\s+/).map((pair) => pair.split(",").map(Number)),
  }));

  function inside(x, y, points) {
    let hit = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  }

  /** What a cap lying at (x, y) is worth for the gold team: 1-3, "boss" or 0. */
  function valueAt(x, y) {
    if (x >= BOSS.x1 && x <= BOSS.x2 && y >= BOSS.y1 && y <= BOSS.y2) return "boss";
    for (const field of fields) if (inside(x, y, field.points)) return field.score;
    return 0;
  }

  // ---------- Caps ----------

  const caps = [];

  function addCap(team, x, y) {
    const g = document.createElementNS(NS, "g");
    const body = document.createElementNS(NS, "use");
    body.setAttribute("href", `#cap-${team}`);
    body.setAttribute("x", -R);
    body.setAttribute("y", -R);
    body.setAttribute("width", R * 2);
    body.setAttribute("height", R * 2);
    g.appendChild(body);
    capsLayer.appendChild(g);
    const cap = { team, x, y, vx: 0, vy: 0, angle: Math.random() * 360, spin: 0, g, body };
    caps.push(cap);
    draw(cap);
    return cap;
  }

  function draw(cap) {
    cap.g.setAttribute("transform", `translate(${cap.x.toFixed(2)} ${cap.y.toFixed(2)}) rotate(${cap.angle.toFixed(1)})`);
  }

  function removeCap(cap) {
    caps.splice(caps.indexOf(cap), 1);
    cap.g.classList.add("leaving");
    setTimeout(() => cap.g.remove(), 450);
  }

  // ---------- Physics ----------

  function slowDown(speed, dt) {
    const next = speed - (speed * FRICTION + DECEL) * dt;
    return next < STOP_SPEED ? 0 : next;
  }

  /** How far a cap launched at `speed` slides (ignoring the rim and other caps). */
  function slideDistance(speed) {
    let distance = 0;
    while (speed > 0) {
      speed = slowDown(speed, DT);
      distance += speed * DT;
    }
    return distance;
  }

  /** The launch speed that slides a cap `distance` units. */
  function speedFor(distance) {
    let low = 0;
    let high = MAX_SPEED * 1.5;
    for (let i = 0; i < 30; i++) {
      const mid = (low + high) / 2;
      if (slideDistance(mid) < distance) low = mid; else high = mid;
    }
    return Math.min(MAX_SPEED, (low + high) / 2);
  }

  function step(dt) {
    for (const cap of caps) {
      const speed = Math.hypot(cap.vx, cap.vy);
      if (speed === 0) continue;
      const next = slowDown(speed, dt);
      cap.vx *= next / speed;
      cap.vy *= next / speed;
      cap.x += cap.vx * dt;
      cap.y += cap.vy * dt;
      cap.angle += cap.spin * dt;
      cap.spin *= Math.exp(-2.5 * dt);

      if (cap.x < BOUNDS.x1) { cap.x = BOUNDS.x1; cap.vx = Math.abs(cap.vx) * WALL_BOUNCE; }
      if (cap.x > BOUNDS.x2) { cap.x = BOUNDS.x2; cap.vx = -Math.abs(cap.vx) * WALL_BOUNCE; }
      if (cap.y < BOUNDS.y1) { cap.y = BOUNDS.y1; cap.vy = Math.abs(cap.vy) * WALL_BOUNCE; }
      if (cap.y > BOUNDS.y2) { cap.y = BOUNDS.y2; cap.vy = -Math.abs(cap.vy) * WALL_BOUNCE; }
    }

    // Caps knock each other away (equal mass).
    for (let i = 0; i < caps.length; i++) {
      for (let j = i + 1; j < caps.length; j++) {
        const a = caps[i];
        const b = caps[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance === 0 || distance >= R * 2) continue;
        const nx = dx / distance;
        const ny = dy / distance;
        const overlap = (R * 2 - distance) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (closing <= 0) continue;
        const impulse = closing * (1 + CAP_BOUNCE) / 2;
        a.vx -= impulse * nx; a.vy -= impulse * ny;
        b.vx += impulse * nx; b.vy += impulse * ny;
        b.spin += (Math.random() < 0.5 ? -1 : 1) * impulse * 0.5;
      }
    }

    return caps.some((cap) => cap.vx !== 0 || cap.vy !== 0);
  }

  let running = false;
  let lastTime = 0;
  let leftover = 0;

  function run() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    leftover = 0;
    requestAnimationFrame(frame);
  }

  function frame(now) {
    leftover += Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    let moving = true;
    while (leftover >= DT) {
      moving = step(DT);
      leftover -= DT;
    }
    caps.forEach(draw);
    if (moving) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      settle();
    }
  }

  // ---------- Turns ----------

  let ready = null;   // the gold cap waiting in a corner
  let shot = null;    // the cap that was just flicked
  let shots = 0;
  let score = 0;

  function spawnReady() {
    if (ready) return;
    const preferred = CORNERS[shots % 2];
    const free = (corner) => caps.every((cap) => Math.hypot(cap.x - corner.x, cap.y - corner.y) > R * 2.2);
    const corner = free(preferred) ? preferred : CORNERS.find(free) || preferred;
    ready = addCap("gold", corner.x, corner.y);
    if (!reduceMotion) ready.body.classList.add("appear");
  }

  function launch(vx, vy) {
    if (!ready || running) return;
    const speed = Math.hypot(vx, vy);
    const scale = speed > MAX_SPEED ? MAX_SPEED / speed : 1;
    ready.vx = vx * scale;
    ready.vy = vy * scale;
    ready.spin = (Math.random() < 0.5 ? -1 : 1) * speed * scale * 0.5;
    shot = ready;
    ready = null;
    shots += 1;
    run();
  }

  function settle() {
    if (shot) {
      const value = valueAt(shot.x, shot.y);
      if (value === "boss") {
        pop(shot.x, shot.y, "BOSS HIT!", "pop-boss");
        say("BOSS HIT!");
      } else if (value > 0) {
        pop(shot.x, shot.y, `+${value}`, "pop-score");
        say(`Your cap landed on field ${value}.`);
      } else {
        say("Your cap missed the fields.");
      }
      shot = null;
    }

    const gold = caps.filter((cap) => cap.team === "gold");
    while (gold.length > MAX_GOLD) removeCap(gold.shift());

    const total = caps
      .filter((cap) => cap.team === "gold")
      .reduce((sum, cap) => {
        const value = valueAt(cap.x, cap.y);
        return sum + (typeof value === "number" ? value : 0);
      }, 0);
    if (total !== score) {
      score = total;
      scoreEl.textContent = String(score);
      if (!reduceMotion) {
        scoreEl.classList.remove("bump");
        void scoreEl.offsetWidth;
        scoreEl.classList.add("bump");
      }
    }

    setTimeout(spawnReady, reduceMotion ? 0 : 350);
  }

  function pop(x, y, text, kind) {
    const label = document.createElementNS(NS, "text");
    label.setAttribute("x", x.toFixed(1));
    label.setAttribute("y", (y < 70 ? y + 48 : y - 24).toFixed(1));
    label.setAttribute("class", `pop ${kind}`);
    label.textContent = text;
    popLayer.appendChild(label);
    setTimeout(() => label.remove(), 1400);
  }

  function say(message) {
    if (live) live.textContent = message;
  }

  // ---------- Aiming ----------

  /** Shows the dotted line from the ready cap to where a flick at (vx, vy) would stop. */
  function showAim(vx, vy) {
    const speed = Math.min(MAX_SPEED, Math.hypot(vx, vy));
    if (!ready || speed === 0) return hideAim();
    const ux = vx / Math.hypot(vx, vy);
    const uy = vy / Math.hypot(vx, vy);
    let length = slideDistance(speed);
    // Stop the line at the rim.
    if (ux > 0) length = Math.min(length, (BOUNDS.x2 - ready.x) / ux);
    if (ux < 0) length = Math.min(length, (BOUNDS.x1 - ready.x) / ux);
    if (uy > 0) length = Math.min(length, (BOUNDS.y2 - ready.y) / uy);
    if (uy < 0) length = Math.min(length, (BOUNDS.y1 - ready.y) / uy);
    aim.setAttribute("x1", ready.x + ux * (R + 4));
    aim.setAttribute("y1", ready.y + uy * (R + 4));
    aim.setAttribute("x2", ready.x + ux * Math.max(R + 4, length));
    aim.setAttribute("y2", ready.y + uy * Math.max(R + 4, length));
    aim.setAttribute("visibility", "visible");
  }

  function hideAim() {
    aim.setAttribute("visibility", "hidden");
  }

  function toMat(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }

  let drag = null;

  svg.addEventListener("pointerdown", (event) => {
    if (!ready || running || event.button > 0) return;
    stopIntro();
    drag = { id: event.pointerId, start: toMat(event) };
    svg.setPointerCapture(event.pointerId);
    svg.classList.add("aiming");
  });

  svg.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const point = toMat(event);
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    if (Math.hypot(dx, dy) < MIN_DRAG) return hideAim();
    showAim(dx * POWER, dy * POWER);
  });

  function endDrag(event, cancelled) {
    if (!drag || event.pointerId !== drag.id) return;
    const point = toMat(event);
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    drag = null;
    svg.classList.remove("aiming");
    hideAim();
    if (!cancelled && Math.hypot(dx, dy) >= MIN_DRAG) launch(dx * POWER, dy * POWER);
  }

  svg.addEventListener("pointerup", (event) => endDrag(event, false));
  svg.addEventListener("pointercancel", (event) => endDrag(event, true));

  /** A good flick at one of the pink team's fields, with a little wobble. */
  function flickAt(target) {
    const dx = target.x - ready.x;
    const dy = target.y - ready.y;
    const distance = Math.hypot(dx, dy);
    const speed = speedFor(distance);
    return { vx: (dx / distance) * speed, vy: (dy / distance) * speed };
  }

  // Keyboard: Enter or Space flicks at a random field.
  svg.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (!ready || running) return;
    stopIntro();
    const targets = [{ x: 625, y: 170 }, { x: 752, y: 170 }, { x: 842, y: 170 }, { x: 953, y: 170 }];
    const target = targets[Math.floor(Math.random() * targets.length)];
    const { vx, vy } = flickAt({ x: target.x + (Math.random() - 0.5) * 40, y: target.y + (Math.random() - 0.5) * 60 });
    launch(vx, vy);
  });

  // ---------- Intro: the first flick plays itself once the mat is in view ----------

  let introTimer = 0;
  let introFrame = 0;
  let introDone = false;

  function stopIntro() {
    introDone = true;
    clearTimeout(introTimer);
    cancelAnimationFrame(introFrame);
    hideAim();
  }

  function playIntro() {
    if (introDone || !ready || running) return;
    introDone = true;
    const { vx, vy } = flickAt({ x: 752, y: 176 });
    const start = performance.now();
    const grow = (now) => {
      const t = Math.min(1, (now - start) / 700);
      const eased = 1 - Math.pow(1 - t, 3);
      showAim(vx * eased, vy * eased);
      if (t < 1) {
        introFrame = requestAnimationFrame(grow);
      } else {
        introTimer = setTimeout(() => { hideAim(); launch(vx, vy); }, 160);
      }
    };
    introFrame = requestAnimationFrame(grow);
  }

  // ---------- Start ----------

  addCap("pink", 968, 32);
  addCap("pink", 968, 308);
  addCap("pink", 252, 196);
  spawnReady();

  if (!reduceMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        introTimer = setTimeout(playIntro, 900);
      }
    }, { threshold: 0.7 });
    observer.observe(svg);
  }
})();
