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
  const scroller = stage.querySelector('.scroller');
  const sbtn = document.getElementById('demo-scroll-btn');
  let scrollOn = false; // Lock-on is the default: the page is held still until Scroll is pressed
  let scrollY = 0;
  let hintTimer = 0;

  const maxScroll = () => Math.max(0, scroller.scrollHeight - stage.querySelector('.page-body').clientHeight);
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
  }

  const point = (e) => {
    const r = stage.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  stage.addEventListener('pointerdown', (e) => {
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
    inner.replaceChildren(stage.querySelector('.page').cloneNode(true));
    Object.assign(inner.style, { width: W + 'px', height: H + 'px', transform: 'scale(' + s + ') translate(' + -x + 'px,' + -y + 'px)' });
    Object.assign(frame.style, { width: fw + 'px', height: fh + 'px', left: (W - fw) / 2 + 'px', top: (H - fh) / 2 + 'px' });
    zoom.hidden = false;
    hint.classList.add('hide');
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

  setMode(false);
})();
