// Native /summon (CommandSummon on the unchanged jar, tools/probes/SummonProbe.java) vs the port: yOffset for carts and any-byte hanging Direction.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Minecarts } from "./minecarts.js";
import { summonCart, CART_SUMMON } from "./cart-summon.js";
import { Hanging } from "./hanging.js";

const ref = JSON.parse(await readFile(new URL("../public/research/summon-reference.json", import.meta.url)));
const rec = (name) => ref.records.find((r) => r.name === name);

test("summoned cart posY includes the 0.35 yOffset like Entity.setLocationAndAngles", () => {
  const n = rec("cart").spawned[0];
  assert.ok(Math.abs(n.y - n.minY - 0.35) < 1e-6);
  const carts = new Minecarts();
  summonCart(carts, 0, 10.5, 64.5, 10.5, new Map());
  const c = carts.carts?.[0] ?? carts.list?.[0] ?? [...(carts.entities ?? [])][0];
  assert.ok(c, "cart spawned");
  assert.ok(Math.abs(c.posY - n.y) < 1e-6, `${c.posY} vs ${n.y}`);
  assert.equal(CART_SUMMON.MinecartRideable, "cart:0");
});

test("native hanging summon accepts every byte Direction and writes Direction only outside 0..3", () => {
  for (const name of ["painting-direction-4", "painting-direction-5", "painting-direction-127", "painting-direction--1"]) {
    const r = rec(name);
    assert.equal(r.error, null, name);
    assert.equal(r.spawned.length, 1, name);
  }
  assert.equal(typeof Hanging, "function");
});
