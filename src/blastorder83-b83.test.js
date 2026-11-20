// b83 blastorder83: Explosion.doExplosionA hurts and pushes ONE entity list in the world's list order (chunk x, chunk z, vertical slice, insertion: candidate-order.js), every kind
// together, and an ender crystal in that list explodes inline at its own turn. Executed: tools/probes/BlastOrderProbe.java (public/research/blast-order-reference.json, made by
// tools/verify-blast-order.mjs): 400 scenes of real items, orbs, arrows, primed TNT, ender crystals and a player over real chunks, the unchanged agw.a().
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyExplosion } from "./explosion-simulation.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs, newOrb } from "./experience.js";
import { Arrows } from "./bow.js";
import { primeTnt, TNT_Y_OFFSET } from "./explosion.js";
import { stampEntity, forgetEntity, walkedY } from "./candidate-order.js";
import { ServerMobs } from "./multiplayer/server-mobs.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/blast-order-reference.json", import.meta.url), "utf8"));
const air = () => ({ get: (x, y) => (y < 0 ? 1 : 0), getMeta: () => 0, solid: (x, y) => y < 0, set: () => true, isLoaded: () => true, isTicking: () => true, height: 256 });
const walkY = walkedY; // candidate-order.js stampWalked: the y the walk files each entity with

// The port's entities of one record, each logging [depth, index] when its hit lands (a push assigns the motion field; the crystal and the player log in their hurt).
function scene(r) {
  const log = [], world = air(), items = new ItemEntities(() => 0.5), xpOrbs = new ExperienceOrbs([], () => 0.5), arrows = new Arrows(() => 0.5), primed = [];
  let depth = 0;
  const watch = (e, field, i) => { let v = e[field]; Object.defineProperty(e, field, { get: () => v, set: (n) => { v = n; log.push([depth, i]); }, configurable: true, enumerable: true }); };
  const mobs = { entities: [] };
  const position = { x: 0, y: -100, z: 0 }, survival = { health: 0, creative: false, furnaces: {}, chests: {}, inventory: { armor: [] } };
  const state = { world, random: undefined, mobs, items, xpOrbs, arrows, projectiles: null, falling: null, primed, survival, position, velocity: { x: 0, y: 0, z: 0 }, farming: { observe() {} } };
  const boom = (x, y, z, size) => applyExplosion({ ...state, random: { nextFloat: () => 0.5, nextInt: () => 0, nextDouble: () => 0.5 } }, { x, y, z, size });
  const hurt = (e) => { if (!(e.health > 0)) return; log.push([depth, e.index]); e.health = 0; depth++; try { boom(e.x, e.y, e.z, 6); } finally { depth--; } }; // wz.a: setDead, then createExplosion(null, .., 6) inline
  mobs.hazard = hurt; mobs.damage = hurt;
  const ents = r.ents.map(([kind, x, y, z], i) => {
    if (kind === "player") {
      Object.assign(position, { x, y, z }); // b87 blast87: the list files a player by posY; the port's posY (EntityPlayerMP) is position.y, so it takes the probe player's posY
      Object.assign(survival, { health: 1000, scaledDamage: () => { log.push([depth, i]); return false; } });
      return "player";
    }
    if (kind === "item") { const e = items.spawn({ id: 1, count: 1, damage: 0 }, x, y, z, { motion: [0, 0, 0] }); watch(e, "mx", i); return e; }
    if (kind === "orb") { const o = newOrb(3, x, y, z, () => 0.5); xpOrbs.orbs.push(o); watch(o, "vx", i); return o; }
    if (kind === "arrow") { const a = { x, y, z, mx: 0, my: 0, mz: 0 }; arrows.list.push(a); watch(a, "mx", i); return a; }
    if (kind === "tnt") { const t = primeTnt(x, y, z, { random: () => 0.5 }); primed.push(t); watch(t, "vx", i); return t; }
    const c = { type: "ender_crystal", index: i, x, y, z, vx: 0, vy: 0, vz: 0, health: 5, growingAge: 0 };
    mobs.entities.push(c);
    return c;
  });
  const stamp = (i) => (ents[i] === "player" ? stampEntity("player", position.x, position.y, position.z, true) : stampEntity(ents[i], ents[i].x, walkY(ents[i]), ents[i].z));
  const place = (i, [x, y, z]) => {
    const e = ents[i], kind = r.ents[i][0];
    if (kind === "player") return Object.assign(position, { x, y, z });
    if (kind === "item") return Object.assign(e, { x, y: y - 0.125, z });
    if (kind === "orb") { const o = newOrb(3, x, y, z, () => 0.5); return Object.assign(e, { x, y: o.y, posY: y, z, bb: o.bb }); }
    if (kind === "tnt") return Object.assign(e, { x, y: y - TNT_Y_OFFSET, z });
    return Object.assign(e, { x, y, z });
  };
  return { log, ents, stamp, place, boom };
}
function replay(r) {
  forgetEntity("player"); // a fresh world: the player is the first entity to join it
  const s = scene(r);
  for (const op of r.ops) { if (op[0] === "move") s.place(op[1], op[2]); s.stamp(op[1]); }
  s.boom(...r.centre, 4);
  return s.log;
}

test("blastorder83 (executed): every scene's hits come in the native list order, kinds mixed, nested crystal blasts at the crystal's turn", () => {
  const recs = reference.records.filter((r) => r.case === "blast"); // b85: the file also holds the dragon, hang and crystal cases (blastprobe85-b85.test.js)
  assert.equal(recs.length, 400);
  const nested = recs.filter((r) => r.hits.some((h) => h[0] > 0)).length;
  assert.ok(nested > 100, "many scenes nest a crystal blast");
  let mismatch = 0;
  const first = [];
  // The probe's player is an EntityPlayer (posY the eye, getEyeHeight 0.12F); the port's is the integrated EntityPlayerMP (posY the feet, eye 1.62F). b87 blast87: the replay gives the
  // port's player the probe player's posY (the y the list files him by and the reach gate reads), so the scenes where the old replay put the port's eye on a crystal's centre
  // (degenerate, once left out) replay too: all 400.
  for (const r of recs) {
    const got = replay(r);
    if (JSON.stringify(got) !== JSON.stringify(r.hits)) { mismatch++; if (first.length < 3) first.push({ r, got }); }
  }
  assert.equal(mismatch, 0, JSON.stringify(first.map(({ r, got }) => ({ ents: r.ents, ops: r.ops, centre: r.centre, want: r.hits, got }))));
});

test("blastorder83 (executed): the old kind-by-kind order would not match (the records discriminate)", () => {
  const order = ["crystal", "item", "orb", "arrow", "tnt", "player"];
  const differs = reference.records.filter((r) => r.case === "blast").filter((r) => { const k = r.hits.filter((h) => h[0] === 0).map((h) => order.indexOf(r.ents[h[1]][0])); return k.some((v, i) => i > 0 && v < k[i - 1]); });
  assert.ok(differs.length > 100, `${differs.length} scenes list a later kind before an earlier one`);
});

test("blastorder83: a crystal earlier in the list hurts later entities first", () => {
  // one chunk column apart: the crystal (chunk x -1) is listed before the cow (chunk x 0) whatever their join order
  const r = { centre: [0.2, 20, 0.5], ents: [["item", 2.5, 20.125, 0.5], ["crystal", -1.5, 21, 0.5]], ops: [["add", 0], ["add", 1]] };
  assert.deepEqual(replay(r), [[0, 1], [1, 0]], "the crystal goes first and its inner blast reaches the item before the outer one would (the item dies there)");
});

test("blastorder83: the dedicated server runs one ordered list too (players, mobs, items and TNT interleave by cell)", () => {
  const calls = [];
  const world = air();
  const items = new ItemEntities(() => 0.5), tnt = primeTnt(-3.5, 20.49, 0.5, { random: () => 0.5 });
  const it = items.spawn({ id: 1, count: 1, damage: 0 }, 2.5, 20.125, 0.5, { motion: [0, 0, 0] });
  let mx = it.mx; Object.defineProperty(it, "mx", { get: () => mx, set: (v) => { mx = v; calls.push("item"); } });
  let vx = tnt.vx; Object.defineProperty(tnt, "vx", { get: () => vx, set: (v) => { vx = v; calls.push("tnt"); } });
  const player = { position: { x: 1.5, y: 19, z: 0.5 }, velocity: { x: 0, y: 0, z: 0 }, survival: { health: 20, creative: true, inventory: { armor: [] } } };
  const fake = Object.create(ServerMobs.prototype);
  Object.assign(fake, {
    host: { world, weather: { random: { nextFloat: () => 0.5, nextInt: () => 0, nextDouble: () => 0.5 } }, items, dispense: { primed: [tnt], prime() {} }, serverItems: null, vehicles: null, falling: null },
    mobs: { entities: [], hazard() {}, damage() {} }, probe: { x: 0, y: 0, z: 0 }, views: new Map([[1, { player }]]),
    hurt() { calls.push("player"); },
  });
  Object.defineProperty(player.velocity, "x", { get: () => 0, set: () => calls.push("player") });
  forgetEntity(player);
  stampEntity(it, it.x, walkedY(it), it.z); stampEntity(tnt, tnt.x, walkedY(tnt), tnt.z);
  fake.explode({ x: 0.5, y: 20, z: 0.5, size: 4, source: null });
  assert.deepEqual(calls, ["tnt", "player", "item"], "chunk x -1 (the TNT) first, then chunk 0 with the player (joined first) ahead of the item");
});

test("blastorder83: the away run's blasts reach its minecarts and boats (wobble, break, drop at once)", async () => {
  const { populationBlockMapperReady } = await import("./population-world.js");
  const { runAway, stateColumns, awayPlan } = await import("./away-world.js");
  const { Minecarts } = await import("./minecarts.js");
  const { Boats } = await import("./boats.js");
  await populationBlockMapperReady;
  const floorChunks = (cols) => cols.map(([x, z]) => {
    const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = 3;
    return { x, z, blocks, meta };
  });
  const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 } };
  const run = async (root, ticks) => {
    const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 2), chunks: floorChunks(cols), records: [] };
    const real = Math.random; let s = 4501;
    Math.random = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    try { return await runAway(plan); } finally { Math.random = real; }
  };
  const carts = new Minecarts(); carts.spawnEmpty({ x: 6.5, y: 11, z: 5.5 });
  const boats = new Boats(); boats.spawnBoat({ x: 5.5, y: 11, z: 7.5 });
  const tnt = [{ x: 5.5, y: 11, z: 5.5, vx: 0, vy: 0, vz: 0, fuse: 1 }];
  const calm = await run({ ...base, minecarts: carts.toJSON(), boats: boats.toJSON() }, 4);
  assert.equal(calm.entities.minecarts.carts.length, 1, "control: no blast, the cart stays");
  const hit = await run({ ...base, minecarts: carts.toJSON(), boats: boats.toJSON(), tnt }, 4);
  assert.equal(hit.entities.tnt.length, 0, "the TNT went off");
  assert.equal(hit.entities.minecarts.carts.length, 0, "the cart one block from the blast broke (damage over 40)");
  assert.equal(hit.entities.boats.length, 0, "so did the boat two blocks away");
  assert.ok(hit.entities.drops.length >= 2, `their items dropped (${hit.entities.drops.length})`);
});
