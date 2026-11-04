import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseJsonNbt, canonicalNbt, NBTException, NBTHang } from "./json-nbt.js";
import { NBT } from "./nbt.js";

const reference = JSON.parse(await readFile(new URL("../public/research/json-nbt-reference.json", import.meta.url)));
const port = (s) => {
  try { return { tag: canonicalNbt(parseJsonNbt(s)) }; }
  catch (e) {
    if (e instanceof NBTHang) return { hang: true };
    if (e instanceof NBTException) return { error: e.message };
    throw e;
  }
};

test("the JsonToNBT reference comes from the 1.7.10 client", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.ok(reference.cases.length >= 119);
  for (const kind of ["tag", "error", "hang"]) assert.ok(reference.cases.some((c) => kind in c), kind);
});

test("every corpus string parses to the native tag, NBTException message, or hang", () => {
  for (const { input, ...native } of reference.cases) assert.deepEqual(port(input), native, JSON.stringify(input));
});

test("parsed tags use the nbt.js tree", () => {
  const tag = parseJsonNbt('{display:{Name:"Sword"},ench:[{id:16s,lvl:5s}],L:1L,A:[1,2]}');
  assert.equal(tag.type, NBT.COMPOUND);
  assert.equal(tag.value.get("display").value.get("Name").value, "Sword");
  const ench = tag.value.get("ench").value;
  assert.equal(ench.elementType, NBT.COMPOUND);
  assert.equal(ench.items[0].get("lvl").value, 5);
  assert.equal(tag.value.get("L").value, 1n);
  assert.ok(tag.value.get("A").value instanceof Int32Array);
});
