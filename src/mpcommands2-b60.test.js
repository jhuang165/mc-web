// Batch 60 mpcommands2: server-side achievement triggers (crafting, smelting, thrown diamonds, mob kills, biomes) on the dedicated simulation.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial, chatDisplay } from "./server-broadcast.js";
import { makeStack } from "./inventory.js";
import { ITEM } from "./achievements-live.js";
import { langReady } from "./chat-component.js";

await langReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
function fixture() {
  const world = new World("b60");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: false }), inbox = {};
  const social = new ServerSocial({ simulation: sim, deliver: (id, m) => (inbox[id] ??= []).push(m) });
  const join = (id, name, n) => { const p = sim.addPlayer(id, name, key(n)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); return p; };
  const lines = () => Object.values(inbox).flat().filter((m) => m.type === "chat").map((m) => chatDisplay(m).unformatted());
  const unlock = (id, ...ids) => ids.forEach((a) => social.achievementsOf(id).trigger(a));
  return { sim, social, join, lines, inbox, unlock };
}
const CHAIN = ["openInventory", "mineWood", "buildWorkBench", "buildPickaxe", "buildFurnace", "acquireIron", "diamonds"];

test("onCrafted awards the crafting achievements and the first unlock is announced to everyone", () => {
  const f = fixture(), a = f.join("a", "Alex", 1); f.join("b", "Bob", 2);
  f.unlock("a", "openInventory", "mineWood");
  assert.equal(f.sim.achievements.onCrafted(a, makeStack(ITEM.craftingTable, 1)), "buildWorkBench");
  assert.equal(f.sim.achievements.onCrafted(a, makeStack(1, 1)), null);
  f.social.drain(); f.social.drain();
  assert.deepEqual(f.lines().filter((l) => /Benchmarking/.test(l)), ["Alex has just earned the achievement [Benchmarking]", "Alex has just earned the achievement [Benchmarking]"]); // one line per player
  assert.ok(f.sim.players.get("a").achievementsSaved.unlocked.includes("buildWorkBench"));
  f.sim.achievements.onCrafted(a, makeStack(ITEM.craftingTable, 1)); f.social.drain();
  assert.equal(f.lines().filter((l) => /Benchmarking/.test(l)).length, 2, "a repeat is silent");
});

test("a locked parent keeps a crafted achievement silent", () => {
  const f = fixture(), a = f.join("a", "Alex", 1);
  f.sim.achievements.onCrafted(a, makeStack(ITEM.craftingTable, 1)); f.social.drain();
  assert.equal(f.lines().length, 0);
  assert.equal(f.social.achievementsOf("a").has("buildWorkBench"), false);
});

test("the furnace window awards acquireIron and cookFish when the output is taken", () => {
  const f = fixture(), a = f.join("a", "Alex", 1);
  f.unlock("a", "openInventory", "mineWood", "buildWorkBench", "buildPickaxe", "buildFurnace");
  f.sim.world.set(64, 11, 62, 14);
  assert.equal(f.sim.containers.use(a, 64, 11, 62, 14, true), true);
  const c = a.window.container;
  f.sim.tiles.furnaces["64,11,62"].items[2] = makeStack(ITEM.iron, 2);
  c.click(2, 0, 0);
  f.social.drain();
  assert.equal(f.social.achievementsOf("a").has("acquireIron"), true);
  assert.equal(f.social.achievementsOf("a").has("cookFish"), false);
  f.sim.tiles.furnaces["64,11,62"].items[2] = makeStack(ITEM.cookedFish, 1);
  a.survival.inventory.cursor = null; c.click(2, 0, 0); f.social.drain();
  assert.equal(f.social.achievementsOf("a").has("cookFish"), true);
});

test("Q drop: the item carries the thrower, a diamond picked up by another player awards diamondsToYou to the thrower", () => {
  const f = fixture(), a = f.join("a", "Alex", 1), b = f.join("b", "Bob", 2);
  f.unlock("a", ...CHAIN);
  a.survival.inventory.main[0] = makeStack(ITEM.diamond, 3); a.survival.inventory.current = 0;
  const e = f.sim.dropHeld("a", false);
  assert.equal(e.thrower, "Alex");
  assert.equal(a.survival.inventory.main[0].count, 2);
  assert.equal(f.sim.items.serialize()[0].thrower, "Alex");
  // the thrower's own pickup does nothing
  e.delay = 0;
  assert.equal(f.sim.pickup("a", [e.eid]), true); f.social.drain();
  assert.equal(f.social.achievementsOf("a").has("diamondsToYou"), false);
  // another player's pickup (a second throw, so the stack is whole)
  const e2 = f.sim.dropHeld("a", true); e2.delay = 0;
  assert.equal(f.sim.pickup("b", [e2.eid]), true); f.social.drain();
  assert.equal(f.social.achievementsOf("a").has("diamondsToYou"), true);
  assert.equal(f.social.achievementsOf("b").has("diamondsToYou"), false);
  assert.ok(f.lines().some((l) => /Alex has just earned the achievement \[Diamonds to you!\]/.test(l)));
});

test("only a Q drop sets the thrower: container-close and death drops do not", () => {
  const f = fixture(), a = f.join("a", "Alex", 1);
  const e = f.sim.items.dropPlayer(makeStack(ITEM.diamond, 1), a.position, 0, 0); // the container close / click outside path (yz.a(add, boolean))
  assert.equal(e.thrower, undefined);
});

test("the thrower survives a save and load; a thrown non-diamond awards nothing", () => {
  const f = fixture(), a = f.join("a", "Alex", 1); f.join("b", "Bob", 2);
  a.survival.inventory.main[0] = makeStack(ITEM.iron, 1); a.survival.inventory.current = 0;
  const e = f.sim.dropHeld("a", true);
  const again = new DedicatedSimulation(JSON.parse(JSON.stringify(f.sim.save())), { world: f.sim.world, gameMode: "survival", mobs: false });
  assert.equal(again.items.items[0].thrower, "Alex");
  e.delay = 0; f.sim.pickup("b", [e.eid]); f.social.drain();
  assert.equal(f.social.achievementsOf("a").has("diamondsToYou"), false);
});

test("a dropped diamond whose thrower left the server awards nobody", () => {
  const f = fixture(), a = f.join("a", "Alex", 1); f.join("b", "Bob", 2);
  a.survival.inventory.main[0] = makeStack(ITEM.diamond, 1); a.survival.inventory.current = 0;
  const e = f.sim.dropHeld("a", true); e.delay = 0;
  f.sim.removePlayer("a");
  f.sim.pickup("b", [e.eid]); f.social.drain();
  assert.equal(f.lines().length, 0);
});

test("a sword hit that kills a zombie awards killEnemy to the attacker only", () => {
  const f = fixture(), sim = f.sim, a = f.join("a", "Alex", 1), b = f.join("b", "Bob", 2);
  const m = sim.mobs; // fixture() built the simulation without mobs; build one with them
  const world = sim.world, s2 = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: true }), inbox = [];
  const social = new ServerSocial({ simulation: s2, deliver: () => inbox.push(1) });
  const pa = s2.addPlayer("a", "Alex", key(1)), pb = s2.addPlayer("b", "Bob", key(2));
  for (const p of [pa, pb]) { p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); }
  for (const id of ["a", "b"]) for (const t of ["openInventory", "mineWood", "buildWorkBench", "buildSword"]) social.achievementsOf(id).trigger(t);
  s2.mobs.spawning = false; s2.mobs.mobs.entities.length = 0;
  const z = s2.mobs.mobs.create("zombie", 66.5, 10, 64.5); s2.mobs.mobs.entities.push(z);
  pa.survival.inventory.main[0] = makeStack(115, 1); pa.survival.inventory.current = 0; // diamond sword
  z.health = 1;
  s2.queueAttack("a", Number(z.id.slice(4))); s2.tick(); social.drain();
  assert.ok(z.health <= 0, "zombie died");
  assert.equal(social.achievementsOf("a").has("killEnemy"), true);
  assert.equal(social.achievementsOf("b").has("killEnemy"), false);
  void m;
});

test("exploreAllBiomes observes each player's biome every 20 ticks through the sink", () => {
  const f = fixture(), a = f.join("a", "Alex", 1);
  f.sim.world.biomeAt = () => ({ name: "Plains" });
  f.sim.ticks = 19; f.sim.tick();
  assert.ok(f.social.achievementsOf("a").visited.has("Plains"));
  assert.equal(a.achievementsSaved, null);
});
