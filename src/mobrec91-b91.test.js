// Batch 91 mobrec91: executed mob records on the unchanged 1.7.10 classes.
//  - tools/probes/EndermanWolfProbe.java set b91mr (EndermanWolfScenarios.run91, `EW_SET=b91mr node tools/verify-endermanwolf.mjs` -> public/research/enderman-wolf-b91mr-reference.json):
//    the b90mr harness (row element 11 = the world Random's draw count) with dead probe players (flight, spider, silverfish, giant, zombie), slime / magma cube fights,
//    and an iron golem against a slime, magma cube, silverfish, witch, pigman and giant.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reference91, replayEndermanWolf, firstDivergence } from "./enderman-wolf-replay.js";

const recs = reference91.records, by = (s) => recs.find((r) => r.name.includes(s));
const src = (f) => readFileSync(new URL(f, import.meta.url), "utf8");

test("mobrec91: the b91mr reference holds 22 executed records with the world random draw count", () => {
  assert.equal(recs.length, 22);
  assert.match(reference91.method, /Batch 91/);
  for (const r of recs) assert.ok(r.rows.every((row) => Array.isArray(row[11]) && row[11].length === 1), r.name);
});
for (const r of recs) {
  test(`mobrec91: ${r.name} replays with no divergence`, () => {
    assert.equal(JSON.stringify(firstDivergence(r, replayEndermanWolf(r))), "null", r.name);
  });
}
test("mobrec91: firstDivergence catches a changed world random count", () => {
  const r = by("dead-zombie-9151"), bad = structuredClone(r); bad.rows[100][11][0] += 1;
  assert.deepEqual(firstDivergence(bad, replayEndermanWolf(r)).slice(0, 2), [100, "world random draws"]);
});

test("mobrec91 dead server copy: EntityPlayerMP.onUpdateEntity keeps moving a player whose health is 0 until it is removed (Executed, Bytecode-read nh.a(jd) tests no isDead)", () => {
  const r = by("dead-flight-9101"), dead = r.rows.findIndex((row) => row[10][1][0] <= 0); // row[10][1][0]: the probe player's health, row[5][3]: the copy's motion
  assert.ok(dead > 0, "the player dies");
  const ys = r.rows.slice(dead, dead + 15).map((row) => JSON.stringify(row[5][3]));
  assert.ok(new Set(ys).size > 3, "the copy's motion keeps changing after the death");
  const s = src("./entities.js");
  assert.match(s, /if \(p && !p\.unticked && !p\.left\)/);
  assert.doesNotMatch(s, /if \(p && p\.alive && !p\.unticked/);
  assert.match(src("./ai.js"), /get inWorld\(\)/);
});

test("mobrec91 legacy closest player: World.getClosestPlayer has no alive test, the look target ends on Entity.isDead (Executed dead-spider / dead-silverfish / dead-giant, Bytecode-read ahb)", () => {
  for (const f of ["./entities.js", "./legacy-creature.js"]) {
    const s = src(f);
    assert.match(s, /lookGone/, f);
    assert.match(s, /deadTicks \?\? 0\) > 20/, f);
  }
  for (const n of ["dead-spider-9111", "dead-silverfish-9124", "dead-giant-9131"]) assert.ok(by(n), n);
});

test("mobrec91 aux sounds: the wither and the zombie door draw their level event pitch on the client world's Random, not the server's (Executed row 11 untouched, Bytecode-read bma.a)", () => {
  assert.match(src("./wither-boss-mobs.js"), /clientAuxRandom \?\?= new JavaRandom/);
  assert.match(src("./zombie-door.js"), /clientAuxRandom/);
});

test("mobrec91 slime: the contact hit is EntityPlayer.collideWithPlayer in the copy's tick, after its move and pushes: the record's knockback is the raw end of the tick (Executed slime-fight-9201)", () => {
  const r = by("slime-fight-9201"), t = r.rows.findIndex((row) => row[1].some((s) => s.startsWith("mob.attack")));
  assert.ok(t > 0);
  assert.ok(Math.abs(r.rows[t][5][3][1] - 0.3608) < 1e-3, "vy = 0.4 + (-0.0784 / 2), no gravity applied after the hit");
  assert.match(src("./entities.js"), /slimeTouch\(o, p, at\)/);
});

test("mobrec91 slime: the hurt volume is 0.4 * size, the head yaw follows the yaw, faceEntity takes a float square root (Executed)", () => {
  const s = src("./entities.js");
  assert.match(s, /sound = \{ volume: volumeOf\(e\), position: e \}/);
  assert.match(s, /e\.rotationYawHead = e\.rotationYaw/);
  assert.match(src("./slime.js"), /f\(Math\.sqrt\(dx \* dx \+ dz \* dz\)\)/);
});

test("mobrec91 mob self-target (batch 90 rule): EntityAITarget.isSuitableTarget refuses a null target and the task owner itself (Bytecode-read vu.a offsets 0-24)", () => {
  // the records where mobs fight each other (iron golem vs silverfish, witch, pigman, giant) replay with no divergence above; the guard itself is in ai.js
  assert.match(src("./ai.js"), /if \(!t \|\| t === this\.m \|\| !t\.alive\) return false/); // vu.a: aload_1 ifnonnull, aload_1 == this.c (taskOwner) -> false, then sv.Z (isEntityAlive)
});
