// Batch 97 console97: /netstat counts the armour S04s of a spawning player (after the held one), one S1D per active effect at the spawn, and the S1C / S20 of a changed player watcher
// (EntityTrackerEntry.b(): the changed entries, the dirty attributes) for every viewer and for the player himself. Executed: public/research/console97-reference.json
// (tools/probes/Console97Probe.java). A whole S1C is 37 whatever the entity id: S1C writes the id as an int (hw.b: writeInt), not a VarInt.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLAY_FRAME, writePackets } from "./multiplayer/net-packet-ids.js";
import { ServerPlayerTracker } from "./multiplayer/server-player-tracker.js";
import { Effects } from "./status-effects.js";

const C = PLAY_FRAME.clientbound;
const ref = JSON.parse(readFileSync(new URL("../public/research/console97-reference.json", import.meta.url), "utf8"));
const s1c = (i) => ref.s1c.find((r) => r.index === i).bytes;
const eb = (i) => ref.entries.find((e) => e.index === i).bytes, many = (...ix) => [28, 6 + ix.reduce((n, i) => n + eb(i), 0)];
const s20 = (name, mods) => ref.s20.find((r) => r.attribute === name && r.modifiers === mods).bytes;
const tick = (players, ctx) => writePackets({ type: "tick", tick: 1, players }, ctx);

test("executed sizes: the watcher entries sum to the whole S1C, which holds an int id", () => {
  assert.equal(6 + ref.entries.reduce((n, e) => n + e.bytes, 0), ref.whole);
  assert.equal(ref.whole, 37);
  const idHigh = tick([{ id: 70000, name: "A", pk: [] }], { self: 1, peers: new Set() }).find(([i]) => i === 28);
  assert.deepEqual(idHigh, [28, 37], "no VarInt growth for a large entity id");
});

test("a spawn counts the armour S04s after the held one, one S1D per effect, and the modifiers in the S20", () => {
  const plain = { id: 306, count: 1, damage: 0 }, ench = { id: 307, count: 1, damage: 0, enchantments: [{ id: 0, lvl: 4 }] };
  const ids = tick([{ id: 2, name: "Steve", pk: [], held: { id: 267, count: 1, damage: 0 }, arm: [plain, ench], fxn: 2, am: 2 }], { self: 1, peers: new Set() });
  assert.deepEqual(ids.map(([i]) => i), [12, 28, 32, 4, 4, 4, 29, 29]);
  assert.equal(ids.find(([i]) => i === 32)[1], 69 + 50);
  const s04 = ids.filter(([i]) => i === 4).map(([, b]) => b);
  assert.equal(s04[1], ref.s04.find((r) => r.item.startsWith("plain")).bytes);
  assert.equal(s04[2], ref.s04.find((r) => r.item.startsWith("Protection")).bytes, "an enchanted piece carries its tag");
  assert.deepEqual(tick([{ id: 3, name: "A", pk: [], invisible: true }], { self: 1, peers: new Set() }).filter(([i]) => i === 29), [[29, ref.s1d]], "a caller without fxn keeps the invisibility S1D");
});

test("the player's own and the viewers' rows count the S1C / S20 of the entry", () => {
  const ctx = { self: 1, peers: new Set([2]) };
  const pw = [[28, 11], [32, 66]];
  assert.deepEqual(tick([{ id: 1, name: "me", pw }, { id: 2, name: "a", pk: ["look"], pw }, { id: 3, name: "b", far: true, pw }], ctx), [[22, C[22]], ...pw, ...pw]);
});

const world = () => {
  const players = new Map(), host = { players, ticks: 0, rules: { trackerLimit: 144 } };
  const mk = (id, x) => ({ id, name: `p${id}`, dimension: 0, position: { x, y: 64, z: 0 }, yaw: 0, pitch: 0, grounded: true, input: {}, motion: {}, survival: { health: 20, air: 300, effects: new Effects(), inventory: { armor: [null, null, null, null] } } });
  players.set(1, mk(1, 0)); players.set(2, mk(2, 10));
  const tr = new ServerPlayerTracker(host);
  const step = (t) => { host.ticks = t; const tracked = tr.update(0, {}); return tr.rowsFor(1, [{ id: 1, name: "p1" }, { id: 2, name: "p2" }], tracked.get(1), 0); };
  return { players, tr, step };
};
const pw = (rows, id) => rows.find((r) => r.id === id).pw ?? [];

test("the tracker rows carry the changed watcher entries and attributes on the tick of the change", () => {
  const { players, step } = world();
  for (let t = 0; t < 6; t++) assert.deepEqual(pw(step(t), 2), [], "a standing player sends nothing");
  const p2 = players.get(2);
  p2.input.sneak = true; // flag 0
  assert.deepEqual(pw(step(6), 2), [[28, s1c(0)]]);
  assert.deepEqual(pw(step(7), 2), []);
  p2.motion.sprinting = true; // flag 0 and a movement speed modifier
  assert.deepEqual(pw(step(8), 2), [many(0), [32, s20("generic.movementSpeed", 1)]]);
  p2.survival.health = 14; p2.survival.air = 290; p2.survival.arrowCount = 2;
  assert.deepEqual(pw(step(9), 2), [many(1, 6, 9)]);
  p2.survival.effects.add({ id: 1, duration: 600, amplifier: 0 }); // Speed: colour (7) and ambient flag unchanged (0), a second modifier
  const rows = step(10), got = pw(rows, 2);
  assert.deepEqual(got, [[28, s1c(7)], [32, s20("generic.movementSpeed", 2)]]);
  p2.survival.effects.add({ id: 21, duration: 600, amplifier: 1 }); // Health Boost: colour, and one maxHealth modifier
  assert.deepEqual(pw(step(11), 2), [many(7), [32, 9 + 28 + 25]]);
  assert.deepEqual(pw(step(12), 2), []);
  p2.motion.sprinting = false; p2.survival.effects.add({ id: 1, duration: 600, amplifier: 1 }); // sprint off (flag), Speed II: one modifier replaces the other, and with Health Boost active the amplifier weights the average colour
  assert.deepEqual(pw(step(13), 2), [many(0, 7), [32, s20("generic.movementSpeed", 1)]]);
});

test("the player's own row gets his S1C too, and a spawn row carries the armour and effects", () => {
  const { players, step } = world();
  step(0);
  const p1 = players.get(1);
  p1.survival.health = 10;
  assert.deepEqual(pw(step(1), 1), [[28, s1c(6)]]);
  const p2 = players.get(2);
  p2.survival.inventory.armor = [null, null, { id: 307, count: 1, damage: 0 }, { id: 306, count: 1, damage: 0 }];
  p2.survival.effects.add({ id: 1, duration: 600, amplifier: 0 });
  const row = step(2).find((r) => r.id === 2);
  assert.equal(row.arm.length, 2);
  assert.equal(row.fxn, 1);
  assert.equal(row.am, 1);
});
