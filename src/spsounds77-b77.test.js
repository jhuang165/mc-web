// Batch 77 spsounds77: block activation, bow, eye of ender, eating, impact and shear sounds replayed against
// public/research/sound-sweep3-reference.json (tools/probes/SpSounds77Probe.java on the unchanged 1.7.10 classes; tools/verify-spsounds77.mjs).
// Records are Executed; the port side here is Port-read by running the port functions. Dispenser sounds belong to spdispense77.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { doorSound } from "./doors-panes.js";
import { notePitch, noteSound } from "./note-blocks.js";
import { releasePower, shotPitch } from "./bow.js";
import { tickLid } from "./chest.js";
import { useEyeOfEnder } from "./eye-of-ender-live.js";
import { JavaRandom } from "./java-random.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/sound-sweep3-reference.json", import.meta.url), "utf8"));
const rec = (kind, f = () => true) => ref.records.filter((r) => r.kind === kind && f(r));
const f = Math.fround;
const parse = (text) => {
  const m = /^(?:sound |ent )?(\S+) (\S+) (\S+)(?: @(\S+),(\S+),(\S+))?$/.exec(text);
  return { name: m[1], volume: f(Number(m[2])), pitch: f(Number(m[3])), pos: m[4] === undefined ? null : [Number(m[4]), Number(m[5]), Number(m[6])] };
};
const item = (name, f2 = () => true) => rec("item", (r) => r.name === name && f2(r));
const aux = (type, data = 0) => rec("aux", (r) => r.type === type && r.data === data)[0];

test("b77: doors, trapdoors and gates play only aux 1003 (door_open / door_close, volume 1, pitch 0.9 to 1.0); the iron door is silent", () => {
  for (const r of rec("activate", (a) => /^(door-wood|trapdoor|fencegate)/.test(a.name))) {
    assert.equal(r.sounds.length, 1, r.name);
    assert.match(r.sounds[0], /^aux 1003 8,64,8,0$|^aux 1003 8,65,8,0$/);
  }
  for (const r of rec("activate", (a) => a.name === "door-iron-closed")) assert.deepEqual(r.sounds, []);
  const a = aux(1003);
  assert.deepEqual(a.names, ["minecraft:random.door_close", "minecraft:random.door_open"]);
  assert.deepEqual(a.volumes, ["1.0"]);
  assert.ok(a.pitchMin >= 0.9 && a.pitchMax < 1);
  assert.deepEqual(doorSound(() => 0.25, () => 0.5), { event: "random.door_open", volume: 1, pitch: f(f(0.5 * 0.1) + 0.9) });
  assert.equal(doorSound(() => 0.75, () => 0).event, "random.door_close");
});

test("b77: aux 2003 (eye shatter) and 2004 make no sound; 2002 is game.potion.smash 1.0 / 0.9 to 1.0 at the cell centre", () => {
  assert.deepEqual(aux(2003).names, []);
  assert.deepEqual(aux(2004).names, []);
  for (const r of rec("aux", (a) => a.type === 2002)) {
    assert.deepEqual(r.names, ["minecraft:game.potion.smash"]);
    assert.ok(r.pitchMin >= 0.9 && r.pitchMax < 1);
    assert.match(r.first, /@8\.5,64\.5,8\.5$/);
  }
});

test("b77: levers, buttons and the comparator click (random.click 0.3, 0.6 / 0.5 lever, 0.6 button, 0.55 / 0.5 comparator); repeater and cake are silent; plates 0.5 at y + 0.1", () => {
  for (const r of rec("activate", (a) => a.name.startsWith("lever") && !a.remote)) {
    const s = parse(r.sounds[0]);
    assert.equal(s.name, "random.click"); assert.equal(s.volume, f(0.3));
    assert.equal(s.pitch, /m(5|1|7|6)$/.test(r.name) ? f(0.6) : f(0.5));
    assert.deepEqual(s.pos, [8.5, 64.5, 8.5]);
  }
  for (const r of rec("activate", (a) => a.name.startsWith("lever") && a.remote)) assert.deepEqual(r.sounds, []);
  for (const r of rec("activate", (a) => /^button-\d+-m1$/.test(a.name))) assert.equal(parse(r.sounds[0]).pitch, f(0.6));
  for (const r of rec("activate", (a) => /^button-\d+-m9$/.test(a.name))) assert.deepEqual(r.sounds, []);
  for (const r of rec("activate", (a) => a.name.startsWith("comparator"))) assert.equal(parse(r.sounds[0]).pitch, r.name.endsWith("compare") ? f(0.55) : f(0.5));
  for (const r of rec("activate", (a) => a.name.startsWith("repeater") || a.name === "cake")) assert.deepEqual(r.sounds, []);
  for (const r of rec("plate", (p) => !p.remote)) assert.deepEqual(parse(r.sounds[0]), { name: "random.click", volume: f(0.3), pitch: f(0.5), pos: [8.5, 64.1, 8.5] });
});

test("b77: chests and ender chests: chestopen / chestclosed 0.5, 0.9 to 1.0, at the lid centre (halfway to the double neighbour)", () => {
  for (const r of rec("chest")) {
    const [open, close] = r.ticks.map((t) => parse(t.sounds[0]));
    assert.equal(open.name, "random.chestopen"); assert.equal(close.name, "random.chestclosed");
    assert.equal(open.volume, f(0.5));
    assert.deepEqual(open.pos, [8.5, 64.5, r.doubleNeighbour ? 9 : 8.5]);
  }
  const chest = { lid: 0, prevLid: 0, users: 1 };
  assert.equal(tickLid(chest, true), "random.chestopen");
  chest.users = 0; chest.lid = f(0.5);
  assert.equal(tickLid(chest, true), "random.chestclosed");
});

test("b77: note block pitch 2^((note - 12) / 12) with the instrument's sound at volume 3.0", () => {
  for (const r of rec("note")) {
    const s = parse(r.sounds[0]);
    assert.equal(s.name, noteSound(r.instrument));
    assert.equal(s.volume, 3);
    assert.equal(s.pitch, notePitch(r.pitch));
  }
  const nb = rec("activate", (a) => a.name === "note-block" && !a.remote)[0];
  assert.equal(parse(nb.sounds[0]).name, "note.bd");
});

test("b77: bow release: nothing under power 0.1 (1 tick), otherwise random.bow 1.0 with pitch 1 / (r * 0.4 + 1.2) + power * 0.5; also played on the client world", () => {
  for (const r of item("bow-release", (x) => !x.remote)) {
    const power = releasePower(r.ticks);
    if (r.ticks === 1) { assert.equal(power, null); assert.deepEqual(r.sounds, []); continue; }
    if (r.arrows === 0 && !r.creative) { assert.deepEqual(r.sounds, []); continue; }
    const s = parse(r.sounds[0]);
    assert.equal(s.name, "random.bow"); assert.equal(s.volume, 1);
    const lo = shotPitch({ nextFloat: () => 1 }, power), hi = shotPitch({ nextFloat: () => 0 }, power);
    assert.ok(s.pitch >= lo - 1e-6 && s.pitch <= hi + 1e-6, `${r.ticks} ${s.pitch} not in ${lo}..${hi}`);
  }
  for (const r of item("bow-release", (x) => x.remote && x.ticks === 20 && (x.arrows || x.creative))) assert.equal(parse(r.sounds[0]).name, "random.bow");
});

test("b77: lily pad use is silent in every case; shears on a sheep play mob.sheep.shear 1.0 / 1.0 on both worlds, only when it sheds", () => {
  for (const r of item("lily-pad-water-source").concat(item("lily-pad-stone"), item("lily-pad-lava"), item("lily-pad-water-flowing"), item("lily-pad-water-with-pad"))) assert.deepEqual(r.sounds, []);
  for (const r of item("sheep-interact-shears-adult")) assert.deepEqual(parse(r.sounds[0]), { name: "mob.sheep.shear", volume: 1, pitch: 1, pos: null });
  for (const n of ["sheared", "child"]) for (const r of item(`sheep-interact-shears-${n}`)) assert.deepEqual(r.sounds, []);
});

test("b77: eye of ender launch: random.bow 0.5 / 0.4 / (r * 0.4 + 0.8) at the player, then aux 1002 (random.bow 1.0 / 1.2 at the block corner); no stronghold is silent", () => {
  for (const r of item("eye-of-ender-throw", (x) => !x.remote)) {
    assert.equal(r.sounds.length, r.stronghold ? 2 : 0);
    if (!r.stronghold) continue;
    assert.equal(parse(r.sounds[0]).volume, f(0.5));
    assert.equal(r.sounds[1], "aux 1002 8,64,8,0");
  }
  const a = aux(1002);
  assert.deepEqual([a.names, a.volumes, a.pitchMin, a.pitchMax], [["minecraft:random.bow"], ["1.0"], 1.2, 1.2]);
  const run = (strongholds, creative) => {
    const calls = [], taken = [];
    const state = {
      world: { population: { structureCache: { strongholdPositions: () => strongholds } }, get: () => 0 }, position: { x: 8.7, y: 64, z: 8.3 },
      survival: { creative, take: (id) => taken.push(id) }, eyes: { launch: () => calls.push("launch") }, itemRand: new JavaRandom(5),
    };
    const sounds = [];
    const out = useEyeOfEnder(state, { target: null, usesBlock: false }, { playSound: (n, o) => sounds.push([n, o]) });
    return { out, sounds, calls, taken };
  };
  const hit = run([[100, 0]], false);
  assert.equal(hit.out.branch, "launch-eye");
  assert.equal(hit.sounds.length, 2);
  assert.equal(hit.sounds[0][1].volume, 0.5);
  assert.deepEqual(hit.sounds[1], ["random.bow", { volume: 1, pitch: 1.2, position: { x: 8, y: 64, z: 8 } }]);
  assert.equal(hit.taken.length, 1);
  const none = run([], false);
  assert.deepEqual([none.out.branch, none.sounds.length, none.taken.length], ["no-stronghold", 0, 0]);
  assert.equal(run([[100, 0]], true).taken.length, 0);
});

test("b77: eating plays random.burp 0.5 on finish (both worlds) and drinking random.drink 0.5 per use tick; potions and milk finish silent", () => {
  for (const r of item("on-eaten-apple").concat(item("on-eaten-bread"), item("on-eaten-mushroom-stew"))) {
    const s = parse(r.sounds[0]);
    assert.equal(s.name, "random.burp"); assert.equal(s.volume, f(0.5));
    assert.ok(s.pitch >= 0.9 && s.pitch < 1.1 + 1e-6);
  }
  for (const r of item("on-eaten-potion-drink").concat(item("on-eaten-milk-bucket"))) assert.deepEqual(r.sounds, []);
  for (const n of ["potion-drink", "milk-bucket"]) for (const r of item(`use-item-tick-${n}`)) {
    const drinks = r.sounds.filter((s) => s.startsWith("sound random.drink"));
    assert.equal(drinks.length, r.calls); assert.equal(parse(drinks[0]).volume, f(0.5));
  }
});

test("b77: impacts: potion and exp bottle are aux 2002 on the server only; arrow hit random.bowhit 1.0 / 1.2 / (r * 0.2 + 0.9); flint and steel fires on both worlds; tnt prime is server-only", () => {
  for (const r of rec("impact")) assert.deepEqual(r.sounds, r.remote ? [] : [`aux 2002 8,64,8,${r.damage}`]);
  for (const r of item("arrow-into-block")) {
    const s = parse(r.sounds[0]);
    assert.equal(s.name, "random.bowhit"); assert.equal(s.volume, 1);
    assert.ok(s.pitch >= f(1.2 / 1.1) - 1e-6 && s.pitch <= f(1.2 / 0.9) + 1e-6);
  }
  for (const r of item("flint-on-tnt").concat(item("flint-on-stone"), item("flint-on-portal-frame"))) { const s = parse(r.sounds[0]); assert.equal(s.name, "fire.ignite"); assert.equal(s.volume, 1); assert.deepEqual(s.pos, [8.5, 65.5, 8.5]); }
  const tnt = rec("activate", (a) => a.name === "tnt-flint");
  assert.deepEqual(tnt.find((r) => !r.remote).sounds, ["ent game.tnt.primed 1.0 1.0"]);
  assert.deepEqual(tnt.find((r) => r.remote).sounds, []);
});

test("b77: jukebox with a record plays aux 1005 (server only); a record on an empty jukebox is aux 1005 with the record id", () => {
  assert.deepEqual(item("record-on-jukebox", (r) => !r.remote)[0].sounds, ["aux 1005 8,64,8,2256"]);
  assert.deepEqual(item("record-on-jukebox", (r) => r.remote)[0].sounds, []);
  assert.deepEqual(rec("activate", (a) => a.name === "jukebox-with-record" && !a.remote)[0].sounds, ["aux 1005 8,64,8,0"]);
});
