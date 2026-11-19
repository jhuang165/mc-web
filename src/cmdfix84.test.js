// Batch 84 cmdfix84: /setblock pot, sign and jukebox follow-ups, and the Fire short on the records that gained it.
import test from "node:test";
import assert from "node:assert/strict";
import { World, RED_FLOWER } from "./world.js";
import { Survival } from "./survival.js";
import { createCommandHost } from "./command-host.js";
import { createCommandRunner } from "./commands.js";
import { Signs } from "./signs.js";
import { potContents, EMPTY_POT, validPotRecord } from "./stone-utility.js";
import { Hanging } from "./hanging.js";
import { FallingBlocks } from "./falling.js";

const game = () => {
  const world = new World("cmdfix84", "meadow", 1), survival = new Survival({}, "creative"), lines = [], ejected = [];
  for (let x = 4; x < 10; x++) for (let z = 4; z < 10; z++) { world.set(x, 59, z, 3); world.set(x, 60, z, 0); }
  const signs = new Signs();
  const music = { jukeboxes: { tile: () => ({ record: null }), eject: (x, y, z) => ejected.push([x, y, z]) } };
  const env = { world: () => world, survival: () => survival, active: () => ({ mode: "creative", allowCommands: true }), position: () => ({ x: 5.5, y: 60, z: 5.5 }),
    changed() {}, refreshInventory() {}, updateBlock() {}, destroyBlock(x, y, z) { world.set(x, y, z, 0); }, stackName: () => "s",
    signs: () => signs, music: () => music, dropStacks() {} };
  const host = createCommandHost(env); host.print = (t) => lines.push(t);
  const runner = createCommandRunner(host);
  return { world, signs, ejected, run(s) { lines.length = 0; runner.run(s); return [...lines]; } };
};

test("an explicitly empty pot ({Item:0}) with a plant meta stays empty; an untagged one shows the meta's plant", () => {
  const g = game();
  g.run("/setblock 5 60 5 flower_pot 1");
  assert.equal(potContents(g.world, 5, 60, 5)?.id, RED_FLOWER, "meta 1: BlockFlowerPot.createNewTileEntity's poppy");
  g.run("/setblock 6 60 5 flower_pot 1 replace {Item:0}");
  assert.equal(potContents(g.world, 6, 60, 5), null);
  assert.ok(g.world.pots.get("6,60,5").empty);
  assert.ok(validPotRecord(EMPTY_POT));
});

test("/setblock without a tag makes a fresh sign when only the meta changes", () => {
  const g = game();
  g.run('/setblock 5 60 5 standing_sign 4 replace {Text1:"hello"}');
  g.run("/setblock 5 60 5 standing_sign 5");
  assert.deepEqual(g.signs.tile(5, 60, 5).text, ["", "", "", ""]);
  assert.equal(g.signs.tile(5, 60, 5).editable, true);
});

test("/setblock over a jukebox ejects its record first (BlockJukebox.breakBlock)", () => {
  const g = game();
  g.run("/setblock 7 60 5 jukebox 0");
  g.run("/setblock 7 60 5 stone");
  assert.deepEqual(g.ejected, [[7, 60, 5]]);
});

test("Fire survives the hanging record and the fireball record", () => {
  const h = new Hanging(), e = h.make("painting", 0, 5, 60, 5, { art: 0 }); e.fire = -20; h.entities.push(e);
  const h2 = new Hanging().load(JSON.parse(JSON.stringify(h.toJSON())));
  assert.equal(h2.entities[0].fire, -20);
  const f = new FallingBlocks(new World("cmdfix84f", "meadow", 1));
  f.restoreEntity({ block: 12, meta: 0, x: 1, y: 70, z: 1, vx: 0, vy: 0, vz: 0, ticks: 1, fire: -5 });
  assert.equal(f.serialize()[0].fire, -5);
});
