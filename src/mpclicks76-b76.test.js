// Batch 76 mpclicks76: client prediction of the batch 75 entity clicks, the owner's death throw, /setblock CustomName on an enchanting table (server).
// Batch 68 mpworldcmds: /setblock, /testforblock, /testfor, /setworldspawn, /playsound, /spreadplayers and /debug on the dedicated server (server-worldcmds.js).
// Native facts (bytecode-read, see .shared-memory/notes/mpworldcmds-b68-track.md): bm, bx, by (only a command block), bn (integers, no packet), bf (range, minimum volume), br, ak.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial, chatDisplay } from "./server-broadcast.js";
import { langReady } from "./chat-component.js";
import { predictAnimalUse } from "./multiplayer/animal-use.js";
import { makeStack } from "./inventory.js";
import { Survival } from "./survival.js";
import { deathThrow } from "./death-throw.js";

await langReady;

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
function fixture(ops = ["Alex"]) {
  const world = new World("b68-worldcmds");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 90; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: false }), inbox = {};
  const social = new ServerSocial({ simulation: sim, ops, deliver: (id, m) => (inbox[id] ??= []).push(m) });
  const join = (id, name, n, at = { x: 64.5, y: 10, z: 64.5 }) => { const p = sim.addPlayer(id, name, key(n)); p.position.copy(at); p.previous.copy(p.position); return p; };
  const say = (id, line) => { inbox[id] = []; social.command(id, line); return (inbox[id] ?? []).filter((m) => m.type === "chat").map((m) => chatDisplay(m).unformatted()); };
  return { sim, social, join, say, world };
}


const me = (id, count, damage = 0, mode = "survival") => { const sv = new Survival({}, mode); sv.inventory.main[0] = makeStack(id, count, damage); sv.inventory.current = 0; return sv; };
const NAME_TAG = 375, EGG = 1950, FLINT = 126;
const cow = (o = {}) => ({ type: "cow", health: 10, growingAge: 0, ...o });

test("name tag: names the copy, persistent, one tag used (Survival), kept in Creative", () => {
  const sv = me(NAME_TAG, 2); sv.inventory.main[0].displayName = "Rex";
  const mob = cow(), r = predictAnimalUse(mob, sv);
  assert.equal(r.handled, true); assert.equal(mob.customName, "Rex"); assert.equal(mob.persistent, true); assert.equal(sv.inventory.main[0].count, 1);
  const c = me(NAME_TAG, 2, 0, "creative"); c.inventory.main[0].displayName = "Rex";
  predictAnimalUse(cow(), c); assert.equal(c.inventory.main[0].count, 2);
  const plain = me(NAME_TAG, 2); assert.equal(predictAnimalUse(cow(), plain).handled, false, "a tag without a name does nothing");
  const zombie = { type: "zombie", health: 20 }, z = me(NAME_TAG, 1); z.inventory.main[0].displayName = "Z";
  assert.equal(predictAnimalUse(zombie, z).handled, true, "any living mob, not only the animals"); assert.equal(zombie.customName, "Z");
});

test("name tag: an adult villager and a tamed wolf take the click first, a baby villager and a wild wolf are named", () => {
  const named = (mob) => { const sv = me(NAME_TAG, 1); sv.inventory.main[0].displayName = "N"; return predictAnimalUse(mob, sv).handled; };
  assert.equal(named({ type: "villager", health: 20, growingAge: 0 }), false);
  assert.equal(named({ type: "villager", health: 20, growingAge: -100 }), true);
  assert.equal(named({ type: "wolf", health: 8, owner: "owner" }), false);
  assert.equal(named({ type: "wolf", health: 8, owner: "" }), true);
});

test("spawn egg: consumed on an ageable mob, one egg spent only when its class fits, nothing on a zombie", () => {
  const sv = me(EGG, 3, 92); // cow egg
  assert.equal(predictAnimalUse(cow(), sv).handled, true); assert.equal(sv.inventory.main[0].count, 2);
  assert.equal(predictAnimalUse({ type: "sheep", health: 8, growingAge: 0 }, sv).handled, true); assert.equal(sv.inventory.main[0].count, 2, "the click is used, the egg kept");
  assert.equal(predictAnimalUse({ type: "villager", health: 20, growingAge: 0 }, me(EGG, 1, 120)).handled, true, "no trade window");
  assert.equal(predictAnimalUse({ type: "zombie", health: 20 }, me(EGG, 1, 92)).handled, false);
  const c = me(EGG, 3, 92, "creative"); predictAnimalUse(cow(), c); assert.equal(c.inventory.main[0].count, 3);
});

test("flint and steel on a creeper: ignited copy, tool worn, Creative keeps it, a dead creeper is ignored", () => {
  const sv = me(FLINT, 1), cr = { type: "creeper", health: 20 };
  assert.equal(predictAnimalUse(cr, sv).handled, true); assert.equal(cr.ignited, true); assert.equal(sv.inventory.main[0].damage, 1);
  const c = me(FLINT, 1, 0, "creative"); predictAnimalUse({ type: "creeper", health: 20 }, c); assert.equal(c.inventory.main[0].damage, 0);
  assert.equal(predictAnimalUse({ type: "creeper", health: 0 }, me(FLINT, 1)).handled, true); // b79: xz (EntityCreeper.interact) has no health test; a corpse is lit too
});

test("the prediction agrees with the server on the held stack (name tag, egg, flint)", () => {
  for (const [id, dmg, kind] of [[NAME_TAG, 0, "cow"], [EGG, 92, "cow"], [EGG, 91, "cow"], [FLINT, 0, "creeper"]]) {
    const f = fixtureMobs(); const p = f.join();
    const m = f.s.mobs.mobs.create(kind, 66.5, 10, 64.5); f.s.mobs.mobs.entities.push(m); f.s.tick();
    p.survival.inventory.main[0] = makeStack(id, 2, dmg); p.survival.inventory.current = 0; if (id === NAME_TAG) p.survival.inventory.main[0].displayName = "Rex";
    const mine = me(id, 2, dmg); if (id === NAME_TAG) mine.inventory.main[0].displayName = "Rex";
    const r = predictAnimalUse({ type: kind, health: 20, growingAge: 0 }, mine);
    f.s.queueAnimUse(p.id, Number(m.id.slice(4)), r.handled); f.s.tick();
    const a = p.survival.inventory.main[0], b = mine.inventory.main[0];
    assert.deepEqual([a?.count ?? 0, a?.damage ?? 0], [b?.count ?? 0, b?.damage ?? 0], `${kind} ${id}/${dmg}`);
  }
});

function fixtureMobs() {
  const world = new World("b76-clicks");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  const join = () => { const p = s.addPlayer("a", "Alex", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); return p; };
  return { s, join };
}

test("death: the server's throw moves the body and the owner's own row carries it (the S12 of the owner is the position stream)", () => {
  const f = fixture(); const a = f.join("a", "Alex", 1); f.sim.tick();
  a.survival.mode = "survival"; f.sim.tick();
  a.survival.attackedAt = { rel: 0, from: { x: 60, z: 64.5 } }; a.survival.health = 0; a.survival.lastDamage = "mob";
  const rows = []; for (let i = 0; i < 4; i++) rows.push(f.sim.tick().players.find((q) => q.id === "a"));
  assert.equal(a.dead, true);
  const t = deathThrow(a.survival.attackedAt, { x: 64.5, y: 10, z: 64.5 }, 180 - (a.yaw * 180) / Math.PI);
  assert.ok(t.y > 0.099 && t.x > 0.09, "thrown away from the attacker at -x");
  assert.ok(rows[1].x > rows[0].x + 0.05 && rows[1].y > rows[0].y, "the owner's row follows the thrown body: " + JSON.stringify(rows.map((r) => [r.x, r.y])));
  assert.ok(rows[3].x > rows[1].x, "and keeps moving");
});

test("/setblock enchanting_table with CustomName names the table in every dimension, saves it, and a replacement drops it", () => {
  const f = fixture(); const a = f.join("a", "Alex", 1);
  assert.deepEqual(f.say("a", '/setblock 60 10 60 enchanting_table 0 replace {CustomName:"Study"}'), ["Block placed"]);
  assert.equal(f.sim.tiles.tableNames["60,10,60"], "Study");
  assert.equal(a.survival.tableNames, f.sim.tiles.tableNames, "the player's window reads the same store");
  assert.equal(f.sim.tiles.serialize().tableNames["60,10,60"], "Study");
  assert.deepEqual(f.say("a", "/setblock 61 10 60 enchanting_table"), ["Block placed"]);
  assert.equal(f.sim.tiles.tableNames["61,10,60"], undefined, "no tag, no name");
  assert.deepEqual(f.say("a", "/setblock 60 10 60 stone"), ["Block placed"]);
  assert.equal(f.sim.tiles.tableNames["60,10,60"], undefined, "the name goes with the table");
  f.sim.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  assert.deepEqual(f.say("a", '/setblock 61 70 61 enchanting_table 0 replace {CustomName:"Hell"}'), ["Block placed"]);
  assert.equal(f.sim.dimensions.nether.tiles.tableNames["61,70,61"], "Hell");
  assert.equal(f.sim.tiles.tableNames["61,70,61"], undefined, "not in the Overworld store");
});
