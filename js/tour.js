/* Interactive dollhouse of the illustrative 40' × 28' sample plan.
   Lazy-loads three.js when #tour scrolls into view. */
const THREE_VERSION = '0.170.0';
let THREE;

const VIEWS = {
  home:    { pos: [20, 40, 44], target: [20, 0.3, 9] },
  kitchen: { pos: [8.2, 14.5, 11.2], target: [7, 1.2, 6.2] },
  dining:  { pos: [24, 14.5, 12.2], target: [24, 1.2, 6.4] },
  living:  { pos: [9, 13, 40], target: [9, 0.8, 21] },
  study:   { pos: [34, 13, 40], target: [34, 0.8, 21] },
  plan:    { pos: [20, 52, 14.5], target: [20, 0, 10] }
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

function makeCanvasTexture(draw, size, repeatX, repeatZ) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX || 1, repeatZ || 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function woodTexture() {
  return makeCanvasTexture(function (ctx, s) {
    ctx.fillStyle = '#c4a06a';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 18; i++) {
      const y = (i / 18) * s;
      ctx.fillStyle = i % 2 ? '#b8945c' : '#caa56f';
      ctx.fillRect(0, y, s, s / 18 + 1);
      ctx.strokeStyle = 'rgba(90,55,25,' + (0.08 + (i % 3) * 0.04) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + 2);
      for (let x = 0; x < s; x += 8) ctx.lineTo(x, y + 2 + Math.sin(x * 0.04 + i) * 1.4);
      ctx.stroke();
    }
  }, 256, 8, 6);
}

function deckTexture() {
  return makeCanvasTexture(function (ctx, s) {
    ctx.fillStyle = '#8d6a3e';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#7a5a32' : '#9a7448';
      ctx.fillRect((i / 12) * s, 0, s / 12 - 1, s);
    }
  }, 128, 16, 9);
}

function marbleTexture() {
  return makeCanvasTexture(function (ctx, s) {
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(140,140,150,.28)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * s, 0);
      ctx.bezierCurveTo(Math.random() * s, s * 0.3, Math.random() * s, s * 0.7, Math.random() * s, s);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(110,110,120,.18)';
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(0, Math.random() * s);
      ctx.bezierCurveTo(s * 0.4, Math.random() * s, s * 0.7, Math.random() * s, s, Math.random() * s);
      ctx.stroke();
    }
  }, 256, 2, 1);
}

function rugTexture() {
  return makeCanvasTexture(function (ctx, s) {
    ctx.fillStyle = '#c9b59a';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#6b1d2a';
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, s - 24, s - 24);
    ctx.strokeStyle = '#1e3d32';
    ctx.lineWidth = 3;
    ctx.strokeRect(22, 22, s - 44, s - 44);
    ctx.fillStyle = 'rgba(107,29,42,.12)';
    for (let y = 40; y < s - 40; y += 28) {
      for (let x = 40; x < s - 40; x += 28) {
        ctx.beginPath();
        ctx.arc(x + 6, y + 6, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, 256, 1, 1);
}

function bookTexture() {
  return makeCanvasTexture(function (ctx, s) {
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(0, 0, s, s);
    const colors = ['#3b1f16', '#5c2a24', '#2a3328', '#4a3a22', '#1e2a22', '#6b1d2a', '#3d2c18', '#2c2418'];
    const colW = 7;
    for (let x = 0, i = 0; x < s; i++) {
      const w = colW + (i * 13) % 5;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(x, 0, w - 1, s);
      if (i % 3 === 0) {
        ctx.fillStyle = 'rgba(212,175,110,.55)';
        ctx.fillRect(x + 1, 6, w - 3, 2);
      }
      x += w;
    }
  }, 256, 4, 8);
}

function labelTexture(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(107,29,42,.72)';
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
  scene.fog = new THREE.Fog(0xe8dcc8, 55, 120);

  const mats = {};
  const wood = woodTexture();
  const marble = marbleTexture();
  mats.wall = new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.86, metalness: 0 });
  mats.wallInner = new THREE.MeshStandardMaterial({ color: 0xf6efe2, roughness: 0.88, metalness: 0 });
  mats.floor = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, metalness: 0.02, color: 0xe8d0a8 });
  mats.deck = new THREE.MeshStandardMaterial({ map: deckTexture(), roughness: 0.7, color: 0xc4a06a });
  mats.ground = new THREE.MeshStandardMaterial({ color: 0xc5b89a, roughness: 1, metalness: 0 });
  mats.cream = new THREE.MeshStandardMaterial({ color: 0xefe6d4, roughness: 0.6, metalness: 0.02 });
  mats.creamDark = new THREE.MeshStandardMaterial({ color: 0xe2d6c0, roughness: 0.62, metalness: 0 });
  mats.marble = new THREE.MeshStandardMaterial({ map: marble, roughness: 0.28, metalness: 0.05, color: 0xffffff });
  mats.walnut = new THREE.MeshStandardMaterial({ color: 0x5c3d2a, roughness: 0.5, metalness: 0.04 });
  mats.walnutDark = new THREE.MeshStandardMaterial({ color: 0x3f2a1c, roughness: 0.52, metalness: 0.04 });
  mats.linen = new THREE.MeshStandardMaterial({ color: 0xe9e1d2, roughness: 0.9, metalness: 0 });
  mats.metal = new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.35, metalness: 0.7 });
  mats.steel = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.32, metalness: 0.65 });
  mats.black = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.45, metalness: 0.2 });
  mats.sink = new THREE.MeshStandardMaterial({ color: 0xd5d8dc, roughness: 0.25, metalness: 0.55 });
  mats.glass = new THREE.MeshStandardMaterial({ color: 0x9eb7c8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.45 });
  mats.cedar = new THREE.MeshStandardMaterial({ color: 0x8b5e34, roughness: 0.7, metalness: 0 });
  mats.rug = new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.95, metalness: 0 });
  mats.books = new THREE.MeshStandardMaterial({ map: bookTexture(), roughness: 0.7, metalness: 0 });
  mats.green = new THREE.MeshStandardMaterial({ color: 0x1e3d32, roughness: 0.7, metalness: 0 });
  mats.stoop = new THREE.MeshStandardMaterial({ color: 0x9a8c78, roughness: 0.85, metalness: 0 });

  const T = 0.35;       // wall thickness
  const H = 8.0;        // interior / most exterior wall height
  const CUT = 1.15;     // cut-away south wall height
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

  // Ground and floors
  const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 48), mats.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.32;
  ground.receiveShadow = true;
  scene.add(ground);

  addBox(40.4, 0.28, 28.4, mats.floor, 20, -0.14, 14);
  addBox(16.2, 0.24, 9.2, mats.deck, 8, -0.18, -4.5);

  // Floor labels (visible in top-down)
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
  floorLabel('KITCHEN', 7, 9.4, 4.2);
  floorLabel('DINING', 24, 10.4, 4.6);
  floorLabel('LIVING', 9, 18.4, 4.6);
  floorLabel('ENTRY', 23, 18.8, 3.6);
  floorLabel('STUDY', 34, 18.8, 3.8);
  floorLabel('SUKKAH', 8, -6.2, 4.4);

  // Walls: east-west (along X) at a fixed z; north-south (along Z) at a fixed x
  function wallX(x0, x1, z, h, y0) {
    const len = Math.abs(x1 - x0);
    if (len < 0.05) return;
    addBox(len, h, T, mats.wall, (x0 + x1) / 2, (y0 || 0) + h / 2, z);
  }
  function wallZ(z0, z1, x, h, y0) {
    const len = Math.abs(z1 - z0);
    if (len < 0.05) return;
    addBox(T, h, len, mats.wall, x, (y0 || 0) + h / 2, (z0 + z1) / 2);
  }
  function lintelX(x0, x1, z, wallH) {
    wallX(x0, x1, z, 1.15, wallH - 1.15);
  }
  function lintelZ(z0, z1, x, wallH) {
    wallZ(z0, z1, x, 1.15, wallH - 1.15);
  }

  // Exterior: north (z=0), with sukkah door 5'–8'
  wallX(0, 5, 0, H);
  wallX(8, 40, 0, H);
  lintelX(5, 8, 0, H);
  // West and east, full height
  wallZ(0, 28, 0, H);
  wallZ(0, 28, 40, H);
  // South facade cut away, front door 21'–24'
  wallX(0, 21, 28, CUT);
  wallX(24, 40, 28, CUT);
  // Low stoop steps at the front door
  addBox(5.2, 0.35, 2.2, mats.stoop, 22.5, 0.05, 29.3);
  addBox(5.2, 0.22, 1.5, mats.stoop, 22.5, -0.08, 30.4);

  // Interior: kitchen / dining at x=14, opening z=4–10
  wallZ(0, 4, 14, H);
  wallZ(10, 14, 14, H);
  lintelZ(4, 10, 14, H);
  // Mid wall z=14 (kitchen/living, dining/entry, powder)
  wallX(0, 8, 14, H);
  lintelX(8, 11, 14, H);          // kitchen–living door 3'
  wallX(11, 21, 14, H);
  lintelX(21, 25, 14, H);         // dining–entry opening 4'
  wallX(25, 35, 14, H);
  lintelX(35, 37.5, 14, H);       // powder door
  wallX(37.5, 40, 14, H);
  // Pantry west wall x=34, door z=2–5
  wallZ(0, 2, 34, H);
  lintelZ(2, 5, 34, H);
  wallZ(5, 14, 34, H);
  // Pantry / powder at z=8, x=34–40
  wallX(34, 40, 8, H);
  // Living / entry at x=18, door z=18–22
  wallZ(14, 18, 18, H);
  lintelZ(18, 22, 18, H);
  wallZ(22, 28, 18, H);
  // Entry / study at x=28, door z=24–27
  wallZ(14, 24, 28, H);
  lintelZ(24, 27, 28, H);
  wallZ(27, 28, 28, H);

  // Simple windows (inset glass on west, east, north)
  function windowPane(x, y, z, w, h, alongZ) {
    const m = addBox(alongZ ? 0.06 : w, h, alongZ ? w : 0.06, mats.glass, x, y, z);
    m.castShadow = false;
    const frame = addBox(alongZ ? 0.1 : w + 0.2, h + 0.2, alongZ ? w + 0.2 : 0.1, mats.walnut, x, y, z);
    frame.castShadow = false;
  }
  windowPane(-0.2, 4.6, 6, 3.2, 3.4, true);     // kitchen west
  windowPane(-0.2, 4.6, 21, 4.0, 3.4, true);    // living west
  windowPane(24, 4.8, -0.2, 4.5, 3.2, false);   // dining north
  windowPane(40.2, 4.6, 21, 4.0, 3.4, true);    // study east

  /* ---------- Kitchen: matching cream cabinets, meat west, dairy north, pareve island ---------- */
  // Meat run along west wall (x≈1.1, z=2–12), 2' deep
  addBox(2.0, 3.0, 10.0, mats.cream, 1.15, 1.5, 7);
  addBox(2.15, 0.12, 10.15, mats.marble, 1.15, 3.06, 7);
  // Meat sink
  addBox(1.3, 0.12, 1.6, mats.sink, 1.2, 3.14, 4.8);
  faucet(1.15, 3.2, 4.8, Math.PI / 2);
  // Meat stove
  addBox(1.5, 0.08, 2.1, mats.black, 1.2, 3.14, 7.6);
  burners(1.2, 3.2, 7.6, Math.PI / 2);
  addBox(2.0, 0.35, 0.08, mats.creamDark, 0.35, 3.3, 7.6); // short backsplash

  // Dairy run along north wall (z≈1.1, x=8.2–13.8)
  addBox(5.6, 3.0, 2.0, mats.cream, 11.0, 1.5, 1.15);
  addBox(5.75, 0.12, 2.15, mats.marble, 11.0, 3.06, 1.15);
  addBox(1.8, 0.12, 1.4, mats.sink, 10.0, 3.14, 1.2);
  faucet(10.0, 3.2, 1.15, 0);
  addBox(2.1, 0.08, 1.5, mats.black, 12.2, 3.14, 1.2);
  burners(12.2, 3.2, 1.2, 0);

  // Pareve island 5' × 3', centered
  addBox(5.0, 3.0, 3.0, mats.cream, 7.5, 1.5, 7.5);
  addBox(5.25, 0.14, 3.25, mats.marble, 7.5, 3.07, 7.5);

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

  /* ---------- Dining: 12' × 4' table, 14 chairs, sideboard ---------- */
  addBox(12.0, 0.16, 4.0, mats.walnut, 24, 2.48, 7);
  addBox(11.2, 0.7, 3.2, mats.walnutDark, 24, 2.05, 7);
  [[18.6, 5.6], [18.6, 8.4], [29.4, 5.6], [29.4, 8.4]].forEach(function (p) {
    addBox(0.18, 2.0, 0.18, mats.walnut, p[0], 1.0, p[1]);
  });
  addBox(8.0, 2.8, 1.4, mats.walnut, 24, 1.4, 0.9); // sideboard
  addBox(8.0, 0.08, 1.45, mats.walnutDark, 24, 2.84, 0.9);

  const chairProto = (function () {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.2), mats.linen);
    seat.position.y = 1.5;
    g.add(seat);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.2), mats.walnut);
    base.position.y = 1.44;
    g.add(base);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.1), mats.walnut);
    back.position.set(0, 2.25, -0.55);
    g.add(back);
    [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]].forEach(function (p) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.44, 0.1), mats.walnut);
      leg.position.set(p[0], 0.72, p[1]);
      g.add(leg);
    });
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  })();

  function placeChair(x, z, rotY) {
    const c = chairProto.clone();
    c.position.set(x, 0, z);
    c.rotation.y = rotY;
    house.add(c);
  }
  // 6 north of table (facing south), 6 south (facing north), 1 each end
  [19, 21, 23, 25, 27, 29].forEach(function (x) { placeChair(x, 4.15, 0); });
  [19, 21, 23, 25, 27, 29].forEach(function (x) { placeChair(x, 9.85, Math.PI); });
  placeChair(17.15, 7, Math.PI / 2);
  placeChair(30.85, 7, -Math.PI / 2);

  /* ---------- Living ---------- */
  addBox(11.0, 0.06, 8.6, mats.rug, 8.0, 0.04, 20.3);
  // Sofa along south wall, facing north
  addBox(9.0, 1.15, 2.4, mats.linen, 7.5, 0.7, 26.4);
  addBox(9.0, 1.3, 0.55, mats.linen, 7.5, 1.85, 27.25);
  addBox(0.5, 1.5, 2.4, mats.linen, 3.25, 1.5, 26.4);
  addBox(0.5, 1.5, 2.4, mats.linen, 11.75, 1.5, 26.4);
  // Coffee table
  addBox(4.0, 0.12, 2.2, mats.walnut, 7.5, 1.2, 21.6);
  [[5.7, 20.7], [9.3, 20.7], [5.7, 22.5], [9.3, 22.5]].forEach(function (p) {
    addBox(0.16, 1.14, 0.16, mats.walnut, p[0], 0.57, p[1]);
  });
  // Two lounge chairs on the west
  function lounge(x, z, rotY) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 2.2), mats.linen);
    seat.position.y = 0.85;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 0.4), mats.linen);
    back.position.set(0, 1.7, -0.9);
    g.add(back);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    house.add(g);
  }
  lounge(2.0, 17.0, Math.PI / 2);
  lounge(2.0, 21.4, Math.PI / 2);

  /* ---------- Entry closet / built-in along east side ---------- */
  addBox(2.2, 3.2, 8.5, mats.cream, 26.65, 1.6, 19.25);
  addBox(2.25, 0.1, 8.55, mats.walnutDark, 26.65, 3.25, 19.25);
  addBox(2.2, 3.6, 2.4, mats.cream, 26.65, 5.0, 16.4); // tall coat cabinet at the north end

  /* ---------- Study: seforim wall + desk ---------- */
  addBox(1.15, 7.6, 12.5, mats.walnut, 39.1, 3.8, 21.3);
  addBox(0.7, 7.2, 12.2, mats.books, 38.55, 3.8, 21.3);
  // shelf rails
  for (let i = 0; i < 8; i++) {
    addBox(1.2, 0.08, 12.3, mats.walnutDark, 39.05, 0.7 + i * 0.95, 21.3);
  }
  addBox(4.5, 2.4, 2.3, mats.walnut, 33.25, 1.2, 20.65);
  addBox(4.6, 0.1, 2.4, mats.walnutDark, 33.25, 2.45, 20.65);
  placeChair(33.25, 22.4, Math.PI);

  /* ---------- Pantry shelves + powder ---------- */
  addBox(1.3, 7.0, 7.4, mats.cream, 39.05, 3.5, 4.0);
  addBox(1.2, 1.4, 1.6, mats.cream, 38.6, 1.4, 9.0); // vanity
  addBox(0.9, 0.08, 0.7, mats.sink, 38.6, 2.14, 9.0);
  addBox(1.2, 1.5, 1.6, mats.cream, 38.6, 0.75, 11.4); // toilet mass

  /* ---------- Sukkah deck: rail, table, open pergola for schach ---------- */
  // Railings (north, west, east) 3' high
  addBox(16.0, 0.12, 0.12, mats.cedar, 8, 3.0, -9);
  addBox(0.12, 0.12, 9.0, mats.cedar, 0, 3.0, -4.5);
  addBox(0.12, 0.12, 9.0, mats.cedar, 16, 3.0, -4.5);
  for (let i = 0; i <= 8; i++) addBox(0.1, 3.0, 0.1, mats.cedar, i * 2, 1.5, -9);
  for (let i = 1; i <= 4; i++) {
    addBox(0.1, 3.0, 0.1, mats.cedar, 0, 1.5, -9 + i * 2);
    addBox(0.1, 3.0, 0.1, mats.cedar, 16, 1.5, -9 + i * 2);
  }
  addBox(8.0, 0.12, 2.8, mats.cedar, 8, 2.4, -4.5);
  [[4.5, -5.6], [4.5, -3.4], [11.5, -5.6], [11.5, -3.4]].forEach(function (p) {
    addBox(0.16, 2.35, 0.16, mats.cedar, p[0], 1.15, p[1]);
  });
  // Open louvered roof (schach-ready)
  addBox(16.4, 0.18, 0.18, mats.cedar, 8, 8.15, -9);
  addBox(16.4, 0.18, 0.18, mats.cedar, 8, 8.15, 0);
  addBox(0.18, 0.18, 9.2, mats.cedar, 0, 8.15, -4.5);
  addBox(0.18, 0.18, 9.2, mats.cedar, 16, 8.15, -4.5);
  for (let i = 0; i < 10; i++) {
    addBox(0.18, 0.12, 9.0, mats.cedar, 1 + i * 1.55, 8.28, -4.5);
  }
  // Posts
  [[0.2, -8.8], [15.8, -8.8], [0.2, -0.3], [15.8, -0.3]].forEach(function (p) {
    addBox(0.22, 8.2, 0.22, mats.cedar, p[0], 4.1, p[1]);
  });

  /* ---------- Lighting ---------- */
  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x6a5a44, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d6, 1.45);
  sun.position.set(16, 28, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -32;
  sun.shadow.camera.right = 32;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -20;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdde6f2, 0.28);
  fill.position.set(10, 18, -22);
  scene.add(fill);
  const warm = new THREE.PointLight(0xffe4b8, 0.35, 28, 2);
  warm.position.set(20, 7, 10);
  scene.add(warm);

  return { scene, sun };
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
  renderer.toneMappingExposure = 1.05;

  const { scene, sun } = buildScene(THREE);
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
  controls.minPolarAngle = 0.06;
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
      const on = btn.getAttribute('data-view') === (name === 'plan' ? '' : name);
      // When top-down, no room button stays uniquely "the" view except we clear them if plan
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
