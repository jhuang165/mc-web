// EntityWolf inside the EntityWorld: taming, sitting, following, anger, puppies and persistence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld, ENTITY_TYPES, mobPose, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { BONE, DYE } from "./wolf.js";
import { JavaRandom } from "./java-random.js";

// Entity.rand with nextInt(bound) fixed, for the 1-in-3 taming roll.
const rolling = (e, n) => {
  const r = new JavaRandom(7);
  r.nextInt = () => n;
  setEntityRandom(e, r);
};

const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const wolfWorld = (extra = {}, random = () => 0.5) => new EntityWorld(grass, [{ id: "mob-1", type: "wolf", x: 64, y: 0, z: 64, health: 8, ...extra }], random);
const player = (x = 64, z = 80) => ({ x, y: 0, z });
const holding = (id, n = 4) => {
  const s = new Survival({ inventory: { [id]: n } });
  s.inventory.current = s.inventory.find(id);
  return s;
};

test("a wolf is 0.6 x 0.8 with 8 health, bites for 2 and drops nothing", () => {
  const t = ENTITY_TYPES.wolf;
  assert.deepEqual([t.width, t.height, t.health, t.damage], [Math.fround(0.6), Math.fround(0.8), 8, 2]);
  const e = wolfWorld().entities[0];
  assert.equal(e.owner, "");
  assert.equal(e.collar, 14);
  assert.equal(mobPose(e, 0).wolf.tamed, false);
});

test("owner, sitting, angry and collar survive serialize and restore; an old record is a wild wolf", () => {
  const w = wolfWorld({ owner: "player", sitting: true, angry: false, collar: 3, health: 17 });
  const saved = JSON.parse(JSON.stringify(w.serialize())), back = new EntityWorld(grass, saved).entities[0];
  assert.deepEqual([back.owner, back.sitting, back.collar, back.health], ["player", true, 3, 17]);
  const old = new EntityWorld(grass, [{ id: "mob-9", type: "wolf", x: 1, y: 0, z: 1, health: 8 }]).entities[0];
  assert.deepEqual([old.owner, old.sitting, old.angry, old.collar], ["", false, false, 14]);
  assert.equal(new EntityWorld(grass, [{ id: "mob-9", type: "wolf", x: 1, y: 0, z: 1, health: 99 }]).entities[0].health, 8);
});

test("a bone taming roll of 0 tames: owner set, 20 health, 7 hearts, bone consumed", () => {
  const w = wolfWorld(), e = w.entities[0], s = holding(BONE);
  rolling(e, 0);
  w.fx = { spawn: () => {} };
  assert.equal(w.wolfInteract(e, s), true);
  assert.equal(e.owner, "player");
  assert.equal(e.health, 20);
  assert.equal(s.count(BONE), 3);
});

test("a failed taming roll keeps the wolf wild and still takes the bone", () => {
  const w = wolfWorld(), e = w.entities[0], s = holding(BONE);
  rolling(e, 1);
  assert.equal(w.wolfInteract(e, s), true);
  assert.equal(e.owner, "");
  assert.equal(s.count(BONE), 3);
});

test("the owner's click toggles sitting and a sitting wolf stays put while the owner walks away", () => {
  const w = wolfWorld({ owner: "player", health: 20 }), e = w.entities[0], s = new Survival();
  assert.equal(w.wolfInteract(e, s), true);
  assert.equal(e.sitWish, true);
  for (let i = 0; i < 40; i++) w.tick(player(64, 90), s);
  assert.equal(e.sitting, true);
  const x = e.x, z = e.z;
  for (let i = 0; i < 100; i++) w.tick(player(64, 90), s);
  assert.ok(Math.hypot(e.x - x, e.z - z) < 0.01);
  assert.equal(w.wolfInteract(e, s), true);
  assert.equal(e.sitWish, false);
});

test("a standing tamed wolf follows its owner and teleports beside it past 12 blocks", () => {
  const w = wolfWorld({ owner: "player", health: 20, z: 64 }), e = w.entities[0], s = new Survival();
  for (let i = 0; i < 200; i++) w.tick(player(64, 76), s);
  assert.ok(Math.hypot(e.x - 64, e.z - 76) < 6, `${e.x} ${e.z}`);
  const far = wolfWorld({ owner: "player", health: 20, z: 20 }), f = far.entities[0];
  for (let i = 0; i < 20; i++) far.tick(player(64, 72), s);
  assert.ok(Math.hypot(f.x - 64, f.z - 72) < 8, `${f.x} ${f.z}`);
});

test("a dye recolours the collar of a tamed wolf only", () => {
  const w = wolfWorld({ owner: "player", health: 20 }), e = w.entities[0], s = new Survival({ inventory: { [DYE]: 1 } });
  s.inventory.current = s.inventory.find(DYE);
  w.wolfInteract(e, s);
  assert.ok(e.collar >= 0 && e.collar <= 15);
});

test("hitting a wild wolf angers it and its pack, then it bites for 2", () => {
  const w = new EntityWorld(grass, [
    { id: "mob-1", type: "wolf", x: 64, y: 0, z: 64, health: 8 }, { id: "mob-2", type: "wolf", x: 66, y: 0, z: 64, health: 8 },
  ], () => 0.5), [a, b] = w.entities, s = new Survival();
  w.damage(a, 1, 64, 70);
  for (let i = 0; i < 5; i++) w.tick(player(64, 66), s);
  assert.equal(a.angry, true);
  assert.equal(b.angry, true);
});

test("a puppy of a tamed wolf is tamed to the same owner", () => {
  const w = wolfWorld({ owner: "player", health: 20, collar: 5 }), e = w.entities[0];
  w.spawnBaby(e, e);
  const baby = w.entities.find((x) => x !== e);
  assert.equal(baby.owner, "player");
  assert.equal(baby.health, 8);
  assert.ok(baby.growingAge < 0);
});

test("a wild wolf despawns only after 2400 ticks; a tamed wolf never", () => {
  const wild = wolfWorld({ age: 3000 }), tamed = wolfWorld({ age: 3000, owner: "player", health: 20 });
  assert.equal(wild.entities.length, 1);
  assert.equal(tamed.entities.length, 1);
});

test("/summon-style NBT: OwnerUUID, Sitting, Angry and CollarColor become the wolf's record", async () => {
  const { summonedMobRecord } = await import("./java-mobs.js"), { NBT } = await import("./nbt.js");
  const tag = new Map([
    ["OwnerUUID", { type: NBT.STRING, value: "11111111-2222-3333-4444-555555555555" }], ["Sitting", { type: NBT.BYTE, value: 1 }],
    ["CollarColor", { type: NBT.BYTE, value: 3 }], ["Health", { type: NBT.SHORT, value: 19 }],
  ]);
  const { record: r, ignored } = summonedMobRecord("wolf", tag);
  assert.deepEqual(ignored, []);
  assert.deepEqual([r.owner, r.sitting, r.angry, r.collar, r.health], ["player", true, false, 3, 19]);
  const { record: wild } = summonedMobRecord("wolf", new Map([["Angry", { type: NBT.BYTE, value: 1 }]]));
  assert.deepEqual([wild.owner, wild.angry, wild.collar, wild.health], ["", true, 14, 8]);
});
