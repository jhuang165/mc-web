// Batch 60 (tag b60ms), mobsounds: replays public/research/mobsounds-reference.json (tools/probes/MobSoundsProbe.java: the unchanged 1.7.10 mob classes on a client world double,
// alive, 400 ticks) against copy-talk.js: the living sound roll of every living client copy and the onLivingUpdate particle draws (enderman, blaze, wither, slime landing).
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ClientEntity } from "./entity-tracker.js";
import { JavaRandom } from "./java-random.js";
import { copyLivingRoll, copyLivingUpdate, talkInterval } from "./copy-talk.js";
import { EntityWorld } from "./entities.js";

const ref = JSON.parse(await readFile(new URL("../public/research/mobsounds-reference.json", import.meta.url), "utf8"));
class Log extends JavaRandom {
  constructor(seed) { super(BigInt(seed)); this.log = []; }
  nextDouble() { this.log.push("d"); return super.nextDouble(); }
  nextFloat() { this.log.push("f"); return super.nextFloat(); }
  nextInt(n) { const v = super.nextInt(n); if (n !== undefined) this.log.push(`${n}:${v}`); return v; }
}
const TYPE = { Creeper: "creeper", Skeleton: "skeleton", Spider: "spider", CaveSpider: "cave_spider", Giant: "giant", Zombie: "zombie", PigZombie: "pigman", Slime: "slime", LavaSlime: "magma_cube",
  Ghast: "ghast", Enderman: "enderman", Silverfish: "silverfish", Blaze: "blaze", WitherBoss: "wither", Witch: "witch", Bat: "bat", Pig: "pig", Sheep: "sheep", Cow: "cow", MushroomCow: "mooshroom",
  Chicken: "chicken", Wolf: "wolf", Ozelot: "ocelot", SnowMan: "snow_golem", VillagerGolem: "iron_golem", Villager: "villager" }; // squid and horse have their own copy code (tests elsewhere)
const copyOf = (r) => { const c = new ClientEntity("mob"); c.present = true; c.rand = new Log(r.seed); return c; };
const liveOf = (r) => ({ type: TYPE[r.name], size: Math.max(1, Math.round(r.width / 0.6)) });

test("mobsounds-reference is the executed record", () => {
  assert.equal(ref.tag, "b60ms");
  assert.equal(ref.mobs.filter((r) => r.case === "update").length, 28);
  for (const r of ref.mobs) if (r.case === "update") assert.equal(r.ticks.length, 400, r.name);
});

for (const r of ref.mobs) {
  if (!TYPE[r.name]) continue;
  test(`${r.name} copy: talk interval ${r.talk} and the living sound roll draws match the executed onEntityUpdate (400 ticks)`, () => {
    if (r.case !== "update") return;
    assert.equal(talkInterval(TYPE[r.name]), r.talk);
    const c = copyOf(r), m = liveOf(r);
    c.batHanging = true;
    let hits = 0;
    r.ticks.forEach(([draws], i) => {
      c.rand.log.length = 0;
      if (copyLivingRoll(c, m)) hits++;
      assert.equal(c.rand.log.join(" "), draws, `${r.name} tick ${i}`);
    });
    assert.ok(hits > 0, "at least one living sound in 400 ticks");
  });
  test(`${r.name} copy: onEntityUpdate and onLivingUpdate draws match the executed onUpdate`, () => {
    if (r.case !== "full" || r.error) return;
    const c = copyOf(r), m = liveOf(r);
    c.batHanging = true; // EntityBat's constructor: setIsBatHanging(true); the spawn packet's S1C carries it
    r.ticks.forEach(([draws, , , onGround], i) => {
      if (r.name === "Enderman" && draws.includes(" 100:")) m.screaming = true; // the probe's fall damage screamed the enderman at tick 55 (not recorded): the live flag stands in
      c.rand.log.length = 0;
      copyLivingRoll(c, m);
      c.onGround = onGround; // the move (the copy's own physics) happens between the two; here it is the recorded result
      copyLivingUpdate(c, m);
      assert.equal(c.rand.log.join(" "), draws, `${r.name} tick ${i}`);
    });
  });
}

test("a dead copy draws no roll, a removed copy draws nothing from onLivingUpdate", () => {
  const c = new ClientEntity("mob"); c.rand = new Log(1);
  c.dead = true;
  assert.equal(copyLivingRoll(c, { type: "zombie" }), false);
  copyLivingUpdate(c, { type: "enderman" });
  assert.equal(c.rand.log.length, 12); // a dying (not yet removed) enderman copy still spawns its portal particles
  c.rand.log.length = 0; c.gone = true;
  copyLivingUpdate(c, { type: "enderman" });
  assert.equal(c.rand.log.length, 0);
});

test("horse, squid, dragon and crystal copies are left to their own code", () => {
  for (const type of ["horse", "squid", "ender_dragon", "ender_crystal"]) {
    const c = new ClientEntity("mob"); c.rand = new Log(1);
    assert.equal(copyLivingRoll(c, { type }), false);
    assert.equal(c.rand.log.length, 0);
  }
});

test("EntityWorld wires it: clientEnvironment draws the roll, clientAfterMove the enderman particles, on the copy's own Random", () => {
  const terrain = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
  const w = new EntityWorld(terrain, [{ id: "mob-1", type: "enderman", x: 64, y: 0, z: 64, health: 40 }], () => 0.5);
  const m = w.entities[0], c = new ClientEntity("enderman");
  c.present = true; c.x = 64; c.y = 0; c.z = 64; c.rand = new Log(5);
  w.clientEnvironment(c, m);
  assert.equal(c.rand.log.length, 1);
  assert.match(c.rand.log[0], /^1000:/);
  c.rand.log.length = 0;
  w.clientAfterMove(c, m);
  assert.equal(c.rand.log.join(" "), "d d d d d d d d d d d d");
});
