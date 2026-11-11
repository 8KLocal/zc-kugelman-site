/* Per-room 3D viewer. Lazy-loads three.js. Feature-flagged via SITE_CONFIG.roomViewer. */
const ROOM_SRC = {
  kitchen: ['kosher-kitchen.jpg', 'park-slope-family-kitchen/photos/01-kitchen.jpg'],
  'dining-yomtov': ['yom-tov-dining.jpg', 'park-slope-family-kitchen/photos/02-dining.jpg'],
  'dining-shabbos': ['shabbos-dining.jpg', 'midwood-shabbos-dining/photos/02-dining-room.jpg', 'midwood-shabbos-dining/photos/hero.jpg'],
  bedroom: ['primary-bedroom.jpg', 'sample-flatbush-family-home/photos/03-primary-suite.jpg'],
  kids: ['kids-bunk-room.jpg', 'sample-flatbush-family-home/photos/04-children-room.jpg'],
  living: ['seforim-living-room.jpg', 'sample-flatbush-family-home/photos/02-living-library.jpg'],
  foyer: ['brownstone-foyer.jpg', 'sample-flatbush-family-home/photos/01-entry-stair.jpg'],
  mudroom: ['mudroom-entry-storage.jpg']
};
const ROOM_TITLES = {
  kitchen: 'Kosher kitchen in 3D',
  'dining-yomtov': 'Yom Tov dining in 3D',
  'dining-shabbos': 'Shabbos dining in 3D',
  bedroom: 'Primary bedroom in 3D',
  kids: "Children's room in 3D",
  living: 'Seforim living room in 3D',
  foyer: 'Brownstone foyer in 3D',
  mudroom: 'Mudroom in 3D',
  study: 'Study in 3D'
};

function idFromSrc(src) {
  if (!src) return null;
  const s = String(src).replace(/\\/g, '/');
  const keys = Object.keys(ROOM_SRC);
  for (let i = 0; i < keys.length; i++) {
    const id = keys[i];
    const list = ROOM_SRC[id];
    for (let j = 0; j < list.length; j++) {
      if (s.endsWith(list[j])) return id;
    }
  }
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

function makeCanvasTexture(THREE, draw, size, repeatX, repeatZ, linear) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX || 1, repeatZ || 1);
  t.colorSpace = linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function woodColor(ctx, s) {
  ctx.fillStyle = '#6a4328';
  ctx.fillRect(0, 0, s, s);
  const plank = s / 8;
  for (let i = 0; i < 8; i++) {
    const shade = (i % 3 === 0) ? 0 : (i % 3 === 1) ? 8 : -6;
    ctx.fillStyle = `rgba(${90 + shade},${58 + shade},${28},0.35)`;
    ctx.fillRect(0, i * plank, s, plank - 1);
    ctx.fillStyle = 'rgba(40,22,10,0.28)';
    ctx.fillRect(0, (i + 1) * plank - 1, s, 1);
  }
  for (let i = 0; i < 80; i++) {
    const y = Math.random() * s;
    ctx.strokeStyle = `rgba(40,22,10,${0.08 + Math.random() * 0.12})`;
    ctx.lineWidth = 0.6 + Math.random();
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(s * 0.3, y + (Math.random() - 0.5) * 8, s * 0.7, y + (Math.random() - 0.5) * 8, s, y + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = `rgba(30,16,8,${0.08 + Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * s, Math.random() * s, 2 + Math.random() * 4, 0.8, Math.random() * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function woodRough(ctx, s) {
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${0.1 + Math.random() * 0.18})`;
    ctx.lineWidth = 1;
    const y = Math.random() * s;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(s, y + (Math.random() - 0.5) * 5);
    ctx.stroke();
  }
}

function herringColor(ctx, s) {
  const cols2 = ['#c4a06a', '#b89560', '#c8a878', '#ad8c58', '#d0aa74'];
  ctx.fillStyle = '#b89560';
  ctx.fillRect(0, 0, s, s);
  const w = s / 8, h = s / 4;
  for (let y = -1; y < 9; y++) {
    for (let x = -1; x < 10; x++) {
      const flip = (x + y) % 2 === 0;
      ctx.fillStyle = cols2[(x + y * 3 + 8) % cols2.length];
      ctx.save();
      ctx.translate((x + (y % 2) * 0.5) * w, y * (h / 2));
      ctx.rotate(flip ? Math.PI / 4 : -Math.PI / 4);
      ctx.fillRect(-w * 0.7, -h * 0.18, w * 1.4, h * 0.32);
      ctx.strokeStyle = 'rgba(70,45,20,0.18)';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(-w * 0.7, -h * 0.18, w * 1.4, h * 0.32);
      ctx.restore();
    }
  }
}

function plasterColor(ctx, s) {
  ctx.fillStyle = '#efe6d4';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 1800; i++) {
    const v = 220 + Math.random() * 28;
    ctx.fillStyle = `rgba(${v},${v - 8},${v - 22},${0.08 + Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
}

function plasterBump(ctx, s) {
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 1600; i++) {
    const v = 110 + Math.random() * 40;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
}

function marbleColor(ctx, s) {
  ctx.fillStyle = '#f4f0ea';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = `rgba(150,145,138,${0.12 + Math.random() * 0.18})`;
    ctx.lineWidth = 0.8 + Math.random() * 1.8;
    ctx.beginPath();
    let x = Math.random() * s, y = 0;
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (Math.random() - 0.48) * 50;
      y += s / 8;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = `rgba(120,110,100,${0.08 + Math.random() * 0.1})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(Math.random() * s, 0);
    ctx.bezierCurveTo(Math.random() * s, s * 0.4, Math.random() * s, s * 0.7, Math.random() * s, s);
    ctx.stroke();
  }
}

function checkerColor(ctx, s) {
  const n = 4, t = s / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const light = (x + y) % 2 === 0;
      ctx.fillStyle = light ? '#efeae2' : '#2a2a2a';
      ctx.fillRect(x * t, y * t, t, t);
      // subtle veins on each tile
      ctx.save();
      ctx.beginPath();
      ctx.rect(x * t, y * t, t, t);
      ctx.clip();
      ctx.strokeStyle = light ? 'rgba(160,150,140,0.25)' : 'rgba(80,80,80,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x * t, y * t + t * 0.3);
      ctx.bezierCurveTo(x * t + t * 0.4, y * t, x * t + t * 0.6, y * t + t, x * t + t, y * t + t * 0.6);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function rugColor(ctx, s) {
  ctx.fillStyle = '#6b1d2a';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = '#c9a36a';
  ctx.lineWidth = s * 0.045;
  ctx.strokeRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88);
  ctx.lineWidth = s * 0.012;
  ctx.strokeRect(s * 0.12, s * 0.12, s * 0.76, s * 0.76);
  ctx.strokeStyle = '#1e3d32';
  ctx.lineWidth = s * 0.02;
  ctx.strokeRect(s * 0.16, s * 0.16, s * 0.68, s * 0.68);
  // field pattern
  ctx.fillStyle = 'rgba(201,163,106,0.28)';
  const step = s / 10;
  for (let y = 2; y < 8; y++) {
    for (let x = 2; x < 8; x++) {
      ctx.beginPath();
      ctx.moveTo((x + 0.5) * step, y * step + 4);
      ctx.lineTo((x + 0.7) * step, (y + 0.5) * step);
      ctx.lineTo((x + 0.5) * step, (y + 1) * step - 4);
      ctx.lineTo((x + 0.3) * step, (y + 0.5) * step);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function orientalColor(ctx, s) {
  ctx.fillStyle = '#5c1a24';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = '#d4b07a';
  ctx.lineWidth = s * 0.06;
  ctx.strokeRect(s * 0.05, s * 0.05, s * 0.9, s * 0.9);
  ctx.strokeStyle = '#1e3d32';
  ctx.lineWidth = s * 0.018;
  ctx.strokeRect(s * 0.14, s * 0.14, s * 0.72, s * 0.72);
  ctx.fillStyle = '#7a2a36';
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.22);
  ctx.lineTo(s * 0.78, s * 0.5);
  ctx.lineTo(s * 0.5, s * 0.78);
  ctx.lineTo(s * 0.22, s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d4b07a';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function bookColor(ctx, s) {
  const palette = ['#6b1d2a', '#1e3d32', '#3d2b1f', '#4a3f2a', '#5c4a32', '#2c3a4a', '#7a3040', '#2e4a3a'];
  const rows = 8, cols = 14;
  const rh = s / rows, cw = s / cols;
  for (let r = 0; r < rows; r++) {
    let x = 0;
    while (x < s) {
      const w = cw * (0.7 + Math.random() * 0.8);
      ctx.fillStyle = palette[(r * 7 + Math.floor(x * 3) + palette.length) % palette.length];
      ctx.fillRect(x, r * rh + 1, Math.min(w, s - x) - 1, rh - 3);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, r * rh + 1, 1, rh - 3);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x + Math.min(w, s - x) - 2, r * rh + 1, 1, rh - 3);
      x += w;
    }
  }
}

function floralColor(ctx, s) {
  ctx.fillStyle = '#f3ece0';
  ctx.fillRect(0, 0, s, s);
  const motif = (cx, cy, sc, col) => {
    ctx.fillStyle = col;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * sc * 0.45, cy + Math.sin(a) * sc * 0.45, sc * 0.32, sc * 0.2, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#c9a36a';
    ctx.beginPath();
    ctx.arc(cx, cy, sc * 0.14, 0, Math.PI * 2);
    ctx.fill();
  };
  const leaf = (cx, cy, sc, rot) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = 'rgba(30,61,50,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, sc * 0.55, sc * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  const step = s / 4;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const cx = (x + 0.5) * step, cy = (y + 0.5) * step;
      leaf(cx - 10, cy + 8, 16, 0.6);
      leaf(cx + 12, cy - 6, 14, -0.4);
      motif(cx, cy, 16, (x + y) % 2 === 0 ? 'rgba(107,29,42,0.4)' : 'rgba(90,50,70,0.35)');
    }
  }
}

function linenColor(ctx, s) {
  ctx.fillStyle = '#efe6d6';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < s; i += 2) {
    ctx.fillStyle = `rgba(180,170,150,${0.04 + (i % 6 === 0 ? 0.05 : 0)})`;
    ctx.fillRect(0, i, s, 1);
    ctx.fillRect(i, 0, 1, s);
  }
}

function makeMats(THREE) {
  const woodMap = makeCanvasTexture(THREE, woodColor, 512, 2, 2);
  const woodR = makeCanvasTexture(THREE, woodRough, 512, 2, 2, true);
  const herrMap = makeCanvasTexture(THREE, herringColor, 512, 3, 3);
  const plasMap = makeCanvasTexture(THREE, plasterColor, 256, 3, 2);
  const plasB = makeCanvasTexture(THREE, plasterBump, 256, 3, 2, true);
  const marbMap = makeCanvasTexture(THREE, marbleColor, 512, 2, 2);
  const checkMap = makeCanvasTexture(THREE, checkerColor, 512, 4, 5);
  const rugMap = makeCanvasTexture(THREE, rugColor, 512, 1, 1);
  const orMap = makeCanvasTexture(THREE, orientalColor, 512, 1, 1);
  const bookMap = makeCanvasTexture(THREE, bookColor, 512, 3, 2);
  const floralMap = makeCanvasTexture(THREE, floralColor, 512, 3, 2);
  const linenMap = makeCanvasTexture(THREE, linenColor, 256, 2, 2);
  const std = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({
    color, roughness: 0.7, metalness: 0.02
  }, extra || {}));
  return {
    plaster: std(0xf3ebd9, { map: plasMap, bumpMap: plasB, bumpScale: 0.012, roughness: 0.86 }),
    cream: std(0xf2ead8, { roughness: 0.72 }),
    creamCab: std(0xefe6d2, { roughness: 0.62 }),
    trim: std(0xf7f1e4, { roughness: 0.55 }),
    walnut: std(0x5c3a22, { map: woodMap, roughnessMap: woodR, roughness: 0.48, metalness: 0.04 }),
    oak: std(0x8a5a32, { map: woodMap, roughnessMap: woodR, roughness: 0.5, metalness: 0.03 }),
    darkWood: std(0x3a2416, { map: woodMap, roughnessMap: woodR, roughness: 0.46 }),
    marble: std(0xf4f0ea, { map: marbMap, roughness: 0.22, metalness: 0.08 }),
    herring: std(0xc4a06a, { map: herrMap, roughness: 0.55 }),
    checker: std(0xdddddd, { map: checkMap, roughness: 0.28, metalness: 0.06 }),
    rug: std(0x6b1d2a, { map: rugMap, roughness: 0.92, metalness: 0 }),
    oriental: std(0x5c1a24, { map: orMap, roughness: 0.9, metalness: 0 }),
    books: std(0x888888, { map: bookMap, roughness: 0.7 }),
    floral: std(0xf3ece0, { map: floralMap, roughness: 0.82 }),
    linen: std(0xf0e6d4, { map: linenMap, roughness: 0.88, metalness: 0 }),
    linenSage: std(0xdde3d0, { roughness: 0.88 }),
    brass: std(0xb08d4f, { roughness: 0.28, metalness: 0.88 }),
    brassSoft: std(0xc4a366, { roughness: 0.4, metalness: 0.75 }),
    chrome: std(0xc5c8cc, { roughness: 0.22, metalness: 0.9 }),
    iron: std(0x2a2a2a, { roughness: 0.45, metalness: 0.6 }),
    black: std(0x1a1a1a, { roughness: 0.4, metalness: 0.15 }),
    white: std(0xf8f6f1, { roughness: 0.45 }),
    porcelain: std(0xfbf8f2, { roughness: 0.28, metalness: 0.04 }),
    sage: std(0x8a9a7a, { roughness: 0.7 }),
    sageDeep: std(0x6e7d62, { roughness: 0.65 }),
    green: std(0x1e3d32, { roughness: 0.6 }),
    burgundy: std(0x6b1d2a, { roughness: 0.62 }),
    glass: std(0xdce8f2, { roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.32 }),
    glassClear: std(0xeff6fb, { roughness: 0.05, metalness: 0.02, transparent: true, opacity: 0.18 }),
    crystal: std(0xf2f7fb, { roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.55 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xfff3d4 }),
    glowWarm: new THREE.MeshBasicMaterial({ color: 0xffe8b8 }),
    emissiveAmber: new THREE.MeshStandardMaterial({ color: 0xffd89a, emissive: 0xffc878, emissiveIntensity: 0.9, roughness: 0.4 }),
    leather: std(0x3d2a1c, { roughness: 0.7 }),
    velvet: std(0x5c1a24, { roughness: 0.9, metalness: 0 }),
    wainscot: std(0xf4eee0, { roughness: 0.58 }),
    paper: std(0xf7f1e2, { roughness: 0.85 }),
    curtainCream: std(0xd4b888, { roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
    curtainSage: std(0xc5d0b4, { roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
    silver: std(0xb8bdc4, { roughness: 0.25, metalness: 0.85 })
  };
}

function createKit(THREE, scene, RoundedBoxGeometry) {
  const mats = makeMats(THREE);

  function mesh(geo, mat, x, y, z, parent) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    (parent || scene).add(m);
    if (currentWallTag && fadeGroups[currentWallTag]) {
      const g = fadeGroups[currentWallTag];
      tagWall(m, currentWallTag, g.point[0] * 2, g.point[2] * 2);
    }
    return m;
  }
  function addBox(w, h, d, mat, x, y, z, parent) {
    return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
  }
  function addRound(w, h, d, mat, x, y, z, radius, parent) {
    const minDim = Math.min(w, h, d);
    let r = radius == null ? Math.min(0.045, minDim * 0.14) : radius;
    r = Math.max(0.004, Math.min(r, minDim * 0.49 - 0.0005));
    const segs = minDim < 0.15 ? 1 : 2;
    return mesh(new RoundedBoxGeometry(w, h, d, segs, r), mat, x, y, z, parent);
  }
  function addCyl(rTop, rBot, h, segs, mat, x, y, z, rx, rz, parent) {
    const m = mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs || 24), mat, x, y, z, parent);
    if (rx) m.rotation.x = rx;
    if (rz) m.rotation.z = rz;
    return m;
  }
  function addSph(r, segs, mat, x, y, z, parent) {
    return mesh(new THREE.SphereGeometry(r, segs || 16, segs || 12), mat, x, y, z, parent);
  }

  const fadeGroups = {};
  let currentWallTag = null;

  function tagWall(mesh, wallId, W, D) {
    if (!mesh || !wallId) return mesh;
    let g = fadeGroups[wallId];
    if (!g) {
      const inward = { back: [0, 0, 1], left: [1, 0, 0], right: [-1, 0, 0], front: [0, 0, -1] }[wallId];
      const point = { back: [W / 2, 1, 0], left: [0, 1, D / 2], right: [W, 1, D / 2], front: [W / 2, 1, D] }[wallId];
      g = fadeGroups[wallId] = { id: wallId, inward: inward, point: point, meshes: [] };
    }
    mesh.userData._fadeVisible = true;
    g.meshes.push(mesh);
    return mesh;
  }

  function updateCutaways(cam) {
    if (!cam) return;
    Object.keys(fadeGroups).forEach(function (id) {
      const g = fadeGroups[id];
      const side = (cam.position.x - g.point[0]) * g.inward[0] + (cam.position.z - g.point[2]) * g.inward[2];
      // Hide a wall only when the camera is clearly on its outside, so a 3/4
      // view is not blocked. Top-down (camera inside the footprint) keeps all walls.
      const hide = side < -0.7;
      g.meshes.forEach(function (mesh) {
        mesh.visible = !hide;
        if (mesh.castShadow !== undefined) mesh.castShadow = !hide;
      });
    });
  }

  function shell(W, D, H, opts) {
    opts = opts || {};
    const wall = 0.28;
    const floorMat = opts.floor || mats.herring;
    const wallMat = opts.wall || mats.plaster;
    addBox(W + wall * 2, 0.12, D + wall * 2, floorMat, W / 2, -0.06, D / 2);
    // No ceiling / roof. Walls end at H with a clean cap.
    function wallPlane(id, w, h, d, x, y, z) {
      currentWallTag = null;
      const m = addBox(w, h, d, wallMat, x, y, z);
      tagWall(m, id, W, D);
      return m;
    }
    function cap(id, w, d, x, z) {
      const m = addBox(w, 0.08, d, mats.trim, x, H + 0.04, z);
      tagWall(m, id, W, D);
      return m;
    }
    wallPlane('back', W + wall * 2, H, wall, W / 2, H / 2, -wall / 2);
    cap('back', W + wall * 2 + 0.06, wall + 0.08, W / 2, -wall / 2);
    wallPlane('left', wall, H, D, -wall / 2, H / 2, D / 2);
    cap('left', wall + 0.08, D + 0.06, -wall / 2, D / 2);
    wallPlane('right', wall, H, D, W + wall / 2, H / 2, D / 2);
    cap('right', wall + 0.08, D + 0.06, W + wall / 2, D / 2);
    if (!opts.noFront) {
      wallPlane('front', W + wall * 2, H, wall, W / 2, H / 2, D + wall / 2);
      cap('front', W + wall * 2 + 0.06, wall + 0.08, W / 2, D + wall / 2);
    }
    const bh = 0.38, bt = 0.06;
    tagWall(addBox(W, bh, bt, mats.trim, W / 2, bh / 2, bt / 2 + 0.01), 'back', W, D);
    tagWall(addBox(bt, bh, D, mats.trim, bt / 2 + 0.01, bh / 2, D / 2), 'left', W, D);
    tagWall(addBox(bt, bh, D, mats.trim, W - bt / 2 - 0.01, bh / 2, D / 2), 'right', W, D);
    if (!opts.noFront) tagWall(addBox(W, bh, bt, mats.trim, W / 2, bh / 2, D - bt / 2 - 0.01), 'front', W, D);
    return { W, D, H, wall };
  }

  function lights(W, D, H, sunPos) {
    const hemi = new THREE.HemisphereLight(0xfff6e8, 0x8a7a62, 0.92);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff3d6, 1.05);
    const sp = sunPos || [W * 0.4, H + 14, D + 8];
    sun.position.set(sp[0], sp[1], sp[2]);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0007;
    sun.shadow.normalBias = 0.035;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -W * 1.2;
    sun.shadow.camera.right = W * 1.2;
    sun.shadow.camera.top = Math.max(H, D) * 1.2;
    sun.shadow.camera.bottom = -Math.max(H, D) * 1.2;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xe8f0ff, 0.28);
    fill.position.set(W * 0.15, H + 8, -4);
    scene.add(fill);
    const bounce = new THREE.DirectionalLight(0xffe8c8, 0.16);
    bounce.position.set(W * 0.5, 2.0, D + 2);
    scene.add(bounce);
    return sun;
  }

  /* Window on a wall. Glow sits OUTSIDE so it reads as daylight, not a billboard. */
  function addWindow(wall, pos, width, sill, height, W, D, H, opts) {
    opts = opts || {};
    currentWallTag = wall;
    const frameT = 0.08, frameD = 0.12;
    const mullion = opts.mullion !== false;
    let fx, fy, fz, sx, sy, sz, gx, gy, gz, glowPos, glowSize, rotY = 0;
    fy = sill + height / 2;
    gy = fy;
    sy = height;
    if (wall === 'back') {
      fx = pos; fz = 0.14; sx = width; sz = frameD;
      gx = pos; gz = -0.02;
      glowPos = [pos, fy, -0.22];
      glowSize = [width * 0.92, height * 0.92, 0.03];
    } else if (wall === 'left') {
      fz = pos; fx = 0.14; sx = frameD; sz = width;
      gz = pos; gx = -0.02;
      glowPos = [-0.22, fy, pos];
      glowSize = [0.03, height * 0.92, width * 0.92];
    } else {
      fz = pos; fx = W - 0.14; sx = frameD; sz = width;
      gz = pos; gx = W + 0.02;
      glowPos = [W + 0.22, fy, pos];
      glowSize = [0.03, height * 0.92, width * 0.92];
    }
    // Casing only — never a solid dark slab in the opening
    addBox(sx, sy, sz, mats.trim, fx, fy, fz);
    // Daylight pane (unlit) so the opening never reads as a black hole
    const sky = new THREE.MeshBasicMaterial({ color: 0xf3e4b8 });
    const paneW = wall === 'back' ? width - 0.16 : 0.04;
    const paneH = height - 0.16;
    const paneD = wall === 'back' ? 0.04 : width - 0.16;
    addBox(paneW, paneH, paneD, sky, gx, gy, gz).castShadow = false;
    const glass = addBox(paneW, paneH, paneD, mats.glassClear, gx, gy, gz);
    glass.castShadow = false;
    addBox(glowSize[0], glowSize[1], glowSize[2], mats.glowWarm, glowPos[0], glowPos[1], glowPos[2]).castShadow = false;
    if (mullion) {
      if (wall === 'back') {
        addBox(0.04, height - 0.16, 0.05, mats.trim, pos, fy, 0.16);
        addBox(width - 0.16, 0.04, 0.05, mats.trim, pos, fy, 0.16);
      } else if (wall === 'left') {
        addBox(0.05, height - 0.16, 0.04, mats.trim, 0.16, fy, pos);
        addBox(0.05, 0.04, width - 0.16, mats.trim, 0.16, fy, pos);
      } else {
        addBox(0.05, height - 0.16, 0.04, mats.trim, W - 0.16, fy, pos);
        addBox(0.05, 0.04, width - 0.16, mats.trim, W - 0.16, fy, pos);
      }
    }
    const sillD = 0.28, sillH = 0.07;
    if (wall === 'back') addBox(width + 0.16, sillH, sillD, mats.trim, pos, sill - 0.02, 0.28);
    else if (wall === 'left') addBox(sillD, sillH, width + 0.16, mats.trim, 0.28, sill - 0.02, pos);
    else addBox(sillD, sillH, width + 0.16, mats.trim, W - 0.28, sill - 0.02, pos);
    if (opts.curtains) {
      addCurtains(wall, pos, width, sill, height, W, D, H, opts.curtainMat || mats.curtainCream);
    }
    currentWallTag = null;
    return { fx, fy, fz };
  }

  function addCurtains(wall, pos, width, sill, height, W, D, H, mat) {
    const prevTag = currentWallTag;
    currentWallTag = wall;
    // Rod and two panels, flush to the wall — never floating in the room.
    const drop = H - 0.45 - 0.15;
    const panelW = Math.max(0.85, width * 0.42);
    const thick = 0.11;
    const y = 0.15 + drop / 2;
    const rodY = H - 0.42;
    let rod, p1, p2, rodLen;
    rodLen = width + panelW * 1.15;
    if (wall === 'back') {
      addCyl(0.025, 0.025, rodLen, 12, mats.brass, pos, rodY, 0.16, 0, Math.PI / 2);
      addSph(0.045, 10, mats.brass, pos - rodLen / 2, rodY, 0.16);
      addSph(0.045, 10, mats.brass, pos + rodLen / 2, rodY, 0.16);
      // panels just beside the glass, against the wall
      addBox(panelW, drop, thick, mat, pos - width / 2 - panelW * 0.15, y, 0.2);
      addBox(panelW, drop, thick, mat, pos + width / 2 + panelW * 0.15, y, 0.2);
    } else if (wall === 'left') {
      addCyl(0.025, 0.025, rodLen, 12, mats.brass, 0.16, rodY, pos, Math.PI / 2, 0);
      addSph(0.045, 10, mats.brass, 0.16, rodY, pos - rodLen / 2);
      addSph(0.045, 10, mats.brass, 0.16, rodY, pos + rodLen / 2);
      addBox(thick, drop, panelW, mat, 0.2, y, pos - width / 2 - panelW * 0.15);
      addBox(thick, drop, panelW, mat, 0.2, y, pos + width / 2 + panelW * 0.15);
    } else {
      addCyl(0.025, 0.025, rodLen, 12, mats.brass, W - 0.16, rodY, pos, Math.PI / 2, 0);
      addSph(0.045, 10, mats.brass, W - 0.16, rodY, pos - rodLen / 2);
      addSph(0.045, 10, mats.brass, W - 0.16, rodY, pos + rodLen / 2);
      addBox(thick, drop, panelW, mat, W - 0.2, y, pos - width / 2 - panelW * 0.15);
      addBox(thick, drop, panelW, mat, W - 0.2, y, pos + width / 2 + panelW * 0.15);
    }
      currentWallTag = prevTag;
  }

  function addCabinetRun(x0, x1, z0, z1, y0, y1, facing, upper) {
    // axis-aligned cabinet bank. facing: '+x' | '-x' | '+z' | '-z'
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0), h = y1 - y0;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, cy = (y0 + y1) / 2;
    addRound(w, h, d, mats.creamCab, cx, cy, cz, 0.03);
    // door grooves + knobs along the long axis
    const alongX = w >= d;
    const n = Math.max(1, Math.round((alongX ? w : d) / 1.15));
    const step = (alongX ? w : d) / n;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) * step;
      let dx = cx, dz = cz;
      if (alongX) dx = Math.min(x0, x1) + t;
      else dz = Math.min(z0, z1) + t;
      // shallow door panel
      const pw = alongX ? step - 0.12 : w - 0.12;
      const pd = alongX ? d - 0.12 : step - 0.12;
      const ph = h - 0.16;
      let px = dx, pz = dz, py = cy;
      const inset = 0.025;
      if (facing === '+x') px = Math.max(x0, x1) + inset - w / 2 + w / 2;
      // simpler: a slightly inset front panel
      const front = { '+x': [Math.max(x0, x1) + 0.01, 0.02, 0], '-x': [Math.min(x0, x1) - 0.01, 0.02, 0], '+z': [0, 0.02, Math.max(z0, z1) + 0.01], '-z': [0, 0.02, Math.min(z0, z1) - 0.01] };
      const f = front[facing] || front['+z'];
      if (facing === '+x' || facing === '-x') {
        addBox(0.02, ph, pd - 0.08, mats.trim, (facing === '+x' ? Math.max(x0, x1) : Math.min(x0, x1)) + (facing === '+x' ? 0.012 : -0.012), cy, dz, null);
        const knobZ = dz;
        const knobY = upper ? cy - ph * 0.28 : cy + ph * 0.28;
        const knobX = (facing === '+x' ? Math.max(x0, x1) : Math.min(x0, x1)) + (facing === '+x' ? 0.04 : -0.04);
        addSph(0.035, 10, mats.brass, knobX, knobY, knobZ);
      } else {
        addBox(pw - 0.08, ph, 0.02, mats.trim, dx, cy, (facing === '+z' ? Math.max(z0, z1) : Math.min(z0, z1)) + (facing === '+z' ? 0.012 : -0.012));
        const knobX = dx;
        const knobY = upper ? cy - ph * 0.28 : cy + ph * 0.28;
        const knobZ = (facing === '+z' ? Math.max(z0, z1) : Math.min(z0, z1)) + (facing === '+z' ? 0.04 : -0.04);
        addSph(0.035, 10, mats.brass, knobX, knobY, knobZ);
      }
    }
    // toekick for base cabinets
    if (!upper && y0 < 0.4) {
      if (facing === '+x' || facing === '-x') addBox(w - 0.04, 0.28, d - 0.08, mats.black, cx, 0.14, cz);
      else addBox(w - 0.08, 0.28, d - 0.04, mats.black, cx, 0.14, cz);
    }
  }

  function addFarmSink(cx, cz, facing, W) {
    // Farmhouse apron sink + high-arc brass faucet. Basin clearly open.
    // facing '+x' = left wall (apron faces into room toward +x)
    const apronW = 2.5, apronH = 0.72, apronT = 0.1, basinD = 1.55, basinW = 2.2, basinH = 0.42;
    const counterY = 3.05;
    if (facing === '+x') {
      addRound(apronT, apronH, apronW, mats.porcelain, cx + 0.85, counterY - apronH / 2 + 0.02, cz, 0.03);
      // open basin — recess into the counter by a dark interior + white walls
      addBox(basinD, 0.05, basinW, mats.porcelain, cx + 0.05, counterY - basinH, cz);
      addBox(0.05, basinH, basinW, mats.porcelain, cx - basinD / 2 + 0.08, counterY - basinH / 2, cz);
      addBox(basinD, basinH, 0.05, mats.porcelain, cx + 0.05, counterY - basinH / 2, cz - basinW / 2);
      addBox(basinD, basinH, 0.05, mats.porcelain, cx + 0.05, counterY - basinH / 2, cz + basinW / 2);
      // dark water surface
      addBox(basinD - 0.1, 0.02, basinW - 0.1, mats.green, cx + 0.05, counterY - basinH + 0.08, cz);
      addFaucet(cx - 0.35, counterY, cz, '+x');
    } else if (facing === '-x') {
      addRound(apronT, apronH, apronW, mats.porcelain, cx - 0.85, counterY - apronH / 2 + 0.02, cz, 0.03);
      addBox(basinD, 0.05, basinW, mats.porcelain, cx - 0.05, counterY - basinH, cz);
      addBox(0.05, basinH, basinW, mats.porcelain, cx + basinD / 2 - 0.08, counterY - basinH / 2, cz);
      addBox(basinD, basinH, 0.05, mats.porcelain, cx - 0.05, counterY - basinH / 2, cz - basinW / 2);
      addBox(basinD, basinH, 0.05, mats.porcelain, cx - 0.05, counterY - basinH / 2, cz + basinW / 2);
      addBox(basinD - 0.1, 0.02, basinW - 0.1, mats.green, cx - 0.05, counterY - basinH + 0.08, cz);
      addFaucet(cx + 0.35, counterY, cz, '-x');
    }
  }

  function addFaucet(x, y, z, facing) {
    const dir = facing === '+x' ? 1 : facing === '-x' ? -1 : 0;
    addCyl(0.035, 0.04, 0.12, 12, mats.brass, x, y + 0.06, z);
    // two handle posts
    addCyl(0.02, 0.02, 0.14, 10, mats.brass, x, y + 0.14, z - 0.22);
    addCyl(0.02, 0.02, 0.14, 10, mats.brass, x, y + 0.14, z + 0.22);
    addCyl(0.03, 0.03, 0.12, 10, mats.brass, x, y + 0.24, z - 0.22, Math.PI / 2, 0);
    addCyl(0.03, 0.03, 0.12, 10, mats.brass, x, y + 0.24, z + 0.22, Math.PI / 2, 0);
    // high-arc spout: rise, then curve toward the basin
    addCyl(0.025, 0.028, 0.7, 12, mats.brass, x, y + 0.42, z);
    // horizontal toward basin
    addCyl(0.022, 0.022, 0.45, 12, mats.brass, x + dir * 0.22, y + 0.74, z, 0, Math.PI / 2);
    // tip down
    addCyl(0.018, 0.024, 0.14, 10, mats.brass, x + dir * 0.42, y + 0.68, z);
  }

  function addRange(cx, cz, facing, H) {
    const w = 2.55, d = 2.25, h = 3.05;
    const bodyX = cx, bodyZ = cz;
    addRound(facing === '+x' || facing === '-x' ? d : w, h, facing === '+x' || facing === '-x' ? w : d, mats.creamCab, bodyX, h / 2, bodyZ, 0.03);
    // cooktop
    const topW = (facing === '+x' || facing === '-x') ? d - 0.08 : w - 0.08;
    const topD = (facing === '+x' || facing === '-x') ? w - 0.08 : d - 0.08;
    addBox(topW, 0.07, topD, mats.black, bodyX, h + 0.02, bodyZ);
    // burners 2x3
    const dirs = [];
    if (facing === '+x' || facing === '-x') {
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        const bx = bodyX + (r === 0 ? -0.45 : 0.45);
        const bz = bodyZ + (c - 1) * 0.7;
        addCyl(0.16, 0.16, 0.04, 20, mats.iron, bx, h + 0.07, bz);
        addCyl(0.06, 0.06, 0.03, 12, mats.black, bx, h + 0.09, bz);
      }
    } else {
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        const bz = bodyZ + (r === 0 ? -0.45 : 0.45);
        const bx = bodyX + (c - 1) * 0.7;
        addCyl(0.16, 0.16, 0.04, 20, mats.iron, bx, h + 0.07, bz);
        addCyl(0.06, 0.06, 0.03, 12, mats.black, bx, h + 0.09, bz);
      }
    }
    // oven door + window + handle
    const face = facing;
    function frontPos(off) {
      if (face === '+x') return [cx + d / 2 + off, 1.35, cz];
      if (face === '-x') return [cx - d / 2 - off, 1.35, cz];
      if (face === '+z') return [cx, 1.35, cz + d / 2 + off];
      return [cx, 1.35, cz - d / 2 - off];
    }
    const od = frontPos(0.02);
    if (face === '+x' || face === '-x') {
      addBox(0.04, 1.7, w - 0.3, mats.iron, od[0], od[1], od[2]);
      addBox(0.03, 0.7, 1.1, mats.glass, od[0] + (face === '+x' ? 0.03 : -0.03), 1.45, cz);
      addCyl(0.03, 0.03, 1.3, 10, mats.brass, od[0] + (face === '+x' ? 0.06 : -0.06), 2.05, cz, Math.PI / 2, 0);
      // knobs along the front at counter height
      for (let i = -2; i <= 2; i++) addCyl(0.05, 0.05, 0.06, 10, mats.brass, od[0] + (face === '+x' ? 0.05 : -0.05), 2.85, cz + i * 0.4, 0, Math.PI / 2);
    } else {
      addBox(w - 0.3, 1.7, 0.04, mats.iron, od[0], od[1], od[2]);
      addBox(1.1, 0.7, 0.03, mats.glass, cx, 1.45, od[2] + (face === '+z' ? 0.03 : -0.03));
      addCyl(0.03, 0.03, 1.3, 10, mats.brass, cx, 2.05, od[2] + (face === '+z' ? 0.06 : -0.06), 0, Math.PI / 2);
      for (let i = -2; i <= 2; i++) addCyl(0.05, 0.05, 0.06, 10, mats.brass, cx + i * 0.4, 2.85, od[2] + (face === '+z' ? 0.05 : -0.05), Math.PI / 2, 0);
    }
    // hood centered over the range; short capped chimney (no run to a missing ceiling)
    const hoodY = 6.55, hoodH = 0.7, chimH = 1.05;
    const hoodW = w + 0.35, hoodD = d - 0.15;
    if (face === '+x' || face === '-x') {
      const hx = cx + (face === '+x' ? 0.15 : -0.15);
      addRound(hoodD + 0.2, 0.12, hoodW, mats.chrome, hx, hoodY, cz, 0.04);
      addRound(hoodD, hoodH, hoodW - 0.2, mats.chrome, hx, hoodY + hoodH / 2 + 0.04, cz, 0.03);
      addBox(0.7, chimH, 0.9, mats.chrome, hx, hoodY + hoodH + chimH / 2 + 0.04, cz);
      addBox(0.82, 0.07, 1.02, mats.chrome, hx, hoodY + hoodH + chimH + 0.1, cz);
    } else {
      addRound(hoodW, 0.12, hoodD + 0.2, mats.chrome, cx, hoodY, cz, 0.04);
      addRound(hoodW - 0.2, hoodH, hoodD, mats.chrome, cx, hoodY + hoodH / 2 + 0.04, cz, 0.03);
      addBox(0.9, chimH, 0.7, mats.chrome, cx, hoodY + hoodH + chimH / 2 + 0.04, cz);
      addBox(1.02, 0.07, 0.82, mats.chrome, cx, hoodY + hoodH + chimH + 0.1, cz);
    }
  }

  function addBeamX(x0, x1, y, z, mat) {
    const m = mat || mats.brass;
    const len = Math.abs(x1 - x0);
    addBox(len, 0.07, 0.07, m, (x0 + x1) / 2, y, z);
  }
  function addCanopy(x, y, z, mat) {
    // Finished cap at the open wall-top line so hanging fixtures don't float
    addCyl(0.22, 0.22, 0.06, 16, mat || mats.brass, x, y, z);
    addCyl(0.08, 0.08, 0.05, 12, mat || mats.brass, x, y - 0.05, z);
  }
  function addPendant(x, y, z, hangY) {
    hangY = hangY == null ? y + 1.55 : hangY;
    const rodH = Math.max(0.2, hangY - y - 0.14);
    addCyl(0.012, 0.012, rodH, 8, mats.brass, x, y + 0.14 + rodH / 2, z);
    addCyl(0.04, 0.04, 0.08, 12, mats.brass, x, y + 0.16, z);
    addCyl(0.38, 0.18, 0.28, 24, mats.brassSoft, x, y, z);
    addSph(0.08, 10, mats.emissiveAmber, x, y - 0.02, z).castShadow = false;
    addCanopy(x, hangY, z, mats.brass);
  }

  function addBrassChandelier(x, y, z, arms, hangY) {
    arms = arms || 6;
    hangY = hangY == null ? y + 2.35 : hangY;
    // chain from the supporting beam down to the body — no orphan ceiling medallion
    const chainTop = hangY - 0.04;
    const chainBot = y + 1.05;
    const chainH = Math.max(0.2, chainTop - chainBot);
    addCyl(0.03, 0.03, chainH, 8, mats.brass, x, (chainTop + chainBot) / 2, z);
    addCanopy(x, hangY, z, mats.brass);
    // body
    addCyl(0.14, 0.18, 0.35, 16, mats.brass, x, y + 0.85, z);
    addCyl(0.1, 0.12, 0.2, 16, mats.brass, x, y + 0.58, z);
    addSph(0.08, 12, mats.brass, x, y + 0.42, z);
    const spread = 1.05;
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * Math.PI * 2 + Math.PI / arms;
      const mx = x + Math.cos(a) * spread * 0.52;
      const mz = z + Math.sin(a) * spread * 0.52;
      const arm = addBox(spread * 0.95, 0.05, 0.05, mats.brass, mx, y + 0.72, mz);
      arm.rotation.y = -a;
      const ax = x + Math.cos(a) * spread, az = z + Math.sin(a) * spread;
      addCyl(0.045, 0.06, 0.08, 12, mats.brass, ax, y + 0.68, az);
      addCyl(0.18, 0.22, 0.22, 16, mats.cream, ax, y + 0.5, az);
      addCyl(0.02, 0.02, 0.1, 8, mats.emissiveAmber, ax, y + 0.62, az).castShadow = false;
    }
  }

  function addCrystalChandelier(x, y, z, hangY) {
    hangY = hangY == null ? y + 2.15 : hangY;
    const chainTop = hangY - 0.04;
    const chainBot = y + 1.15;
    const chainH = Math.max(0.2, chainTop - chainBot);
    addCyl(0.025, 0.025, chainH, 8, mats.silver, x, (chainTop + chainBot) / 2, z);
    addCanopy(x, hangY, z, mats.silver);
    addCyl(0.16, 0.2, 0.22, 16, mats.silver, x, y + 0.95, z);
    addSph(0.1, 12, mats.crystal, x, y + 0.78, z);
    // two rings of crystals + candle cups
    const rings = [{ r: 0.7, n: 8, yOff: 0.7 }, { r: 1.05, n: 10, yOff: 0.55 }];
    rings.forEach((ring) => {
      // metal ring
      // approximate ring with torus via many short boxes, or a thin torus if available
      const torus = new THREE.Mesh(new THREE.TorusGeometry(ring.r, 0.025, 8, 32), mats.silver);
      torus.position.set(x, y + ring.yOff + 0.15, z);
      torus.rotation.x = Math.PI / 2;
      torus.castShadow = true;
      scene.add(torus);
      for (let i = 0; i < ring.n; i++) {
        const a = (i / ring.n) * Math.PI * 2;
        const cx = x + Math.cos(a) * ring.r, cz = z + Math.sin(a) * ring.r;
        addCyl(0.03, 0.04, 0.06, 8, mats.silver, cx, y + ring.yOff + 0.2, cz);
        addCyl(0.015, 0.015, 0.1, 6, mats.emissiveAmber, cx, y + ring.yOff + 0.28, cz).castShadow = false;
        // hanging crystals
        for (let k = 0; k < 3; k++) {
          const cry = addBox(0.05, 0.11, 0.05, mats.crystal, cx, y + ring.yOff - 0.05 - k * 0.13, cz);
          cry.rotation.y = a + k * 0.4;
        }
      }
    });
    // central hanging spear
    addBox(0.06, 0.4, 0.06, mats.crystal, x, y + 0.35, z);
  }

  function addChair(x, ySeat, z, rotY, kind) {
    // kind: 'wood' | 'upholstered'
    const up = kind === 'upholstered';
    const seatMat = up ? mats.linen : mats.darkWood;
    const frame = mats.darkWood;
    // legs
    const legH = ySeat - 0.07;
    const feet = [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]];
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY || 0;
    scene.add(g);
    feet.forEach((f) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, legH, 10), frame);
      leg.position.set(f[0], legH / 2, f[1]);
      leg.castShadow = true;
      g.add(leg);
    });
    const seat = new THREE.Mesh(new RoundedBoxGeometry(1.05, 0.12, 1.05, 2, 0.05), seatMat);
    seat.position.set(0, ySeat, 0);
    seat.castShadow = true;
    seat.receiveShadow = true;
    g.add(seat);
    if (up) {
      const cush = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.1, 0.95, 2, 0.05), mats.linen);
      cush.position.set(0, ySeat + 0.1, 0);
      cush.castShadow = true;
      g.add(cush);
    }
    if (up) {
      const back = new THREE.Mesh(new RoundedBoxGeometry(1.05, 1.7, 0.16, 2, 0.04), mats.linen);
      back.position.set(0, ySeat + 0.95, -0.46);
      back.castShadow = true;
      g.add(back);
    } else {
      // open back: two posts, top rail, splat — not a solid slab
      const postH = 1.85;
      [[-0.44, 0], [0.44, 0]].forEach((pr) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, postH, 10), frame);
        post.position.set(pr[0], ySeat + postH / 2, -0.46);
        post.castShadow = true;
        g.add(post);
      });
      const rail = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.08, 0.06, 2, 0.02), frame);
      rail.position.set(0, ySeat + 1.78, -0.46);
      rail.castShadow = true;
      g.add(rail);
      const splat = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.55, 0.05, 2, 0.03), frame);
      splat.position.set(0, ySeat + 1.15, -0.46);
      splat.castShadow = true;
      g.add(splat);
    }
    return g;
  }

  function addSofa(cx, cz, width, depth, rotY) {
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    g.rotation.y = rotY || 0;
    scene.add(g);
    const armW = 0.5, seatH = 1.35, depthIn = depth;
    function rm(w, h, d, mat, x, y, z, r) {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r || 0.05), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    }
    // legs
    [[-width / 2 + 0.25, -depth / 2 + 0.22], [width / 2 - 0.25, -depth / 2 + 0.22], [-width / 2 + 0.25, depth / 2 - 0.22], [width / 2 - 0.25, depth / 2 - 0.22]].forEach((p) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.28, 10), mats.walnut);
      leg.position.set(p[0], 0.14, p[1]);
      leg.castShadow = true;
      g.add(leg);
    });
    // upholstered skirt to the floor so no dark plinth shows under the sofa
    rm(width - 0.08, 1.05, depth - 0.1, mats.linen, 0, 0.72, 0, 0.05);
    // arms
    rm(armW, 1.7, depth - 0.08, mats.linen, -width / 2 + armW / 2, 1.15, 0, 0.08);
    rm(armW, 1.7, depth - 0.08, mats.linen, width / 2 - armW / 2, 1.15, 0, 0.08);
    // back
    rm(width - 0.08, 1.55, 0.42, mats.linen, 0, 1.55, -depth / 2 + 0.22, 0.08);
    // seat platform
    rm(width - armW * 2 - 0.06, 0.2, depth - 0.55, mats.linen, 0, seatH - 0.05, 0.12, 0.04);
    // three seat cushions
    const cw = (width - armW * 2 - 0.16) / 3;
    for (let i = 0; i < 3; i++) {
      const cxC = -((3 - 1) / 2) * (cw + 0.05) + i * (cw + 0.05);
      rm(cw, 0.28, depth - 0.7, mats.linen, cxC, seatH + 0.16, 0.16, 0.07);
      // back cushions
      rm(cw, 1.05, 0.28, mats.linen, cxC, seatH + 0.85, -depth / 2 + 0.48, 0.07);
    }
    // throw pillows
    const p1 = rm(0.55, 0.42, 0.22, mats.burgundy, -width * 0.18, seatH + 0.85, 0.1, 0.1);
    p1.rotation.z = 0.2;
    const p2 = rm(0.55, 0.42, 0.22, mats.green, width * 0.16, seatH + 0.85, 0.1, 0.1);
    p2.rotation.z = -0.15;
    return g;
  }

  function addPaneledDoor(x, y0, z, w, h, facing, mat) {
    mat = mat || mats.creamCab;
    const t = 0.08;
    let dx = x, dy = y0 + h / 2, dz = z;
    if (facing === '+z' || facing === '-z') {
      addRound(w, h, t, mat, dx, dy, dz, 0.02);
      // recessed panels in the same wood/paint as the door
      addBox(w - 0.28, h * 0.38, 0.03, mat, dx, y0 + h * 0.28, dz + (facing === '+z' ? 0.05 : -0.05));
      addBox(w - 0.28, h * 0.32, 0.03, mat, dx, y0 + h * 0.72, dz + (facing === '+z' ? 0.05 : -0.05));
      addSph(0.04, 10, mats.brass, dx + w * 0.35, y0 + h * 0.48, dz + (facing === '+z' ? 0.07 : -0.07));
      // casing
      addBox(w + 0.28, 0.1, 0.12, mats.trim, dx, y0 + h + 0.05, dz);
      addBox(0.1, h + 0.1, 0.12, mats.trim, dx - w / 2 - 0.08, dy, dz);
      addBox(0.1, h + 0.1, 0.12, mats.trim, dx + w / 2 + 0.08, dy, dz);
    } else {
      addRound(t, h, w, mat, dx, dy, dz, 0.02);
      addBox(0.03, h * 0.38, w - 0.28, mat, dx + (facing === '+x' ? 0.05 : -0.05), y0 + h * 0.28, dz);
      addBox(0.03, h * 0.32, w - 0.28, mat, dx + (facing === '+x' ? 0.05 : -0.05), y0 + h * 0.72, dz);
      addSph(0.04, 10, mats.brass, dx + (facing === '+x' ? 0.07 : -0.07), y0 + h * 0.48, dz + w * 0.35);
      addBox(0.12, 0.1, w + 0.28, mats.trim, dx, y0 + h + 0.05, dz);
      addBox(0.12, h + 0.1, 0.1, mats.trim, dx, dy, dz - w / 2 - 0.08);
      addBox(0.12, h + 0.1, 0.1, mats.trim, dx, dy, dz + w / 2 + 0.08);
    }
  }

  function addCoat(x, yHook, z, colorMat, facing) {
    // Hook, hanger, shoulders, hanging body — reads as a coat, not a bar.
    // facing '-x' hangs into the room from a right-hand wall of hooks.
    facing = facing || '+z';
    if (facing === '-x') {
      addCyl(0.02, 0.02, 0.16, 8, mats.iron, x - 0.06, yHook + 0.02, z, 0, Math.PI / 2);
      addCyl(0.015, 0.015, 0.18, 8, mats.iron, x - 0.16, yHook - 0.02, z);
      addCyl(0.012, 0.012, 0.55, 8, mats.iron, x - 0.22, yHook - 0.18, z, Math.PI / 2, 0);
      addRound(0.32, 0.16, 0.85, colorMat, x - 0.28, yHook - 0.28, z, 0.07);
      addRound(0.22, 1.85, 0.72, colorMat, x - 0.38, yHook - 1.25, z, 0.06);
      const sl = new THREE.Mesh(new RoundedBoxGeometry(0.18, 1.15, 0.22, 2, 0.06), colorMat);
      sl.position.set(x - 0.38, yHook - 0.85, z - 0.42);
      sl.rotation.x = -0.18;
      sl.castShadow = true;
      scene.add(sl);
      const sr = new THREE.Mesh(new RoundedBoxGeometry(0.18, 1.15, 0.22, 2, 0.06), colorMat);
      sr.position.set(x - 0.38, yHook - 0.85, z + 0.42);
      sr.rotation.x = 0.18;
      sr.castShadow = true;
      scene.add(sr);
    } else {
      addCyl(0.02, 0.02, 0.16, 8, mats.iron, x, yHook + 0.02, z, Math.PI / 2, 0);
      addCyl(0.015, 0.015, 0.22, 8, mats.iron, x, yHook - 0.02, z + 0.08, 0, Math.PI / 2);
      addCyl(0.012, 0.012, 0.55, 8, mats.iron, x, yHook - 0.18, z + 0.16, 0, Math.PI / 2);
      addRound(0.85, 0.16, 0.32, colorMat, x, yHook - 0.28, z + 0.2, 0.07);
      addRound(0.72, 1.85, 0.22, colorMat, x, yHook - 1.25, z + 0.22, 0.06);
      const sl = new THREE.Mesh(new RoundedBoxGeometry(0.22, 1.15, 0.18, 2, 0.06), colorMat);
      sl.position.set(x - 0.42, yHook - 0.85, z + 0.22);
      sl.rotation.z = 0.18;
      sl.castShadow = true;
      scene.add(sl);
      const sr = new THREE.Mesh(new RoundedBoxGeometry(0.22, 1.15, 0.18, 2, 0.06), colorMat);
      sr.position.set(x + 0.42, yHook - 0.85, z + 0.22);
      sr.rotation.z = -0.18;
      sr.castShadow = true;
      scene.add(sr);
    }
  }

  function addBasket(x, y, z, w, d, h) {
    addRound(w, 0.06, d, mats.oak, x, y, z, 0.02);
    addBox(0.05, h, d - 0.04, mats.oak, x - w / 2 + 0.03, y + h / 2, z);
    addBox(0.05, h, d - 0.04, mats.oak, x + w / 2 - 0.03, y + h / 2, z);
    addBox(w - 0.04, h, 0.05, mats.oak, x, y + h / 2, z - d / 2 + 0.03);
    addBox(w - 0.04, h, 0.05, mats.oak, x, y + h / 2, z + d / 2 - 0.03);
    // cloth liner
    addBox(w - 0.12, 0.04, d - 0.12, mats.linen, x, y + h * 0.45, z);
  }

  function addRug(cx, cz, w, d, mat) {
    addBox(w, 0.04, d, mat || mats.rug, cx, 0.03, cz).castShadow = false;
  }

  function addLamp(x, y, z, shadeMat) {
    addCyl(0.12, 0.16, 0.06, 16, mats.brass, x, y, z);
    addCyl(0.025, 0.025, 1.15, 10, mats.brass, x, y + 0.6, z);
    addCyl(0.28, 0.34, 0.42, 20, shadeMat || mats.linen, x, y + 1.3, z);
    addSph(0.06, 8, mats.emissiveAmber, x, y + 1.22, z).castShadow = false;
  }

  function addFloorLamp(x, z) {
    addCyl(0.16, 0.2, 0.06, 16, mats.brass, x, 0.03, z);
    addCyl(0.03, 0.03, 5.0, 10, mats.brass, x, 2.55, z);
    addCyl(0.35, 0.5, 0.55, 20, mats.linen, x, 5.15, z);
    addSph(0.07, 8, mats.emissiveAmber, x, 5.0, z).castShadow = false;
  }

  function addTableLamp(x, y, z) {
    addCyl(0.12, 0.16, 0.08, 14, mats.walnut, x, y + 0.04, z);
    addCyl(0.025, 0.03, 0.85, 10, mats.brass, x, y + 0.5, z);
    addCyl(0.2, 0.26, 0.35, 16, mats.linen, x, y + 1.02, z);
    addSph(0.05, 8, mats.emissiveAmber, x, y + 0.95, z).castShadow = false;
  }

  return {
    THREE, scene, mats,
    addBox, addRound, addCyl, addSph, mesh,
    shell, lights, addWindow, addCurtains, tagWall, updateCutaways, addBeamX,
    addCabinetRun, addFarmSink, addFaucet, addRange, addPendant,
    addBrassChandelier, addCrystalChandelier,
    addChair, addSofa, addPaneledDoor, addCoat, addBasket,
    addRug, addLamp, addFloorLamp, addTableLamp,
    RoundedBoxGeometry
  };
}

/* ---------------- Room builders ---------------- */


function dollhouseView(W, D, H, opts) {
  opts = opts || {};
  const ox = opts.ox != null ? opts.ox : 0.55;
  const camX = W * ox + (ox < 0.4 ? -2.2 : ox > 0.65 ? 2.2 : 0);
  const cam = [camX, opts.hy != null ? opts.hy : (H + 7.4), D + (opts.hz != null ? opts.hz : 8.8)];
  const target = [
    W * (opts.tx != null ? opts.tx : 0.48),
    opts.ty != null ? opts.ty : 1.15,
    D * (opts.tz != null ? opts.tz : 0.40)
  ];
  const topCam = [W / 2, Math.max(H + 70, 90), D / 2 + 0.15];
  const topT = [W / 2, 0.15, D / 2];
  return {
    camera: cam,
    target: target,
    top: { camera: topCam, target: topT, fov: 12 },
    min: opts.min || 6,
    max: opts.max || 38,
    fov: opts.fov || 48
  };
}

function buildKitchen(kit) {
  const { mats } = kit;
  const W = 16, D = 18, H = 9.4;
  kit.shell(W, D, H, { floor: mats.herring, noFront: true });
  const sun = kit.lights(W, D, H, [5, 14, 22]);

  // Solid back wall with a few wide pantry cabinets + a proper door (no glowing void).
  const doorW = 2.5, doorH = 7.0, doorX = W / 2, doorZ = 0.16;
  // Two wide tall doors each side — not a wall of skinny slats
  function tallPantry(x0, x1) {
    const cx = (x0 + x1) / 2, w = x1 - x0;
    kit.addRound(w, 8.85, 1.55, mats.creamCab, cx, 4.55, 0.95, 0.04);
    kit.addBox(w - 0.2, 4.0, 0.04, mats.trim, cx, 2.5, 1.74);
    kit.addBox(w - 0.2, 3.8, 0.04, mats.trim, cx, 6.7, 1.74);
    kit.addSph(0.04, 10, mats.brass, cx + w * 0.3, 3.2, 1.8);
    kit.addSph(0.04, 10, mats.brass, cx + w * 0.3, 6.3, 1.8);
  }
  tallPantry(0.15, doorX - doorW / 2 - 0.2);
  tallPantry(doorX + doorW / 2 + 0.2, W - 0.15);
  // pantry door — closed, paneled, cased. Shallow pantry implied, no hole.
  kit.addPaneledDoor(doorX, 0, doorZ, doorW, doorH, '+z', mats.creamCab);
  // small transom window ABOVE the door, with a framed glow behind it (not a doorway void)
  kit.addBox(doorW + 0.3, 0.08, 0.12, mats.trim, doorX, doorH + 0.2, 0.16);
  kit.addBox(doorW - 0.1, 1.35, 0.04, mats.glassClear, doorX, doorH + 0.95, 0.08);
  kit.addBox(0.04, 1.35, 0.04, mats.trim, doorX, doorH + 0.95, 0.12);
  kit.addBox(doorW - 0.1, 0.04, 0.04, mats.trim, doorX, doorH + 0.95, 0.12);
  // glow lives behind the transom, in the wall thickness — small, framed
  kit.addBox(doorW - 0.2, 1.2, 0.03, mats.glow, doorX, doorH + 0.95, -0.12).castShadow = false;

  // Side runs. Camera is at the open front (z≈22). Sinks sit near the front so both
  // are clearly visible; each range is immediately inboard of its sink; hoods centered.
  const sinkZ = 13.7;
  const rangeZ = 10.55;
  const leftX = 1.05;
  const rightX = W - 1.05;

  // LEFT (meat): window, farmhouse sink, range, remaining cabinets
  kit.addWindow('left', sinkZ, 2.55, 3.15, 3.7, W, D, H, { curtains: true });
  // base cabinets along left, split around sink and range footprints
  kit.addCabinetRun(0.15, 2.15, 1.7, rangeZ - 1.4, 0.3, 3.05, '+x', false);
  // counter top continuous except the sink basin cut (we leave a marble top with a gap at the sink)
  kit.addBox(1.95, 0.1, rangeZ - 1.4 - 1.7, mats.marble, leftX, 3.1, (1.7 + rangeZ - 1.4) / 2);
  kit.addRange(leftX + 0.15, rangeZ, '+x', H);
  // short counter between range and sink
  kit.addCabinetRun(0.15, 2.15, rangeZ + 1.35, sinkZ - 1.4, 0.3, 3.05, '+x', false);
  kit.addBox(1.95, 0.1, (sinkZ - 1.4) - (rangeZ + 1.35), mats.marble, leftX, 3.1, (rangeZ + 1.35 + sinkZ - 1.4) / 2);
  // sink cabinet + apron sink under the window
  kit.addCabinetRun(0.15, 1.7, sinkZ - 1.35, sinkZ + 1.35, 0.3, 2.35, '+x', false);
  // marble wings beside the basin (basin itself is open)
  kit.addBox(1.6, 0.1, 0.35, mats.marble, leftX - 0.1, 3.1, sinkZ - 1.45);
  kit.addBox(1.6, 0.1, 0.35, mats.marble, leftX - 0.1, 3.1, sinkZ + 1.45);
  kit.addFarmSink(leftX, sinkZ, '+x', W);
  // cabinets from sink to front wall
  kit.addCabinetRun(0.15, 2.15, sinkZ + 1.45, D - 0.4, 0.3, 3.05, '+x', false);
  kit.addBox(1.95, 0.1, (D - 0.4) - (sinkZ + 1.45), mats.marble, leftX, 3.1, (sinkZ + 1.45 + D - 0.4) / 2);

  // left uppers: skip the window and the hood
  kit.addCabinetRun(0.15, 1.55, 1.7, rangeZ - 1.5, 5.15, 9.15, '+x', true);
  kit.addCabinetRun(0.15, 1.55, rangeZ + 1.55, sinkZ - 1.5, 5.15, 9.15, '+x', true);
  kit.addCabinetRun(0.15, 1.55, sinkZ + 1.55, D - 0.4, 5.15, 9.15, '+x', true);

  // RIGHT (dairy): mirror
  kit.addWindow('right', sinkZ, 2.55, 3.15, 3.7, W, D, H, { curtains: true });
  kit.addCabinetRun(W - 2.15, W - 0.15, 1.7, rangeZ - 1.4, 0.3, 3.05, '-x', false);
  kit.addBox(1.95, 0.1, rangeZ - 1.4 - 1.7, mats.marble, rightX, 3.1, (1.7 + rangeZ - 1.4) / 2);
  kit.addRange(rightX - 0.15, rangeZ, '-x', H);
  kit.addCabinetRun(W - 2.15, W - 0.15, rangeZ + 1.35, sinkZ - 1.4, 0.3, 3.05, '-x', false);
  kit.addBox(1.95, 0.1, (sinkZ - 1.4) - (rangeZ + 1.35), mats.marble, rightX, 3.1, (rangeZ + 1.35 + sinkZ - 1.4) / 2);
  kit.addCabinetRun(W - 1.7, W - 0.15, sinkZ - 1.35, sinkZ + 1.35, 0.3, 2.35, '-x', false);
  kit.addBox(1.6, 0.1, 0.35, mats.marble, rightX + 0.1, 3.1, sinkZ - 1.45);
  kit.addBox(1.6, 0.1, 0.35, mats.marble, rightX + 0.1, 3.1, sinkZ + 1.45);
  kit.addFarmSink(rightX, sinkZ, '-x', W);
  kit.addCabinetRun(W - 2.15, W - 0.15, sinkZ + 1.45, D - 0.4, 0.3, 3.05, '-x', false);
  kit.addBox(1.95, 0.1, (D - 0.4) - (sinkZ + 1.45), mats.marble, rightX, 3.1, (sinkZ + 1.45 + D - 0.4) / 2);
  kit.addCabinetRun(W - 1.55, W - 0.15, 1.7, rangeZ - 1.5, 5.15, 9.15, '-x', true);
  kit.addCabinetRun(W - 1.55, W - 0.15, rangeZ + 1.55, sinkZ - 1.5, 5.15, 9.15, '-x', true);
  kit.addCabinetRun(W - 1.55, W - 0.15, sinkZ + 1.55, D - 0.4, 5.15, 9.15, '-x', true);

  // Pareve island — drawers face the camera
  const iX = 8, iZ = 9.0, iW = 6.2, iD = 3.2, iH = 3.05;
  kit.addRound(iW, iH - 0.3, iD, mats.creamCab, iX, (iH - 0.3) / 2 + 0.3, iZ, 0.05);
  kit.addBox(iW - 0.1, 0.28, iD - 0.1, mats.black, iX, 0.14, iZ);
  kit.addBox(iW + 0.08, 0.12, iD + 0.08, mats.marble, iX, iH + 0.02, iZ);
  // drawer faces on +z
  for (let col = 0; col < 3; col++) {
    const dx = iX - 2.0 + col * 2.0;
    for (let row = 0; row < 2; row++) {
      const dy = 0.7 + row * 1.05;
      kit.addBox(1.7, 0.85, 0.04, mats.trim, dx, dy, iZ + iD / 2 + 0.02);
      kit.addBox(0.18, 0.03, 0.04, mats.brass, dx, dy + 0.12, iZ + iD / 2 + 0.05);
    }
  }
  kit.addPendant(iX - 1.55, 7.15, iZ, H - 0.06);
  kit.addPendant(iX + 1.55, 7.15, iZ, H - 0.06);

  kit.addRug(iX, 13.2, 5.5, 3.2, mats.oriental);

  return {
    ...dollhouseView(W, D, H, { ox: 0.5, hy: H + 8.2, hz: 11.0, ty: 1.2, tz: 0.42, fov: 50, max: 40 }),
    sun, size: [W, D, H]
  };
}

function buildDiningShabbos(kit) {
  const { mats, THREE } = kit;
  const W = 20, D = 16, H = 9.5;
  kit.shell(W, D, H, { floor: mats.herring, noFront: true });
  const sun = kit.lights(W, D, H, [8, 14, 20]);

  // Wainscot on back and sides, flush to the wall
  kit.tagWall(kit.addBox(W - 0.1, 3.15, 0.08, mats.wainscot, W / 2, 1.58, 0.18), 'back', W, D);
  kit.tagWall(kit.addBox(0.08, 3.15, D - 0.1, mats.wainscot, 0.18, 1.58, D / 2), 'left', W, D);
  kit.tagWall(kit.addBox(0.08, 3.15, D - 0.1, mats.wainscot, W - 0.18, 1.58, D / 2), 'right', W, D);
  kit.tagWall(kit.addBox(W - 0.1, 0.08, 0.1, mats.trim, W / 2, 3.2, 0.24), 'back', W, D);
  kit.tagWall(kit.addBox(0.1, 0.08, D - 0.1, mats.trim, 0.24, 3.2, D / 2), 'left', W, D);
  kit.tagWall(kit.addBox(0.1, 0.08, D - 0.1, mats.trim, W - 0.24, 3.2, D / 2), 'right', W, D);

  // Two windows on the BACK wall, curtains flush on a rod — no floating strips
  kit.addWindow('back', 6.2, 3.2, 3.35, 4.3, W, D, H, { curtains: true });
  kit.addWindow('back', 13.8, 3.2, 3.35, 4.3, W, D, H, { curtains: true });

  // Table 12 x 4, cloth, 5+5+2 chairs with clear gaps
  const tX = 10, tZ = 8.0, tW = 12, tD = 4.0;
  kit.addRound(tW, 0.14, tD, mats.walnut, tX, 2.52, tZ, 0.04);
  // legs inset so they don't meet chairs
  [[-5.2, -1.55], [5.2, -1.55], [-5.2, 1.55], [5.2, 1.55]].forEach((p) => {
    kit.addCyl(0.08, 0.1, 2.45, 12, mats.walnut, tX + p[0], 1.22, tZ + p[1]);
  });
  kit.addBox(tW + 0.16, 0.05, tD + 0.16, mats.white, tX, 2.62, tZ);
  // challah board + two candlesticks
  kit.addRound(1.3, 0.05, 0.7, mats.oak, tX, 2.68, tZ, 0.02);
  kit.addBox(0.7, 0.14, 0.35, mats.linen, tX, 2.78, tZ);
  kit.addCyl(0.04, 0.07, 0.55, 10, mats.brass, tX - 1.6, 2.95, tZ);
  kit.addCyl(0.04, 0.07, 0.55, 10, mats.brass, tX + 1.6, 2.95, tZ);
  kit.addCyl(0.015, 0.015, 0.18, 6, mats.emissiveAmber, tX - 1.6, 3.3, tZ).castShadow = false;
  kit.addCyl(0.015, 0.015, 0.18, 6, mats.emissiveAmber, tX + 1.6, 3.3, tZ).castShadow = false;

  const seatY = 1.7;
  // long sides: 5 chairs, 2.4' centers, seat 1.05 — 1.35' clear between
  for (let i = 0; i < 5; i++) {
    const cx = 5.2 + i * 2.4;
    kit.addChair(cx, seatY, tZ - 2.72, 0, 'wood');
    kit.addChair(cx, seatY, tZ + 2.72, Math.PI, 'wood');
  }
  // end chairs, clear of the table and side chairs
  kit.addChair(tX - 7.05, seatY, tZ, Math.PI / 2, 'wood');
  kit.addChair(tX + 7.05, seatY, tZ, -Math.PI / 2, 'wood');

  // Sideboard left
  kit.addRound(1.6, 2.7, 5.2, mats.darkWood, 1.2, 1.35, 8, 0.05);
  kit.addBox(1.7, 0.1, 5.4, mats.darkWood, 1.2, 2.75, 8);
  kit.addCyl(0.12, 0.16, 0.28, 12, mats.brass, 1.2, 2.95, 6.6);
  kit.addCyl(0.12, 0.16, 0.28, 12, mats.brass, 1.2, 2.95, 9.4);

  // China cabinet right, proper carcass + glass doors + dishes
  addChinaCabinet(kit, 18.55, 8.2, 2.2, 7.2, 1.5);

  kit.addRug(tX, tZ, 14.5, 8.4, mats.oriental);
  kit.addBrassChandelier(tX, 6.55, tZ, 6, H - 0.06);

  return {
    ...dollhouseView(W, D, H, { ox: 0.55, hy: H + 7.6, hz: 9.5, ty: 1.15, tz: 0.42, fov: 48 }),
    sun,
    size: [W, D, H],
    alts: [
      { camera: [4.5, 5.2, 14.5], target: [11, 3.2, 7.5] },
      { camera: [16, 5.4, 13.8], target: [9, 3.1, 7.2] }
    ]
  };
}

function addChinaCabinet(kit, x, z, w, h, d) {
  const { mats } = kit;
  const lowerH = 2.5;
  // Hollow carcass so shelves and dishes are actually visible
  kit.addBox(w, h, 0.12, mats.creamCab, x, h / 2, z - d / 2 + 0.06);
  kit.addBox(0.16, h, d, mats.creamCab, x - w / 2 + 0.08, h / 2, z);
  kit.addBox(0.16, h, d, mats.creamCab, x + w / 2 - 0.08, h / 2, z);
  kit.addBox(w, 0.12, d, mats.creamCab, x, 0.06, z);
  kit.addBox(w, 0.12, d, mats.creamCab, x, h - 0.06, z);
  kit.addBox(w - 0.15, h - 0.2, 0.04, mats.walnut, x, h / 2, z - d / 2 + 0.12);
  // lower solid doors
  kit.addBox(w - 0.2, lowerH - 0.2, 0.05, mats.creamCab, x, 1.35, z + d / 2 + 0.01);
  kit.addBox(0.03, lowerH - 0.45, 0.03, mats.trim, x, 1.35, z + d / 2 + 0.05);
  kit.addSph(0.03, 8, mats.brass, x - 0.18, 1.35, z + d / 2 + 0.08);
  kit.addSph(0.03, 8, mats.brass, x + 0.18, 1.35, z + d / 2 + 0.08);
  // upper glass doors with muntins
  const uy = lowerH + (h - lowerH) / 2 + 0.05;
  const uh = h - lowerH - 0.25;
  kit.addBox(w - 0.22, uh, 0.03, mats.glassClear, x, uy, z + d / 2 + 0.02);
  kit.addBox(0.045, uh, 0.04, mats.trim, x, uy, z + d / 2 + 0.05);
  kit.addBox(w - 0.28, 0.04, 0.04, mats.trim, x, uy, z + d / 2 + 0.05);
  kit.addBox(w - 0.28, 0.04, 0.04, mats.trim, x, uy - uh / 4, z + d / 2 + 0.05);
  kit.addBox(w - 0.28, 0.04, 0.04, mats.trim, x, uy + uh / 4, z + d / 2 + 0.05);
  // shelves + dishes inside the case
  for (let i = 0; i < 3; i++) {
    const sy = lowerH + 0.55 + i * 1.15;
    kit.addBox(w - 0.25, 0.05, d - 0.25, mats.creamCab, x, sy, z);
    for (let k = -1; k <= 1; k++) {
      kit.addCyl(0.14, 0.12, 0.06, 16, mats.porcelain, x + k * 0.5, sy + 0.06, z + 0.1);
      kit.addCyl(0.1, 0.12, 0.16, 16, mats.porcelain, x + k * 0.5, sy + 0.16, z + 0.1);
    }
  }
  kit.addBox(w + 0.12, 0.14, d + 0.08, mats.creamCab, x, h + 0.05, z);
}

function buildDiningYomTov(kit) {
  const { mats } = kit;
  const W = 22, D = 16, H = 9.6;
  kit.shell(W, D, H, { floor: mats.herring, noFront: true });
  const sun = kit.lights(W, D, H, [9, 14, 20]);

  kit.tagWall(kit.addBox(W - 0.1, 3.15, 0.08, mats.wainscot, W / 2, 1.58, 0.18), 'back', W, D);
  kit.tagWall(kit.addBox(0.08, 3.15, D - 0.1, mats.wainscot, 0.18, 1.58, D / 2), 'left', W, D);
  kit.tagWall(kit.addBox(0.08, 3.15, D - 0.1, mats.wainscot, W - 0.18, 1.58, D / 2), 'right', W, D);
  kit.tagWall(kit.addBox(W - 0.1, 0.08, 0.1, mats.trim, W / 2, 3.2, 0.24), 'back', W, D);

  // Windows on the back wall only, curtains flush — no vertical bars in the room
  kit.addWindow('back', 6.5, 3.4, 3.35, 4.4, W, D, H, { curtains: true });
  kit.addWindow('back', 15.5, 3.4, 3.35, 4.4, W, D, H, { curtains: true });

  const tX = 11, tZ = 8.0, tW = 16, tD = 4.0;
  kit.addRound(tW, 0.14, tD, mats.walnut, tX, 2.52, tZ, 0.04);
  [[-7.2, -1.55], [7.2, -1.55], [-7.2, 1.55], [7.2, 1.55]].forEach((p) => {
    kit.addCyl(0.08, 0.1, 2.45, 12, mats.walnut, tX + p[0], 1.22, tZ + p[1]);
  });
  kit.addBox(tW + 0.16, 0.05, tD + 0.16, mats.white, tX, 2.62, tZ);
  // floral runner + candlesticks
  kit.addBox(11, 0.02, 1.1, mats.burgundy, tX, 2.66, tZ);
  kit.addCyl(0.05, 0.08, 0.6, 10, mats.brass, tX - 2.4, 2.98, tZ);
  kit.addCyl(0.05, 0.08, 0.6, 10, mats.brass, tX + 2.4, 2.98, tZ);
  kit.addCyl(0.015, 0.015, 0.16, 6, mats.emissiveAmber, tX - 2.4, 3.35, tZ).castShadow = false;
  kit.addCyl(0.015, 0.015, 0.16, 6, mats.emissiveAmber, tX + 2.4, 3.35, tZ).castShadow = false;

  const seatY = 1.7;
  // 7 chairs per long side, 2.13' centers, 1.05 seat → ~1.08' gap
  for (let i = 0; i < 7; i++) {
    const cx = 4.6 + i * 2.13;
    kit.addChair(cx, seatY, tZ - 2.72, 0, 'upholstered');
    kit.addChair(cx, seatY, tZ + 2.72, Math.PI, 'upholstered');
  }
  kit.addChair(tX - 9.15, seatY, tZ, Math.PI / 2, 'upholstered');
  kit.addChair(tX + 9.15, seatY, tZ, -Math.PI / 2, 'upholstered');

  // Cream china cabinet on the left
  addChinaCabinet(kit, 1.35, 8.0, 2.2, 7.4, 1.55);

  // Dark sideboard + gold mirror on the right
  kit.addRound(1.55, 2.55, 5.6, mats.darkWood, W - 1.15, 1.28, 8, 0.05);
  kit.addBox(1.65, 0.1, 5.8, mats.darkWood, W - 1.15, 2.62, 8);
  kit.addBox(0.06, 3.2, 2.2, mats.brass, W - 0.22, 5.3, 8);
  kit.addBox(0.03, 2.95, 1.95, mats.glass, W - 0.26, 5.3, 8);

  kit.addRug(tX, tZ, 18, 8.6, mats.oriental);
  // Two crystal chandeliers along the table
  kit.addCrystalChandelier(tX - 3.6, 6.7, tZ, H - 0.06);
  kit.addCrystalChandelier(tX + 3.6, 6.7, tZ, H - 0.06);

  return {
    ...dollhouseView(W, D, H, { ox: 0.55, hy: H + 7.8, hz: 9.8, ty: 1.15, tz: 0.42, fov: 48 }),
    sun,
    size: [W, D, H],
    alts: [
      { camera: [5, 5.3, 14.8], target: [12, 3.2, 7.4] },
      { camera: [18, 5.4, 14.2], target: [10, 3.1, 7.2] }
    ]
  };
}

function buildBedroom(kit) {
  const { mats, THREE, RoundedBoxGeometry } = kit;
  const W = 16, D = 14, H = 9.2;
  kit.shell(W, D, H, { floor: mats.herring, noFront: true, wall: mats.plaster });
  const sun = kit.lights(W, D, H, [6, 13, 18]);

  // Bay window on the back wall with curtains
  kit.addWindow('back', W / 2, 5.4, 2.6, 5.2, W, D, H, { curtains: true, mullion: true });
  // shallow bay bump
  kit.addBox(5.8, 0.08, 1.1, mats.trim, W / 2, 2.55, 0.55);

  function addBed(cx, cz) {
    // upholstered headboard against the left/right? beds along the side walls, heads toward the back? 
    // Photo: two twins side by side, heads toward the left or back. Layout OK: two beds + nightstand between, heads toward back wall.
    const bw = 4.0, bd = 6.6;
    // frame + legs
    kit.addRound(bw, 0.35, bd, mats.walnut, cx, 0.7, cz, 0.04);
    [[-1.7, -2.9], [1.7, -2.9], [-1.7, 2.9], [1.7, 2.9]].forEach((p) => {
      kit.addCyl(0.05, 0.06, 0.55, 10, mats.walnut, cx + p[0], 0.28, cz + p[1]);
    });
    // mattress
    kit.addRound(bw - 0.12, 0.45, bd - 0.16, mats.white, cx, 1.08, cz, 0.05);
    // duvet, slightly inset, with a folded-back band at the head
    kit.addRound(bw - 0.28, 0.16, bd - 0.7, mats.linen, cx, 1.36, cz + 0.15, 0.06);
    // folded-over cuff near the pillows
    kit.addRound(bw - 0.32, 0.08, 0.7, mats.white, cx, 1.44, cz - bd / 2 + 1.55, 0.04);
    // two sleeping pillows + one sham
    kit.addRound(1.7, 0.38, 1.25, mats.white, cx - 0.72, 1.62, cz - bd / 2 + 0.9, 0.1);
    kit.addRound(1.7, 0.38, 1.25, mats.white, cx + 0.72, 1.62, cz - bd / 2 + 0.9, 0.1);
    kit.addRound(1.85, 0.28, 0.8, mats.linen, cx, 1.88, cz - bd / 2 + 0.75, 0.1);
    // upholstered headboard, floor-standing, with a welted border
    kit.addRound(bw + 0.15, 3.35, 0.12, mats.walnut, cx, 1.8, cz - bd / 2 - 0.12, 0.02);
    kit.addRound(bw + 0.05, 3.2, 0.22, mats.linen, cx, 1.8, cz - bd / 2 + 0.02, 0.06);
  }

  // two beds with a nightstand between; optional second nightstand on the far side of the left bed
  const bedZ = 6.6;
  addBed(4.15, bedZ);
  addBed(11.85, bedZ);
  // center nightstand + lamp
  kit.addRound(1.7, 2.15, 1.5, mats.walnut, 8, 1.08, 3.55, 0.05);
  kit.addBox(1.8, 0.08, 1.6, mats.walnut, 8, 2.18, 3.55);
  kit.addTableLamp(8, 2.22, 3.55);
  // second nightstand to the left of the left bed
  kit.addRound(1.5, 2.0, 1.4, mats.walnut, 1.35, 1.0, 3.55, 0.05);
  kit.addTableLamp(1.35, 2.05, 3.55);

  // armchair in the front-right corner
  kit.addRound(2.2, 1.35, 2.2, mats.linen, 13.6, 1.0, 11.3, 0.08);
  kit.addRound(2.2, 1.5, 0.4, mats.linen, 13.6, 2.15, 10.4, 0.08);
  kit.addRound(0.35, 1.5, 2.0, mats.linen, 12.65, 2.0, 11.3, 0.07);
  kit.addRound(0.35, 1.5, 2.0, mats.linen, 14.55, 2.0, 11.3, 0.07);
  kit.addRug(8, 7.5, 11, 8.5, mats.oriental);

  // small picture on the right wall, not in the window
  kit.addBox(0.06, 1.5, 1.3, mats.walnut, W - 0.22, 5.4, 10.5);
  kit.addBox(0.03, 1.3, 1.1, mats.green, W - 0.26, 5.4, 10.5);

  return {
    ...dollhouseView(W, D, H, { ox: 0.5, hy: H + 7.2, hz: 9.0, ty: 1.1, tz: 0.45, fov: 48 }),
    sun,
    size: [W, D, H],
    alts: [
      { camera: [3.2, 4.8, 12.8], target: [9, 2.6, 6] },
      { camera: [13.2, 4.9, 12.5], target: [7.5, 2.6, 5.8] }
    ]
  };
}

function buildKids(kit) {
  const { mats } = kit;
  const W = 14, D = 13, H = 9.2;
  kit.shell(W, D, H, { floor: mats.herring, noFront: true, wall: mats.floral });
  // plaster upper? floral is the wallpaper — keep a painted chair rail / lower panel
  kit.tagWall(kit.addBox(W - 0.1, 3.0, 0.06, mats.cream, W / 2, 1.5, 0.2), 'back', W, D);
  kit.tagWall(kit.addBox(0.06, 3.0, D - 0.1, mats.cream, 0.2, 1.5, D / 2), 'left', W, D);
  kit.tagWall(kit.addBox(0.06, 3.0, D - 0.1, mats.cream, W - 0.2, 1.5, D / 2), 'right', W, D);
  kit.tagWall(kit.addBox(W - 0.1, 0.08, 0.08, mats.trim, W / 2, 3.04, 0.24), 'back', W, D);
  const sun = kit.lights(W, D, H, [5, 13, 17]);

  kit.addWindow('right', 6.5, 3.2, 3.1, 4.2, W, D, H, { curtains: true, curtainMat: mats.curtainSage });

  // Built-in sage bunk along the left wall — hollow openings, not a solid block
  const bx = 2.05, bz = 6.5, bW = 3.9, bD = 7.4;
  kit.addBox(0.18, 8.4, bD, mats.sage, 0.24, 4.2, bz);
  kit.addRound(bW, 8.4, 0.22, mats.sage, bx, 4.2, bz - bD / 2, 0.04);
  kit.addRound(bW, 8.4, 0.22, mats.sage, bx, 4.2, bz + bD / 2, 0.04);
  kit.addRound(bW, 0.2, bD, mats.sage, bx, 8.4, bz, 0.03);
  // front posts
  kit.addRound(0.22, 8.4, 0.22, mats.sage, bx + bW / 2 - 0.05, 4.2, bz - bD / 2, 0.04);
  kit.addRound(0.22, 8.4, 0.22, mats.sage, bx + bW / 2 - 0.05, 4.2, bz + bD / 2, 0.04);
  function bunk(y) {
    // platform + front rail beam
    kit.addRound(bW - 0.1, 0.16, bD - 0.2, mats.sage, bx, y, bz, 0.03);
    kit.addRound(bW - 0.2, 0.35, bD - 0.3, mats.white, bx + 0.08, y + 0.28, bz, 0.05);
    kit.addRound(bW - 0.35, 0.14, bD - 1.0, mats.linenSage, bx + 0.1, y + 0.5, bz + 0.2, 0.05);
    kit.addRound(1.35, 0.22, 0.95, mats.white, bx + 0.1, y + 0.7, bz - 2.45, 0.06);
    kit.addRound(1.35, 0.22, 0.95, mats.white, bx + 0.1, y + 0.7, bz - 1.25, 0.06);
    kit.addCyl(0.04, 0.04, bD - 1.0, 10, mats.brass, bx + bW / 2 - 0.12, y + 1.45, bz, 0, Math.PI / 2);
    kit.addCyl(0.04, 0.04, 1.15, 10, mats.brass, bx + bW / 2 - 0.12, y + 0.9, bz - bD / 2 + 0.55);
    kit.addCyl(0.04, 0.04, 1.15, 10, mats.brass, bx + bW / 2 - 0.12, y + 0.9, bz + bD / 2 - 0.55);
  }
  // under-bed base with drawers, then two bunks
  kit.addRound(bW, 0.7, bD, mats.sage, bx, 0.35, bz, 0.04);
  bunk(0.75);
  bunk(4.55);
  for (let i = 0; i < 3; i++) {
    const dz = bz - 2.2 + i * 2.2;
    kit.addRound(0.08, 0.55, 1.8, mats.sageDeep, bx + bW / 2 + 0.02, 0.38, dz, 0.03);
    kit.addSph(0.035, 8, mats.brass, bx + bW / 2 + 0.08, 0.38, dz);
  }
  const lx = bx + bW / 2 + 0.15, lz = bz + bD / 2 + 0.18;
  kit.addCyl(0.04, 0.04, 7.4, 10, mats.brass, lx - 0.55, 3.8, lz);
  kit.addCyl(0.04, 0.04, 7.4, 10, mats.brass, lx + 0.55, 3.8, lz);
  for (let i = 0; i < 8; i++) kit.addCyl(0.03, 0.03, 1.15, 10, mats.brass, lx, 0.7 + i * 0.85, lz, 0, Math.PI / 2);

  // Desk on the back wall, clear of the bunk — top, legs, and a drawer, not a solid cube
  kit.addRound(3.6, 0.12, 1.7, mats.oak, 8.6, 2.44, 1.15, 0.04);
  [[-1.55, -0.65], [1.55, -0.65], [-1.55, 0.65], [1.55, 0.65]].forEach((p) => {
    kit.addCyl(0.06, 0.07, 2.38, 12, mats.oak, 8.6 + p[0], 1.19, 1.15 + p[1]);
  });
  kit.addRound(3.1, 0.4, 1.4, mats.oak, 8.6, 2.18, 1.15, 0.03);
  kit.addBox(1.2, 0.28, 0.05, mats.trim, 8.6, 2.18, 1.15 + 0.88);
  kit.addSph(0.03, 8, mats.brass, 8.6, 2.18, 2.08);
  kit.addTableLamp(7.3, 2.48, 1.2);
  // books and a notebook on the desk
  kit.addBox(0.7, 0.08, 0.5, mats.burgundy, 9.5, 2.54, 1.3);
  kit.addBox(0.55, 0.06, 0.4, mats.green, 9.55, 2.61, 1.3);
  kit.addBox(0.5, 0.02, 0.65, mats.paper, 8.7, 2.5, 1.5);

  // desk chair, clearly in front of the desk, not in the bunk
  kit.addChair(8.6, 1.55, 3.15, Math.PI, 'wood');

  kit.addRug(8.5, 7.5, 6.5, 6.5, mats.rug);
  // small plant in the corner
  kit.addCyl(0.16, 0.2, 0.35, 12, mats.oak, 12.6, 0.2, 11.4);
  kit.addSph(0.28, 10, mats.green, 12.6, 0.7, 11.4);

  return {
    ...dollhouseView(W, D, H, { ox: 0.72, hy: H + 7.0, hz: 8.6, tx: 0.42, ty: 1.2, tz: 0.42, fov: 48 }),
    sun,
    size: [W, D, H],
    alts: [
      { camera: [11.5, 5.0, 11.5], target: [5, 3.4, 6.5] },
      { camera: [6.5, 4.6, 12.8], target: [6, 2.8, 5] }
    ]
  };
}

function buildLiving(kit) {
  const { mats } = kit;
  const W = 18, D = 14, H = 9.4;
  kit.shell(W, D, H, { floor: mats.herring, noFront: true });
  const sun = kit.lights(W, D, H, [6, 14, 18]);

  // Window on the left wall, with curtains
  kit.addWindow('left', 4.2, 3.2, 2.7, 5.0, W, D, H, { curtains: true });

  // Hollow seforim wall on the RIGHT — books face INTO the room
  const caseD = 1.35, caseX = W - caseD / 2;
  kit.addBox(0.12, 8.9, 13.5, mats.walnut, W - 0.18, 4.45, D / 2);
  kit.addBox(caseD, 8.9, 0.14, mats.walnut, caseX, 4.45, 0.3);
  kit.addBox(caseD, 8.9, 0.14, mats.walnut, caseX, 4.45, D - 0.3);
  kit.addBox(caseD + 0.1, 0.2, 13.5, mats.walnut, caseX, 9.05, D / 2);
  for (let i = 0; i < 8; i++) {
    const y = 0.5 + i * 1.08;
    kit.addBox(caseD - 0.1, 0.07, 13.1, mats.walnut, caseX, y, D / 2);
    // spines on the room-facing edge
    kit.addBox(0.8, 0.92, 12.8, mats.books, W - caseD + 0.35, y + 0.5, D / 2);
  }
  kit.addCyl(0.03, 0.03, 12.5, 8, mats.brass, W - caseD - 0.15, 8.7, D / 2, Math.PI / 2, 0);
  const ladZ = 5.5;
  kit.addCyl(0.035, 0.035, 8.3, 8, mats.brass, W - caseD - 0.15, 4.2, ladZ - 0.7);
  kit.addCyl(0.035, 0.035, 8.3, 8, mats.brass, W - caseD - 0.15, 4.2, ladZ + 0.7);
  for (let i = 0; i < 8; i++) kit.addCyl(0.025, 0.025, 1.4, 8, mats.brass, W - caseD - 0.15, 0.7 + i * 0.95, ladZ, Math.PI / 2, 0);

  // Sofa along the BACK wall, facing the camera, so the opening view shows sofa + table + seforim wall
  kit.addSofa(7.0, 3.35, 8.4, 3.15, 0);

  // Round coffee table — 64-seg cylinder, not a 12-gon
  kit.addCyl(1.45, 1.45, 0.1, 64, mats.walnut, 7.4, 1.55, 7.15);
  kit.addCyl(0.18, 0.22, 1.45, 24, mats.walnut, 7.4, 0.8, 7.15);
  kit.addCyl(0.7, 0.7, 0.08, 32, mats.walnut, 7.4, 0.08, 7.15);
  kit.addBox(0.5, 0.05, 0.7, mats.burgundy, 7.1, 1.63, 6.85);
  kit.addCyl(0.16, 0.12, 0.08, 20, mats.brass, 7.9, 1.64, 7.45);

  kit.addRug(8.0, 7.0, 10.5, 8.5, mats.oriental);
  kit.addFloorLamp(2.4, 6.8);

  // A pair of chairs near the book wall, not intersecting it
  kit.addChair(12.6, 1.55, 8.6, -Math.PI * 0.55, 'upholstered');
  kit.addChair(12.2, 1.55, 11.2, -Math.PI * 0.25, 'upholstered');

  return {
    ...dollhouseView(W, D, H, { ox: 0.42, hy: H + 7.4, hz: 9.2, tx: 0.52, ty: 1.1, tz: 0.42, fov: 48 }),
    sun,
    size: [W, D, H],
    alts: [
      { camera: [3.6, 5.0, 11.8], target: [10, 2.6, 6.5] },
      { camera: [13.2, 5.0, 12.4], target: [7.5, 2.5, 6.2] }
    ]
  };
}

function buildFoyer(kit) {
  const { mats, THREE, RoundedBoxGeometry } = kit;
  const W = 13, D = 18, H = 11;
  kit.shell(W, D, H, { floor: mats.checker, noFront: true, ceiling: mats.white });
  const sun = kit.lights(W, D, H, [5, 16, 22]);

  // Arched front-door on the LEFT wall, near the front
  const doorZ = 14.2, doorW = 3.2, doorH = 8.0;
  kit.addPaneledDoor(0.16, 0, doorZ, doorW, doorH, '+x', mats.darkWood);
  // Clean lintel over the door (a full cylinder read as a disk from above)
  kit.addBox(0.14, 0.2, doorW + 0.55, mats.trim, 0.16, doorH + 0.1, doorZ);

  // Console + gold mirror on the BACK wall — top, apron, legs, not a solid block
  kit.addRound(4.4, 0.12, 1.45, mats.darkWood, 4.6, 2.72, 0.85, 0.04);
  kit.addRound(4.1, 0.45, 1.25, mats.darkWood, 4.6, 2.4, 0.85, 0.03);
  kit.addCyl(0.09, 0.11, 2.35, 12, mats.darkWood, 2.85, 1.16, 0.45);
  kit.addCyl(0.09, 0.11, 2.35, 12, mats.darkWood, 6.35, 1.16, 0.45);
  kit.addCyl(0.09, 0.11, 2.35, 12, mats.darkWood, 2.85, 1.16, 1.25);
  kit.addCyl(0.09, 0.11, 2.35, 12, mats.darkWood, 6.35, 1.16, 1.25);
  kit.addBox(2.3, 3.1, 0.08, mats.brass, 4.6, 5.5, 0.22);
  kit.addBox(2.05, 2.85, 0.04, mats.glass, 4.6, 5.5, 0.27);
  // a bowl on the console
  kit.addCyl(0.28, 0.2, 0.12, 20, mats.brass, 4.6, 2.88, 0.9);
  // wall sconce
  kit.addCyl(0.04, 0.04, 0.2, 8, mats.brass, 7.4, 5.6, 0.2, 0, Math.PI / 2);
  kit.addCyl(0.12, 0.16, 0.28, 12, mats.linen, 7.4, 5.35, 0.4);

  // Straight stair attached to the RIGHT wall, with stringers, risers, treads,
  // newel, balusters, and a top landing — not floating blocks.
  const rise = 0.625, run = 0.90, nRisers = 14;
  const stairW = 3.55;
  const wallX = W; // right wall inner is ~W, treads go from wallX-stairW to wallX-0.02
  const outerX = wallX - stairW;
  const zStart = 16.0; // first riser near the front
  const dir = -1; // going toward the back
  const nosing = 0.08;
  const treadT = 0.12, riserT = 0.06;

  // Closed stringers (wall side + outer) — sloped carriages under the flight
  const runLen = (nRisers - 1) * run; // 13 runs to the last tread / landing face
  const totalRise = nRisers * rise;
  const stringerLen = Math.hypot(runLen, totalRise) - 0.35;
  const angle = Math.atan2(totalRise, runLen);
  function placeStringer(x) {
    const midZ = zStart + dir * (runLen / 2);
    const midY = totalRise / 2;
    const s = kit.addBox(0.22, 0.85, stringerLen, mats.walnut, x, midY, midZ);
    s.rotation.x = dir * -angle; // pitch along Z
  }
  placeStringer(wallX - 0.10);
  placeStringer(outerX + 0.08);

  // Risers and treads
  for (let i = 0; i < nRisers; i++) {
    const y0 = i * rise;
    const zRiser = zStart + dir * i * run;
    // riser board, full width, sitting on the stringers, flush to the previous tread's back
    kit.addBox(stairW - 0.06, rise, riserT, mats.walnut, (outerX + wallX) / 2 - 0.02, y0 + rise / 2, zRiser);
    // tread on top of this riser, with nosing toward the front (opposite dir)
    if (i < nRisers - 1) {
      const zTread = zRiser + dir * (run / 2) - dir * nosing / 2;
      kit.addRound(stairW - 0.28, treadT, run + nosing, mats.oak, (outerX + wallX) / 2 + 0.04, y0 + rise + treadT / 2, zTread, 0.02);
    }
  }
  // Landing at the top, attached to the back wall and the right wall
  const landY = totalRise;
  const landFrontZ = zStart + dir * runLen; // ~4.3
  const landDepth = landFrontZ - 0.14; // extends to the back wall
  const landCZ = 0.14 + landDepth / 2;
  kit.addRound(stairW - 0.1, treadT, landDepth, mats.oak, (outerX + wallX) / 2 + 0.04, landY + treadT / 2, landCZ, 0.02);
  // landing apron / riser already placed as last riser

  // Framed opening from the landing into a short upstairs hall (real back wall, no glow void)
  const openW = 2.8, openH = H - landY - 0.3;
  kit.addBox(openW + 0.3, 0.1, 0.14, mats.trim, (outerX + wallX) / 2, landY + openH + 0.1, 0.16);
  kit.addBox(0.1, openH, 0.14, mats.trim, (outerX + wallX) / 2 - openW / 2, landY + openH / 2, 0.16);
  kit.addBox(0.1, openH, 0.14, mats.trim, (outerX + wallX) / 2 + openW / 2, landY + openH / 2, 0.16);
  // short hall behind the back wall
  kit.addBox(openW + 0.8, openH + 0.4, 0.2, mats.plaster, (outerX + wallX) / 2, landY + openH / 2, -1.7);
  kit.addBox(0.2, openH + 0.4, 1.8, mats.plaster, (outerX + wallX) / 2 - openW / 2 - 0.3, landY + openH / 2, -0.9);
  kit.addBox(0.2, openH + 0.4, 1.8, mats.plaster, (outerX + wallX) / 2 + openW / 2 + 0.3, landY + openH / 2, -0.9);
  kit.addBox(openW + 0.8, 0.1, 1.8, mats.oak, (outerX + wallX) / 2, landY + 0.05, -0.9);

  // Bottom newel post — 6x6, attached at the outer corner of the first tread, cap + ball
  const newelX = outerX - 0.02;
  const newelZ = zStart + 0.18;
  kit.addRound(0.32, 3.55, 0.32, mats.walnut, newelX, 1.78, newelZ, 0.03);
  kit.addRound(0.4, 0.1, 0.4, mats.walnut, newelX, 3.58, newelZ, 0.02);
  kit.addSph(0.11, 12, mats.walnut, newelX, 3.72, newelZ);

  // Top newel at the landing outer/front corner
  const topNewelZ = landFrontZ + 0.1;
  const topNewelY = landY;
  kit.addRound(0.32, 2.95, 0.32, mats.walnut, newelX, topNewelY + 1.5, topNewelZ, 0.03);
  kit.addRound(0.4, 0.1, 0.4, mats.walnut, newelX, topNewelY + 3.02, topNewelZ, 0.02);
  kit.addSph(0.11, 12, mats.walnut, newelX, topNewelY + 3.16, topNewelZ);

  // Balusters: two per tread along the outer edge, from tread to rail
  const railHeight = 2.7;
  for (let i = 0; i < nRisers - 1; i++) {
    const yT = (i + 1) * rise + treadT;
    const zT0 = zStart + dir * i * run + dir * run * 0.3;
    const zT1 = zStart + dir * i * run + dir * run * 0.7;
    [zT0, zT1].forEach((zz) => {
      kit.addBox(0.055, railHeight, 0.055, mats.walnut, outerX + 0.16, yT + railHeight / 2, zz);
    });
  }
  // Landing balusters along the open front and the outer (left) edge
  for (let i = 0; i < 4; i++) {
    const zz = landFrontZ - 0.35 - i * 0.7;
    if (zz < 0.4) break;
    kit.addBox(0.055, railHeight, 0.055, mats.walnut, outerX + 0.16, landY + railHeight / 2 + 0.06, zz);
  }
  for (let i = 1; i < 5; i++) {
    const xx = outerX + 0.5 + i * 0.55;
    if (xx > wallX - 0.3) break;
    kit.addBox(0.055, railHeight, 0.055, mats.walnut, xx, landY + railHeight / 2 + 0.06, landFrontZ - 0.12);
  }

  // Handrails span only from the bottom newel to the top newel — no overshoot past the first riser
  const railZ0 = newelZ;                 // bottom newel
  const railZ1 = topNewelZ;              // top newel
  const railY0 = rise + treadT + railHeight;
  const railY1 = landY + railHeight + 0.06;
  const railSpan = Math.hypot(railZ1 - railZ0, railY1 - railY0);
  const railPitch = Math.atan2(railY1 - railY0, railZ0 - railZ1); // +X rotation: back end goes up
  const railMidZ = (railZ0 + railZ1) / 2;
  const railMidY = (railY0 + railY1) / 2;
  const rail = kit.addBox(0.08, 0.1, railSpan, mats.oak, outerX + 0.16, railMidY, railMidZ);
  rail.rotation.x = railPitch;
  // landing rails, ending at the top newel / landing front
  kit.addBox(0.08, 0.1, Math.max(0.4, landDepth - 0.45), mats.oak, outerX + 0.16, railY1, landCZ - 0.08);
  kit.addBox(stairW - 0.4, 0.1, 0.08, mats.oak, (outerX + wallX) / 2 + 0.1, railY1, landFrontZ - 0.12);



  // No ceiling fixture — a beam would have to stop short of the stair and float.

  return {
    ...dollhouseView(W, D, H, { ox: 0.22, hy: H + 8.0, hz: 10.5, tx: 0.58, ty: 1.4, tz: 0.42, fov: 50, max: 40 }),
    sun,
    size: [W, D, H],
    alts: [
      { camera: [3.6, 5.0, 14.0], target: [9.2, 3.8, 8.5] },
      { camera: [6.2, 6.2, 19.0], target: [9.8, 4.5, 6.0] }
    ]
  };
}

function buildMudroom(kit) {
  const { mats } = kit;
  const W = 14, D = 12, H = 9.2;
  kit.shell(W, D, H, { floor: mats.herring, noFront: true });
  const sun = kit.lights(W, D, H, [5, 13, 16]);

  // Dark entry door + sidelight on the BACK wall (left), so the opening view shows door + storage
  kit.addPaneledDoor(3.15, 0, 0.16, 3.1, 7.5, '+z', mats.darkWood);
  kit.addBox(0.95, 6.8, 0.12, mats.trim, 5.4, 3.8, 0.16);
  const sky = new kit.THREE.MeshBasicMaterial({ color: 0xf3e4b8 });
  kit.addBox(0.62, 6.3, 0.04, sky, 5.4, 3.8, 0.08).castShadow = false;
  kit.addBox(0.04, 6.3, 0.04, mats.trim, 5.4, 3.8, 0.12);
  kit.addBox(0.62, 0.04, 0.04, mats.trim, 5.4, 3.8, 0.12);
  kit.addBox(0.62, 0.04, 0.04, mats.trim, 5.4, 2.4, 0.12);
  kit.addBox(0.62, 0.04, 0.04, mats.trim, 5.4, 5.2, 0.12);

  // Storage wall on the RIGHT — cubbies are recessed, baskets visible, bench + cushion
  const wallX = W - 0.15;
  const depth = 2.15;
  const cx = W - depth / 2 - 0.05;
  // tall end cabinets
  kit.addRound(depth, 8.9, 2.1, mats.creamCab, cx, 4.45, 1.4, 0.04);
  kit.addRound(depth, 8.9, 2.1, mats.creamCab, cx, 4.45, 10.6, 0.04);
  // door grooves + knobs
  kit.addBox(0.04, 7.6, 1.7, mats.trim, W - 0.12, 4.3, 1.4);
  kit.addBox(0.04, 7.6, 1.7, mats.trim, W - 0.12, 4.3, 10.6);
  kit.addSph(0.04, 8, mats.brass, W - 0.18, 4.3, 1.7);
  kit.addSph(0.04, 8, mats.brass, W - 0.18, 4.3, 10.3);

  // Middle bay: back panel (recessed), cubbies, hooks, bench
  const midZ0 = 2.55, midZ1 = 9.45, midW = midZ1 - midZ0;
  const backX = W - 0.22;
  kit.addBox(0.12, 8.9, midW, mats.creamCab, backX, 4.45, (midZ0 + midZ1) / 2);
  // upper cubbies with baskets — sitting IN FRONT of the back panel, clearly visible
  const cubbyY = 6.55;
  for (let i = 0; i < 5; i++) {
    const zz = midZ0 + 0.7 + i * 1.35;
    // dividers
    kit.addBox(depth - 0.25, 2.15, 0.06, mats.creamCab, cx + 0.05, cubbyY, zz - 0.65);
    kit.addBasket(cx + 0.05, cubbyY - 0.85, zz, 1.35, 1.05, 0.85);
  }
  kit.addBox(depth - 0.25, 2.15, 0.06, mats.creamCab, cx + 0.05, cubbyY, midZ1 - 0.15);
  // cubby shelf
  kit.addBox(depth - 0.15, 0.07, midW, mats.creamCab, cx, cubbyY - 1.05, (midZ0 + midZ1) / 2);
  kit.addBox(depth - 0.15, 0.07, midW, mats.creamCab, cx, cubbyY + 1.05, (midZ0 + midZ1) / 2);

  // Hook rail + coats that read as coats
  const hookY = 5.15;
  kit.addBox(0.08, 0.16, midW - 0.4, mats.oak, W - 2.0, hookY, (midZ0 + midZ1) / 2);
  const coatMats = [mats.burgundy, mats.green, mats.darkWood, mats.navy || mats.black];
  // navy fallback already black
  const coatZ = [3.5, 5.1, 6.7, 8.3];
  coatZ.forEach((zz, i) => {
    kit.addCoat(W - 2.05, hookY - 0.05, zz, coatMats[i], '-x');
  });

  // Oak bench with linen cushion, full width of the mid bay
  const benchY = 1.45;
  kit.addRound(1.7, 0.16, midW - 0.2, mats.oak, W - 1.55, benchY, (midZ0 + midZ1) / 2, 0.04);
  kit.addRound(1.55, 0.14, midW - 0.4, mats.linen, W - 1.55, benchY + 0.15, (midZ0 + midZ1) / 2, 0.06);
  // bench supports + open shoe cubbies underneath
  for (let i = 0; i <= 4; i++) {
    const zz = midZ0 + 0.4 + i * ((midW - 0.8) / 4);
    kit.addBox(1.5, benchY - 0.08, 0.08, mats.oak, W - 1.55, benchY / 2, zz);
  }
  kit.addBox(1.5, 0.06, midW - 0.2, mats.oak, W - 1.55, 0.12, (midZ0 + midZ1) / 2);
  // a couple of shoes as small dark forms
  kit.addRound(0.7, 0.16, 0.28, mats.black, W - 1.7, 0.28, 4.2, 0.05);
  kit.addRound(0.7, 0.16, 0.28, mats.black, W - 1.7, 0.28, 4.55, 0.05);

  // Runner down the center
  kit.addRug(5.2, 6, 3.2, 9.5, mats.oriental);

  return {
    ...dollhouseView(W, D, H, { ox: 0.38, hy: H + 7.2, hz: 8.8, tx: 0.52, ty: 1.2, tz: 0.42, fov: 50 }),
    sun,
    size: [W, D, H],
    alts: [
      { camera: [3.0, 4.8, 10.2], target: [9.5, 3.4, 6.5] },
      { camera: [7.8, 4.8, 13.6], target: [10, 3.3, 6.2] }
    ]
  };
}

function buildStudy(kit) {
  const { mats } = kit;
  const W = 14, D = 13, H = 9.2;
  kit.shell(W, D, H, { floor: mats.herring, noFront: true });
  const sun = kit.lights(W, D, H, [5, 13, 17]);

  kit.addWindow('left', 6.5, 3.2, 3.0, 4.4, W, D, H, { curtains: true });

  // Hollow book wall on the right — spines face the room
  const caseD = 1.3, caseX = W - caseD / 2;
  kit.addBox(0.12, 8.8, 12.4, mats.walnut, W - 0.16, 4.4, D / 2);
  kit.addBox(caseD, 8.8, 0.14, mats.walnut, caseX, 4.4, 0.4);
  kit.addBox(caseD, 8.8, 0.14, mats.walnut, caseX, 4.4, D - 0.4);
  kit.addBox(caseD + 0.08, 0.18, 12.4, mats.walnut, caseX, 9.0, D / 2);
  for (let i = 0; i < 8; i++) {
    const y = 0.5 + i * 1.07;
    kit.addBox(caseD - 0.1, 0.07, 11.9, mats.walnut, caseX, y, D / 2);
    kit.addBox(0.8, 0.9, 11.6, mats.books, W - caseD + 0.32, y + 0.5, D / 2);
  }

  // Desk in the middle, real legs + a drawer rail — not a solid cube
  const dx = 6.2, dz = 6.4;
  kit.addRound(5.4, 0.14, 2.6, mats.walnut, dx, 2.52, dz, 0.04);
  [[-2.35, -1.05], [2.35, -1.05], [-2.35, 1.05], [2.35, 1.05]].forEach((p) => {
    kit.addCyl(0.07, 0.08, 2.45, 12, mats.walnut, dx + p[0], 1.22, dz + p[1]);
  });
  // drawer apron
  kit.addRound(4.6, 0.45, 2.2, mats.walnut, dx, 2.22, dz, 0.03);
  kit.addBox(1.5, 0.35, 0.05, mats.trim, dx, 2.22, dz + 1.12);
  kit.addBox(0.22, 0.03, 0.04, mats.brass, dx, 2.22, dz + 1.16);
  // desk objects
  kit.addTableLamp(dx + 1.9, 2.6, dz - 0.5);
  kit.addBox(0.7, 0.08, 0.5, mats.burgundy, dx - 1.4, 2.64, dz + 0.3);
  kit.addBox(0.55, 0.06, 0.4, mats.green, dx - 1.35, 2.71, dz + 0.3);
  kit.addBox(1.1, 0.02, 0.8, mats.paper, dx + 0.2, 2.61, dz + 0.2);
  kit.addCyl(0.04, 0.04, 0.55, 8, mats.brass, dx + 0.5, 2.9, dz + 0.35);

  // Chair pulled up with clearance, not intersecting the desk (desk front z = 6.4+1.3=7.7? depth 2.6 so front is 6.4+1.3=7.7)
  // desk z from 5.1 to 7.7; chair at z=8.85 facing -z
  kit.addChair(dx, 1.6, 8.95, Math.PI, 'wood');

  // A leather armchair in the back corner
  kit.addRound(2.3, 1.3, 2.3, mats.leather, 3.0, 0.95, 2.0, 0.08);
  kit.addRound(2.3, 1.6, 0.4, mats.leather, 3.0, 2.15, 1.1, 0.08);
  kit.addRound(0.35, 1.5, 2.1, mats.leather, 2.05, 1.95, 2.0, 0.07);
  kit.addRound(0.35, 1.5, 2.1, mats.leather, 3.95, 1.95, 2.0, 0.07);

  kit.addRug(6.5, 6.5, 8.5, 7.5, mats.oriental);
  kit.addFloorLamp(3.6, 4.2);

  return {
    ...dollhouseView(W, D, H, { ox: 0.35, hy: H + 7.2, hz: 8.8, tx: 0.55, ty: 1.15, tz: 0.42, fov: 50 }),
    sun,
    size: [W, D, H],
    alts: [
      { camera: [3.4, 4.8, 11.5], target: [9, 3, 6] },
      { camera: [10.5, 5.0, 12.8], target: [6, 2.8, 6] }
    ]
  };
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
let THREE, OrbitControls, RoundedBoxGeometry, RoomEnvironment;
let renderer, camera, controls, scene, raf = 0, visible = false;
let currentId = null, envTexture = null, currentInfo = null;

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
  const seen = new Set();
  sc.traverse(function (o) {
    if (o.geometry && !seen.has(o.geometry)) {
      seen.add(o.geometry);
      o.geometry.dispose();
    }
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(function (m) {
        if (!m || seen.has(m)) return;
        seen.add(m);
        ['map', 'bumpMap', 'roughnessMap', 'normalMap', 'emissiveMap'].forEach(function (k) {
          if (m[k] && m[k].dispose && m[k] !== envTexture && !seen.has(m[k])) {
            seen.add(m[k]);
            m[k].dispose();
          }
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
  if (currentInfo && typeof currentInfo.updateCutaways === 'function') currentInfo.updateCutaways(camera);
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
    ({ RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js'));
    ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
  }
  const mobile = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
  renderer = new THREE.WebGLRenderer({
    canvas: e.canvas,
    antialias: !mobile,
    alpha: false,
    powerPreference: 'default'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.85));
  renderer.setSize(e.stage.clientWidth, Math.max(1, e.stage.clientHeight), false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  if (!envTexture) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }
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
  scene.environment = envTexture;
  if ('environmentIntensity' in scene) scene.environmentIntensity = 0.65;
  const kit = createKit(THREE, scene, RoundedBoxGeometry);
  const info = build(kit);
  info.updateCutaways = kit.updateCutaways;
  if (!info.top && info.size && info.size.length === 3) {
    const W = info.size[0], D = info.size[1], H = info.size[2];
    info.top = { camera: [W / 2, Math.max(H + 70, 90), D / 2 + 0.15], target: [W / 2, 0.15, D / 2], fov: 12 };
  }
  currentInfo = info;
  if (kit.updateCutaways) kit.updateCutaways({ position: { x: info.camera[0], y: info.camera[1], z: info.camera[2] } });
  const mobile = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
  if (mobile && info.sun) info.sun.shadow.mapSize.set(1024, 1024);
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const aspect = e.stage.clientWidth / Math.max(1, e.stage.clientHeight);
  const fov = info.fov || (aspect < 0.85 ? 54 : 46);
  camera = new THREE.PerspectiveCamera(fov, aspect, 0.15, 400);
  camera.position.set(info.camera[0], info.camera[1], info.camera[2]);
  controls = new OrbitControls(camera, e.canvas);
  controls.target.set(info.target[0], info.target[1], info.target[2]);
  controls.enableDamping = !reduced;
  controls.dampingFactor = 0.08;
  controls.minDistance = info.min || 5;
  controls.maxDistance = info.max || 140;
  controls.minPolarAngle = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.06;
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
  renderer.render(scene, camera);
}

function poseCamera(cx, cy, cz, tx, ty, tz, fov) {
  if (!camera || !controls) return;
  camera.position.set(cx, cy, cz);
  controls.target.set(tx, ty, tz);
  if (fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  // High top poses need a longer tether than the default 3/4 view
  const dist = camera.position.distanceTo(controls.target);
  if (dist > controls.maxDistance) controls.maxDistance = dist + 5;
  controls.update();
  if (currentInfo && typeof currentInfo.updateCutaways === 'function') currentInfo.updateCutaways(camera);
  if (renderer && scene) renderer.render(scene, camera);
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
    ids: Object.keys(BUILDERS),
    pose: poseCamera,
    views: function () { return currentInfo; }
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
