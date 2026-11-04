import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hurtCameraRoll, fallPoints, fallSoundName, landingStepSound, landingEffects, statusPitch, deathTipAngle } from "./damage-fx.js";
import { heartsBlink, heartLayout, foodLayout, vitalsLayout, heartsHtml } from "./damage-hud.js";
import { soundTypeOf } from "./block-sounds.js";
import { JavaRandom } from "./java-random.js";
import { Survival } from "./survival.js";
import { World } from "./world.js";
import { EntityWorld } from "./entities.js";
import { finishPlayerMovement } from "./player-environment.js";
import { PlayerMotion } from "./player-movement.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/damage-fx-reference.json", import.meta.url)));
const f = Math.fround;

test("the hurt camera roll is the original's -sin(f^4 * PI) * 14 for every hurtTime and partial tick", () => {
  assert.equal(ref.camera.length, 50);
  for (const r of ref.camera) assert.equal(hurtCameraRoll({ hurtTime: r.hurtTime }, r.partial), f(r.roll), `${r.hurtTime}/${r.partial}`);
  assert.equal(hurtCameraRoll({ hurtTime: 0 }, 0), 0);
  // hurtTime - p < 0 returns before the tilt.
  assert.equal(hurtCameraRoll({ hurtTime: 0 }, 0.5), 0);
});

test("a dead view rolls toward 40 degrees and keeps the hurt tilt on top", () => {
  for (const r of ref.death) assert.equal(hurtCameraRoll({ health: 0, deathTime: r.deathTime }, r.partial), f(r.roll), `${r.deathTime}/${r.partial}`);
  const both = hurtCameraRoll({ health: 0, deathTime: 4, hurtTime: 6 }, 0.5);
  assert.equal(both, f(hurtCameraRoll({ health: 0, deathTime: 4 }, 0.5) + hurtCameraRoll({ hurtTime: 6 }, 0.5)));
});

test("fall damage is ceil(distance - 3 - jump boost level) and the sound follows the entity class and the damage", () => {
  for (const r of ref.fallPoints) assert.equal(fallPoints(f(r.distance), r.jumpLevel ? r.jumpLevel - 1 : -1), r.points, `${r.distance} jump ${r.jumpLevel}`);
  for (const r of ref.fallSounds) assert.equal(fallSoundName(r.points, { player: "player", mob: "hostile", animal: "neutral" }[r.entity]), r.sound);
});

test("the landing plays the fall sound at 1/1 then the block's step sound at volume * 0.5 and pitch * 0.75", () => {
  const stone = landingStepSound(3);
  assert.deepEqual(stone, { name: "step.stone", volume: 0.5, pitch: 0.75 });
  assert.equal(landingStepSound(0), null);
  const metalId = [...Array(200).keys()].find((id) => id && soundTypeOf(id)?.frequency === 1.5), metal = landingStepSound(metalId); // the Metal type has frequency 1.5
  assert.equal(metal.pitch, f(1.5 * f(0.75)));
  const big = landingEffects(10, { kind: "player", blockUnder: 3 });
  assert.deepEqual(big.sounds.map((s) => s.name), ["game.player.hurt.fall.big", "step.stone"]);
  assert.equal(big.points, 7);
  assert.deepEqual(landingEffects(3.5, { kind: "player", blockUnder: 3 }).sounds.map((s) => s.name), ["game.player.hurt.fall.small", "step.stone"]);
  assert.deepEqual(landingEffects(3, { kind: "player", blockUnder: 3 }), { points: 0, sounds: [] });
  assert.equal(landingEffects(5, { amplifier: 1, blockUnder: 3 }).points, 0);
});

test("the heart blink schedule is hurtResistantTime / 3 % 2 == 1 from 10 up", () => {
  for (const r of ref.blink) assert.equal(heartsBlink(r.hurtResistantTime), r.blink, String(r.hurtResistantTime));
});

test("hearts: the blink container, Poison / Wither fills, Absorption and the jiggle follow GuiIngame", () => {
  const layers = (o, i) => heartLayout({ maxHealth: 20, ...o }).hearts[i].layers;
  assert.deepEqual(layers({ health: 20 }, 0), [[16, 0], [52, 0]]);
  assert.deepEqual(layers({ health: 19 }, 9), [[16, 0], [61, 0]]);
  assert.deepEqual(layers({ health: 18, hurtResistantTime: 16 }, 9), [[25, 0], ], "blinking container, empty heart");
  assert.deepEqual(layers({ health: 20, poison: true }, 0), [[16, 0], [88, 0]]);
  assert.deepEqual(layers({ health: 20, wither: true }, 0), [[16, 0], [124, 0]]);
  assert.deepEqual(layers({ health: 20, hardcore: true }, 0), [[16, 45], [52, 45]]);
  // Absorption 3 at 20 health: 12 hearts, the top one half (153), the next full (144), the rest the health.
  const a = heartLayout({ health: 20, maxHealth: 20, absorption: 3 });
  assert.equal(a.hearts.length, 12);
  assert.deepEqual(a.hearts[11].layers[1], [169, 0]);
  assert.deepEqual(a.hearts[10].layers[1], [160, 0]);
  assert.deepEqual(a.hearts[9].layers[1], [52, 0]);
  assert.equal(a.hearts[10].up, 10 - 0, "the second row sits one spacing up");
  assert.equal(a.lift, 10, "two rows: spacing max(10 - (rows - 2), 3) = 10");
});

test("hearts jiggle only at 4 health or less, from the seeded Random, and the regeneration wave lifts one heart", () => {
  const calm = heartLayout({ health: 10, updateCounter: 7 });
  assert.ok(calm.hearts.every((h) => h.up === 0));
  const low = heartLayout({ health: 4, updateCounter: 7 }), rand = new JavaRandom(Math.imul(7, 312871));
  const expected = []; for (let i = 9; i >= 0; i--) expected[i] = 0 - rand.nextInt(2);
  assert.deepEqual(low.hearts.map((h) => h.up), expected);
  const wave = heartLayout({ health: 20, updateCounter: 13, regeneration: true });
  assert.deepEqual(wave.hearts.map((h) => h.up).filter(Boolean), []);
  assert.equal(heartLayout({ health: 20, updateCounter: 3, regeneration: true }).hearts[3].up, 2);
});

test("food: Hunger uses the +36 fill and the shifted container; saturation 0 shakes on updateCounter % (food * 3 + 1) == 0", () => {
  const plain = foodLayout({ food: 20, saturation: 5 });
  assert.deepEqual(plain[0].layers, [[16, 27], [52, 27]]);
  assert.deepEqual(foodLayout({ food: 7, saturation: 5 })[3].layers, [[16, 27], [61, 27]]);
  assert.deepEqual(foodLayout({ food: 20, saturation: 5, hunger: true })[0].layers, [[133, 27], [88, 27]]);
  const rest = foodLayout({ food: 20, saturation: 0, updateCounter: 61 }), still = foodLayout({ food: 20, saturation: 0, updateCounter: 60 });
  assert.ok(still.every((i) => i.up === 0));
  const r = new JavaRandom(0), shown = []; for (let i = 0; i < 10; i++) shown.push(-(r.nextInt(3) - 1));
  assert.deepEqual(rest.map((i) => i.up), shown);
  assert.ok(vitalsLayout({ health: 20, food: 20, updateCounter: 1 }).food.length === 10);
  assert.match(heartsHtml(heartLayout({ health: 20 }).hearts), /calc\(-52\*var\(--u\)\) calc\(0\*var\(--u\)\)/);
});

test("the client player's hurtResistantTime opens at 20 for a drop and 10 for a rise, then runs down", () => {
  const s = new Survival({}, "survival");
  s.protection = 0;
  s.damage(2, "an accident");
  assert.equal(s.clientResist, 20);
  assert.equal(heartsBlink(s.clientResist), false);
  for (let i = 0; i < 3; i++) s.tick();
  assert.equal(s.clientResist, 17);
  assert.equal(heartsBlink(s.clientResist), true);
  s.health = 19;
  s.tick();
  assert.equal(s.clientResist, 10);
  s.tick();
  assert.equal(s.clientResist, 9);
});

test("handleHealthUpdate's hurt pitch is (r - r) * 0.2 + 1 with no child bonus", () => {
  const a = new JavaRandom(5), b = new JavaRandom(5), x = a.nextFloat(), y = a.nextFloat();
  assert.equal(statusPitch(b), f(f(f(x - y) * f(0.2)) + 1));
});

test("a dead body tips over by sqrt((deathTime + p - 1) / 20 * 1.6) of 90 degrees", () => {
  assert.equal(deathTipAngle(20, 0), 90);
  assert.equal(deathTipAngle(1, 0), 0);
  assert.ok(deathTipAngle(5, 0.5) > 0 && deathTipAngle(5, 0.5) < 90);
});

function landing(distance, extra = {}) {
  const world = new World("damage-fx"), played = [];
  for (let x = 62; x <= 66; x++) for (let z = 62; z <= 66; z++) { for (let y = 9; y < world.height; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false); }
  const survival = new Survival({}, extra.mode ?? "survival");
  extra.setup?.(survival);
  survival.protection = 0;
  const state = { world, position: { x: 64.5, y: 10, z: 64.5 }, survival, motion: new PlayerMotion(), grounded: true, fallDistance: 0, landedFall: distance };
  finishPlayerMovement(state, { inWater: false, inLavaNow: false, oldPosition: { ...state.position } }, { fallSound: (s) => played.push(s.name) });
  return { survival, played };
}

test("the player's landing plays the fall and step sounds before the damage, with Jump Boost taking its level off", () => {
  const hard = landing(8);
  assert.deepEqual(hard.played, ["game.player.hurt.fall.big", "step.stone"]);
  assert.equal(hard.survival.health, 15);
  assert.deepEqual(hard.survival.hurtSounds, ["game.player.hurt"]);
  const small = landing(3.5);
  assert.deepEqual(small.played, ["game.player.hurt.fall.small", "step.stone"]);
  assert.equal(small.survival.health, 19);
  assert.deepEqual(landing(3).played, []);
  const boost = (survival) => survival.effects.add({ id: 8, duration: 100, amplifier: 1 });
  assert.equal(landing(5, { setup: boost }).survival.health, 20, "distance 5 - 3 - 2 = 0 points");
  assert.equal(landing(7, { setup: boost }).survival.health, 18);
  assert.deepEqual(landing(8, { mode: "creative" }).played, []);
});

test("a mob's landing plays game.hostile / game.neutral fall sounds at 1/1, then the step sound, and its hurt twice", () => {
  const world = { get: (x, y, z) => (y < 10 ? 3 : 0), height: 128 }, w = new EntityWorld(world, []);
  for (const [type, name] of [["zombie", "game.hostile.hurt.fall.big"], ["pig", "game.neutral.hurt.fall.big"]]) {
    const e = w.create(type, 5.5, 10, 5.5);
    w.entities.push(e);
    w.fall(e, 9);
    const events = w.drain();
    assert.equal(events[0].sound, name, type);
    assert.deepEqual([events[0].volume, events[0].pitch], [1, 1]);
    assert.equal(events.at(-1).sound, "step.stone");
    assert.equal(events.at(-1).volume, 0.5);
    assert.equal(events.at(-1).pitch, 0.75);
    // The client's status-2 hurt sound is the fresh hit's second one, at (r - r) * 0.2 + 1.
    const client = w.drainClientSounds();
    assert.equal(client.length, 1);
    assert.ok(Math.abs(client[0].pitch - 1) <= 0.2);
  }
});

test("a lethal fresh hit sounds hurt (status 2), die (server) and die (status 3)", () => {
  const w = new EntityWorld({ get: () => 0, height: 128 }, []), e = w.create("zombie", 5.5, 10, 5.5);
  w.entities.push(e);
  w.damage(e, 100, 5, 7, true);
  assert.deepEqual(w.drain().filter((x) => x.sound).map((x) => x.sound), ["mob.zombie.death"]);
  assert.deepEqual(w.drainClientSounds().map((x) => x.sound), ["mob.zombie.hurt", "mob.zombie.death"]);
});
