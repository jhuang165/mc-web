// EntitySlime inside the EntityWorld: size, jumping, contact damage, splitting, drops, persistence, /summon and Java NBT.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld, ENTITY_TYPES, HOSTILE } from "./entities.js";
import { Survival } from "./survival.js";
import { mobDrops, experiencePoints } from "./combat.js";
import { JavaRandom } from "./java-random.js";
import { summonedMobRecord, javaMobFromNbt } from "./java-mobs.js";
import { NBT } from "./nbt.js";
import { SUMMONABLE } from "./commands.js";

const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const slimeWorld = (size, extra = {}, random = () => 0.5) => new EntityWorld(grass, [{ id: "mob-1", type: "slime", x: 64.5, y: 0, z: 64.5, health: size * size, size, ...extra }], random);
const player = (x = 64.5, z = 72.5) => ({ x, y: 0, z, alive: true });
const survival = () => new Survival({});

test("a slime is a hostile mob whose box, health and damage follow its size", () => {
  assert.ok(HOSTILE.has("slime"));
  assert.equal(SUMMONABLE.Slime, "slime");
  for (const size of [1, 2, 4]) {
    const w = slimeWorld(size), e = w.entities[0];
    assert.equal(e.size, size);
    assert.equal(e.health, size * size);
    assert.deepEqual(w.size(e), [ENTITY_TYPES.slime.width * size, ENTITY_TYPES.slime.height * size]);
  }
});

test("size and full health survive serialize and restore; Size saved health is replaced by size * size", () => {
  const w = slimeWorld(4, { health: 3 });
  assert.equal(w.entities[0].health, 16); // restore: setSlimeSize heals to full
  const back = new EntityWorld(grass, JSON.parse(JSON.stringify(w.serialize()))).entities[0];
  assert.deepEqual([back.size, back.health], [4, 16]);
  assert.equal(new EntityWorld(grass, [{ id: "mob-2", type: "slime", x: 1, y: 0, z: 1, health: 1, size: -3 }]).entities[0].size, 1);
});

test("a slime waits for its jump delay, then jumps toward a player in range and lands with squish and particles", () => {
  const w = slimeWorld(2), e = w.entities[0], s = survival(), puffs = [];
  w.fx = { spawn: (name, ...rest) => puffs.push(name) };
  let peak = 0, jumped = 0;
  for (let i = 0; i < 80; i++) {
    w.tick(player(), s);
    peak = Math.max(peak, e.y);
    if (e.jumping) jumped++;
  }
  assert.ok(peak > 1, "jumped " + peak);
  assert.ok(jumped >= 2);
  assert.ok(e.z > 64.5, "moved toward the player at +z");
  assert.ok(puffs.length >= 16 && puffs.every((n) => n === "iconcrack_341"), "size * 8 particles per landing");
  assert.ok(w.events.some((x) => x.sound === "mob.slime.big"));
});

test("a size 2 slime touching the player deals 2; a size 1 slime never hurts", () => {
  for (const [size, hits] of [[2, true], [1, false]]) {
    const w = slimeWorld(size, { x: 64.5, z: 64.5 }), s = survival(), before = s.health;
    for (let i = 0; i < 3; i++) w.tick(player(64.5, 65.3), s);
    assert.equal(s.health < before, hits, "size " + size);
  }
});

test("peaceful removes a slime without drops or children", () => {
  const w = slimeWorld(4), s = survival();
  w.difficulty = 0;
  w.tick(player(), s);
  assert.equal(w.entities.length, 0);
});

test("a dead slime splits into 2 to 4 children of half the size at the end of its death animation", () => {
  const w = slimeWorld(4), e = w.entities[0], s = survival();
  w.kill(e);
  for (let i = 0; i < 25; i++) w.tick(player(0, 0), s);
  const kids = w.entities.filter((x) => x !== e);
  assert.ok(kids.length >= 2 && kids.length <= 4, "children " + kids.length);
  for (const k of kids) assert.deepEqual([k.type, k.size, k.health], ["slime", 2, 4]);
  assert.ok(!w.entities.includes(e));
});

test("only a size 1 slime drops slimeballs, and every size gives its size in experience", () => {
  let balls = 0;
  for (let seed = 0; seed < 50; seed++) {
    balls += mobDrops({ type: "slime", size: 1 }, { playerHit: true }, new JavaRandom(seed)).filter(([id]) => id === 341).length;
    assert.deepEqual(mobDrops({ type: "slime", size: 2 }, { playerHit: true }, new JavaRandom(seed)), []);
  }
  assert.ok(balls > 20 && balls < 90);
  for (const size of [1, 2, 4]) assert.equal(experiencePoints({ type: "slime", size }, new JavaRandom(1), new JavaRandom(1)), size);
});

test("/summon Slime takes a Size tag; Java NBT Size is size - 1", () => {
  const { record, ignored } = summonedMobRecord("slime", new Map([["Size", { type: NBT.INT, value: 3 }]]));
  assert.deepEqual([record.size, ignored], [4, []]);
  assert.equal(summonedMobRecord("slime", new Map([["Size", { type: NBT.INT, value: -5 }]])).record.size, 1);
  const entity = new Map([["id", { type: NBT.STRING, value: "Slime" }], ["Pos", { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [1, 2, 3] } }], ["Size", { type: NBT.INT, value: 1 }]]);
  const mob = javaMobFromNbt(entity);
  assert.deepEqual([mob.type, mob.size, mob.x, mob.y, mob.z], ["slime", 2, 1, 2, 3]);
});
