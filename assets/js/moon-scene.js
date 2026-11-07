// Astroleck: real-time scenes rendered in the browser with three.js.
// variant "moon": the future site of Astroleck on the lunar surface (sign + base + Earth)
// variant "mars": a settlement on Mars (used for an offline render)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ noise */
function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const c000 = hash3(xi, yi, zi), c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi), c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1), c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
  return lerp(lerp(lerp(c000, c100, u), lerp(c010, c110, u), v), lerp(lerp(c001, c101, u), lerp(c011, c111, u), v), w);
}
function fbm(x, y, z, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * (vnoise3(x * f, y * f, z * f) * 2 - 1); f *= 2.03; a *= 0.5; }
  return s;
}
function pnoise(x, y, p) {
  const xi = Math.floor(x), yi = Math.floor(y), u = fade(x - xi), v = fade(y - yi);
  const m = (a) => ((a % p) + p) % p;
  const h = (a, b) => hash3(m(a), m(b), p);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
// tileable fbm over the unit square
function pfbm(x, y) {
  let s = 0, a = 0.5, p = 8;
  for (let i = 0; i < 6; i++) { s += a * (pnoise(x * p, y * p, p) * 2 - 1); p *= 2; a *= 0.5; }
  return s;
}
function ridged(x, z, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(vnoise3(x * f, 7.3, z * f) * 2 - 1); s += a * n * n; f *= 2.1; a *= 0.5; }
  return s;
}
function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ------------------------------------------------------------------ palettes */
const VARIANTS = {
  moon: {
    ground: new THREE.Color(0x8e8e8c), groundDark: new THREE.Color(0x5f5f5e),
    sunColor: 0xffffff, sunIntensity: 3.3, sunDir: new THREE.Vector3(0.78, 0.36, 0.52),
    hemiSky: 0x26304a, hemiGround: 0x353535, hemiIntensity: 0.3,
    fog: null, background: 0x020306,
    domeColor: 0xe6e4df, moduleColor: 0xdcdad5,
    window: 0xffad5c, exposure: 1.0,
  },
  mars: {
    ground: new THREE.Color(0xa65d3c), groundDark: new THREE.Color(0x6d3524),
    sunColor: 0xffe2c4, sunIntensity: 2.4, sunDir: new THREE.Vector3(0.32, 0.13, -1),
    hemiSky: 0xe0ac86, hemiGround: 0x6a3322, hemiIntensity: 1.15,
    fog: { color: 0xc8916c, density: 0.0042 }, background: null,
    domeColor: 0xc89a82, moduleColor: 0xd8cfc6,
    window: 0xffb76b, exposure: 1.0,
  },
};

/* ------------------------------------------------------------------ brand mark on canvas */
function drawMark(ctx, x, y, size, color, dot) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.scale(4, 4);
  g.fillStyle = color;
  g.fill(new Path2D('M32 4 L61 59 L3 59 Z M32 25 L45.5 59 L18.5 59 Z'), 'evenodd');
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(32, 164, 120, 0, Math.PI * 2); g.arc(32, 164, 114.5, 0, Math.PI * 2, true); g.fill('evenodd');
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = dot; g.beginPath(); g.arc(32, 38, 3.4, 0, Math.PI * 2); g.fill();
  ctx.drawImage(c, x, y, size, size);
}
function spaced(ctx, text, x, y, spacing, align = 'left') {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  w -= spacing;
  let cx = align === 'right' ? x - w : x;
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; }
  return w;
}

async function signTexture(renderer) {
  try {
    await Promise.all([
      document.fonts.load('800 100px "Archivo"'),
      document.fonts.load('600 100px "Archivo"'),
      document.fonts.load('500 40px "JetBrains Mono"'),
    ]);
  } catch (e) { /* fall back to system fonts */ }
  const W = 2048, H = 1216;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const wide = 'fontStretch' in ctx;
  const ORANGE = '#f2552c', INK = '#0b0c0e';

  // panel
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#f1f0ec'); bg.addColorStop(1, '#e2e0da');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // top band
  ctx.fillStyle = ORANGE; ctx.fillRect(0, 0, W, 168);
  ctx.fillStyle = '#ffffff';
  if (wide) ctx.fontStretch = 'expanded';
  ctx.font = '700 58px "Archivo", "Helvetica Neue", sans-serif';
  ctx.textBaseline = 'middle';
  spaced(ctx, 'FUTURE SITE OF', 110, 86, 14);
  if (wide) ctx.fontStretch = 'normal';
  ctx.font = '500 38px "JetBrains Mono", ui-monospace, monospace';
  ctx.globalAlpha = 0.9;
  spaced(ctx, 'LUNAR SURFACE', W - 110, 88, 6, 'right');
  ctx.globalAlpha = 1;

  // mark + wordmark
  drawMark(ctx, 104, 238, 210, INK, ORANGE);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  if (wide) ctx.fontStretch = 'expanded';
  let size = 230;
  const maxW = W - 104 - 210 - 60 - 110;
  for (; size > 80; size -= 4) {
    ctx.font = `800 ${size}px "Archivo", "Helvetica Neue", sans-serif`;
    let w = 0; for (const ch of 'ASTROLECK') w += ctx.measureText(ch).width + size * 0.06;
    if (w - size * 0.06 <= maxW) break;
  }
  spaced(ctx, 'ASTROLECK', 104 + 210 + 60, 418, size * 0.06);
  ctx.font = '600 64px "Archivo", "Helvetica Neue", sans-serif';
  ctx.fillStyle = '#34363b';
  spaced(ctx, 'SPACE TECHNOLOGIES', 104 + 210 + 64, 512, 22);
  if (wide) ctx.fontStretch = 'normal';

  // divider
  ctx.fillStyle = INK; ctx.fillRect(110, 600, W - 220, 5);

  // facts
  const facts = [
    ['MISSION', 'A multi-planetary humanity'],
    ['TODAY', 'Media on TikTok and YouTube'],
    ['FOUNDER', 'Victor Deleeck'],
    ['COMPLETION', 'To be announced'],
  ];
  facts.forEach(([k, v], i) => {
    const x = i % 2 ? 1080 : 110;
    const y = i < 2 ? 690 : 880;
    ctx.fillStyle = '#6b6e74';
    ctx.font = '500 36px "JetBrains Mono", ui-monospace, monospace';
    spaced(ctx, k, x, y, 5);
    ctx.fillStyle = INK;
    ctx.font = '600 66px "Archivo", "Helvetica Neue", sans-serif';
    ctx.fillText(v, x, y + 84);
  });

  // bottom band with hazard stripes
  ctx.fillStyle = INK; ctx.fillRect(0, 1064, W, H - 1064);
  ctx.fillStyle = '#ffffff';
  ctx.font = '500 40px "JetBrains Mono", ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  spaced(ctx, 'ASTROLECK.COM', 110, 1140, 6);
  ctx.save();
  ctx.beginPath(); ctx.rect(1460, 1064, W - 1460, H - 1064); ctx.clip();
  ctx.fillStyle = ORANGE;
  for (let sx = 1380; sx < W + 200; sx += 76) {
    ctx.beginPath(); ctx.moveTo(sx, H); ctx.lineTo(sx + 38, H); ctx.lineTo(sx + 38 + 152, 1064); ctx.lineTo(sx + 152, 1064); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // bolts
  ctx.fillStyle = '#9a9ca1';
  for (const [bx, by] of [[44, 220], [W - 44, 220], [44, 1010], [W - 44, 1010]]) { ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2); ctx.fill(); }

  // fine dust and wear
  const img = ctx.getImageData(0, 0, W, H);
  const r = mulberry(42);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 10;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const dust = ctx.createLinearGradient(0, H * 0.7, 0, H);
  dust.addColorStop(0, 'rgba(120,112,100,0)'); dust.addColorStop(1, 'rgba(120,112,100,0.16)');
  ctx.fillStyle = dust; ctx.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/* ------------------------------------------------------------------ textures */
function regolithTexture(renderer, tint) {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let n = pfbm(x / S, y / S) * 0.5 + 0.5;
    n += (hash3(x, y, 3) - 0.5) * 0.28;
    if (hash3(x, y, 9) > 0.996) n -= 0.35;
    const k = 0.72 + n * 0.36;
    const i = (y * S + x) * 4;
    img.data[i] = Math.min(255, 255 * k * tint[0]);
    img.data[i + 1] = Math.min(255, 255 * k * tint[1]);
    img.data[i + 2] = Math.min(255, 255 * k * tint[2]);
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function solarCellTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#16233b'; ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = 'rgba(160,190,230,0.35)'; ctx.lineWidth = 1.5;
  for (let x = 0; x <= 256; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke(); }
  for (let y = 0; y <= 128; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function earthTexture() {
  const W = 512, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const lat = Math.PI / 2 - (y / H) * Math.PI;
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * Math.PI * 2 - Math.PI;
      const px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
      const n = fbm(px * 1.7 + 3.1, py * 1.7, pz * 1.7 - 1.3, 5);
      const land = n > 0.03;
      let r, g, b;
      if (land) {
        const arid = smoothstep(0.1, 0.5, fbm(px * 3 + 9, py * 3, pz * 3, 3) + 0.35 - Math.abs(lat) * 0.4);
        r = lerp(58, 176, arid); g = lerp(98, 152, arid); b = lerp(54, 98, arid);
      } else {
        const d = smoothstep(-0.45, 0.03, n);
        r = lerp(8, 28, d); g = lerp(30, 86, d); b = lerp(78, 158, d);
      }
      if (Math.abs(lat) > 1.2) { r = g = b = 236; }
      const cl = smoothstep(0.02, 0.42, fbm(px * 3.4 - 5, py * 4.2, pz * 3.4 + 2, 5));
      r = lerp(r, 245, cl * 0.92); g = lerp(g, 248, cl * 0.92); b = lerp(b, 252, cl * 0.92);
      const i = (y * W + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowSprite(color, size) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color); g.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.35)')); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

/* ------------------------------------------------------------------ terrain */
const SIGN_POS = new THREE.Vector3(-1.5, 0, 2.6);
const BASE_POS = new THREE.Vector3(13, 0, -27);

function makeHeight(variant) {
  const rnd = mulberry(variant === 'moon' ? 7 : 21);
  const craters = [];
  for (let i = 0; i < 46; i++) {
    const r = Math.pow(rnd(), 2.2) * 26 + 1.2;
    const x = (rnd() - 0.5) * 220, z = -rnd() * 220 + 30;
    if (Math.hypot(x - SIGN_POS.x, z - SIGN_POS.z) < r * 2 + 6) continue;
    if (Math.hypot(x - BASE_POS.x, z - BASE_POS.z) < r * 2 + 26) continue;
    craters.push({ x, z, r, d: r * (0.16 + rnd() * 0.08) });
  }
  // a few small fresh craters close to the camera
  craters.push({ x: 5.5, z: 4.5, r: 1.6, d: 0.32 }, { x: -7, z: -3, r: 2.4, d: 0.45 }, { x: 3, z: -6, r: 1.1, d: 0.2 });
  return function height(x, z) {
    let h = fbm(x * 0.011, 0.5, z * 0.011, 4) * (variant === 'moon' ? 5 : 3.5);
    h += fbm(x * 0.07 + 10, 1.5, z * 0.07, 3) * 0.75;
    h += fbm(x * 0.4, 2.5, z * 0.4, 2) * 0.09;
    for (const c of craters) {
      const dx = x - c.x, dz = z - c.z;
      if (Math.abs(dx) > c.r * 2 || Math.abs(dz) > c.r * 2) continue;
      const d = Math.sqrt(dx * dx + dz * dz) / c.r;
      if (d < 1) h -= (1 - d * d) * c.d;
      h += Math.exp(-Math.pow((d - 1) / 0.28, 2)) * c.d * 0.42;
    }
    const ds = Math.hypot(x - SIGN_POS.x, z - SIGN_POS.z);
    const db = Math.hypot(x - BASE_POS.x, z - BASE_POS.z);
    h *= smoothstep(3, 12, ds) * 0.85 + 0.15;
    h *= smoothstep(16, 40, db) * 0.9 + 0.1;
    const far = smoothstep(110, 340, Math.hypot(x - 10, z + 60));
    if (variant === 'moon') h += far * (ridged(x * 0.006, z * 0.006, 4) * 85 + 6);
    else {
      let m = ridged(x * 0.005 + 3, z * 0.005, 3) * 70;
      m = Math.floor(m / 9) * 9 + smoothstep(0, 1, (m % 9) / 9) * 9; // terraced mesas
      h += far * (m + 4);
    }
    return h;
  };
}

function buildTerrain(variant, P, renderer) {
  const SEG = 340, R = 720, CX = 6, CZ = -14;
  const geo = new THREE.PlaneGeometry(2, 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const height = makeHeight(variant);
  const colors = new Float32Array(pos.count * 3);
  const uvs = new Float32Array(pos.count * 2);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i), v = pos.getZ(i);
    const x = CX + Math.sign(u) * Math.pow(Math.abs(u), 2.3) * R;
    const z = CZ + Math.sign(v) * Math.pow(Math.abs(v), 2.3) * R;
    const y = height(x, z);
    pos.setXYZ(i, x, y, z);
    uvs[i * 2] = x / 3.2; uvs[i * 2 + 1] = z / 3.2;
    const m = fbm(x * 0.02 + 40, 3.3, z * 0.02, 3) * 0.5 + 0.5;
    tmp.copy(P.groundDark).lerp(P.ground, smoothstep(0.25, 0.7, m));
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  const tint = variant === 'moon' ? [1, 1, 1] : [1, 0.86, 0.78];
  const tex = regolithTexture(renderer, tint);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, bumpMap: tex, bumpScale: 0.7, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return { mesh, height };
}

function scatterRocks(height, P, count, seed, area) {
  const rnd = mulberry(seed);
  let base = new THREE.IcosahedronGeometry(1, 2);
  base.deleteAttribute('normal'); base.deleteAttribute('uv');
  base = mergeVertices(base);
  const p = base.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + fbm(x * 1.7, y * 1.7, z * 1.7, 2) * 0.55;
    p.setXYZ(i, x * k, y * k * 0.7, z * k);
  }
  base.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: P.ground.clone().multiplyScalar(0.82), roughness: 1, map: null });
  const mesh = new THREE.InstancedMesh(base, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3(), e = new THREE.Euler();
  let n = 0;
  for (let i = 0; i < count * 3 && n < count; i++) {
    const x = area.x0 + rnd() * (area.x1 - area.x0), z = area.z0 + rnd() * (area.z1 - area.z0);
    if (Math.hypot(x - SIGN_POS.x, z - SIGN_POS.z) < 2.2) continue;
    if (Math.hypot(x - BASE_POS.x, z - BASE_POS.z) < 14) continue;
    const sc = 0.04 + Math.pow(rnd(), 3.2) * 0.75;
    t.set(x, height(x, z) - sc * 0.25, z);
    e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
    s.set(sc * (0.8 + rnd() * 0.5), sc, sc * (0.8 + rnd() * 0.5));
    m.compose(t, q, s);
    mesh.setMatrixAt(n++, m);
  }
  mesh.count = n;
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

/* ------------------------------------------------------------------ props */
function geodesicDome(radius, mat, seamColor, windowMat, facing) {
  const src = new THREE.IcosahedronGeometry(radius, 3);
  const a = src.attributes.position.array;
  const keep = [], win = [];
  const n = new THREE.Vector3(), ctr = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i < a.length; i += 9) {
    const cy = (a[i + 1] + a[i + 4] + a[i + 7]) / 3;
    if (cy < -0.04 * radius) continue;
    const tri = a.slice(i, i + 9);
    ctr.set((a[i] + a[i + 3] + a[i + 6]) / 3, cy, (a[i + 2] + a[i + 5] + a[i + 8]) / 3);
    n.copy(ctr).normalize();
    const band = cy > 0.07 * radius && cy < 0.2 * radius;
    if (windowMat && band && n.dot(facing) > 0.25 && (k++ % 3 === 0)) win.push(...tri);
    else keep.push(...tri);
  }
  const group = new THREE.Group();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
  g.computeVertexNormals();
  const shell = new THREE.Mesh(g, mat);
  shell.castShadow = true; shell.receiveShadow = true;
  group.add(shell);
  if (win.length) {
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(win, 3));
    wg.computeVertexNormals();
    group.add(new THREE.Mesh(wg, windowMat));
  }
  const all = new THREE.BufferGeometry();
  all.setAttribute('position', new THREE.Float32BufferAttribute(keep.concat(win), 3));
  const seams = new THREE.LineSegments(new THREE.EdgesGeometry(all, 1), new THREE.LineBasicMaterial({ color: seamColor, transparent: true, opacity: 0.45 }));
  seams.scale.setScalar(1.002);
  group.add(seams);
  return group;
}

function astronaut(pose = 'stand') {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0xeceae5, roughness: 0.7 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x8f949b, roughness: 0.6, metalness: 0.2 });
  const visor = new THREE.MeshStandardMaterial({ color: 0xd8a24a, roughness: 0.12, metalness: 1, emissive: 0x3a2400, emissiveIntensity: 0.4 });
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; g.add(m); return m; };
  const leg = new THREE.CapsuleGeometry(0.14, 0.58, 4, 12);
  const swing = pose === 'walk' ? 0.32 : 0;
  add(leg, suit, -0.13, 0.46, 0, swing, 0); add(leg, suit, 0.13, 0.46, 0, -swing, 0);
  add(new THREE.BoxGeometry(0.17, 0.12, 0.3), grey, -0.13, 0.06, 0.04 + swing * 0.3);
  add(new THREE.BoxGeometry(0.17, 0.12, 0.3), grey, 0.13, 0.06, 0.04 - swing * 0.3);
  add(new THREE.CapsuleGeometry(0.3, 0.4, 6, 16), suit, 0, 1.12, 0);
  add(new THREE.BoxGeometry(0.56, 0.66, 0.3), suit, 0, 1.2, -0.3);
  add(new THREE.BoxGeometry(0.22, 0.14, 0.06), grey, 0, 1.18, 0.24);
  const arm = new THREE.CapsuleGeometry(0.115, 0.5, 4, 12);
  if (pose === 'point') {
    add(arm, suit, 0.46, 1.6, 0.16, -0.6, -2.5);
  } else add(arm, suit, 0.4, 1.06, 0, -swing, 0.14);
  add(arm, suit, -0.4, 1.06, 0, swing, -0.14);
  add(new THREE.SphereGeometry(0.25, 24, 18), suit, 0, 1.66, 0.02);
  const v = add(new THREE.SphereGeometry(0.205, 24, 16, -Math.PI * 0.45, Math.PI * 0.9, Math.PI * 0.28, Math.PI * 0.42), visor, 0, 1.67, 0.08);
  v.rotation.y = 0;
  return g;
}

function buildSign(tex) {
  const g = new THREE.Group();
  const W = 3.2, H = 1.9, BOTTOM = 1.05;
  const metal = new THREE.MeshStandardMaterial({ color: 0x7a7e84, roughness: 0.42, metalness: 0.75 });
  const back = new THREE.MeshStandardMaterial({ color: 0xb9bbbf, roughness: 0.5, metalness: 0.6 });
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0.0 });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.05), [back, back, back, back, face, back]);
  panel.position.set(0, BOTTOM + H / 2, 0);
  panel.castShadow = true; panel.receiveShadow = true;
  g.add(panel);
  for (const x of [-1.12, 1.12]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, BOTTOM + H + 0.55, 0.12), metal);
    post.position.set(x, (BOTTOM + H + 0.55) / 2 - 0.5, -0.09);
    post.castShadow = true;
    g.add(post);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6c6c6a, roughness: 1 }));
    mound.scale.set(0.8, 0.16, 0.8);
    mound.position.set(x, -0.02, -0.09);
    mound.receiveShadow = true;
    g.add(mound);
  }
  for (const y of [BOTTOM + 0.35, BOTTOM + H - 0.35]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.07, 0.06), metal);
    rail.position.set(0, y, -0.06);
    rail.castShadow = true;
    g.add(rail);
  }
  return g;
}

function buildBase(P, variant) {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: P.domeColor, roughness: 0.55, metalness: 0.08, flatShading: true });
  const moduleMat = new THREE.MeshStandardMaterial({ color: P.moduleColor, roughness: 0.5, metalness: 0.12 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x34373c, roughness: 0.45, metalness: 0.7 });
  const winMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: P.window, emissiveIntensity: 1.7 });
  const foil = new THREE.MeshStandardMaterial({ color: 0xc7943d, roughness: 0.32, metalness: 0.95 });
  const facing = new THREE.Vector3(-0.35, 0, 1).normalize();

  const dome = geodesicDome(7.2, shellMat, 0x2a2c30, winMat, facing);
  dome.position.set(0, -0.45, 0);
  g.add(dome);
  if (variant === 'mars') {
    const gh = new THREE.MeshStandardMaterial({ color: 0x2c3a30, emissive: 0xb8f0c8, emissiveIntensity: 0.22, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.88 });
    const green = geodesicDome(4.4, gh, 0xd8f5e4, null, facing);
    green.position.set(-13, -0.3, 3);
    g.add(green);
  } else {
    const small = geodesicDome(4.2, shellMat, 0x2a2c30, winMat, facing);
    small.position.set(13.5, -0.3, 4.5);
    g.add(small);
  }

  // pressurised tunnel between the domes
  const tunnel = new THREE.Mesh(new THREE.CapsuleGeometry(1.25, 6.5, 8, 28), moduleMat);
  tunnel.rotation.z = Math.PI / 2;
  tunnel.rotation.y = -0.32;
  tunnel.position.set(variant === 'mars' ? -8.2 : 8.4, 1.05, variant === 'mars' ? 1.8 : 2.6);
  tunnel.castShadow = true; tunnel.receiveShadow = true;
  g.add(tunnel);
  for (let i = -2; i <= 2; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.06, 8, 36), darkMat);
    ring.position.copy(tunnel.position);
    ring.rotation.y = -0.32 + Math.PI / 2;
    ring.position.x += Math.cos(-0.32) * i * 1.4;
    ring.position.z -= Math.sin(-0.32) * i * 1.4;
    g.add(ring);
  }
  for (let i = -1; i <= 1; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.05), winMat);
    w.position.copy(tunnel.position);
    w.position.x += Math.cos(-0.32) * i * 1.9;
    w.position.z -= Math.sin(-0.32) * i * 1.9;
    w.position.y += 0.2;
    w.rotation.y = -0.32;
    w.translateZ(1.24);
    g.add(w);
  }

  // airlock on the main dome
  const lock = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 2.8, 28, 1, false), moduleMat);
  lock.rotation.x = Math.PI / 2;
  lock.position.set(-1.6, 1.2, 6.6);
  lock.rotation.z = 0.22;
  lock.castShadow = true;
  g.add(lock);
  const hatch = new THREE.Mesh(new THREE.CircleGeometry(0.7, 28), winMat);
  hatch.position.set(-1.9, 1.2, 8.02);
  hatch.rotation.y = -0.22;
  g.add(hatch);

  // solar arrays
  const cell = new THREE.MeshStandardMaterial({ color: 0xffffff, map: solarCellTexture(), roughness: 0.28, metalness: 0.55 });
  for (let i = 0; i < 4; i++) {
    const a = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.2, 10), darkMat);
    mast.position.y = 1.6;
    a.add(mast);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.06, 2.2), [darkMat, darkMat, cell, darkMat, darkMat, darkMat]);
    panel.position.y = 3.25;
    panel.rotation.x = 0.82;
    panel.castShadow = true;
    a.add(panel);
    a.rotation.y = variant === 'mars' ? -0.6 : 0.55;
    a.position.set(-15 - i * 5.2, 0, -6 - i * 1.6);
    a.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.add(a);
  }

  // communications tower aimed at Earth
  const tower = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 10, 10), darkMat);
  mast.position.y = 5;
  tower.add(mast);
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.4, 6), darkMat);
    const ang = (i / 3) * Math.PI * 2;
    leg.position.set(Math.cos(ang) * 0.9, 2, Math.sin(ang) * 0.9);
    leg.lookAt(0, 4.2, 0); leg.rotateX(Math.PI / 2);
    tower.add(leg);
  }
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 12, 0, Math.PI * 2, 0, 0.75), new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide }));
  dish.position.y = 10.2;
  dish.rotation.set(-0.9, 0.0, -0.6);
  tower.add(dish);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff5a2a, emissiveIntensity: 6 }));
  beacon.position.y = 10.25 - 0.9;
  beacon.position.x = 0.22;
  tower.add(beacon);
  tower.position.set(variant === 'mars' ? 15 : 22, 0, -6);
  tower.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.add(tower);

  // cargo lander with gold foil
  const lander = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 2.4, 8), foil);
  body.position.y = 2.6;
  lander.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 0.9, 8), moduleMat);
  top.position.y = 4.25;
  lander.add(top);
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const legm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3, 6), darkMat);
    legm.position.set(Math.cos(ang) * 1.9, 1.2, Math.sin(ang) * 1.9);
    legm.rotation.z = Math.cos(ang) * 0.5; legm.rotation.x = -Math.sin(ang) * 0.5;
    lander.add(legm);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.08, 12), darkMat);
    foot.position.set(Math.cos(ang) * 2.6, 0.04, Math.sin(ang) * 2.6);
    lander.add(foot);
  }
  lander.position.set(variant === 'mars' ? 26 : -29, 0, variant === 'mars' ? -12 : -18);
  lander.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(lander);

  // regolith berm around the domes
  const berm = new THREE.Mesh(new THREE.TorusGeometry(7.4, 0.9, 10, 48), new THREE.MeshStandardMaterial({ color: P.ground.clone().multiplyScalar(0.9), roughness: 1 }));
  berm.rotation.x = Math.PI / 2;
  berm.scale.z = 0.45;
  berm.position.y = -0.2;
  berm.receiveShadow = true;
  g.add(berm);

  // crew
  const a1 = astronaut('point');
  a1.position.set(-4.6, 0, 10.4); a1.rotation.y = 0.65;
  const a2 = astronaut('stand');
  a2.position.set(-3.4, 0, 10.9); a2.rotation.y = -0.4;
  const a3 = astronaut('walk');
  a3.position.set(5.5, 0, 9.5); a3.rotation.y = -1.2;
  g.add(a1, a2, a3);

  // warm spill light from the windows
  const spill = new THREE.PointLight(P.window, 8, 18, 2);
  spill.position.set(-1.5, 2.2, 9);
  g.add(spill);

  return { group: g, beacon, crew: [a1, a2, a3] };
}

function buildRover() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: 0.45, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.08, metalness: 0.9 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 3.4, 6, 20), white);
  body.rotation.z = Math.PI / 2; body.position.y = 1.65; body.scale.set(1, 1, 1.15);
  g.add(body);
  const cab = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 16, 0, Math.PI, 0, Math.PI), glass);
  cab.rotation.y = Math.PI / 2; cab.position.set(2.2, 1.75, 0); cab.scale.set(0.9, 0.85, 1.05);
  g.add(cab);
  for (const x of [-1.6, 0, 1.6]) for (const z of [-1.25, 1.25]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.42, 20), dark);
    w.rotation.x = Math.PI / 2; w.position.set(x, 0.55, z);
    g.add(w);
  }
  const lamp = new THREE.SpotLight(0xfff1d8, 40, 40, 0.42, 0.6, 1.5);
  lamp.position.set(3.0, 1.6, 0);
  lamp.target.position.set(14, 0, 0);
  g.add(lamp, lamp.target);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* ------------------------------------------------------------------ sky */
function stars(count, seed) {
  const rnd = mulberry(seed);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const th = rnd() * Math.PI * 2, y = rnd() * 0.95 + 0.02;
    const r = Math.sqrt(1 - y * y) * 900;
    pos.set([Math.cos(th) * r, y * 900, Math.sin(th) * r], i * 3);
    const b = Math.pow(rnd(), 3) * 0.8 + 0.15, tint = rnd();
    col.set([b * (tint > 0.85 ? 0.8 : 1), b, b * (tint < 0.15 ? 0.8 : 1)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false }));
}

function buildEarth() {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: earthTexture() }, lightDir: { value: new THREE.Vector3(1, 0.25, 0.15).normalize() } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 lightDir; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
        float l = dot(n, normalize(lightDir));
        float day = smoothstep(-0.06, 0.3, l);
        vec3 c = texture2D(map, vUv).rgb * day * 2.4;
        float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);
        c += vec3(0.32, 0.58, 1.0) * fres * smoothstep(-0.25, 0.5, l) * 2.2;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(11, 64, 48), mat);
  earth.rotation.set(0.35, 2.2, 0.15);
  g.add(earth);
  const halo = glowSprite('rgba(110,170,255,0.55)', 44);
  halo.position.set(4, 0, -6);
  g.add(halo);
  return g;
}

function skyDome(top, mid, bottom) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = mix(mid, top, smoothstep(0.02, 0.55, h)); c = mix(bottom, c, smoothstep(-0.05, 0.06, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
}

/* ------------------------------------------------------------------ camera presets */
const SHOTS = {
  moon: {
    wide:   { pos: [0.6, 1.7, 10.8], look: [-0.4, 2.2, -30], fov: 36 },
    tall:   { pos: [-2.2, 2.6, 13.2], look: [0.2, 0.4, -17], fov: 62 },
  },
  mars: {
    wide:   { pos: [3, 1.9, 7], look: [12, 3.8, -28], fov: 40 },
    tall:   { pos: [-5, 2.2, 6], look: [12, 3.6, -28], fov: 58 },
  },
  base: {
    wide:   { pos: [-6, 2.0, -6], look: [12, 2.6, -26], fov: 38 },
    tall:   { pos: [-6, 2.4, -4], look: [12, 2.6, -26], fov: 56 },
  },
};

/* ------------------------------------------------------------------ main */
export async function createScene(canvas, opts = {}) {
  const variant = opts.variant || 'moon';
  const shotName = opts.shot || variant;
  const P = VARIANTS[variant];
  const interactive = opts.interactive !== false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture });
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
  renderer.setPixelRatio(opts.pixelRatio || Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = P.exposure;

  const scene = new THREE.Scene();
  if (P.background !== null) scene.background = new THREE.Color(P.background);
  if (P.fog) scene.fog = new THREE.FogExp2(P.fog.color, P.fog.density);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 3000);

  // light
  const sun = new THREE.DirectionalLight(P.sunColor, P.sunIntensity);
  const target = new THREE.Object3D();
  target.position.set(6, 0, -10);
  scene.add(target);
  sun.target = target;
  sun.position.copy(target.position).addScaledVector(P.sunDir.clone().normalize(), 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 2048 : 4096, mobile ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 220 });
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(P.hemiSky, P.hemiGround, P.hemiIntensity));

  // world
  const { mesh: ground, height } = buildTerrain(variant, P, renderer);
  scene.add(ground);
  scene.add(scatterRocks(height, P, mobile ? 260 : 420, variant === 'moon' ? 3 : 9, { x0: -40, x1: 45, z0: -60, z1: 14 }));

  const base = buildBase(P, variant);
  base.group.position.set(BASE_POS.x, height(BASE_POS.x, BASE_POS.z), BASE_POS.z);
  base.group.rotation.y = variant === 'mars' ? 0.3 : 0;
  scene.add(base.group);
  base.crew.forEach((c) => {
    const wp = c.getWorldPosition(new THREE.Vector3());
    c.position.y = height(wp.x, wp.z) - base.group.position.y;
  });

  if (variant === 'moon') {
    scene.add(stars(2600, 5));
    const earth = buildEarth();
    earth.position.set(112, 66, -330);
    scene.add(earth);
    if (opts.sign !== false) {
      const sign = buildSign(await signTexture(renderer));
      sign.position.set(SIGN_POS.x, height(SIGN_POS.x, SIGN_POS.z), SIGN_POS.z);
      sign.rotation.y = 0.2;
      scene.add(sign);
    }
  } else {
    scene.add(skyDome(0x3a2a3a, 0xc98a62, 0xd9a37a));
    const halo = glowSprite('rgba(170,205,255,0.55)', 520);
    halo.position.copy(P.sunDir).normalize().multiplyScalar(1200);
    halo.material.fog = false;
    scene.add(halo);
    const sunDisc = glowSprite('rgba(240,248,255,1)', 46);
    sunDisc.position.copy(halo.position);
    sunDisc.material.fog = false;
    scene.add(sunDisc);
  }

  // post-processing: bloom for lights, then grain and vignette
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.45, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grain = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amount: { value: 0.045 }, vignette: { value: 0.32 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float amount; uniform float vignette; varying vec2 vUv;
      float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv);
        float d = distance(vUv, vec2(0.5)); c.rgb *= 1.0 - vignette * smoothstep(0.35, 0.85, d);
        c.rgb += (rand(vUv * 1024.0 + time) - 0.5) * amount;
        gl_FragColor = c; }`,
  });
  composer.addPass(grain);

  // framing
  const pointer = { x: 0, y: 0, cx: 0, cy: 0 };
  let shot, w = 1, h = 1;
  function resize(width, height) {
    w = width; h = height;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    const s = SHOTS[shotName];
    shot = { ...((w / h) < 0.9 ? s.tall : s.wide) };
    camera.fov = shot.fov;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const look = new THREE.Vector3();
  function place(t) {
    const drift = interactive ? Math.sin(t * 0.00012) * 0.18 : 0;
    camera.position.set(shot.pos[0] + pointer.cx * 0.45 + drift, shot.pos[1] + pointer.cy * 0.18, shot.pos[2]);
    look.set(shot.look[0], shot.look[1], shot.look[2]);
    camera.lookAt(look);
  }
  let t0 = null;
  function render(now = 0) {
    if (t0 === null) t0 = now;
    const t = now - t0; // start every session at the exact poster framing
    pointer.cx += (pointer.x - pointer.cx) * 0.04;
    pointer.cy += (pointer.y - pointer.cy) * 0.04;
    place(t);
    base.beacon.material.emissiveIntensity = (Math.floor(t / 1200) % 2 === 0) ? 6 : 0.4;
    grain.uniforms.time.value = (t % 10000) / 1000;
    composer.render();
  }

  // loop: only while visible, and only when motion is welcome
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, visible = true, running = false;
  function loop(t) { render(t); raf = requestAnimationFrame(loop); }
  function start() { if (!running && visible && !document.hidden && interactive && !calm) { running = true; raf = requestAnimationFrame(loop); } }
  function stop() { running = false; cancelAnimationFrame(raf); }
  if (interactive) {
    window.addEventListener('pointermove', (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(canvas);
    }
  }

  resize(opts.width || canvas.clientWidth || 1, opts.height || canvas.clientHeight || 1);
  render(0);

  return {
    renderer, scene, camera,
    resize(width, height) { resize(width, height); if (!running) render(performance.now()); },
    render,
    start, stop,
    setShot(next) { Object.assign(shot, next); camera.fov = shot.fov; camera.updateProjectionMatrix(); render(performance.now()); },
    dispose() { stop(); renderer.dispose(); },
  };
}
