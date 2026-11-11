/* Per-room 3D viewer. Lazy-loads three.js the first time a "View in 3D" button is used. */
const ROOM_TITLES = {
  kitchen: 'Two-Zone Kosher Kitchen',
  'dining-shabbos': 'Friday Night Dining Room',
  'dining-yomtov': 'Yom Tov Dining for Twenty',
  bedroom: 'Primary Bedroom',
  kids: "Shared Kids' Room",
  living: 'Seforim Library Living Room',
  foyer: 'Brownstone Foyer',
  mudroom: 'Mudroom & Entry Storage',
  study: 'Study with Seforim Wall'
};

function idFromSrc(src) {
  const s = String(src || '').toLowerCase();
  if (/kosher-kitchen|park-slope-kosher-kitchen\/01/.test(s)) return 'kitchen';
  if (/yom-tov-dining|park-slope-kosher-kitchen\/02/.test(s)) return 'dining-yomtov';
  if (/shabbos-dining|midwood-ground-floor\/02|\/hero\/hero/.test(s)) return 'dining-shabbos';
  if (/primary-bedroom|flatbush-family-home\/03/.test(s)) return 'bedroom';
  if (/kids-bunk-room|flatbush-family-home\/04/.test(s)) return 'kids';
  if (/seforim-living-room|flatbush-family-home\/02/.test(s)) return 'living';
  if (/brownstone-foyer|flatbush-family-home\/01/.test(s)) return 'foyer';
  if (/mudroom-entry-storage/.test(s)) return 'mudroom';
  return null;
}

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

/* ---------- textures (same language as the whole-home tour) ---------- */
function makeCanvasTexture(THREE, draw, size, repeatX, repeatZ, linear) {
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
  }
}
function herringColor(ctx, s) {
  ctx.fillStyle = '#d7c19a';
  ctx.fillRect(0, 0, s, s);
  const tile = 32;
  for (let row = -1; row < s / tile + 1; row++) {
    for (let col = -1; col < s / tile + 1; col++) {
      const x = col * tile, y = row * tile;
      const flip = (row + col) % 2 === 0;
      ctx.fillStyle = (row + col) % 4 === 0 ? '#cdae78' : (row + col) % 4 === 2 ? '#e0c898' : '#d4b888';
      ctx.save();
      ctx.translate(x + tile / 2, y + tile / 2);
      ctx.rotate(flip ? Math.PI / 4 : -Math.PI / 4);
      ctx.fillRect(-tile * 0.7, -6, tile * 1.4, 11);
      ctx.strokeStyle = 'rgba(90,60,25,0.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-tile * 0.7, -6, tile * 1.4, 11);
      ctx.restore();
    }
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
}
function checkerColor(ctx, s) {
  const n = 8;
  const t = s / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dark = (x + y) % 2 === 0;
      ctx.fillStyle = dark ? '#1c1c1e' : '#ece6dc';
      ctx.fillRect(x * t, y * t, t + 1, t + 1);
      ctx.strokeStyle = dark ? 'rgba(220,220,220,0.12)' : 'rgba(80,80,80,0.12)';
      ctx.strokeRect(x * t + 2, y * t + 2, t - 4, t - 4);
    }
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
function orientalColor(ctx, s) {
  ctx.fillStyle = '#6b1d2a';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#c9b59a';
  ctx.fillRect(18, 18, s - 36, s - 36);
  ctx.strokeStyle = '#1e3d32';
  ctx.lineWidth = 8;
  ctx.strokeRect(28, 28, s - 56, s - 56);
  ctx.fillStyle = '#6b1d2a';
  for (let y = 44; y < s - 44; y += 22) {
    for (let x = 44; x < s - 44; x += 22) {
      ctx.fillRect(x, y, 10, 10);
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
function floralColor(ctx, s) {
  ctx.fillStyle = '#f4eee3';
  ctx.fillRect(0, 0, s, s);
  const colors = ['#7d8b5a', '#c4a36a', '#b86a4a', '#d7b896', '#8a6a44', '#9aaa70'];
  for (let i = 0; i < 90; i++) {
    const x = (i * 47 + 20) % s;
    const y = (i * 89 + 15) % s;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((i * 0.7) % Math.PI);
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8 + (i % 6), 3 + (i % 4), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function makeMats(THREE) {
  const woodMap = makeCanvasTexture(THREE, woodColor, 512, 8, 6);
  const woodR = makeCanvasTexture(THREE, woodRough, 512, 8, 6, true);
  const herringMap = makeCanvasTexture(THREE, herringColor, 512, 6, 6);
  const plaster = makeCanvasTexture(THREE, plasterColor, 256, 4, 2);
  const plasterB = makeCanvasTexture(THREE, plasterBump, 256, 4, 2, true);
  const marbleMap = makeCanvasTexture(THREE, marbleColor, 512, 2, 1);
  const checkerMap = makeCanvasTexture(THREE, checkerColor, 512, 4, 5);
  const mats = {};
  mats.wall = new THREE.MeshStandardMaterial({
    color: 0xf4ebda, map: plaster, bumpMap: plasterB, bumpScale: 0.025,
    roughness: 0.9, metalness: 0, side: THREE.DoubleSide
  });
  mats.wallGrey = new THREE.MeshStandardMaterial({
    color: 0xd8d2c8, map: plaster, bumpMap: plasterB, bumpScale: 0.02,
    roughness: 0.92, metalness: 0, side: THREE.DoubleSide
  });
  mats.wallGreige = new THREE.MeshStandardMaterial({
    color: 0xcfc8be, map: plaster, bumpMap: plasterB, bumpScale: 0.02,
    roughness: 0.92, metalness: 0, side: THREE.DoubleSide
  });
  mats.floor = new THREE.MeshPhysicalMaterial({
    map: woodMap, roughnessMap: woodR, roughness: 0.42, metalness: 0.02,
    color: 0xe8d0a8, clearcoat: 0.18, clearcoatRoughness: 0.45
  });
  mats.herring = new THREE.MeshPhysicalMaterial({
    map: herringMap, roughness: 0.48, metalness: 0.02, color: 0xf0e2c4,
    clearcoat: 0.16, clearcoatRoughness: 0.5
  });
  mats.checker = new THREE.MeshPhysicalMaterial({
    map: checkerMap, roughness: 0.22, metalness: 0.04, clearcoat: 0.45, clearcoatRoughness: 0.25
  });
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
  mats.sink = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.22, metalness: 0.15 });
  mats.glass = new THREE.MeshStandardMaterial({
    color: 0xb8cde0, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.42
  });
  mats.glow = new THREE.MeshBasicMaterial({ color: 0xfff6e4 });
  mats.shade = new THREE.MeshStandardMaterial({
    color: 0xf7ecd4, roughness: 0.9, metalness: 0, emissive: 0x3a2a18, emissiveIntensity: 0.2,
    side: THREE.DoubleSide
  });
  mats.bulb = new THREE.MeshBasicMaterial({ color: 0xfff4d8 });
  mats.rug = new THREE.MeshStandardMaterial({ map: makeCanvasTexture(THREE, rugColor, 256, 1, 1), roughness: 0.95, metalness: 0 });
  mats.oriental = new THREE.MeshStandardMaterial({ map: makeCanvasTexture(THREE, orientalColor, 256, 1, 1), roughness: 0.95, metalness: 0 });
  mats.books = new THREE.MeshStandardMaterial({ map: makeCanvasTexture(THREE, bookColor, 256, 3, 1), roughness: 0.7, metalness: 0 });
  mats.floral = new THREE.MeshStandardMaterial({
    map: makeCanvasTexture(THREE, floralColor, 512, 2, 2), roughness: 0.9, metalness: 0, side: THREE.DoubleSide
  });
  mats.green = new THREE.MeshStandardMaterial({ color: 0x1e3d32, roughness: 0.7, metalness: 0 });
  mats.sage = new THREE.MeshStandardMaterial({ color: 0x7d8f6e, roughness: 0.7, metalness: 0 });
  mats.sageDark = new THREE.MeshStandardMaterial({ color: 0x6a7b5c, roughness: 0.68, metalness: 0 });
  mats.burgundy = new THREE.MeshStandardMaterial({ color: 0x6b1d2a, roughness: 0.75, metalness: 0 });
  mats.clothDark = new THREE.MeshStandardMaterial({ color: 0x3a332c, roughness: 0.9, metalness: 0 });
  mats.coatA = new THREE.MeshStandardMaterial({ color: 0x2c2c2e, roughness: 0.9, metalness: 0 });
  mats.coatB = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9, metalness: 0 });
  mats.coatC = new THREE.MeshStandardMaterial({ color: 0xc5bbae, roughness: 0.9, metalness: 0 });
  mats.basket = new THREE.MeshStandardMaterial({ color: 0xc4a56a, roughness: 0.85, metalness: 0 });
  mats.oak = new THREE.MeshStandardMaterial({ color: 0xc9a56e, roughness: 0.55, metalness: 0.04 });
  mats.white = new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.4, metalness: 0 });
  mats.plant = new THREE.MeshStandardMaterial({ color: 0x4a6b3a, roughness: 0.85, metalness: 0 });
  mats.wainscot = new THREE.MeshStandardMaterial({ color: 0x3f2a1c, roughness: 0.55, metalness: 0.04 });
  return mats;
}

function createKit(THREE, scene) {
  const mats = makeMats(THREE);
  const root = new THREE.Group();
  scene.add(root);

  function addBox(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    (parent || root).add(m);
    return m;
  }
  function addCyl(rt, rb, h, mat, x, y, z, parent, segs) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs || 12), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    (parent || root).add(m);
    return m;
  }
  function barHandle(x, y, z, horizontal, alongX) {
    if (horizontal) addBox(alongX ? 0.28 : 0.04, 0.035, alongX ? 0.04 : 0.28, mats.metal, x, y, z);
    else addBox(0.035, 0.28, 0.035, mats.metal, x, y, z);
  }
  function shakerFace(cx, cy, cz, w, h, axis, sign, drawer, mat) {
    const face = mat || mats.cream;
    const inset = mat === mats.sage ? mats.sageDark : mats.creamDark;
    const t = 0.045;
    const isX = axis === 'x';
    addBox(isX ? t : w, h, isX ? w : t, face, cx, cy, cz);
    const pw = Math.max(0.1, w - 0.2);
    const ph = Math.max(0.1, h - 0.2);
    addBox(isX ? t : pw, ph, isX ? pw : t, inset,
      cx + (isX ? sign * 0.02 : 0), cy, cz + (isX ? 0 : sign * 0.02));
    const hx = cx + (isX ? sign * 0.07 : (drawer ? 0 : -sign * w * 0.28));
    const hy = drawer ? cy : cy + 0.05;
    const hz = cz + (isX ? (drawer ? 0 : -sign * w * 0.28) : sign * 0.07);
    barHandle(hx, hy, hz, !!drawer, !isX);
  }
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
    root.add(g);
  }
  function burners(x, y, z) {
    [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]].forEach(function (p) {
      addCyl(0.16, 0.16, 0.04, mats.black, x + p[0], y, z + p[1]);
    });
  }
  function windowPane(x, y, z, w, h, alongZ, inwardSign) {
    const sign = inwardSign == null ? 1 : inwardSign;
    addBox(alongZ ? 0.05 : w, h, alongZ ? w : 0.05, mats.glass, x, y, z).castShadow = false;
    addBox(alongZ ? 0.1 : w + 0.22, h + 0.22, alongZ ? w + 0.22 : 0.1, mats.walnut, x, y, z).castShadow = false;
    addBox(alongZ ? 0.08 : 0.06, h, alongZ ? 0.06 : w, mats.walnut, x, y, z).castShadow = false;
    addBox(alongZ ? 0.08 : w, 0.06, alongZ ? w : 0.08, mats.walnut, x, y, z).castShadow = false;
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(alongZ ? h : w * 0.92, alongZ ? w * 0.92 : h),
      mats.glow
    );
    if (alongZ) {
      glow.rotation.y = Math.PI / 2;
      glow.position.set(x + sign * 0.12, y, z);
    } else {
      glow.position.set(x, y, z + sign * 0.12);
    }
    glow.castShadow = false;
    glow.receiveShadow = false;
    root.add(glow);
    const pl = new THREE.PointLight(0xfff3d6, 0.36, 11, 2);
    pl.position.set(
      alongZ ? x + sign * 1.1 : x,
      y - 0.3,
      alongZ ? z : z + sign * 1.1
    );
    scene.add(pl);
  }
  function roomShell(W, D, H, floorMat, wallMat, opts) {
    opts = opts || {};
    addBox(W + 0.4, 0.22, D + 0.4, floorMat || mats.floor, W / 2, -0.11, D / 2);
    const wall = wallMat || mats.wall;
    const T = 0.3;
    // back z=0, front z=D, left x=0, right x=W
    const backOpen = opts.backOpen;
    const frontOpen = opts.frontOpen;
    if (!opts.noBack) {
      if (backOpen) {
        addBox((backOpen[0] - 0), H, T, wall, backOpen[0] / 2, H / 2, 0);
        addBox((W - backOpen[1]), H, T, wall, (backOpen[1] + W) / 2, H / 2, 0);
        addBox(backOpen[1] - backOpen[0], H - 7.1, T, wall, (backOpen[0] + backOpen[1]) / 2, 7.1 + (H - 7.1) / 2, 0);
      } else {
        addBox(W + T, H, T, wall, W / 2, H / 2, 0);
      }
    }
    if (!opts.noFront) {
      addBox(W + T, H, T, wall, W / 2, H / 2, D);
    } else if (frontOpen) {
      addBox(frontOpen[0], H, T, wall, frontOpen[0] / 2, H / 2, D);
      addBox(W - frontOpen[1], H, T, wall, (frontOpen[1] + W) / 2, H / 2, D);
      addBox(frontOpen[1] - frontOpen[0], 1.2, T, wall, (frontOpen[0] + frontOpen[1]) / 2, H - 0.6, D);
    }
    addBox(T, H, D + T, wall, 0, H / 2, D / 2);
    addBox(T, H, D + T, wall, W, H / 2, D / 2);
    if (!opts.noCeiling) addBox(W + T, 0.18, D + T, mats.cream, W / 2, H, D / 2).castShadow = false;
    // baseboards
    addBox(W - 0.2, 0.38, 0.08, mats.base, W / 2, 0.19, 0.2);
    if (!opts.noFront) addBox(W - 0.2, 0.38, 0.08, mats.base, W / 2, 0.19, D - 0.2);
    addBox(0.08, 0.38, D - 0.2, mats.base, 0.2, 0.19, D / 2);
    addBox(0.08, 0.38, D - 0.2, mats.base, W - 0.2, 0.19, D / 2);
  }
  function drape(x, y, z, w, h, alongZ) {
    addBox(alongZ ? 0.12 : w, h, alongZ ? w : 0.12, mats.linen, x, y, z).castShadow = false;
  }

  const chairProto = (function () {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 1.15), mats.clothDark);
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
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  })();
  function placeChair(x, z, rotY, proto) {
    const c = (proto || chairProto).clone();
    c.position.set(x, 0, z);
    c.rotation.y = rotY;
    root.add(c);
    return c;
  }
  function upholsteredChairProto() {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.28, 1.35), mats.linen);
    seat.position.y = 1.45;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.7, 0.28), mats.linen);
    back.position.set(0, 2.2, -0.55);
    g.add(back);
    [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].forEach(function (p) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.32, 0.08), mats.walnutDark);
      leg.position.set(p[0], 0.66, p[1]);
      g.add(leg);
    });
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  function lightRoom(W, D, H, sunPos) {
    const hemi = new THREE.HemisphereLight(0xfff6e8, 0x6a5a44, 0.82);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d6, 1.32);
    const sp = sunPos || [W * 0.4, H + 8, D * 0.7];
    sun.position.set(sp[0], sp[1], sp[2]);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -4;
    sun.shadow.camera.right = W + 4;
    sun.shadow.camera.top = D + 4;
    sun.shadow.camera.bottom = -4;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 50;
    sun.shadow.bias = -0.00055;
    sun.shadow.normalBias = 0.04;
    sun.target.position.set(W / 2, 0, D / 2);
    scene.add(sun);
    scene.add(sun.target);
    const fill = new THREE.DirectionalLight(0xdde6f2, 0.32);
    fill.position.set(W * 0.2, H + 4, -6);
    scene.add(fill);
    const warm = new THREE.PointLight(0xffe4b8, 0.28, Math.max(W, D) + 8, 2);
    warm.position.set(W / 2, H - 1.2, D / 2);
    scene.add(warm);
    return sun;
  }

  return {
    THREE: THREE, mats: mats, root: root, scene: scene,
    addBox: addBox, addCyl: addCyl, barHandle: barHandle, shakerFace: shakerFace,
    faucet: faucet, burners: burners, windowPane: windowPane, roomShell: roomShell,
    drape: drape, placeChair: placeChair, chairProto: chairProto,
    upholsteredChairProto: upholsteredChairProto, lightRoom: lightRoom
  };
}

/* ---------------- Room builders ---------------- */
function buildKitchen(kit) {
  const W = 16, D = 16, H = 9.2;
  kit.roomShell(W, D, H, kit.mats.herring, kit.mats.wall, { backOpen: [6.3, 9.7], noFront: true });
  // Back-wall cabinets flanking the doorway
  kit.addBox(5.6, 8.4, 1.4, kit.mats.cream, 3.0, 4.2, 0.85);
  kit.addBox(5.6, 8.4, 1.4, kit.mats.cream, 13.0, 4.2, 0.85);
  kit.shakerFace(3.0, 2.0, 1.58, 2.4, 3.4, 'z', 1, false);
  kit.shakerFace(3.0, 6.2, 1.58, 2.4, 3.4, 'z', 1, false);
  kit.shakerFace(13.0, 2.0, 1.58, 2.4, 3.4, 'z', 1, false);
  kit.shakerFace(13.0, 6.2, 1.58, 2.4, 3.4, 'z', 1, false);

  function sideRun(isLeft) {
    const sign = isLeft ? 1 : -1;
    const x = isLeft ? 1.1 : 14.9;
    const faceX = isLeft ? 2.15 : 13.85;
    // Base cabinets + marble top along z
    kit.addBox(2.1, 3.0, 13.4, kit.mats.cream, x, 1.5, 7.6);
    kit.addBox(2.25, 0.12, 13.55, kit.mats.marble, x, 3.06, 7.6);
    // Farmhouse sink nearer the front (high z)
    const sinkZ = 11.4;
    kit.addBox(1.5, 0.55, 2.0, kit.mats.sink, x + sign * 0.25, 3.15, sinkZ);
    kit.faucet(x + sign * 0.05, 3.22, sinkZ, isLeft ? Math.PI / 2 : -Math.PI / 2);
    // Range further back
    const rangeZ = 8.6;
    kit.addBox(1.7, 3.05, 2.2, kit.mats.steel, x + sign * 0.1, 1.55, rangeZ);
    kit.addBox(1.55, 0.08, 2.05, kit.mats.black, x + sign * 0.15, 3.12, rangeZ);
    kit.addBox(isLeft ? 0.08 : 0.08, 1.4, 1.5, kit.mats.black, faceX - sign * 0.1, 1.5, rangeZ);
    kit.barHandle(faceX - sign * 0.02, 2.35, rangeZ, true, false);
    kit.burners(x + sign * 0.15, 3.18, rangeZ);
    // Hood
    kit.addBox(2.1, 1.8, 2.4, kit.mats.cream, x, 5.7, rangeZ);
    kit.addBox(1.4, 1.6, 1.5, kit.mats.creamDark, isLeft ? 0.85 : 15.15, 7.4, rangeZ);
    // Window over the sink
    kit.windowPane(isLeft ? -0.02 : 16.02, 5.2, sinkZ, 2.4, 3.2, true, isLeft ? 1 : -1);
    // Shaker doors along the run
    [3.6, 5.6, 11.0].forEach(function (z) {
      kit.shakerFace(faceX, 1.55, z, 1.6, 2.6, 'x', sign, false);
    });
    kit.shakerFace(faceX, 1.55, 14.0, 1.4, 2.6, 'x', sign, false);
    // Uppers (not over the window or hood)
    kit.addBox(1.15, 2.6, 2.2, kit.mats.cream, isLeft ? 0.7 : 15.3, 6.5, 5.6);
    kit.shakerFace(isLeft ? 1.3 : 14.7, 6.5, 5.6, 2.0, 2.3, 'x', sign, false);
    kit.addBox(1.15, 2.6, 2.0, kit.mats.cream, isLeft ? 0.7 : 15.3, 6.5, 14.0);
    kit.shakerFace(isLeft ? 1.3 : 14.7, 6.5, 14.0, 1.8, 2.3, 'x', sign, false);
  }
  sideRun(true);
  sideRun(false);

  // Pareve island, axis-aligned, centered, facing the camera
  kit.addBox(6.0, 3.0, 3.2, kit.mats.cream, 8, 1.5, 8.2);
  kit.addBox(6.25, 0.14, 3.4, kit.mats.marble, 8, 3.07, 8.2);
  [-1.8, 0, 1.8].forEach(function (dx) {
    [2.4, 1.55, 0.7].forEach(function (y) {
      kit.shakerFace(8 + dx, y, 9.84, 1.7, 0.7, 'z', 1, true);
    });
  });
  // Bowl of artichokes (simple)
  kit.addCyl(0.45, 0.4, 0.16, kit.mats.white, 8, 3.22, 8.2);
  kit.addCyl(0.12, 0.1, 0.28, kit.mats.plant, 7.85, 3.42, 8.1);
  kit.addCyl(0.12, 0.1, 0.28, kit.mats.plant, 8.15, 3.42, 8.3);
  kit.addCyl(0.12, 0.1, 0.28, kit.mats.plant, 8.0, 3.42, 8.05);

  function brassDome(x, z) {
    const rod = kit.addCyl(0.025, 0.025, 2.6, kit.mats.metal, x, 7.5, z);
    rod.castShadow = false;
    const shade = new kit.THREE.Mesh(
      new kit.THREE.SphereGeometry(0.48, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      kit.mats.metal
    );
    shade.position.set(x, 6.15, z);
    shade.castShadow = true;
    kit.root.add(shade);
    const bulb = kit.addCyl(0.08, 0.08, 0.08, kit.mats.bulb, x, 6.05, z);
    bulb.castShadow = false;
    const pl = new kit.THREE.PointLight(0xffe4b8, 0.28, 8, 2);
    pl.position.set(x, 5.9, z);
    kit.scene.add(pl);
  }
  brassDome(6.4, 8.2);
  brassDome(9.6, 8.2);

  const sun = kit.lightRoom(W, D, H, [8, 14, 18]);
  return { camera: [8, 6.3, 21.5], target: [8, 3.2, 8.0], min: 6, max: 28, sun: sun, size: [W, D, H] };
}

function buildDiningShabbos(kit) {
  const W = 20, D = 15, H = 10;
  kit.roomShell(W, D, H, kit.mats.floor, kit.mats.wall, { noFront: true });
  // Dark wainscot
  kit.addBox(W - 0.3, 3.0, 0.08, kit.mats.wainscot, W / 2, 1.5, 0.22);
  kit.addBox(0.08, 3.0, D - 0.3, kit.mats.wainscot, 0.22, 1.5, D / 2);
  kit.addBox(0.08, 3.0, D - 0.3, kit.mats.wainscot, W - 0.22, 1.5, D / 2);
  kit.addBox(12.5, 0.06, 9.2, kit.mats.oriental, 10, 0.04, 8.0);
  // Sideboard on the back wall
  kit.addBox(8.0, 2.8, 1.5, kit.mats.walnut, 7.2, 1.4, 1.0);
  kit.shakerFace(5.6, 1.3, 1.78, 2.4, 2.2, 'z', 1, false);
  kit.shakerFace(8.8, 1.3, 1.78, 2.4, 2.2, 'z', 1, false);
  kit.addCyl(0.22, 0.28, 0.7, kit.mats.basket, 4.8, 3.15, 1.0);
  kit.addCyl(0.08, 0.05, 1.1, kit.mats.plant, 4.8, 3.85, 1.0);
  // Windows on the right wall
  kit.windowPane(20.02, 5.4, 6.2, 2.6, 3.4, true, -1);
  kit.windowPane(20.02, 5.4, 11.2, 2.6, 3.4, true, -1);
  kit.drape(19.7, 5.5, 4.6, 0.7, 7.2, true);
  kit.drape(19.7, 5.5, 7.8, 0.7, 7.2, true);
  kit.drape(19.7, 5.5, 9.6, 0.7, 7.2, true);
  kit.drape(19.7, 5.5, 12.8, 0.7, 7.2, true);
  // Table + cloth
  kit.addBox(11.2, 0.7, 3.2, kit.mats.walnutDark, 10, 2.05, 8.0);
  kit.addBox(12.0, 0.16, 4.0, kit.mats.walnut, 10, 2.48, 8.0);
  kit.addBox(12.3, 0.05, 4.3, kit.mats.linenSoft, 10, 2.58, 8.0);
  [[16.4, 6.5], [16.4, 9.5], [3.6, 6.5], [3.6, 9.5]].forEach(function (p) {
    kit.addBox(0.18, 2.0, 0.18, kit.mats.walnut, p[0], 1.0, p[1]);
  });
  [5.2, 7.2, 9.2, 11.2, 13.2].forEach(function (x) {
    kit.placeChair(x, 5.4, 0);
    kit.placeChair(x, 10.6, Math.PI);
  });
  kit.placeChair(3.5, 8.0, Math.PI / 2);
  kit.placeChair(16.5, 8.0, -Math.PI / 2);
  // Candlesticks + challah
  [-0.6, 0, 0.6].forEach(function (dx, i) {
    kit.addCyl(0.05, 0.07, 0.7, kit.mats.metal, 9.2 + dx, 2.98, 8.0);
    kit.addCyl(0.02, 0.02, 0.35, kit.mats.linenSoft, 9.2 + dx, 3.48, 8.0);
    const flame = kit.addCyl(0.03, 0.01, 0.08, kit.mats.bulb, 9.2 + dx, 3.68, 8.0);
    flame.castShadow = false;
  });
  kit.addCyl(0.45, 0.4, 0.18, kit.mats.oak, 11.3, 2.72, 8.0);
  kit.addCyl(0.18, 0.16, 0.22, kit.mats.oak, 11.15, 2.9, 8.05);
  kit.addCyl(0.18, 0.16, 0.22, kit.mats.oak, 11.45, 2.9, 7.95);
  // Chandelier
  kit.addCyl(0.03, 0.03, 2.2, kit.mats.metal, 10, 8.8, 8.0);
  kit.addCyl(0.18, 0.22, 0.3, kit.mats.metal, 10, 7.65, 8.0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = 10 + Math.cos(a) * 0.9, z = 8 + Math.sin(a) * 0.9;
    kit.addCyl(0.025, 0.025, 0.5, kit.mats.metal, (10 + x) / 2, 7.55, (8 + z) / 2).rotation.z = Math.cos(a) * 0.4;
    const shade = new kit.THREE.Mesh(new kit.THREE.CylinderGeometry(0.12, 0.22, 0.28, 10, 1, true), kit.mats.shade);
    shade.position.set(x, 7.2, z);
    shade.castShadow = false;
    kit.root.add(shade);
    kit.addCyl(0.05, 0.05, 0.06, kit.mats.bulb, x, 7.1, z).castShadow = false;
  }
  const pl = new kit.THREE.PointLight(0xffe4b8, 0.45, 14, 2);
  pl.position.set(10, 7.0, 8);
  kit.scene.add(pl);
  const sun = kit.lightRoom(W, D, H, [18, 14, 12]);
  return { camera: [10, 6.2, 20.5], target: [10, 3.0, 7.5], min: 6, max: 28, sun: sun, size: [W, D, H] };
}

function buildDiningYomTov(kit) {
  const W = 24, D = 16, H = 10.2;
  kit.roomShell(W, D, H, kit.mats.herring, kit.mats.wall, { noFront: true });
  kit.addBox(16.5, 0.06, 10.5, kit.mats.rug, 13, 0.04, 8.6);
  // China cabinet left
  kit.addBox(4.4, 8.2, 1.6, kit.mats.cream, 3.2, 4.1, 1.05);
  kit.addBox(3.8, 5.2, 0.08, kit.mats.glass, 3.2, 5.4, 1.88).castShadow = false;
  kit.shakerFace(3.2, 1.4, 1.88, 3.6, 2.4, 'z', 1, true);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      kit.addCyl(0.16, 0.14, 0.06, kit.mats.white, 2.2 + c * 0.85, 3.6 + r * 1.15, 1.35);
    }
  }
  // Sideboard + mirror right
  kit.addBox(6.0, 2.6, 1.5, kit.mats.walnut, 19.2, 1.3, 1.0);
  kit.addBox(3.2, 2.6, 0.08, kit.mats.metal, 19.2, 5.4, 0.28);
  kit.addBox(2.8, 2.2, 0.04, kit.mats.glass, 19.2, 5.4, 0.34).castShadow = false;
  kit.windowPane(12.5, 5.6, -0.02, 3.0, 3.6, false, 1);
  kit.windowPane(16.6, 5.6, -0.02, 3.0, 3.6, false, 1);
  kit.drape(10.6, 5.5, 0.35, 0.7, 7.4, false);
  kit.drape(14.55, 5.5, 0.35, 0.55, 7.4, false);
  kit.drape(18.5, 5.5, 0.35, 0.7, 7.4, false);
  // Long table
  kit.addBox(15.2, 0.7, 3.2, kit.mats.walnutDark, 13, 2.05, 8.6);
  kit.addBox(16.0, 0.16, 4.0, kit.mats.walnut, 13, 2.48, 8.6);
  kit.addBox(16.3, 0.05, 4.3, kit.mats.linenSoft, 13, 2.58, 8.6);
  const proto = kit.upholsteredChairProto();
  [6.2, 8.2, 10.2, 12.2, 14.2, 16.2, 18.2].forEach(function (x) {
    kit.placeChair(x, 5.85, 0, proto);
    kit.placeChair(x, 11.35, Math.PI, proto);
  });
  kit.placeChair(4.4, 8.6, Math.PI / 2, proto);
  kit.placeChair(21.6, 8.6, -Math.PI / 2, proto);
  // Centerpiece
  kit.addCyl(0.55, 0.45, 0.2, kit.mats.white, 13, 2.72, 8.6);
  kit.addCyl(0.12, 0.1, 0.4, kit.mats.plant, 13, 3.0, 8.6);
  kit.addCyl(0.1, 0.08, 0.35, kit.mats.linenSoft, 13.25, 2.98, 8.45);
  kit.addCyl(0.1, 0.08, 0.35, kit.mats.linenSoft, 12.75, 2.98, 8.75);
  function crystal(x, z) {
    kit.addCyl(0.025, 0.025, 2.4, kit.mats.metal, x, 8.9, z);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = x + Math.cos(a) * 0.7, pz = z + Math.sin(a) * 0.7;
      const drop = kit.addCyl(0.04, 0.02, 0.55, kit.mats.glass, px, 7.15, pz);
      drop.castShadow = false;
    }
    kit.addCyl(0.22, 0.28, 0.35, kit.mats.metal, x, 7.55, z);
    const pl = new kit.THREE.PointLight(0xfff4dc, 0.32, 10, 2);
    pl.position.set(x, 7.1, z);
    kit.scene.add(pl);
  }
  crystal(10.2, 8.6);
  crystal(15.8, 8.6);
  const sun = kit.lightRoom(W, D, H, [13, 15, 18]);
  return { camera: [13, 6.4, 22.0], target: [13, 3.1, 8.0], min: 7, max: 32, sun: sun, size: [W, D, H] };
}

function buildBedroom(kit) {
  const W = 16, D = 14, H = 9;
  kit.roomShell(W, D, H, kit.mats.floor, kit.mats.wallGreige, { noFront: true });
  kit.addBox(11.0, 0.06, 8.2, kit.mats.rug, 7.2, 0.04, 7.4);
  function bed(x, z) {
    kit.addBox(3.4, 0.9, 6.6, kit.mats.linen, x, 0.7, z);
    kit.addBox(3.5, 0.22, 6.5, kit.mats.linenSoft, x, 1.2, z);
    kit.addBox(3.4, 2.0, 0.28, kit.mats.linen, x, 2.0, z - 3.2);
    kit.addBox(1.4, 0.28, 1.1, kit.mats.linenSoft, x - 0.55, 1.5, z - 2.4);
    kit.addBox(1.4, 0.28, 1.1, kit.mats.linenSoft, x + 0.55, 1.5, z - 2.4);
  }
  bed(3.6, 5.6);
  bed(10.0, 5.6);
  // Nightstand between the two beds
  kit.addBox(1.6, 1.6, 1.4, kit.mats.walnut, 6.8, 0.8, 2.6);
  kit.shakerFace(6.8, 0.7, 3.32, 1.3, 0.7, 'z', 1, true);
  kit.addCyl(0.05, 0.06, 0.9, kit.mats.metal, 6.8, 2.05, 2.6);
  const shade = new kit.THREE.Mesh(new kit.THREE.CylinderGeometry(0.18, 0.28, 0.32, 12, 1, true), kit.mats.shade);
  shade.position.set(6.8, 2.6, 2.6);
  shade.castShadow = false;
  kit.root.add(shade);
  kit.addCyl(0.06, 0.06, 0.06, kit.mats.bulb, 6.8, 2.48, 2.6).castShadow = false;
  const lamp = new kit.THREE.PointLight(0xffe4b8, 0.22, 7, 2);
  lamp.position.set(6.8, 2.45, 2.6);
  kit.scene.add(lamp);
  // Picture
  kit.addBox(2.2, 1.7, 0.06, kit.mats.metal, 6.8, 5.2, 0.22);
  kit.addBox(1.9, 1.4, 0.04, kit.mats.linen, 6.8, 5.2, 0.26);
  // Bay window on the right
  kit.windowPane(16.02, 4.8, 7.0, 2.0, 3.6, true, -1);
  kit.windowPane(16.02, 4.8, 9.4, 2.0, 3.6, true, -1);
  kit.windowPane(16.02, 4.8, 11.8, 2.0, 3.6, true, -1);
  kit.drape(15.7, 5.0, 5.6, 0.6, 7.0, true);
  kit.drape(15.7, 5.0, 13.2, 0.6, 7.0, true);
  // Armchair + side table
  kit.addBox(2.2, 0.5, 2.2, kit.mats.linenSoft, 13.4, 0.85, 10.4);
  kit.addBox(2.2, 1.4, 0.4, kit.mats.linenSoft, 13.4, 1.5, 9.4);
  kit.addBox(0.4, 1.4, 2.2, kit.mats.linenSoft, 12.4, 1.5, 10.4);
  kit.addBox(0.4, 1.4, 2.2, kit.mats.linenSoft, 14.4, 1.5, 10.4);
  [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(function (p) {
    kit.addBox(0.12, 0.6, 0.12, kit.mats.walnut, 13.4 + p[0], 0.3, 10.4 + p[1]);
  });
  kit.addCyl(0.55, 0.55, 0.08, kit.mats.walnut, 13.4, 1.3, 8.4);
  kit.addCyl(0.18, 0.2, 0.22, kit.mats.plant, 13.4, 1.48, 8.4);
  const sun = kit.lightRoom(W, D, H, [18, 12, 12]);
  return { camera: [8.2, 5.6, 17.5], target: [8.4, 2.4, 6.2], min: 5, max: 24, sun: sun, size: [W, D, H] };
}

function buildKids(kit) {
  const W = 15, D = 12, H = 9;
  kit.roomShell(W, D, H, kit.mats.floor, kit.mats.wall, { noFront: true });
  // Floral right wall overlay
  const paper = kit.addBox(0.04, 8.4, 11.4, kit.mats.floral, 14.82, 4.5, 6);
  paper.castShadow = false;
  // Sage wainscot on left
  kit.addBox(0.08, 3.0, D - 0.4, kit.mats.sage, 0.24, 1.5, D / 2);
  kit.addBox(10.5, 0.06, 6.4, kit.mats.rug, 7.2, 0.04, 8.6);
  // Window left
  kit.windowPane(-0.02, 5.0, 8.6, 2.4, 3.4, true, 1);
  kit.drape(0.35, 5.2, 6.9, 0.5, 7.2, true);
  kit.drape(0.35, 5.2, 10.3, 0.5, 7.2, true);
  // Built-in bunk as an open frame along the back wall
  const bx = 8.4, bz = 3.3;
  // Left wardrobe
  kit.addBox(2.2, 6.8, 3.6, kit.mats.sage, 3.3, 3.4, bz);
  kit.shakerFace(3.3, 4.6, bz + 1.82, 1.8, 3.6, 'z', 1, false);
  kit.addBox(1.8, 1.0, 1.5, kit.mats.linenSoft, 3.3, 1.6, bz + 0.5);
  kit.addBox(1.4, 0.65, 1.1, kit.mats.basket, 3.3, 0.42, bz + 0.45);
  // Bunk: back + two sides + top fascia
  kit.addBox(7.2, 6.8, 0.28, kit.mats.sage, bx, 3.4, bz - 1.66);
  kit.addBox(0.32, 6.8, 3.6, kit.mats.sage, bx - 3.44, 3.4, bz);
  kit.addBox(0.32, 6.8, 3.6, kit.mats.sage, bx + 3.44, 3.4, bz);
  kit.addBox(7.2, 0.28, 3.6, kit.mats.sage, bx, 6.66, bz);
  // Drawer base
  kit.addBox(6.88, 1.45, 3.6, kit.mats.sage, bx, 0.72, bz);
  [-2.1, 0, 2.1].forEach(function (dx) {
    kit.addBox(1.9, 1.25, 0.08, kit.mats.oak, bx + dx, 0.72, bz + 1.82);
    kit.addCyl(0.05, 0.05, 0.04, kit.mats.metal, bx + dx, 1.05, bz + 1.88);
    kit.addCyl(0.05, 0.05, 0.04, kit.mats.metal, bx + dx, 0.42, bz + 1.88);
  });
  // Lower bunk
  kit.addBox(6.88, 0.16, 3.5, kit.mats.sageDark, bx, 1.55, bz);
  kit.addBox(6.6, 0.32, 3.2, kit.mats.linenSoft, bx, 1.8, bz + 0.05);
  kit.addBox(6.4, 0.12, 2.2, kit.mats.sage, bx, 2.0, bz + 0.25);
  kit.addBox(1.3, 0.22, 1.0, kit.mats.linenSoft, bx - 2.0, 2.12, bz - 0.6);
  // Upper bunk
  kit.addBox(6.88, 0.16, 3.5, kit.mats.sageDark, bx, 4.15, bz);
  kit.addBox(6.6, 0.32, 3.2, kit.mats.linenSoft, bx, 4.4, bz + 0.05);
  kit.addBox(6.4, 0.12, 2.2, kit.mats.sage, bx, 4.6, bz + 0.25);
  kit.addBox(1.3, 0.22, 1.0, kit.mats.linenSoft, bx - 2.0, 4.72, bz - 0.6);
  // Brass ladder at the left of the bunk opening
  kit.addCyl(0.045, 0.045, 4.6, kit.mats.metal, bx - 3.05, 3.1, bz + 1.7);
  kit.addCyl(0.045, 0.045, 4.6, kit.mats.metal, bx - 3.05, 3.1, bz + 0.55);
  for (let i = 0; i < 6; i++) {
    const r = kit.addCyl(0.035, 0.035, 1.15, kit.mats.metal, bx - 3.05, 1.15 + i * 0.7, bz + 1.12);
    r.rotation.x = Math.PI / 2;
  }
  // Upper safety rail
  const ur = kit.addCyl(0.04, 0.04, 6.2, kit.mats.metal, bx, 5.55, bz + 1.7);
  ur.rotation.z = Math.PI / 2;
  // Desk along the right wall, clear of the bunk
  kit.addBox(1.7, 0.12, 3.2, kit.mats.oak, 13.7, 2.4, 7.2);
  kit.addBox(1.7, 2.3, 3.2, kit.mats.sage, 13.7, 1.15, 7.2);
  kit.shakerFace(12.82, 1.15, 7.2, 2.6, 2.0, 'x', -1, true);
  // Chair facing the desk
  kit.addBox(1.3, 0.12, 1.3, kit.mats.oak, 11.7, 1.35, 7.2);
  kit.addBox(1.3, 0.16, 1.3, kit.mats.sage, 11.7, 1.48, 7.2);
  [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].forEach(function (p) {
    kit.addBox(0.1, 1.3, 0.1, kit.mats.oak, 11.7 + p[0], 0.65, 7.2 + p[1]);
  });
  kit.addBox(0.12, 1.1, 1.3, kit.mats.oak, 12.3, 2.05, 7.2);
  // Sconce on the right wall above the desk
  kit.addCyl(0.08, 0.1, 0.12, kit.mats.metal, 14.7, 5.2, 6.2);
  const sc = new kit.THREE.Mesh(new kit.THREE.CylinderGeometry(0.12, 0.22, 0.22, 10, 1, true), kit.mats.shade);
  sc.position.set(14.3, 5.2, 6.2);
  sc.rotation.z = Math.PI / 2;
  kit.root.add(sc);
  const sun = kit.lightRoom(W, D, H, [4, 12, 14]);
  return { camera: [7.4, 5.6, 16.2], target: [8.2, 3.0, 4.2], min: 5, max: 24, sun: sun, size: [W, D, H] };
}

function buildLiving(kit) {
  const W = 18, D = 14, H = 9.4;
  kit.roomShell(W, D, H, kit.mats.floor, kit.mats.wall, { noFront: true });
  kit.addBox(10.5, 0.06, 9.5, kit.mats.rug, 7.2, 0.04, 7.4);
  // Seforim wall on the right (x = W)
  kit.addBox(1.4, 8.6, 13.4, kit.mats.walnut, 17.25, 4.3, 7);
  kit.addBox(1.4, 2.4, 13.4, kit.mats.walnutDark, 17.25, 1.2, 7);
  for (let col = 0; col < 5; col++) {
    kit.addBox(0.12, 8.6, 0.12, kit.mats.walnutDark, 16.6, 4.3, 1.4 + col * 2.8);
  }
  for (let row = 0; row < 6; row++) {
    const y = 2.7 + row * 0.95;
    kit.addBox(1.2, 0.08, 13.2, kit.mats.walnutDark, 17.2, y, 7);
    for (let col = 0; col < 5; col++) {
      kit.addBox(0.62, 0.78, 2.4, kit.mats.books, 16.7, y + 0.46, 2.4 + col * 2.5);
    }
  }
  // Lower cabinet faces
  [2.2, 5.0, 7.8, 10.6, 13.4].forEach(function (z) {
    kit.shakerFace(16.52, 1.15, z, 2.2, 2.0, 'x', -1, false);
  });
  // Library ladder
  const lx = 14.6, lz = 8.6;
  kit.addCyl(0.04, 0.04, 7.4, kit.mats.metal, lx, 3.8, lz);
  kit.addCyl(0.04, 0.04, 7.4, kit.mats.metal, lx + 0.7, 3.8, lz);
  for (let i = 0; i < 8; i++) {
    const r = kit.addCyl(0.035, 0.035, 0.75, kit.mats.metal, lx + 0.35, 0.7 + i * 0.85, lz);
    r.rotation.z = Math.PI / 2;
  }
  const rail = kit.addCyl(0.03, 0.03, 12.5, kit.mats.metal, 16.4, 6.6, 7);
  rail.rotation.x = Math.PI / 2;
  // Sofa on the left
  kit.addBox(3.2, 0.55, 7.2, kit.mats.linen, 3.4, 0.85, 7.2);
  kit.addBox(0.45, 1.5, 7.2, kit.mats.linen, 2.0, 1.5, 7.2);
  kit.addBox(3.2, 1.5, 0.4, kit.mats.linen, 3.4, 1.5, 3.8);
  kit.addBox(3.2, 1.5, 0.4, kit.mats.linen, 3.4, 1.5, 10.6);
  kit.addBox(0.9, 0.55, 1.1, kit.mats.basket, 3.3, 1.4, 5.4);
  kit.addBox(0.9, 0.55, 1.1, kit.mats.linenSoft, 3.3, 1.4, 7.4);
  kit.addBox(0.9, 0.55, 1.1, kit.mats.burgundy, 3.3, 1.4, 9.2);
  // Coffee table
  kit.addCyl(1.3, 1.3, 0.12, kit.mats.walnut, 6.6, 1.2, 7.4);
  kit.addCyl(0.08, 0.1, 1.14, kit.mats.walnut, 6.6, 0.57, 7.4);
  kit.addCyl(0.18, 0.22, 0.3, kit.mats.basket, 6.2, 1.4, 7.4);
  // Window + lamp left
  kit.windowPane(-0.02, 5.0, 7.4, 3.0, 3.6, true, 1);
  kit.drape(0.35, 5.2, 5.4, 0.5, 7.4, true);
  kit.drape(0.35, 5.2, 9.4, 0.5, 7.4, true);
  kit.addCyl(0.22, 0.26, 0.08, kit.mats.metal, 2.2, 0.04, 11.4);
  kit.addCyl(0.03, 0.03, 5.2, kit.mats.metal, 2.2, 2.6, 11.4);
  const ls = new kit.THREE.Mesh(new kit.THREE.CylinderGeometry(0.18, 0.32, 0.4, 12, 1, true), kit.mats.shade);
  ls.position.set(2.2, 5.3, 11.4);
  kit.root.add(ls);
  const pl = new kit.THREE.PointLight(0xffe4b8, 0.25, 8, 2);
  pl.position.set(2.2, 5.1, 11.4);
  kit.scene.add(pl);
  const sun = kit.lightRoom(W, D, H, [4, 13, 16]);
  return { camera: [7.6, 5.5, 16.8], target: [9.2, 3.2, 7.2], min: 6, max: 26, sun: sun, size: [W, D, H] };
}

function buildFoyer(kit) {
  const W = 12, D = 14, H = 11;
  kit.roomShell(W, D, H, kit.mats.checker, kit.mats.wall, { noFront: true });
  // Arched door opening on the left (we'll place a door in a recess)
  kit.addBox(0.16, 7.6, 3.0, kit.mats.walnutDark, 0.22, 3.8, 4.2);
  kit.addBox(0.04, 6.6, 0.5, kit.mats.glass, 0.32, 4.0, 5.2).castShadow = false;
  kit.addBox(0.08, 1.4, 0.08, kit.mats.metal, 0.4, 3.7, 3.5);
  // Console, mirror, sconce on the back wall
  kit.addBox(3.2, 0.12, 1.1, kit.mats.walnut, 4.2, 2.4, 0.9);
  kit.addBox(3.0, 0.7, 1.0, kit.mats.walnut, 4.2, 2.0, 0.9);
  [[-1.3, -0.35], [1.3, -0.35], [-1.3, 0.35], [1.3, 0.35]].forEach(function (p) {
    kit.addCyl(0.05, 0.05, 1.9, kit.mats.walnut, 4.2 + p[0], 0.95, 0.9 + p[1]);
  });
  kit.addCyl(0.16, 0.2, 0.5, kit.mats.glass, 4.2, 2.75, 0.9).castShadow = false;
  kit.addCyl(0.08, 0.06, 0.7, kit.mats.plant, 4.2, 3.3, 0.9);
  kit.addCyl(0.08, 0.06, 0.55, kit.mats.linenSoft, 4.05, 3.25, 1.0);
  kit.addBox(1.5, 4.2, 0.08, kit.mats.metal, 4.2, 5.8, 0.22);
  kit.addBox(1.2, 3.8, 0.04, kit.mats.glass, 4.2, 5.8, 0.28).castShadow = false;
  // Sconce
  kit.addCyl(0.08, 0.1, 0.12, kit.mats.metal, 6.4, 6.2, 0.25);
  const sc = new kit.THREE.Mesh(new kit.THREE.CylinderGeometry(0.12, 0.2, 0.35, 12, 1, true), kit.mats.shade);
  sc.position.set(6.4, 6.55, 0.45);
  kit.root.add(sc);
  const sl = new kit.THREE.PointLight(0xffe4b8, 0.4, 8, 2);
  sl.position.set(6.4, 6.4, 1.0);
  kit.scene.add(sl);

  // Curved stair on the right, rising as it sweeps toward the back
  const cx = 9.4, cz = 8.2, r = 3.6, steps = 14;
  const startA = Math.PI * 0.95, arc = Math.PI * 0.85;
  for (let i = 0; i < steps; i++) {
    const a = startA + (i / (steps - 1)) * arc;
    const y = 0.1 + i * 0.58;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    const tread = kit.addBox(3.0, 0.14, 0.95, kit.mats.walnut, x, y, z);
    tread.rotation.y = -a + Math.PI / 2;
    const riser = kit.addBox(3.0, 0.58, 0.16, kit.mats.walnutDark, x, y - 0.3, z);
    riser.rotation.y = -a + Math.PI / 2;
    // Closed stringer under the outer half of each tread
    const sx = cx + Math.cos(a) * (r - 0.35);
    const sz = cz + Math.sin(a) * (r - 0.35);
    const stringer = kit.addBox(2.2, Math.max(0.4, y), 0.7, kit.mats.walnutDark, sx, y / 2, sz);
    stringer.rotation.y = -a + Math.PI / 2;
    // Banister posts on the outer edge
    const ox = cx + Math.cos(a) * (r + 1.35);
    const oz = cz + Math.sin(a) * (r + 1.35);
    if (i % 1 === 0) kit.addCyl(0.045, 0.045, 2.5, kit.mats.walnut, ox, y + 1.35, oz, kit.root, 8);
  }
  // Handrail as short segments
  for (let i = 0; i < steps - 1; i++) {
    const a0 = startA + (i / (steps - 1)) * arc;
    const a1 = startA + ((i + 1) / (steps - 1)) * arc;
    const y0 = 0.1 + i * 0.58 + 2.45;
    const y1 = 0.1 + (i + 1) * 0.58 + 2.45;
    const x0 = cx + Math.cos(a0) * (r + 1.35), z0 = cz + Math.sin(a0) * (r + 1.35);
    const x1 = cx + Math.cos(a1) * (r + 1.35), z1 = cz + Math.sin(a1) * (r + 1.35);
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const rail = kit.addCyl(0.05, 0.05, len, kit.mats.walnut, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, kit.root, 8);
    rail.lookAt(x1, y1, z1);
    rail.rotateX(Math.PI / 2);
  }
  const sun = kit.lightRoom(W, D, H, [6, 16, 16]);
  return { camera: [3.6, 6.0, 16.5], target: [7.0, 3.6, 5.8], min: 5, max: 24, sun: sun, size: [W, D, H] };
}

function buildMudroom(kit) {
  const W = 14, D = 11, H = 9;
  kit.roomShell(W, D, H, kit.mats.herring, kit.mats.wallGrey, { noFront: true });
  kit.addBox(6.5, 0.05, 2.4, kit.mats.oriental, 4.2, 0.04, 5.6);
  // Door + sidelight on the left
  kit.addBox(0.16, 7.4, 3.0, kit.mats.walnutDark, 0.22, 3.7, 5.6);
  kit.addBox(0.04, 6.2, 1.0, kit.mats.glass, 0.18, 4.2, 3.4).castShadow = false;
  kit.windowPane(-0.02, 5.2, 3.4, 1.2, 3.2, true, 1);
  kit.addCyl(0.06, 0.06, 0.06, kit.mats.metal, 0.4, 3.6, 5.0);
  // Storage wall along x = W (right), running most of the depth
  const wallX = 11.6;
  // Tall cabinets at back (low z) and front (high z)
  kit.addBox(2.4, 8.4, 2.2, kit.mats.cream, wallX, 4.2, 1.4);
  kit.shakerFace(wallX - 1.22, 4.2, 1.4, 1.8, 7.6, 'x', -1, false);
  kit.addBox(2.4, 8.4, 2.6, kit.mats.cream, wallX, 4.2, 9.4);
  kit.shakerFace(wallX - 1.22, 4.2, 8.6, 1.4, 7.6, 'x', -1, false);
  kit.shakerFace(wallX - 1.22, 4.2, 10.2, 1.4, 7.6, 'x', -1, false);
  // Recessed mid bay: back panel, sides already formed by the tall cabinets
  kit.addBox(0.2, 8.4, 5.2, kit.mats.cream, wallX + 1.05, 4.2, 5.2);
  kit.addBox(2.2, 0.2, 5.2, kit.mats.cream, wallX, 8.3, 5.2);
  // Upper cubbies, sitting in the recess (in front of the back panel)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 2; r++) {
      kit.addBox(1.6, 0.08, 1.2, kit.mats.cream, wallX + 0.15, 6.15 + r * 1.2, 3.35 + c * 1.25);
      kit.addBox(1.15, 0.85, 1.0, kit.mats.basket, wallX + 0.1, 5.7 + r * 1.2, 3.35 + c * 1.25);
    }
  }
  kit.addBox(1.8, 0.1, 5.2, kit.mats.cream, wallX, 5.55, 5.2);
  // Hooks + coats
  [3.5, 4.4, 5.3, 6.2, 7.1].forEach(function (z, i) {
    kit.addCyl(0.04, 0.04, 0.16, kit.mats.metal, wallX - 1.15, 4.7, z);
    if (i < 3) {
      const mat = [kit.mats.coatA, kit.mats.coatB, kit.mats.coatC][i];
      kit.addBox(0.22, 2.6, 0.7, mat, wallX - 1.28, 3.25, z);
    }
  });
  // Bench
  kit.addBox(2.5, 0.12, 5.2, kit.mats.oak, wallX - 0.1, 1.7, 5.2);
  kit.addBox(1.8, 0.16, 3.2, kit.mats.linenSoft, wallX - 0.3, 1.86, 5.8);
  // Shoe cubby
  kit.addBox(1.6, 1.2, 1.6, kit.mats.creamDark, wallX - 0.2, 0.7, 3.6);
  kit.addBox(0.7, 0.22, 0.4, kit.mats.black, wallX - 0.4, 0.4, 3.4);
  kit.addBox(0.7, 0.22, 0.4, kit.mats.basket, wallX - 0.4, 0.4, 3.85);
  // Lower doors
  [4.6, 6.2, 7.8].forEach(function (z) {
    kit.shakerFace(wallX - 1.22, 0.85, z, 1.4, 1.4, 'x', -1, true);
  });
  const sun = kit.lightRoom(W, D, H, [4, 12, 12]);
  return { camera: [5.2, 5.8, 15.6], target: [9.4, 3.8, 5.6], min: 5, max: 22, sun: sun, size: [W, D, H] };
}

function buildStudy(kit) {
  const W = 14, D = 12, H = 9.2;
  kit.roomShell(W, D, H, kit.mats.floor, kit.mats.wall, { noFront: true });
  kit.addBox(8.5, 0.06, 7.5, kit.mats.rug, 6.4, 0.04, 6.5);
  // Seforim wall along the right
  kit.addBox(1.2, 8.2, 11.2, kit.mats.walnut, 13.35, 4.1, 6);
  for (let row = 0; row < 7; row++) {
    const y = 0.7 + row * 1.05;
    kit.addBox(1.15, 0.08, 11.0, kit.mats.walnutDark, 13.3, y, 6);
    kit.addBox(0.62, 0.85, 3.4, kit.mats.books, 12.85, y + 0.5, 2.8);
    kit.addBox(0.56, 0.85, 3.4, kit.mats.books, 12.88, y + 0.5, 6.2);
    kit.addBox(0.66, 0.85, 3.4, kit.mats.books, 12.82, y + 0.5, 9.4);
  }
  // Desk facing the books, chair
  kit.addBox(5.0, 2.4, 2.4, kit.mats.walnut, 7.2, 1.2, 5.4);
  kit.addBox(5.1, 0.1, 2.5, kit.mats.walnutDark, 7.2, 2.45, 5.4);
  kit.placeChair(7.2, 7.2, Math.PI);
  kit.addCyl(0.03, 0.03, 0.7, kit.mats.metal, 8.6, 2.85, 4.8);
  const shade = new kit.THREE.Mesh(new kit.THREE.CylinderGeometry(0.12, 0.22, 0.2, 10, 1, true), kit.mats.shade);
  shade.position.set(8.6, 3.25, 4.8);
  kit.root.add(shade);
  const pl = new kit.THREE.PointLight(0xffe4b8, 0.28, 7, 2);
  pl.position.set(8.6, 3.15, 4.8);
  kit.scene.add(pl);
  kit.windowPane(-0.02, 5.0, 6, 3.0, 3.4, true, 1);
  kit.drape(0.35, 5.2, 4.2, 0.5, 7.2, true);
  kit.drape(0.35, 5.2, 7.8, 0.5, 7.2, true);
  // Lounge chair
  kit.addBox(2.2, 0.45, 2.2, kit.mats.linen, 3.2, 0.85, 9.4);
  kit.addBox(2.2, 1.4, 0.4, kit.mats.linen, 3.2, 1.5, 10.3);
  const sun = kit.lightRoom(W, D, H, [4, 13, 14]);
  return { camera: [5.4, 5.8, 15.6], target: [9.2, 3.0, 5.8], min: 5, max: 22, sun: sun, size: [W, D, H] };
}

const BUILDERS = {
  kitchen: buildKitchen,
  'dining-shabbos': buildDiningShabbos,
  'dining-yomtov': buildDiningYomTov,
  bedroom: buildBedroom,
  kids: buildKids,
  living: buildLiving,
  foyer: buildFoyer,
  mudroom: buildMudroom,
  study: buildStudy
};

/* ---------------- Viewer / modal ---------------- */
let THREE, OrbitControls;
let renderer, camera, controls, scene, raf = 0, visible = false, booting = false;
let currentId = null;

function els() {
  return {
    modal: document.getElementById('roomModal'),
    title: document.getElementById('roomModalTitle'),
    stage: document.getElementById('roomStage'),
    canvas: document.getElementById('roomCanvas'),
    loading: document.getElementById('roomLoading'),
    fallback: document.getElementById('roomFallback')
  };
}

function otherLocksOpen() {
  const pm = document.getElementById('projectModal');
  const lb = document.getElementById('lightbox');
  return (pm && !pm.hidden) || (lb && !lb.hidden);
}
function setLock(on) {
  if (on) {
    document.body.classList.add('locked');
    if (window.__zcLenis && typeof window.__zcLenis.stop === 'function') window.__zcLenis.stop();
  } else if (!otherLocksOpen()) {
    document.body.classList.remove('locked');
    if (window.__zcLenis && typeof window.__zcLenis.start === 'function') window.__zcLenis.start();
  }
}

function disposeScene(sc) {
  if (!sc) return;
  sc.traverse(function (o) {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(function (m) {
        if (!m) return;
        ['map', 'bumpMap', 'roughnessMap', 'normalMap'].forEach(function (k) {
          if (m[k] && m[k].dispose) m[k].dispose();
        });
        m.dispose();
      });
    }
  });
}

function showFallback() {
  const e = els();
  if (e.loading) e.loading.hidden = true;
  if (e.fallback) e.fallback.hidden = false;
  if (e.stage) e.stage.classList.add('is-failed');
}

function resize() {
  const e = els();
  if (!renderer || !camera || !e.stage) return;
  const w = e.stage.clientWidth, h = Math.max(1, e.stage.clientHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function tick() {
  raf = requestAnimationFrame(tick);
  if (!visible || !renderer || !scene || !camera) return;
  if (controls) controls.update();
  renderer.render(scene, camera);
}

async function ensureEngine() {
  if (renderer) return true;
  const e = els();
  if (!hasWebGL() || !supportsImportMap()) {
    showFallback();
    return false;
  }
  if (e.loading) e.loading.hidden = false;
  if (!THREE) {
    THREE = await import('three');
    ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
  }
  const mobile = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
  renderer = new THREE.WebGLRenderer({
    canvas: e.canvas,
    antialias: !mobile,
    alpha: false,
    powerPreference: 'default'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75));
  renderer.setSize(e.stage.clientWidth, Math.max(1, e.stage.clientHeight), false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  if (window.ResizeObserver) new ResizeObserver(resize).observe(e.stage);
  else window.addEventListener('resize', resize);
  return true;
}

function mountRoom(id) {
  const e = els();
  const build = BUILDERS[id];
  if (!build) return;
  if (scene) disposeScene(scene);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8dcc8);
  const kit = createKit(THREE, scene);
  const info = build(kit);
  const mobile = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
  if (mobile && info.sun) info.sun.shadow.mapSize.set(1024, 1024);
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const aspect = e.stage.clientWidth / Math.max(1, e.stage.clientHeight);
  camera = new THREE.PerspectiveCamera(aspect < 0.85 ? 52 : 42, aspect, 0.15, 80);
  camera.position.set(info.camera[0], info.camera[1], info.camera[2]);
  controls = new OrbitControls(camera, e.canvas);
  controls.target.set(info.target[0], info.target[1], info.target[2]);
  controls.enableDamping = !reduced;
  controls.dampingFactor = 0.08;
  controls.minDistance = info.min || 4;
  controls.maxDistance = info.max || 24;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.enablePan = !mobile;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.update();
  if (e.stage) {
    e.stage.classList.add('is-ready');
    e.stage.classList.remove('is-failed');
  }
  if (e.loading) e.loading.hidden = true;
  if (e.fallback) e.fallback.hidden = true;
  visible = true;
  if (!raf) raf = requestAnimationFrame(tick);
  // first frame
  renderer.render(scene, camera);
}

function roomViewerEnabled() {
  const C = window.SITE_CONFIG || {};
  return !!(C.roomViewer || (document.documentElement && document.documentElement.classList.contains('room-viewer-on')));
}

async function openRoom(id) {
  if (!roomViewerEnabled()) return;
  if (!BUILDERS[id]) return;
  const e = els();
  if (!e.modal || !e.stage || !e.canvas) return;
  currentId = id;
  if (e.title) e.title.textContent = ROOM_TITLES[id] || 'Room in 3D';
  e.modal.hidden = false;
  setLock(true);
  requestAnimationFrame(function () { e.modal.classList.add('open'); });
  const closeBtn = e.modal.querySelector('.room-modal-close');
  if (closeBtn) closeBtn.focus();
  if (e.loading) e.loading.hidden = false;
  e.stage.classList.remove('is-ready');
  try {
    const ok = await ensureEngine();
    if (!ok || currentId !== id) return;
    mountRoom(id);
    resize();
  } catch (err) {
    showFallback();
  }
}

function closeRoom() {
  const e = els();
  if (!e.modal || e.modal.hidden) return;
  e.modal.classList.remove('open');
  visible = false;
  setTimeout(function () {
    if (!e.modal.classList.contains('open')) e.modal.hidden = true;
  }, 280);
  setLock(false);
  currentId = null;
}

function onKey(ev) {
  const e = els();
  if (!e.modal || e.modal.hidden) return;
  if (ev.key === 'Escape') {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    closeRoom();
  }
}

function init() {
  const e = els();
  if (!e.modal) return;
  e.modal.querySelectorAll('[data-room-close]').forEach(function (b) {
    b.addEventListener('click', closeRoom);
  });
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest && ev.target.closest('[data-room]');
    if (!btn) return;
    const id = btn.getAttribute('data-room');
    if (!BUILDERS[id]) return;
    ev.preventDefault();
    ev.stopPropagation();
    openRoom(id);
  });
  document.addEventListener('zc:open-room', function (ev) {
    if (ev.detail) openRoom(ev.detail);
  });
  window.ZCRooms = {
    open: openRoom,
    close: closeRoom,
    idFromSrc: idFromSrc,
    ids: Object.keys(BUILDERS)
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
