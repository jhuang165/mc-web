import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { idleActivity } from "./multiplayer/server-idle.js";
import { debugFileWriter } from "./multiplayer/server-debugfile.js";
import { ServerAdmin } from "./multiplayer/server-admin.js";
import { brewingShared, noteBrewingCollisionPass, brewingSelection } from "./brewing.js";
import { profileFileName } from "./profiler.js";

test("debug files are written to <server dir>/debug/<name> with mkdirs first (CommandDebug func_147205_a)", () => {
  const calls = [];
  const write = debugFileWriter("/srv/mc", { mkdirSync: (...a) => calls.push(["mkdir", ...a]), writeFileSync: (...a) => calls.push(["write", ...a]) });
  const name = profileFileName(new Date(2026, 10, 14, 9, 5, 3));
  assert.equal(name, "profile-results-2026-11-14_09.05.03.txt");
  write(name, "text");
  assert.deepEqual(calls, [["mkdir", path.join("/srv/mc", "debug"), { recursive: true }], ["write", path.join("/srv/mc/debug", name), "text"]]);
});

test("only the packets that call func_143004_u's setter reset the idle clock", () => {
  for (const t of ["edit", "dig", "use", "attack", "attackPlayer", "animUse", "vehUse", "vehHit", "sign", "invCreative", "stationEnchant", "respawn", "requestStats", "openInventory", "sleepLeave", "achDrop", "chat"]) {
    assert.equal(idleActivity({ type: t }, undefined, true).reset, true, t);
  }
  for (const t of ["closeWindow", "clickWindow", "invClick", "invClose", "invAck", "confirmTransaction", "pingKeepAliveAck", "settingsClient", "capeSettings", "tabReq", "pickup", "bookEdit", "bookSign", "beacon", "tradeSelect", "stationItemName", "windowInventory", "vehCmd"]) {
    assert.equal(idleActivity({ type: t }, undefined, true).reset, false, t);
  }
  assert.equal(idleActivity({ type: "chat" }, undefined, false).reset, false, "chat visibility HIDDEN returns before the call");
});

test("input resets only when the held slot, sneak or sprint changes (C09, C0B), never for movement or looking", () => {
  const input = (current, c = {}, yaw = 0) => ({ type: "input", current, controls: c, yaw, pitch: 0 });
  let r = idleActivity(input(0), undefined);
  assert.equal(r.reset, false);
  r = idleActivity(input(0, { forward: 1, strafe: 1, jump: 1 }, 90), r.state); assert.equal(r.reset, false);
  r = idleActivity(input(1, { forward: 1 }), r.state); assert.equal(r.reset, true);
  r = idleActivity(input(1, { sneak: 1 }), r.state); assert.equal(r.reset, true);
  r = idleActivity(input(1, { sneak: 1 }), r.state); assert.equal(r.reset, false);
  r = idleActivity(input(1, { sneak: 1, sprint: 1 }), r.state); assert.equal(r.reset, true);
  r = idleActivity(input(1, {}), r.state); assert.equal(r.reset, true);
});

test("ServerAdmin idle kicks use the exact rule: > minutes * 60000 ms since the last activity packet", () => {
  const a = new ServerAdmin({}); a.idleMinutes = 1; const T = 1000; a.join("p", T); // b75 mpplayerfx75: ms, not ticks
  a.activity("p", { type: "input", current: 0, controls: { forward: 1 }, yaw: 0, pitch: 0 }, T + 500);
  assert.deepEqual(a.idle(T + 60000), [], "exactly 60000 ms is not over");
  assert.deepEqual(a.idle(T + 60001), ["p"], "movement did not reset the clock");
  a.activity("p", { type: "chat", text: "hi" }, T + 60001, false); assert.deepEqual(a.idle(T + 60001), ["p"]);
  a.activity("p", { type: "dig", status: 0 }, T + 60001); assert.deepEqual(a.idle(T + 60001), []);
});

test("brewing stand selection flag: one per Block singleton, so one per JVM (found already right)", () => {
  // Dedicated server: the server process and the browser client each import their own brewing.js, so each has its own flag, as separate JVMs have.
  // Single player (integrated server): one process and one module, so the server's collision passes flip what the client selects, as natively.
  const before = brewingShared.passed;
  brewingShared.passed = false;
  assert.deepEqual(brewingSelection(), [0, 0, 0, 1, 1, 1]);
  noteBrewingCollisionPass();
  assert.deepEqual(brewingSelection(), [0, 0, 0, 1, 0.125, 1]);
  brewingShared.passed = before;
});
