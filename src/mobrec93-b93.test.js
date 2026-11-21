// Batch 93 mobrec93: executed mob records on the unchanged 1.7.10 classes.
//  - tools/probes/EndermanWolfProbe.java set b93mr (EndermanWolfScenarios.run93 and the sc88 lines after it; `EW_SET=b93mr node tools/verify-endermanwolf.mjs` ->
//    public/research/enderman-wolf-b93mr-reference.json (squid, bat) and enderman-wolf-b93mr-wither-reference.json (wither skeleton, wither, pigman, giant)).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reference93, replayEndermanWolf, firstDivergence } from "./enderman-wolf-replay.js";
import { mobDrops } from "./combat.js";
import { soundType } from "./spider.js";
import { JavaRandom } from "./lighting.js";

const recs = reference93.records, by = (s) => recs.find((r) => r.name.includes(s));
const src = (f) => readFileSync(new URL(f, import.meta.url), "utf8");

test("mobrec93: the b93mr references hold 32 executed records (squid, bat, wither skeleton, wither, pigman, giant)", () => {
  assert.equal(recs.length, 32);
  assert.match(reference93.method, /Batch 93/);
  for (const k of ["squid", "bat", "wskel", "wither", "pigman", "giant"]) assert.ok(recs.some((r) => r.name.includes(`-${k}-`)), k);
});
for (const r of recs) {
  test(`mobrec93: ${r.name} replays with no divergence`, () => {
    assert.equal(JSON.stringify(firstDivergence(r, replayEndermanWolf(r))), "null", r.name);
  });
}
test("mobrec93: firstDivergence catches a changed row", () => {
  const r = by("wither-spawn"), bad = structuredClone(r);
  bad.rows[30][0][0][0] += 1e-9;
  assert.notEqual(JSON.stringify(firstDivergence(bad, replayEndermanWolf(r))), "null");
});

test("mobrec93 hurt window: the player's second hit still reaches attackEntityFrom, so a pigman re-rolls its anger delay (Executed pigman-hit-9541)", () => {
  assert.match(src("./entities.js"), /const landed = this\.damage\(e, damage, player\.x, player\.z, true, null/);
});
test("mobrec93 wither skeleton: coal and bone are this build's ids (301, 311), not 263 / 352", () => {
  const seen = new Set();
  for (let seed = 0; seed < 60; seed++) for (const [id] of mobDrops({ type: "wither_skeleton" }, { playerHit: true }, new JavaRandom(seed))) seen.add(id);
  assert.ok(seen.size > 0);
  for (const id of seen) assert.ok(id === 301 || id === 311 || id === 2050, `id ${id}`); // 2050: the rare Wither Skeleton Skull
  assert.ok(!seen.has(263) && !seen.has(352));
});
test("mobrec93 wither skeleton: mob.skeleton.* sounds and the sunburn draw (Executed wskel-day, wskel-fight)", () => {
  assert.equal(soundType("wither_skeleton"), "skeleton");
  assert.match(src("./entities.js"), /e\.type === "skeleton" \|\| e\.type === "wither_skeleton"\) && this\.day/);
});
test("mobrec93 wither: no despawn roll, tasks tick offset, corpse candidates and the d2f yaw (Executed wither-far, -spawn, -cow)", () => {
  assert.match(src("./ai.js"), /if \(e\.type === "wither"\) \{ e\.idle = 0; return; \}/);
  assert.match(src("./wither-boss-mobs.js"), /e\.aiSkipped = \(e\.aiSkipped \|\| 0\) \+ 1/);
  assert.match(src("./wither-boss-mobs.js"), /o !== e && !witherIsUndead\(o\) && brain\.ai\.overlaps/);
  assert.match(src("./wither-boss.js"), /f\(f\(f\(Math\.atan2\(e\.vz, e\.vx\)\) \* f\(57\.295776\)\) - 90\)/);
});
test("mobrec93 squid and bat: corpse tails, head yaw, stale box, null-sound events (Executed squid-dry, squid-swim, bat-hit, bat-kill, squid-hit)", () => {
  const sq = src("./squid-bat-mobs.js");
  assert.match(sq, /if \(e\.health <= 0\) \{ squidCorpse\(m, e, t\); return; \}/);
  assert.match(sq, /e\.rotationYawHead = e\.rotationYaw;/);
  assert.match(sq, /s\.hangY !== undefined && e\.y === s\.hangY/);
  assert.match(src("./entities.js"), /\(hurtOf\(e\) \|\| e\.type !== "squid"\)/);
  assert.match(sq, /"sound" in list\[i\] && !list\[i\]\.sound/);
  assert.match(src("./corpse-living.js"), /else if \(e\.type === "bat"\) batUpdate\(e\)/);
});
