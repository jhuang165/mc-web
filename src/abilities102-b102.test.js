// Batch 102 abilities102: /gamemode's "gameMode.changed" line comes from the target client's S2B reason 3 handler (bjb.a(gv): gv.a[3] printed by yz.b), not from a server chat line;
// CommandGameMode (ar) itself sends only commands.gamemode.success.self/other through notifyAdmins. Adventure gates are already native (batch 78).
import test from "node:test";
import assert from "node:assert/strict";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial } from "./server-broadcast.js";
import { World } from "./world.js";
import { applyPlayerOp } from "./player-op.js";
import { Survival } from "./survival.js";
import { mayHitBlock } from "./adventure.js";

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
function setup() {
  const world = new World("abilities102");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 20; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, gameMode: "survival" }), got = [];
  sim.addPlayer("a", "Alice", key(1)); sim.addPlayer("b", "Bob", key(2));
  const social = new ServerSocial({ simulation: sim, ops: ["alice"], deliver: (id, m) => got.push({ id, m }) });
  return { sim, social, got };
}
const chat = (got, id) => got.filter((e) => e.id === id && e.m.type === "chat").map((e) => JSON.stringify(e.m));

test("server /gamemode: no gameMode.changed chat to the target, one S2B instead; the sender gets no admin copy", () => {
  const { social, got } = setup();
  social.command("a", "/gamemode creative");
  assert.equal(chat(got, "a").some((m) => m.includes("gameMode.changed")), false);
  assert.equal(got.filter((e) => e.id === "a" && e.m.type === "playerOp" && e.m.op === "setGameMode").length, 1);
  got.length = 0;
  social.command("a", "/gamemode adventure Bob");
  assert.equal(chat(got, "b").some((m) => m.includes("gameMode.changed")), false);
  assert.equal(got.filter((e) => e.id === "b" && e.m.type === "playerOp").length, 1);
  assert.equal(got.some((e) => e.id === "a" && e.m.type === "playerOp"), false);
});

test("client: the setGameMode playerOp prints gameMode.changed to the target", () => {
  const lines = [], modes = [];
  applyPlayerOp({ op: "setGameMode", args: ["creative"] }, { commandHost: { setGameMode: (m) => modes.push(m), print: (t, c) => lines.push({ t, c }) } });
  assert.deepEqual(modes, ["creative"]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].c.key ?? lines[0].c.translate ?? lines[0].t, lines[0].c.key ?? lines[0].c.translate ?? "gameMode.changed");
});

test("adventure gate: bare hand cannot hit stone, survival can (already native, b78)", () => {
  const s = new Survival({}, "adventure");
  assert.equal(mayHitBlock(s, 1, 0, 0), false);
  assert.equal(mayHitBlock(new Survival({}, "survival"), 1, 0, 0), true);
});

import { setAbilityFlags, isCreativeMode } from "./ability-flags.js";
test("client capabilities.isCreativeMode comes from S39 (bao.ao middle-click pick), game mode when none", () => {
  setAbilityFlags();
  assert.equal(isCreativeMode(true), true); assert.equal(isCreativeMode(false), false);
  setAbilityFlags({ invulnerable: false, flying: false, allowFlying: false, creative: true });
  assert.equal(isCreativeMode(false), true);
  setAbilityFlags({ invulnerable: false, flying: false, allowFlying: true, creative: false });
  assert.equal(isCreativeMode(true), false);
  setAbilityFlags();
});
