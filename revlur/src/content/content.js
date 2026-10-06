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
  let lockBtn = null;
  let lockOn = false; // user's Lock-on toggle (OFF by default)
  let lock = null; // active tracking: {el|null, off, doc, w, h, raf, timer, ro}

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
    // Lock-on can push the hole partly or fully off-screen; place the toolbar by its visible part.
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
    drawBlur(rect);
    positionToolbar();
  }

  // ---- Lock-on (best-effort; never touches page scrolling) ----

  // Smallest element that snugly contains the selection, or null if none is reliable.
  function findLockTarget(sel) {
    const els = [];
    for (const fx of [0.15, 0.5, 0.85]) {
      for (const fy of [0.15, 0.5, 0.85]) {
        const el = document.elementFromPoint(sel.x + sel.w * fx, sel.y + sel.h * fy);
        if (el && el !== host) els.push(el);
      }
    }
    if (!els.length) return null;
    let anc = els[0];
    for (const el of els) {
      while (anc && !anc.contains(el)) anc = anc.parentElement;
    }
    const body = document.body;
    for (let el = anc; el && el !== body && el !== document.documentElement; el = el.parentElement) {
      if (el.tagName === 'IFRAME') return null; // iframes are out of scope for V1
      const r = el.getBoundingClientRect();
      if (geo.overlapRatio({ x: r.left, y: r.top, w: r.width, h: r.height }, sel) >= 0.7) {
        return geo.isReliableTarget({ x: r.left, y: r.top, w: r.width, h: r.height }, sel) ? el : null;
      }
    }
    return null;
  }

  function releaseLock() {
    if (!lock) return;
    cancelAnimationFrame(lock.raf);
    clearInterval(lock.timer);
    lock.ro?.disconnect();
    window.removeEventListener('scroll', scheduleLock);
    lock = null;
  }

  function updateLockButton() {
    lockBtn?.setAttribute('aria-pressed', String(lockOn));
    if (lockBtn) {
      lockBtn.title = !lockOn
        ? 'Keep the focus on the same content while scrolling'
        : lock?.el
          ? 'Locked onto the page element under the selection'
          : 'Locked onto the selected page position';
    }
  }

  function loseLock(note) {
    lockOn = false;
    releaseLock();
    updateLockButton();
    showNote(note);
  }

  function scheduleLock() {
    if (lock && !lock.raf) {
      lock.raf = requestAnimationFrame(() => {
        if (lock) lock.raf = 0;
        lockUpdate();
      });
    }
  }

  function lockUpdate() {
    if (!lock || !selection) return;
    let rect;
    if (lock.el) {
      const r = lock.el.getBoundingClientRect();
      if (!lock.el.isConnected || (r.width === 0 && r.height === 0)) {
        loseLock('Lock-on turned off: the tracked element is gone');
        return;
      }
      rect = { x: r.left + lock.off.x, y: r.top + lock.off.y, w: lock.w, h: lock.h };
    } else {
      // No reliable element: stick to the same spot on the page (document coordinates).
      rect = { x: lock.doc.x - window.scrollX, y: lock.doc.y - window.scrollY, w: lock.w, h: lock.h };
    }
    if (rect.x !== selection.x || rect.y !== selection.y) setSelection(rect);
  }

  function acquireLock() {
    releaseLock();
    if (!lockOn || !selection) return;
    const el = findLockTarget(selection);
    const r = el?.getBoundingClientRect();
    lock = {
      el,
      off: r ? { x: selection.x - r.left, y: selection.y - r.top } : null,
      doc: { x: selection.x + window.scrollX, y: selection.y + window.scrollY },
      w: selection.w,
      h: selection.h,
      raf: 0,
      timer: setInterval(lockUpdate, 300), // catches layout shifts that fire no scroll event
      ro: null,
    };
    if (el && typeof ResizeObserver === 'function') {
      lock.ro = new ResizeObserver(scheduleLock);
      lock.ro.observe(el);
    }
    window.addEventListener('scroll', scheduleLock, { passive: true });
    updateLockButton();
  }

  function toggleLock() {
    lockOn = !lockOn;
    if (lockOn) acquireLock();
    else releaseLock();
    updateLockButton();
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
    toolbar.hidden = false;
    positionToolbar();
  }

  // Show the selected area enlarged in a modal over the (still blurred) page.
  async function openZoom() {
    if (!selection || zoomEl) return;
    // Lock-on can leave the hole partly off-screen: zoom the part that is visible.
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
    const closeBtn = button('rl-zoom-close', '×', 'Close (Esc)');
    closeBtn.setAttribute('aria-label', 'Close zoom');
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
    const copyBtn = button('rl-zoom-action', 'Copy', 'Copy the image (Ctrl/Cmd+C)');
    const saveBtn = button('rl-zoom-action', 'Save', 'Save as a PNG file');
    const flash = (btn, text) => {
      const label = btn.dataset.label ?? (btn.dataset.label = btn.textContent);
      btn.textContent = text;
      clearTimeout(btn._t);
      btn._t = setTimeout(() => {
        btn.textContent = label;
      }, 1600);
    };
    const toBlob = () => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    // Writes only on a click or key press (a user gesture); Revlur never reads the clipboard.
    const copyImage = async () => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob() })]);
        flash(copyBtn, 'Copied');
      } catch {
        flash(copyBtn, 'Copy failed');
      }
    };
    const saveImage = async () => {
      const blob = await toBlob();
      if (!blob) return flash(saveBtn, 'Save failed');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = geo.snapshotFileName(new Date());
      shadow.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      flash(saveBtn, 'Saved');
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
    toolbar.hidden = true;
    shadow.append(zoomEl);
  }

  // Selecting: crosshair capture layer on, no blur. Used on activation and for Re-select.
  function enterSelecting() {
    toolbarPos = null;
    closeZoom();
    releaseLock();
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
    drawBlur(rect);
    blurLayer.hidden = false;
    toolbar.hidden = false;
    applyBlur();
    positionToolbar();
    acquireLock(); // no-op unless the Lock-on toggle is on
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
    if (lock) {
      lockUpdate();
      drawBlur(selection); // viewport size changed
      positionToolbar();
      return;
    }
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
    lockBtn = button('rl-btn', 'Lock-on', '');
    lockBtn.addEventListener('click', toggleLock);
    updateLockButton();
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

    bar.append(brand, label, zoom, lockBtn, reselect, close);
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
    toolbar = buildToolbar();

    shadow.append(style, blurLayer, frameEl, capture, selectionEl, toolbar, hint);
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
    releaseLock();
    lockOn = false; // Lock-on is OFF by default on every activation
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('resize', onResize);
    host?.remove();
    host = shadow = frameEl = lockBtn = zoomEl = capture = blurLayer = panels = selectionEl = hint = toolbar = blurSlider = blurValue = null;
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
