#!/usr/bin/env node
// Builds dist/revlur-<version>.zip for the Chrome Web Store.
// Ships only manifest.json and src/ (no tests, test pages, docs or scripts). Zero dependencies.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// ---- gather files ----
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith('.')) return []; // .DS_Store, editor files, ...
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = ['manifest.json', ...walk(path.join(root, 'src')).map((f) => path.relative(root, f))]
  .map((f) => f.split(path.sep).join('/'))
  .sort();

// ---- sanity checks: fail the build rather than ship a broken extension ----
const referenced = new Set([
  manifest.background?.service_worker,
  ...Object.values(manifest.icons ?? {}),
  ...Object.values(manifest.action?.default_icon ?? {}),
]);
const problems = [];
for (const ref of referenced) {
  if (ref && !files.includes(ref)) problems.push(`manifest references a missing file: ${ref}`);
}
if (manifest.manifest_version !== 3) problems.push('manifest_version must be 3');
if (!/^\d+(\.\d+){0,3}$/.test(manifest.version ?? '')) problems.push(`invalid version: ${manifest.version}`);
if (manifest.action?.default_popup) problems.push('default_popup must stay unset (click-to-activate flow)');
if (manifest.commands?._execute_action?.suggested_key) problems.push('no default shortcut should be suggested');
for (const f of files) {
  if (f !== 'manifest.json' && !f.startsWith('src/')) problems.push(`unexpected file in package: ${f}`);
  if (/\.(test|spec)\.js$/.test(f)) problems.push(`test file in package: ${f}`);
}
if (problems.length) {
  console.error('Packaging aborted:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}

// ---- minimal zip writer (deflate) ----
const DOS_TIME = 0; // fixed timestamp (2026-01-01 00:00) so identical sources give identical zips
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

const localParts = [];
const centralParts = [];
let offset = 0;

for (const name of files) {
  const data = fs.readFileSync(path.join(root, name));
  const compressed = zlib.deflateRawSync(data, { level: 9 });
  const useDeflate = compressed.length < data.length;
  const body = useDeflate ? compressed : data;
  const method = useDeflate ? 8 : 0;
  const crc = zlib.crc32(data);
  const nameBuf = Buffer.from(name, 'utf8');

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  localParts.push(local, nameBuf, body);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(offset, 42);
  centralParts.push(central, nameBuf);

  offset += local.length + nameBuf.length + body.length;
}

const centralSize = centralParts.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

const zip = Buffer.concat([...localParts, ...centralParts, end]);

const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });
const outFile = path.join(distDir, `revlur-${manifest.version}.zip`);
fs.writeFileSync(outFile, zip);

console.log(`Packaged ${files.length} files -> ${path.relative(root, outFile)} (${(zip.length / 1024).toFixed(1)} KB)`);
for (const f of files) console.log(`  ${f}`);
