import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DYE } from './world.js';
import { craftingResult } from './survival.js';
import { leatherDyeResult, mixLeatherColors } from './leather-dye.js';
import { makeStack, PlayerInventory, sameStackItem } from './inventory.js';

const armor = (id = 400, metadata) => makeStack(id, 1, 0, undefined, metadata);
const dye = (damage) => makeStack(DYE, 1, damage);

test('native leather armor special recipe replays every unchanged Java fixture', async () => {
  const ref = JSON.parse(await readFile(new URL('../public/research/leather-dye-reference.json', import.meta.url)));
  assert.equal(ref.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
  assert.equal(ref.records.length, 324);
  for (const fixture of ref.records) {
    const cells = fixture.input.map((input) => input.kind === 'armor' ? armor(input.id, input.color === undefined ? undefined : { color: input.color })
      : input.kind === 'dye' ? dye(input.damage) : makeStack(input.id));
    const result = leatherDyeResult(cells);
    assert.equal(!!result, fixture.output, fixture.name);
    if (result) {
      assert.equal(result.id, fixture.input.find((input) => input.kind === 'armor').id, fixture.name);
      assert.equal(result.count, 1, fixture.name);
      assert.equal(result.color, fixture.color, fixture.name);
    }
  }
  const tagged = craftingResult([armor(400, { displayName: 'dyed', repairCost: 3 }), dye(1)], 2);
  assert.equal(tagged.displayName, 'dyed'); assert.equal(tagged.repairCost, 3);
  assert.equal(craftingResult([armor(400), armor(401), dye(1)], 3), null);
  assert.equal(craftingResult([armor(400), makeStack(351, 1, 16)], 2), null);
  assert.equal(craftingResult([armor(400), makeStack(302)], 2), null);
});

test('leather color is part of ItemStack copy, validation, merge identity, and re-dye mixing', () => {
  assert.equal(mixLeatherColors([0x000000, 0xFFFFFF]), 0x7F7F7F);
  const inv = new PlayerInventory({ 400: { stack: 1 }, 404: { stack: 1 } }, [makeStack(400, 1, 0, undefined, { color: 0x123456 })]);
  const copied = inv.read(inv.main[0]);
  assert.equal(copied.color, 0x123456);
  assert.equal(sameStackItem(copied, makeStack(400, 1, 0, undefined, { color: 0x123456 })), true);
  assert.equal(sameStackItem(copied, makeStack(400, 1)), false);
  assert.equal(inv.read({ id: 400, count: 1, color: 0x1000000 }).color, undefined);
});
