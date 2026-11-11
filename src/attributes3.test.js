// Batch 27 attributes3: attackEntityAsMob damage per living class under attackDamage modifiers and bases, knockBack under knockbackResistance edits and
// movementSpeed values. Replays public/research/attributes3-reference.json (tools/probes/Attributes3Probe.java against the unchanged 1.7.10 classes).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { decodeNbt, NBT } from "./nbt.js";
import { shouldAttackEntity } from "./wolf.js";
import { javaMobFromNbt } from "./java-mobs.js";
import { JavaRandom } from "./java-random.js";
import { Survival } from "./survival.js";
import { EntityWorld, aiMoveSpeed, knockBack, mobHitAmount, setEntityRandom } from "./entities.js";

const ref = JSON.parse(await readFile(new URL("../public/research/attributes3-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const nbtOf = (r) => {
  const tag = decodeNbt(Uint8Array.from(Buffer.from(r.nbt, "hex"))).tag.value;
  tag.set("id", { type: NBT.STRING, value: r.id });
  return tag;
};
const world = (mobs = []) => new EntityWorld({ size: 128, height: 256 }, mobs, () => 0.5);
const load = (r) => {
  const record = javaMobFromNbt(nbtOf(r));
  return record ? world([{ ...record, x: 64.5, y: 1, z: 64.5 }]).entities[0] : null;
};
const near = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
const ZOMBIE = new Set(["Zombie", "PigZombie"]);

test("native: record counts and class digests", () => {
  assert.deepEqual(ref.counts, { attack: 306, strength: 33, foreign: 8, knockback: 336, speed: 203 });
  for (const c of ["sv", "sw", "wv", "yq", "tl"]) assert.match(ref.classes[c].sha256, /^[0-9a-f]{64}$/);
});

// ---- what native does ----
test("native attack: only EntityMob classes read the attackDamage attribute; a wolf, ocelot and iron golem use a fixed amount", () => {
  const rec = (id, variant, owned = false, seed = 0) => by("attack").find((r) => r.id === id && r.variant === variant && r.owned === owned && r.seed === seed);
  for (const id of ["Wolf", "Ozelot", "VillagerGolem"]) for (const r of by("attack").filter((x) => x.id === id)) assert.equal(r.registered, false, id);
  for (const v of ["plain", "add3", "all", "base7", "negative", "speedOnly"]) {
    assert.equal(rec("Wolf", v).amount, 2, v);
    assert.equal(rec("Wolf", v, true).amount, 4, v);
    assert.equal(rec("Ozelot", v, true).amount, 3, v);
  }
  // operations 0, 1, 2 apply in that order: (2 + 3) * (1 + 1 + 0.25) * (1 + 0.5)
  assert.equal(rec("Spider", "all").amount, 16.875);
  assert.equal(rec("Zombie", "base7add3").amount, 10);
  assert.equal(rec("Zombie", "negative").amount, 0);
  // Creepers register the attribute but their melee call deals no direct damage.
  assert.equal(rec("Creeper", "plain").amount, -1);
});

// ---- the port ----
test("port attack: hitMob deals the native amount for every class and variant that hits", () => {
  let checked = 0;
  for (const r of by("attack").filter((x) => x.hit && x.amount >= 0 && x.id !== "VillagerGolem" && x.id !== "WitherBoss")) {
    const e = load(r);
    assert.ok(e, `${r.id} loads`);
    const w = world();
    const victim = { type: "zombie", x: 0, y: 0, z: 0, health: 20 };
    w.entities.push(e, victim);
    let amount = null;
    w.attackEntityFrom = (_t, n) => ((amount = n), true);
    w.hitMob(e, victim);
    near(amount, r.amount, `${r.id} ${r.variant} owned=${r.owned}`);
    checked++;
  }
  assert.ok(checked > 100, `${checked}`);
});

test("port attack: hitPlayer takes the same amount before difficulty scaling", () => {
  for (const r of by("attack").filter((x) => x.hit && x.amount >= 0 && x.id !== "VillagerGolem" && x.id !== "WitherBoss" && x.id !== "Ozelot" && x.seed === 0)) {
    const e = load(r);
    if (!e) continue;
    const hits = [];
    const w = world([]);
    w.entities.push(e);
    w.hitPlayer(e, { scaledDamage: (n) => (hits.push(n), true), setFire() {}, effects: null, difficulty: 2 });
    near(hits[0], r.amount, `${r.id} ${r.variant} owned=${r.owned}`);
  }
});

test("native strength: Strength raises an EntityMob's hit (operation 2, +130% a level) but never a wolf's, ocelot's or iron golem's", () => {
  const rows = by("strength");
  assert.equal(rows.length, 33);
  for (const r of rows) {
    const e = load({ id: r.id, nbt: ref.records.find((x) => x.case === "attack" && x.id === r.id && x.variant === "plain" && x.owned === r.owned)?.nbt });
    if (!e || r.id === "VillagerGolem") continue;
    if (r.strength > 0) e.effects = [{ id: 5, amplifier: r.strength - 1, duration: 600 }];
    near(mobHitAmount(e), r.amount, `${r.id} owned=${r.owned} strength ${r.strength}`);
  }
});

test("native knockback: the attribute value (base, then modifiers, clamped to 0..1) decides the Entity.rand roll", () => {
  for (const r of by("knockback")) {
    const e = load(r);
    assert.ok(e, r.id);
    near(e.knockbackResistance ?? 0, r.value, `${r.id} ${r.variant} value`);
  }
});

test("port knockback: the motion after knockBack matches every record", () => {
  for (const r of by("knockback")) {
    const e = load(r);
    e.x = 3.5; e.z = 7.5; e.vx = e.vy = e.vz = 0;
    // The roll is Entity.rand.nextDouble() on a seeded Random.
    const rand = new JavaRandom(r.seed);
    knockBack(e, 3.5, 8.5, () => rand.nextDouble());
    for (const [i, k] of ["vx", "vy", "vz"].entries()) near(e[k], r.motion[i], `${r.id} ${r.variant} seed ${r.seed} ${k}`, 1e-6);
  }
});

test("native speed: the movementSpeed value after modifiers (the EntityMoveHelper multiplier base) and the port's aiMoveSpeed follow it", () => {
  for (const r of by("speed")) {
    const e = load(r);
    assert.ok(e, r.id);
    // the attribute value itself is the port's multiplier-free speed for every class
    near(aiMoveSpeed(e, 1), r.value, `${r.id} ${r.variant} value`, 1e-6);
  }
});

// ---- foreign owners (native: getOwner() is null for an OwnerUUID nobody here has; see `foreign` records) ----
const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const tamedWorld = (type, extra = {}) => new EntityWorld(grass, [{ id: "mob-1", type, x: 64, y: 0, z: 64, health: 20, owner: "player", ...extra }], () => 0.5);
const player = (x = 64, z = 80) => ({ x, y: 0, z });

test("native foreign owner: tamed with no owner present means AISit runs on its own, nothing follows and the owner targets never start", () => {
  const rows = by("foreign");
  assert.equal(rows.length, 8);
  for (const r of rows) {
    const run = (list, priority, i = 0) => r.tasks.filter((t) => t.list === list && t.priority === priority)[i].run;
    assert.equal(r.owner, false, `${r.id} ${r.state}`);
    assert.equal(run("c", 2), r.tamed, `${r.id} ${r.state}: EntityAISit.shouldExecute is true for any tamed animal without an owner, sitting or not`);
    assert.equal(run("c", 1), false);
    for (const t of r.tasks.filter((x) => x.list === "d" && x.priority <= 2)) assert.equal(t.run, false, `${r.id} owner target ${t.priority}`);
    if (r.id === "Wolf") {
      assert.equal(run("c", 5), false, "no EntityAIFollowOwner");
      assert.equal(r.attack.tamedWolf, false, "another ownerless tamed wolf is never attacked (null == null)");
      assert.equal(r.attack.wildWolf, true);
    }
  }
});

test("port foreign owner: a wolf with a foreign OwnerUUID sits unasked and never follows; a local-owned one follows", () => {
  const s = new Survival();
  const foreign = tamedWorld("wolf", { ownerUuid: "00000000-0000-0001-0000-000000000002", z: 64 }), f = foreign.entities[0];
  for (let i = 0; i < 100; i++) foreign.tick(player(64, 76), s);
  assert.equal(f.sitting, true);
  assert.ok(Math.hypot(f.x - 64, f.z - 64) < 0.01, "stays where it is");
  const local = tamedWorld("wolf", { z: 64 }), l = local.entities[0];
  setEntityRandom(l, new JavaRandom(4401)); // Entity.rand is seeded at random; about 4% of seeds wander for 100 ticks before following (batch 44 lead)
  for (let i = 0; i < 100; i++) local.tick(player(64, 76), s);
  assert.equal(l.sitting, false);
  assert.ok(Math.hypot(l.x - 64, l.z - 76) < 8);
});

test("port foreign owner: only the real owner toggles sitting, and a foreign wolf is no target filter against the player's wolves", () => {
  const s = new Survival();
  for (const type of ["wolf", "ocelot"]) {
    const foreign = tamedWorld(type, { ownerUuid: "00000000-0000-0001-0000-000000000002", sitWish: false }), e = foreign.entities[0];
    foreign.wolfInteract?.(e, s);
    if (type === "wolf") { assert.equal(e.sitWish, false, "foreign wolf: the click does not toggle"); }
    const own = tamedWorld(type, { sitWish: false }), o = own.entities[0];
    if (type === "wolf") { own.wolfInteract(o, s); assert.equal(o.sitWish, true); }
  }
  // Two foreign-owned wolves are never each other's targets; a foreign wolf may attack a locally-owned one.
  assert.equal(shouldAttackEntity({ type: "wolf", owner: "player", ownerUuid: "a" }, { type: "wolf", owner: "player", ownerUuid: "b" }), false);
  assert.equal(shouldAttackEntity({ type: "wolf", owner: "player", ownerUuid: "a" }, { type: "wolf", owner: "player" }), true);
  assert.equal(shouldAttackEntity({ type: "wolf", owner: "player" }, { type: "wolf", owner: "player" }), false);
});
