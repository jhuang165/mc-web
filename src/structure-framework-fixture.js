// Test support for structure replays: the JS mirror of MineshaftProbe's World double.
// Synthetic fixtures (stone, pockets, water, air) or supplied native chunk arrays, with the
// probe's ordered service-call and write SHA-1 encodings (little-endian int32).
import { createHash } from "node:crypto";
import { isAirMaterial } from "./structure-framework.js";

const hash3 = (x, y, z) => Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791);
const mod = (a, b) => ((a % b) + b) % b;
export function fixtureBlock(name, x, y, z) {
  if (name === "air") return 0;
  if (y > 63) return 0;
  if (name === "stone") return 1;
  if (name === "water") return mod(x * 7 + z * 13, 97) === 0 && y >= 20 && y <= 60 ? 9 : 1;
  const k = hash3(x >> 1, y >> 1, z >> 1) & 15;
  return k <= 2 ? 0 : k === 3 ? 20 : k === 4 ? 13 : k === 5 ? 18 : 1;
}
const outside = (x, y, z) => y < 0 || y >= 256 || x < -30000000 || x >= 30000000 || z < -30000000 || z >= 30000000;

export class RecordingWorld {
  constructor(fixture, chunks = null) {
    this.fixture = fixture; this.chunks = chunks;
    this.edits = new Map(); this.tiles = new Map();
    this.fullWrites = null; this.reset();
  }
  reset() {
    this.calls = createHash("sha1"); this.writes = createHash("sha1");
    this.callCount = 0; this.writeCount = 0; this.entities = [];
  }
  static ints(hash, args) {
    const b = Buffer.alloc(args.length * 4);
    args.forEach((v, i) => b.writeInt32LE(v | 0, i * 4));
    hash.update(b);
  }
  call(...args) { this.callCount++; RecordingWorld.ints(this.calls, args); }
  getBlock(x, y, z) {
    this.call(0, x, y, z);
    if (outside(x, y, z)) return 0;
    const e = this.edits.get(`${x},${y},${z}`);
    if (e !== undefined) return e;
    if (this.fixture === "natural") {
      const c = this.chunks.get(`${x >> 4},${z >> 4}`);
      if (!c) throw new Error(`Missing chunk ${x >> 4},${z >> 4}`);
      return c[((x & 15) * 16 + (z & 15)) * 256 + y];
    }
    return fixtureBlock(this.fixture, x, y, z);
  }
  isAirBlock(x, y, z) { this.call(1, x, y, z); return isAirMaterial(this.getBlock(x, y, z)); }
  setBlock(x, y, z, id, meta, flags) {
    this.call(2, x, y, z, id, meta, flags);
    if (outside(x, y, z)) return false;
    const k = `${x},${y},${z}`;
    this.edits.set(k, id); this.writeCount++; RecordingWorld.ints(this.writes, [x, y, z, id, meta, flags]);
    if (this.fullWrites) this.fullWrites.push([x, y, z, id, meta, flags]);
    this.tiles.delete(k);
    if (id === 54) {
      const t = { size: 27, slots: Array(27).fill(null), writes: [] };
      t.setSlot = (i, s) => { t.slots[i] = s; t.writes.push([i, s]); };
      this.tiles.set(k, t);
    }
    if (id === 52) { const t = { name: "Pig" }; t.setEntityName = (n) => { t.name = n; }; this.tiles.set(k, t); }
    return true;
  }
  getTileEntity(x, y, z) { this.call(4, x, y, z); return this.tiles.get(`${x},${y},${z}`); }
  spawnEntity(e) {
    this.call(5, Math.floor(e.x), Math.floor(e.y), Math.floor(e.z));
    this.entities.push([e.type, e.x, e.y, e.z, e.slots]);
    return true;
  }
  tileList() { return [...this.tiles].map(([k, t]) => (t.slots ? [k, "chest", t.slots, t.writes] : [k, "spawner", t.name])); }
}
