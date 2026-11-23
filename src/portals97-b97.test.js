// Batch 97 portals97: mobs through travelToDimension (Executed tools/probes/Portals97Probe.java, public/research/portals97-reference.json).
import test from "node:test";
import assert from "node:assert/strict";
import reference from "../public/research/portals97-reference.json" with { type: "json" };
import { decodeNbt } from "./nbt.js";
import { javaMobFromNbt } from "./java-mobs.js";
import { EntityWorld } from "./entities.js";
import { TRANSIENT_MOB } from "./mob-transient.js";
import { GAME_IDS } from "./dimensions.js";
import { DimensionLive, viewRecord } from "./dimension-live.js";
import { endArrival } from "./entity-portal.js";

const air = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), getMeta: () => 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const tagOf = (h) => decodeNbt(Uint8Array.from(h.match(/../g).map((b) => parseInt(b, 16)))).tag.value;

test("portals97: native copyDataFrom keeps every saved key (25 executed mobs), and the End places pitch 0 first", () => {
  assert.equal(reference.mobs.length, 25);
  for (const m of reference.mobs) assert.equal(m.same, true, m.name);
  for (const p of reference.pitch) assert.equal(p.pitchAfter, endArrival(p.from, p.to) ? 0 : p.pitchBefore, `${p.from}>${p.to}`);
  assert.equal(reference.pitch.filter((p) => endArrival(p.from, p.to)).length, 2);
});

test("portals97: a native mob record survives the port's portal round trip unchanged (leash, name, effects, gear, trades, horse, owner)", () => {
  const skip = new Set(["x", "y", "z", "id", "uuid", "vx", "vy", "vz", "px", "py", "pz", "portalCooldown"]);
  let n = 0;
  for (const r of reference.mobs.filter((m) => m.from === 0 && m.to === -1)) {
    const rec = javaMobFromNbt(tagOf(r.srcHex), { shiftX: 0, shiftZ: 0 });
    assert.ok(rec, r.name);
    const w = new EntityWorld(air, [], () => 0.5), a = w.restore({ ...rec, x: 64.5, y: 0, z: 64.5 }, { summoned: true });
    w.entities.push(a);
    const ser = structuredClone(w.serializeOne(a));
    for (const k of TRANSIENT_MOB) delete ser[k];
    const b = new EntityWorld(air, [], () => 0.5).restore({ ...ser, x: 64.5, y: 0, z: 64.5 }, { resetTransient: true });
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!skip.has(k)) assert.equal(JSON.stringify(b[k]), JSON.stringify(a[k]), `${r.name}.${k}`);
    n++;
  }
  assert.equal(n, 18);
});

const makeRoot = () => ({ id: "w97", seed: "42", biome: "javaStreamed", generationVersion: 22, chunked: true, name: "W", worldSpawn: [3, 64, -5], position: { x: 1, y: 70, z: 2, yaw: 0, pitch: 0 }, edits: [], entities: [], drops: [], xpOrbs: [], player: { health: 20, chests: {} } });
const endPortalWorld = (dim) => ({ dimension: dim, get: (x, y, z) => (x === 64 && z === 64 && y === 5 ? GAME_IDS.endPortal : y < 0 ? 1 : 0) });
async function trip(dim, nbtDimension) {
  const root = makeRoot(), view = dim ? viewRecord(root, dim) : root;
  const live = new DimensionLive({ active: () => view, worlds: () => [root], dirty() {}, save: async () => {}, sound() {}, player: () => ({ x: 0, y: 5, z: 0, yaw: 0 }), openWorld: async () => {} });
  live.readEdits = async () => [];
  const mobs = new EntityWorld({ ...air, dimension: dim }, [{ id: "mob-1", type: "pig", x: 64.5, y: 5, z: 64.5, health: 10, nbtDimension, rotationPitch: 30 }], () => 0.5);
  mobs.isActive = () => true;
  live.tickEntities(endPortalWorld(dim), { mobs });
  await live.settle();
  return Object.values(root.portalArrivals ?? {}).flatMap((i) => i.entities)[0];
}

test("portals97: a mob entering the End arrives with pitch 0; the End exit copy keeps its pitch", async () => {
  const into = await trip(0, 0);
  assert.ok(into);
  assert.equal(into.rotationPitch, undefined);
  const exit = await trip(1, 1);
  assert.ok(exit);
  assert.equal(exit.rotationPitch, 30);
});
