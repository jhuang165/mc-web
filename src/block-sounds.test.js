import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SOUND_TYPES, ORIGINAL_SOUND_TYPE, soundTypeKey, soundTypeOf, breakSound, placeSound, hitSound, hoeSound, footstepSound, placesSilently, soundFamily } from "./block-sounds.js";
import { toOriginal } from "./block-registry.js";
import { blockSound, stepSound } from "./audio.js";
import { REDSTONE_SOUND } from "./redstone-blocks.js";
import { SOUND2, BREAK_PITCH2 } from "./redstone-blocks-2.js";
import { HOPPER, HOPPER_SOUND } from "./hopper.js";
import { BLOCKS, WATER, LAVA, SNOW_LAYER, LADDER, ANVIL, WOODEN_DOOR, IRON_DOOR, REDSTONE_BLOCK } from "./world.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/block-sounds-reference.json", import.meta.url), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("../public/audio/1.7.10/manifest.json", import.meta.url), "utf8"));
const f = Math.fround;
const KEY = Object.fromEntries(Object.keys(SOUND_TYPES).map((k) => [SOUND_TYPES[k].field, k]));
const byOriginal = new Map(reference.blocks.map((b) => [b.id, b]));
const internalIds = Array.from({ length: 1024 }, (_, i) => i).filter((i) => toOriginal(i, 0));

test("the reference covers the pinned client and every registered original block", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(reference.blocks.length, 171);
  assert.equal(reference.types.length, 12);
  assert.equal(reference.callSites.length, 8);
});

test("the twelve SoundType constants equal the original Block.soundType* fields", () => {
  for (const t of reference.types) {
    const mine = SOUND_TYPES[KEY[t.field]];
    assert.ok(mine, t.field);
    assert.deepEqual([mine.name, mine.volume, mine.frequency, mine.break, mine.step, mine.place], [t.name, t.volume, t.frequency, t.break, t.step, t.place], t.field);
  }
});

test("every original block maps to the SoundType its stepSound field holds", () => {
  for (const b of reference.blocks) assert.equal(SOUND_TYPES[ORIGINAL_SOUND_TYPE[b.id]].field, b.type, `original ${b.id} (${b.blockClass})`);
  assert.equal(Object.keys(ORIGINAL_SOUND_TYPE).length, reference.blocks.length);
});

test("every internal block resolves to its original block's native SoundType and formulas", () => {
  assert.equal(internalIds.length, BLOCKS.length, "every internal block id maps to an original block");
  for (const id of internalIds) {
    const [mc] = toOriginal(id, 0), native = byOriginal.get(mc);
    assert.ok(native, `internal ${id} -> original ${mc} is not registered`);
    const t = soundTypeOf(id);
    assert.equal(t.field, native.type, `internal ${id} / original ${mc}`);
    // The call-site formulas applied to the probed accessors and the probed float volume/frequency.
    assert.deepEqual(breakSound(id), { name: native.break, volume: f(f(native.volume + 1) / 2), pitch: f(native.frequency * f(0.8)) }, `break ${id}`);
    assert.deepEqual(placeSound(id), { name: native.place, volume: f(f(native.volume + 1) / 2), pitch: f(native.frequency * f(0.8)) }, `place ${id}`);
    assert.deepEqual(hitSound(id), { name: native.step, volume: f(f(native.volume + 1) / 8), pitch: f(native.frequency * f(0.5)) }, `hit ${id}`);
    assert.deepEqual(hoeSound(id), { name: native.step, volume: f(f(native.volume + 1) / 2), pitch: f(native.frequency * f(0.8)) }, `hoe ${id}`);
    const liquid = mc >= 8 && mc <= 11;
    assert.deepEqual(footstepSound(id), liquid ? null : { name: native.step, volume: f(native.volume * f(0.15)), pitch: native.frequency }, `step ${id}`);
  }
});

test("call-site bytecode windows match the formulas", () => {
  const sites = Object.fromEntries(reference.callSites.map((s) => [s.class, s]));
  const half = ["1.0", "fadd", "2.0", "fdiv"];
  assert.deepEqual(sites.bma.tokens, ["ajm.a", "ajm.c", ...half, "ajm.d", "0.8", "fmul"]);
  for (const c of ["abh", "abi", "aec", "aeg"]) assert.deepEqual(sites[c].tokens, ["ajm.b", "ajm.c", ...half, "ajm.d", "0.8", "fmul"], c);
  assert.deepEqual(sites.ada.tokens, ["ajm.e", "ajm.c", ...half, "ajm.d", "0.8", "fmul"]);
  assert.deepEqual(sites.bje.tokens, ["ajm.e", "ajm.c", "1.0", "fadd", "8.0", "fdiv", "ajm.d", "0.5", "fmul"]);
  assert.deepEqual(sites.sa.tokens, ["ajm.e", "ajm.c", "0.15", "fmul", "ajm.d"]);
  assert.equal(sites.sa.windows, 2, "snow-layer branch and ordinary branch");
  assert.deepEqual(Object.keys(reference.silentItems).sort(), ["abg", "acj", "ach", "adv", "adw", "adz", "ads", "aeb"].sort());
});

test("powered, detector and activator rails, iron blocks and anvils use the metal and anvil types (the former pitch gap)", () => {
  for (const id of [135, 136, 137]) {
    assert.equal(soundTypeKey(id), "metal", `internal ${id}`);
    assert.deepEqual(breakSound(id), { name: "dig.stone", volume: 1, pitch: f(1.5 * f(0.8)) });
    assert.equal(placeSound(id).pitch, f(1.5 * f(0.8)));
    assert.equal(hitSound(id).pitch, f(1.5 * f(0.5)));
    assert.equal(footstepSound(id).pitch, 1.5);
  }
  for (const [mc, label] of [[42, "iron block"], [41, "gold block"], [57, "diamond block"], [71, "iron door"], [101, "iron bars"], [66, "rail"], [152, "redstone block"], [133, "emerald block"], [52, "spawner"]])
    for (const id of internalIds.filter((i) => toOriginal(i, 0)[0] === mc)) assert.equal(soundTypeKey(id), "metal", label);
  assert.equal(soundTypeKey(REDSTONE_BLOCK), "metal");
  assert.equal(soundTypeKey(ANVIL), "anvil");
  assert.deepEqual(placeSound(ANVIL), { name: "random.anvil_land", volume: f(f(0.3 + 1) / 2), pitch: f(0.8) });
  assert.deepEqual(breakSound(ANVIL), { name: "dig.stone", volume: f(f(0.3 + 1) / 2), pitch: f(0.8) });
  assert.deepEqual(hitSound(ANVIL), { name: "step.anvil", volume: f(f(0.3 + 1) / 8), pitch: f(0.5) });
});

test("glass, ladder, snow layer and liquids follow the overrides and the Entity.func_145780_a rules", () => {
  const glass = internalIds.find((i) => toOriginal(i, 0)[0] === 20);
  assert.deepEqual([breakSound(glass).name, placeSound(glass).name, hitSound(glass).name, footstepSound(glass).name], ["dig.glass", "step.stone", "step.stone", "step.stone"]);
  assert.deepEqual([breakSound(LADDER).name, placeSound(LADDER).name, hitSound(LADDER).name, footstepSound(LADDER).name], ["dig.wood", "dig.wood", "step.ladder", "step.ladder"]);
  assert.equal(footstepSound(WATER), null);
  assert.equal(footstepSound(LAVA), null);
  assert.equal(footstepSound(1, SNOW_LAYER).name, "step.snow", "a snow layer on top substitutes the snow type");
  assert.equal(footstepSound(WATER, SNOW_LAYER).name, "step.snow", "the snow-layer rule precedes the liquid check");
  assert.equal(footstepSound(1, 0).name, "step.grass");
  assert.equal(footstepSound(1, 0).volume, f(f(0.15)));
});

test("doors, beds, signs, redstone dust, skulls and seeds place silently, everything else plays", () => {
  assert.ok(placesSilently(WOODEN_DOOR) && placesSilently(IRON_DOOR));
  assert.ok(!placesSilently(1) && !placesSilently(ANVIL) && !placesSilently(LADDER));
  for (const id of internalIds) if (placesSilently(id)) assert.ok([26, 55, 59, 63, 64, 68, 71, 104, 105, 115, 141, 142, 144].includes(toOriginal(id, 0)[0]));
});

test("audio.js keeps its family-name vocabulary on top of the table", () => {
  assert.equal(blockSound(135), "stone");
  assert.equal(stepSound(LADDER), "ladder");
  assert.equal(blockSound(LADDER), "wood");
  assert.equal(soundFamily(ANVIL), "stone");
});

test("every sound the table plays exists in the manifest except the anvil's step (undefined in 1.7.10)", () => {
  const names = new Set();
  for (const id of internalIds) for (const s of [breakSound(id), placeSound(id), hitSound(id), hoeSound(id), footstepSound(id), footstepSound(id, SNOW_LAYER)]) if (s) names.add(s.name);
  const missing = [...names].filter((n) => !manifest.events[n]);
  assert.deepEqual(missing, ["step.anvil"]);
});

test("the per-block sound constants of the redstone and hopper modules agree with the table", () => {
  for (const [id, family] of Object.entries({ ...REDSTONE_SOUND, ...SOUND2 })) {
    const t = soundTypeOf(+id);
    // These constants name the dig.* file family of the break sound; the metal redstone block reads "stone" at frequency 1.5.
    assert.equal(family, t.break.slice(4), `internal ${id}`);
    assert.equal(BREAK_PITCH2[id] ?? 1, t.frequency, `internal ${id} frequency`);
  }
  assert.equal(HOPPER_SOUND, soundFamily(HOPPER));
});
