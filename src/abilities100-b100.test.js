// Batch 100 abilities100: S39PacketPlayerAbilities on the dedicated server (bytecode-read hk / oi / mx / bjb, see multiplayer/abilities.js).
import test from "node:test";
import assert from "node:assert/strict";
import { abilitiesMessage, abilitySpeedsOf, abilityRecordFields, clientModeOf } from "./multiplayer/abilities.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { DedicatedClient } from "./multiplayer/client.js";
import { writePackets, CLIENTBOUND, PLAY_FRAME } from "./multiplayer/net-packet-ids.js";
import { setAbilitySpeeds, shownAbilitySpeeds, flySpeed } from "./player-movement.js";
import { World } from "./world.js";

const f = Math.fround;
const key = "00000000-0000-0000-0000-000000000001";
function sim(saved = {}, gameMode = "survival") {
  const world = new World("abilities100");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 20; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation(saved, { world, gameMode });
}

test("S39 flags follow the game type and carry the player's own speeds", () => {
  const s = sim({ players: [[key, { position: { x: 50.5, y: 10, z: 64.5 }, yaw: 0, pitch: 0, abilitySpeeds: { fly: 0.2, walk: 0.3 } }]] });
  const a = s.addPlayer("a", "A", key);
  assert.deepEqual(s.abilitiesOf(a), { type: "abilities", invulnerable: false, flying: false, allowFlying: false, creative: false, fly: f(0.2), walk: f(0.3) });
  const c = sim({}, "creative").addPlayer("c", "C", "00000000-0000-0000-0000-000000000002");
  assert.deepEqual(abilitiesMessage(c), { type: "abilities", invulnerable: true, flying: false, allowFlying: true, creative: true, fly: f(0.05), walk: f(0.1) });
  c.flying = true;
  assert.equal(abilitiesMessage(c).flying, true);
  c.survival.mode = "adventure";
  assert.deepEqual([abilitiesMessage(c).allowFlying, abilitiesMessage(c).flying, abilitiesMessage(c).creative], [false, false, false]);
  const neg = sim({ players: [[key, { position: { x: 50.5, y: 10, z: 64.5 }, yaw: 0, pitch: 0, abilitySpeeds: { fly: 0.05, walk: -0.5 } }]] }).addPlayer("n", "N", key);
  assert.equal(abilitiesMessage(neg).walk, f(-0.5)); // the raw walkSpeed float goes out; the client clamps its movement value
});

test("a respawn queues S39 before the dimension message", () => {
  const s = sim({}, "creative"), p = s.addPlayer("a", "A", key);
  p.survival.health = 0; p.dead = true; p.flying = true;
  assert.equal(s.serverSurvival.respawn(p), true);
  const ab = p.dimOut.find((m) => m.type === "abilities"); assert.ok(ab); assert.ok(p.dimOut.indexOf(ab) < p.dimOut.findIndex((m) => m.type === "posLook")); // b102: S08 follows (oi.a(mw, int, boolean))
  assert.equal(ab.flying, false);
});

test("the client predicts with the server's speeds and resets them", () => {
  const got = [];
  const c = new DedicatedClient({});
  c.onAbilities = (m) => { got.push(m); setAbilitySpeeds(abilitySpeedsOf(m)); };
  c.buffer({ type: "abilities", fly: 0.2, walk: 0.3, flying: false });
  assert.equal(got.length, 0); // buffered while terrain loads, in order
  c.start();
  assert.equal(got.length, 1);
  assert.deepEqual(shownAbilitySpeeds(), { walk: f(0.3), fly: f(0.2) });
  assert.equal(flySpeed(), f(0.2));
  setAbilitySpeeds(); // leaving multiplayer
  assert.deepEqual(shownAbilitySpeeds(), { walk: f(0.1), fly: f(0.05) });
  assert.deepEqual(abilityRecordFields({ fly: 0.2, walk: 0.3 }), { abilitySpeeds: { fly: 0.2, walk: 0.3 } });
  assert.deepEqual(abilityRecordFields(undefined), {});
});

test("the client starts in the player's own game mode", () => {
  assert.equal(clientModeOf({ gameMode: "survival" }, { player: { gameMode: "creative" } }), "creative");
  assert.equal(clientModeOf({ gameMode: "creative" }, { player: { gameMode: "adventure" } }), "adventure");
  assert.equal(clientModeOf({ gameMode: "survival" }, { player: {} }), "survival");
  assert.equal(clientModeOf({ gameMode: "creative" }, undefined), "creative");
});

test("/netstat counts one S39 (id 57, 10 bytes) at join and per respawn message", () => {
  assert.equal(CLIENTBOUND.abilities, 57);
  assert.equal(PLAY_FRAME.clientbound[57], 10);
  assert.deepEqual(writePackets({ type: "abilities" }, {}), [[57, 10]]);
  const join = writePackets({ type: "welcome", world: {} }, {});
  assert.deepEqual(join.slice(0, 2), [[1, PLAY_FRAME.clientbound[1]], [57, 10]]);
});
