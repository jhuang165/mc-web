// JDK-free catalogue generation from checked-in original-class evidence.
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { MC_IDS } from './inventory-replay.mjs';
import { SEARCH_ORDER } from '../src/creative.js';
import { ITEMS } from '../src/survival.js';
import { internalIdsFor } from '../src/block-registry.js';

const research = new URL('../public/research/', import.meta.url);
// --check runs every assertion (as src/content-catalogue.test.js does) without rewriting the catalogues.
const check = process.argv.includes('--check');
const write = (name, text) => check ? Promise.resolve() : writeFile(new URL(name, research), text);
const read = async name => JSON.parse(await readFile(new URL(name, research)));
const native = await read('content-registry-reference.json');
const creative = await read('creative-reference.json');
const base = await read('block-registry-1.7.10.json');
assert.equal(native.clientSha1, creative.clientSha1);
assert.equal(new Set(native.items.map(i => i.id)).size, native.items.length);
assert.deepEqual(native.blocks.map(b => [b.id, b.name]), base.blocks.map(b => [b.id, `minecraft:${b.name}`]));
const stacks = native.items.flatMap(i => i.variants).concat(native.searchEnchantedBooks);
assert.deepEqual(stacks.map(s => [s.id, s.damage, s.count]), creative.tabs[5].items);
const key = s => `${s.id}:${s.damage}:${s.tag ?? ''}`;
assert.equal(new Set(stacks.map(key)).size, stacks.length, 'Subtype keys must retain NBT');
// A Creative enchanted-book entry is [365, 0, stored]; it is keyed by the StoredEnchantments text the original
// stack carries (the same string creative.test.js compares against searchEnchantedBooks).
const bookTag = stored => `{StoredEnchantments:[${stored.map((s, i) => `${i}:{lvl:${s.lvl}s,id:${s.id}s,},`).join('')}],}`;
const entryKey = e => !Array.isArray(e) ? `${e}:0` : e.length > 2 ? `${e[0]}:${e[1]}:${bookTag(e[2])}` : e.join(':');
const browserSearch = new Set(SEARCH_ORDER.map(entryKey));
// Same subtype rule as `game` in creative.test.js: potions keep their damage on item 385, an explicit
// original id:damage mapping wins, otherwise the base id is used only while the damage is one of the
// browser item's own variants. Nothing is extrapolated past that; NBT is kept in the key.
function mapping(s) {
  let g;
  if (s.id === 373) g = s.damage === 0 ? 385 : [385, s.damage];
  else if (MC_IDS[`${s.id}:${s.damage}`] !== undefined) g = MC_IDS[`${s.id}:${s.damage}`];
  else {
    const internal = MC_IDS[s.id];
    if (internal === undefined || !ITEMS[internal] || [65, 73, 77, 78, 83].includes(internal)) return null;
    g = s.damage === 0 ? internal : s.damage < (ITEMS[internal].variants?.length ?? 1) ? [internal, s.damage] : null;
  }
  if (g == null) return null;
  const [id, damage] = Array.isArray(g) ? g : [g, 0];
  assert(ITEMS[id], `Mapped browser item ${id} must exist`);
  const result = `${id}:${damage}${s.tag != null ? `:${s.tag}` : ''}`;
  assert(browserSearch.has(result), `Mapped subtype ${result} must be listed`);
  return result;
}
const mapped = new Set(stacks.map(mapping).filter(Boolean));
assert.deepEqual([...mapped].sort(), [...browserSearch].sort(), 'Every browser search entry must have an original subtype');
const esc = s => String(s).replaceAll('|', '&#124;').replaceAll('\n', ' ');
// Items with no Creative entry in this build's search list, or whose native variant has no browser item (verified in
// src/survival.js ITEMS and src/world.js block ids; updated for batch 11). Anything not listed keeps the generic status.
const ITEM_MISSING = {
  '386:0': 'Partial; book and quill (internal 2110): recipe, editing and NBT probe-verified, screen bytecode-read (books.md)',
};
const ITEM_TECHNICAL = {
  358: 'Partial; [filled map item](maps-clock.md), unlisted natively',
  387: 'Partial; written book (internal 2111): signing, cloning, tooltip and glint probe-verified, screen bytecode-read (books.md)',
  401: 'Partial; [fireworks rocket](fireworks.md), unlisted natively (configured stacks only)',
  422: 'Partial; [command block minecart](polish.md), unlisted natively',
};
const technicalStatus = id => ITEM_TECHNICAL[id] ?? (id < 256 && internalIdsFor(id).length ? 'Partial; technical block registration, browser block mapped (see [block catalogue](block-parity-catalogue.md)); no item form natively' : 'Unmapped; technical/unlisted audit');
const rows = [];
for (const item of native.items) {
  const variants = item.variants.concat(native.searchEnchantedBooks.filter(s => s.id === item.id));
  if (!variants.length) {
    rows.push(`| ${item.id} | ${item.name} | — | — | — | ${technicalStatus(item.id)} | ${item.id < 256 ? 'I, B' : 'I'} |`);
    continue;
  }
  for (const s of variants) {
    const browser = mapping(s);
    const gates = ['I', ...(item.id < 256 ? ['B'] : []), ...(s.tag ? ['N'] : []), ...(item.maxDamage ? ['D'] : [])].join(', ');
    const status = browser ? 'Partial; listed, behavior audit' : ITEM_MISSING[`${s.id}:${s.damage}`] ?? 'Unmapped; audit required';
    rows.push(`| ${item.id} | ${item.name} | ${s.damage} | ${s.tag ? esc(s.tag) : '—'} | ${browser ? browser.split(':').slice(0, 2).join(':') : '—'} | ${status} | ${gates} |`);
  }
}
await write('item-parity-catalogue.md', `# Original item and Creative subtype parity catalogue

Generated by \`node tools/build-content-catalogue.mjs\`. Refresh native evidence with \`node tools/verify-catalogue.mjs\` (local original JAR/JDK required). [Roadmap](parity-roadmap.md) · [native evidence](content-registry-reference.json).

Includes **${native.items.length} original item registrations** and **${stacks.length} Creative search entries**, including **${native.searchEnchantedBooks.length} additional enchanted-book NBT entries**. Every registration appears, including technical items with no Creative listing. A row with no metadata is an unlisted registration, not an invented obtainable subtype. Registry properties (Creative tab, stack limit, hasSubtypes, maximum durability) are retained in the JSON evidence.

Browser IDs are \`internal ID:stack damage\`. The **${mapped.size} listed browser entries** are matched to exact Creative subtypes using the existing inventory/Creative mappings. Listed means Partial; it does not verify use, acquisition or persistence. Unmapped means the current evidence has no mapping, and requires review before declaring Missing; Missing means the browser build has no such item or variant (checked against src/survival.js). Technical rows are block-only registrations or unlisted items with their browser counterpart named. Enchanted-book NBT entries map by their exact StoredEnchantments text; no other NBT entry has a browser mapping. Creative is not an exhaustive catalogue of arbitrary NBT combinations, all potion values, durability states, firework configurations, map contents, or player-authored data. Those require separate semantic cases. No row is certified fully verified.

## Acceptance and dependencies

Each row inherits the gates in its last column. Evidence here verifies native registration/subtype enumeration only; browser behavior remains an audit. Dependencies refer to [roadmap](parity-roadmap.md) work packages/milestones.

| Gate | Dependencies | Required acceptance before behavior verification |
| --- | --- | --- |
| I | PLAN-03, generalized item registry; content/progression as applicable | Correct registry identity, stack limits, acquisition/recipes/smelting, use/equip/eat/throw behavior, use timing, inventory/container clicks, Creative order/search/pick, tooltip/icon/sound, save/export/import identity and cross-system scenarios against original evidence |
| B | WORLD-01, ordinary content | I plus block placement/orientation, item-damage to world-metadata conversion, bounds/rays/collision/support, neighbor/scheduled/random updates, light/render/sound, harvesting/drops and round-trip persistence; use the separate metadata audit |
| N | WORLD-01 item NBT, progression/Java saves | I plus tag schemas, tag-aware stacking/equality, applicable effects and costs, tooltip/glint, tag preservation across containers/death/save/import; test each listed book and semantic tag families |
| D | PLAYER-01, equipment/combat | I plus damage value, maximum durability, wear/break boundary, repair, use/attack effects, bars/tooltips and save/load continuity |

## Registration and subtype rows

| Java item ID | Registry name | Creative damage | Native NBT text | Browser stack | Status | Gates |
| --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
`);

// Creative item damage and world metadata are different domains (logs,
// leaves, slabs, growth ages, orientation, powered states, etc.). List the
// full raw storage domain as an audit without asserting valid semantics.
const blockRows = native.blocks.map(b => {
  const variants = b.variants.map(s => `${s.id}:${s.damage}`).join(', ') || '—';
  return `| ${b.id} | ${b.name} | ${b.itemId ?? '—'} | ${variants} | 0–15 | Unclassified; B audit |`;
});
// block-metadata-catalogue.md is generated by tools/build-block-metadata-catalogue.mjs from block-metadata-reference.json (PLAN-03b).
console.log(`${check ? 'Checked' : 'Wrote'} ${rows.length} item audit rows (${native.items.length} registrations, ${stacks.length} Creative entries, ${mapped.size} browser mappings); ${blockRows.length} block registrations (metadata catalogue: tools/build-block-metadata-catalogue.mjs).`);

const common = 'Generated by `node tools/build-content-catalogue.mjs`; refresh native evidence with `node tools/verify-catalogue.mjs`. [Roadmap](parity-roadmap.md) · [original-class enumeration evidence](content-registry-reference.json). No row is certified whole-feature verified.';
// Entity status map (batch 11 audit, verified against src/entities.js, src/commands.js SUMMONABLE and the research docs).
// [status, doc, gap]. Implemented = a browser entity whose rules are replayed against native probe records in the linked
// doc. It is never whole-feature verified: natural spawning is the SpawnerAnimals port with the approximations in
// natural-spawning.md, and each doc lists its own approximations. Partial names the specific gap. Missing was confirmed in src/.
const E = {
  Item: ['Partial', 'items.md', 'item-entities.js physics/merge/pickup; hopper and frame interactions audited elsewhere'],
  XPOrb: ['Partial', 'xp-orbs.md', 'experience.js orbs; search target and colour not saved'],
  LeashKnot: ['Implemented', 'leash.md', 'knots are never saved, as in the original'],
  Painting: ['Partial', 'hanging-entities.md', 'no Java region import of hanging entities'],
  Arrow: ['Partial', 'bows.md', 'see doc for pickup/FOV limits'],
  Snowball: ['Partial', 'projectiles.md', 'eggs and snowballs only; see doc'],
  Fireball: ['Partial', 'blaze-ghast.md', 'not saved, no /summon Fireball, fireball-versus-fireball collisions absent'],
  SmallFireball: ['Partial', 'blaze-ghast.md', 'not saved, no /summon; small-fireball block case bytecode-derived'],
  ThrownEnderpearl: ['Implemented', 'ender-pearl-live.md', ''],
  EyeOfEnderSignal: ['Implemented', 'eye-of-ender.md', 'stronghold flight and portal frames; doc text predating the End is stale'],
  ThrownPotion: ['Partial', 'potions.md', 'thrown aim gaussian unseeded; potions in flight absent from region export'],
  ThrownExpBottle: ['Implemented', 'spawn-eggs.md', 'Bottle o\' Enchanting throw and XP'],
  ItemFrame: ['Partial', 'hanging-entities.md', 'no Java region import of hanging entities'],
  WitherSkull: ['Partial', 'wither-boss.md', 'wither effect damage on non-player mobs not ticked'],
  PrimedTnt: ['Implemented', 'creepers.md', 'explosion replay in explosion.md; TNT is never written to saves, as in 1.7.10'],
  FallingSand: ['Partial', 'anvil-blocks.md', 'falling.js sand/gravel/anvil/dragon egg; see scheduled-ticks tests'],
  FireworksRocketEntity: ['Partial', 'fireworks.md', 'block collisions approximate; moves with the particle mover'],
  MinecartCommandBlock: ['Partial', 'polish.md', 'runs every 4 ticks while powered as natively; editor and rule gating in command-blocks.md'],
  Boat: ['Partial', 'boats.md', 'cannot stand on boats; mobs are not mounted on boats'],
  MinecartRideable: ['Partial', 'minecarts.md', 'powered/detector/activator rail behaviour in powered-rails.md'],
  MinecartChest: ['Partial', 'minecarts.md', ''],
  MinecartFurnace: ['Partial', 'minecart-variants.md', ''],
  MinecartTNT: ['Partial', 'minecart-variants.md', ''],
  MinecartHopper: ['Partial', 'minecart-variants.md', ''],
  MinecartSpawner: ['Partial', 'spawner-cart.md', 'NBT, spawn timing and drops probe-verified; mob display approximate; no Java region import of carts'],
  Creeper: ['Implemented', 'creepers.md', ''],
  Skeleton: ['Partial', 'bows.md', 'wither skeleton variant: magma-pigman.md/fortress.md'],
  Spider: ['Partial', 'spiders.md', 'legacy EntityCreature AI adapted; see doc'],
  Giant: ['Partial', 'giant.md', 'summon/region only as native; pathing reach unverified'],
  Zombie: ['Partial', 'pathfinding.md', 'baby/villager/jockey variants in mob-riding.md and zombie-villager.md'],
  Slime: ['Partial', 'slime.md', 'natural spawns through the SpawnerAnimals port; no seeded replay reached a slime'],
  Ghast: ['Implemented', 'blaze-ghast.md', ''],
  PigZombie: ['Implemented', 'magma-pigman.md', 'portal spawning in nether-portal-live.js'],
  Enderman: ['Implemented', 'enderman.md', 'held-block use by the player probe not covered'],
  CaveSpider: ['Partial', 'spiders.md', 'mineshaft spawners only'],
  Silverfish: ['Partial', 'silverfish.md', 'sneak/invisibility range scaling not ported'],
  Blaze: ['Implemented', 'blaze-ghast.md', 'fortress spawners wired in fortress.md'],
  LavaSlime: ['Implemented', 'magma-pigman.md', ''],
  EnderDragon: ['Partial', 'dragon.md', 'ModelDragon and the End-chunk spawn are bytecode-derived, not probed'],
  WitherBoss: ['Partial', 'wither-boss.md', 'no spawn snow particles or achievement; target order differs'],
  Bat: ['Partial', 'squid-bat.md', 'spawn caps probed; no seeded spawn replay reached a bat'],
  Witch: ['Partial', 'witch.md', 'witch hut list looked up only in swamp slots; silent (no asset index sounds)'],
  Pig: ['Implemented', 'pig-saddle.md', ''],
  Sheep: ['Implemented', 'sheep.md', 'dye/shear/breeding in sheep.md, dyes.md'],
  Cow: ['Implemented', 'pathfinding.md', ''],
  Chicken: ['Implemented', 'chickens.md', 'jockeys in mob-riding.md'],
  Squid: ['Partial', 'squid-bat.md', 'flow push and model bytecode-derived'],
  Wolf: ['Implemented', 'wolves.md', 'natural packs replayed in spawn-lists-reference.json'],
  MushroomCow: ['Partial', 'mooshroom-golem.md', 'cannot spawn on mycelium at runtime'],
  SnowMan: ['Implemented', 'mooshroom-golem.md', ''],
  Ozelot: ['Implemented', 'ocelots.md', ''],
  VillagerGolem: ['Partial', 'iron-golem.md', 'step sounds, collide retargeting, rose model and walking dust are ported; the monster target nearbyOnly path check (end within 1.5, cached 10 + nextInt(5) ticks on the task) is probed and ported (villager-polish-reference.json)'],
  EntityHorse: ['Implemented', 'horses.md', 'renderer not visually verified'],
  Villager: ['Partial', 'villager-trading-live.md', 'every trade-table item maps to a browser item (no "?"); village systems in village.md; status 12/13/14 particles (visual Random draws), the +5 default-reputation flag and the MoveIndoors biome/hasNoSky gate are probed and ported; villager NBT import belongs to the interchange track'],
  EnderCrystal: ['Implemented', 'dragon.md', 'spike crystals placed by DimensionWorld.endCrystals()'],
};
for (const name of Object.keys(E)) assert(native.entities.some(e => e.name === name), name);
// In-progress rows cite a doc another track is still writing; it is linked only once that track lands.
for (const [status, doc] of Object.values(E)) if (!status.startsWith('In progress')) await readFile(new URL(doc, research));
const entityStatus = e => {
  if (e.abstract) return 'Abstract registration; base behavior audit';
  const v = E[e.name];
  if (v?.[0].startsWith('In progress')) return `${v[0]}; research doc pending (${v[1]})`;
  return v ? `${v[0]}; [${v[1].replace(/\.md$/, '')}](${v[1]})${v[2] ? '; ' + v[2] : ''}` : 'Unmapped; audit required';
};
const entityRows = native.entities.map(e => `| ${e.id} | ${e.name} | ${e.class} | ${e.abstract ? 'yes' : 'no'} | ${e.spawnEgg ? 'yes' : 'no'} | ${entityStatus(e)} | E |`);
await write('entity-parity-catalogue.md', `# Original entity registry parity catalogue

${common}

All **${native.entities.length} numeric EntityList registrations**, read from its complete map rather than inferred from spawn eggs. Native class names are obfuscated names from the pinned original JAR. Abstract entries are registrations, not independently spawnable creatures. Spawn-egg presence is native evidence only; the browser has spawn eggs for 24 mobs ([spawn eggs](spawn-eggs.md)).

Status words (batch 11 audit): **Implemented** means the browser has the entity and the linked doc replays it against native probe records; it is never whole-feature verified, because natural spawning is a SpawnerAnimals port with the approximations in [natural spawning](natural-spawning.md) and each doc lists approximations. **Partial** names the specific gap. **Missing** was confirmed absent in src/. Per-mob gaps beyond the row text are in [remaining gaps](remaining-gaps.md).

Gate **E** depends on WORLD-01/SIM-01 plus player/combat, mob/spawning, transport, progression or dimensions as applicable. Each row requires native identity and variant metadata, dimensions, attributes, spawn/despawn/caps, movement/collision/fluids, AI/targets/interaction/equipment, damage/immunity/knockback/attribution, drops/rewards, render/animation/sound, save/unload/reload and cross-system acceptance cases. Partial links state current evidence and limitations; registry extraction verifies enumeration only.

EntityList is not the complete feature roster: players, weather lightning, thrown eggs and fishing hooks need separate non-registration cases; rider/jockey combinations, baby/tamed/equipment/difficulty states, wither skeletons, zombie villagers, charged creepers, horse variants, bosses and multipart entities require semantic subcases. Registration coverage does not close that work.

| Java entity ID | Native name | Native class | Abstract | Native spawn egg | Status / evidence | Gate |
| --- | --- | --- | --- | --- | --- | --- |
${entityRows.join('\n')}
`);

assert.equal(new Set(native.biomes.map(b => b.id)).size, native.biomes.length);
// Every one of the 61 slots exists in src/java-biomes.js (BIOME_LIST) and is exercised by the replayed layers, the 976
// surface cases over all slots and the decorator ports (generation.md, population-live.md). That proves generation, not
// per-biome gameplay, so the status stays Partial with the audit scope named.
// The four spawn lists of every slot match spawn-lists-reference.json and drive the SpawnerAnimals port (natural-spawning.md).
// Slots with a native populate replay in biome-audit-reference.json (one 6x6-chunk region per naturally occurring slot).
const auditSlots = new Set((await read('biome-audit-reference.json')).regions.map(r => r.slot));
const decorationNote = b => auditSlots.has(b.id)
  ? 'decoration probe-verified ([native populate per biome](biome-decoration-audit.md))'
  : b.id === 8 || b.id === 9 ? 'Nether and End decorators are separate ([dimensions](dimensions.md))'
  : 'decoration probe-verified only in cycled-slot records, no natural audit region ([audit](biome-decoration-audit.md))';
const biomeStatus = b => `Partial; slot in src/java-biomes.js, used by [layers, terrain surfaces and decoration](generation.md); ${b.id === 12 ? 'legacy [snowy preset](snow.md) also reuses its facts; ' : ''}[spawn lists](natural-spawning.md) probe-checked; [tint and weather](biome-colors.md) probe-checked; ${decorationNote(b)}`;
const biomeRows = native.biomes.map(b => `| ${b.id} | ${b.declaredId} | ${esc(b.name)} | ${b.class} | ${biomeStatus(b)} | G |`);
await write('biome-parity-catalogue.md', `# Original biome registry parity catalogue

${common}

All **${native.biomes.length} occupied BiomeGenBase registry slots**, including mutations. Slot ID and the object's declared biomeID are retained separately: native slot 161 holds Mega Spruce Taiga with declared ID 160. This is original observed registration behavior, not a deduplication error. Do not collapse those slots or derive the registry from display names.

Gate **G** depends on WORLD-01/WORLD-02, original RNG/Java generation and relevant content/mob systems. Every row requires original biome selection/layers and seed/call order; temperature/rain/snow, height/noise/surface/blocks/metadata, terrain and biome boundaries, decorators/resources/trees/structures/population, spawn lists, colour/sky/weather and dimension rules; verify fixed seed samples under varied chunk-generation order and save/reload. Registry evidence alone verifies none of those behaviors. New Java worlds (generation 9 and later) run the ported biome layers, terrain, caves, population and structures; only the legacy custom landscapes (versions 1-8) are not mapped Java biomes. Natural mob spawning per biome uses the browser's adapted pass, not the biome spawn lists.

| Registry slot | Declared biomeID | Native name | Native class | Status / evidence | Gate |
| --- | --- | --- | --- | --- | --- |
${biomeRows.join('\n')}
`);

// Per-rule status from game-rules.md (call sites replayed by game-rules-reference.json); main.js points game-rules.js at the
// active world record, /gamerule writes it, and custom keys are stored for any name.
const R = {
  commandBlockOutput: ['Implemented', 'operator feedback of command blocks (command-block.js)'],
  doDaylightCycle: ['Implemented', 'time advance gate'],
  doFireTick: ['Implemented', 'fire.js tick gate; lightning places no fire'],
  doMobLoot: ['Implemented', 'drops, death orbs and breeding experience'],
  doMobSpawning: ['Partial', 'gates the SpawnerAnimals port ([natural spawning](natural-spawning.md)); live portal pigmen not called yet'],
  doTileDrops: ['Implemented', 'block drops'],
  keepInventory: ['Implemented', 'death handling'],
  mobGriefing: ['Partial', 'creeper, farmland, eat grass, silverfish; absent-feature call sites (e.g. every wither/dragon site) not individually replayed'],
  naturalRegeneration: ['Implemented', 'including the Peaceful heal check'],
};
const ruleRows = native.gamerules.map(r => { assert(R[r.name], r.name); return `| ${r.name} | ${r.defaultValue} | ${R[r.name][0]}; [game rules](game-rules.md), ${R[r.name][1]} | R |`; });
await write('gamerule-parity-catalogue.md', `# Original default gamerule parity catalogue

${common}

All **${native.gamerules.length} GameRules constructor defaults**, enumerated from the unchanged original object. Later-version gamerules are outside the target. The browser has a configurable gamerule store and \`/gamerule\` ([commands](commands.md), [game rules](game-rules.md)): every name can be set and read, the nine defaults are wired at the native call sites listed in game-rules-reference.json, and the active world record persists them. Rows below are never marked verified; effects are replayed in \`src/game-rules.test.js\`.

Gate **R** depends on SIM-01, commands/world settings and each affected subsystem. For every key, execute original default and toggled-value scenarios, exact tick/update ordering and all relevant call sites (not just one obvious effect), command/query permissions/output, world save/import/export and multiplayer synchronization (out of scope). GameRules also supports arbitrary named string values; custom-key storage, string/boolean conversion and persistence are covered by the command tests.

| Default key | Original default string | Status | Gate |
| --- | --- | --- | --- |
${ruleRows.join('\n')}
`);
console.log(`${check ? 'Checked' : 'Wrote'} ${entityRows.length} entity, ${biomeRows.length} biome and ${ruleRows.length} gamerule audit rows.`);
