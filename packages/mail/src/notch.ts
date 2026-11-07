import { deflateSync } from "node:zlib";

/*
 * Flancs du notch replié de l'app (apps/web/src/components/app/notch-shape.ts) : sous le cadre,
 * le S « C24 6 20 56 44 56 », soit de (0, 0) à (44, 50) avec les points de contrôle (24, 0) et
 * (20, 50). Les clients mail n'affichent pas le SVG : chaque flanc devient un PNG transparent,
 * à la couleur du notch, généré à l'envoi et joint à l'e-mail (cid).
 */

export const NOTCH_FLANK = { width: 44, height: 50 };
const SCALE = 2;
const SAMPLES = 4;

/** Identifiant d'image d'un flanc, couleur comprise (« notch-left-111111 »). */
export const notchCid = (side: "left" | "right", color: string) =>
  `notch-${side}-${color.replace("#", "").toLowerCase()}`;
export const NOTCH_CID_PATTERN = /cid:(notch-(left|right)-([0-9a-f]{6}))/g;

/** Hauteur de la courbe à l'abscisse x (0 → 44) : la courbe est monotone en x. */
function curveY(x: number): number {
  const bezier = (t: number, a: number, b: number, c: number, d: number) =>
    (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 30; step++) {
    const middle = (low + high) / 2;
    if (bezier(middle, 0, 24, 20, 44) < x) low = middle;
    else high = middle;
  }
  return bezier((low + high) / 2, 0, 0, 50, 50);
}

let crcTable: number[] | null = null;
function crc32(bytes: Uint8Array): number {
  crcTable ??= Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** PNG du flanc gauche ou droit (88 × 100, affiché en 44 × 50), lissé par suréchantillonnage. */
export function notchFlankPng(side: "left" | "right", color: string): Buffer {
  const width = NOTCH_FLANK.width * SCALE;
  const height = NOTCH_FLANK.height * SCALE;
  const [r, g, b] = [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16));
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let py = 0; py < height; py++) {
    const row = py * (width * 4 + 1);
    rows[row] = 0;
    for (let px = 0; px < width; px++) {
      let inside = 0;
      for (let sx = 0; sx < SAMPLES; sx++) {
        const x = (px + (sx + 0.5) / SAMPLES) / SCALE;
        const limit = curveY(side === "left" ? x : NOTCH_FLANK.width - x);
        for (let sy = 0; sy < SAMPLES; sy++) {
          if ((py + (sy + 0.5) / SAMPLES) / SCALE < limit) inside++;
        }
      }
      const offset = row + 1 + px * 4;
      rows[offset] = r ?? 0;
      rows[offset + 1] = g ?? 0;
      rows[offset + 2] = b ?? 0;
      rows[offset + 3] = Math.round((inside / SAMPLES ** 2) * 255);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", new Uint8Array()),
  ]);
}
