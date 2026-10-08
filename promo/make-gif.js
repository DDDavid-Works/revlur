// Records the website's interactive demo as a GIF (promo/revlur-demo.gif).
// Usage: npm i && node make-gif.js [outfile]
// It drives the real demo page in headless Chrome with scripted mouse moves, so every frame is
// deterministic, then encodes the frames with a pure-JS GIF encoder (no ffmpeg needed).
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { PNG } = require('pngjs');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const PAGE = 'file:///' + path.resolve(__dirname, '../website/index.html').replace(/\\/g, '/');
const OUT = process.argv[2] || path.join(__dirname, 'revlur-demo.gif');
const FRAME_MS = 70; // motion frames (~14 fps)

const frames = []; // { rgba, w, h, delay }

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); // no auto intro, instant zoom
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await page.evaluate(() => document.querySelector('.demo-card').scrollIntoView({ block: 'center' }));

  // A fake cursor (screenshots don't include the real one): arrow normally, crosshair while selecting.
  await page.evaluate(() => {
    const c = document.createElement('div');
    c.id = 'fake-cursor';
    c.style.cssText = 'position:fixed;left:-50px;top:-50px;width:24px;height:24px;z-index:99999;pointer-events:none;';
    document.body.appendChild(c);
    const arrow = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l14 8-6 1.5L8.5 18z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    const cross = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 2v20M2 12h20" stroke="#fff" stroke-width="4"/><path d="M12 2v20M2 12h20" stroke="#111" stroke-width="1.5"/></svg>';
    const stage = document.getElementById('demo-stage');
    document.addEventListener('mousemove', (e) => {
      const crossing = stage.classList.contains('selecting') && stage.contains(e.target) && document.getElementById('demo-zoom').hidden;
      const over = document.getElementById('demo-zoom').hidden === false && e.target.closest && e.target.closest('#zoom-frame');
      c.innerHTML = over ? '' : crossing ? cross : arrow;
      const off = crossing ? 12 : 3;
      c.style.left = e.clientX - off + 'px';
      c.style.top = e.clientY - off + 'px';
    });
  });

  const card = await page.$('.demo-card');
  async function grab(delay) {
    const png = PNG.sync.read(await card.screenshot({ type: 'png' }));
    frames.push({ rgba: png.data, w: png.width, h: png.height, delay });
  }
  const hold = (ms) => grab(ms);
  const rectOf = (sel, nth = 0) => page.evaluate((s, n) => { const r = document.querySelectorAll(s)[n].getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel, nth);
  let mouse = { x: 40, y: 40 };
  async function moveTo(x, y, steps = 14) {
    const from = mouse;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // ease in-out
      await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
      await grab(FRAME_MS);
    }
    mouse = { x, y };
  }
  async function jump(x, y) { await page.mouse.move(x, y); mouse = { x, y }; }
  async function drag(r, pad = 8) {
    await moveTo(r.x - pad, r.y - pad, 9);
    await page.mouse.down();
    await moveTo(r.x + r.w + pad, r.y + r.h + pad, 14);
    await page.mouse.up();
    await grab(FRAME_MS);
  }
  async function clickEl(sel) {
    const r = await rectOf(sel);
    await moveTo(r.x + r.w / 2, r.y + r.h / 2, 8);
    await hold(180);
    await page.mouse.click(r.x + r.w / 2, r.y + r.h / 2);
    await grab(FRAME_MS);
  }

  // ---- Scene 1: dashboard. Select the stat cards, the rest blurs.
  await jump(520, 700);
  await hold(800);
  await drag(await rectOf('.cards'));
  await hold(1000);

  // ---- Scene 2: Zoom in on the selection, then close.
  await clickEl('#demo-zoom-btn');
  await hold(300);
  const zf = await rectOf('#zoom-frame');
  await moveTo(zf.x + zf.w * 0.25, zf.y + zf.h * 0.5, 8);
  await moveTo(zf.x + zf.w * 0.7, zf.y + zf.h * 0.45, 9);
  await hold(500);
  await page.keyboard.press('Escape');
  await grab(FRAME_MS);
  await hold(300);

  // ---- Scene 3: Re-select, switch to the Article tab, select a section.
  await clickEl('#demo-reselect-btn');
  await hold(300);
  await clickEl('#tab-article');
  await hold(800);
  const h4 = await rectOf('[data-page=article] h4', 0);
  const para = await rectOf('[data-page=article] h4 + p', 0);
  const ib = await rectOf('[data-page=article] .infobox');
  await drag({ x: h4.x, y: h4.y, w: ib.x - 16 - h4.x, h: para.y + para.h - h4.y }, 6);
  await hold(1100);

  // ---- Scene 4: Scroll on, let the article move through the clear window.
  await clickEl('#demo-scroll-btn');
  await hold(300);
  const stageBox = await rectOf('#demo-stage');
  await moveTo(stageBox.x + stageBox.w * 0.5, stageBox.y + stageBox.h * 0.35, 8);
  for (let i = 0; i < 8; i++) { await page.mouse.wheel({ deltaY: 22 }); await grab(FRAME_MS); }
  await hold(1400);

  await browser.close();

  if (process.env.DUMP) { fs.mkdirSync(process.env.DUMP, { recursive: true }); frames.forEach((f, i) => { if (i % 8 === 0 || f.delay > 300) { const p = new PNG({ width: f.w, height: f.h }); Buffer.from(f.rgba).copy(p.data); fs.writeFileSync(path.join(process.env.DUMP, String(i).padStart(3, "0") + "_" + f.delay + ".png"), PNG.sync.write(p)); } }); }

  // ---- Encode: one global palette from sampled frames (small file, no flicker between frames).
  const { w, h } = frames[0];
  const sample = Buffer.concat(frames.filter((_, i) => i % 6 === 0).map((f) => Buffer.from(f.rgba)));
  const palette = quantize(sample, 256, { format: 'rgb565' });
  const gif = GIFEncoder();
  frames.forEach((f, i) => gif.writeFrame(applyPalette(f.rgba, palette, 'rgb565'), w, h, { palette: i === 0 ? palette : undefined, delay: f.delay, repeat: 0 }));
  gif.finish();
  fs.writeFileSync(OUT, Buffer.from(gif.bytes()));
  const total = frames.reduce((s, f) => s + f.delay, 0);
  console.log(`${OUT}\n${frames.length} frames, ${w}x${h}, ${(total / 1000).toFixed(1)}s, ${(fs.statSync(OUT).size / 1048576).toFixed(2)} MB`);
})().catch((e) => { console.error(e); process.exit(1); });
