import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { replayEndermanWolf, reference49 as reference, firstDivergence } from "./enderman-wolf-replay.js";

// enderman-wolf-b49po-reference.json: EndermanWolfProbe, set b49po (EW_SET=b49po), executed on the unchanged obfuscated 1.7.10 jar: the b48pp piston harness with mobs standing
// on a moved block and large mobs (spider, size 4 slime, iron golem). The tile loop runs after every entity (World.updateEntities: global entities, regular entities, then
// blockEntities, bytecode-read in ahb).
test("b49po reference covers riders on moved blocks and large mobs", () => {
  assert.equal(reference.records.length, 12);
  for (const k of ["cow-ride-east", "cow-ride-up", "zombie-ride", "ride-retract", "spider-east", "spider-wall", "slime-east", "slime-lift", "golem-east", "golem-wall", "golem-ride", "spider-ceiling"]) {
    assert.ok(reference.records.some((r) => r.name.includes(k)), k);
  }
});
for (const r of reference.records) {
  test(`piston order b49: ${r.name} replays with no divergence`, () => {
    assert.equal(firstDivergence(r, replayEndermanWolf(r)), null, r.name);
  });
}

// The live game defers the tile-entity loop so it runs after the entity walk (main.js hook; the away run already ticks entities first).
test("the live tick runs the piston tile loop from the entity walk's afterEntities hook", () => {
  const rt = readFileSync(new URL("./redstone-runtime.js", import.meta.url), "utf8");
  assert.match(rt, /const tickEnd = \(deferTiles = false\)/);
  assert.match(rt, /const tickTiles = \(\)/);
  const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(main, /mobs\.afterEntities = \(\) => redstoneRuntime\?\.tickTiles\(\)/);
  assert.match(main, /deferTiles: true/);
  const away = readFileSync(new URL("./away-world.js", import.meta.url), "utf8");
  assert.ok(away.indexOf("ents.tick()") < away.indexOf("live.updateTileEntities()"));
});
