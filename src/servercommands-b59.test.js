// Batch 59 servercommands: world commands, /clear over the whole inventory, /enchant and /spawnpoint on other players, server achievement triggers.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial, chatDisplay } from "./server-broadcast.js";
import { serverInventory } from "./servercommands-b59.js";
import { applyPlayerOp } from "./player-op.js";
import { makeStack } from "./inventory.js";
import { langReady } from "./chat-component.js";

await langReady;

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
function fixture(ops = ["Alex"]) {
  const world = new World("b59");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world }), inbox = {};
  const social = new ServerSocial({ simulation: sim, ops, deliver: (id, m) => (inbox[id] ??= []).push(m) });
  const join = (id, name, n) => { const p = sim.addPlayer(id, name, key(n)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); return p; };
  const log = (id) => (inbox[id] ??= []);
  const say = (id, line) => { inbox[id] = []; social.command(id, line); return log(id).filter((m) => m.type === "chat").map((m) => chatDisplay(m).unformatted()); };
  return { sim, social, join, log, say };
}
const two = () => { const f = fixture(); f.join("a", "Alex", 1); f.join("b", "Bob", 2); return f; };

test("/time set and add change the world clock, the players' clock and answer with the 1.7.10 text", () => {
  const f = two();
  assert.deepEqual(f.say("a", "/time set night"), ["Set the time to 13000"]);
  assert.equal(f.sim.time, 13000);
  assert.equal(f.sim.players.get("b").survival.time, 13000);
  assert.deepEqual(f.say("a", "/time set day"), ["Set the time to 1000"]);
  assert.deepEqual(f.say("a", "/time add 500"), ["Added 500 to the time"]);
  assert.equal(f.sim.time, 1500);
  assert.match(f.say("a", "/time set -1")[0], /too small/);
  assert.match(f.say("a", "/time")[0], /<set\|add> <value>/);
  f.sim.tick();
  assert.equal(f.sim.time, 1501);
});

test("/gamerule sets and reads values, and doDaylightCycle false stops the clock", () => {
  const f = two();
  assert.deepEqual(f.say("a", "/gamerule doDaylightCycle false"), ["Game rule has been updated"]);
  assert.deepEqual(f.say("a", "/gamerule doDaylightCycle"), ["doDaylightCycle = false"]);
  const t = f.sim.time; f.sim.tick(); f.sim.tick();
  assert.equal(f.sim.time, t);
  f.say("a", "/gamerule doDaylightCycle true");
  f.sim.tick();
  assert.equal(f.sim.time, t + 1);
  assert.match(f.say("a", "/gamerule nope")[0], /No game rule called 'nope' is available/);
  assert.equal(f.say("a", "/gamerule")[0].includes("keepInventory"), true);
  const saved = new DedicatedSimulation(JSON.parse(JSON.stringify(f.sim.save())), { world: f.sim.world });
  assert.equal(saved.gameRules.doDaylightCycle, "true");
});

test("/weather, /toggledownfall act on the server's weather", () => {
  const f = two();
  assert.deepEqual(f.say("a", "/weather thunder 100"), ["Changing to rain and thunder"]);
  const w = f.sim.weather;
  assert.deepEqual([w.raining, w.thundering, w.rainTime, w.thunderTime], [true, true, 2000, 2000]);
  assert.deepEqual(f.say("a", "/weather clear"), ["Changing to clear weather"]);
  assert.deepEqual([w.raining, w.thundering, w.rainTime], [false, false, 0]);
  assert.deepEqual(f.say("a", "/weather rain 10"), ["Changing to rainy weather"]);
  assert.equal(w.raining, true);
  assert.deepEqual(f.say("a", "/toggledownfall"), ["Toggled downfall"]);
  assert.equal(w.raining, false);
  assert.match(f.say("a", "/weather sleet")[0], /<clear\|rain\|thunder>/);
});

test("/difficulty and /defaultgamemode are kept on the server; a new player starts in the default mode", () => {
  const f = two();
  assert.deepEqual(f.say("a", "/difficulty hard"), ["Set game difficulty to hard"]);
  assert.equal(f.sim.difficulty, 3);
  assert.deepEqual(f.say("a", "/difficulty 0"), ["Set game difficulty to peaceful"]);
  assert.deepEqual(f.say("a", "/defaultgamemode adventure"), ["The world's default game mode is now Adventure Mode"]);
  const c = f.join("c", "Cara", 3);
  assert.equal(c.survival.mode, "adventure");
  assert.equal(f.sim.players.get("a").survival.mode, "creative"); // without force-gamemode connected players keep theirs
  f.say("a", "/defaultgamemode survival");
  assert.equal(f.join("d", "Dan", 4).survival.mode, "survival");
  assert.equal(new DedicatedSimulation(f.sim.save(), { world: f.sim.world }).difficulty, 0);
});

test("/list shows every online player, with uuids on request; /say /seed /me answer for everyone", () => {
  const f = two();
  assert.deepEqual(f.say("a", "/list"), ["There are 2/20 players online:", "Alex, Bob"]);
  assert.deepEqual(f.say("a", "/list uuids"), ["There are 2/20 players online:", `Alex (${key(1)}), Bob (${key(2)})`]);
  assert.deepEqual(f.say("a", "/seed"), ["Seed: b59"]);
  f.say("a", "/say hello all");
  assert.deepEqual(f.log("b").map((m) => chatDisplay(m).unformatted()), ["[Alex] hello all"]);
  f.say("a", "/me waves");
  assert.equal(chatDisplay(f.log("b").at(-1)).unformatted(), "* Alex waves");
});

test("/tellraw delivers the component to the named player only", () => {
  const f = two();
  assert.deepEqual(f.say("a", '/tellraw Bob {"text":"hi Bob","color":"red"}'), []);
  assert.deepEqual(f.log("b").filter((m) => m.type === "chat").map((m) => chatDisplay(m).unformatted()), ["hi Bob"]);
  assert.match(f.say("a", "/tellraw Bob {bad")[0], /Invalid json|json/i);
  assert.match(f.say("a", "/tellraw Nobody {}")[0], /player/i);
});

test("a player who is not an operator cannot run world commands", () => {
  const f = two();
  assert.match(f.say("b", "/time set day")[0], /do not have permission/);
  assert.equal(f.sim.time, 6000);
  assert.deepEqual(f.say("b", "/list"), ["There are 2/20 players online:", "Alex, Bob"]); // CommandListPlayers is level 0
});

test("/clear walks every slot the server holds, through serverInventory, and the client clears its own", () => {
  const f = two();
  const b = f.sim.players.get("b");
  assert.equal(serverInventory(b).lists[0], b.survival.inventory.main);
  const inv = b.survival.inventory;
  inv.main[2] = makeStack(3, 5); inv.main[20] = makeStack(3, 7); inv.main[30] = makeStack(1, 9); // build id 3 is stone
  assert.deepEqual(f.say("a", "/clear Bob minecraft:stone"), ["Cleared the inventory of Bob, removing 12 items"]);
  assert.equal(inv.main[20], null);
  assert.equal(inv.main[30].count, 9);
  const left = [...inv.main, ...(inv.armor ?? [])].reduce((n, x) => n + (x?.count ?? 0), 0);
  assert.ok(left >= 9);
  assert.deepEqual(f.say("a", "/clear Bob"), [`Cleared the inventory of Bob, removing ${left} items`]);
  assert.ok(inv.main.every((x) => !x));
  assert.match(f.say("a", "/clear Bob")[0], /Could not clear the inventory of Bob/);
  const op = f.log("b").findLast((m) => m.type === "playerOp" && m.op === "clear");
  assert.deepEqual(op.args, [-1, -1]);
});

test("/enchant works on another player's held item and is sent to that player", () => {
  const f = two();
  const b = f.sim.players.get("b");
  b.survival.inventory.main.fill(null); b.survival.inventory.current = 0;
  assert.match(f.say("a", "/enchant Bob 32")[0], /doesn.t hold an item/);
  b.survival.inventory.main[0] = makeStack(100, 1); b.survival.inventory.current = 0; // wooden pickaxe
  assert.match(f.say("a", "/enchant Bob 16")[0], /can.t be added/); // sharpness does not fit a pickaxe
  assert.deepEqual(f.log("b").filter((m) => m.op === "enchant"), []);
  assert.deepEqual(f.say("a", "/enchant Bob 32 3"), ["Enchanting succeeded"]);
  assert.deepEqual(f.log("b").find((m) => m.op === "enchant").args, [32, 3]);
  assert.match(f.say("a", "/enchant Bob 99")[0], /99/);
  const calls = [];
  assert.equal(applyPlayerOp({ op: "enchant", args: [32, 3] }, { commandHost: { enchant: (...a) => calls.push(a) } }), true);
  applyPlayerOp({ op: "enchant", args: [999, 3] }, { commandHost: { enchant: (...a) => calls.push(a) } });
  assert.deepEqual(calls, [[32, 3]]);
});

test("/spawnpoint is per player, saved, and used when a player falls out of the world", () => {
  const f = two();
  assert.match(f.say("a", "/spawnpoint Bob 70 12 75")[0], /Set Bob's spawn point to \(70, 12, 75\)/);
  const b = f.sim.players.get("b");
  assert.deepEqual(b.spawnpoint, [70, 12, 75]);
  assert.equal(f.sim.players.get("a").spawnpoint, null);
  assert.deepEqual(f.sim.savePlayer(b).spawnpoint, [70, 12, 75]);
  b.position.copy({ x: 64.5, y: -70, z: 64.5 });
  f.sim.tick();
  assert.deepEqual([b.position.x, b.position.y, b.position.z], [70.5, 12, 75.5]);
  f.say("a", "/spawnpoint");
  assert.deepEqual(f.sim.players.get("a").spawnpoint, [64, 10, 64]);
});

test("openInventory and item pickups award achievements on the server", () => {
  const f = two();
  assert.equal(f.social.openInventory("a"), true);
  assert.equal(f.social.openInventory("a"), false);
  assert.match(f.log("b").map((m) => chatDisplay(m).unformatted()).join("|"), /Alex has just earned the achievement \[Taking Inventory\]/);
  f.sim.events = [{ type: "pickup", id: "a", item: 4 }, { type: "pickup", id: "a", item: 1 }];
  f.social.drain();
  assert.equal(f.social.achievementsOf("a").has("mineWood"), true);
  f.sim.events = [{ type: "pickup", id: "b", item: 4 }]; // Bob has not opened his inventory: the parent is locked, so silent
  f.social.drain();
  assert.equal(f.social.achievementsOf("b").has("mineWood"), false);
});
