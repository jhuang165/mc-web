// Batch 100 mobrec100: iron golem rose offering (VillageFightProbe b100-rose records, tools/verify-villagers100.mjs -> public/research/village-fight-b100-rose{1,2}-reference.json),
// witch potion skip conditions and combos and a bat in water (b97mr-witch100 / b97mr-bat100 records, tools/verify-endermanwolf.mjs with EW_SET=b97mr EW_B100=1 ->
// public/research/enderman-wolf-b100mr-{witch1..4,bat}-reference.json).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fightReference100, replayFight, firstDivergence as fightDivergence } from "./village-fight-replay.js";
import { reference100, replayEndermanWolf, firstDivergence } from "./enderman-wolf-replay.js";

const rose = fightReference100.records;
const roseLast = (r) => r.rows.reduce((last, x, t) => (x[9][0]?.[0] > 0 ? t : last), -1);
test("mobrec100 rose: 8 executed golem records, the rose is held until the child takes it (Executed)", () => {
  assert.equal(rose.length, 8);
  const by = Object.fromEntries(rose.map((r) => [r.name, roseLast(r)]));
  assert.equal(by["b100-rose-child-10001"], 283);
  assert.equal(by["b100-rose-child-10002"], 220);
  assert.equal(by["b100-rose-child-10003"], 135);
  assert.equal(by["b100-rose-dusk-10006"], 59);
  assert.equal(by["b100-rose-adults-10004"], 398); // adults never take it: the 400-tick timer runs out (holdRoseTick 400 -> 0)
  assert.equal(by["b100-rose-far-10007"], 398); // out of the (6, 2, 6) box
  assert.equal(by["b100-rose-night-10008"], -1); // LookAtVillager only rolls in daylight
});
for (const r of rose) {
  test(`mobrec100 rose: ${r.name} replays with no divergence`, () => {
    assert.equal(JSON.stringify(fightDivergence(r, replayFight(r))), "null", r.name);
  });
}

const recs = reference100.records;
test("mobrec100: the b100 references hold 17 witch and 4 bat executed records", () => {
  assert.equal(recs.filter((r) => /witch100/.test(r.name)).length, 17);
  assert.equal(recs.filter((r) => /bat100/.test(r.name)).length, 4);
  assert.ok(reference100.classes.we && reference100.classes.yp);
});
for (const r of recs) {
  test(`mobrec100: ${r.name} replays with no divergence`, () => {
    assert.equal(JSON.stringify(firstDivergence(r, replayEndermanWolf(r))), "null", r.name);
  });
}
test("mobrec100 bat: a bat under water splashes at the next tick's own handleWaterMovement, not inside its move (Executed b97mr-bat100-water-ceiling-10083 tick 30, Bytecode-read we.a(double, boolean) is empty)", () => {
  const r = recs.find((x) => x.name === "b97mr-bat100-water-ceiling-10083");
  const splash = r.rows.findIndex((x) => x[1].some((s) => s.startsWith("game.neutral.swim.splash")));
  assert.equal(splash, 30);
  const got = replayEndermanWolf(r);
  const has = (t) => JSON.stringify(got.states[t][1]).includes("game.neutral.swim.splash");
  assert.equal(has(splash), true);
  assert.equal(has(splash - 1), false); // the port used to splash a tick early
  assert.match(readFileSync(new URL("./entities.js", import.meta.url), "utf8"), /e\.type === "bat" \|\| e\.inWater !== false/);
});
