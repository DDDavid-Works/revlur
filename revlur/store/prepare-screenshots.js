#!/usr/bin/env node
// Checks screenshots for the Chrome Web Store and converts them to what it wants:
// exactly 1280x800 (or 640x400) and 24-bit PNG with no alpha channel.
// DevTools' "Capture screenshot" saves a 32-bit PNG with an alpha channel, which the store can reject.
//
// Usage:  node store/prepare-screenshots.js <folder-with-png-files> [output-folder]
// Output goes to <folder>/store-ready by default. Zero dependencies.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ALLOWED = [[1280, 800], [640, 400]];
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buf) {
  return zlib.crc32 ? zlib.crc32(buf) : (() => { throw new Error('Node 22+ is required (zlib.crc32)'); })();
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function parsePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG file');
  let pos = 8;
  let ihdr = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error('missing IHDR');
  return { ...ihdr, idat: Buffer.concat(idat) };
}

// Undo PNG scanline filtering; returns raw pixel rows (no filter bytes).
function unfilter(raw, w, h, bpp) {
  const stride = w * bpp;
  const out = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0;
      const b = y > 0 ? out[dst - stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (ft !== 0) throw new Error('bad filter type ' + ft);
      out[dst + x] = v & 255;
    }
  }
  return out;
}

function toRgbPng(png) {
  if (png.depth !== 8 || png.interlace !== 0) throw new Error('only 8-bit, non-interlaced PNGs are supported');
  if (png.color !== 2 && png.color !== 6) throw new Error('only RGB or RGBA PNGs are supported (color type ' + png.color + ')');
  const bpp = png.color === 6 ? 4 : 3;
  const px = unfilter(zlib.inflateSync(png.idat), png.w, png.h, bpp);
  const rgb = Buffer.alloc(png.w * png.h * 3);
  let translucent = 0;
  for (let i = 0, j = 0; i < px.length; i += bpp, j += 3) {
    if (bpp === 4) {
      const a = px[i + 3];
      if (a !== 255) translucent++;
      // composite on white, so any see-through pixel becomes a solid colour
      for (let k = 0; k < 3; k++) rgb[j + k] = Math.round((px[i + k] * a + 255 * (255 - a)) / 255);
    } else {
      rgb[j] = px[i]; rgb[j + 1] = px[i + 1]; rgb[j + 2] = px[i + 2];
    }
  }
  const stride = png.w * 3;
  const filtered = Buffer.alloc((stride + 1) * png.h);
  for (let y = 0; y < png.h; y++) rgb.copy(filtered, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(png.w, 0);
  ihdr.writeUInt32BE(png.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return {
    translucent,
    data: Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(filtered, { level: 9 })), chunk('IEND', Buffer.alloc(0))]),
  };
}

const inDir = process.argv[2];
if (!inDir || !fs.existsSync(inDir) || !fs.statSync(inDir).isDirectory()) {
  console.error('Usage: node store/prepare-screenshots.js <folder-with-png-files> [output-folder]');
  process.exit(2);
}
const outDir = process.argv[3] || path.join(inDir, 'store-ready');
const files = fs.readdirSync(inDir).filter((f) => /\.png$/i.test(f)).sort();
if (!files.length) {
  console.error('No .png files in ' + inDir);
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

let problems = 0;
console.log('file'.padEnd(34) + 'size'.padEnd(12) + 'was'.padEnd(10) + 'result');
for (const f of files) {
  try {
    const png = parsePng(fs.readFileSync(path.join(inDir, f)));
    const okSize = ALLOWED.some(([w, h]) => w === png.w && h === png.h);
    const was = { 2: '24-bit', 6: '32-bit' }[png.color] || 'type ' + png.color;
    const { data, translucent } = toRgbPng(png);
    fs.writeFileSync(path.join(outDir, f), data);
    const note = [okSize ? 'ok' : 'WRONG SIZE (need 1280x800 or 640x400)', translucent ? translucent + ' see-through pixels flattened onto white' : null].filter(Boolean).join('; ');
    if (!okSize) problems++;
    console.log(f.padEnd(34) + (png.w + 'x' + png.h).padEnd(12) + was.padEnd(10) + note);
  } catch (err) {
    problems++;
    console.log(f.padEnd(34) + 'ERROR: ' + err.message);
  }
}
console.log('\nWrote 24-bit copies to ' + outDir);
if (problems) {
  console.log(problems + ' file(s) need attention before upload.');
  process.exit(1);
}
console.log('All files are the right size and format for the Chrome Web Store.');
