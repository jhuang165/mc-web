// Batch 91 console91: /netstat on the dedicated server counts the owner string and name tag in S0F / S1C, the later watcher keys a native mob changes, and the tracker's own
// position packets of vehicles and objects (not S18 for all). Evidence: tools/probes/Console91Probe.java -> public/research/console91-reference.json.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PLAY_FRAME, writePackets, MOB_WATCHER, stringSize } from "./multiplayer/net-packet-ids.js";
import { watchState, watchDiff, stringExtra, nativeStringBytes } from "./multiplayer/net-watch-bytes.js";
import { setVehicleInfo } from "./multiplayer/server-cart-track.js";
import { hashSide } from "./multiplayer/net-native-bytes.js";

const ref = JSON.parse(await readFile(new URL("../public/research/console91-reference.json", import.meta.url)));
const C = PLAY_FRAME.clientbound;
const spawn = (id) => ref.spawns.find((r) => r.id === id).s0f;
const setter = (id, index) => ref.strings.find((r) => r.id === id && r.index === index).s0f;
const watch = (mob) => ({ memory: new Map(), mob: () => mob });

test("executed: PacketBuffer strings are a VarInt length and the UTF-8 bytes", () => {
  assert.equal(ref.pbstrings.length, 5);
  for (const r of ref.pbstrings) { assert.equal(r.bytes, stringSize("x".repeat(0)) - 1 + (r.utf8 < 128 ? 1 : 2) + r.utf8); }
  assert.equal(nativeStringBytes("ééé"), 7); assert.equal(nativeStringBytes("€"), 4); assert.equal(nativeStringBytes("x".repeat(200)), 202);
});

test("an owner string and a name tag lengthen the S0F and the first S1C as the executed S0F", () => {
  const owned = (type, extra = {}) => ({ type, health: 10, owner: "player", ...extra });
  for (const [type, id, index, mob] of [["wolf", "Wolf", 17, owned("wolf")], ["ocelot", "Ozelot", 17, owned("ocelot")], ["horse", "EntityHorse", 21, owned("horse", { horse: { type: 0, variant: 0, armor: 0 } })]]) {
    const r = writePackets({ type: "mobs", packets: [{ type: "spawn", mob: type, i: 1 }, { type: "meta", i: 1 }] }, { watch: watch(mob) });
    assert.equal(r[0][1], setter(id, index), id);
    assert.equal(r[1][1], setter(id, index) - 24 + 5, `${id} first S1C`);
  }
  const named = { type: "pig", health: 10, customName: "0123456789abcdef0123456789abcdef0123" };
  assert.equal(writePackets({ type: "mobs", packets: [{ type: "spawn", mob: "pig", i: 2 }] }, { watch: watch(named) })[0][1], setter("Pig", 10), "36 character name tag");
  assert.equal(writePackets({ type: "mobs", packets: [{ type: "spawn", mob: "pig", i: 2 }] }, { watch: watch({ type: "pig", health: 10 }) })[0][1], spawn("Pig"), "no name: the class size");
  assert.equal(stringExtra(watchState({ type: "pig", health: 4, customName: "x".repeat(200) })), 201, "a 200 character name needs a two byte VarInt");
});

test("later S1C: the changed native keys are counted once per change (health, age), nothing when unchanged", () => {
  const pig = { type: "pig", health: 10, growingAge: -100 }, w = watch(pig);
  const msg = () => writePackets({ type: "mobs", packets: [{ type: "move", i: 3 }] }, { watch: w });
  assert.deepEqual(writePackets({ type: "mobs", packets: [{ type: "spawn", mob: "pig", i: 3 }] }, { watch: w })[0], [15, spawn("Pig")]);
  assert.deepEqual(msg(), [[21, 8]], "nothing changed since the spawn");
  pig.growingAge = -99; // EntityAgeable.e: watcher 12 changes every tick of a baby
  const age = ref.changes.find((r) => r.id === "Pig").changes.find((c) => c.index === 12);
  assert.deepEqual(msg(), [[21, 8], [28, age.s1c]]);
  assert.deepEqual(msg(), [[21, 8]], "the same age again is not changed");
  pig.health = 7; pig.growingAge = -98; // two entries in one S1C: 5 + 5 + the id, entity id and end byte
  assert.deepEqual(msg(), [[21, 8], [28, 6 + 10]]);
  assert.equal(ref.changes.every((r) => r.changes.every((c) => c.changed && !c.changedAgain && c.s1c === 11)), true);
  const wolf = { type: "wolf", health: 8, owner: "", collar: 14 };
  const a = watchState(wolf); wolf.owner = "player"; wolf.sitting = true;
  assert.equal(watchDiff(a, watchState(wolf)), 2 + 38 + 0, "wolf flags byte and the 36 character owner entry");
  assert.deepEqual(watchState({ type: "wither", health: 100 }).filter((r) => r[0] === 6), [], "wither health already travels in the port's meta packet");
});

test("object rows count each tracker packet under its own native id", () => {
  const rows = [{ i: 1, k: "item", p: [{ type: "spawn", data: 1 }, { type: "meta", list: [[0, 0, 0], [1, 1, 300], [5, 10, { id: 1, count: 1, damage: 0 }]] }, { type: "velocity" }, { type: "move" }, { type: "moveLook" }, { type: "look" }, { type: "teleport" }] },
    { i: 2, k: "orb", p: [{ type: "spawn", orb: true, data: 0 }] }, { i: 3, k: "falling", p: [{ type: "destroy" }, { type: "spawn", data: 12 }] }, { i: 4, k: "item", p: [{ type: "destroy" }] }];
  const tick = writePackets({ type: "tick", tick: 1, itrack: rows }, { tick: 1 });
  assert.deepEqual(tick, [[14, C[14] + 6], [28, 6 + 2 + 3 + (1 + 7)], [18, 11], [21, 8], [23, 10], [22, 7], [24, 19], [17, 16], [14, C[14] + 6], [19, 2 + 4 * 2]]);
  const disp = writePackets({ type: "dispEnts", ents: [], trk: [{ i: 5, k: "snowball", p: [{ type: "spawn", data: 0 }, { type: "moveLook" }] }] });
  assert.deepEqual(disp, [[14, C[14]], [23, 10]]);
});

test("cart and boat rows: the entry's own packets, a join's S0E and S12, a watched-field change", () => {
  const row = (info) => { const r = { v: "c1" }; if (info) setVehicleInfo(r, info); return r; };
  const rec = (...rows) => writePackets({ type: "vehicles", set: rows });
  assert.deepEqual(rec(row()), [[24, 19]], "an unknown row keeps counting S18");
  assert.deepEqual(rec(row({ kinds: ["move"], join: false, data: 0 })), [[21, 8]]);
  assert.deepEqual(rec(row({ kinds: ["moveLook", "velocity"], join: false, data: 0 })), [[23, 10], [18, 11]]);
  assert.deepEqual(rec(row({ kinds: ["teleport"], join: false, data: 0 })), [[24, 19]]);
  assert.deepEqual(rec(row({ kinds: [], join: true, data: 1, velocity: true })), [[14, C[14] + 6], [18, 11]], "a chest cart's S0E carries its motion");
  assert.deepEqual(rec(row({ kinds: [], join: false, data: 0 })), [[28, 11]], "only a watched field changed");
});

test("the light hash is a stable key for equal light", () => {
  const light = { size: 16, height: 16, sky: new Uint8Array(16 * 16 * 16), block: new Uint8Array(16 * 16 * 16) };
  const col = [{ x: 0, z: 0, runs: [1, 4096] }];
  const a = hashSide(col, { light }); assert.equal(hashSide(col, { light }), a);
  light.block[5] = 3; assert.notEqual(hashSide(col, { light }), a);
});
