import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { render, browserStatus, CATEGORIES } from "../tools/build-block-metadata-catalogue.mjs";
import { fromOriginal } from "./block-registry.js";

// PLAN-03b: consistency of the native block metadata classification (no JDK needed).
const load = (name) => JSON.parse(readFileSync(new URL(`../public/research/${name}`, import.meta.url)));
const text = (name) => readFileSync(new URL(`../public/research/${name}`, import.meta.url), "utf8");
const reference = load("block-metadata-reference.json");
const registry = load("content-registry-reference.json");

test("reference covers every registered block with 16 classified values", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.deepEqual(reference.blocks.map((b) => [b.id, b.name]), registry.blocks.map((b) => [b.id, b.name]));
  assert.equal(reference.blocks.length * 16, 2736);
  for (const b of reference.blocks) {
    assert.deepEqual(b.values.map((v) => v.meta), [...Array(16).keys()], b.name);
    for (const v of b.values) {
      assert.ok(CATEGORIES.includes(v.category), `${b.name}:${v.meta}`);
      assert.ok(v.evidence.length > 0, `${b.name}:${v.meta} needs evidence`);
    }
    // Creative damages come from the same native getSubBlocks walk as the registry reference.
    const expected = [...new Set(registry.blocks.find((r) => r.id === b.id).variants.map((s) => s.damage))].sort((x, y) => x - y);
    assert.deepEqual(b.creativeDamages, expected, b.name);
  }
});

test("categories follow their definitions", () => {
  for (const b of reference.blocks) {
    // Unprobed metadata readers must have been executed conclusively (or be absent) before any alias is claimed.
    const readers = b.bytecode.unexecutedMetadataReaders.length;
    for (const k of b.bytecode.unprobedMetadataReaders) assert.ok(b.bytecode.readerCoverage[k], `${b.name} ${k} has no coverage record`);
    const tileEntity = b.bytecode.overrides.some((o) => /^(?!aji\.)\w+\.a:\(Lahb;I\)Laor;/.test(o));
    const grouped = b.groups.flatMap((g) => g.values);
    assert.equal(new Set(grouped).size, grouped.length, `${b.name} groups overlap`);
    for (const g of b.groups) assert.deepEqual(g.values, [...g.values].sort((x, y) => x - y));
    for (const v of b.values) {
      const where = `${b.name}:${v.meta}`;
      if (v.category === "alias") {
        assert.equal(readers, 0, `${where} alias with unexecuted metadata readers`);
        assert.ok(!tileEntity, `${where} alias of a tile-entity block`);
        const render = reference.renderTypeReaders[b.baseSurface.renderType];
        assert.ok(!render || !render.endsWith("reads-metadata"), `${where} alias with a metadata-reading render method`);
        assert.ok(v.aliasOf < v.meta, where);
        assert.equal(b.groups.find((x) => x.values.includes(v.meta)).values[0], v.aliasOf, where);
        assert.equal(b.values[v.aliasOf].category, "semantic", `${where} must alias a semantic value`);
      } else {
        assert.equal(v.aliasOf, undefined, where);
      }
      if (v.category === "semantic") {
        assert.ok(grouped.includes(v.meta), where);
        assert.equal(b.groups.find((x) => x.values.includes(v.meta)).values[0], v.meta, `${where} semantic must lead its group`);
      }
      if (v.category === "invalid") assert.match(v.evidence[0], /^native:exception .*(IndexOutOfBounds|ClassCast|NegativeArraySize|ArrayStore)/, where);
      if (v.category === "unclassified") assert.ok(v.reason, `${where} needs a reason`);
      if (v.aliasCandidateOf !== undefined) assert.equal(v.category, "unclassified", where);
    }
    // A later group with the first group's probed surface must differ in executed outcomes.
    b.groups.forEach((g, i) => {
      if (i && !Object.keys(g.differsFromFirstGroup).length) assert.ok(g.executedDiffers > 0, `${b.name} group ${g.values[0]} differs in nothing`);
    });
  }
});

test("known native facts", () => {
  const cat = (id, meta) => reference.blocks.find((b) => b.id === id).values[meta];
  assert.equal(cat(1, 0).category, "semantic");
  for (let m = 1; m < 16; m++) assert.deepEqual([cat(1, m).category, cat(1, m).aliasOf], ["alias", 0]);
  for (let m = 0; m < 16; m++) assert.equal(cat(35, m).category, "semantic"); // wool colour
  for (let m = 0; m < 4; m++) assert.equal(cat(17, m).category, "semantic"); // log type
  assert.equal(cat(59, 7).category, "semantic"); // crop age 7
  // Crop values above age 7: the executed tick/bone-meal behaviour separates 8 and 9 from lower ages; 10-13 match 9.
  assert.equal(cat(59, 9).category, "semantic");
  for (let m = 10; m < 14; m++) assert.deepEqual([cat(59, m).category, cat(59, m).aliasOf], ["alias", 9]);
  for (let m = 0; m < 16; m++) assert.equal(cat(8, m).category, "semantic"); // flowing water level/falling bit
  for (let m = 0; m < 16; m++) assert.equal(cat(20, m).category, "semantic"); // glass compares neighbour metadata
  assert.deepEqual([cat(53, 14).aliasOf, cat(53, 15).aliasOf], [6, 7]); // stairs: bit 8 unused
  // Tile-entity metadata (chest/sign facing) and metadata-reading render methods are not executed: no aliases.
  for (const id of [54, 63, 120, 154]) for (let m = 1; m < 16; m++) assert.notEqual(cat(id, m).category, "alias", `${id}:${m}`);
});

test("render dispatch and outcome normalisation helpers", async () => {
  const { normalise, refineAll } = await import("../tools/block-metadata-classify.mjs");
  assert.equal(reference.renderTypeReaders[0], "blm.q:(Laji;III)Z"); // standard block: no metadata read
  assert.match(reference.renderTypeReaders[26], /reads-metadata$/); // end portal frame
  // Own-item stack damage is ignored symmetrically when stackEcho is set and kept raw otherwise.
  assert.equal(normalise("x |held stack:102:1:0", 102, 0, new Map(), true), normalise("x |held stack:102:1:1", 102, 1, new Map(), true));
  assert.notEqual(normalise("x |held stack:102:1:0", 102, 0, new Map(), false), normalise("x |held stack:102:1:1", 102, 1, new Map(), false));
  // A value that only carries itself into a written cell is not distinct by its number.
  const mk = (outs) => ({ id: 5, itemId: null, nonExcluded: [0, 1, 2], baseKey: () => "b", fields: [{ codes: outs.map((o) => outs.indexOf(o)), outs }] });
  const echo = refineAll([mk(["r |cells 8,64,8=5:0", "r |cells 8,64,8=5:1", "r |cells 8,64,8=5:2"])], true, (b) => b.fields).get(5);
  assert.equal(new Set([0, 1, 2].map((v) => echo.get(v))).size, 1);
  const real = refineAll([mk(["r |cells 8,64,8=5:0", "s |cells 8,64,8=5:1", "r |cells 8,64,8=5:2"])], true, (b) => b.fields).get(5);
  assert.equal(new Set([0, 1, 2].map((v) => real.get(v))).size, 2);
});

test("catalogue markdown is the deterministic render of the reference", () => {
  const md = text("block-metadata-catalogue.md");
  assert.equal(md, render(reference, browserStatus(fromOriginal)));
  const total = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const b of reference.blocks) for (const v of b.values) total[v.category]++;
  assert.equal(CATEGORIES.reduce((n, c) => n + total[c], 0), 2736);
  assert.ok(md.includes(`**${total.semantic} semantic**, **${total.alias} alias**, **${total.invalid} invalid**, **${total.unclassified} unclassified**`));
});
