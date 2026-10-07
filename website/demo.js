// Hero demo: a miniature of the extension. The page starts clear; drag to select, and the blur appears on release.
// Four blur rects around the hole, like the extension itself (backdrop-filter ignores cut-outs).
(function () {
  const stage = document.getElementById('demo-stage');
  const [bt, bb, bl, br] = ['t', 'b', 'l', 'r'].map((s) => document.getElementById('demo-blur-' + s));
  const hole = document.getElementById('demo-hole');
  const hint = document.getElementById('demo-hint');
  const range = document.getElementById('demo-range');
  const out = document.getElementById('demo-out');
  let sel = null; // {x, y, w, h} as fractions of the stage
  let start = null;
  let committed = false; // false = selecting (page clear, crosshair); true = selection made, rest blurred
  const rbtn = document.getElementById('demo-reselect-btn');
  const tools = [range, document.getElementById('demo-zoom-btn'), document.getElementById('demo-scroll-btn')];
  const HINT = 'Drag to select an area';
  const pages = [...stage.querySelectorAll('.page')];
  const activePage = () => pages.find((p) => !p.hidden);
  let currentTab = 'dashboard';
  let scroller = activePage().querySelector('.scroller');
  const sbtn = document.getElementById('demo-scroll-btn');
  let scrollOn = false; // Lock-on is the default: the page is held still until Scroll is pressed
  let scrollY = 0;
  let hintTimer = 0;

  const maxScroll = () => Math.max(0, scroller.scrollHeight - activePage().querySelector('.page-body').clientHeight);
  function setScroll(y) {
    scrollY = Math.min(Math.max(0, y), maxScroll());
    scroller.style.transform = 'translateY(' + -scrollY + 'px)';
  }
  function say(text) {
    hint.textContent = text;
    hint.classList.remove('hide');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.add('hide'), 2600);
  }

  function place(el, x, y, w, h) {
    Object.assign(el.style, { left: x + 'px', top: y + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px' });
  }

  function render() {
    const px = +range.value;
    out.textContent = px + 'px';
    const filter = px ? 'blur(' + px + 'px)' : 'none';
    const W = stage.clientWidth, H = stage.clientHeight;
    const s = sel || { x: 0, y: 0, w: 0, h: 0 };
    const x = s.x * W, y = s.y * H, w = s.w * W, h = s.h * H;
    [bt, bb, bl, br].forEach((el) => { el.style.backdropFilter = el.style.webkitBackdropFilter = filter; });
    if (!sel || !committed) {
      [bt, bb, bl, br].forEach((el) => place(el, 0, 0, 0, 0));
      if (!sel) { hole.style.display = 'none'; return; }
      Object.assign(hole.style, { display: 'block', left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      return;
    }
    place(bt, 0, 0, W, y);
    place(bb, 0, y + h, W, H - y - h);
    place(bl, 0, y, x, h);
    place(br, x + w, y, W - x - w, h);
    Object.assign(hole.style, { display: 'block', left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    flipHandles(x, y, w, h, W, H);
  }

  const point = (e) => {
    const r = stage.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  stage.addEventListener('pointerdown', (e) => {
    stopIntro(true);
    if (committed) return; // after selecting, only Re-select starts a new box
    start = point(e);
    sel = null;
    stage.setPointerCapture(e.pointerId);
    hint.classList.add('hide');
  });
  stage.addEventListener('pointermove', (e) => {
    if (!start) return;
    const p = point(e);
    sel = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
    render();
  });
  const end = () => {
    if (!start) return;
    start = null;
    if (!sel || sel.w < 0.02 || sel.h < 0.02) { sel = null; hint.textContent = HINT; hint.classList.remove('hide'); render(); return; }
    setMode(true);
  };

  function setMode(isCommitted) {
    committed = isCommitted;
    stage.classList.toggle('selecting', !committed);
    tools.forEach((el) => { el.disabled = !committed; });
    rbtn.disabled = !committed;
    render();
  }
  // Re-select (or Esc): back to a clear page with the crosshair, like the toolbar's Re-select.
  function reselect() {
    stopIntro(false);
    sel = null;
    scrollOn = false;
    sbtn.setAttribute('aria-pressed', 'false');
    clearTimeout(hintTimer);
    hint.textContent = HINT;
    hint.classList.remove('hide');
    setMode(false);
  }
  rbtn.addEventListener('click', reselect);
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  range.addEventListener('input', render);
  window.addEventListener('resize', () => { setScroll(scrollY); render(); });

  // Scroll button: Lock-on (default) holds the page; pressed, the wheel moves the page through the window.
  sbtn.addEventListener('click', () => {
    scrollOn = !scrollOn;
    sbtn.setAttribute('aria-pressed', String(scrollOn));
    sbtn.title = scrollOn ? 'Scrolling is on. Click to lock the page again' : 'The page is locked in place. Click to allow scrolling';
    say(scrollOn ? 'Scroll the page through your window' : 'Page locked in place');
  });
  // Only capture the wheel while Scroll is on, and let go at the ends so visitors are never trapped.
  stage.addEventListener('wheel', (e) => {
    if (!scrollOn) return;
    const next = Math.min(Math.max(0, scrollY + e.deltaY), maxScroll());
    if (next === scrollY) return;
    e.preventDefault();
    setScroll(next);
  }, { passive: false });

  // Zoom: the selection enlarged over the still-blurred page (a clone of the mock page, scaled).
  const zoom = document.getElementById('demo-zoom');
  const frame = document.getElementById('zoom-frame');
  const inner = document.getElementById('zoom-inner');
  const dot = document.getElementById('zoom-dot');
  const zbtn = document.getElementById('demo-zoom-btn');
  const MARGIN = 48;

  function openZoom() {
    const W = stage.clientWidth, H = stage.clientHeight;
    const x = sel.x * W, y = sel.y * H, w = sel.w * W, h = sel.h * H;
    const s = Math.min(4, (W - MARGIN * 2) / w, (H - MARGIN * 2) / h);
    const fw = w * s, fh = h * s;
    inner.replaceChildren(activePage().cloneNode(true));
    Object.assign(inner.style, { width: W + 'px', height: H + 'px', transform: 'scale(' + s + ') translate(' + -x + 'px,' + -y + 'px)' });
    Object.assign(frame.style, { width: fw + 'px', height: fh + 'px', left: (W - fw) / 2 + 'px', top: (H - fh) / 2 + 'px' });
    zoom.hidden = false;
    hint.classList.add('hide');
    // Grow from the selection to the enlarged view (same effect as the extension; transform + opacity only).
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      frame.animate(
        [
          { transform: 'translate(' + (x + w / 2 - W / 2) + 'px,' + (y + h / 2 - H / 2) + 'px) scale(' + 1 / s + ')', opacity: 0.35 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)' }
      );
    }
  }
  function closeZoom() { zoom.hidden = true; }

  zbtn.addEventListener('click', openZoom);
  document.getElementById('zoom-x').addEventListener('click', (e) => { e.stopPropagation(); closeZoom(); });
  zoom.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (!frame.contains(e.target)) closeZoom(); });
  zoom.addEventListener('pointermove', (e) => {
    const r = frame.getBoundingClientRect();
    const over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom && e.pointerType !== 'touch' && !e.target.closest('.zoom-x');
    dot.style.display = over ? 'block' : 'none';
    if (over) { dot.style.left = e.clientX - r.left + 'px'; dot.style.top = e.clientY - r.top + 'px'; }
  });
  zoom.addEventListener('pointerleave', () => { dot.style.display = 'none'; });
  document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (!zoom.hidden) closeZoom(); else if (committed) reselect(); });

  // ---- Intro: once, when the demo scrolls into view, a ghost cursor drags a box around the stat cards,
  // the rest blurs, then the demo resets to a clear page for the visitor. Any touch cancels it.
  const ghost = document.getElementById('demo-ghost');
  let introRaf = 0, introTimer = 0, introRunning = false;
  const introSeen = {}; // per tab: the intro plays at most once for each page
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;

  function parkGhost() { ghost.style.opacity = '0'; }
  function stopIntro(resetPage) {
    introSeen[currentTab] = true; // never replay once the visitor has interacted
    if (!introRunning) return;
    introRunning = false;
    cancelAnimationFrame(introRaf);
    clearTimeout(introTimer);
    parkGhost();
    if (resetPage && !committed) { sel = null; render(); }
  }

  function runIntro() {
    if (introSeen[currentTab] || introRunning || committed || sel) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { introSeen[currentTab] = true; return; }
    introSeen[currentTab] = true;
    introRunning = true;
    const r = stage.getBoundingClientRect(), c = activePage().querySelector(activePage().dataset.intro).getBoundingClientRect(), pad = 6;
    const target = { x: (c.left - r.left - pad) / r.width, y: (c.top - r.top - pad) / r.height, w: (c.width + pad * 2) / r.width, h: (c.height + pad * 2) / r.height };
    const from = { x: Math.min(0.9, target.x + target.w * 0.6), y: Math.min(0.92, target.y + target.h + 0.3) };
    const T1 = 800, T2 = T1 + 200, T3 = T2 + 1000;
    const t0 = performance.now();
    hint.classList.add('hide');
    ghost.style.opacity = '1';
    const put = (x, y) => { ghost.style.left = x * stage.clientWidth + 'px'; ghost.style.top = y * stage.clientHeight + 'px'; };
    put(from.x, from.y);
    (function step(now) {
      if (!introRunning) return;
      const t = now - t0;
      if (t < T1) {
        const k = ease(t / T1);
        put(lerp(from.x, target.x, k), lerp(from.y, target.y, k));
      } else if (t < T2) {
        put(target.x, target.y);
      } else if (t < T3) {
        const k = ease((t - T2) / (T3 - T2));
        sel = { x: target.x, y: target.y, w: target.w * k, h: target.h * k };
        render();
        put(target.x + target.w * k, target.y + target.h * k);
      } else {
        sel = target;
        parkGhost();
        setMode(true); // blur appears, exactly like a real selection
        introTimer = setTimeout(() => {
          introRunning = false;
          reselect();
          hint.textContent = 'Your turn: drag to select an area';
        }, 2600);
        return;
      }
      introRaf = requestAnimationFrame(step);
    })(t0);
  }
  // Touching the controls during the held result keeps the visitor's own state.
  document.querySelector('.controls').addEventListener('pointerdown', () => { introSeen[currentTab] = true; if (introRunning) { introRunning = false; clearTimeout(introTimer); } });

  // Tabs: switch the mock page; the selection, blur, Zoom and Scroll all work on whichever page is showing.
  const tabBtns = [...document.querySelectorAll('.demo-tab')];
  function showTab(name) {
    if (name === currentTab) return;
    closeZoom();
    reselect(); // clears the selection; runs while currentTab is still the old page so it only marks that page's intro as seen
    setScroll(0);
    pages.forEach((p) => { p.hidden = p.dataset.page !== name; });
    currentTab = name;
    scroller = activePage().querySelector('.scroller');
    setScroll(0);
    tabBtns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    runIntro();
  }
  tabBtns.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // ---- Resizing: drag a handle to move its edge(s); the blur follows live (same rules as the extension).
  const EDGE = 14, MIN_PX = 24;
  function flipHandles(x, y, w, h, W, H) {
    hole.classList.toggle('in-n', y < EDGE);
    hole.classList.toggle('in-w', x < EDGE);
    hole.classList.toggle('in-s', y + h > H - EDGE);
    hole.classList.toggle('in-e', x + w > W - EDGE);
  }
  let rs = null; // {dir, px, py, rect:{l,t,r,b}} while a handle is held
  function startResize(e) {
    const dir = e.target.dataset && e.target.dataset.dir;
    if (!dir || !committed || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    stopIntro(true); // grabbing a handle ends the intro for good
    const W = stage.clientWidth, H = stage.clientHeight;
    rs = { dir, px: e.clientX, py: e.clientY, rect: { l: sel.x * W, t: sel.y * H, r: (sel.x + sel.w) * W, b: (sel.y + sel.h) * H } };
    e.target.setPointerCapture(e.pointerId);
  }
  function moveResize(e) {
    if (!rs) return;
    const W = stage.clientWidth, H = stage.clientHeight;
    const dx = e.clientX - rs.px, dy = e.clientY - rs.py, d = rs.dir;
    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
    let { l, t, r, b } = rs.rect;
    if (d.includes('w')) l = clamp(l + dx, 0, r - MIN_PX);
    if (d.includes('e')) r = clamp(r + dx, l + MIN_PX, W);
    if (d.includes('n')) t = clamp(t + dy, 0, b - MIN_PX);
    if (d.includes('s')) b = clamp(b + dy, t + MIN_PX, H);
    sel = { x: l / W, y: t / H, w: (r - l) / W, h: (b - t) / H };
    render();
  }
  const endResize = () => { rs = null; };
  hole.querySelectorAll('.hh').forEach((h) => {
    h.addEventListener('pointerdown', startResize);
    h.addEventListener('pointermove', moveResize);
    h.addEventListener('pointerup', endResize);
    h.addEventListener('pointercancel', endResize);
    h.addEventListener('click', (e) => e.stopPropagation());
  });

  setMode(false);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) { io.disconnect(); runIntro(); }
    }, { threshold: 0.6 });
    io.observe(stage);
  }
})();
