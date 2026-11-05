// Note block (original 25), jukebox (original 84) and the twelve music discs (original 2256-2267), Java 1.7.10.
// Ids are fixed by the track allocation: internal blocks 177-178 (items 1177-1178 = 1000 + block id) and disc items 530-541.
// The module imports nothing so world.js, survival.js and the tools can all read it. Values: public/research/note-jukebox-reference.json,
// notes in public/research/note-jukebox.md.
export const NOTE_BLOCK = 177, JUKEBOX = 178, NOTE_BLOCK_ITEM = 1177, JUKEBOX_ITEM = 1178;
export const NOTE_BLOCK_ORIGINAL = 25, JUKEBOX_ORIGINAL = 84;
export const DISC_ORIGINAL_FIRST = 2256, DISC_FIRST = 530, DISC_COUNT = 12;
// ItemRecord.field_150928_b: the record names (record_<name> texture, item.record.<name>.desc, sound records.<name>).
export const DISC_NAMES = ['13', 'cat', 'blocks', 'chirp', 'far', 'mall', 'mellohi', 'stal', 'strad', 'ward', '11', 'wait'];
export const DISC_ITEMS = Object.freeze(DISC_NAMES.map((_, i) => DISC_FIRST + i));
// The legacy inert discs of earlier builds (original 2256 and 2257 used to be internal 373 and 374); the jukebox still accepts them.
export const LEGACY_DISCS = Object.freeze({ 373: DISC_FIRST, 374: DISC_FIRST + 1 });
// Original item id -> internal item id, spread into original-items.js and tools/inventory-replay.mjs after the older tables.
export const NOTE_JUKEBOX_ITEMS = Object.freeze({
  [NOTE_BLOCK_ORIGINAL]: NOTE_BLOCK_ITEM,
  [JUKEBOX_ORIGINAL]: JUKEBOX_ITEM,
  ...Object.fromEntries(DISC_NAMES.map((_, i) => [DISC_ORIGINAL_FIRST + i, DISC_FIRST + i])),
});
export const isDisc = (item) => (item >= DISC_FIRST && item < DISC_FIRST + DISC_COUNT) || item in LEGACY_DISCS;
export const canonicalDisc = (item) => LEGACY_DISCS[item] ?? item;
// Internal disc item -> original item id, and its index 0-11 (the comparator signal is index + 1).
export const discOriginal = (item) => (isDisc(item) ? DISC_ORIGINAL_FIRST + canonicalDisc(item) - DISC_FIRST : 0);
export const discIndex = (item) => canonicalDisc(item) - DISC_FIRST;
export const discName = (item) => DISC_NAMES[discIndex(item)];
// ItemRecord.addInformation: item.record.<name>.desc is "C418 - <name>" in en_US.lang; the HUD line is record.nowPlaying with it.
export const discDescription = (item) => `C418 - ${discName(item)}`;
export const nowPlaying = (item) => `Now playing: ${discDescription(item)}`;

// World.BLOCKS grows to index 178: internal ids 140-176 belong to the other tracks of this release, so any that are not defined by
// the time this runs stay reserved placeholders (never listed, mapped or placeable) and 177-178 are the two blocks.
export const RESERVED_UP_TO = 176;
export function installNoteJukeboxBlocks(blocks) {
  while (blocks.length <= RESERVED_UP_TO) blocks.push({ name: `Reserved block ${blocks.length}`, color: '#000000', reserved: true });
  if (blocks.length !== NOTE_BLOCK) throw new Error('note-jukebox-content.js: internal block ids 177-178 are already taken');
  blocks.push({ name: 'Note Block', color: '#8a5a3a' }, { name: 'Jukebox', color: '#6b4a35' });
}
// Items: the block items 1177/1178, the discs, the legacy discs hidden. Reserved placeholder blocks and the stray block-index
// items 177/178 are removed (a block above 99 is an item only through 1000 + its id).
export function installNoteJukeboxItems(items) {
  for (const id of Object.keys(items)) if (items[id].reserved) delete items[id];
  delete items[NOTE_BLOCK]; delete items[JUKEBOX];
  items[NOTE_BLOCK_ITEM] = { id: NOTE_BLOCK_ITEM, name: 'Note Block', color: '#8a5a3a', block: true, stack: 64 };
  items[JUKEBOX_ITEM] = { id: JUKEBOX_ITEM, name: 'Jukebox', color: '#6b4a35', block: true, stack: 64 };
  // ItemRecord: stack size 1, rarity rare (aqua name), addInformation line item.record.<name>.desc, no placement (onItemUse is the jukebox).
  DISC_NAMES.forEach((name, i) => {
    const id = DISC_FIRST + i;
    items[id] = { id, name: 'Music Disc', texture: `record_${name}`, stack: 1, color: '#2f2f2f', record: true, rarity: 'rare', description: `C418 - ${name}` };
  });
  for (const id of Object.keys(LEGACY_DISCS)) if (items[id]) items[id].hidden = true;
}
// BlockNote (wood: hardness 0.8, axe) and BlockJukebox (hardness 2, resistance 10 in the table, wood: axe); both drop themselves.
export function installNoteJukeboxMaterials(materials) {
  materials[NOTE_BLOCK] = { hardness: 0.8, kind: 'axe', drop: NOTE_BLOCK_ITEM };
  materials[JUKEBOX] = { hardness: 2, kind: 'axe', drop: JUKEBOX_ITEM };
}
// CraftingManager (public/research/recipe-registry-reference.json 68 and 70): eight planks around a diamond or redstone.
export function installNoteJukeboxRecipes({ recipe }, { planks = 7, diamond = 303, redstone = 360 } = {}) {
  recipe('jukebox', 'Jukebox', ['PPP', 'PDP', 'PPP'], { P: planks, D: diamond }, JUKEBOX_ITEM);
  recipe('note-block', 'Note Block', ['PPP', 'PRP', 'PPP'], { P: planks, R: redstone }, NOTE_BLOCK_ITEM);
}
