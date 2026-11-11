/* Interactive dollhouse of the illustrative 40' × 28' sample plan.
   Lazy-loads three.js when #tour scrolls into view. */
const THREE_VERSION = '0.170.0';
let THREE;

const VIEWS = {
  home:    { pos: [28, 38, 46], target: [20, 0.4, 12] },
  kitchen: { pos: [16, 20, 22], target: [7, 1.0, 6.5] },
  dining:  { pos: [30, 20, 22], target: [24, 1.0, 6.5] },
  living:  { pos: [18, 22, 42], target: [9, 0.8, 21] },
  study:   { pos: [28, 22, 42], target: [34, 0.8, 21] },
  plan:    { pos: [20, 54, 14.2], target: [20, 0, 14] }
};

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch (e) {
    return false;
  }
}

function supportsImportMap() {
  return !!(HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('importmap'));
}

function showFallback(stage, fallback, loading) {
  if (loading) loading.hidden = true;
  if (fallback) fallback.hidden = false;
  if (stage) stage.classList.add('is-failed');
}

function pauseLenis() {
  const l = window.__zcLenis;
  if (l && typeof l.stop === 'function') l.stop();
}
function resumeLenis() {
  const l = window.__zcLenis;
  if (l && typeof l.start === 'function') l.start();
}

function makeCanvasTexture(draw, size, repeatX, repeatZ, linear) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX || 1, repeatZ || 1);
  tex.colorSpace = linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function woodColor(ctx, s) {
  const planks = 16;
  ctx.fillStyle = '#c9a56e';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < planks; i++) {
    const y = (i / planks) * s;
    const tone = i % 3 === 0 ? '#b89058' : i % 3 === 1 ? '#d0ab74' : '#c4a066';
    ctx.fillStyle = tone;
    ctx.fillRect(0, y, s, s / planks + 1);
    ctx.strokeStyle = 'rgba(70,42,18,' + (0.16 + (i % 4) * 0.04) + ')';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, y + s / planks - 1);
    ctx.lineTo(s, y + s / planks - 1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90,55,25,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 3);
    for (let x = 0; x < s; x += 6) ctx.lineTo(x, y + 3 + Math.sin(x * 0.05 + i * 1.7) * 1.6);
    ctx.stroke();
  }
}

function woodRough(ctx, s) {
  const planks = 16;
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < planks; i++) {
    const y = (i / planks) * s;
    ctx.fillStyle = i % 2 ? '#7a7a7a' : '#969696';
    ctx.fillRect(0, y, s, s / planks + 1);
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + s / planks - 1);
    ctx.lineTo(s, y + s / planks - 1);
    ctx.stroke();
  }
}

function plasterColor(ctx, s) {
  ctx.fillStyle = '#f3ead8';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 1400; i++) {
    const n = 210 + ((i * 47) % 30);
    ctx.fillStyle = 'rgba(' + n + ',' + (n - 8) + ',' + (n - 22) + ',0.18)';
    ctx.fillRect((i * 13) % s, (i * 29) % s, 2, 2);
  }
}

function plasterBump(ctx, s) {
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 1800; i++) {
    const g = 110 + ((i * 17) % 40);
    ctx.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')';
    ctx.fillRect((i * 19) % s, (i * 31) % s, 2, 2);
  }
}

function marbleColor(ctx, s) {
  ctx.fillStyle = '#f6f3ec';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(150,148,145,0.28)';
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo((i * 40) % s, 0);
    ctx.bezierCurveTo(s * 0.3, s * (0.2 + i * 0.08), s * 0.7, s * (0.4 + i * 0.05), s, s * (0.15 + i * 0.1));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120,118,116,0.16)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i * 50) % s);
    ctx.bezierCurveTo(s * 0.4, (i * 70) % s, s * 0.65, (i * 90) % s, s, (i * 40) % s);
    ctx.stroke();
  }
}

function rugColor(ctx, s) {
  ctx.fillStyle = '#c9b59a';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = '#6b1d2a';
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, s - 24, s - 24);
  ctx.strokeStyle = '#1e3d32';
  ctx.lineWidth = 3;
  ctx.strokeRect(22, 22, s - 44, s - 44);
  ctx.fillStyle = 'rgba(107,29,42,0.12)';
  for (let y = 40; y < s - 40; y += 28) {
    for (let x = 40; x < s - 40; x += 28) {
      ctx.beginPath();
      ctx.arc(x + 6, y + 6, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function bookColor(ctx, s) {
  ctx.fillStyle = '#3a2418';
  ctx.fillRect(0, 0, s, s);
  const colors = ['#3b1f16', '#5c2a24', '#2a3328', '#4a3a22', '#1e2a22', '#6b1d2a', '#3d2c18', '#2c2418'];
  for (let x = 0, i = 0; x < s; i++) {
    const w = 7 + (i * 13) % 5;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x, 0, w - 1, s);
    if (i % 3 === 0) {
      ctx.fillStyle = 'rgba(212,175,110,0.55)';
      ctx.fillRect(x + 1, 6, w - 3, 2);
    }
    x += w;
  }
}

function labelTexture(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(107,29,42,0.72)';
  ctx.font = '600 28px Cinzel, Times New Roman, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '6px';
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildScene(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8dcc8);
  scene.fog = new THREE.Fog(0xe8dcc8, 50, 110);

  const woodMap = makeCanvasTexture(woodColor, 512, 10, 7);
  const woodR = makeCanvasTexture(woodRough, 512, 10, 7, true);
  const plaster = makeCanvasTexture(plasterColor, 256, 4, 2);
  const plasterB = makeCanvasTexture(plasterBump, 256, 4, 2, true);
  const marbleMap = makeCanvasTexture(marbleColor, 512, 2, 1);

  const mats = {};
  mats.wall = new THREE.MeshStandardMaterial({
    color: 0xf4ebda, map: plaster, bumpMap: plasterB, bumpScale: 0.025,
    roughness: 0.9, metalness: 0
  });
  mats.floor = new THREE.MeshPhysicalMaterial({
    map: woodMap, roughnessMap: woodR, roughness: 0.42, metalness: 0.02,
    color: 0xe8d0a8, clearcoat: 0.18, clearcoatRoughness: 0.45
  });
  mats.ground = new THREE.MeshStandardMaterial({ color: 0xc5b89a, roughness: 1, metalness: 0 });
  mats.cream = new THREE.MeshStandardMaterial({ color: 0xefe6d4, roughness: 0.55, metalness: 0.02 });
  mats.creamDark = new THREE.MeshStandardMaterial({ color: 0xe0d4be, roughness: 0.6, metalness: 0 });
  mats.base = new THREE.MeshStandardMaterial({ color: 0xeae0ce, roughness: 0.7, metalness: 0 });
  mats.marble = new THREE.MeshPhysicalMaterial({
    map: marbleMap, color: 0xffffff, roughness: 0.18, metalness: 0,
    clearcoat: 0.7, clearcoatRoughness: 0.2
  });
  mats.walnut = new THREE.MeshPhysicalMaterial({
    color: 0x5c3d2a, roughness: 0.42, metalness: 0.04, clearcoat: 0.2, clearcoatRoughness: 0.5
  });
  mats.walnutDark = new THREE.MeshStandardMaterial({ color: 0x3f2a1c, roughness: 0.5, metalness: 0.04 });
  mats.linen = new THREE.MeshStandardMaterial({ color: 0xe9e1d2, roughness: 0.92, metalness: 0 });
  mats.linenSoft = new THREE.MeshStandardMaterial({ color: 0xf0e8da, roughness: 0.95, metalness: 0 });
  mats.metal = new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.32, metalness: 0.78 });
  mats.steel = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.28, metalness: 0.72 });
  mats.black = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.45, metalness: 0.2 });
  mats.sink = new THREE.MeshStandardMaterial({ color: 0xd5d8dc, roughness: 0.22, metalness: 0.58 });
  mats.glass = new THREE.MeshStandardMaterial({
    color: 0xb8cde0, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.42
  });
  mats.glow = new THREE.MeshBasicMaterial({ color: 0xfff6e4 });
  mats.shade = new THREE.MeshStandardMaterial({
    color: 0xf7ecd4, roughness: 0.9, metalness: 0, emissive: 0x3a2a18, emissiveIntensity: 0.2,
    side: THREE.DoubleSide
  });
  mats.bulb = new THREE.MeshBasicMaterial({ color: 0xfff4d8 });
  mats.rug = new THREE.MeshStandardMaterial({ map: makeCanvasTexture(rugColor, 256, 1, 1), roughness: 0.95, metalness: 0 });
  mats.books = new THREE.MeshStandardMaterial({ map: makeCanvasTexture(bookColor, 256, 3, 1), roughness: 0.7, metalness: 0 });
  mats.green = new THREE.MeshStandardMaterial({ color: 0x1e3d32, roughness: 0.7, metalness: 0 });
  mats.burgundy = new THREE.MeshStandardMaterial({ color: 0x6b1d2a, roughness: 0.75, metalness: 0 });
  mats.stoop = new THREE.MeshStandardMaterial({ color: 0x9a8c78, roughness: 0.85, metalness: 0 });

  const T = 0.35;
  const H = 8.0;
  const CUT = 1.15;
  const house = new THREE.Group();
  house.name = 'house';
  scene.add(house);

  function addBox(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    (parent || house).add(m);
    return m;
  }

  const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 48), mats.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.32;
  ground.receiveShadow = true;
  scene.add(ground);

  addBox(40.4, 0.28, 28.4, mats.floor, 20, -0.14, 14);

  function floorLabel(text, x, z, w) {
    const mat = new THREE.MeshBasicMaterial({
      map: labelTexture(text),
      transparent: true,
      depthWrite: false
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.25), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.03, z);
    house.add(m);
  }
  floorLabel('KITCHEN', 7, 9.6, 4.2);
  floorLabel('DINING', 24, 10.4, 4.6);
  floorLabel('LIVING', 9, 18.4, 4.6);
  floorLabel('ENTRY', 23, 18.8, 3.6);
  floorLabel('STUDY', 34, 18.8, 3.8);

  const fadeGroups = {};
  function tagExterior(mesh, id) {
    if (!mesh || !id) return mesh;
    let g = fadeGroups[id];
    if (!g) {
      const inward = { north: [0, 0, 1], south: [0, 0, -1], west: [1, 0, 0], east: [-1, 0, 0] }[id];
      const point = { north: [20, 1, 0], south: [20, 1, 28], west: [0, 1, 14], east: [40, 1, 14] }[id];
      g = fadeGroups[id] = { inward: inward, point: point, meshes: [] };
    }
    const src = mesh.material;
    if (src && !(src.userData && src.userData._fadeMat)) {
      const n = src.clone();
      n.transparent = true;
      n.userData = n.userData || {};
      n.userData._fadeMat = true;
      mesh.material = n;
    }
    g.meshes.push(mesh);
    return mesh;
  }
  function exteriorIdX(z) {
    if (Math.abs(z - 0) < 0.4) return 'north';
    if (Math.abs(z - 28) < 0.4) return 'south';
    return null;
  }
  function exteriorIdZ(x) {
    if (Math.abs(x - 0) < 0.4) return 'west';
    if (Math.abs(x - 40) < 0.4) return 'east';
    return null;
  }
  function updateCutaways(cam) {
    if (!cam) return;
    Object.keys(fadeGroups).forEach(function (id) {
      const g = fadeGroups[id];
      const side = (cam.position.x - g.point[0]) * g.inward[0] + (cam.position.z - g.point[2]) * g.inward[2];
      const hide = side < -0.8;
      g.meshes.forEach(function (mesh) {
        mesh.visible = !hide;
        if (mesh.castShadow !== undefined) mesh.castShadow = !hide;
      });
    });
  }
  function wallX(x0, x1, z, h, y0) {
    const len = Math.abs(x1 - x0);
    if (len < 0.05) return;
    const yBase = (y0 || 0);
    const m = addBox(len, h, T, mats.wall, (x0 + x1) / 2, yBase + h / 2, z);
    const cap = addBox(len + 0.04, 0.08, T + 0.08, mats.base, (x0 + x1) / 2, yBase + h + 0.04, z);
    const id = exteriorIdX(z);
    if (id) { tagExterior(m, id); tagExterior(cap, id); }
  }
  function wallZ(z0, z1, x, h, y0) {
    const len = Math.abs(z1 - z0);
    if (len < 0.05) return;
    const yBase = (y0 || 0);
    const m = addBox(T, h, len, mats.wall, x, yBase + h / 2, (z0 + z1) / 2);
    const cap = addBox(T + 0.08, 0.08, len + 0.04, mats.base, x, yBase + h + 0.04, (z0 + z1) / 2);
    const id = exteriorIdZ(x);
    if (id) { tagExterior(m, id); tagExterior(cap, id); }
  }
  function lintelX(x0, x1, z, wallH) { wallX(x0, x1, z, 1.15, wallH - 1.15); }
  function lintelZ(z0, z1, x, wallH) { wallZ(z0, z1, x, 1.15, wallH - 1.15); }

  function baseX(x0, x1, z) {
    addBox(Math.abs(x1 - x0), 0.38, 0.08, mats.base, (x0 + x1) / 2, 0.19, z);
  }
  function baseZ(z0, z1, x) {
    addBox(0.08, 0.38, Math.abs(z1 - z0), mats.base, x, 0.19, (z0 + z1) / 2);
  }

  // Exterior walls: north is now a solid wall (no deck door)
  wallX(0, 40, 0, H);
  wallZ(0, 28, 0, H);
  wallZ(0, 28, 40, H);
  wallX(0, 21, 28, CUT);
  wallX(24, 40, 28, CUT);
  addBox(5.2, 0.35, 2.2, mats.stoop, 22.5, 0.05, 29.3);
  addBox(5.2, 0.22, 1.5, mats.stoop, 22.5, -0.08, 30.4);

  wallZ(0, 4, 14, H);
  wallZ(10, 14, 14, H);
  lintelZ(4, 10, 14, H);
  wallX(0, 8, 14, H);
  lintelX(8, 11, 14, H);
  wallX(11, 21, 14, H);
  lintelX(21, 25, 14, H);
  wallX(25, 35, 14, H);
  lintelX(35, 37.5, 14, H);
  wallX(37.5, 40, 14, H);
  wallZ(0, 2, 34, H);
  lintelZ(2, 5, 34, H);
  wallZ(5, 14, 34, H);
  wallX(34, 40, 8, H);
  wallZ(14, 18, 18, H);
  lintelZ(18, 22, 18, H);
  wallZ(22, 28, 18, H);
  wallZ(14, 24, 28, H);
  lintelZ(24, 27, 28, H);
  wallZ(27, 28, 28, H);

  // Baseboards (interior faces, skipping door openings)
  baseX(0.3, 39.7, 0.22);
  baseX(0.3, 20.8, 27.78);
  baseX(24.2, 39.7, 27.78);
  baseZ(0.3, 27.7, 0.22);
  baseZ(0.3, 27.7, 39.78);
  baseZ(0.3, 3.9, 13.78);
  baseZ(10.1, 13.7, 13.78);
  baseX(0.3, 7.9, 13.78);
  baseX(11.1, 20.9, 13.78);
  baseX(25.1, 34.9, 13.78);
  baseX(37.6, 39.7, 13.78);
  baseZ(14.3, 17.9, 17.78);
  baseZ(22.1, 27.7, 17.78);
  baseZ(14.3, 23.9, 27.78);
  baseZ(27.1, 27.7, 27.78);

  function windowPane(x, y, z, w, h, alongZ) {
    const made = [];
    const glass = addBox(alongZ ? 0.05 : w, h, alongZ ? w : 0.05, mats.glass, x, y, z);
    glass.castShadow = false;
    made.push(glass);
    // outer frame
    made.push(addBox(alongZ ? 0.1 : w + 0.22, h + 0.22, alongZ ? w + 0.22 : 0.1, mats.walnut, x, y, z));
    made[made.length - 1].castShadow = false;
    // mullions
    made.push(addBox(alongZ ? 0.08 : 0.06, h, alongZ ? 0.06 : w, mats.walnut, x, y, z));
    made[made.length - 1].castShadow = false;
    made.push(addBox(alongZ ? 0.08 : w, 0.06, alongZ ? w : 0.08, mats.walnut, x, y, z));
    made[made.length - 1].castShadow = false;
    // daylight just outside
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(alongZ ? h : w * 0.92, alongZ ? w * 0.92 : h),
      mats.glow
    );
    if (alongZ) {
      glow.rotation.y = Math.PI / 2;
      glow.position.set(x + (x < 20 ? -0.12 : 0.12), y, z);
    } else {
      glow.position.set(x, y, z - 0.12);
    }
    glow.castShadow = false;
    glow.receiveShadow = false;
    house.add(glow);
    made.push(glow);
    let wid = null;
    if (alongZ && x < 5) wid = 'west';
    else if (alongZ && x > 35) wid = 'east';
    else if (!alongZ && z < 5) wid = 'north';
    else if (!alongZ && z > 23) wid = 'south';
    if (wid) made.forEach(function (mesh) { tagExterior(mesh, wid); });
    const pl = new THREE.PointLight(0xfff3d6, 0.32, 11, 2);
    pl.position.set(
      alongZ ? x + (x < 20 ? 1.2 : -1.2) : x,
      y - 0.4,
      alongZ ? z : z + 1.2
    );
    scene.add(pl);
  }
  windowPane(-0.2, 4.6, 4.5, 2.8, 3.4, true);    // kitchen west, over meat sink
  windowPane(-0.2, 4.6, 21, 4.0, 3.4, true);     // living west
  windowPane(9.8, 4.6, -0.2, 2.8, 3.2, false);   // kitchen north, over dairy sink
  windowPane(24, 4.8, -0.2, 4.5, 3.2, false);    // dining north
  windowPane(40.2, 4.6, 21, 4.0, 3.4, true);     // study east

  /* ---------- Kitchen ---------- */
  function barHandle(x, y, z, horizontal, alongX) {
    if (horizontal) addBox(alongX ? 0.28 : 0.04, 0.035, alongX ? 0.04 : 0.28, mats.metal, x, y, z);
    else addBox(0.035, 0.28, 0.035, mats.metal, x, y, z);
  }
  function shakerFace(cx, cy, cz, w, h, axis, sign, drawer) {
    const t = 0.045;
    const isX = axis === 'x';
    addBox(isX ? t : w, h, isX ? w : t, mats.cream, cx, cy, cz);
    const pw = Math.max(0.1, w - 0.2);
    const ph = Math.max(0.1, h - 0.2);
    addBox(isX ? t : pw, ph, isX ? pw : t, mats.creamDark,
      cx + (isX ? sign * 0.02 : 0), cy, cz + (isX ? 0 : sign * 0.02));
    const hx = cx + (isX ? sign * 0.07 : (drawer ? 0 : -sign * w * 0.28));
    const hy = drawer ? cy : cy + 0.05;
    const hz = cz + (isX ? (drawer ? 0 : -sign * w * 0.28) : sign * 0.07);
    barHandle(hx, hy, hz, !!drawer, !isX);
  }

  // Meat run, west wall: bases z=1.7–10.4, fridge at the south end
  addBox(2.0, 3.0, 8.6, mats.cream, 1.15, 1.5, 6.0);
  addBox(2.15, 0.12, 8.75, mats.marble, 1.15, 3.06, 6.0);
  shakerFace(2.18, 1.55, 3.0, 1.5, 2.6, 'x', 1, false);
  shakerFace(2.18, 1.15, 4.6, 1.3, 1.7, 'x', 1, false);
  shakerFace(2.18, 1.15, 8.85, 1.4, 1.7, 'x', 1, false);
  shakerFace(2.18, 2.45, 8.85, 1.4, 0.7, 'x', 1, true);
  addBox(1.3, 0.12, 1.6, mats.sink, 1.2, 3.14, 4.5);
  // Meat range
  addBox(1.7, 3.05, 2.2, mats.steel, 1.25, 1.55, 7.3);
  addBox(1.55, 0.08, 2.05, mats.black, 1.28, 3.12, 7.3);
  addBox(1.5, 1.4, 0.08, mats.black, 2.05, 1.5, 7.3); // oven glass
  barHandle(2.12, 2.35, 7.3, true, false);
  // Hood over meat range
  addBox(2.05, 0.32, 2.35, mats.cream, 1.15, 5.15, 7.3);
  addBox(1.15, 1.15, 1.25, mats.creamDark, 0.85, 5.9, 7.3);
  addBox(1.3, 0.08, 1.4, mats.cream, 0.85, 6.52, 7.3);
  // Meat uppers
  addBox(1.15, 2.8, 1.6, mats.cream, 0.72, 5.9, 2.5);
  shakerFace(1.32, 5.9, 2.5, 1.45, 2.5, 'x', 1, false);
  addBox(1.15, 2.8, 1.7, mats.cream, 0.72, 5.9, 9.55);
  shakerFace(1.32, 5.9, 9.55, 1.55, 2.5, 'x', 1, false);
  // Fridge
  addBox(2.3, 6.7, 2.5, mats.steel, 1.3, 3.35, 12.15);
  addBox(0.05, 6.3, 2.3, mats.black, 2.44, 3.35, 12.15);
  barHandle(2.55, 3.6, 12.15, false, false);

  // Dairy run, north wall
  addBox(6.4, 3.0, 2.0, mats.cream, 10.6, 1.5, 1.15);
  addBox(6.55, 0.12, 2.15, mats.marble, 10.6, 3.06, 1.15);
  shakerFace(8.4, 1.55, 2.18, 1.5, 2.6, 'z', 1, false);
  shakerFace(10.0, 1.15, 2.18, 1.4, 1.7, 'z', 1, false);
  shakerFace(13.3, 1.15, 2.18, 1.4, 1.7, 'z', 1, false);
  shakerFace(13.3, 2.45, 2.18, 1.4, 0.7, 'z', 1, true);
  addBox(1.8, 0.12, 1.4, mats.sink, 9.8, 3.14, 1.2);
  addBox(2.2, 3.05, 1.7, mats.steel, 12.35, 1.55, 1.25);
  addBox(2.05, 0.08, 1.55, mats.black, 12.35, 3.12, 1.28);
  addBox(0.08, 1.4, 1.5, mats.black, 12.35, 1.5, 2.08);
  barHandle(12.35, 2.35, 2.16, true, true);
  addBox(2.35, 0.32, 2.05, mats.cream, 12.35, 5.15, 1.15);
  addBox(1.25, 1.15, 1.15, mats.creamDark, 12.35, 5.9, 0.85);
  addBox(1.4, 0.08, 1.3, mats.cream, 12.35, 6.52, 0.85);
  addBox(1.5, 2.8, 1.15, mats.cream, 7.9, 5.9, 0.72);
  shakerFace(7.9, 5.9, 1.32, 1.35, 2.5, 'z', 1, false);
  addBox(1.4, 2.8, 1.15, mats.cream, 13.9, 5.9, 0.72);
  shakerFace(13.9, 5.9, 1.32, 1.25, 2.5, 'z', 1, false);

  // Pareve island
  addBox(5.0, 3.0, 3.0, mats.cream, 7.5, 1.5, 7.5);
  addBox(5.25, 0.14, 3.25, mats.marble, 7.5, 3.07, 7.5);
  shakerFace(6.3, 2.4, 9.05, 1.4, 0.7, 'z', 1, true);
  shakerFace(6.3, 1.55, 9.05, 1.4, 0.8, 'z', 1, true);
  shakerFace(6.3, 0.75, 9.05, 1.4, 0.7, 'z', 1, true);
  shakerFace(8.7, 2.4, 9.05, 1.4, 0.7, 'z', 1, true);
  shakerFace(8.7, 1.55, 9.05, 1.4, 0.8, 'z', 1, true);
  shakerFace(8.7, 0.75, 9.05, 1.4, 0.7, 'z', 1, true);

  function faucet(x, y, z, rotY) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), mats.metal);
    post.position.y = 0.35;
    g.add(post);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 8), mats.metal);
    neck.rotation.z = Math.PI / 2;
    neck.position.set(0.18, 0.7, 0);
    g.add(neck);
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    house.add(g);
  }
  function burners(x, y, z, rotY) {
    const g = new THREE.Group();
    [[-0.35, -0.4], [0.35, -0.4], [-0.35, 0.4], [0.35, 0.4]].forEach(function (p) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 10), mats.black);
      b.position.set(p[0], 0, p[1]);
      g.add(b);
    });
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    house.add(g);
  }
  faucet(1.15, 3.2, 4.5, Math.PI / 2);
  burners(1.28, 3.18, 7.3, Math.PI / 2);
  faucet(9.8, 3.2, 1.15, 0);
  burners(12.35, 3.18, 1.28, 0);

  function pendant(x, z, yBottom) {
    const rodH = H - 0.04 - yBottom;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, rodH, 8), mats.metal);
    rod.position.set(x, yBottom + rodH / 2, z);
    house.add(rod);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 12), mats.metal);
    cap.position.set(x, H - 0.02, z);
    house.add(cap);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 0.38, 14, 1, true), mats.shade);
    shade.position.set(x, yBottom, z);
    shade.castShadow = false;
    house.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mats.bulb);
    bulb.position.set(x, yBottom - 0.05, z);
    bulb.castShadow = false;
    house.add(bulb);
    const pl = new THREE.PointLight(0xffe4b8, 0.22, 7, 2);
    pl.position.set(x, yBottom - 0.15, z);
    scene.add(pl);
  }
  pendant(6.3, 7.5, 5.4);
  pendant(8.7, 7.5, 5.4);

  /* ---------- Dining ---------- */
  addBox(12.0, 0.16, 4.0, mats.walnut, 24, 2.48, 7);
  addBox(11.2, 0.7, 3.2, mats.walnutDark, 24, 2.05, 7);
  [[18.6, 5.6], [18.6, 8.4], [29.4, 5.6], [29.4, 8.4]].forEach(function (p) {
    addBox(0.18, 2.0, 0.18, mats.walnut, p[0], 1.0, p[1]);
  });
  addBox(8.0, 2.8, 1.4, mats.walnut, 24, 1.4, 0.9);
  addBox(8.0, 0.08, 1.45, mats.walnutDark, 24, 2.84, 0.9);
  shakerFace(22.4, 1.3, 1.62, 2.2, 2.2, 'z', 1, false);
  shakerFace(25.6, 1.3, 1.62, 2.2, 2.2, 'z', 1, false);
  pendant(21.2, 7, 5.6);
  pendant(26.8, 7, 5.6);

  const chairProto = (function () {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 1.15), mats.linen);
    seat.position.y = 1.5;
    g.add(seat);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 1.15), mats.walnut);
    base.position.y = 1.44;
    g.add(base);
    [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]].forEach(function (p) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.44, 0.09), mats.walnut);
      leg.position.set(p[0], 0.72, p[1]);
      g.add(leg);
    });
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.55, 0.09), mats.walnut);
    postL.position.set(-0.48, 2.22, -0.52);
    g.add(postL);
    const postR = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.55, 0.09), mats.walnut);
    postR.position.set(0.48, 2.22, -0.52);
    g.add(postR);
    const splat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.06), mats.walnut);
    splat.position.set(0, 2.15, -0.52);
    g.add(splat);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 0.1), mats.walnut);
    rail.position.set(0, 2.95, -0.52);
    g.add(rail);
    const stretch = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.06), mats.walnut);
    stretch.position.set(0, 0.42, 0);
    g.add(stretch);
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  })();

  function placeChair(x, z, rotY) {
    const c = chairProto.clone();
    c.position.set(x, 0, z);
    c.rotation.y = rotY;
    house.add(c);
  }
  [19, 21, 23, 25, 27, 29].forEach(function (x) { placeChair(x, 4.15, 0); });
  [19, 21, 23, 25, 27, 29].forEach(function (x) { placeChair(x, 9.85, Math.PI); });
  placeChair(17.15, 7, Math.PI / 2);
  placeChair(30.85, 7, -Math.PI / 2);

  /* ---------- Living ---------- */
  addBox(11.0, 0.06, 8.6, mats.rug, 8.0, 0.04, 20.3);
  addBox(9.0, 0.45, 2.6, mats.linen, 7.5, 0.55, 26.3);
  addBox(9.0, 1.4, 0.5, mats.linen, 7.5, 1.5, 27.25);
  addBox(0.45, 1.4, 2.6, mats.linen, 3.2, 1.5, 26.3);
  addBox(0.45, 1.4, 2.6, mats.linen, 11.8, 1.5, 26.3);
  for (let i = 0; i < 3; i++) {
    addBox(2.7, 0.32, 2.15, mats.linenSoft, 4.7 + i * 2.8, 0.93, 26.15);
    addBox(2.55, 1.0, 0.38, mats.linenSoft, 4.7 + i * 2.8, 1.68, 27.0);
  }
  addBox(0.7, 0.7, 0.55, mats.burgundy, 4.15, 1.3, 25.95);
  addBox(0.7, 0.7, 0.55, mats.green, 10.85, 1.3, 25.95);
  addBox(4.0, 0.12, 2.2, mats.walnut, 7.5, 1.2, 21.6);
  [[5.7, 20.7], [9.3, 20.7], [5.7, 22.5], [9.3, 22.5]].forEach(function (p) {
    addBox(0.16, 1.14, 0.16, mats.walnut, p[0], 0.57, p[1]);
  });

  function lounge(x, z, rotY) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 2.2), mats.linen);
    seat.position.y = 0.85;
    g.add(seat);
    const cush = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 2.0), mats.linenSoft);
    cush.position.y = 1.15;
    g.add(cush);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.45, 0.38), mats.linen);
    back.position.set(0, 1.7, -0.9);
    g.add(back);
    [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].forEach(function (p) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.12), mats.walnut);
      leg.position.set(p[0], 0.31, p[1]);
      g.add(leg);
    });
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    house.add(g);
  }
  lounge(2.0, 17.0, Math.PI / 2);
  lounge(2.0, 21.4, Math.PI / 2);

  // Floor lamp
  (function () {
    const x = 13.4, z = 25.6;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 12), mats.metal);
    base.position.set(x, 0.04, z);
    house.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 5.1, 8), mats.metal);
    pole.position.set(x, 2.6, z);
    house.add(pole);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.7, 14, 1, true), mats.shade);
    shade.position.set(x, 5.25, z);
    shade.castShadow = false;
    house.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mats.bulb);
    bulb.position.set(x, 5.05, z);
    house.add(bulb);
    const pl = new THREE.PointLight(0xffe4b8, 0.28, 9, 2);
    pl.position.set(x, 5.0, z);
    scene.add(pl);
  })();

  /* ---------- Entry closet ---------- */
  addBox(2.2, 3.2, 8.5, mats.cream, 26.65, 1.6, 19.25);
  addBox(2.25, 0.1, 8.55, mats.walnutDark, 26.65, 3.25, 19.25);
  addBox(2.2, 3.6, 2.4, mats.cream, 26.65, 5.0, 16.4);
  shakerFace(25.52, 1.6, 17.2, 2.4, 2.8, 'x', -1, false);
  shakerFace(25.52, 1.6, 19.7, 2.4, 2.8, 'x', -1, false);
  shakerFace(25.52, 1.6, 22.1, 2.4, 2.8, 'x', -1, false);
  shakerFace(25.52, 5.0, 16.4, 2.2, 3.2, 'x', -1, false);

  /* ---------- Study: seforim wall + desk ---------- */
  addBox(1.15, 7.6, 12.5, mats.walnut, 39.1, 3.8, 21.3);
  for (let i = 0; i < 8; i++) {
    const y = 0.7 + i * 0.95;
    addBox(1.2, 0.08, 12.3, mats.walnutDark, 39.05, y, 21.3);
    addBox(0.62, 0.78, 3.9, mats.books, 38.5, y + 0.46, 16.85);
    addBox(0.56, 0.78, 3.9, mats.books, 38.54, y + 0.46, 20.95);
    addBox(0.66, 0.78, 3.9, mats.books, 38.48, y + 0.46, 25.1);
  }
  addBox(4.5, 2.4, 2.3, mats.walnut, 33.25, 1.2, 20.65);
  addBox(4.6, 0.1, 2.4, mats.walnutDark, 33.25, 2.45, 20.65);
  placeChair(33.25, 22.4, Math.PI);
  // Desk lamp
  (function () {
    const x = 34.6, z = 20.0;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), mats.metal);
    post.position.set(x, 2.85, z);
    house.add(post);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 0.2, 10, 1, true), mats.shade);
    shade.position.set(x, 3.25, z);
    house.add(shade);
    const pl = new THREE.PointLight(0xffe4b8, 0.2, 6, 2);
    pl.position.set(x, 3.15, z);
    scene.add(pl);
  })();

  /* ---------- Pantry shelves + powder ---------- */
  addBox(1.3, 7.0, 7.4, mats.cream, 39.05, 3.5, 4.0);
  for (let i = 0; i < 6; i++) addBox(1.2, 0.07, 7.2, mats.creamDark, 39.0, 1.2 + i * 1.05, 4.0);
  addBox(1.2, 1.4, 1.6, mats.cream, 38.6, 1.4, 9.0);
  addBox(0.9, 0.08, 0.7, mats.sink, 38.6, 2.14, 9.0);
  addBox(1.2, 1.5, 1.6, mats.cream, 38.6, 0.75, 11.4);

  /* ---------- Lighting ---------- */
  const hemi = new THREE.HemisphereLight(0xfff6e8, 0x6a5a44, 0.78);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d6, 1.22);
  sun.position.set(22, 32, 28);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 48;
  sun.shadow.camera.top = 32;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.00055;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdde6f2, 0.3);
  fill.position.set(12, 16, -18);
  scene.add(fill);
  const warm = new THREE.PointLight(0xffe4b8, 0.3, 26, 2);
  warm.position.set(20, 7, 12);
  scene.add(warm);

  return { scene, sun, updateCutaways };
}

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

async function startTour(rootEls, THREELib, OrbitControls) {
  THREE = THREELib;
  const { stage, canvas, loading, fallback } = rootEls;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: !mobile,
    alpha: false,
    powerPreference: 'default'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75));
  renderer.setSize(stage.clientWidth, stage.clientHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;

  const { scene, sun, updateCutaways } = buildScene(THREE);
  if (mobile) sun.shadow.mapSize.set(1024, 1024);

  function isPortrait() { return stage.clientHeight > stage.clientWidth * 1.05; }
  function viewFor(name) {
    const v = VIEWS[name];
    if (!v) return null;
    if (isPortrait() && (name === 'home' || name === 'plan')) {
      return { pos: [v.pos[0], v.pos[1] + 6, v.pos[2] + 8], target: v.target };
    }
    return v;
  }
  const camera = new THREE.PerspectiveCamera(isPortrait() ? 52 : 42, stage.clientWidth / Math.max(1, stage.clientHeight), 0.2, 200);
  const homeView = viewFor('home');
  camera.position.set.apply(camera.position, homeView.pos);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set.apply(controls.target, homeView.target);
  controls.enableDamping = !reduced;
  controls.dampingFactor = 0.08;
  controls.minDistance = 7;
  controls.maxDistance = 78;
  controls.minPolarAngle = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.06;
  controls.enablePan = !mobile;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.update();

  let currentView = 'home';
  let anim = null;
  let visible = true;
  let raf = 0;

  function goTo(name, fromToggle) {
    const view = viewFor(name);
    if (!view) return;
    currentView = name;
    const planBox = document.getElementById('tourPlanView');
    if (planBox && !fromToggle) planBox.checked = name === 'plan';
    document.querySelectorAll('.tour-btn').forEach(function (btn) {
      const isOn = name === 'plan' ? false : btn.getAttribute('data-view') === name;
      btn.classList.toggle('is-on', isOn);
      btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    });
    const fromP = camera.position.clone();
    const fromT = controls.target.clone();
    const toP = new THREE.Vector3().fromArray(view.pos);
    const toT = new THREE.Vector3().fromArray(view.target);
    if (reduced) {
      camera.position.copy(toP);
      controls.target.copy(toT);
      controls.update();
      anim = null;
      return;
    }
    anim = { t0: performance.now(), dur: 1100, fromP: fromP, fromT: fromT, toP: toP, toT: toT };
  }

  document.querySelectorAll('.tour-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      goTo(btn.getAttribute('data-view'));
    });
  });
  const planBox = document.getElementById('tourPlanView');
  if (planBox) {
    planBox.addEventListener('change', function () {
      if (planBox.checked) goTo('plan', true);
      else goTo('home', true);
    });
  }

  function resize() {
    const w = stage.clientWidth;
    const h = Math.max(1, stage.clientHeight);
    camera.aspect = w / h;
    camera.fov = isPortrait() ? 52 : 42;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  const ro = (window.ResizeObserver) ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(stage);
  else window.addEventListener('resize', resize);

  stage.addEventListener('pointerenter', pauseLenis);
  stage.addEventListener('pointerleave', resumeLenis);
  stage.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
  stage.addEventListener('touchstart', pauseLenis, { passive: true });
  stage.addEventListener('touchend', function () { setTimeout(resumeLenis, 200); }, { passive: true });

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!visible) return;
    if (anim) {
      const p = Math.min(1, (now - anim.t0) / anim.dur);
      const e = easeInOut(p);
      camera.position.lerpVectors(anim.fromP, anim.toP, e);
      controls.target.lerpVectors(anim.fromT, anim.toT, e);
      if (p >= 1) anim = null;
    }
    controls.update();
    if (updateCutaways) updateCutaways(camera);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(function (t) {
    renderer.render(scene, camera);
    stage.classList.add('is-ready');
    stage.setAttribute('data-ready', 'true');
    if (loading) loading.hidden = true;
    tick(t);
  });

  const vis = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { visible = en.isIntersecting; });
  }, { threshold: 0.01 });
  vis.observe(stage);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) visible = false;
    else if (stage.getBoundingClientRect().height) {
      const r = stage.getBoundingClientRect();
      visible = r.bottom > 0 && r.top < window.innerHeight;
    }
  });

  window.ZCTour = {
    goTo: goTo,
    pose: function (cx, cy, cz, tx, ty, tz) {
      if (anim) anim = null;
      camera.position.set(cx, cy, cz);
      controls.target.set(tx, ty, tz);
      controls.update();
      if (updateCutaways) updateCutaways(camera);
      renderer.render(scene, camera);
    },
    views: VIEWS,
    ready: function () { return !!(stage && stage.classList.contains('is-ready')); }
  };
}

function init() {
  const stage = document.getElementById('tourStage');
  const canvas = document.getElementById('tourCanvas');
  const fallback = document.getElementById('tourFallback');
  const loading = document.getElementById('tourLoading');
  if (!stage || !canvas) return;

  const boot = async function () {
    if (stage.dataset.booted) return;
    stage.dataset.booted = '1';
    if (!hasWebGL() || !supportsImportMap()) {
      showFallback(stage, fallback, loading);
      return;
    }
    if (loading) loading.hidden = false;
    try {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
      await startTour({ stage: stage, canvas: canvas, loading: loading, fallback: fallback }, THREE, OrbitControls);
    } catch (err) {
      showFallback(stage, fallback, loading);
    }
  };

  if (!('IntersectionObserver' in window)) {
    boot();
    return;
  }
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        io.disconnect();
        boot();
      }
    });
  }, { rootMargin: '200px 0px' });
  io.observe(stage);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
