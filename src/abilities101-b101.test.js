// Batch 101 abilities101: the client's capabilities come verbatim from S39, and the server's /gamemode sends S39 then S2B reason 3 (bytecode-read bjb.a(hk), ar, mw.a(ahk), mx.a(ahk)).
import test from "node:test";
import assert from "node:assert/strict";
import { setAbilityFlags, allowsFlight, disablesDamage, abilityFlags } from "./ability-flags.js";
import { abilityRecordFields } from "./multiplayer/abilities.js";
import { Survival } from "./survival.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial } from "./server-broadcast.js";
import { writePackets, writePacketId, PLAY_FRAME } from "./multiplayer/net-packet-ids.js";
import { World } from "./world.js";

const key = "00000000-0000-0000-0000-000000000001";
function setup(mode = "survival") {
  const world = new World("abilities101");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 20; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, gameMode: mode }), p = sim.addPlayer("a", "Alice", key), got = [];
  const social = new ServerSocial({ simulation: sim, ops: ["alice"], deliver: (id, m) => got.push(m) });
  return { sim, p, social, got };
}

test("client flags: S39 overrides the game-mode rule, null restores it", () => {
  setAbilityFlags();
  assert.equal(allowsFlight(true), true); assert.equal(allowsFlight(false), false);
  setAbilityFlags({ type: "abilities", invulnerable: false, flying: true, allowFlying: true, creative: false, fly: 0.05, walk: 0.1 });
  assert.equal(allowsFlight(false), true); assert.equal(disablesDamage(true), false); // survival-mode client with flight allowed, and creative mode without immunity
  setAbilityFlags({ invulnerable: true, flying: false, allowFlying: false, creative: true });
  assert.equal(allowsFlight(true), false); assert.equal(disablesDamage(false), true);
  abilityRecordFields(undefined);
  assert.equal(abilityFlags(), null);
});

test("damage immunity follows disableDamage, not the client's game mode", () => {
  const s = new Survival({}, "creative");
  setAbilityFlags({ invulnerable: false, flying: false, allowFlying: true, creative: true });
  assert.equal(s.damage(2, "an accident"), true); assert.equal(s.health, 18);
  setAbilityFlags({ invulnerable: true, flying: false, allowFlying: false, creative: false });
  const t = new Survival({}, "survival");
  assert.equal(t.damage(2, "an accident"), false);
  setAbilityFlags();
});

test("server /gamemode on a connected player: S39 then S2B reason 3, counted", () => {
  const { p, social, got } = setup("survival");
  social.command("a", "/gamemode creative");
  assert.equal(p.survival.mode, "creative");
  const i = got.findIndex((m) => m.type === "abilities"), j = got.findIndex((m) => m.type === "playerOp" && m.op === "setGameMode");
  assert.ok(i >= 0 && j > i, "S39 precedes S2B");
  assert.deepEqual([got[i].allowFlying, got[i].creative, got[i].invulnerable], [true, true, true]);
  assert.equal(writePacketId(got[i]), 57); assert.equal(writePacketId(got[j]), 43);
  assert.deepEqual(writePackets(got[j]), [[43, PLAY_FRAME.clientbound[43]]]);
  got.length = 0; p.flying = true;
  social.command("a", "/gamemode survival");
  const a = got.find((m) => m.type === "abilities");
  assert.deepEqual([a.allowFlying, a.flying, a.creative, a.invulnerable], [false, false, false, false]);
});

test("/gamemode needs operator level 2", () => {
  const { p, social, got } = setup("survival");
  social.ops.clear();
  social.command("a", "/gamemode creative");
  assert.equal(p.survival.mode, "survival");
  assert.equal(got.some((m) => m.type === "abilities"), false);
});
