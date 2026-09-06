// Génère icons/icon{16,32,48,128}.png — zéro dépendance (zlib intégré à Node).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');
const BG = [14, 21, 18];        // #0E1512
const ACCENT = [198, 242, 78];  // #C6F24E
const INK = [234, 230, 218];    // #EAE6DA

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, px) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
function makeIcon(S) {
  const px = Buffer.alloc(S * S * 4);
  const c = (S - 1) / 2;
  const inside = (x, y) => { const dx = x - c, dy = y - c; return Math.hypot(dx, dy); };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const d = inside(x, y);
      const a = (Math.atan2(y - c, x - c) * 180 / Math.PI + 360) % 360;
      const n = S / 128;
      if (d > 0.47 * S) continue; // transparent
      px[i] = BG[0]; px[i + 1] = BG[1]; px[i + 2] = BG[2]; px[i + 3] = 255;
      // anneaux "empreinte" : trois arcs décalés
      const rings = [
        { r: 0.20 * S, t: 4.2 * n, from: 60, to: 300 },
        { r: 0.29 * S, t: 4.2 * n, from: 150, to: 40 },
        { r: 0.38 * S, t: 4.6 * n, from: 240, to: 130 }
      ];
      for (const ring of rings) {
        const dd = Math.abs(d - ring.r);
        if (dd <= ring.t) {
          let inArc = false;
          if (ring.from < ring.to) inArc = a >= ring.from && a <= ring.to;
          else inArc = a >= ring.from || a <= ring.to;
          if (inArc) { px[i] = ACCENT[0]; px[i + 1] = ACCENT[1]; px[i + 2] = ACCENT[2]; }
        }
      }
      if (d <= 0.045 * S) { px[i] = INK[0]; px[i + 1] = INK[1]; px[i + 2] = INK[2]; }
    }
  }
  return png(S, px);
}
fs.mkdirSync(OUT, { recursive: true });
for (const s of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(OUT, 'icon' + s + '.png'), makeIcon(s));
  console.log('icon' + s + '.png écrit');
}
