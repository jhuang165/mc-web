// Batch 91 spcopy91: readers of `ai.player` (ai.js PlayerView) after the copy `left` the world (ServerConfigurationManager.transferPlayerToDimension -> mt.f(sa) ->
// World.removePlayerEntityDangerously: out of playerEntities). Bytecode-read in b89 (oi.a(mw,int)); the readers here are port-read. Nothing here is a browser check.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { EntityWorld } from "./entities.js";

const flat = () => {
  const world = new World("spcopy91");
  for (let x = 0; x <= 60; x++) for (let z = 0; z <= 60; z++) for (let y = 0; y <= 8; y++) world.put(x, y, z, y === 0 ? 1 : 0, 0, false);
  return world;
};
const mk = (extra = []) => new EntityWorld(flat(), extra, () => 0.5);
const src = (f) => readFileSync(new URL(f, import.meta.url), "utf8");

test("a copy that left reads as not alive, and alive again when the trip fails", () => {
  const w = mk(), p = w.ai.player;
  assert.equal(p.alive, true);
  p.left = true;
  assert.equal(p.alive, false);
  p.alive = true; // the setter still works while left
  p.left = false;
  assert.equal(p.alive, true);
});

test("a zombie far from the copy does not despawn while the copy has left (no closest player)", () => {
  const w = mk([{ id: "z1", type: "zombie", x: 5.5, y: 1, z: 5.5, health: 20 }]);
  const e = w.entities[0], p = w.ai.player;
  Object.assign(p, { x: 500, y: 1, z: 500 });
  let gone = 0;
  w.ai.deps.despawn = () => { gone++; };
  p.left = true;
  w.ai.brain(e).despawnEntity();
  assert.equal(gone, 0);
  p.left = false;
  w.ai.brain(e).despawnEntity();
  assert.equal(gone, 1, "present again: beyond 128 blocks it despawns");
});

test("a tamed wolf has no owner while the copy is out of the world", () => {
  const w = mk([{ id: "w1", type: "wolf", x: 5.5, y: 1, z: 5.5, health: 20, tame: true, owner: "Player" }]);
  const e = w.entities[0], b = w.ai.brain(e);
  assert.ok(b.owner?.(), "owner found while present");
  w.ai.player.left = true;
  assert.equal(b.owner(), null);
});

test("every other reader is gated on left", () => {
  assert.match(src("./entities.js"), /siegePlayers\(\) \{ return this\.ai\.player && !this\.ai\.player\.left/);
  assert.match(src("./villager.js"), /!p \|\| p\.left\) return false/);
  assert.match(src("./villager.js"), /player\?\.left \? null/);
  assert.match(src("./horse-gear-live.js"), /absent \|\| this\.ai\?\.player\?\.left\)\) return/);
  assert.match(src("./explosion-simulation.js"), /serverPlayer\?\.left \? null/);
  assert.match(src("./structure-simulation.js"), /player\?\.left \? null/);
  assert.match(src("./living-simulation.js"), /player\?\.left \? null/);
  const main = src("./main.js");
  assert.match(main, /survival\.health > 0 && !dims\.busy \? \{ x: position\.x/);
  assert.match(main, /players: dims\.busy \? \[\] : \[\{/);
});
