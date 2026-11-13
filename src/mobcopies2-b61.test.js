// Batch 61 (tag b61mc2), mobcopies2: replays public/research/mobcopies2-reference.json (tools/probes/MobCopies2Probe.java: the unchanged 1.7.10 mob classes on a client world double)
// against the client copy code: copy-water.js (splash, drowning air), copy-status.js (setEntityState draws, the wolf's shake), copy-meta.js (potion swirl, watched values),
// copy-talk.js (the wither's charge and armour draws, the enderman's scream clearing itself).
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ClientEntity, TrackerEntry } from "./entity-tracker.js";
import { JavaRandom } from "./java-random.js";
import { copyLivingRoll, copyLivingUpdate, copyLivingPre } from "./copy-talk.js";
import { copyStatus, copyWolfShake } from "./copy-status.js";
import { copyPotionSwirl, copyMetaOf, copyMetaDiff, applyCopyMeta, clientWorld } from "./copy-meta.js";
import { decreaseAirSupply } from "./copy-water.js";
import { EntityWorld, breathe } from "./entities.js";
import { WATER } from "./world.js";

const ref = JSON.parse(await readFile(new URL("../public/research/mobcopies2-reference.json", import.meta.url), "utf8"));
class Log extends JavaRandom {
  constructor(seed) { super(BigInt(seed)); this.log = []; }
  nextDouble() { this.log.push("d"); return super.nextDouble(); }
  nextFloat() { this.log.push("f"); return super.nextFloat(); }
  nextBoolean() { this.log.push("b"); return super.nextBoolean(); }
  nextInt(n) { const v = super.nextInt(n); if (n !== undefined) this.log.push(`${n}:${v}`); return v; }
}
const TYPE = { Creeper: "creeper", Skeleton: "skeleton", Spider: "spider", CaveSpider: "cave_spider", Giant: "giant", Zombie: "zombie", PigZombie: "pigman", Slime: "slime", LavaSlime: "magma_cube",
  Ghast: "ghast", Enderman: "enderman", Silverfish: "silverfish", Blaze: "blaze", WitherBoss: "wither", Witch: "witch", Bat: "bat", Pig: "pig", Sheep: "sheep", Cow: "cow", MushroomCow: "mooshroom",
  Chicken: "chicken", Wolf: "wolf", Ozelot: "ocelot", SnowMan: "snow_golem", VillagerGolem: "iron_golem", Villager: "villager", EntityHorse: "horse" };
const pool = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : x >= 7 && x <= 13 && z >= -9 && z <= -3 && y <= 4 ? WATER : 0), getMeta: () => 0, surface: () => 0 };
const sizes = {};
for (const r of ref.mobs) if (r.case === "water" && r.width) sizes[r.name] = [r.width, r.height];

test("mobcopies2-reference is the executed record", () => {
  assert.equal(ref.tag, "b61mc2");
  const count = (c) => ref.mobs.filter((r) => r.case === c).length;
  assert.equal(count("water"), 28);
  assert.equal(count("wither"), 3);
  assert.equal(count("potion"), 3);
  assert.equal(count("scream"), 1);
  assert.ok(count("status") > 500);
});

// A copy stepped by ClientEntity.step with EntityWorld's own hooks on the probe's pool; the position and motion are reset to the recorded ones before every tick.
function waterReplay(r) {
  const [w, h] = [r.width, r.height], type = TYPE[r.name];
  const host = { world: pool, size: () => [w, h] }, P = EntityWorld.prototype, m = { type, size: Math.max(1, Math.round(w / 0.6)) };
  host.clientSquidWet = P.clientSquidWet;
  const c = new ClientEntity(type); c.present = true; c.rand = new Log(r.seed); c.width = w; c.height = h; c.batHanging = true;
  const hooks = [(e) => P.moveClient.call(host, e, m), (e) => P.clientAfterMove.call(host, e, m), (e) => P.clientEnvironment.call(host, e, m), (e) => P.clientLiving.call(host, e, m)];
  let splashes = 0, bubbles = 0;
  // An enderman copy in water also draws nextDouble, nextInt(64), nextDouble every tick (EntityEnderman.teleportRandomly after the wet damage): not modelled, so it is replayed up to the first wet tick
  r.ticks.slice(0, r.name === "Enderman" ? 11 : r.ticks.length).forEach((t, i) => {
    [c.x, c.y, c.z, c.vx, c.vy, c.vz] = t.pre; c.px = c.x; c.py = c.y; c.pz = c.z;
    c.rand.log.length = 0; c.dead = false;
    c.step(...hooks);
    assert.equal(c.rand.log.join(" "), t.row[0], `${r.name} tick ${i}`);
    assert.equal(c.air, t.row[5], `${r.name} air at tick ${i}`);
    if (t.row[1].some((s) => s.includes("splash"))) splashes++;
    if (t.row[2].length === 8) bubbles++;
  });
  return { splashes, bubbles, c };
}
for (const r of ref.mobs) {
  if (r.case !== "water" || r.error || !TYPE[r.name] || ["EntityHorse"].includes(r.name)) continue;
  test(`${r.name} copy: the splash, the air and the drowning bubbles match the executed onUpdate in water (420 ticks)`, () => {
    const { splashes, bubbles, c } = waterReplay(r);
    if (["Ghast", "Blaze", "WitherBoss", "Bat", "Enderman"].includes(r.name)) return; // flying or hovering (they stay above the pool) or replayed in part: the draws were compared above
    assert.ok(splashes > 0, "it entered the water");
    if (r.name === "VillagerGolem") { assert.equal(bubbles, 0); assert.ok(c.air > 0, "an iron golem never drowns"); }
    else if (r.height > 5) assert.equal(c.air, 300, "a giant's eye stays above the pool"); // 10.44 above the feet: never under the water
    else assert.ok(bubbles > 0, "it drowned at least once");
  });
}

for (const r of ref.mobs) {
  if (r.case !== "wither" || r.error) continue;
  test(`wither copy (invul ${r.invul}, health ${r.health}): the charge and armour draws match the executed client onLivingUpdate`, () => {
    const c = new ClientEntity("wither"); c.present = true; c.rand = new Log(r.seed); c.invul = r.invul; c.health = r.health;
    clientWorld.rand = new Log(r.seed + 7000);
    const m = { type: "wither", health: 300 }; // the live health must not matter: the copy reads watcher 6
    r.ticks.forEach((t, i) => {
      c.rand.log.length = 0; clientWorld.rand.log.length = 0;
      copyLivingRoll(c, m);
      copyLivingUpdate(c, m);
      assert.equal(c.rand.log.join(" "), t[0], `entity draws, tick ${i}`);
      assert.equal(clientWorld.rand.log.join(" "), t[6], `client world draws, tick ${i}`);
    });
  });
}

test("status draws: every status of every mob class matches the executed handleHealthUpdate", () => {
  let draws = 0;
  for (const r of ref.mobs) {
    if (r.case !== "status" || !TYPE[r.name]) continue;
    const c = new ClientEntity(TYPE[r.name]); c.rand = new Log(r.seed);
    [c.width, c.height] = sizes[r.name] ?? [0.6, 1.8]; c.x = 5; c.y = 64; c.z = 5;
    const drew = copyStatus(c, { type: TYPE[r.name] }, r.status);
    assert.equal(c.rand.log.join(" "), r.immediate[0], `${r.name} status ${r.status}`);
    if (r.status !== 8) assert.equal(drew, r.immediate[0] !== "", `${r.name} status ${r.status} drew`); // status 8 starts the shake: no draw yet, the copy's state changes
    if (drew) draws++;
  }
  assert.ok(draws >= 15);
});

for (const r of ref.mobs) {
  if (r.case !== "status" || !r.ticks || !TYPE[r.name]) continue;
  test(`${r.name} copy after status ${r.status}: the following 40 ticks (roll, and the wolf's shake) match`, () => {
    const type = TYPE[r.name], m = { type };
    const c = new ClientEntity(type); c.present = true; c.rand = new Log(r.seed);
    [c.width, c.height] = sizes[r.name] ?? [0.6, 1.8]; c.x = 5; c.y = 64; c.z = 5;
    copyStatus(c, m, r.status);
    c.rand.log.length = 0;
    r.ticks.forEach((t, i) => {
      c.rand.log.length = 0; c.onGround = t[3]; c.inWater = false;
      copyLivingRoll(c, m);
      copyWolfShake(c, m);
      assert.equal(c.rand.log.join(" "), t[0], `tick ${i}`);
    });
  });
}

for (const r of ref.mobs) {
  if (r.case !== "potion" || r.error) continue;
  test(`zombie copy with watcher 7 set (ambient ${r.ambient}, invisible ${r.invisible}): the swirl draws match the executed updatePotionEffects`, () => {
    const c = new ClientEntity("zombie"); c.present = true; c.rand = new Log(r.seed); c.width = 0.6; c.height = 1.8;
    applyCopyMeta(c, { potion: 0x336699, ambient: !!r.ambient, invisible: !!r.invisible });
    r.ticks.forEach((t, i) => {
      c.rand.log.length = 0;
      copyPotionSwirl(c);
      copyLivingRoll(c, { type: "zombie" });
      assert.equal(c.rand.log.join(" "), t[0], `tick ${i}`);
    });
  });
}

test("enderman copy: the scream clears itself on nextInt(100), as the executed watcher 18 does (300 ticks)", () => {
  const r = ref.mobs.find((x) => x.case === "scream"), m = { type: "enderman", screaming: false }; // the live flag is not what the copy follows
  const c = new ClientEntity("enderman"); c.present = true; c.rand = new Log(r.seed);
  applyCopyMeta(c, { screaming: true });
  let cleared = -1;
  r.ticks.forEach((t, i) => {
    c.rand.log.length = 0; c.onGround = t[3];
    copyLivingRoll(c, m);
    copyLivingPre(c, m);
    copyLivingUpdate(c, m);
    assert.equal(c.rand.log.join(" "), t[0], `tick ${i}`);
    if (!c.screaming && cleared < 0) cleared = i;
  });
  assert.ok(cleared > 0, "the scream ended");
});

test("meta: air, potion colour, scream and the wither's values reach the copy through S0F and S1C only when they change", () => {
  const e = { type: "enderman", health: 40, air: 300, effects: [], screaming: false };
  const entry = new TrackerEntry(e, { range: 80 }, { player: null, watches: () => true });
  const spawn = entry.watched();
  assert.deepEqual(spawn, { potion: 0, invisible: false, air: 300, screaming: false });
  assert.equal(copyMetaDiff(entry.lastMeta, e), null);
  e.screaming = true; e.air = 299;
  assert.deepEqual(copyMetaDiff(entry.lastMeta, e), { air: 299, screaming: true });
  assert.equal(copyMetaDiff(entry.lastMeta, e), null);
  const w = { type: "wither", health: 100, invul: 20 };
  assert.deepEqual(copyMetaOf(w), { potion: 0, invisible: false, air: 300, invul: 20, health: 100 });
  const squid = { type: "squid", health: 10, air: 200 };
  assert.equal("air" in copyMetaOf(squid), false, "the squid sends its own air");
  assert.equal(copyMetaOf({ type: "x" }), null);
});

test("breathe: an iron golem keeps its air under water and Water Breathing stops the count", () => {
  const eye = { get: () => WATER, getMeta: () => 0 };
  const rand = new Log(1);
  const golem = { type: "iron_golem", x: 0.5, y: 0, z: 0.5, air: 300 };
  assert.equal(breathe(eye, golem, 2.9, rand), false);
  assert.equal(golem.air, 300);
  const zombie = { type: "zombie", x: 0.5, y: 0, z: 0.5, air: 300, effects: [{ id: 13 }] };
  assert.equal(breathe(eye, zombie, 1.8, rand), false);
  assert.equal(zombie.air, 300);
  zombie.effects = [];
  breathe(eye, zombie, 1.8, rand);
  assert.equal(zombie.air, 299);
  assert.equal(decreaseAirSupply(5, 0, rand), 4);
  assert.equal(rand.log.length, 0);
});
