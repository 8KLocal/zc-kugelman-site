/* ZC Kugelman Interiors: site behavior (vanilla JS, no build step). Asset paths resolve via SITE_CONFIG.assetBase. */
(function () {
  'use strict';
  window.__zcReady = true;
  var C = window.SITE_CONFIG || {};
  var root = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  if (reduced) root.classList.add('reduced', 'hs-native');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; }); };
  var isTBD = function (v) { return !v || /^tbd$/i.test(String(v).trim()); };

  /* Resolve data/ and image paths. At the site root this is empty; option pages may set SITE_CONFIG.assetBase. */
  var ASSET_BASE = (function () {
    var b = (typeof C.assetBase === 'string') ? C.assetBase : (window.__ASSET_BASE || '');
    if (b && b.slice(-1) !== '/') b += '/';
    return b;
  })();
  function asset(p) {
    if (!p) return '';
    var s = String(p);
    if (/^(https?:|data:|mailto:|tel:|\/\/)/i.test(s)) return s;
    if (s.indexOf(ASSET_BASE) === 0) return s;
    if (s.indexOf('../') === 0) return s;
    return ASSET_BASE + s.replace(/^\.\//, '');
  }
  function cleanDisplay(s) {
    return String(s == null ? '' : s)
      .replace(/\s*AI-?generated[^.]*(?:\.)?/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+\./g, '.')
      .trim();
  }



  /* Map a photo path to a per-room 3D model id (null = no 3D button). */
  function roomViewerOn() { return !!(C.roomViewer || (document.documentElement && document.documentElement.classList.contains('room-viewer-on'))); }
  function roomIdFromSrc(src) {
    if (!roomViewerOn()) return null;
    var s = String(src || '').toLowerCase();
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
  function openRoomView(id) {
    if (!id) return;
    if (window.ZCRooms && typeof window.ZCRooms.open === 'function') window.ZCRooms.open(id);
    else document.dispatchEvent(new CustomEvent('zc:open-room', { detail: id }));
  }

  /* ---------- 1. Apply config (brand name lives in js/config.js) ---------- */
  function applyConfig() {
    var brand = C.brandName || 'Interior Design';
    $$('[data-brand]').forEach(function (el) { el.textContent = brand; });
    $$('[data-brand-short]').forEach(function (el) { el.textContent = C.brandShort || brand; });
    $$('[data-tagline]').forEach(function (el) { el.textContent = C.tagline || ''; });
    $$('[data-location]').forEach(function (el) { el.textContent = C.location || ''; });
    document.title = document.title.replace('ZC Kugelman Interiors', brand);
    $$('[data-phone]').forEach(function (el) {
      if (isTBD(C.phone)) { el.innerHTML = '<span class="tbd">TBD (placeholder)</span>'; el.removeAttribute('href'); }
      else {
        el.textContent = C.phone;
        var digits = C.phone.replace(/\D/g, '');
        var tel = (digits.length === 10) ? ('+1' + digits) : (digits.length === 11 && digits.charAt(0) === '1' ? ('+' + digits) : (C.phone.replace(/[^\d+]/g, '') || digits));
        el.href = 'tel:' + tel;
      }
    });
    $$('[data-email]').forEach(function (el) {
      if (isTBD(C.email)) { el.innerHTML = '<span class="tbd">TBD (placeholder)</span>'; el.removeAttribute('href'); }
      else { el.textContent = C.email; el.href = 'mailto:' + C.email; }
    });
    var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
    var cWrap = $('#counters');
    if (cWrap && C.counters) {
      cWrap.innerHTML = C.counters.map(function (c, i) {
        return '<div class="counter" data-reveal style="transition-delay:' + (i * 120) + 'ms"><div class="counter-num"><span data-count="' + Number(c.value) + '">0</span>' +
          (c.suffix ? '<sup>' + esc(c.suffix) + '</sup>' : '') + '</div><p>' + esc(c.label) + '</p></div>';
      }).join('');
    }
  }

  /* ---------- 2. Split headings into words for staggered reveals ---------- */
  function splitText(el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/([ \t\n\r]+)/).forEach(function (part) {
            if (!part) return;
            if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w';
            var wi = document.createElement('span'); wi.className = 'wi'; wi.style.setProperty('--i', i++);
            wi.textContent = part; w.appendChild(wi); frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) { walk(n); }
      });
    })(el);
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  }

  /* ---------- 3. Reveal-on-scroll (fade-up, stagger, clip, counters) ---------- */
  var io = null;
  function onIn(el) {
    el.classList.add('in');
    // clip-path hides the element from IntersectionObserver, so clips are observed via their parent
    (el.__clips || []).forEach(function (c) { c.classList.add('in'); });
    $$('[data-count]', el).forEach(countUp);
  }
  function observe(scope) {
    var els = $$('[data-reveal],[data-split],[data-stagger]', scope || document).filter(function (e) { return !e.__obs; });
    els.forEach(function (el) {
      el.__obs = true;
      if (el.hasAttribute('data-stagger')) Array.prototype.forEach.call(el.children, function (c, i) { c.style.setProperty('--i', i); });
      if (reduced || !io) { onIn(el); return; }
      if (el.getAttribute('data-reveal') === 'clip' && el.parentElement) {
        var par = el.parentElement;
        (par.__clips = par.__clips || []).push(el);
        io.observe(par);
      } else io.observe(el);
    });
  }
  function countUp(el) {
    if (el.__done) return; el.__done = true;
    var end = Number(el.getAttribute('data-count')) || 0;
    if (reduced) { el.textContent = end; return; }
    var t0 = null, dur = 1800;
    function tick(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(end * e);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- 4. Scroll-linked effects: parallax, horizontal, progress, nav ---------- */
  var nav = $('#nav'), progress = $('.progress span'), hs = $('.hscroll'), track = $('.hscroll-track'), steps = $('#steps');
  var parallaxEls = [], hsDist = 0, lastY = 0, ticking = false;
  var planSec = $('#plan'), planItems = [], planSteps = [];
  /* Animated floor plan: each <g data-g data-from data-to> group draws its children in sequence. */
  function initPlan() {
    if (!planSec) return;
    if (reduced) { root.classList.add('plan-static'); return; }
    root.classList.add('plan-anim');
    $$('[data-g]', planSec).forEach(function (g) {
      var a = parseFloat(g.getAttribute('data-from')), b = parseFloat(g.getAttribute('data-to')), span = b - a;
      var kids = $$('.dr, .lbl, .zone', g).filter(function (el) { return !el.parentElement.closest('.lbl, .zone') || el.matches('.lbl, .zone'); });
      kids = kids.filter(function (el) { return !(el.matches('.dr') && el.closest('.lbl, .zone')); });
      kids.forEach(function (el, i) {
        var s0 = a + span * 0.75 * (kids.length > 1 ? i / (kids.length - 1) : 0);
        planItems.push({ el: el, s: s0, e: s0 + span * 0.25, draw: el.matches('.dr'), last: -1 });
      });
    });
    planSteps = $$('#planSteps li').map(function (li) { return { el: li, at: parseFloat(li.getAttribute('data-at')) || 0 }; });
  }
  function updatePlan(vh) {
    if (!planItems.length) return;
    var r = planSec.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    var P = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh) / 0.92));
    planItems.forEach(function (it) {
      var l = Math.min(1, Math.max(0, (P - it.s) / (it.e - it.s)));
      l = Math.round(l * 200) / 200;
      if (l === it.last) return; it.last = l;
      if (it.draw) { it.el.style.strokeDashoffset = (1 - l); it.el.classList.toggle('done', l >= 1); }
      else it.el.classList.toggle('on', l > 0);
    });
    var cur = null;
    planSteps.forEach(function (st) { var on = P >= st.at; st.el.classList.toggle('on', on); if (on) cur = st; });
    planSteps.forEach(function (st) { st.el.classList.toggle('cur', st === cur); });
  }
  function measureHS() {
    if (!hs || !track) return;
    if (root.classList.contains('hs-native')) { hs.style.removeProperty('--hs-h'); return; }
    hsDist = Math.max(0, track.scrollWidth - window.innerWidth);
    hs.style.setProperty('--hs-h', (hsDist + window.innerHeight) + 'px');
  }
  function update() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset, vh = window.innerHeight;
    var docH = document.documentElement.scrollHeight - vh;
    if (progress) progress.style.setProperty('--p', docH > 0 ? (y / docH).toFixed(4) : 0);
    if (nav) {
      nav.classList.toggle('scrolled', y > 40);
      var hide = y > lastY && y > 700 && !root.classList.contains('menu-open');
      nav.classList.toggle('hidden', hide);
    }
    lastY = y;
    if (reduced) return;
    parallaxEls.forEach(function (el) {
      var r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var off = (r.top + r.height / 2 - vh / 2) * -el.__speed;
      el.style.transform = 'translate3d(0,' + off.toFixed(1) + 'px,0)';
    });
    if (hs && track && hsDist > 0 && !root.classList.contains('hs-native')) {
      var hr = hs.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, -hr.top / hsDist));
      track.style.transform = 'translate3d(' + (-p * hsDist).toFixed(1) + 'px,0,0)';
    }
    updatePlan(vh);
    if (steps) {
      var sr = steps.getBoundingClientRect();
      var sp = Math.min(1, Math.max(0, (vh * 0.65 - sr.top) / sr.height));
      steps.style.setProperty('--sp', sp.toFixed(3));
    }
  }
  function requestUpdate() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  /* ---------- 5. Smooth scroll (Lenis, optional) & anchor links ---------- */
  var lenis = null;
  function initLenis() {
    if (reduced || typeof window.Lenis !== 'function') return;
    try {
      lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on('scroll', requestUpdate);
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
    } catch (e) { lenis = null; }
  }
  function scrollToEl(target) {
    var top = target.getBoundingClientRect().top + window.scrollY - (target.id === 'top' ? 0 : 88);
    if (lenis) lenis.scrollTo(top, { duration: 1.4 });
    else window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    closeMenu();
    scrollToEl(target);
    history.replaceState(null, '', '#' + id);
  });

  /* ---------- 6. Mobile menu & active link ---------- */
  var burger = $('#burger');
  function closeMenu() { root.classList.remove('menu-open'); if (burger) { burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu'); } }
  if (burger) burger.addEventListener('click', function () {
    var open = !root.classList.contains('menu-open');
    root.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  function initActiveLinks() {
    if (!hasIO) return;
    var links = $$('.nav-links a[href^="#"]');
    var aio = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (l) { l.classList.toggle('active', l.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(function (s) { aio.observe(s); });
  }

  /* ---------- 7. Lightbox ---------- */
  var lb = $('#lightbox'), lbImg = $('.lb-figure img', lb), lbCap = $('.lb-figure figcaption', lb), lbCount = $('.lb-count', lb);
  var lbItems = [], lbIdx = 0, lbReturn = null;
  function lbShow(i) {
    lbIdx = (i + lbItems.length) % lbItems.length;
    var it = lbItems[lbIdx];
    lbImg.classList.add('swap');
    var img = new Image();
    img.onload = img.onerror = function () { lbImg.src = it.src; lbImg.alt = it.alt || ''; lbImg.classList.toggle('is-plan', !!it.plan); lbImg.classList.remove('swap'); };
    img.src = it.src;
    lbCap.textContent = it.caption || '';
    lbCount.textContent = (lbIdx + 1) + ' / ' + lbItems.length;
    var multi = lbItems.length > 1;
    $('.lb-prev', lb).hidden = !multi; $('.lb-next', lb).hidden = !multi;
  }
  function lbOpen(items, i) {
    lbItems = items; lbReturn = document.activeElement;
    lb.hidden = false; lock(true);
    requestAnimationFrame(function () { lb.classList.add('open'); });
    lbShow(i || 0);
    $('.lb-close', lb).focus();
  }
  function lbClose() {
    lb.classList.remove('open');
    setTimeout(function () { lb.hidden = true; }, 300);
    if ($('#projectModal').hidden) lock(false);
    if (lbReturn && lbReturn.focus) lbReturn.focus();
  }
  $('.lb-close', lb).addEventListener('click', lbClose);
  $('.lb-prev', lb).addEventListener('click', function () { lbShow(lbIdx - 1); });
  $('.lb-next', lb).addEventListener('click', function () { lbShow(lbIdx + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lb-figure')) lbClose(); });
  var tx = null;
  lb.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (tx == null) return; var dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) lbShow(lbIdx + (dx < 0 ? 1 : -1));
  });

  function lock(on) {
    document.body.classList.toggle('locked', on);
    if (lenis) { on ? lenis.stop() : lenis.start(); }
  }

  /* ---------- 8. Projects (data/projects.json) ---------- */
  var projects = [], modal = $('#projectModal'), modalReturn = null;
  function cardHTML(p) {
    return '<button class="card" data-slug="' + esc(p.slug) + '" data-cats="' + esc((p.categories || []).join('|')) + '" data-reveal aria-label="Open project: ' + esc(p.title) + '">' +
      '<div class="card-media">' + (p.sample ? '<span class="badge-sample">SAMPLE</span>' : '') +
      (p.plans && p.plans.length ? '<span class="badge-plan">Floor plan included</span>' : '') +
      '<img src="' + esc(asset(p.cover || (p.images && p.images[0] && p.images[0].src) || '')) + '" alt="' + esc(p.title) + '" loading="lazy"></div>' +
      '<div class="card-meta"><h3 class="card-title">' + esc(p.title) + '</h3><span class="card-sub">' + esc(p.neighborhood) + (p.year ? ' &middot; ' + esc(p.year) : '') + '</span></div>' +
      (p.summary ? '<p class="card-sum">' + esc(cleanDisplay(p.summary)) + '</p>' : '') + '</button>';
  }
  function renderProjects(list) {
    projects = list;
    var grid = $('#projectsGrid');
    if (!list.length) { grid.innerHTML = '<p class="empty">Projects coming soon.</p>'; return; }
    grid.innerHTML = list.map(cardHTML).join('');
    $('#sampleBanner').hidden = !list.some(function (p) { return p.sample; });
    var cats = [];
    list.forEach(function (p) { (p.categories || []).forEach(function (c) { if (cats.indexOf(c) < 0) cats.push(c); }); });
    var f = $('#filters');
    f.innerHTML = ['All'].concat(cats).map(function (c, i) {
      return '<button class="filter" role="tab" aria-selected="' + (i === 0) + '" data-filter="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
    f.addEventListener('click', function (e) {
      var b = e.target.closest('.filter'); if (!b) return;
      $$('.filter', f).forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      filterProjects(b.getAttribute('data-filter'));
    });
    grid.addEventListener('click', function (e) {
      var c = e.target.closest('.card'); if (c) openProject(c.getAttribute('data-slug'), c);
    });
    observe(grid);
  }
  function filterProjects(cat) {
    $$('#projectsGrid .card').forEach(function (c) {
      var show = cat === 'All' || c.getAttribute('data-cats').split('|').indexOf(cat) >= 0;
      if (show) {
        c.style.display = '';
        requestAnimationFrame(function () { c.classList.remove('is-hiding'); c.classList.add('in'); });
      } else {
        c.classList.add('is-hiding');
        setTimeout(function () { if (c.classList.contains('is-hiding')) c.style.display = 'none'; }, reduced ? 0 : 420);
      }
    });
  }
  function openProject(slug, from) {
    var p = projects.filter(function (x) { return x.slug === slug; })[0];
    if (!p) return;
    modalReturn = from || document.activeElement;
    var norm = function (im, plan) {
      var o = typeof im === 'string' ? { src: im } : Object.assign({}, im);
      o.src = asset(o.src);
      if (o.caption) o.caption = cleanDisplay(o.caption);
      if (o.alt) o.alt = cleanDisplay(o.alt);
      if (plan) o.plan = true;
      return o;
    };
    var imgs = (p.images || []).map(function (im) { return norm(im); });
    var plans = (p.plans || []).map(function (im) { return norm(im, true); });
    var lbList = imgs.map(function (im) { return { src: im.src, alt: im.alt || p.title, caption: im.caption || p.title }; })
      .concat(plans.map(function (pl, i) { return { src: pl.src, alt: pl.alt || 'Floor plan', caption: 'Plan: ' + (pl.caption || pl.alt || 'Floor plan ' + (i + 1)), plan: true }; }));
    var k = 0;
    var html = '<div class="pm-hero" data-lb="0"><img src="' + esc(asset(p.cover) || (imgs[0] && imgs[0].src) || '') + '" alt="' + esc(p.title) + '"></div>' +
      '<div class="pm-body">' +
      (p.sample ? '<p class="pm-sample pm-fade" style="--i:' + (k++) + '">SAMPLE ENTRY: placeholder project. Not a real client.</p>' : '') +
      '<p class="eyebrow pm-fade" style="--i:' + (k++) + '">Past Project</p>' +
      '<h2 id="pmTitle" class="pm-fade" style="--i:' + (k++) + '">' + esc(p.title) + '</h2>' +
      '<dl class="pm-meta pm-fade" style="--i:' + (k++) + '">' +
      '<div><dt>Neighborhood</dt><dd>' + esc(p.neighborhood || '-') + '</dd></div>' +
      '<div><dt>Year</dt><dd>' + esc(p.year || '-') + '</dd></div>' +
      '<div><dt>Category</dt><dd>' + esc((p.categories || []).join(', ') || '-') + '</dd></div></dl>' +
      (p.scope && p.scope.length ? '<p class="eyebrow pm-fade" style="--i:' + (k++) + '">Scope</p><ul class="chips pm-fade" style="--i:' + (k++) + '">' + p.scope.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="pm-desc pm-fade" style="--i:' + (k++) + '">' + String(cleanDisplay(p.description) || '').split(/\n{2,}/).map(function (para) { return '<p>' + esc(para) + '</p>'; }).join('') + '</div>' +
      '<div class="pm-gallery">' + imgs.map(function (im, i) {
        var room = roomIdFromSrc(im.src);
        return '<div class="pm-shot pm-fade" style="--i:' + (k + i) + '">' +
          '<button type="button" data-lb="' + i + '" aria-label="View photo ' + (i + 1) + '"><img src="' + esc(im.src) + '" alt="' + esc(im.alt || p.title) + '" loading="lazy"></button>' +
          (room ? '<button type="button" class="view3d-btn" data-room="' + room + '">View in 3D</button>' : '') +
          '</div>';
      }).join('') + '</div>' +
      (roomViewerOn() && p.slug && /midwood/.test(p.slug) ? '<p class="pm-study-row pm-fade" style="--i:' + (k + imgs.length) + '"><button type="button" class="view3d-btn" data-room="study">View study in 3D</button></p>' : '') +
      (plans.length ? '<h3 class="pm-sub pm-fade" style="--i:' + (k + imgs.length) + '">Floor plans &amp; layouts</h3>' +
        (p.sample ? '<p class="pm-subnote">Sample plans: illustrative, not real client drawings.</p>' : '') +
        '<div class="pm-plans">' + plans.map(function (pl, i) {
          return '<figure class="pm-fade" style="--i:' + (k + imgs.length + 1 + i) + '"><button data-lb="' + (imgs.length + i) + '" aria-label="View plan ' + (i + 1) + '"><img src="' + esc(pl.src) + '" alt="' + esc(pl.alt || 'Floor plan') + '" loading="lazy"></button>' +
            (pl.caption ? '<figcaption>' + esc(pl.caption) + '</figcaption>' : '') + '</figure>';
        }).join('') + '</div>' : '') +
      '</div>';
    $('#pmContent').innerHTML = html;
    $$('[data-lb]', $('#pmContent')).forEach(function (b) {
      b.addEventListener('click', function () { lbOpen(lbList, Number(b.getAttribute('data-lb'))); });
    });
    modal.hidden = false; lock(true);
    $('.modal-panel', modal).scrollTop = 0;
    requestAnimationFrame(function () { requestAnimationFrame(function () { modal.classList.add('open'); }); });
    $('.modal-panel', modal).focus();
    if (location.hash !== '#project/' + slug) history.pushState(null, '', '#project/' + slug);
  }
  function closeProject(fromHash) {
    if (modal.hidden) return;
    modal.classList.remove('open');
    setTimeout(function () { modal.hidden = true; }, reduced ? 0 : 600);
    lock(false);
    if (!fromHash) history.replaceState(null, '', '#projects');
    if (modalReturn && modalReturn.focus) modalReturn.focus({ preventScroll: true });
  }
  $$('[data-close]', modal).forEach(function (b) { b.addEventListener('click', function () { closeProject(); }); });
  function routeFromHash() {
    var m = location.hash.match(/^#project\/(.+)$/);
    if (m) openProject(decodeURIComponent(m[1])); else closeProject(true);
  }
  window.addEventListener('popstate', routeFromHash);

  /* ---------- 9. Design concepts (data/concepts.json) ---------- */
  function renderConcepts(list) {
    var grid = $('#conceptsGrid');
    if (!list.length) { grid.innerHTML = '<p class="empty">Concepts coming soon.</p>'; return; }
    var lbList = list.map(function (c) { return { src: asset(c.src), alt: c.title, caption: c.title }; });
    grid.innerHTML = list.map(function (c, i) {
      var room = roomIdFromSrc(c.src);
      return '<article class="concept">' +
        '<button type="button" class="concept-open" data-i="' + i + '" aria-label="View concept: ' + esc(c.title) + '">' +
        '<div class="clip" data-reveal="clip"><img src="' + esc(asset(c.src)) + '" alt="' + esc(c.title) + '" loading="lazy"></div></button>' +
        '<div class="concept-cap" data-reveal><h3>' + esc(c.title) + '</h3>' + (c.description ? '<p>' + esc(cleanDisplay(c.description)) + '</p>' : '') +
        (room ? '<button type="button" class="view3d-btn" data-room="' + room + '">View in 3D</button>' : '') +
        '</div></article>';
    }).join('');
    grid.addEventListener('click', function (e) {
      if (e.target.closest('.view3d-btn')) return;
      var b = e.target.closest('.concept-open'); if (b) lbOpen(lbList, Number(b.getAttribute('data-i')));
    });
    observe(grid);
  }

  function loadJSON(url, key) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { return Array.isArray(d) ? d : (d[key] || []); });
  }
  function loadError(gridSel, what) {
    $(gridSel).innerHTML = '<p class="empty">Could not load ' + what + '. If you opened this file directly, serve the folder with a web server (see UPDATING.md).</p>';
  }

  /* ---------- 10. Contact form ---------- */
  function initForm() {
    var form = $('#contactForm'), status = $('#formStatus');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      $$('[required]', form).forEach(function (f) {
        var bad = !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value));
        f.parentElement.classList.toggle('invalid', bad); if (bad) ok = false;
      });
      status.className = 'form-status';
      if (!ok) { status.textContent = 'Please fill in your name, a valid email and a message.'; status.classList.add('warn'); return; }
      var data = new FormData(form);
      if (C.formEndpoint) {
        status.textContent = 'Sending...';
        fetch(C.formEndpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
          .then(function (r) { if (!r.ok) throw 0; form.reset(); status.textContent = 'Thank you! We will be in touch soon.'; status.classList.add('ok'); })
          .catch(function () { status.textContent = 'Sorry, something went wrong. Please try again.'; status.classList.add('warn'); });
      } else if (!isTBD(C.email) && /@/.test(C.email)) {
        var body = ['Name: ' + data.get('name'), 'Email: ' + data.get('email'), 'Phone: ' + data.get('phone'), 'Project: ' + data.get('project_type'), 'Neighborhood: ' + data.get('neighborhood'), '', data.get('message')].join('\n');
        location.href = 'mailto:' + C.email + '?subject=' + encodeURIComponent('New project inquiry: ' + data.get('project_type')) + '&body=' + encodeURIComponent(body);
        status.textContent = 'Opening your email app...'; status.classList.add('ok');
      } else {
        status.textContent = "This form isn't connected yet (placeholder). Add an email or a Formspree endpoint in js/config.js.";
        status.classList.add('warn');
      }
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    try {
      applyConfig();
      if (!reduced) $$('[data-split]').forEach(splitText);
      if (hasIO && !reduced) {
        io = new IntersectionObserver(function (ents) {
          ents.forEach(function (en) { if (en.isIntersecting) { onIn(en.target); io.unobserve(en.target); } });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      }
      observe();
      parallaxEls = reduced ? [] : $$('[data-parallax]').map(function (el) { el.__speed = parseFloat(el.getAttribute('data-parallax')) || 0.2; return el; });
      initPlan();
      initActiveLinks();
      initForm();
      Promise.all([
        loadJSON(asset('data/projects.json'), 'projects').then(renderProjects).catch(function () { loadError('#projectsGrid', 'projects'); }),
        loadJSON(asset('data/concepts.json'), 'concepts').then(renderConcepts).catch(function () { loadError('#conceptsGrid', 'concepts'); })
      ]).then(function () { measureHS(); requestUpdate(); routeFromHash(); });
      measureHS();
      window.addEventListener('scroll', requestUpdate, { passive: true });
      window.addEventListener('resize', function () { measureHS(); requestUpdate(); });
      window.addEventListener('load', function () { measureHS(); requestUpdate(); });
      document.addEventListener('keydown', function (e) {
        var roomModal = $('#roomModal');
        if (roomModal && !roomModal.hidden) return;
        if (!lb.hidden) {
          if (e.key === 'Escape') lbClose();
          else if (e.key === 'ArrowRight') lbShow(lbIdx + 1);
          else if (e.key === 'ArrowLeft') lbShow(lbIdx - 1);
        } else if (!modal.hidden && e.key === 'Escape') closeProject();
        else if (e.key === 'Escape') closeMenu();
      });
      initLenis();
      window.__zcLenis = lenis;
      update();
    } catch (err) {
      console.error(err);
      root.classList.add('reduced', 'hs-native');
    }
    requestAnimationFrame(function () { setTimeout(function () { root.classList.add('loaded'); }, 80); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
