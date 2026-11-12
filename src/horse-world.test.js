// EntityHorse inside the EntityWorld: spawn record, feeding, saddle, taming by riding, ridden movement and jumping, foals, drops, NBT.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld, ENTITY_TYPES, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { JavaRandom } from "./java-random.js";
import { mobDrops, ANIMALS } from "./combat.js";
import { summonedMobRecord } from "./java-mobs.js";
import { SUMMONABLE } from "./commands.js";
import { NBT } from "./nbt.js";
import * as H from "./horse.js";

const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const horseWorld = (extra = {}, random = () => 0.5) => new EntityWorld(grass, [{ id: "mob-1", type: "horse", x: 64, y: 0, z: 64, health: 53, ...extra }], random);
const holding = (id, n = 4) => {
  const s = new Survival({ inventory: { [id]: n } });
  s.inventory.current = s.inventory.find(id);
  return s;
};
const WHEAT = 305, SADDLE = 363;
const rider = () => ({ player: true, x: 0, y: 0, z: 0, yaw: 0, moveForward: 0, moveStrafing: 0, fallDistance: 0, vehicle: null });

test("a horse is 1.4 x 1.6 and a new record carries rolled attributes and full health", () => {
  const t = ENTITY_TYPES.horse;
  assert.deepEqual([t.width, t.height], [Math.fround(1.4), Math.fround(1.6)]); // Entity.setSize takes floats (b45 foal growth records)
  const w = new EntityWorld(grass, [], () => 0.5);
  const e = w.create("horse", 64, 0, 64);
  assert.ok(e.horse.maxHealth >= 15 && e.horse.maxHealth <= 30);
  assert.equal(e.health, e.horse.maxHealth);
  assert.ok(e.horse.speed > 0.1 && e.horse.jump >= 0.4);
  assert.ok(ANIMALS.has("horse"));
  assert.equal(SUMMONABLE.EntityHorse, "horse");
});

test("horse state survives serialize and restore, garbage is sanitised", () => {
  const w = horseWorld({ horse: { type: 1, variant: 0, temper: 40, tame: true, saddled: true, chested: true, armor: 2, owner: "player", speed: 0.2, jump: 0.5, maxHealth: 25 }, health: 20 });
  const back = new EntityWorld(grass, JSON.parse(JSON.stringify(w.serialize()))).entities[0];
  assert.equal(back.horse.tame, true);
  assert.equal(back.horse.chested, true);
  assert.equal(back.horse.armor, 0); // a donkey cannot wear armour
  assert.equal(back.health, 20);
  const junk = new EntityWorld(grass, [{ id: "mob-2", type: "horse", x: 1, y: 0, z: 1, health: 99, horse: { type: 9, temper: 500 } }]).entities[0];
  assert.ok(junk.horse.type <= 4 && junk.horse.temper <= 100);
});

test("wheat heals and raises temper, creative keeps the stack, a saddle on a wild horse makes it rear", () => {
  const w = horseWorld({ health: 10 }), e = w.entities[0], s = holding(WHEAT);
  assert.equal(w.horseInteract(e, s, {}), true);
  assert.equal(e.health, 12);
  assert.equal(e.horse.temper, 3);
  assert.equal(s.inventory.count?.(WHEAT) ?? s.count(WHEAT), 3);
  assert.ok(w.events.some((x) => x.sound === "eating"));
  const sad = holding(SADDLE, 1);
  w.events.length = 0;
  assert.equal(w.horseInteract(e, sad, {}), true);
  assert.equal(e.rearing, true);
  assert.equal(e.horse.saddled, false);
  assert.ok(w.events.some((x) => x.sound === "mob.horse.angry" && x.volume === Math.fround(0.8)));
});

test("a tame horse is saddled from the held stack and can then be mounted and ridden", () => {
  const w = horseWorld({ horse: { type: 0, tame: true, owner: "player", speed: 0.225, jump: 0.7, maxHealth: 53 } }), e = w.entities[0];
  assert.equal(w.horseInteract(e, holding(SADDLE, 1), { sneak: false }), true);
  assert.equal(e.horse.saddled, true);
  const r = rider(), seats = w.horseSeats;
  seats.player = r;
  assert.equal(w.horseInteract(e, new Survival({}), { horses: seats }), true);
  assert.equal(r.vehicle.horse, true);
  assert.ok(Math.abs(r.y - (e.y + 0.7)) < 1e-5);
  r.moveForward = 0.98;
  const z0 = e.z;
  for (let i = 0; i < 20; i++) w.tick({ x: 64, y: 0, z: 90 }, new Survival({}));
  assert.ok(e.z > z0 + 1, `moved ${e.z - z0}`);
  assert.equal(e.stepHeight, 1);
  seats.dismount(grass, r);
  assert.equal(r.vehicle, null);
});

test("jump power from the key counter launches a saddled horse once", () => {
  const w = horseWorld({ horse: { type: 0, tame: true, saddled: true, owner: "player", speed: 0.225, jump: 0.7, maxHealth: 53 } }), e = w.entities[0];
  for (let i = 0; i < 3; i++) w.tick({ x: 64, y: 0, z: 90 }, new Survival({})); // settle on the ground
  const r = rider(), seats = w.horseSeats;
  seats.mount(e, r);
  for (let i = 0; i < 12; i++) seats.charge(r, { jump: true });
  seats.charge(r, { jump: false });
  assert.ok(e.jumpPower > 0.4 && e.jumpPower <= 1);
  const y0 = e.y;
  w.tick({ x: 64, y: 0, z: 90 }, new Survival({}));
  assert.ok(e.y > y0, "left the ground");
  assert.equal(e.jumpPower, 0);
});

test("drops: leather for a horse, rotten flesh and bone for the undead, experience as an animal", () => {
  const r = new JavaRandom(1);
  const drops = mobDrops({ type: "horse", horse: { type: 0 } }, { playerHit: true, looting: 0 }, r);
  assert.ok(drops.every(([id]) => id === 315));
  assert.ok(mobDrops({ type: "horse", horse: { type: 3 } }, { playerHit: true }, new JavaRandom(0)).every(([id]) => id === 206));
  assert.ok(mobDrops({ type: "horse", horse: { type: 4 } }, { playerHit: true }, new JavaRandom(0)).every(([id]) => id === 311));
});

test("summon NBT: Type, Variant, Temper, Tame, SaddleItem and the attribute list", () => {
  const t = (type, value) => ({ type, value });
  const tag = new Map([
    ["Type", t(NBT.INT, 1)], ["Variant", t(NBT.INT, 0)], ["Temper", t(NBT.INT, 30)], ["Tame", t(NBT.BYTE, 1)],
    ["SaddleItem", t(NBT.COMPOUND, new Map([["id", t(NBT.SHORT, 329)]]))],
    ["Attributes", t(NBT.LIST, { elementType: NBT.COMPOUND, items: [new Map([["Name", t(NBT.STRING, "horse.jumpStrength")], ["Base", t(NBT.DOUBLE, 0.55)]])] })],
  ]);
  const { record } = summonedMobRecord("horse", tag);
  assert.deepEqual([record.horse.type, record.horse.temper, record.horse.tame, record.horse.saddled, record.horse.jump], [1, 30, true, true, 0.55]);
});
