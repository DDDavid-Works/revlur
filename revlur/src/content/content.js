// Revlur content script. Injected on demand; never alters the page's own DOM/CSS.
(() => {
  try {
    window.__revlur?.dispose();
  } catch {
    // a stale copy that can't dispose cleanly is simply replaced
  }

  const geo = globalThis.__revlurGeometry;

  const HINT_TEXT = 'Drag to select · Esc to exit';
  const DEFAULT_BLUR = 8;
  const MAX_BLUR = 20;

  let host = null;
  let shadow = null; // closed shadow root (host.shadowRoot is null for closed roots)
  let capture = null; // full-viewport layer that receives the drag
  let blurLayer = null; // four backdrop-filter panels around the clear hole
  let panels = null; // {t, b, l, r}
  let selectionEl = null; // selection indicator
  let handlesEl = null; // resize handles around the focused area
  let hint = null;
  let frameEl = null; // red window outline, shown only while choosing an area
  let toolbar = null;
  let blurValue = null; // "8px" readout
  let blurSlider = null;
  let zoomEl = null; // open zoom modal, if any
  let zoomCopy = null; // copies the open zoom image (used by Ctrl/Cmd+C)
  let zoomToken = 0; // invalidates an in-flight capture when the user closes or exits
  let active = false;
  let anchor = null; // drag start point (viewport coords)
  let selection = null; // committed {x, y, w, h} in viewport coords
  let blurPx = DEFAULT_BLUR;
  let toolbarXY = { x: 0, y: 0 }; // where the toolbar currently sits (viewport coords)
  let toolbarPos = null; // set once the user drags the toolbar; reset on Re-select
  let scrollBtn = null;
  let scrollAllowed = false; // Lock-on is the default: the page is held still until the user allows scrolling
  let scrollHold = null; // page position held while locked: {x, y}
  let lastNudge = 0; // when we last told the user that scrolling is locked

  try {
    chrome.storage.local.get('blur', ({ blur }) => {
      if (Number.isFinite(blur)) {
        blurPx = geo.clamp(Math.round(blur), 0, MAX_BLUR);
        if (active) applyBlur();
      }
    });
  } catch {
    // storage unavailable: keep the default
  }

  const viewportSize = () => ({
    w: document.documentElement.clientWidth,
    h: document.documentElement.clientHeight,
  });

  function setBox(el, left, top, width, height) {
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
  }

  function drawSelection(rect) {
    if (!rect) {
      selectionEl.hidden = true;
      drawHandles(null);
      return;
    }
    const r = geo.roundRect(rect);
    selectionEl.hidden = false;
    setBox(selectionEl, r.x, r.y, r.w, r.h);
  }

  // Blur everything outside the rect: top/bottom panels span full width, left/right fill the gap.
  function drawBlur(rect) {
    const { w: vw, h: vh } = viewportSize();
    const r = geo.roundRect(geo.intersectViewport(rect, vw, vh));
    const right = r.x + r.w;
    const bottom = r.y + r.h;
    setBox(panels.t, 0, 0, vw, r.y);
    setBox(panels.b, 0, bottom, vw, Math.max(0, vh - bottom));
    setBox(panels.l, 0, r.y, r.x, r.h);
    setBox(panels.r, right, r.y, Math.max(0, vw - right), r.h);
  }

  function applyBlur() {
    blurLayer.style.setProperty('--rl-blur', `${blurPx}px`);
    zoomEl?.style.setProperty('--rl-blur', `${blurPx}px`);
    blurSlider.value = String(blurPx);
    blurValue.textContent = `${blurPx}px`;
  }

  function moveToolbar(x, y) {
    toolbarXY = { x: Math.round(x), y: Math.round(y) };
    toolbar.style.transform = `translate(${toolbarXY.x}px, ${toolbarXY.y}px)`;
  }

  function positionToolbar() {
    const { w: vw, h: vh } = viewportSize();
    const size = { w: toolbar.offsetWidth, h: toolbar.offsetHeight };
    if (toolbarPos) {
      // The user dragged it: keep it where they put it (re-clamped if the window shrank).
      moveToolbar(geo.clamp(toolbarPos.x, 0, Math.max(0, vw - size.w)), geo.clamp(toolbarPos.y, 0, Math.max(0, vh - size.h)));
      return;
    }
    // Place the toolbar by the visible part of the hole.
    const visible = geo.intersectViewport(selection, vw, vh);
    const pos = geo.placeToolbar(visible, size, vw, vh);
    moveToolbar(pos.x, pos.y);
  }

  // Drag the toolbar by its "Revlur" label when it covers something you want to see.
  function makeToolbarDraggable(handle) {
    let start = null;
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      start = { px: e.clientX, py: e.clientY, x: toolbarXY.x, y: toolbarXY.y };
    });
    handle.addEventListener('pointermove', (e) => {
      if (!start) return;
      toolbarPos = { x: start.x + e.clientX - start.px, y: start.y + e.clientY - start.py };
      positionToolbar();
    });
    const end = () => {
      start = null;
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  // Move/resize the focused area (selection indicator, blur hole and toolbar together).
  function setSelection(rect) {
    selection = rect;
    drawSelection(rect);
    drawHandles(rect);
    drawBlur(rect);
    positionToolbar();
  }

  // Eight grab handles on the focused area. Dragging one moves its edge(s); the blur follows live.
  function buildHandles() {
    const wrap = document.createElement('div');
    wrap.className = 'rl-handles';
    for (const dir of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
      const h = document.createElement('div');
      h.className = `rl-handle rl-h-${dir}`;
      let start = null;
      h.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !selection) return;
        e.preventDefault();
        h.setPointerCapture(e.pointerId);
        start = { px: e.clientX, py: e.clientY, rect: selection };
      });
      h.addEventListener('pointermove', (e) => {
        if (!start) return;
        const { w, h: vh } = viewportSize();
        const rect = geo.resizeRect(start.rect, dir, e.clientX - start.px, e.clientY - start.py, w, vh);
        selection = rect;
        drawSelection(rect);
        drawBlur(rect);
        drawHandles(rect);
      });
      const end = () => {
        if (!start) return;
        start = null;
        positionToolbar(); // re-place the toolbar once, not on every move
      };
      h.addEventListener('pointerup', end);
      h.addEventListener('pointercancel', end);
      for (const type of ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu']) {
        h.addEventListener(type, (e) => e.stopPropagation());
      }
      wrap.append(h);
    }
    return wrap;
  }

  function drawHandles(rect) {
    if (!rect) {
      handlesEl.hidden = true;
      return;
    }
    const r = geo.roundRect(rect);
    const { w: vw, h: vh } = viewportSize();
    const edge = 14; // handles flip inside when the area is this close to the viewport edge
    handlesEl.classList.toggle('rl-in-n', r.y < edge);
    handlesEl.classList.toggle('rl-in-w', r.x < edge);
    handlesEl.classList.toggle('rl-in-s', r.y + r.h > vh - edge);
    handlesEl.classList.toggle('rl-in-e', r.x + r.w > vw - edge);
    handlesEl.hidden = false;
    setBox(handlesEl, r.x, r.y, r.w, r.h);
  }

  // ---- Lock-on: the page is held still by default; the Scroll button lets it move ----
  // The clear window itself never moves. With scrolling allowed, the page slides through it, which
  // makes a reading window for long pages.

  // True when the wheel event would scroll a scroller inside the clear window (a code block, a textarea).
  function wheelScrollsInner(e) {
    for (const el of e.composedPath()) {
      if (el === host) return false; // over the blurred area or Revlur's own UI
      if (!(el instanceof Element) || el === document.body || el === document.documentElement) continue;
      const cs = getComputedStyle(el);
      const canY = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
      const canX = (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
      if (canY && ((e.deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) || (e.deltaY < 0 && el.scrollTop > 0))) return true;
      if (canX && ((e.deltaX > 0 && el.scrollLeft + el.clientWidth < el.scrollWidth - 1) || (e.deltaX < 0 && el.scrollLeft > 0))) return true;
    }
    return false;
  }

  function nudgeLocked() {
    const now = performance.now();
    if (now - lastNudge < 4000) return;
    lastNudge = now;
    showNote('Scrolling is locked · press Scroll to move the page');
  }

  function onLockedWheel(e) {
    if (wheelScrollsInner(e)) return;
    e.preventDefault();
    nudgeLocked();
  }

  // Catches everything the wheel handler can't (scrollbar drag, keyboard, find-in-page, scripts).
  function onLockedScroll() {
    if (scrollHold && (window.scrollX !== scrollHold.x || window.scrollY !== scrollHold.y)) {
      window.scrollTo({ left: scrollHold.x, top: scrollHold.y, behavior: 'instant' });
    }
  }

  function unlockScroll() {
    window.removeEventListener('wheel', onLockedWheel, true);
    document.removeEventListener('scroll', onLockedScroll);
    scrollHold = null;
  }

  function updateScrollButton() {
    if (!scrollBtn) return;
    scrollBtn.setAttribute('aria-pressed', String(scrollAllowed));
    scrollBtn.title = scrollAllowed
      ? 'Scrolling is on: the page moves through the clear window. Click to lock it again'
      : 'The page is locked in place. Click to allow scrolling';
  }

  // Lock the page when a selection exists and scrolling hasn't been allowed.
  function applyScrollLock() {
    unlockScroll();
    if (selection && !scrollAllowed) {
      scrollHold = { x: window.scrollX, y: window.scrollY };
      window.addEventListener('wheel', onLockedWheel, { capture: true, passive: false });
      document.addEventListener('scroll', onLockedScroll, { passive: true });
    }
    updateScrollButton();
  }

  function toggleScroll() {
    scrollAllowed = !scrollAllowed;
    applyScrollLock();
  }

  function showNote(text) {
    hint.textContent = text;
    hint.hidden = false;
    setTimeout(() => {
      if (!hint) return;
      hint.hidden = true;
      hint.textContent = HINT_TEXT;
    }, 2500);
  }

  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

  // Screenshot the visible tab with our own overlay hidden so it isn't in the image.
  async function captureTab() {
    host.style.visibility = 'hidden';
    try {
      await nextFrame();
      await nextFrame();
      return await chrome.runtime.sendMessage({ type: 'revlur:capture' });
    } finally {
      if (host) host.style.visibility = '';
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function closeZoom() {
    zoomToken++;
    zoomEl?.remove();
    zoomEl = null;
    zoomCopy = null;
    if (!active || !selection) return;
    selectionEl.hidden = false;
    drawHandles(selection);
    toolbar.hidden = false;
    positionToolbar();
  }

  // Small outline icons (24x24 grid, drawn as DOM nodes so strict-CSP/Trusted Types pages can't block them).
  const ICONS = {
    copy: ['M15 5H7a2 2 0 0 0-2 2v8', 'M11 9h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z'],
    save: ['M12 4v10', 'M8 10l4 4 4-4', 'M5 19h14'],
    check: ['M5 12l5 5L20 7'],
    alert: ['M12 7v6', 'M12 17h.01'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
  };

  function setIcon(btn, name) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ICONS[name]) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    }
    btn.replaceChildren(svg);
  }

  function iconButton(className, name, title) {
    const b = button(className, '', title);
    b.setAttribute('aria-label', title);
    b.dataset.icon = name;
    setIcon(b, name);
    return b;
  }

  // Show the selected area enlarged in a modal over the (still blurred) page.
  async function openZoom() {
    if (!selection || zoomEl) return;
    // Zoom the visible part of the hole.
    const view = viewportSize();
    const sel = geo.intersectViewport(selection, view.w, view.h);
    if (!geo.isSelectable(sel)) {
      showNote('Selected area is off-screen');
      return;
    }
    const token = ++zoomToken;

    const res = await captureTab().catch(() => null);
    if (token !== zoomToken || !active) return;
    const img = res?.dataUrl ? await loadImage(res.dataUrl).catch(() => null) : null;
    if (token !== zoomToken || !active) return;
    if (!img) {
      showNote('Couldn’t capture this page');
      return;
    }

    const { w: vw, h: vh } = viewportSize();
    const src = geo.cropRect(
      sel,
      img.naturalWidth / window.innerWidth,
      img.naturalHeight / window.innerHeight,
      img.naturalWidth,
      img.naturalHeight,
    );
    const canvas = document.createElement('canvas');
    canvas.width = src.w;
    canvas.height = src.h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, src.w, src.h);
    const scale = geo.fitZoom(sel.w, sel.h, Math.max(vw - 96, 1), Math.max(vh - 96, 1), 1);
    canvas.style.width = `${Math.round(sel.w * scale)}px`;
    canvas.style.height = `${Math.round(sel.h * scale)}px`;

    const frame = document.createElement('div');
    frame.className = 'rl-zoom-frame';
    const closeBtn = iconButton('rl-zoom-close', 'close', 'Close (Esc)');
    closeBtn.addEventListener('click', closeZoom);
    frame.append(canvas);

    // Presentation pointer: a red laser dot replaces the cursor over the enlarged image. Being
    // drawn in the page, it also shows up in screen shares that don't capture the real cursor.
    const laser = document.createElement('div');
    laser.className = 'rl-laser';
    laser.hidden = true;
    frame.append(laser);
    frame.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') {
        laser.hidden = true;
        return;
      }
      const r = frame.getBoundingClientRect();
      laser.hidden = false;
      laser.style.transform = `translate(${Math.round(e.clientX - r.left)}px, ${Math.round(e.clientY - r.top)}px)`;
    });
    frame.addEventListener('pointerleave', () => {
      laser.hidden = true;
    });

    zoomEl = document.createElement('div');
    zoomEl.className = 'rl-zoom';
    zoomEl.style.setProperty('--rl-blur', `${blurPx}px`);
    // The close button floats outside the image (top-right), never covering the content.
    const stage = document.createElement('div');
    stage.className = 'rl-zoom-stage';
    const actions = document.createElement('div');
    actions.className = 'rl-zoom-actions';
    const copyBtn = iconButton('rl-zoom-action', 'copy', 'Copy image (Ctrl/Cmd+C)');
    const saveBtn = iconButton('rl-zoom-action', 'save', 'Save as PNG');
    // Briefly swap the icon for a check (done) or alert (failed), then restore it.
    const flash = (btn, ok) => {
      setIcon(btn, ok ? 'check' : 'alert');
      btn.classList.toggle('rl-bad', !ok);
      clearTimeout(btn._t);
      btn._t = setTimeout(() => {
        setIcon(btn, btn.dataset.icon);
        btn.classList.remove('rl-bad');
      }, 1600);
    };
    const toBlob = () => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    // Writes only on a click or key press (a user gesture); Revlur never reads the clipboard.
    const copyImage = async () => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob() })]);
        flash(copyBtn, true);
      } catch {
        flash(copyBtn, false);
      }
    };
    const saveImage = async () => {
      const blob = await toBlob();
      if (!blob) return flash(saveBtn, false);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = geo.snapshotFileName(new Date());
      shadow.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      flash(saveBtn, true);
    };
    copyBtn.addEventListener('click', copyImage);
    saveBtn.addEventListener('click', saveImage);
    zoomCopy = copyImage;
    actions.append(copyBtn, saveBtn, closeBtn);
    stage.append(frame, actions);
    zoomEl.append(stage);
    // Click outside the image closes; keep the page underneath from scrolling or receiving clicks.
    zoomEl.addEventListener('click', (e) => {
      if (e.target === zoomEl) closeZoom();
    });
    zoomEl.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'dblclick', 'contextmenu']) {
      zoomEl.addEventListener(type, (e) => e.stopPropagation());
    }
    selectionEl.hidden = true;
    handlesEl.hidden = true;
    toolbar.hidden = true;
    shadow.append(zoomEl);

    // Grow from where the selection was to the enlarged view (transform and opacity only, so it stays
    // on the GPU). Skipped under reduce-motion; closing is instant.
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const dx = sel.x + sel.w / 2 - vw / 2;
      const dy = sel.y + sel.h / 2 - vh / 2;
      stage.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${1 / scale})`, opacity: 0.35 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)' },
      );
    }
  }

  // Selecting: crosshair capture layer on, no blur. Used on activation and for Re-select.
  function enterSelecting() {
    toolbarPos = null;
    closeZoom();
    unlockScroll();
    selection = null;
    anchor = null;
    capture.hidden = false;
    frameEl.hidden = false;
    blurLayer.hidden = true;
    toolbar.hidden = true;
    drawSelection(null);
    hint.hidden = false;
  }

  // Focused: blur outside the committed selection, toolbar visible, page interactive.
  function enterFocused(rect) {
    selection = rect;
    capture.hidden = true;
    frameEl.hidden = true;
    hint.hidden = true;
    drawSelection(rect);
    drawHandles(rect);
    drawBlur(rect);
    blurLayer.hidden = false;
    toolbar.hidden = false;
    applyBlur();
    positionToolbar();
    applyScrollLock(); // Lock-on: hold the page still unless the user has allowed scrolling
  }

  function pointFromEvent(e) {
    const { w, h } = viewportSize();
    return geo.clampPoint(e.clientX, e.clientY, w, h);
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    anchor = pointFromEvent(e);
    capture.setPointerCapture(e.pointerId);
    drawSelection(geo.normalizeRect(anchor.x, anchor.y, anchor.x, anchor.y));
    hint.hidden = true;
  }

  function onPointerMove(e) {
    if (!anchor) return;
    const p = pointFromEvent(e);
    drawSelection(geo.normalizeRect(anchor.x, anchor.y, p.x, p.y));
  }

  function onPointerUp(e) {
    if (!anchor) return;
    const p = pointFromEvent(e);
    const rect = geo.normalizeRect(anchor.x, anchor.y, p.x, p.y);
    anchor = null;
    if (geo.isSelectable(rect)) {
      enterFocused(rect);
    } else {
      enterSelecting(); // stray click: ignore and let the user try again
    }
  }

  function onPointerCancel() {
    enterSelecting();
  }

  function onResize() {
    if (!selection) return;
    if (scrollHold) scrollHold = { x: window.scrollX, y: window.scrollY }; // reflow may have moved the page
    const { w, h } = viewportSize();
    setSelection(geo.clampRect(selection, w, h));
  }

  // Escape closes the zoom modal first; a second Escape exits Revlur.
  function onKeyDown(e) {
    if (zoomCopy && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
      e.preventDefault();
      e.stopPropagation();
      zoomCopy();
      return;
    }
    if (e.key !== 'Escape' || e.isComposing) return; // Esc during IME composition belongs to the IME
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (zoomEl) closeZoom();
    else deactivate();
  }

  function onBlurInput() {
    blurPx = Number(blurSlider.value);
    applyBlur();
  }

  function onBlurCommit() {
    try {
      chrome.storage.local.set({ blur: blurPx });
    } catch {
      // not persisted; fine
    }
  }

  function button(className, label, title) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.textContent = label;
    b.title = title;
    return b;
  }

  function buildToolbar() {
    const bar = document.createElement('div');
    bar.className = 'rl-toolbar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Revlur');

    const brand = document.createElement('span');
    brand.className = 'rl-brand';
    brand.textContent = 'Revlur';
    brand.title = 'Drag to move the toolbar';
    makeToolbarDraggable(brand);

    const label = document.createElement('label');
    label.className = 'rl-blur-control';
    const labelText = document.createElement('span');
    labelText.textContent = 'Blur';
    blurSlider = document.createElement('input');
    blurSlider.type = 'range';
    blurSlider.min = '0';
    blurSlider.max = String(MAX_BLUR);
    blurSlider.step = '1';
    blurSlider.setAttribute('aria-label', 'Blur intensity');
    blurValue = document.createElement('span');
    blurValue.className = 'rl-value';
    label.append(labelText, blurSlider, blurValue);

    const zoom = button('rl-btn', 'Zoom', 'Show the selected area enlarged');
    scrollBtn = button('rl-btn', 'Scroll', '');
    scrollBtn.addEventListener('click', toggleScroll);
    updateScrollButton();
    const reselect = button('rl-btn', 'Re-select', 'Select a different area');
    const close = button('rl-btn rl-close', '×', 'Exit Revlur (Esc)');
    close.setAttribute('aria-label', 'Exit Revlur');

    blurSlider.addEventListener('input', onBlurInput);
    blurSlider.addEventListener('change', onBlurCommit);
    zoom.addEventListener('click', openZoom);
    reselect.addEventListener('click', enterSelecting);
    close.addEventListener('click', deactivate);

    // Keep toolbar interaction from reaching the page underneath.
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu']) {
      bar.addEventListener(type, (e) => e.stopPropagation());
    }

    bar.append(brand, label, zoom, scrollBtn, reselect, close);
    return bar;
  }

  function activate(css) {
    if (active) return;
    active = true;

    host = document.createElement('revlur-root');
    shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = css;

    blurLayer = document.createElement('div');
    blurLayer.className = 'rl-blur-layer';
    panels = {};
    for (const side of ['t', 'b', 'l', 'r']) {
      panels[side] = document.createElement('div');
      panels[side].className = 'rl-panel';
      // The blurred area is inert: pointer input stops here and never reaches the page.
      // (The wheel and scrollbar still scroll normally.)
      for (const type of ['pointerdown', 'pointerup', 'mouseup', 'click', 'dblclick', 'contextmenu']) {
        panels[side].addEventListener(type, (e) => e.stopPropagation());
      }
      panels[side].addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (e.button === 0) e.preventDefault(); // no focus change or text-selection drag underneath
      });
      blurLayer.appendChild(panels[side]);
    }

    // Thin outline around the whole window: an at-a-glance "Revlur is on" signal.
    frameEl = document.createElement('div');
    frameEl.className = 'rl-frame';

    capture = document.createElement('div');
    capture.className = 'rl-capture';
    selectionEl = document.createElement('div');
    selectionEl.className = 'rl-selection';
    hint = document.createElement('div');
    hint.className = 'rl-hint';
    hint.textContent = HINT_TEXT;
    handlesEl = buildHandles();
    toolbar = buildToolbar();

    shadow.append(style, blurLayer, frameEl, capture, selectionEl, handlesEl, toolbar, hint);
    document.documentElement.appendChild(host);
    enterSelecting();

    capture.addEventListener('pointerdown', onPointerDown);
    capture.addEventListener('pointermove', onPointerMove);
    capture.addEventListener('pointerup', onPointerUp);
    capture.addEventListener('pointercancel', onPointerCancel);
    capture.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onResize);
  }

  function deactivate() {
    if (!active) return;
    active = false;
    zoomToken++;
    unlockScroll();
    scrollAllowed = false; // every activation starts locked
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('resize', onResize);
    host?.remove();
    host = shadow = frameEl = scrollBtn = zoomEl = capture = blurLayer = panels = selectionEl = handlesEl = hint = toolbar = blurSlider = blurValue = null;
    anchor = selection = null;
  }

  const onMessage = (msg) => {
    if (msg?.type !== 'revlur:toggle') return;
    active ? deactivate() : activate(msg.css);
  };
  chrome.runtime.onMessage.addListener(onMessage);

  // After an extension reload the old script lingers in the page, cut off from Chrome. dispose()
  // lets a freshly injected copy clean it up and take over, so tabs need no manual refresh.
  window.__revlur = {
    dispose() {
      deactivate();
      try {
        chrome.runtime.onMessage.removeListener(onMessage);
      } catch {
        // extension context already gone
      }
    },
  };
})();
