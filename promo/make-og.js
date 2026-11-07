// Renders the website's social preview image (website/assets/og-image.png, 1200x630)
// and the iOS home-screen icon (website/assets/apple-touch-icon.png, 180x180).
// Usage: node make-og.js
// It screenshots the real demo card from website/index.html, then lays it out next to the headline.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const SITE = path.resolve(__dirname, '../website');
const fileUrl = (p) => 'file:///' + p.replace(/\\/g, '/');

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
  const page = await browser.newPage();

  // 1. Demo card with the intro selection applied (the cards row clear, the rest blurred).
  await page.setViewport({ width: 900, height: 900, deviceScaleFactor: 2 });
  await page.goto(fileUrl(path.join(SITE, 'index.html')), { waitUntil: 'load' });
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important} .hint{display:none!important}' });
  await page.evaluate(() => document.querySelector('.demo-card').scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 3500)); // let the intro animation settle on its selection
  const card = await page.$('.demo-card');
  const demoPng = await card.screenshot({ encoding: 'base64' });

  const icon = fs.readFileSync(path.join(SITE, 'assets/icon.svg'), 'utf8').replace(/^\uFEFF/, '');
  const iconUrl = 'data:image/svg+xml;base64,' + Buffer.from(icon).toString('base64');

  // 2. The 1200x630 card.
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box} body{margin:0;width:1200px;height:630px;overflow:hidden;background:#1b2735;color:#f4f7fa;
      font-family:system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;align-items:center;gap:48px;padding:0 0 0 72px}
    .txt{flex:0 0 480px}
    .brand{display:flex;align-items:center;gap:14px;font-weight:700;font-size:34px;margin-bottom:40px}
    .brand i{color:#e5565b;font-style:normal}
    h1{font-size:56px;line-height:1.05;margin:0 0 24px;letter-spacing:-.02em} h1 span{color:#e5565b}
    p{margin:0;color:#9fb1c4;font-size:24px;line-height:1.35}
    .shot{flex:1;height:100%;display:flex;align-items:center}
    .shot img{width:700px;border-radius:16px;border:1px solid #34475c;box-shadow:0 30px 80px rgba(0,0,0,.5)}
  </style></head><body>
    <div class="txt">
      <div class="brand"><img src="${iconUrl}" width="56" height="56"><span>Revlur<i>.</i></span></div>
      <h1>Show one thing.<br><span>Blur the rest.</span></h1>
      <p>A free Chrome extension. Drag a box on any page and everything else gets blurred.</p>
    </div>
    <div class="shot"><img src="data:image/png;base64,${demoPng}"></div>
  </body></html>`, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(SITE, 'assets/og-image.png') });

  // 3. Apple touch icon: the icon on its own background colour, edge to edge (iOS rounds the corners).
  await page.setViewport({ width: 180, height: 180, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:#3d5166"><img src="${iconUrl}" width="180" height="180" style="display:block;transform:scale(1.12)"></body></html>`, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(SITE, 'assets/apple-touch-icon.png') });

  await browser.close();
  console.log('Wrote website/assets/og-image.png and website/assets/apple-touch-icon.png');
})();
