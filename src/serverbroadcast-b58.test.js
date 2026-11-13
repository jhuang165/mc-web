// Batch 58 serverbroadcast: death and achievement broadcasts, operator commands on other players' records, and chat as components, on the dedicated simulation (no sockets).
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial, chatMessage, chatDisplay, playerChatMessage } from "./server-broadcast.js";
import { applyPlayerOp } from "./player-op.js";
import { componentParts, langReady } from "./chat-component.js";

await langReady;

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
function fixture(ops = []) {
  const world = new World("b58");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world }), inbox = {};
  const social = new ServerSocial({ simulation: sim, ops, deliver: (id, m) => (inbox[id] ??= []).push(m) });
  const join = (id, name, n, at = { x: 64.5, y: 10, z: 64.5 }) => { const p = sim.addPlayer(id, name, key(n)); p.position.copy(at); p.previous.copy(at); return p; };
  const log = (id) => (inbox[id] ??= []);
  return { sim, social, join, log, inbox };
}
const texts = (list) => list.filter((m) => m.type === "chat").map((m) => chatDisplay(m).unformatted());

test("a death is sent to every player as the CombatTracker component, with no gamerule gate", () => {
  const f = fixture();
  f.join("a", "Alex", 1); f.join("b", "Bob", 2);
  f.social.death("a");
  for (const id of ["a", "b"]) {
    assert.deepEqual(texts(f.log(id)), ["Alex fell out of the world"]);
    assert.equal(f.log(id)[0].type, "chat");
    assert.match(f.log(id)[0].json, /death\.attack\.outOfWorld/);
  }
});

test("falling below the world queues a death that drain() broadcasts", () => {
  const f = fixture();
  const p = f.join("a", "Alex", 1); f.join("b", "Bob", 2);
  p.position.copy({ x: 64.5, y: -70, z: 64.5 });
  f.sim.tick();
  assert.equal(f.social.drain(), 1);
  assert.deepEqual(texts(f.log("b")), ["Alex fell out of the world"]);
  assert.equal(f.social.drain(), 0);
});

test("an achievement is announced to every player once; a locked parent and a repeat are silent", () => {
  const f = fixture();
  f.join("a", "Alex", 1); f.join("b", "Bob", 2);
  assert.equal(f.social.award("a", "mineWood"), false); // openInventory is still locked
  assert.equal(f.log("b").length, 0);
  assert.equal(f.social.award("a", "openInventory"), true);
  assert.equal(f.social.award("a", "openInventory"), false);
  for (const id of ["a", "b"]) {
    assert.equal(f.log(id).length, 1);
    assert.equal(texts(f.log(id))[0], "Alex has just earned the achievement [Taking Inventory]");
    assert.match(f.log(id)[0].json, /show_achievement/);
  }
  assert.deepEqual(f.sim.savePlayer(f.sim.players.get("a")).achievements.unlocked, ["openInventory"]);
});

test("plain chat is chat.type.text with the sender's /msg click, parsed back by the client", () => {
  const m = playerChatMessage("Alex", "hello");
  assert.deepEqual([m.name, m.text], ["Alex", "hello"]);
  assert.ok(m.json.includes("suggest_command"));
  const shown = chatDisplay(m);
  assert.equal(shown.unformatted(), "<Alex> hello");
  assert.equal(componentParts(shown).find((p) => p.style.get("click"))?.style.get("click").value, "/msg Alex ");
  assert.equal(chatDisplay({ type: "chat", name: "", text: "legacy §aline" }), "legacy §aline");
  assert.equal(chatDisplay({ type: "chat", name: "Zed", text: "hi" }).unformatted(), "<Zed> hi");
  assert.equal(chatDisplay({ type: "chat", name: "", text: "x", json: "{bad" }), "x");
});

test("a player who is not an operator gets the permission text for /give and /tp", () => {
  const f = fixture();
  f.join("a", "Alex", 1); f.join("b", "Bob", 2);
  f.social.command("a", "/give Bob 1 5");
  assert.match(texts(f.log("a"))[0], /permission/);
  assert.equal(f.log("b").length, 0);
});

test("an operator's /tp, /give, /gamemode, /xp, /effect act on the named player's record", () => {
  const f = fixture(["alex"]);
  const a = f.join("a", "Alex", 1), b = f.join("b", "Bob", 2, { x: 80.5, y: 10, z: 80.5 });
  f.social.command("a", "/tp Bob Alex");
  assert.deepEqual({ x: b.position.x, z: b.position.z }, { x: 64.5, z: 64.5 });
  f.social.command("a", "/tp Bob 50 10 50");
  assert.deepEqual({ x: b.position.x, y: b.position.y, z: b.position.z }, { x: 50.5, y: 10.5, z: 50.5 });
  assert.equal(a.position.x, 64.5);
  f.social.command("a", "/gamemode survival Bob");
  assert.equal(b.survival.mode, "survival"); assert.notEqual(a.survival.mode, "survival");
  const ops = (id) => f.log(id).filter((m) => m.type === "playerOp");
  assert.deepEqual(ops("b").map((m) => m.op), ["setGameMode"]);
  assert.ok(texts(f.log("b")).includes("Your game mode has been updated"));
  f.social.command("a", "/give Bob 1 5");
  assert.deepEqual(ops("b").at(-1), { type: "playerOp", op: "give", args: [{ id: ops("b").at(-1).args[0].id, count: 5, damage: 0 }] });
  assert.ok(texts(f.log("a")).some((t) => /Given \[.*\] \* 5 to Bob/.test(t)), texts(f.log("a")).join("|"));
  assert.equal(ops("a").length, 0);
  f.social.command("a", "/xp 30L Bob");
  assert.deepEqual(ops("b").at(-1), { type: "playerOp", op: "addLevels", args: [30] });
  f.social.command("a", "/effect Bob 1 30 1");
  assert.ok(b.survival.effects.has(1));
  assert.equal(b.effectsOut.at(-1).id, 1);
  f.social.command("a", "/achievement give achievement.openInventory Bob");
  assert.deepEqual(b.achievementsSaved.unlocked, ["openInventory"]);
  assert.match(texts(f.log("a")).at(-1), /Successfully given|Bob/);
});

test("operator feedback also goes to the other operators as chat.type.admin; unknown targets and unsupported commands answer in red", () => {
  const f = fixture(["alex", "bob"]);
  f.join("a", "Alex", 1); f.join("b", "Bob", 2); f.join("c", "Cy", 3);
  f.social.command("a", "/gamemode creative Cy");
  assert.ok(texts(f.log("b")).some((t) => t.startsWith("[Alex: ")), texts(f.log("b")).join("|"));
  assert.ok(!texts(f.log("c")).some((t) => t.startsWith("[Alex:")));
  f.log("a").length = 0;
  f.social.command("a", "/give Nobody 1");
  assert.match(texts(f.log("a"))[0], /cannot be found/);
  f.social.command("a", "/time set day");
  assert.match(texts(f.log("a")).at(-1), /not available on this server/);
});

test("/kill kills the sender only (CommandKill ignores arguments) and the death reaches everyone", () => {
  const f = fixture(["alex"]);
  f.join("a", "Alex", 1); f.join("b", "Bob", 2);
  f.social.command("a", "/kill Bob");
  assert.deepEqual(f.log("a").filter((m) => m.type === "playerOp").map((m) => m.op), ["kill"]);
  assert.equal(f.log("b").filter((m) => m.type === "playerOp").length, 0);
  f.social.drain();
  assert.ok(texts(f.log("b")).includes("Alex fell out of the world"));
});

test("a selector target and /tell still work for everybody", () => {
  const f = fixture(["alex"]);
  f.join("a", "Alex", 1); f.join("b", "Bob", 2);
  f.social.command("a", "/gamemode creative @p[r=0]");
  f.social.command("b", "/tell Alex hey");
  assert.ok(texts(f.log("a")).some((t) => /Bob whispers to you: hey/.test(t)));
});

test("the client applies playerOp messages to its own state, and only the listed ones", () => {
  const calls = [];
  const env = { survival: { inventory: { main: [{ id: 3, count: 2 }, null], armor: [], add: (s) => (calls.push(["add", s.id, s.count]), true) } }, experience: { add: (n) => calls.push(["xp", n]), addLevels: (n) => calls.push(["lv", n]) },
    commandHost: { setGameMode: (m) => calls.push(["mode", m]), kill: () => calls.push(["kill"]), addEffect: (...a) => calls.push(["eff", ...a]), removeEffect: () => {}, clearEffects: () => {} },
    renderHotbar() {}, renderVitals() {}, makeStack: (id, count) => ({ id, count }) };
  assert.equal(applyPlayerOp({ op: "give", args: [{ id: 1, count: 5, damage: 0 }] }, env), true);
  assert.equal(applyPlayerOp({ op: "give", args: [{ id: 1, count: 500 }] }, env), false);
  assert.equal(applyPlayerOp({ op: "eval", args: [] }, env), false);
  applyPlayerOp({ op: "clear", args: [3, -1] }, env);
  assert.equal(env.survival.inventory.main[0], null);
  applyPlayerOp({ op: "setGameMode", args: ["rm -rf"] }, env);
  applyPlayerOp({ op: "addLevels", args: [30] }, env);
  assert.deepEqual(calls, [["add", 1, 5], ["lv", 30]]);
});
