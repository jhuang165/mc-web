// Batch 70 serverprops2: view-distance in the vehicle tracker and spawner effects, allow-nether false, saved game mode, spawn-protection centre, /setidletimeout write-back.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial, chatDisplay } from "./server-broadcast.js";
import { ServerRules, loadServerProperties, saveProperty, parseProperties } from "./multiplayer/server-properties.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { MOB_SPAWNER } from "./world.js";
import { langReady } from "./chat-component.js";

await langReady;
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const flat = () => { const w = new World("b70props2"); w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 }); return w; };
const sim = (rules = {}, options = {}) => new DedicatedSimulation({}, { world: flat(), rules: new ServerRules(rules), ...options });
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });

test("the vehicle tracker range is min(80, view-distance * 16 - 16)", () => {
  const seenAt = (viewDistance, dx) => {
    const s = sim({ viewDistance }); const p = s.addPlayer("a", "Alex", uuid(1));
    s.vehicles.carts.spawnCart(0, { x: p.position.x + dx, y: 10, z: p.position.z, items: [] }, { born: true });
    s.vehicles.track(); return !!p.vehPackets?.set?.length;
  };
  assert.equal(seenAt(10, 75), true, "default: the 80 range");
  assert.equal(seenAt(10, 85), false);
  assert.equal(seenAt(5, 60), true, "limit 64");
  assert.equal(seenAt(5, 70), false, "view-distance 5 shortens the 80 range to 64");
  assert.equal(seenAt(3, 40), false, "limit 32");
});

test("a Nether spawner's puff is clamped by the view distance", { timeout: 300000 }, () => {
  const NETHERRACK = 150;
  const s = sim({ viewDistance: 5 }, { gameMode: "creative", mobs: true }), a = s.addPlayer("a", "Alice", uuid(1));
  s.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = s.dimensions.nether, w = n.world;
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 60; y <= 90; y++) w.put(x, y, z, y === 69 ? NETHERRACK : 0, 0, false);
  w.put(70, 70, 64, MOB_SPAWNER, 0, false);
  n.tileEntities.spawners.add({ x: 70, y: 70, z: 64, EntityId: "Blaze", Delay: 0, MinSpawnDelay: 1, MaxSpawnDelay: 2, SpawnCount: 1, MaxNearbyEntities: 6, RequiredPlayerRange: 16 });
  let puff = null;
  for (let i = 0; i < 600 && !puff; i++) {
    s.input("a", input()); a.position.copy({ x: 64.5, y: 70, z: 64.5 }); a.survival.health = 20;
    s.tick(); puff = (a.dispOut ?? []).filter(m => m.type === "dispFx").flatMap(m => m.events).find(e => e.k === "spawnerPuff"); a.dispOut = null; a.mobPackets = null;
  }
  assert.ok(puff, "a spawn happened"); assert.equal(puff.sq, 64, "blaze 80 clamped to 5 * 16 - 16");
});

test("allow-nether false: the Nether is not ticked (MinecraftServer.v), true: it is", () => {
  for (const allowNether of [true, false]) {
    const s = sim({ allowNether }, { gameMode: "creative", mobs: true }), a = s.addPlayer("a", "Alice", uuid(1));
    s.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
    const n = s.dimensions.nether; let ticks = 0; const real = n.mobs.tick.bind(n.mobs); n.mobs.tick = () => { ticks++; return real(); };
    s.input("a", input()); s.tick(); s.tick();
    assert.equal(ticks > 0, allowNether, `allowNether ${allowNether}`);
  }
});

test("a player's game mode is saved and restored on rejoin unless force-gamemode", () => {
  const s = sim({}, { gameMode: "survival" }); const p = s.addPlayer("a", "Alex", uuid(1));
  assert.equal(p.survival.mode, "survival"); p.survival.mode = "creative";
  const saved = JSON.parse(JSON.stringify(s.savePlayer(p))); assert.equal(saved.player.gameMode, "creative");
  const again = sim({}, { gameMode: "survival" }); again.savedPlayers.set(uuid(1), saved);
  assert.equal(again.addPlayer("a", "Alex", uuid(1)).survival.mode, "creative", "kept");
  const forced = sim({ forceGamemode: true }, { gameMode: "survival" }); forced.savedPlayers.set(uuid(1), saved);
  assert.equal(forced.addPlayer("a", "Alex", uuid(1)).survival.mode, "survival", "force-gamemode");
  const old = JSON.parse(JSON.stringify(saved)); delete old.player.gameMode;
  const legacy = sim({}, { gameMode: "adventure" }); legacy.savedPlayers.set(uuid(1), old);
  assert.equal(legacy.addPlayer("a", "Alex", uuid(1)).survival.mode, legacy.gameMode, "no tag: the server mode");
});

test("spawn protection is centred on the native world spawn, not spawn()'s random placement", () => {
  const s = sim({ spawnProtection: 4 }); const steve = s.addPlayer("b", "Steve", uuid(2));
  s.admin.ops.set(uuid(1), { uuid: uuid(1), name: "Alex", level: 4 });
  s.world.nativeSpawn = [164, 70, 264]; s.world.originX = 100; s.world.originZ = 200; s.world.spawn = () => ({ x: 1.5, y: 70, z: 1.5 });
  assert.equal(s.rules.protects(s, steve, [64, 70, 64]), true, "native 164,264 is local 64,64");
  assert.equal(s.rules.protects(s, steve, [69, 70, 64]), false);
  assert.equal(s.rules.protects(s, steve, [1, 70, 1]), false, "not the random placement");
});

test("/setidletimeout writes player-idle-timeout back to server.properties", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "serverprops2-"));
  const settings = await loadServerProperties(dir);
  const writes = []; settings.rules.persistIdleTimeout = n => writes.push(saveProperty(settings, "player-idle-timeout", n));
  const world = flat(), s = new DedicatedSimulation({}, { world, rules: settings.rules }), inbox = [];
  const social = new ServerSocial({ simulation: s, ops: ["Alex"], deliver: (id, m) => inbox.push(m) });
  s.addPlayer("p0", "Alex", uuid(1)); s.admin.host = { kick() {}, stop() {}, save: () => Promise.resolve() };
  social.command("p0", "/setidletimeout 7"); await Promise.all(writes);
  assert.equal(s.admin.idleMinutes, 7); assert.equal(parseProperties(await fs.readFile(path.join(dir, "server.properties"), "utf8")).get("player-idle-timeout"), "7");
  assert.equal(parseProperties(await fs.readFile(path.join(dir, "server.properties"), "utf8")).get("view-distance"), "10", "other keys stay");
  assert.ok(inbox.some(m => m.type === "chat" && /idle timeout to 7 minutes/.test(chatDisplay(m).unformatted())));
});
