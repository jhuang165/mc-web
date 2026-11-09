// Replays public/research/rim-light-reference.json (tools/probes/RimLightProbe.java, batch 31) through src/native-light.js: terrain over chunks
// -7..7 loaded chunk by chunk with ChunkProviderServer.populate and a server tick after each load. Test and research helper, not game code.
import { NativeLight, SKY, BLOCK } from "./native-light.js";
import { lightOpacity, lightEmission } from "./lighting.js";
import { fromOriginal } from "./block-registry.js";
import { createHash } from "node:crypto";

export const R = 7, N = 2 * R + 1, W = N * 16, H = 256, OFF = R * 16;
const OP = new Uint8Array(256), EM = new Uint8Array(256);
for (let b = 0; b < 256; b++) { OP[b] = Math.min(255, lightOpacity(b)); EM[b] = lightEmission(b); }
const idCache = new Map();
const internal = (mc, meta) => { const k = mc * 16 + meta; if (!idCache.has(k)) idCache.set(k, mc ? fromOriginal(mc, meta).id : 0); return idCache.get(k); };
const sha = (b) => createHash("sha256").update(b).digest("hex");

// Everything the probe holds, in the NativeLight square (local = world + OFF). `onSnap(label, light, ids)` is called at each snapshot op.
export function replayRim(scenario, onSnap = null, terrains = null) {
  const s = terrains ? { ...scenario, ...terrains[scenario.terrain] } : scenario;
  const ids = new Uint8Array(W * W * H), mc = new Uint16Array(W * W * H), at = (x, z) => ((x + OFF) * W + z + OFF) * H;
  for (const [x0, y0, z0, x1, y1, z1, id, meta] of s.fills) {
    const b = internal(id, meta);
    for (let x = Math.max(x0, -OFF); x <= Math.min(x1, W - OFF - 1); x++) for (let z = Math.max(z0, -OFF); z <= Math.min(z1, W - OFF - 1); z++)
      for (let y = y0; y <= y1; y++) { ids[at(x, z) + y] = b; mc[at(x, z) + y] = id * 16 + meta; }
  }
  const decorations = new Map();
  for (const d of s.decorations) {
    const k = `${(d[0] - 8) >> 4},${(d[2] - 8) >> 4}`;
    if (!decorations.has(k)) decorations.set(k, []);
    decorations.get(k).push(d);
  }
  const nether = /nether/.test(s.case);
  const light = new NativeLight({ width: W, height: H, hasNoSky: nether, isRemote: true, blockAt: (x, y, z) => ids[(x * W + z) * H + y], opacity: (b) => OP[b], emission: (x, y, z, b) => EM[b] });
  const order = [], snaps = [];
  const set = (x, y, z, id, meta) => {
    if (light.chunkAt(x + OFF, z + OFF) < 0) { light.updateAll(x + OFF, y, z + OFF); return; } // EmptyChunk drops the block
    const i = at(x, z) + y, oldOp = OP[ids[i]], same = mc[i] === id * 16 + meta;
    ids[i] = internal(id, meta); mc[i] = id * 16 + meta;
    light.setBlock(x + OFF, y, z + OFF, oldOp, ids[i], same);
  };
  const decorate = (cx, cz) => { for (const d of decorations.get(`${cx - R},${cz - R}`) ?? []) set(...d); };
  for (const op of s.ops) {
    const [name, a, b] = op;
    if (name === "gen" || name === "load") {
      order.push(light.generateChunk(a + R, b + R));
      if (nether) light.resetRelightChecks(order[order.length - 1]); // ChunkProviderHell.provideChunk
      if (name === "load") light.populateChunk(a + R, b + R, decorate);
    } else if (name === "tick") {
      light.isRemote = false;
      for (const c of order) { light.enqueueRelightChecks(c); light.tickChunk(c); }
      light.isRemote = true;
    } else if (name === "snap") { const sn = { label: a, chunks: chunkDigests(light) }; snaps.push(sn); onSnap?.(a, light, ids); }
    else throw new Error(name);
  }
  return { light, ids, snaps };
}

export function chunkDigests(light) {
  const out = [];
  for (let cx = -R; cx <= R; cx++) for (let cz = -R; cz <= R; cz++) {
    const sky = Buffer.alloc(65536), blk = Buffer.alloc(65536), hm = Buffer.alloc(512);
    let k = 0, h = 0;
    for (let x = cx * 16 + OFF; x < cx * 16 + 16 + OFF; x++) for (let z = cz * 16 + OFF; z < cz * 16 + 16 + OFF; z++) {
      for (let y = 0; y < H; y++, k++) { sky[k] = light.saved(SKY, x, y, z); blk[k] = light.saved(BLOCK, x, y, z); }
      const hv = light.heightValue(x, z);
      hm[h++] = hv >> 8; hm[h++] = hv & 255;
    }
    out.push([cx, cz, sha(sky).slice(0, 16), sha(blk).slice(0, 16), sha(hm).slice(0, 8)]);
  }
  return out;
}
