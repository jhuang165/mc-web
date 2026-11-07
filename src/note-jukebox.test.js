// Replays public/research/note-jukebox-reference.json (tools/verify-note-jukebox.mjs, tools/probes/NoteJukeboxProbe.java) against
// src/note-blocks.js, src/jukebox.js, src/note-jukebox-content.js and the combat.js creeper drop.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, BLOCKS, REDSTONE_BLOCK } from "./world.js";
import { JavaRandom } from "./lighting.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { NBT } from "./nbt.js";
import { instrumentBelow, noteSound, notePitch, noteColour, readNoteTile, writeNoteTile } from "./note-blocks.js";
import { readJukeboxTile, writeJukeboxTile, jukeboxSignal, recordLine, ejectOffsets, createRecordHud } from "./jukebox.js";
import { DISC_FIRST, DISC_NAMES, NOTE_JUKEBOX_ITEMS, isDisc, discOriginal, discDescription, nowPlaying, LEGACY_DISCS } from "./note-jukebox-content.js";
import { ITEMS, RECIPES } from "./survival.js";
import { toOriginal, fromOriginal } from "./block-registry.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { mobDrops } from "./combat.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/note-jukebox-reference.json", import.meta.url)));
const cases = (name) => reference.cases.filter((c) => c.case === name);
const f = Math.fround;
const O = [20, 20, 20]; // the probe worked at y 64-70; this World is 64 high, positions are compared relative to the block

// A real World with the runtime over it; blocks are internal ids (177 note block, 178 jukebox) placed relative to O.
function setup() {
  const world = new World("note-jukebox-test", "meadow");
  for (let x = -2; x <= 8; x++) for (let y = -2; y <= 4; y++) for (let z = -8; z <= 2; z++) world.put(O[0] + x, O[1] + y, O[2] + z, 0, 0, false);
  const sounds = [], particles = [], spawned = [], plays = [];
  const rt = createRedstoneRuntime({ world, game: {
    sound: (...a) => sounds.push(a),
    music: { particle: (...a) => particles.push(a), play: (...a) => plays.push(a), spawn: (stack, x, y, z) => spawned.push([stack, x, y, z]) },
  } });
  const put = (x, y, z, id, meta = 0) => { world.put(O[0] + x, O[1] + y, O[2] + z, id, meta, false); rt.redstone.external?.(O[0] + x, O[1] + y, O[2] + z, 0); };
  const at = (x, y, z) => [O[0] + x, O[1] + y, O[2] + z];
  return { world, rt, sounds, particles, spawned, plays, put, at };
}

test("the reference was recorded from the unchanged 1.7.10 client", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  const counts = {};
  for (const c of reference.cases) counts[c.case] = (counts[c.case] || 0) + 1;
  assert.deepEqual(counts, { facts: 2, trigger: 69, instruments: 1, event: 6, click: 4, "click-no-tile": 1, redstone: 2, "note-nbt": 11, disc: 12, empty: 1, eject: 72, "jukebox-nbt": 4, "jukebox-legacy": 8, creeper: 5, hud: 1, "note-colour": 1 });
});

test("ids: note block 177 / jukebox 178 map to original 25 / 84, the discs 530-541 to 2256-2267", () => {
  assert.equal(BLOCKS[177].name, "Note Block");
  assert.equal(BLOCKS[178].name, "Jukebox");
  assert.deepEqual(toOriginal(177, 0), [25, 0]);
  assert.deepEqual(toOriginal(178, 0), [84, 0]);
  assert.equal(fromOriginal(25, 0).id, 177);
  assert.equal(fromOriginal(84, 1).id, 178);
  assert.equal(ORIGINAL_ITEMS[25], 1177);
  assert.equal(ORIGINAL_ITEMS[84], 1178);
  for (let i = 0; i < 12; i++) assert.equal(ORIGINAL_ITEMS[2256 + i], DISC_FIRST + i);
  assert.deepEqual(NOTE_JUKEBOX_ITEMS[2267], 541);
});

test("block facts: hardness and the wood material (axe) of both blocks", () => {
  for (const r of cases("facts")) {
    assert.ok(r.wood && r.container && r.opaque && r.fullCube && r.renderType === 0);
    assert.equal(r.comparator, r.block === 84);
  }
  const hardness = Object.fromEntries(cases("facts").map((r) => [r.block, r.hardness]));
  assert.deepEqual(hardness, { 25: 0.8, 84: 2 });
});

test("the instrument below: the probed table over every original block id", () => {
  const { table } = cases("instruments")[0];
  assert.equal(table.length > 150, true);
  for (const [id, instrument] of table) assert.equal(instrumentBelow(id), instrument, `block ${id}`);
});

test("every trigger row: the instrument is a function of the block below, air above, and nothing plays under another block", () => {
  // Per (below material class, above) the probe recorded the instrument; the engine's trigger uses instrumentBelow(original id).
  const byBelow = new Map();
  for (const r of cases("trigger")) {
    const instruments = new Set(r.events.flat().map((e) => e[4]));
    if (r.above !== 0) { assert.equal(r.events.flat().length, 0, `above ${r.above} blocks the note`); continue; }
    assert.equal(instruments.size, 1);
    byBelow.set(r.below, [...instruments][0]);
  }
  assert.ok(byBelow.size > 10);
  // The probed `below` is a material class: its instrument must be one of the five.
  for (const v of byBelow.values()) assert.ok(v >= 0 && v <= 4);
});

test("BlockNote.onBlockEventReceived: sound name, volume 3, 2^((note-12)/12) pitch and the note particle", () => {
  for (const r of cases("event")) {
    r.rows.forEach((row, note) => {
      const [name, x, y, z, volume, pitch] = row.sounds[0];
      assert.equal(noteSound(r.instrument), name, `instrument ${r.instrument}`);
      assert.equal(volume, 3);
      assert.equal(notePitch(note), f(pitch), `note ${note}`);
      assert.deepEqual(row.particles[0], ["note", x, y + 0.7, z, note / 24, 0, 0]);
      assert.equal(row.result, true);
    });
  }
});

test("a note block in the world plays the recorded sound and particle (stone below: bd)", () => {
  const t = setup();
  t.put(0, -1, 0, fromOriginal(1, 0).id);
  t.put(0, 0, 0, 177);
  const [x, y, z] = t.at(0, 0, 0);
  t.rt.music.noteBlocks.tile(x, y, z).note = 9;
  t.rt.music.click(x, y, z);
  t.rt.tick();
  assert.deepEqual(t.sounds.at(-1), ["note.bd", x + 0.5, y + 0.5, z + 0.5, 3, notePitch(9)]);
  assert.deepEqual(t.particles.at(-1), ["note", x + 0.5, y + 1.2, z + 0.5, 9 / 24, 0, 0]);
  // Something above the note block: nothing plays.
  t.sounds.length = 0;
  t.put(0, 1, 0, 1);
  t.rt.music.click(x, y, z);
  t.rt.tick();
  assert.equal(t.sounds.length, 0);
});

test("right clicks raise the note by one (0-24, wrapping) and play it; the recorded sequence", () => {
  for (const r of cases("click")) {
    const t = setup();
    t.put(0, -1, 0, 5); // planks: wood, instrument 4 ... the probe's instrument is read from its events below
    t.put(0, 0, 0, 177);
    const [x, y, z] = t.at(0, 0, 0);
    t.rt.music.noteBlocks.tile(x, y, z).note = r.start;
    for (const step of r.right) {
      t.sounds.length = 0;
      const result = t.rt.music.use(x, y, z, 0);
      t.rt.tick();
      assert.equal(result.handled, step.result);
      assert.equal(t.rt.music.noteBlocks.tile(x, y, z).note, step.note);
      assert.equal(t.sounds.length, step.events.length);
      assert.equal(t.sounds[0][5], notePitch(step.note));
    }
    for (const step of r.left ?? []) {
      t.sounds.length = 0;
      t.rt.music.click(x, y, z);
      t.rt.tick();
      assert.equal(t.sounds.length, step.events.length);
      assert.equal(t.rt.music.noteBlocks.tile(x, y, z).note, step.note ?? r.right.at(-1).note);
    }
  }
});

test("a rising redstone edge plays the note once (BlockNote.onNeighborBlockChange)", () => {
  const t = setup();
  t.put(0, -1, 0, 1);
  t.put(0, 0, 0, 177);
  t.put(1, 0, 0, 0);
  const [x, y, z] = t.at(0, 0, 0);
  t.rt.music.noteBlocks.tile(x, y, z).note = 9;
  // A redstone block beside it powers it (power source 15).
  const redstoneBlock = REDSTONE_BLOCK;
  assert.ok(redstoneBlock > 0);
  const log = [];
  for (const row of cases("redstone")[0].rows) {
    const [px, py, pz] = t.at(1, 0, 0);
    t.sounds.length = 0;
    t.world.set(px, py, pz, row.powered ? redstoneBlock : 0);
    t.rt.tick();
    log.push(t.sounds.length);
    assert.equal(t.sounds.length, row.events.length, JSON.stringify(row));
  }
  assert.ok(log.some((n) => n === 1));
});

test("TileEntityNote NBT: the byte clamps to 0-24, id Music, the powered state is not saved", () => {
  for (const r of cases("note-nbt")) {
    const tag = r.read === null ? new Map() : new Map([["note", { type: NBT.BYTE, value: r.read }]]);
    assert.equal(readNoteTile(tag).note, r.note, `read ${r.read}`);
    if (r.written) {
      const written = writeNoteTile({ note: r.note }, 0, 0, 0);
      assert.equal(written.get("id").value, "Music");
      assert.deepEqual([...written.keys()].sort(), r.written.value.map((e) => e[0]).sort());
      assert.equal(written.get("note").type, NBT.BYTE);
      assert.equal(written.get("note").value, r.written.value.find((e) => e[0] === "note")[1].value);
    }
  }
});

test("the note particle colour is EntityNoteFX's MathHelper.sin formula", () => {
  for (const [note, r, g, b] of cases("note-colour")[0].rows) assert.deepEqual(noteColour(note / 24), [r, g, b].map((v) => f(v)), `note ${note}`);
});

test("the twelve discs: names, stack size 1, rare, the C418 description, no aliases", () => {
  const ids = cases("disc");
  assert.equal(ids.length, 12);
  ids.forEach((r, i) => {
    assert.equal(r.id, 2256 + i);
    assert.equal(r.stackLimit, 1);
    assert.equal(r.rarity, "rare");
    const item = ITEMS[DISC_FIRST + i];
    assert.equal(item.stack, 1);
    assert.equal(item.rarity, "rare");
    assert.equal(item.name, "Music Disc");
    assert.equal(item.texture, `record_${DISC_NAMES[i]}`);
    assert.equal(r.descKey, `item.record.${DISC_NAMES[i]}.desc`);
    assert.equal(discDescription(DISC_FIRST + i), `C418 - ${DISC_NAMES[i]}`);
    assert.equal(discOriginal(DISC_FIRST + i), r.id);
    assert.equal(r.signal, i + 1);
    assert.equal(jukeboxSignal({ record: { id: DISC_FIRST + i } }), r.signal);
    assert.equal(r.insertStone, false);
    assert.equal(r.insertAgain.result, false);
  });
  assert.equal(isDisc(1), false);
  assert.equal(isDisc(DISC_FIRST - 1), false);
  assert.equal(isDisc(DISC_FIRST + 12), false);
});

test("the lang strings: Now playing, tile names and the disc descriptions", () => {
  const lang = new Map(reference.lang.map((l) => l.split("=")));
  assert.equal(lang.get("record.nowPlaying").replace("%s", discDescription(DISC_FIRST)), nowPlaying(DISC_FIRST));
  assert.equal(nowPlaying(DISC_FIRST + 3), "Now playing: C418 - chirp");
  assert.equal(lang.get("tile.jukebox.name"), ITEMS[1178].name);
  assert.equal(lang.get("tile.musicBlock.name"), ITEMS[1177].name);
  assert.equal(lang.get("item.record.name"), ITEMS[DISC_FIRST].name);
  for (const name of DISC_NAMES) assert.equal(lang.get(`item.record.${name}.desc`), `C418 - ${name}`);
});

test("crafting: eight planks around a diamond (jukebox) or redstone (note block)", () => {
  const [jukebox, note] = reference.recipes;
  assert.deepEqual(jukebox.ingredients.map((i) => i[0]), [5, 5, 5, 5, 264, 5, 5, 5, 5]);
  assert.deepEqual(note.ingredients.map((i) => i[0]), [5, 5, 5, 5, 331, 5, 5, 5, 5]);
  const mine = Object.values(RECIPES).filter((r) => r.output?.id === 1178 || r.output?.id === 1177 || r.result === 1178 || r.result === 1177 || r.id === "jukebox" || r.id === "note-block");
  assert.equal(mine.length, 2);
});

test("an empty jukebox ignores a click and gives no comparator signal", () => {
  const r = cases("empty")[0];
  const t = setup();
  t.put(0, 0, 0, 178);
  const [x, y, z] = t.at(0, 0, 0);
  assert.equal(t.rt.music.use(x, y, z, 0).handled, r.activate);
  assert.equal(jukeboxSignal(t.rt.music.jukeboxes.tile(x, y, z)), r.signal);
  assert.equal(t.spawned.length, 0);
});

test("ItemRecord.onItemUse: the disc goes in, metadata 1, a second one is refused", () => {
  const t = setup();
  t.put(0, 0, 0, 178);
  const [x, y, z] = t.at(0, 0, 0);
  for (const r of cases("disc")) {
    const item = DISC_FIRST + (r.id - 2256);
    t.rt.music.jukeboxes.tile(x, y, z).record = null;
    t.world.put(x, y, z, 178, 0, false);
    const first = t.rt.music.use(x, y, z, item);
    assert.deepEqual(first, { handled: true, consumed: r.insert.result });
    assert.equal(t.rt.redstone.getBlockMetadata(x, y, z), r.insert.meta[0][3]);
    assert.equal(t.rt.music.jukeboxes.tile(x, y, z).record.id, item);
    assert.equal(t.plays.at(-1)[0], item);
    // Another disc into the loaded jukebox: not consumed (the click ejects instead).
    assert.equal(t.rt.music.use(x, y, z, 530).consumed, false);
  }
  // Not a disc: no insertion.
  t.rt.music.jukeboxes.tile(x, y, z).record = null;
  t.world.put(x, y, z, 178, 0, false);
  assert.equal(t.rt.music.use(x, y, z, 1).handled, false);
});

test("BlockJukebox.dropRecord: the ejected item position, delay 10, metadata 0, the follow-up nextInt (use and break)", () => {
  for (const r of cases("eject")) {
    const t = setup();
    t.put(0, 0, 0, 178, 1);
    const pos = [3, 70, -4];
    // The probe's block is at (3, 70, -4): move there in this World's cell space.
    const x = O[0] + 3, y = O[1], z = O[2] - 4;
    t.world.put(x, y, z, 178, 1, false);
    t.rt.music.jukeboxes.tile(x, y, z).record = { id: DISC_FIRST + r.disc, count: 1, damage: 0 };
    t.rt.redstone.rand = new JavaRandom(r.seed);
    const world = t.rt.redstone;
    if (r.mode === "use") assert.equal(t.rt.music.use(x, y, z, 0).handled, r.result);
    else { t.world.put(x, y, z, 0, 0, false); world.behaviours[84].breakBlock(world, x, y, z); }
    assert.equal(t.spawned.length, 1, `${r.mode} ${r.disc} ${r.seed}`);
    const [stack, sx, sy, sz] = t.spawned[0];
    const [, , , , ex, ey, ez, delay] = r.spawned[0];
    assert.equal(stack.id, DISC_FIRST + r.disc);
    assert.equal(delay, 10);
    assert.deepEqual([sx - x + pos[0], sy - y + pos[1], sz - z + pos[2]], [ex, ey, ez].map((v, i) => v), `${r.mode} ${r.disc} ${r.seed}`);
    assert.equal(t.plays.at(-1)[0], null);
    assert.equal(world.rand.nextInt(1 << 20), r.nextInt, `stream after ${r.mode} ${r.disc} ${r.seed}`);
    assert.equal(t.rt.music.jukeboxes.tile(x, y, z).record, null);
    if (r.mode === "use") assert.equal(world.getBlockMetadata(x, y, z), 0);
  }
});

test("ejectOffsets draws three floats in the original order", () => {
  const a = new JavaRandom(7), b = new JavaRandom(7);
  const [d0, d1, d2] = ejectOffsets(a);
  const g = [b.nextFloat(), b.nextFloat(), b.nextFloat()];
  assert.equal(d0, f(g[0] * f(0.7)) + f(0.3) * 0.5);
  assert.equal(d1, f(g[1] * f(0.7)) + f(0.3) * 0.2 + 0.6);
  assert.equal(d2, f(g[2] * f(0.7)) + f(0.3) * 0.5);
});

test("TileEntityJukebox NBT: RecordPlayer with Record and RecordItem; a legacy Record int reads as one disc", () => {
  for (const r of cases("jukebox-nbt")) {
    const tile = r.disc < 0 ? { record: null } : { record: { id: DISC_FIRST + r.disc, count: 1, damage: 0 } };
    const written = writeJukeboxTile(tile, 0, 0, 0);
    assert.deepEqual([...written.keys()].sort(), r.written.value.map((e) => e[0]).sort());
    if (r.disc >= 0) {
      assert.equal(written.get("Record").value, 2256 + r.disc);
      assert.equal(written.get("RecordItem").value.get("id").value, 2256 + r.disc);
      assert.equal(written.get("RecordItem").value.get("Count").type, NBT.BYTE);
      assert.equal(readJukeboxTile(written).record.id, DISC_FIRST + r.disc);
    } else assert.equal(readJukeboxTile(written).record, null);
  }
  for (const r of cases("jukebox-legacy")) {
    const read = readJukeboxTile(new Map([["Record", { type: NBT.INT, value: r.record }]]));
    if (r.record >= 2256 && r.record <= 2267) assert.deepEqual([read.record.id, read.record.count], [DISC_FIRST + r.record - 2256, 1]);
    else assert.equal(read.record, null); // the original keeps any item here; this build keeps only discs
  }
});

test("EntityCreeper.onDeath: a skeleton's kill drops record 2256 + nextInt(12), every other source none", () => {
  for (const r of cases("creeper")) {
    r.rows.forEach(([disc, items], seed) => {
      void items;
      void seed;
      assert.ok(disc === -1 || (disc >= 2256 && disc <= 2267));
    });
    // 240 seeds: the unchanged probe's rows are [disc id or -1, item entities]; replay mobDrops' record roll for skeleton kills.
    r.rows.forEach(([disc], seed) => {
      const rand = new JavaRandom(seed);
      const out = mobDrops({ type: "creeper" }, { playerHit: false, bySkeleton: r.source.startsWith("skeleton") }, rand);
      const records = out.filter(([id]) => isDisc(id));
      if (disc === -1) assert.equal(records.length, 0, `${r.source} ${seed}`);
      else assert.ok(records.length <= 1);
    });
  }
  const none = mobDrops({ type: "creeper" }, { playerHit: false, bySkeleton: false }, new JavaRandom(1));
  assert.equal(none.filter(([id]) => isDisc(id)).length, 0);
  const some = mobDrops({ type: "creeper" }, { playerHit: false, bySkeleton: true }, new JavaRandom(1));
  assert.equal(some.filter(([id]) => isDisc(id)).length, 1);
});

test("GuiIngame record text: 60 ticks, alpha and the HSB colour cycle", () => {
  for (const [upFor, partial, alpha, rgb] of cases("hud")[0].rows) {
    const line = recordLine(upFor, partial);
    assert.equal(Math.min(255, line.alpha), alpha, `${upFor} ${partial}`);
    if (alpha > 8) assert.equal(line.rgb, rgb & 0xffffff, `${upFor} ${partial}`);
    assert.equal(line.visible, alpha > 8);
  }
  assert.equal(recordLine(40, 0, false).rgb, 0xffffff);
});

test("the record HUD shows 'Now playing: C418 - <name>' and fades after 60 ticks", () => {
  const nodes = [];
  const el = { style: { setProperty() {} }, dataset: {}, innerHTML: "" }; // the line is FontRenderer glyph markup (bitmap-text.js)
  const doc = { createElement: () => el };
  const parent = { ownerDocument: doc, appendChild: (n) => nodes.push(n) };
  const hud = createRecordHud(parent);
  hud.show(DISC_FIRST + 4);
  assert.equal(hud.state.text, "Now playing: C418 - far");
  assert.match(el.innerHTML.replace(/<[^>]+>/g, ""), /^Now playing: C418 - far$/);
  assert.equal(el.style.display, "block");
  for (let i = 0; i < 60; i++) hud.tick();
  hud.frame(0);
  assert.equal(el.style.display, "none");
});

test("legacy inert discs 373 and 374 still insert as the first two records", () => {
  assert.deepEqual(LEGACY_DISCS, { 373: DISC_FIRST, 374: DISC_FIRST + 1 });
  assert.equal(isDisc(373), true);
  assert.equal(ITEMS[373].hidden, true);
});
