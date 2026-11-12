import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Minecarts } from "./minecarts.js";
import { runCommandCart } from "./command-cart.js";
import { commandBlockSender } from "./command-block.js";

// public/research/furnace-cart-reference.json: the unchanged EntityMinecart.applyEntityCollision (xl.g) and the command cart's watchers 23/24
// (tools/verify-furnace-cart.mjs, tools/probes/FurnaceCartProbe.java).
const ref = JSON.parse(await readFile(new URL("../public/research/furnace-cart-reference.json", import.meta.url)));
const num = (v) => (v === "-0" ? -0 : v);
const make = (carts, type, x, z, yaw, vx, vz) => {
  const c = type === 0 ? carts.spawnEmpty({ x, y: 0.5, z }, { seed: 1 }) : carts.spawnCart(type, { x, y: 0.5, z }, { seed: 1 });
  c.yaw = Math.fround(yaw); c.vx = vx; c.vy = 0; c.vz = vz;
  return c;
};

test("cart against cart matches the executed applyEntityCollision for every type pair", () => {
  assert.equal(ref.collisions.length, 1050);
  let oneFurnace = 0;
  for (const [ta, tb, ox, oz, yaw, avx, avz, bvx, bvz, a, b] of ref.collisions.map((r) => r.map(num))) {
    const carts = new Minecarts({ rails: {} });
    const A = make(carts, ta, 0, 0, yaw, avx, avz), B = make(carts, tb, ox, oz, 0, bvx, bvz);
    const out = carts.collide(A, B);
    const at = `types ${ta}/${tb} off ${ox},${oz} yaw ${yaw} v ${avx},${avz} / ${bvx},${bvz}`;
    assert.deepEqual(out, [0, 0], at);
    assert.deepEqual([A.vx, A.vy, A.vz, !!A.airBorne], [num(a[0]), num(a[1]), num(a[2]), a[3]], `${at} A`);
    assert.deepEqual([B.vx, B.vy, B.vz, !!B.airBorne], [num(b[0]), num(b[1]), num(b[2]), b[3]], `${at} B`);
    if ((ta === 2) !== (tb === 2) && a[3] !== b[3]) oneFurnace++;
  }
  assert.ok(oneFurnace > 100, "the one-furnace branches were exercised: " + oneFurnace);
});

// A fresh cart and a run that prints nothing hold "" in watcher 24, as does a saved cart (the write touches no watcher); output holds the logic's
// JSON; a cart read from NBT, or whose GUI closed, holds "null" without output (executed).
test("command cart watcher 24 holds the executed value in each state", () => {
  const rows = Object.fromEntries(ref.command);
  const carts = new Minecarts({ rails: {} });
  const host = { rules: {}, cheats: true, name: "P", print() {}, position: () => ({ x: 0, y: 0, z: 0 }) };
  const fresh = carts.spawnCart(6, { x: 0.5, y: 0.5, z: 0.5 }, { seed: 1 });
  assert.deepEqual(["", fresh.command.watch24], rows.fresh);
  // A run that prints nothing (empty command) leaves the watcher alone.
  runCommandCart(fresh, { host });
  assert.deepEqual(["", fresh.command.watch24], rows.ranNoOutput);
  // Output: the sender's print (addChatMessage) copies the JSON into the watcher (func_145756_e); the run itself does not.
  fresh.command.command = "say hi";
  const tile = fresh.command;
  tile.outputChanged = () => { tile.watch24 = tile.lastOutput; };
  commandBlockSender(host, tile, { x: 0, y: 0, z: 0 }).print("done");
  assert.ok(tile.lastOutput);
  assert.equal(tile.watch24, tile.lastOutput);
  assert.match(rows.output, /hh:mm:ss/);
  // trackOutput off: the command runs and prints nothing, so the watcher stays.
  const quiet = carts.spawnCart(6, { x: 0.5, y: 0.5, z: 0.5 }, { seed: 1 });
  Object.assign(quiet.command, { command: "say hi", trackOutput: false });
  quiet.command.outputChanged = () => { quiet.command.watch24 = "changed"; };
  commandBlockSender(host, quiet.command, { x: 0, y: 0, z: 0 }).print("done");
  assert.equal(quiet.command.watch24, "");
  // Reading NBT (a record with `command`) sets 23 and 24; no LastOutput gives fk.a(null) = "null"; the GUI's setCommand + e() does the same.
  const loaded = carts.spawnCart(6, { x: 0.5, y: 0.5, z: 0.5, command: { command: "say hi" } }, { seed: 1 });
  assert.deepEqual([loaded.command.command, loaded.command.watch24], rows.readNoOutput);
  assert.deepEqual(rows.guiNoOutput, rows.readNoOutput);
  const loadedOut = carts.spawnCart(6, { x: 0.5, y: 0.5, z: 0.5, command: { command: "say hi", lastOutput: '{"text":"x"}' } }, { seed: 1 });
  assert.equal(loadedOut.command.watch24, '"x"'); // fk.a re-serializes the old {"text":"x"} as the bare string (cmd-output-reference.json loads)
  assert.equal(rows.writeNoOutput[1], "");
});
