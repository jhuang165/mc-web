// Batch 71 mobfixes71: Weakness (op 0, -0.5 a level) and Strength (op 2, +130% a level) on an attacking mob replay public/research/mob-weakness-reference.json
// (tools/probes/MobWeaknessProbe.java on the unchanged 1.7.10 classes). Nothing here reads Math.random: the hit amount is a pure function of the effects.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { attackDamage } from "./mob-effects.js";
import { EntityWorld, mobHitAmount } from "./entities.js";
import { Survival } from "./survival.js";

const ref = JSON.parse(await readFile(new URL("../public/research/mob-weakness-reference.json", import.meta.url)));
const TYPES = { Zombie: "zombie", PigZombie: "pigman", Spider: "spider", Enderman: "enderman", Silverfish: "silverfish", Giant: "giant", Wolf: "wolf" };
const spawn = (type) => { const w = new EntityWorld({ size: 128, height: 256 }, [], () => 0.5); const e = w.create(type, 64.5, 1, 64.5); w.entities.push(e); if (e.equipment) e.equipment = e.equipment.map(() => null); /* the probe mob is unequipped (a pigman's golden sword adds 4) */ return e; };

test("native: 84 records, weakness and strength combined", () => {
  assert.equal(ref.counts.weakness, 84);
  assert.match(ref.classes.rs.sha256, /^[0-9a-f]{64}$/);
});

test("port: mobHitAmount applies Weakness (operation 0) before Strength (operation 2) like the native records", () => {
  let checked = 0;
  for (const r of ref.records) {
    const e = spawn(TYPES[r.id]);
    const effects = [];
    if (r.weakness > 0) effects.push({ id: 18, amplifier: r.weakness - 1, duration: 600 });
    if (r.strength > 0) effects.push({ id: 5, amplifier: r.strength - 1, duration: 600 });
    e.effects = effects;
    assert.ok(Math.abs(mobHitAmount(e) - r.amount) < 1e-5, `${r.id} weakness ${r.weakness} strength ${r.strength}: ${mobHitAmount(e)} vs ${r.amount}`);
    checked++;
  }
  assert.equal(checked, 84);
});

test("port: the player's attackDamage path matches the same arithmetic (Weakness -0.5 op 0, Strength x(1 + 1.3 n), floor 0)", () => {
  const s = new Survival();
  const base = 3;
  for (let w = 0; w < 4; w++) for (let st = 0; st < 3; st++) {
    s.effects.clear();
    if (w) s.effects.add({ id: 18, duration: 600, amplifier: w - 1 });
    if (st) s.effects.add({ id: 5, duration: 600, amplifier: st - 1 });
    const mob = attackDamage({ effects: [...(w ? [{ id: 18, amplifier: w - 1, duration: 600 }] : []), ...(st ? [{ id: 5, amplifier: st - 1, duration: 600 }] : [])] }, base);
    assert.ok(Math.abs(s.effects.attackDamage(base) - mob) < 1e-5, `w${w} s${st}`);
  }
});
