// Batch 68 mpworldcmds: /setblock, /testforblock, /testfor, /setworldspawn, /playsound, /spreadplayers and /debug on the dedicated server (server-worldcmds.js).
// Native facts (bytecode-read, see .shared-memory/notes/mpworldcmds-b68-track.md): bm, bx, by (only a command block), bn (integers, no packet), bf (range, minimum volume), br, ak.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial, chatDisplay } from "./server-broadcast.js";
import { langReady } from "./chat-component.js";

await langReady;

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
function fixture(ops = ["Alex"]) {
  const world = new World("b68-worldcmds");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 90; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: false }), inbox = {};
  const social = new ServerSocial({ simulation: sim, ops, deliver: (id, m) => (inbox[id] ??= []).push(m) });
  const join = (id, name, n, at = { x: 64.5, y: 10, z: 64.5 }) => { const p = sim.addPlayer(id, name, key(n)); p.position.copy(at); p.previous.copy(p.position); return p; };
  const say = (id, line) => { inbox[id] = []; social.command(id, line); return (inbox[id] ?? []).filter((m) => m.type === "chat").map((m) => chatDisplay(m).unformatted()); };
  return { sim, social, join, say, world };
}

test("every one of these is an operator command: a plain player gets the permission message and nothing changes", () => {
  const f = fixture(["Alex"]); f.join("a", "Alex", 1); f.join("b", "Bob", 2);
  for (const line of ["/setblock 60 10 60 stone", "/testforblock 60 9 60 stone", "/setworldspawn", "/playsound random.click Bob", "/spreadplayers 60 60 2 10 false Bob", "/debug start"]) assert.match(f.say("b", line)[0], /permission/, line);
  assert.equal(f.world.get(60, 10, 60), 0);
  assert.equal(f.sim.worldSpawn, null);
});

test("/setblock places the block in the world, reaches the clients as a cell change and answers with the native texts", () => {
  const f = fixture(); f.join("a", "Alex", 1);
  assert.deepEqual(f.say("a", "/setblock 60 10 60 minecraft:stone"), ["Block placed"]);
  assert.equal(f.world.get(60, 10, 60), 3); // local id of original 1 (stone)
  const tick = f.sim.tick();
  assert.ok(tick.changes.some((c) => c[0] === 60 && c[1] === 10 && c[2] === 60 && c[3] === 3), JSON.stringify(tick.changes));
  assert.match(f.say("a", "/setblock 60 10 60 minecraft:stone")[0], /couldn't be placed/);
  assert.match(f.say("a", "/setblock 61 10 60 stone 0 keep")[0], /Block placed/);
  assert.match(f.say("a", "/setblock 60 10 60 dirt 0 keep")[0], /couldn't be placed/);
  assert.deepEqual(f.say("a", "/setblock 60 10 60 dirt 2 replace"), ["Block placed"]);
  assert.deepEqual([f.world.get(60, 10, 60), f.world.getMeta(60, 10, 60)], [2, 2]);
  assert.match(f.say("a", "/setblock 60 300 60 stone")[0], /outside of the world/i);
  assert.match(f.say("a", "/setblock ~ ~ ~")[0], /setblock <x> <y> <z>/);
  assert.match(f.say("a", "/setblock ~1 ~ ~ nosuchblock")[0], /nosuchblock/);
});

test("/setblock destroy drops the old block as items, /setblock with a chest tag keeps the contents", () => {
  const f = fixture(); f.join("a", "Alex", 1);
  f.world.put(62, 10, 62, 4, 0, false); // a log (local id 4)
  assert.deepEqual(f.say("a", "/setblock 62 10 62 stone 0 destroy"), ["Block placed"]);
  assert.equal(f.world.get(62, 10, 62), 3, "the log is replaced by stone");
  assert.ok(f.sim.items.items.length >= 1, "the log dropped");
  assert.deepEqual(f.say("a", '/setblock 63 10 63 chest 0 replace {Items:[{Slot:0b,id:1s,Count:3b,Damage:0s}]}'), ["Block placed"]);
  const chest = f.sim.tiles.chests["63,10,63"];
  assert.ok(chest && chest.items[0]?.count === 3, JSON.stringify(chest));
  assert.match(f.say("a", "/testforblock 63 10 63 chest -1 {Items:[{Slot:0b,id:1s,Count:3b,Damage:0s}]}")[0], /Successfully found the block at 63,10,63/);
  assert.match(f.say("a", "/testforblock 63 10 63 chest -1 {Items:[{Slot:0b,id:1s,Count:4b,Damage:0s}]}")[0], /NBT|nbt/i);
});

test("/testforblock compares id and data, and reports the native failures", () => {
  const f = fixture(); f.join("a", "Alex", 1);
  f.say("a", "/setblock 60 10 60 wool 5");
  assert.match(f.say("a", "/testforblock 60 10 60 wool")[0], /Successfully found the block at 60,10,60/);
  assert.match(f.say("a", "/testforblock 60 10 60 wool 5")[0], /Successfully/);
  assert.match(f.say("a", "/testforblock 60 10 60 wool 4")[0], /data value of 5 \(expected: 4\)/);
  assert.match(f.say("a", "/testforblock 60 10 60 stone")[0], /wool|minecraft:wool/);
  assert.match(f.say("a", "/testforblock 60 300 60 stone")[0], /outside of the world/i);
});

test("the Nether and the End have their own worlds: /setblock and /testforblock act on the sender's dimension", () => {
  const f = fixture(); const a = f.join("a", "Alex", 1);
  f.sim.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = f.sim.dimensions.nether;
  assert.deepEqual(f.say("a", "/setblock 60 70 60 glowstone"), ["Block placed"]);
  assert.equal(n.world.get(60, 70, 60), 131);
  assert.equal(f.world.get(60, 70, 60), 0, "the Overworld is untouched");
  assert.ok([...n.changes.values()].some((c) => c[0] === 60 && c[1] === 70 && c[2] === 60), "the Nether's own change map");
  assert.match(f.say("a", "/testforblock 60 70 60 glowstone")[0], /Successfully/);
  f.sim.dimensions.arrive(a, 1, { at: { x: 64.5, y: 70, z: 64.5 } });
  assert.deepEqual(f.say("a", "/setblock 61 70 61 obsidian"), ["Block placed"]);
  assert.equal(f.sim.dimensions.end.n.world.get(61, 70, 61), 22);
  assert.notEqual(n.world.get(61, 70, 61), 22);
});

test("/testfor is a command block command: a player gets commands.testfor.failed, the argument count is checked", () => {
  const f = fixture(); f.join("a", "Alex", 1);
  assert.match(f.say("a", "/testfor Alex")[0], /only usable by commandblocks/);
  assert.match(f.say("a", "/testfor")[0], /testfor <player>/);
  assert.match(f.say("a", "/testfor Alex Bob")[0], /testfor <player>/);
});

test("/setworldspawn takes integers (no ~), none means the sender's block, and the spawn is saved and used for new players", () => {
  const f = fixture(); f.join("a", "Alex", 1);
  assert.deepEqual(f.say("a", "/setworldspawn 50 10 50"), ["Set the world spawn point to (50, 10, 50)"]);
  assert.deepEqual(f.sim.worldSpawn, [50, 10, 50]);
  assert.match(f.say("a", "/setworldspawn ~ 10 50")[0], /not a valid number/);
  assert.match(f.say("a", "/setworldspawn 50 300 50")[0], /too big/);
  assert.match(f.say("a", "/setworldspawn 1 2")[0], /setworldspawn/);
  assert.deepEqual(f.say("a", "/setworldspawn"), ["Set the world spawn point to (64, 10, 64)"]); // floor(x), floor(y + 0.5), floor(z)
  f.say("a", "/setworldspawn 50 10 50");
  const saved = f.sim.save();
  assert.deepEqual(saved.worldSpawn, [50, 10, 50]);
  assert.deepEqual(f.sim.snapshot("a").worldSpawn, [50, 10, 50], "the compass reads it from the welcome snapshot (S05 at login)");
  // a new player: within 10 blocks of the spawn, on the ground
  const p = f.sim.addPlayer("b", "Bob", key(2));
  assert.ok(Math.abs(p.position.x - 50.5) <= 10.5 && Math.abs(p.position.z - 50.5) <= 10.5, JSON.stringify(p.position));
  assert.equal(p.position.y, 10);
  // restored: the saved spawn is installed again
  const f2 = fixture(); const sim2 = new DedicatedSimulation({}, { world: f2.world, mobs: false, saved: undefined });
  assert.equal(sim2.worldSpawn, null);
  const sim3 = new DedicatedSimulation(saved, { world: new World("b68-worldcmds"), mobs: false });
  assert.deepEqual(sim3.worldSpawn, [50, 10, 50]);
});

test("/playsound goes to the named player alone, with the native range and minimum volume", () => {
  const f = fixture(); const a = f.join("a", "Alex", 1), b = f.join("b", "Bob", 2, { x: 60.5, y: 10, z: 60.5 });
  assert.deepEqual(f.say("a", "/playsound random.click Bob"), ["Played sound 'random.click' to Bob"]);
  assert.equal(a.soundsOut ?? null, null);
  assert.deepEqual(b.soundsOut.pop(), { name: "random.click", x: 60, y: 10, z: 60, volume: 1, pitch: 1 }); // the default position is the target's own block (integers)
  f.say("a", "/playsound random.click Bob 100 10 60 1 2");
  assert.equal(b.soundsOut.length, 0);
  assert.match(f.say("a", "/playsound random.click Bob 100 10 60 1 2")[0], /too far away/);
  b.soundsOut = [];
  assert.deepEqual(f.say("a", "/playsound random.click Bob 100.5 10 60 1 1 0.5"), ["Played sound 'random.click' to Bob"]);
  const s = b.soundsOut.pop();
  assert.equal(s.volume, 0.5);
  assert.ok(Math.abs(Math.hypot(s.x - 60.5, s.y - 10, s.z - 60.5) - 2) < 1e-9, "2 blocks from the player towards the sound");
  assert.deepEqual(f.say("a", "/playsound random.click Bob 120.5 10 60 4"), ["Played sound 'random.click' to Bob"]); // volume 4: range 64
  assert.equal(b.soundsOut.pop().volume, 4);
  assert.match(f.say("a", "/playsound random.click Bob ~ ~ ~ -1")[0], /too small/);
  assert.match(f.say("a", "/playsound random.click Nobody")[0], /cannot be found/);
  assert.match(f.say("a", "/playsound random.click")[0], /playsound <sound> <player>/);
});

test("/spreadplayers moves the named players (and @a), not the sender, onto the column top", () => {
  const f = fixture(); const a = f.join("a", "Alex", 1), b = f.join("b", "Bob", 2);
  const out = f.say("a", "/spreadplayers 65 65 5 20 false Bob");
  assert.match(out.join("|"), /Spreading 1 player/);
  assert.match(out.join("|"), /Successfully spread 1 player/);
  assert.equal(a.position.x, 64.5);
  assert.ok(Math.abs(b.position.x - 65) <= 21 && Math.abs(b.position.z - 65) <= 21);
  assert.equal(b.position.y, 10); // the top block (y 9) + 1
  assert.equal(Math.floor(b.position.x) + 0.5, b.position.x);
  const all = f.say("a", "/spreadplayers 65 65 5 20 false @a");
  assert.match(all.join("|"), /Spreading 2 players/);
  assert.notDeepEqual([a.position.x, a.position.z], [64.5, 64.5]);
  assert.ok(Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) >= 5 - 1e-6, "the players keep the minimum distance");
  assert.match(f.say("a", "/spreadplayers 65 65 5 20 false")[0], /spreadplayers <x> <z>/);
});

test("/spreadplayers true spreads teams: members of one team share a spot", () => {
  const f = fixture(); f.join("a", "Alex", 1); const b = f.join("b", "Bob", 2), c = f.join("c", "Cy", 3);
  f.say("a", "/scoreboard teams add red"); f.say("a", "/scoreboard teams join red Bob Cy");
    const out = f.say("a", "/spreadplayers 65 65 5 20 true Bob Cy");
  assert.match(out.join("|"), /Successfully spread 1 teams/); // one spot for the team; the first line counts the listed players (CommandSpreadPlayers)
  assert.deepEqual([b.position.x, b.position.z], [c.position.x, c.position.z]);
});

test("/debug start and stop profile the server's ticks and write the result file", () => {
  const f = fixture(); f.join("a", "Alex", 1);
  assert.match(f.say("a", "/debug stop")[0], /Can't stop profiling when we haven't started yet/);
  assert.deepEqual(f.say("a", "/debug start"), ["Started debug profiling"]);
  for (let i = 0; i < 3; i++) f.sim.tick();
  const out = f.say("a", "/debug stop");
  assert.match(out[0], /Stopped debug profiling after [\d.E-]+ seconds \(3 ticks\)/);
  const [name, text] = [...f.sim.worldCmds.files][0];
  assert.match(name, /^profile-results-\d{4}-\d\d-\d\d_\d\d\.\d\d\.\d\d\.txt$/);
  assert.match(text, /Time span: /);
  assert.match(f.say("a", "/debug")[0], /debug <start\|stop>/);
});
