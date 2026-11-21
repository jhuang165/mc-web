// Batch 91 console91: what the cache key's light hash (net-native-bytes.js hashSide, b90) costs per /netstat chunk message, against the deflate it saves.
// Node only (no browser, no dev server): `node tools/bench-lighthash91.mjs [size] [height]`. A 1 and a 5 column message is hashed and, for comparison, built and deflated once.
import { hashSide, columnData, deflatedLength } from "../src/multiplayer/net-native-bytes.js";
const size = Number(process.argv[2] ?? 128), height = Number(process.argv[3] ?? 256);
const cells = size * size * height, sky = new Uint8Array(cells), block = new Uint8Array(cells);
let s = 1; for (let i = 0; i < cells; i += 7) { s = (s * 1103515245 + 12345) >>> 0; sky[i] = (s >>> 16) & 15; }
const light = { size, height, sky, block };
const source = { height, light };
const runs = [1, 64 * 256, 0, 192 * 256];
const columns = (n) => Array.from({ length: n }, (_, k) => ({ x: 2 + k, z: 3, runs }));
const time = (f, n) => { f(); const t = process.hrtime.bigint(); for (let i = 0; i < n; i++) f(); return Number(process.hrtime.bigint() - t) / n / 1e6; };
for (const n of [1, 5]) {
  const cs = columns(n);
  const hash = time(() => hashSide(cs, source), 400);
  const build = time(() => deflatedLength(Buffer.concat(cs.map((c) => columnData(c, source)))), 40);
  console.log(`${n} column(s): light hash ${hash.toFixed(3)} ms, column data + deflate ${build.toFixed(3)} ms (hash = ${(100 * hash / build).toFixed(1)}% of a miss)`);
}
