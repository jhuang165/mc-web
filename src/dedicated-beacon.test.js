// Batch 44 (beaconring): TileEntityBeacon.updateEntity in the dedicated world. Every 80 world ticks the pyramid check, the sky check, then the
// effects for the players inside the box (range level * 10 + 10, up to the top of the world). Native evidence is public/research/beacon-reference.json
// (BeaconProbe.java runs the unchanged aoq.x with player doubles and aoq.h for the tick); the dedicated tick reuses the singleplayer code
// (pyramid-live.js tickBeacons) and each grant also goes out as an S1D message (`effectsOut`), replayed here against the same records.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { BEACON } from "./pyramid.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { DedicatedClient } from "./multiplayer/client.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/beacon-reference.json", import.meta.url), "utf8"));
const by = (c) => ref.records.filter((r) => r.case === c);
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const BY = 20; // beacon height; the floor is at y 9

// A flat finite world with a pyramid of `levels` layers (original iron, internal 26) under a beacon at (64, 20, 64).
function fixture(levels, { roof = false } = {}) {
  const world = new World("dedicated-test");
  for (let x = 2; x <= 125; x++) for (let z = 2; z <= 125; z++) { world.put(x, 9, z, 3, 0, false); for (let y = 10; y <= 40; y++) world.put(x, y, z, 0, 0, false); }
  for (let l = 1; l <= levels; l++) for (let x = 64 - l; x <= 64 + l; x++) for (let z = 64 - l; z <= 64 + l; z++) world.put(x, BY - l, z, 26, 0, false);
  world.put(64, BY, 64, BEACON, 0, false);
  if (roof) world.put(64, BY + 5, 64, 3, 0, false);
  world.spawn = () => ({ x: 20.5, y: 10, z: 20.5 });
  const sim = new DedicatedSimulation({}, { world });
  const tile = sim.tileEntities.beacons.ensure(64, BY, 64);
  return { sim, tile };
}
function join(sim, name, n, x, y, z) {
  const p = sim.addPlayer(name.toLowerCase(), name, key(n));
  p.position.copy({ x, y, z }); p.previous.copy(p.position);
  return p;
}
// Runs ticks until the world time passes 80 (the tick that makes time 80 runs the beacon) and returns the first message's effects.
const toEighty = (sim) => { sim.time = 79; sim.tick(); };
const triple = (e) => [e.id, e.duration, e.amplifier, e.ambient];

test("a beacon grants its primary effect only on ticks where the world time is a multiple of 80, to players in range", () => {
  const { sim, tile } = fixture(2);
  tile.primary = 1;
  const near = join(sim, "Near", 1, 74.5, BY, 64.5), far = join(sim, "Far", 2, 105.5, BY, 64.5);
  sim.time = 10; for (let i = 0; i < 20; i++) sim.tick();
  assert.equal(near.effectsOut?.length ?? 0, 0, "times 11..30: nothing");
  toEighty(sim);
  assert.deepEqual(near.effectsOut.map(triple), [[1, 180, 0, true]], "Speed, 180 ticks, ambient");
  assert.equal(far.effectsOut, undefined, "40 blocks away is outside a level 2 beacon's 30 blocks");
  assert.equal(tile.levels, 2);
  assert.equal(near.survival.effects.get(1).duration, 180, "the player's own effect list holds it");
  near.effectsOut = null;
  sim.tick();
  assert.equal(near.effectsOut, null, "time 81: nothing more");
});

test("the dedicated grants equal the executed range records (levels 1 to 4, horizontal distances of 10 blocks and more)", () => {
  let checked = 0;
  for (const r of by("range")) {
    if (r.dx < 10) continue; // the player would stand inside the pyramid
    const { sim, tile } = fixture(r.levels);
    tile.primary = 1;
    const p = join(sim, "Alice", 1, 64.5 + r.dx, BY, 64.5);
    toEighty(sim);
    assert.deepEqual((p.effectsOut ?? []).map(triple), r.got, JSON.stringify(r));
    checked++;
  }
  assert.ok(checked >= 40, `${checked} records`);
});

test("level 4 with equal primary and secondary gives one stronger effect; different ones give two (executed aoq.x records)", () => {
  for (const r of by("effects").filter((e) => e.levels === 4 && [[1, 1], [11, 11], [1, 10], [5, 10], [10, 10], [3, 3]].some(([a, b]) => a === e.primary && b === e.secondary))) {
    const { sim, tile } = fixture(4);
    Object.assign(tile, { primary: r.primary, secondary: r.secondary });
    const p = join(sim, "Alice", 1, 74.5, BY, 64.5);
    toEighty(sim);
    assert.deepEqual((p.effectsOut ?? []).map(triple), r.applied, JSON.stringify(r));
  }
});

test("no sky above, no primary or a broken pyramid: nothing is granted, and the level is rechecked at the 80-tick mark", () => {
  const roofed = fixture(2, { roof: true });
  roofed.tile.primary = 1;
  const a = join(roofed.sim, "Alice", 1, 74.5, BY, 64.5);
  toEighty(roofed.sim);
  assert.equal(a.effectsOut, undefined, "a block over the beacon (canBlockSeeTheSky false): level 0");
  assert.equal(roofed.tile.levels, 0);
  const plain = fixture(2);
  const b = join(plain.sim, "Bob", 2, 74.5, BY, 64.5);
  toEighty(plain.sim);
  assert.equal(b.effectsOut, undefined, "no primary chosen");
  plain.tile.primary = 1;
  plain.sim.world.put(63, BY - 1, 64, 0, 0, false); // a hole in layer 1
  plain.sim.time = 159; plain.sim.tick();
  assert.equal(b.effectsOut, undefined, "level 0 after the hole");
  assert.equal(plain.tile.levels, 0);
});

test("glass over a beacon does not block the sky (light opacity, not solidity)", () => {
  const { sim, tile } = fixture(1);
  sim.world.put(64, BY + 5, 64, 20, 0, false); // glass
  tile.primary = 1;
  const p = join(sim, "Alice", 1, 74.5, BY, 64.5);
  toEighty(sim);
  assert.equal(p.effectsOut?.length, 1);
});

test("the client receives the grant as an effect message", () => {
  const got = [], client = new DedicatedClient({ onEffect: (m) => got.push(m) });
  client.apply({ type: "effect", id: 1, amplifier: 0, duration: 180, ambient: true });
  assert.deepEqual(got, [{ type: "effect", id: 1, amplifier: 0, duration: 180, ambient: true }]);
});
