// Batch 79 catalogue79: facts the regenerated catalogues now state, pinned against the executed record and the code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { difficultyLocked } from "./hardcore.js";

const research = new URL("../public/research/", import.meta.url);
const read = (name) => readFile(new URL(name, research), "utf8");

test("item catalogue: technical block ids have a native ItemBlock (executed Item.getItemFromBlock)", async () => {
  const ref = JSON.parse(await read("item-form79-reference.json"));
  assert.equal(ref.technical.length, 19);
  for (const row of ref.technical) assert(row.item && row.item.id === row.block, `block ${row.block} has an ItemBlock of the same id`);
  const catalogue = await read("item-parity-catalogue.md");
  assert(!catalogue.includes("no item form natively"));
  for (const { block } of ref.technical) {
    const line = catalogue.split("\n").find((l) => l.startsWith(`| ${block} | minecraft:`));
    assert(line, `row ${block}`);
    assert(line.includes("native ItemBlock exists") && line.includes("item-form79-reference.json"), line.slice(0, 120));
  }
});

test("settings catalogue: anaglyph converts at the native points and the hardcore difficulty lock exists", async () => {
  const text = await read("settings-parity-catalogue.md");
  const row = (key) => text.split("\n").find((l) => l.startsWith("|") && l.includes(` ${key} `));
  assert(!row("ANAGLYPH").includes("applied to final pixels"));
  assert(row("ANAGLYPH").includes("native points"));
  assert(row("DIFFICULTY").includes("difficultyLocked"));
  assert.equal(difficultyLocked({ hardcore: true }), true);
  assert.equal(difficultyLocked({ hardcore: false }), false);
});
