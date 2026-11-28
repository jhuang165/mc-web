// b102 credit102: (1) a deflected ghast ball flies through the real Fireballs tick and hits the single player after the 25-tick grace; (2) the single-player fall
// tracker names ladder / vines / water falls (executed combat-tracker-reference.json covers the rest); (3) TNT credit: BlockTNT (aob, bytecode-read) takes the placer
// from the exploding Explosion (chain), from the player (flint and steel), from a burning arrow's living shooter; redstone, fire and dispensers give none.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EntityWorld } from "./entities.js";
import { World, TNT } from "./world.js";
import { Survival } from "./survival.js";
import { langReady } from "./chat-component.js";
import { applyExplosion } from "./explosion-simulation.js";
import { JavaRandom } from "./java-random.js";

await langReady;

test("credit102: a deflected large ball flies past the 25-tick grace and hurts the single player as his own fireball", () => {
  const w = new EntityWorld(new World("b102-credit", "meadow"), []);
  const s = new Survival(); s.protection = 0; s.health = 20;
  w.ai.player = { x: 2.0, y: 100, z: 0.5, width: 0.6, height: 1.8, alive: true }; w.ai.survival = s;
  const fb = w.fireballs, b = fb.launch({ large: true, owner: null, x: 0.5, y: 101, z: 0.5, exact: [0, 0, 0] });
  assert.equal(fb.punch(b, [0.05, 0, 0]), true);
  let t = 0;
  for (; t < 200 && !b.dead; t++) fb.tick();
  assert.ok(b.dead && b.ticks >= 25, `hit at tick ${b.ticks}, after the grace`);
  assert.equal(s.health, 14, "6 damage");
  assert.equal(s.combat.entries.at(-1).src.type, "fireball");
  assert.equal(s.combat.entries.at(-1).src.entity.self, true);
});

test("credit102: falls name the ladder, vines or water at the feet", () => {
  for (const [site, text] of [["ladder", "fell off a ladder"], ["vines", "fell off some vines"], ["water", "fell out of the water"]]) {
    const p = new Survival({}, "survival"); p.protection = 0;
    p.combatFall = 8; p.combatSite = site; p.damage(20, "a fall");
    assert.match(JSON.stringify(p.combat.message({ name: "Alex" })), new RegExp(`death.fell.accident.${site}`), text);
  }
});

function blast(attacker) {
  const world = new World("b102-tnt", "meadow");
  for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) { world.put(x, 60, z, 1, 0, false); for (let y = 61; y < 70; y++) world.put(x, y, z, 0, 0, false); }
  world.put(6, 61, 6, TNT, 0, false);
  const w = new EntityWorld(world, []), s = new Survival(); s.health = 20;
  const primed = [];
  const state = { world, random: new JavaRandom(1), weather: { random: new JavaRandom(1) }, mobs: w, items: { spawn() {}, items: [] }, xpOrbs: { spawn() {}, orbs: [] }, arrows: [], projectiles: [], primed, survival: s, position: { x: 0.5, y: 100, z: 0.5 }, velocity: { x: 0, y: 0, z: 0 }, farming: { observe() {} } };
  applyExplosion(state, { x: 6.5, y: 61.5, z: 5.5, size: 4, exploder: null, attacker });
  return primed;
}

test("credit102: chained TNT inherits the exploding blast's placer (BlockTNT.onBlockDestroyedByExplosion: getExplosivePlacedBy)", () => {
  const skel = { type: "skeleton", x: 0, y: 61, z: 0, health: 20 };
  for (const who of ["player", skel, null]) {
    const primed = blast(who);
    assert.equal(primed.length, 1);
    assert.equal(primed[0].placer, who);
  }
});
