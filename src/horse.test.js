import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as H from "./horse.js";

const ref = JSON.parse(await readFile(new URL("../public/research/horse-reference.json", import.meta.url)));
const same = (s, e) => ["type", "variant", "age", "maxHealth", "speed", "jump"].every((k) => s[k] === e[k]);
const FOOD = { wheat: 296, sugar: 353, bread: 297, hay: 170, apple: 260, goldenCarrot: 396, goldenApple: 322, carrot: 391, stick: 280 };

test("reference record counts and class hashes", () => {
  assert.equal(ref.target, "Minecraft Java 1.7.10");
  assert.equal(ref.spawn.length, 400);
  assert.equal(ref.feed.length, 432);
  assert.equal(ref.child.length, 560);
  assert.equal(ref.drops.length, 960);
  assert.match(ref.classes.wi.sha256, /^[0-9a-f]{64}$/);
});

test("spawn rolls match wi.a(sy) with and without group data, including the Random stream", () => {
  for (const row of ref.spawn) {
    const r = H.newRandom(row.seed);
    const { horse, group } = H.spawnHorse(r);
    assert.ok(same(horse, row.horse), `seed ${row.seed}`);
    assert.deepEqual([group.type, group.variant], row.group);
    assert.equal(r.nextInt(1000000), row.next);
  }
  for (const row of ref.spawnGroup) {
    const r = H.newRandom(row.seed);
    const { horse } = H.spawnHorse(r, { type: row.inType, variant: 258 });
    assert.ok(same(horse, row.horse), `group ${row.inType} seed ${row.seed}`);
    assert.equal(r.nextInt(1000000), row.next);
  }
});

test("facts: size, attribute bases, armour values, type predicates, foal scale", () => {
  const F = ref.facts;
  assert.equal(H.HORSE_WIDTH, F.width);
  assert.equal(H.HORSE_HEIGHT, F.height);
  assert.equal(H.HORSE_BASE_HEALTH, F.baseMaxHealth);
  assert.equal(H.HORSE_BASE_SPEED, F.baseSpeed);
  assert.equal(H.HORSE_BASE_JUMP, F.baseJump);
  assert.equal(H.MAX_TEMPER, F.maxTemper);
  assert.deepEqual(H.ARMOR_VALUES, F.armors.map((a) => a.value));
  for (const t of F.types) {
    assert.equal(H.canWearArmor(t.type), t.canWearArmor);
    assert.equal(H.canCarryChest(t.type), t.canCarryChest);
    assert.equal(H.isUndeadOrMule(t.type), t.undeadOrMule);
    assert.equal(H.isUndead(t.type), t.zombieOrSkeleton);
  }
  for (const a of F.ages) {
    assert.equal(H.growthScale(a.age), Math.fround(a.scale));
    assert.ok(Math.abs(H.mountedOffset({ age: a.age }) - a.mountedY) < 1e-6);
  }
});

test("feeding heals, ages, raises temper and enters love exactly as the probe recorded", () => {
  for (const row of ref.feed) {
    const before = { type: row.type, tame: row.tame, age: row.startAge, health: row.startHealth, maxHealth: row.horse.maxHealth, temper: row.startTemper, inLove: false };
    const o = H.feedHorse(before, FOOD[row.food]);
    const got = o ? o.horse : before;
    const label = JSON.stringify([row.food, row.type, row.tame, row.startAge, row.startHealth, row.startTemper]);
    assert.equal(got.health, row.horse.health, label);
    assert.equal(got.age, row.horse.age, label);
    assert.equal(got.temper, row.horse.temper, label);
    assert.equal(!!got.inLove, row.horse.inLove, label);
  }
  assert.equal(H.feedHorse({ ...H.blankHorse(), health: 5 }, FOOD.wheat, { creative: true }).consume, false);
});

test("taming task: temper steps, rearing dismounts and the tame roll reproduce all 150 seeds", () => {
  for (const row of ref.tame) {
    const r = H.newRandom(row.seed);
    let h = H.spawnHorse(r).horse;
    const events = [];
    for (let t = 0; t < 40000 && events.length < 60 && !h.tame; t++) {
      const o = H.tameTick(h, r);
      if (o.status === null) continue;
      events.push({ tick: t, status: o.status, temperBefore: h.temper, temperAfter: o.horse.temper, tame: o.horse.tame, rearing: o.horse.rearing });
      h = o.horse;
    }
    assert.equal(events.length, row.events.length, `seed ${row.seed}`);
    row.events.forEach((e, i) => {
      assert.deepEqual([events[i].tick, events[i].status, events[i].temperBefore, events[i].temperAfter, events[i].tame, events[i].rearing],
        [e.tick, e.status, e.temperBefore, e.temperAfter, e.tame, e.rearing]);
    });
  }
});

test("jump power curve matches wi.w(int)", () => {
  for (const row of ref.jump) {
    const j = H.jumpPower(row.saddled, row.power);
    assert.equal(j.power, Math.fround(row.jumpPower), JSON.stringify(row));
    assert.equal(j.held, row.held);
    assert.equal(j.rearing, row.rearing);
  }
});

test("foal breeding: type, variant parent mix and averaged attributes", () => {
  let colourFromA = 0;
  for (const row of ref.child) {
    const r = H.newRandom(row.seed * 31 + 7);
    const c = H.childOf(row.a, row.b, r);
    assert.equal(c.type, row.child.type);
    assert.equal(c.maxHealth, row.child.maxHealth); // a double: the b45 records showed the old Math.fround here hid a float rounding in the port
    assert.equal(c.health, row.child.health);
    assert.ok(Math.abs(c.jump - row.child.jump) < 1e-12);
    assert.ok(Math.abs(c.speed - row.child.speed) < 1e-12);
    assert.equal(c.variant, row.child.variant);
    if (c.type === 0 && (row.a.variant & 255) !== (row.b.variant & 255) && (c.variant & 255) === (row.a.variant & 255)) colourFromA++;
    assert.equal(r.nextInt(1000000), row.next);
  }
  assert.ok(colourFromA > 0);
});

test("mating matrix and state gates", () => {
  const mk = (type) => ({ ...H.blankHorse(), type, tame: true, maxHealth: 20, health: 20 });
  for (const row of ref.mate) assert.equal(H.canMateWith(mk(row.typeA), mk(row.typeB)), row.result, JSON.stringify(row));
  for (const row of ref.mateState) {
    const a = { ...mk(0), tame: row.tameA, age: row.foalA ? -12000 : 0, health: row.hurtA ? 5 : 20 };
    const b = { ...mk(0), tame: row.tameB };
    assert.equal(H.canBreed(a, row.riderA), row.canBreedA);
    assert.equal(H.canMateWith(a, b, row.riderA), row.result, JSON.stringify(row));
  }
  const self = mk(0);
  assert.equal(H.canMateWith(self, self), ref.mateSelf.result);
});

test("drops, sounds, fall damage and armour", () => {
  for (const d of ref.dropItem) assert.equal(H.HORSE_DROPS[d.type], d.item);
  for (const s of ref.soundFixed) {
    assert.equal(H.deathSound(s.type), s.death);
    assert.equal(H.angrySound(s.type), s.angry);
  }
  for (const row of ref.fall) assert.equal(H.fallDamage(row.distance), row.lost, `fall ${row.distance}`);
  for (const row of ref.armor) assert.equal(H.ARMOR_VALUES[row.armor], row.value);
  assert.equal(ref.armor.every((a) => a.lost === a.damage), true); // generic damage ignores armour
});

test("NBT round trip, legacy saddle flag and armour/saddle validation", () => {
  for (const row of ref.nbtWrite) {
    const h = row.horse;
    const tag = H.writeNbt({ ...H.blankHorse(), ...h });
    assert.equal(tag.Type, h.type);
    assert.equal(tag.Variant, h.variant);
    assert.equal(tag.Tame, row.tag.Tame.text === "1b" ? 1 : 0);
    assert.equal(tag.Temper, Number(row.tag.Temper.text));
  }
  for (const row of ref.nbtRead) {
    const back = H.readNbt(H.writeNbt({ ...H.blankHorse(), ...row.horse }));
    assert.equal(back.type, row.horse.type);
    assert.equal(back.variant, row.horse.variant);
  }
  const legacy = H.readNbt({ Saddle: 1, Tame: 1, Type: 0, Variant: 5, Temper: 12 });
  assert.equal(legacy.saddled, true);
  const row = ref.nbtLegacy.find((r) => r.name === "legacySaddle");
  assert.equal(legacy.saddled, row.saddled);
  assert.equal(legacy.temper, row.horse.temper);
  assert.equal(H.readNbt({ SaddleItem: { id: 280 } }).saddled, false);
  assert.equal(H.readNbt({ ArmorItem: { id: 419 } }).armor, 3);
  assert.equal(H.readNbt({ ArmorItem: { id: 280 } }).armor, 0);
});

test("non-feed clicks: rearing, GUI, chest and mounting match the 280 probe rows", () => {
  const ID = { saddle: 329, ironArmor: 417, goldArmor: 418, diamondArmor: 419, chest: 54, stick: 280, null: null };
  for (const r of ref.interact) {
    const o = H.interactHorse({ ...H.blankHorse(), type: r.type, tame: r.tame, age: r.startAge }, ID[r.item], { sneak: r.sneak });
    const action = r.mounted ? "mount" : r.gui ? "gui" : r.horse.rearing ? "rear" : r.horse.chested ? "chest" : "none";
    assert.deepEqual([o.result, o.action], [r.result, action], JSON.stringify([r.item, r.type, r.tame, r.sneak, r.startAge]));
    if (o.horse.chested) assert.equal(r.inventory, 17);
  }
});

test("rider position and jump impulse agree with the ride rows", () => {
  const row = ref.ride.find((r) => r.name === "idle" && r.seed === 1);
  assert.ok(Math.abs(row.ticks[0].rider[1] - (row.ticks[0].horse.y + 1.2 + 1.12)) < 1e-6);
  const jump = ref.ride.find((r) => r.name === "jumpFull" && r.seed === 1);
  const vy = (jump.jumpAttr * 1 - 0.08) * 0.98;
  assert.ok(Math.abs(jump.ticks[0].horse.vy - vy) < 1e-3, `${jump.ticks[0].horse.vy} vs ${vy}`);
});

test("drop count: one skipped draw, then nextInt(3) + looting bonus; undead drop their own items", () => {
  for (const d of ref.drops) {
    const r = H.newRandom(d.seed);
    const n = H.dropCount(r, d.looting);
    const items = d.items.map((s) => s.split("x")[0]);
    assert.equal(items.length, n, JSON.stringify(d));
    for (const id of items) assert.equal(Number(id), H.HORSE_DROPS[d.type]);
  }
});

test("living and hurt sounds, and their rearing rolls, match the 200 probe sound rows", () => {
  for (const row of ref.sound) {
    const l = H.livingSound(row.type, H.newRandom(row.seed));
    const h = H.hurtSound(row.type, H.newRandom(row.seed));
    assert.deepEqual([l.sound, l.rearing, h.sound, h.rearing], [row.living, row.livingRearing, row.hurt, row.hurtRearing]);
  }
});
