import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lightOpacity, lightEmission } from "./lighting.js";
import { internalIdsFor } from "./block-registry.js";

// Replays public/research/block-light-reference.json (tools/probes/BlockLightProbe.java: Block.lightValue and Block.lightOpacity of every
// registered 1.7.10 block id 0-255) against the port's light tables, for every internal id that represents the original id.
const ref = JSON.parse(readFileSync(new URL("../public/research/block-light-reference.json", import.meta.url))).records;
// States the port keeps outside the block id: the lit furnace (original 62) and the powered repeater (original 94).
const LIT_STATE = new Set([62, 94]);

test("block light: lightValue and lightOpacity of every original block match the port tables", () => {
  const bad = [];
  let checked = 0;
  for (const r of ref) {
    for (const i of internalIdsFor(r.id)) {
      checked++;
      const e = lightEmission(i, LIT_STATE.has(r.id));
      if (e !== r.lightValue) bad.push(`emission ${r.id} (internal ${i}): port ${e} native ${r.lightValue}`);
      const o = lightOpacity(i);
      if (o !== r.lightOpacity) bad.push(`opacity ${r.id} (internal ${i}): port ${o} native ${r.lightOpacity}`);
    }
  }
  assert.ok(checked > 150);
  assert.deepEqual(bad, []);
});

test("block light: the unpowered repeater and unlit furnace do not emit", () => {
  assert.equal(lightEmission(internalIdsFor(93)[0], false), 0);
  assert.equal(lightEmission(internalIdsFor(94)[0], true), 9);
  assert.equal(lightEmission(internalIdsFor(62)[0], false), 0);
  assert.equal(lightEmission(internalIdsFor(62)[0], true), 13);
});

test("block light: a powered repeater lights its cell to 9 through a LightVolume emission callback, an unpowered one does not", async () => {
  const { LightVolume } = await import("./lighting.js");
  const { SIZE, HEIGHT, REPEATER } = await import("./world.js");
  const data = new Uint8Array(SIZE * SIZE * HEIGHT); // a flat world: stone below y = 10, air above
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) for (let y = 0; y < 10; y++) data[(x * SIZE + z) * HEIGHT + y] = 3;
  const w = { get: (x, y, z) => (x < 0 || z < 0 || y < 0 || x >= SIZE || z >= SIZE || y >= HEIGHT ? 0 : data[(x * SIZE + z) * HEIGHT + y]) };
  const at = [40, 10, 40];
  data[(at[0] * SIZE + at[2]) * HEIGHT + at[1]] = REPEATER;
  const lit = new Set();
  const light = new LightVolume(w, (x, y, z, b) => lightEmission(b, lit.has(`${x},${y},${z}`)));
  assert.equal(light.blockAt(...at), 0);
  lit.add(at.join(","));
  light.update(...at);
  assert.equal(light.blockAt(...at), 9);
  assert.equal(light.blockAt(at[0] + 1, at[1], at[2]), 8);
  lit.clear();
  light.update(...at);
  assert.equal(light.blockAt(...at), 0);
});
