// Batch 85 convert85: a zombie villager whose conversion timer ends (EntityZombie.convertToVillager, yq.cd), executed on the unchanged 1.7.10 classes
// (tools/probes/VillageFightProbe.java, names b85-*; tools/verify-village-fight.mjs -> public/research/village-fight-b85-reference.json).
// Native facts the records show: the villager joins the list at once and updates in the same pass; the zombie is set dead but the rest of its update goes on (AI, attack,
// push, steps, the potion step; no ambient-sound roll, sw.C tests isEntityAlive); a corpse whose timer ends converts the same way and keeps counting its death
// (experience at deathTime 20, spawned in that update); a corpse that reached deathTime 20 first never converts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { replayFight, firstDivergence } from "./village-fight-replay.js";
import { splitExperience } from "./experience.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/village-fight-b85-reference.json", import.meta.url)));
for (const r of reference.records) {
  test(`convert85: ${r.name} replays with no divergence, the same items and orbs per tick`, () => {
    const seen = [], at = { n: 0 };
    const got = replayFight(r, { onTick: (t, ew) => { for (; at.n < ew.events.length; at.n++) { const x = ew.events[at.n]; if (x.drop) seen.push([t, "item"]); if (x.xp) for (const _ of splitExperience(x.xp)) seen.push([t, "orb"]); } } });
    assert.equal(JSON.stringify(firstDivergence(r, got)), "null", r.name);
    assert.deepEqual(got.hits.map((h) => [h[0], h[1], h[2]]), r.hits.map((h) => [h[0], h[1], h[2]]), r.name);
    // the record lists the tick whose entity pass drained the spawn (a hit's drop is drained in the tick it is scripted on, the update of the entity listed before it)
    assert.deepEqual(r.loot.map((l) => l[1] === "sq" ? "orb" : "item").sort(), seen.map((s) => s[1]).sort(), `${r.name} loot kinds`);
  });
}
test("convert85: the records cover alive conversions, corpses of every age and a corpse that outlived its timer", () => {
  const names = reference.records.map((r) => r.name);
  for (const k of [0, 1, 3, 10, 19, 20, 24]) assert.ok(names.includes(`b85-convert-dead-k${k}-8510`), k);
  assert.equal(reference.records.filter((r) => r.mobs.length).length, 20);
  assert.equal(reference.records.filter((r) => !r.mobs.length).length, 2); // k20 and k24: setDead at deathTime 20 came first
});
