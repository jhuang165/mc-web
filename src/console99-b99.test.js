// Batch 99 console99: the packets of a tracked mob on /netstat. A zombie, horse, villager and wolf entering a viewer's tracked set count the S0F, the whole-watcher S1C and the
// whole watched-attribute S20 of the class, the first gated pass's dirty S20 and later watcher / attribute changes on their own tick, with the sizes the real classes write.
// Executed: public/research/console99-reference.json (tools/probes/Console99Probe.java, tools/verify-console99.mjs). Bytecode-read (my.b(mw)): S0F, S1C whole (when the watcher is not
// blank), S20 tq.c(), S12 (not after an S0F), S1B, S1B leash, S04 slots 0-4, S1D per effect; my.b() sends S1C (changed entries only) and S20 (dirty set) inside the gated branch.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { writePackets, watchSweep, PLAY_FRAME } from "./multiplayer/net-packet-ids.js";
import { watchState } from "./multiplayer/net-watch-bytes.js";
import { addMobEffect } from "./mob-effects.js";

const C = PLAY_FRAME.clientbound;
const ref = JSON.parse(readFileSync(new URL("../public/research/console99-reference.json", import.meta.url), "utf8"));
const PORT = { Zombie: "zombie", EntityHorse: "horse", Villager: "villager", Wolf: "wolf" };
const wire = (rows) => JSON.parse(JSON.stringify(rows ?? []));
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function flat() {
  const w = new World("console99");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) w.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}
const take = (pl) => { const o = wire(pl.mobPackets); pl.mobPackets = null; return o; };
const wid = (m) => Number(String(m.id).replace("mob-", ""));
function setup(type) {
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: "creative", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  const p = s.addPlayer("p", "px", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input("p", input());
  const m = s.mobs.mobs.create(type, 66.5, 10, 70.5); s.mobs.mobs.entities.push(m);
  return { s, p, m };
}
const mine = (list, m) => list.filter((x) => x.i === wid(m));
const bytes = (rows, kind) => writePackets({ type: "mobs", packets: rows }).filter(([id]) => id === kind).map(([, b]) => b);

for (const r of ref.mobs) {
  test(`${r.id}: entering the tracked set counts S0F, the whole S1C and S20 in native order and size; the first gated pass sends the constructor's dirty S20`, { timeout: 180000 }, () => {
    const { s, p, m } = setup(PORT[r.id]);
    let first = null; const later = [];
    for (let k = 0; k < 12; k++) { s.tick(); const b = mine(take(p), m); if (!first && b.some((x) => x.type === "spawn")) first = b; else if (first) later.push(...b); }
    assert.ok(first, "the mob entered the tracked set");
    const types = first.map((x) => x.type);
    assert.deepEqual(types.slice(0, 3), ["spawn", "meta", "attributes"], "S0F, S1C, S20 (my.b(mw) order)");
    const recs = writePackets({ type: "mobs", packets: first });
    assert.equal(recs[0][1], r.s0f, "S0F");
    assert.equal(recs[1][1], r.whole, "whole-watcher S1C");
    assert.deepEqual(first[2].list.map((x) => x.name).sort(), r.watched, "the watched set tq.c()");
    assert.equal(recs[2][1], r.s20whole, "S20 of the watched set");
    const pass = [...first.slice(3), ...later].filter((x) => x.type === "attributes");
    assert.equal(pass.length, 1, "the first gated pass sends the dirty set once");
    // a horse the world spawns has had onSpawnWithEgg roll its three stats (the `egg` record, minus the Speed modifier the probe had added by then); the others keep the constructor's set
    const dirty = r.egg.bytes > 0 ? { names: r.egg.names, bytes: r.egg.bytes - 25 } : r.first;
    assert.deepEqual(pass[0].list.map((x) => x.name).sort(), dirty.names);
    assert.equal(bytes(pass, 32)[0], dirty.bytes, "S20 of the dirty set");
  });

  test(`${r.id}: a Speed effect is one S20 of movementSpeed with its modifier, and a changed health or age is an S1C of that entry only`, { timeout: 180000 }, () => {
    const { s, p, m } = setup(PORT[r.id]);
    for (let k = 0; k < 12; k++) { s.tick(); take(p); }
    addMobEffect(m, 1, 600, 0);
    const got = [];
    for (let k = 0; k < 4; k++) { s.tick(); got.push(...mine(take(p), m)); }
    const s20 = got.filter((x) => x.type === "attributes");
    assert.equal(s20.length, 1);
    assert.equal(bytes(s20, 32)[0], r.speed.bytes);
    assert.deepEqual(s20[0].list.map((x) => x.name), r.speed.names);
    // watcher sweep: health 6 (float) is 11 bytes; a wolf also keeps health in 18 (EntityWolf), so only the other classes are compared with the executed single entry
    const w = { memory: new Map([[1, watchState(m)]]), mob: () => m };
    m.health = Math.max(1, m.health - 3);
    const sweep = watchSweep(w);
    assert.equal(sweep.length, 1);
    assert.equal(sweep[0][1], r.id === "Wolf" ? 6 + 5 + 5 : r.changedHealth, "S1C of the changed health entries");
    assert.deepEqual(watchSweep(w), [], "nothing changed since");
    if (PORT[r.id] !== "wolf") {
      m.growingAge = -24000;
      const age = watchSweep(w);
      assert.equal(age[0][1], r.changedAge, "S1C of the age entry: an int for the ageable classes, a byte for the zombie");
    }
  });
}

test("executed sizes are the frame table the counter uses", () => {
  for (const r of ref.mobs) { assert.equal(r.calm, false); assert.equal(r.unchanged, false, "an unchanged write marks no entry"); assert.equal(r.again.bytes, -1, "a cleared dirty set sends nothing"); assert.equal(r.s04, C[4] - 2 + 7); }
});
