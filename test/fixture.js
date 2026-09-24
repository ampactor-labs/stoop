// A deterministic colour photo, built as a PNG with node's own zlib so the
// suite carries no binary fixture and no image library. The intake pipeline
// dithers whatever it is handed; a gradient with a checker laid over it makes
// both the tonal ramp and the hard edges visible in the result.
const zlib = require('zlib');

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

let table = null;
function crc32(buf) {
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

function makePng(w = 240, h = 240) {
  const raw = Buffer.alloc(h * (w * 3 + 1));
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      raw[p++] = Math.floor((x * 255) / w);
      raw[p++] = Math.floor((y * 255) / h);
      raw[p++] = 128 + ((((x / 24) | 0) + ((y / 24) | 0)) % 2) * 90;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// A cut-out: a black square on a fully transparent ground, the kind of PNG
// somebody makes to collage with. It has to come in as a square, not a blob.
function makeCutout(w = 200, h = 200) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0;
    for (let x = 0; x < w; x++) {
      const ink = x >= 80 && x < 120 && y >= 80 && y < 120;
      raw[p++] = 0; raw[p++] = 0; raw[p++] = 0;
      raw[p++] = ink ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

module.exports = {
  makePng,
  photoFile: () => ({ name: 'fixture.png', mimeType: 'image/png', buffer: makePng() }),
  cutoutFile: () => ({ name: 'cutout.png', mimeType: 'image/png', buffer: makeCutout() })
};
