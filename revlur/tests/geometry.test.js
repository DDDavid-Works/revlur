const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../src/content/geometry.js');

test('normalizeRect handles all four drag directions', () => {
  const expected = { x: 10, y: 20, w: 100, h: 50 };
  assert.deepEqual(g.normalizeRect(10, 20, 110, 70), expected); // TL -> BR
  assert.deepEqual(g.normalizeRect(110, 70, 10, 20), expected); // BR -> TL
  assert.deepEqual(g.normalizeRect(110, 20, 10, 70), expected); // TR -> BL
  assert.deepEqual(g.normalizeRect(10, 70, 110, 20), expected); // BL -> TR
});

test('clampPoint keeps points inside the viewport', () => {
  assert.deepEqual(g.clampPoint(-5, 900, 800, 600), { x: 0, y: 600 });
  assert.deepEqual(g.clampPoint(400, 300, 800, 600), { x: 400, y: 300 });
});

test('isSelectable rejects tiny drags', () => {
  assert.equal(g.isSelectable({ x: 0, y: 0, w: 3, h: 300 }), false);
  assert.equal(g.isSelectable({ x: 0, y: 0, w: 8, h: 8 }), true);
});

test('clampRect shrinks a rect into a smaller viewport', () => {
  assert.deepEqual(g.clampRect({ x: 700, y: 500, w: 200, h: 200 }, 800, 600), { x: 700, y: 500, w: 100, h: 100 });
  assert.deepEqual(g.clampRect({ x: 10, y: 10, w: 50, h: 50 }, 800, 600), { x: 10, y: 10, w: 50, h: 50 });
});

test('roundRect snaps edges to whole pixels without gaps', () => {
  const r = g.roundRect({ x: 10.4, y: 20.6, w: 100.5, h: 50.2 });
  assert.deepEqual(r, { x: 10, y: 21, w: 101, h: 50 });
  assert.ok(Number.isInteger(r.x + r.w) && Number.isInteger(r.y + r.h));
});

test('placeToolbar prefers below, then above, then overlay', () => {
  const size = { w: 300, h: 40 };
  assert.deepEqual(g.placeToolbar({ x: 100, y: 100, w: 200, h: 100 }, size, 1000, 800), { x: 50, y: 210, placement: 'below' });
  assert.deepEqual(g.placeToolbar({ x: 100, y: 300, w: 200, h: 460 }, size, 1000, 800), { x: 50, y: 250, placement: 'above' });
  assert.equal(g.placeToolbar({ x: 0, y: 0, w: 1000, h: 800 }, size, 1000, 800).placement, 'overlay');
});

test('placeToolbar clamps horizontally into the viewport', () => {
  assert.equal(g.placeToolbar({ x: 0, y: 10, w: 40, h: 40 }, { w: 300, h: 40 }, 1000, 800).x, 8);
  assert.equal(g.placeToolbar({ x: 960, y: 10, w: 40, h: 40 }, { w: 300, h: 40 }, 1000, 800).x, 692);
});

test('intersectViewport clips a partly off-screen rect and never goes negative', () => {
  assert.deepEqual(g.intersectViewport({ x: -20, y: 50, w: 100, h: 100 }, 800, 600), { x: 0, y: 50, w: 80, h: 100 });
  assert.deepEqual(g.intersectViewport({ x: 900, y: 50, w: 100, h: 100 }, 800, 600), { x: 800, y: 50, w: 0, h: 100 });
});

test('fitZoom fits the viewport and is capped', () => {
  assert.equal(g.fitZoom(400, 300, 1000, 800), 2.25); // width-limited: 0.9*1000/400
  assert.equal(g.fitZoom(1000, 100, 1000, 800), 0.9); // wide selection
  assert.equal(g.fitZoom(20, 20, 1000, 800), 4); // capped
});

test('cropRect converts CSS px to screenshot px and stays inside the image', () => {
  assert.deepEqual(g.cropRect({ x: 10, y: 20, w: 100, h: 50 }, 2, 2, 2000, 1600), { x: 20, y: 40, w: 200, h: 100 });
  const r = g.cropRect({ x: 990, y: 790, w: 100, h: 100 }, 2, 2, 2000, 1600);
  assert.ok(r.x + r.w <= 2000 && r.y + r.h <= 1600 && r.w >= 1 && r.h >= 1);
});

test('snapshotFileName is sortable local time with zero padding', () => {
  assert.equal(g.snapshotFileName(new Date(2026, 9, 6, 14, 30, 12)), 'revlur-2026-10-06-143012.png');
  assert.equal(g.snapshotFileName(new Date(2026, 0, 2, 3, 4, 5)), 'revlur-2026-01-02-030405.png');
});
