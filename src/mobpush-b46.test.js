import test from "node:test";
import assert from "node:assert/strict";
import { pushClientPlayer } from "./client-push.js";
import { replayEndermanWolf, reference46 as reference, firstDivergence } from "./enderman-wolf-replay.js";

// enderman-wolf-b46mp-reference.json: the EndermanWolfProbe with the b46mp- scenarios (tools/verify-endermanwolf.mjs, EW_SET=b46mp) on the unchanged obfuscated classes.
// The probe also runs EntityPlayerMP.onUpdateEntity (mw.i) on its real player after the mobs each tick and puts the server copy back at the client's place afterwards
// (a position packet), so the player's motion is what mobs, hits and its own friction left it. Every tick is compared with every Entity.rand draw and the player's motion (x, z).
test("mob push reference covers cows, pigs, a zombie and witches", () => {
  assert.ok(reference.records.length >= 10);
  assert.ok(reference.records.some((r) => r.name.includes("witch")) && reference.records.some((r) => r.name.includes("cow")));
  assert.ok(reference.records.some((r) => r.rows.some((w) => w[5][3][0] !== 0 || w[5][3][2] !== 0)), "the player is pushed somewhere");
});
for (const r of reference.records) {
  test(`mob push b46: ${r.name} replays with no divergence`, () => {
    assert.equal(firstDivergence(r, replayEndermanWolf(r)), null, r.name);
  });
}

// The client player's own push (client-push.js, bytecode-read of sv.bo / sa.g / sa.S / yz.e; no executed record: the probe's player is an EntityPlayerMP).
const cow = (x, z) => ({ type: "cow", x, y: 64, z, health: 10 });
const field = (...entities) => ({ entities, size: () => [0.9, 1.3] });
const stand = (x, z) => ({ x, y: 64, z, width: 0.6, height: 1.8 });
test("a player standing in a cow drifts out by the native 0.05 / sqrt(d) per tick", () => {
  const v = { x: 0, z: 0 }, d = 0.3, k = Math.fround(Math.sqrt(d));
  pushClientPlayer(field(cow(0, 0)), stand(d, 0), v);
  assert.equal(v.x, (d / k) * Math.min(1, 1 / k) * 0.05000000074505806);
  assert.equal(v.z, 0);
  assert.ok(Math.abs(v.x - 0.0274) < 1e-3);
});
test("the push reaches 0.2 beyond the boxes and not further", () => {
  const near = { x: 0, z: 0 };
  const a = { x: 0, z: 0 }; pushClientPlayer(field(cow(0, 0)), stand(0.9, 0), a); // gap 0.15 < 0.2: pushed
  const b = { x: 0, z: 0 }; pushClientPlayer(field(cow(0, 0)), stand(1.1, 0), b); // gap 0.35: not pushed
  assert.ok(a.x > 0);
  assert.equal(b.x, 0);
  assert.deepEqual(near, { x: 0, z: 0 });
});
test("a client copy's position stands in for the live mob; creative is pushed; a rider, the dead and a bat are not", () => {
  const live = cow(10, 10), mobs = field(live);
  mobs.tracker = { clientIfTracked: () => ({ x: 0, y: 64, z: 0 }) };
  const v = { x: 0, z: 0 };
  pushClientPlayer(mobs, stand(0.3, 0), v);
  assert.ok(v.x > 0, "the copy at the player's place pushes, not the far live mob");
  const r = { x: 0, z: 0 };
  pushClientPlayer(field(cow(0, 0)), { ...stand(0.3, 0), riding: true }, r);
  pushClientPlayer(field(cow(0, 0)), { ...stand(0.3, 0), dead: true }, r);
  pushClientPlayer(field({ ...cow(0, 0), type: "bat" }), stand(0.3, 0), r);
  pushClientPlayer(field({ ...cow(0, 0), health: 0, death: 20 }), stand(0.3, 0), r);
  assert.deepEqual(r, { x: 0, z: 0 });
});
