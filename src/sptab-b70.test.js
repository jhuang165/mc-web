// Batch 70 sptab70: single-player Tab on the integrated server's flow, UserList name order, /whitelist reload.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spTabComplete } from "./sp-tabcomplete.js";
import { createCommandRunner } from "./commands.js";
import { RemoteTabCompletion } from "./multiplayer/client-tabcomplete.js";
import { tabComplete, INTEGRATED_KEY_ORDER } from "./multiplayer/server-tabcomplete.js";
import { UserMap, userListValues, userListKeys, hashCapacity } from "./multiplayer/user-list-order.js";
import { ServerAdmin } from "./multiplayer/server-admin.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/tabcomplete-reference.json", import.meta.url)));
const host = (cheats) => ({ name: "Player", playerName: "Player", cheats, print() {} });
const sp = (text, cheats) => spTabComplete(text, { name: "Player", cheats, complete: (t) => createCommandRunner(host(cheats)).complete(t, true) });

test("integrated profile: 35 lookup keys, replayed against the executed getPossibleCommands (cheats off and on)", () => {
  assert.equal(reference.integrated.registered.length, 32);
  assert.equal(INTEGRATED_KEY_ORDER.length, 35);
  let n = 0;
  for (const r of reference.integrated.records) {
    if (r.error) continue;
    const got = sp("/" + r.text, r.cheats === 1), want = r.options ?? [];
    assert.deepEqual(r.text.includes(" ") ? got : got.map((s) => s.slice(1)), want, `cheats ${r.cheats} "${r.text}"`);
    n++;
  }
  assert.equal(n, 60);
});

test("single player Tab: hash order, no sorting, the common-prefix step, then cycling with the list in chat line 1", () => {
  const tab = new RemoteTabCompletion(), printed = [];
  let text = "/g", cursor = 2;
  const apply = (o) => { if (o) { text = o.text; cursor = o.cursor; } };
  const request = (before) => apply(tab.reply(sp(before, true), text, cursor, (t) => printed.push(t)));
  apply(tab.press(text, cursor, request, (t) => printed.push(t)));
  assert.equal(printed.length, 1);
  assert.equal(printed[0], "/gamemode, /give, /gamerule", "unsorted: the HashMap order of the 35 keys");
  assert.equal(text, "/gamemode", "'/g' is already the common prefix, so cycling starts at once");
  apply(tab.press(text, cursor, request, (t) => printed.push(t)));
  assert.equal(text, "/give");
  // a unique match: the prefix step inserts it and the next Tab asks again
  const t2 = new RemoteTabCompletion(); let s2 = "/ti", c2 = 3;
  const ap2 = (o) => { if (o) { s2 = o.text; c2 = o.cursor; } };
  ap2(t2.press(s2, c2, (b) => ap2(t2.reply(sp(b, true), s2, c2, () => {})), () => {}));
  assert.equal(s2, "/time");
});

test("without cheats only /seed, /tell, /help and /me (and aliases) are offered; arguments need no permission", () => {
  assert.deepEqual(sp("/", false), ["/msg", "/seed", "/tell", "/me", "/help", "/w", "/?"]);
  assert.deepEqual(sp("/gamemode s", false), ["survival"]);
  assert.deepEqual(sp("/tell Pl", false), ["Player"]);
  assert.deepEqual(sp("hi Pl", false), ["Player"]);
});

// The replay of UserListProbe.java: the same puts and removals through a UserMap.
test("UserList order replays the executed 1.7.10 UserListBans, UserListOps, UserListWhitelist and IP list", () => {
  const byKind = new Map();
  for (const r of reference.userLists.records) { if (!byKind.has(r.list)) byKind.set(r.list, []); byKind.get(r.list).push(r); }
  for (const [kind, steps] of byKind) {
    const full = steps.find((s) => s.step === "put40").entries;
    // the probe's put order: names[i] for i in 0..39 (kind-independent); the IP list uses its own addresses
    const names = Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? "Steve" : i % 3 === 1 ? "Alex" : "Notch") + i);
    const uuidOf = new Map(full.map((e) => [e.name, e.uuid]));
    const keys = kind === "ips" ? names.map((_, i) => `10.0.${(i * 7) % 256}.${(i * 13) % 256}`) : names.map((n) => uuidOf.get(n));
    const map = new UserMap();
    const read = () => (kind === "ips" ? userListKeys(map) : userListValues(map).map((v) => v.name));
    for (let i = 0; i < 40; i++) {
      map.set(keys[i], { name: names[i] });
      const step = steps.find((s) => s.step === "put" + (i + 1));
      if (step) assert.deepEqual(read(), step.entries.map((e) => e.name ?? e.ip), `${kind} after ${i + 1} puts`);
    }
    for (let i = 6; i < 40; i++) map.delete(keys[i]);
    assert.deepEqual(read(), steps.find((s) => s.step === "removeTo6").entries.map((e) => e.name ?? e.ip), `${kind} after the removals (the table keeps its size)`);
  }
  assert.equal(hashCapacity(12), 16); assert.equal(hashCapacity(13), 32); assert.equal(hashCapacity(25), 64);
});

test("the name completions of the admin commands answer in UserList order", () => {
  const uuids = Array.from({ length: 8 }, (_, i) => `6f1c0${i}aa-1b2c-3d4e-8f90-a1b2c3d4e5f${i}`);
  const names = ["Zed", "Amy", "Kim", "Bob", "Lee", "Max", "Ned", "Oz"];
  const admin = new ServerAdmin({ ops: uuids.map((u, i) => ({ uuid: u, name: names[i], level: 4 })), banned: uuids.map((u, i) => ({ uuid: u, name: names[i] })), whitelist: uuids.map((u, i) => ({ uuid: u, name: names[i] })), bannedIps: names.map((_, i) => ({ ip: `9.8.${i}.${i * 5}` })) });
  const ctx = { sender: "Alex", level: 4, online: ["Alex"], admin, isOp: () => false, scoreboard: null };
  const viaOps = tabComplete("/deop ", ctx), viaBans = tabComplete("/pardon ", ctx), viaList = tabComplete("/whitelist remove ", ctx);
  assert.deepEqual(viaOps, userListValues(admin.ops).map((e) => e.name));
  assert.deepEqual(viaBans, viaOps);
  assert.deepEqual(viaList, viaOps);
  assert.notDeepEqual(viaOps, names, "not the insertion order (these UUID strings hash apart)");
  assert.deepEqual([...viaOps].sort(), [...names].sort());
  assert.deepEqual(tabComplete("/pardon-ip ", ctx), userListKeys(admin.ipBans));
});

test("/whitelist reload re-reads whitelist.json; add and remove write it; a missing file changes nothing", () => {
  const admin = new ServerAdmin({ profiles: [{ uuid: "u-steve", name: "Steve" }] });
  let disk = null; const writes = [];
  admin.whitelistFile = { read: () => disk, write: (rows) => { disk = rows; writes.push(rows.map((r) => r.name)); } };
  const ctx = { print() {}, feedback() {}, sender: "Alex", online: () => [] };
  admin.whitelistCommand(["add", "Steve"], ctx);
  assert.deepEqual(writes, [["Steve"]]);
  disk = [{ uuid: "u-alex", name: "Alex" }, { uuid: "u-bob", name: "Bob" }]; // edited by hand
  admin.whitelistCommand(["reload"], ctx);
  assert.deepEqual([...admin.allow.values()].map((e) => e.name), ["Alex", "Bob"]);
  disk = null; admin.whitelistCommand(["reload"], ctx);
  assert.equal(admin.allow.size, 2, "a missing file leaves the list");
  disk = { not: "an array" }; admin.whitelistCommand(["reload"], ctx);
  assert.equal(admin.allow.size, 2);
  admin.whitelistFile = { read: () => { throw new Error("bad json"); }, write: () => {} };
  admin.whitelistCommand(["reload"], ctx);
  assert.equal(admin.allow.size, 2, "an unreadable file leaves the list");
  const plain = new ServerAdmin(); // no file hook (tests, embedded): reload still answers
  plain.whitelistCommand(["reload"], ctx);
});
