import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { replayEndermanWolf, reference50 as reference, reference46, firstDivergence } from "./enderman-wolf-replay.js";
import { LEGACY_BODY, LEGACY_MOVE } from "./entities.js";

// enderman-wolf-b50lb-reference.json: EndermanWolfProbe, set b50lb (EW_SET=b50lb), executed on the unchanged obfuscated 1.7.10 jar: the b49po piston harness with a silverfish, giant,
// zombie pigman and blaze (EntityLiving.isAIEnabled, sw.bk, false) and a witch and a creeper (bk true) pushed east, north, into a wall and by a retracting block. Each row carries the mob's
// renderYawOffset (element 8, index 6 of the mob's motion block, as the replay's bodyYaw) and rotationYawHead (headYaw) per tick. The ghast is bytecode-read only: in this harness its flight
// degenerates (the probe world never lets it start a course), so it has no record.
test("b50lb covers every mob newly in the legacy table plus AI-enabled controls", () => {
  assert.equal(reference.records.length, 23);
  for (const k of ["giant", "pigman", "blaze", "witch", "creeper"]) assert.equal(reference.records.filter((r) => r.name.includes(k)).length, 4, k);
  assert.equal(reference.records.filter((r) => r.name.includes("silverfish")).length, 3); // no retract case: the silverfish suffocates in the block
});
test("the pushes turn the body: a legacy mob's renderYawOffset differs from its rotationYaw somewhere", () => {
  const rec = reference.records.find((r) => r.name.includes("silverfish-east"));
  assert.ok(rec.rows.some((row) => Math.abs(row[0][0][8][6]) > 1), "renderYawOffset moved");
});
for (const r of reference.records) {
  test(`legacy body b50: ${r.name} replays with no divergence`, () => {
    assert.equal(firstDivergence(r, replayEndermanWolf(r)), null, r.name);
  });
}

// The per-type table is the set of mobs whose isAIEnabled (sw.bk) is false, bytecode-read over every class extending EntityLiving (sw): only sw itself, EntityPigZombie (yh) and the
// classes below inherit false; the rest return true (chicken, cow, horse, ocelot, pig, sheep, snow golem, iron golem, wolf, wither, creeper, skeleton, witch, zombie, villager, bat).
test("LEGACY_BODY holds every non-AI mob that runs the generic turn", () => {
  for (const t of ["enderman", "spider", "cave_spider", "slime", "magma_cube", "silverfish", "giant", "pigman", "blaze", "ghast"]) assert.ok(LEGACY_BODY.has(t), t);
  for (const t of ["zombie", "witch", "creeper", "skeleton", "villager", "iron_golem", "snow_golem", "wolf", "ocelot", "cow", "pig", "sheep", "chicken", "horse", "wither", "bat"]) assert.ok(!LEGACY_BODY.has(t), t);
  for (const t of LEGACY_MOVE) assert.ok(LEGACY_BODY.has(t), t + " is in LEGACY_MOVE");
});

// b46mp regenerated under the b47 harness (client position, C03 packets, ticksExisted counted by the world tick): the replay needs no timestamp or sent-packet workaround.
test("the regenerated b46mp reference carries the b47 row elements", () => {
  assert.equal(reference46.records.length, 19);
  assert.ok(reference46.records.every((r) => r.rows[0][8] !== undefined));
  const replay = readFileSync(new URL("./enderman-wolf-replay.js", import.meta.url), "utf8");
  assert.doesNotMatch(replay, /hurtByTime = ew\.ai\.clock \+ 1/);
});

// Ghast (yd): bk is false, the action state sets rotationYaw, renderYawOffset and rotationYawHead to the same yaw (blaze-ghast-mobs.js), then the legacy turn of sv.f eases the body toward the travel direction.
test("a moving ghast takes the legacy body turn, not the body helper", async () => {
  const { EntityWorld } = await import("./entities.js");
  const ew = Object.create(EntityWorld.prototype);
  const ghast = () => ({ type: "ghast", x: 1, z: 0, px: 0, pz: 0, rotationYaw: 0, prevRotationYaw: 0, renderYawOffset: 0, prevRenderYawOffset: 0, rotationYawHead: 0, prevRotationYawHead: 0, rotationPitch: 0, prevRotationPitch: 0, bodyHeadYaw: 0, bodyTicks: 0 });
  const g = ghast();
  ew.turnBody(g);
  assert.ok(Math.abs(g.renderYawOffset + 27) < 1e-4); // travel east is yaw -90; 0.3 of the way from 0
  const helper = { ...ghast(), type: "zombie" };
  ew.turnBody(helper);
  assert.equal(helper.renderYawOffset, 0); // the AI body helper sets renderYawOffset = rotationYaw while moving
});
