// Hardcore mode (hardcore.js): the Create World mode cycle and flags, the game over button set, world deletion keys, difficulty,
// the Select World line, and what a level.dat import carries (hardcore, flying, SpawnForced, Sleeping). Native evidence is
// bytecode-read, not probed (public/research/hardcore.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { NBT } from './nbt.js';
import { HARD } from './difficulty.js';
import { World } from './world.js';
import { BED, wakeSavedSleeper } from './bed.js';
import { worldLines } from './menu-screens.js';
import { importJavaRegionArea } from './region-import.js';
import { importedRuntime } from './world-import.js';
import { readLevelDat } from './level-dat.js';
import {
  createModeState, cycleCreateMode, cheatsButtonEnabled, cheatsShownOn, bonusShownOn, createdWorldFlags, createModeOf,
  worldDifficulty, difficultyLocked, gameOverView, gameOverConfirm, storedWorldIds, deleteWorldStorage, GAME_OVER_ENABLE_TICKS,
} from './hardcore.js';

test('the Create World game mode cycles Survival, Hardcore, Creative and hardcore forces cheats off', () => {
  const s = createModeState();
  assert.equal(s.mode, 'survival');
  cycleCreateMode(s); assert.equal(s.mode, 'hardcore'); assert.equal(s.hardcore, true);
  assert.equal(cheatsButtonEnabled(s), false);
  cycleCreateMode(s); assert.equal(s.mode, 'creative'); assert.equal(s.hardcore, false); assert.equal(s.allowCommands, true);
  assert.equal(cheatsButtonEnabled(s), true);
  cycleCreateMode(s); assert.equal(s.mode, 'survival'); assert.equal(s.allowCommands, false);
});

test('hardcore drops Allow Cheats and the Bonus Chest from the created world and is Survival with the flag', () => {
  const s = createModeState();
  s.allowCommands = true; s.bonus = true; s.manualCommands = true;
  assert.deepEqual(createdWorldFlags(s), { mode: 'survival', hardcore: false, allowCommands: true, bonusChest: true });
  cycleCreateMode(s);
  assert.deepEqual(createdWorldFlags(s), { mode: 'survival', hardcore: true, allowCommands: false, bonusChest: false });
  assert.equal(cheatsShownOn(s), false); assert.equal(bonusShownOn(s), false);
  cycleCreateMode(s);
  assert.deepEqual(createdWorldFlags(s), { mode: 'creative', hardcore: false, allowCommands: true, bonusChest: true });
  assert.equal(createModeOf({ hardcore: true, mode: 'survival' }), 'hardcore');
  assert.equal(createModeOf({ mode: 'creative' }), 'creative');
  assert.equal(createModeOf({ mode: 'survival' }), 'survival');
});

test('a hardcore world is locked to Hard whatever the difficulty option says', () => {
  for (const setting of [0, 1, 2, 3]) assert.equal(worldDifficulty({ hardcore: true }, setting), HARD);
  assert.equal(worldDifficulty({}, 1), 1);
  assert.equal(difficultyLocked({ hardcore: true }), true);
  assert.equal(difficultyLocked({ mode: 'survival' }), false);
  assert.equal(difficultyLocked(null), false);
});

test('the game over screen: hardcore has the single Delete world button, otherwise Respawn and Title screen', () => {
  const hard = gameOverView(true);
  assert.deepEqual(hard.buttons.map((b) => [b.id, b.key]), [[1, 'deathScreen.deleteWorld']]);
  assert.equal(hard.titleKey, 'deathScreen.title.hardcore'); assert.equal(hard.infoKey, 'deathScreen.hardcoreInfo');
  const soft = gameOverView(false);
  assert.deepEqual(soft.buttons.map((b) => [b.id, b.key]), [[0, 'deathScreen.respawn'], [1, 'deathScreen.titleScreen']]);
  assert.equal(GAME_OVER_ENABLE_TICKS, 20);
  assert.equal(gameOverConfirm(true, true), 'title');
  assert.equal(gameOverConfirm(true, false), 'deleteWorld');
  assert.equal(gameOverConfirm(false, false), 'respawn');
});

test('the game over strings exist in the language table', () => {
  const [name, , mode] = worldLines({ id: 'a', name: 'Doomed', hardcore: true, mode: 'survival', updated: 0 }, 0);
  assert.equal(name, 'Doomed');
  assert.equal(mode, 'Hardcore Mode!');
  assert.equal(worldLines({ id: 'b', name: 'Calm', mode: 'survival' }, 1)[2], 'Survival Mode');
});

test('deleting a world removes the world, Nether and End storage ids and reports failures', async () => {
  const record = { id: 'w1' };
  assert.deepEqual(storedWorldIds(record), ['w1', 'w1~-1', 'w1~1']);
  const seen = [];
  assert.deepEqual(await deleteWorldStorage(record, async (id) => { seen.push(id); }), []);
  assert.deepEqual(seen, ['w1', 'w1~-1', 'w1~1']);
  const failed = await deleteWorldStorage(record, async (id) => { if (id === 'w1~-1') throw new Error('x'); });
  assert.deepEqual(failed.map((f) => f.id), ['w1~-1']);
});

// --- level.dat import ---
import { levelDatBytes, playerTag, t } from './level-dat-fixture.js';

test('a hardcore level.dat imports as a hardcore Survival world', async () => {
  const level = await readLevelDat(await levelDatBytes({ hardcore: 1, player: playerTag({ playerGameType: t(NBT.INT, 0) }) }));
  assert.equal(level.hardcore, true);
  const { record, report } = await importJavaRegionArea([], { level, area: { chunkX: -4, chunkZ: -4, width: 1, depth: 1 } });
  assert.equal(record.hardcore, true);
  assert.equal(record.mode, 'survival');
  assert.ok(!report.level.notCarried.some((n) => /hardcore/i.test(n)));
  assert.equal(importedRuntime(record).hardcore, record.hardcore);
});

test('a creative player flying, forced spawn and sleeping state are applied on import', async () => {
  const player = playerTag({
    SpawnX: t(NBT.INT, 20), SpawnY: t(NBT.INT, 71), SpawnZ: t(NBT.INT, 21), SpawnForced: t(NBT.BYTE, 1), Sleeping: t(NBT.BYTE, 1),
  });
  const level = await readLevelDat(await levelDatBytes({ player }));
  const { record, report } = await importJavaRegionArea([], { level, area: { chunkX: -4, chunkZ: -4, width: 1, depth: 1 } });
  assert.equal(record.mode, 'creative');
  assert.equal(record.flying, true);
  assert.equal(record.bed, undefined);
  assert.equal(record.playerSpawn.length, 3);
  assert.equal(record.wakeFromBed.length, 3);
  assert.ok(!report.level.player.lost.some((l) => /abilities\.flying|SpawnForced|Sleeping/.test(l)));
  const runtime = importedRuntime(record);
  assert.equal(runtime.flying, true);
  assert.deepEqual(runtime.playerSpawn, record.playerSpawn);
  assert.deepEqual(runtime.wakeFromBed, record.wakeFromBed);
});

test('an unforced spawn is a bed spawn and Survival players do not keep flying', async () => {
  const player = playerTag({ playerGameType: t(NBT.INT, 0), SpawnX: t(NBT.INT, 9), SpawnY: t(NBT.INT, 70), SpawnZ: t(NBT.INT, 9) });
  const level = await readLevelDat(await levelDatBytes({ player }));
  const { record } = await importJavaRegionArea([], { level, area: { chunkX: -4, chunkZ: -4, width: 1, depth: 1 } });
  assert.equal(record.flying, undefined);
  assert.equal(record.playerSpawn, undefined);
  assert.equal(record.bed.spawn.length, 3);
});

test('wakeSavedSleeper frees the bed and stands the player beside it', () => {
  const world = new World('1', 'meadow');
  assert.equal(wakeSavedSleeper(world, [5, 40, 5]), null);
  world.put(5, 40, 5, BED, 8 | 4);
  const feet = wakeSavedSleeper(world, [5, 40, 5]);
  assert.ok(feet && Number.isFinite(feet.x));
  assert.equal(world.getMeta(5, 40, 5) & 4, 0);
});
