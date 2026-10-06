// Pure geometry helpers for Revlur (no DOM access, unit-testable in Node).
(() => {
  const MIN_SELECTION = 8; // px; smaller drags are treated as a stray click

  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  // Clamp a point into a [0,width] x [0,height] viewport.
  function clampPoint(x, y, width, height) {
    return { x: clamp(x, 0, width), y: clamp(y, 0, height) };
  }

  // Build a normalized rect from two corners, in any drag direction.
  function normalizeRect(x1, y1, x2, y2) {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    return { x, y, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  }

  function isSelectable(rect) {
    return rect.w >= MIN_SELECTION && rect.h >= MIN_SELECTION;
  }

  // Keep an existing rect inside a (possibly smaller) viewport, e.g. after a resize.
  function clampRect(rect, width, height) {
    const x = clamp(rect.x, 0, width);
    const y = clamp(rect.y, 0, height);
    return { x, y, w: Math.min(rect.w, width - x), h: Math.min(rect.h, height - y) };
  }

  // Snap edges to whole pixels so the four blur panels meet with no hairline seams.
  function roundRect(rect) {
    const x = Math.round(rect.x);
    const y = Math.round(rect.y);
    return { x, y, w: Math.round(rect.x + rect.w) - x, h: Math.round(rect.y + rect.h) - y };
  }

  // Place the toolbar below the selection, else above it, else pinned to the viewport bottom.
  function placeToolbar(sel, size, vw, vh, gap = 10, margin = 8) {
    const maxX = Math.max(margin, vw - size.w - margin);
    const x = clamp(sel.x + sel.w / 2 - size.w / 2, margin, maxX);
    const below = sel.y + sel.h + gap;
    if (below + size.h + margin <= vh) return { x, y: below, placement: 'below' };
    const above = sel.y - gap - size.h;
    if (above >= margin) return { x, y: above, placement: 'above' };
    return { x, y: Math.max(margin, vh - size.h - margin), placement: 'overlay' };
  }

  // Part of a rect that lies inside the [0,vw] x [0,vh] viewport (w/h are never negative).
  function intersectViewport(rect, vw, vh) {
    const x0 = clamp(rect.x, 0, vw);
    const y0 = clamp(rect.y, 0, vh);
    const x1 = clamp(rect.x + rect.w, 0, vw);
    const y1 = clamp(rect.y + rect.h, 0, vh);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // Largest zoom factor (CSS px) at which a w x h area fits in the viewport, capped so the
  // enlarged snapshot never gets absurdly soft.
  function fitZoom(w, h, vw, vh, fill = 0.9, maxScale = 4) {
    return Math.min(maxScale, (fill * vw) / w, (fill * vh) / h);
  }

  // Source rect, in screenshot pixels, for a selection given in viewport CSS pixels.
  function cropRect(sel, scaleX, scaleY, imgW, imgH) {
    const x = clamp(Math.round(sel.x * scaleX), 0, imgW - 1);
    const y = clamp(Math.round(sel.y * scaleY), 0, imgH - 1);
    const w = clamp(Math.round(sel.w * scaleX), 1, imgW - x);
    const h = clamp(Math.round(sel.h * scaleY), 1, imgH - y);
    return { x, y, w, h };
  }

  // Fraction of sel's area covered by rect (both {x,y,w,h} in the same coordinate space).
  function overlapRatio(rect, sel) {
    const w = Math.min(rect.x + rect.w, sel.x + sel.w) - Math.max(rect.x, sel.x);
    const h = Math.min(rect.y + rect.h, sel.y + sel.h) - Math.max(rect.y, sel.y);
    const area = sel.w * sel.h;
    return w > 0 && h > 0 && area > 0 ? (w * h) / area : 0;
  }

  // An element is a reliable Lock-on target when it covers most of the selection and is not
  // a much larger container (e.g. a grid holding several cards, or the whole page).
  function isReliableTarget(rect, sel, minCover = 0.7, maxAreaRatio = 3) {
    if (rect.w <= 0 || rect.h <= 0) return false;
    return overlapRatio(rect, sel) >= minCover && rect.w * rect.h <= maxAreaRatio * sel.w * sel.h;
  }

  // revlur-2026-10-06-143012.png (local time)
  function snapshotFileName(date) {
    const p = (n) => String(n).padStart(2, '0');
    const day = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
    const time = `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
    return `revlur-${day}-${time}.png`;
  }

  const api = {
    MIN_SELECTION, clamp, clampPoint, normalizeRect, isSelectable, clampRect, roundRect, placeToolbar,
    intersectViewport, fitZoom, cropRect, overlapRatio, isReliableTarget, snapshotFileName,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.__revlurGeometry = api;
})();
