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
    const readers = b.bytecode.unprobedMetadataReaders.length;
    const grouped = b.groups.flatMap((g) => g.values);
    assert.equal(new Set(grouped).size, grouped.length, `${b.name} groups overlap`);
    for (const g of b.groups) assert.deepEqual(g.values, [...g.values].sort((x, y) => x - y));
    for (const v of b.values) {
      const where = `${b.name}:${v.meta}`;
      if (v.category === "alias") {
        assert.equal(readers, 0, `${where} alias with unprobed metadata readers`);
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
    const surfaces = new Set(b.groups.map((g) => JSON.stringify(g.differsFromFirstGroup)));
    assert.equal(surfaces.size, b.groups.length, `${b.name} duplicate group surface`);
  }
});

test("known native facts", () => {
  const cat = (id, meta) => reference.blocks.find((b) => b.id === id).values[meta];
  assert.equal(cat(1, 0).category, "semantic");
  for (let m = 1; m < 16; m++) assert.deepEqual([cat(1, m).category, cat(1, m).aliasOf], ["alias", 0]);
  for (let m = 0; m < 16; m++) assert.equal(cat(35, m).category, "semantic"); // wool colour
  for (let m = 0; m < 4; m++) assert.equal(cat(17, m).category, "semantic"); // log type
  assert.equal(cat(59, 7).category, "semantic"); // crop age 7
  assert.equal(cat(59, 9).category, "unclassified"); // crop value above age 7: tick behavior not executed
});

test("catalogue markdown is the deterministic render of the reference", () => {
  const md = text("block-metadata-catalogue.md");
  assert.equal(md, render(reference, browserStatus(fromOriginal)));
  const total = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const b of reference.blocks) for (const v of b.values) total[v.category]++;
  assert.equal(CATEGORIES.reduce((n, c) => n + total[c], 0), 2736);
  assert.ok(md.includes(`**${total.semantic} semantic**, **${total.alias} alias**, **${total.invalid} invalid**, **${total.unclassified} unclassified**`));
});
