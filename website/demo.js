// Hero demo: a miniature of the extension. Drag to choose the clear area; the rest is blurred.
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
    if (!sel) { place(bt, 0, 0, W, H); place(bb, 0, 0, 0, 0); place(bl, 0, 0, 0, 0); place(br, 0, 0, 0, 0); hole.style.display = 'none'; return; }
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

  // Default selection: the row of stat cards.
  function defaultSel() {
    const r = stage.getBoundingClientRect(), c = stage.querySelector('.cards').getBoundingClientRect();
    const pad = 6;
    return { x: (c.left - r.left - pad) / r.width, y: (c.top - r.top - pad) / r.height, w: (c.width + pad * 2) / r.width, h: (c.height + pad * 2) / r.height };
  }

  stage.addEventListener('pointerdown', (e) => {
    start = point(e);
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
    start = null;
    if (sel && (sel.w < 0.02 || sel.h < 0.02)) { sel = defaultSel(); render(); }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  range.addEventListener('input', render);
  window.addEventListener('resize', render);

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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !zoom.hidden) closeZoom(); });

  sel = defaultSel();
  render();
})();
