// JDK-free catalogue generation from checked-in original-class evidence.
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { MC_IDS } from './inventory-replay.mjs';
import { SEARCH_ORDER } from '../src/creative.js';
import { ITEMS } from '../src/survival.js';
import { internalIdsFor } from '../src/block-registry.js';
import { auditSentence } from './catalogue-audit.mjs';

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

${auditSentence(rows)} Browser-listed Creative entries are Partial by rule; Unmapped marks technical registrations with no browser block or item (audit date: batch 19, every Unmapped and Missing row re-checked against src/).

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
  Item: ['Partial', 'items.md', "item-entities.js physics, merge and pickup; saved, imported, /summoned and on the dedicated server (server-items.js); hopper and frame interactions audited elsewhere"],
  XPOrb: ['Partial', 'xp-orbs.md', "experience.js orbs; saved (Health, Age, Value), imported, /summoned and on the server; xpColor, the search state and the target are not saved (xp-orbs.md; recalled as native, EntityXPOrb writes only Health, Age and Value)"],
  LeashKnot: ['Implemented', 'leash.md', 'knots are never saved, as in the original; on the dedicated server a knot is tracked (S0E 77) and clickable (server-hanging.js)'],
  Painting: ['Partial', 'hanging-entities.md', "saved, exported and imported from Java regions (region-import.js hangingFromNbt, since batch 13) and /summoned; on the dedicated server too (server-hanging.js: placing, hits, drops, frame item and rotation, saved per dimension, thrown and shot hits, S10 and S0E 71 spawn records; blasts break them; pistons break them off since batch 69 (piston-push.js, server-pistons.js))"],
  Arrow: ['Partial', 'bows.md', "saved (up to 300), imported, /summoned, on the server; crit trails, bubbles, Power/Punch/Flame, stuck-arrow display and the pickup fly-to are in (the bows.md gap list carries a batch 68 stale-claims note); skeleton AI timers and hit paths are bytecode-derived"],
  Snowball: ['Partial', 'projectiles.md', "snowballs, eggs and pearls; snowballs saved, imported and /summoned; thrown by players and golems on the server (server-projectiles.js); an egg has no EntityList id, as natively"],
  Fireball: ['Partial', 'blaze-ghast.md', "saved with the fireball lists, imported and /summoned; a ball hit by another ball is handled (fireballs.js hitBall) and the player's punch deflects; the large-fireball block case is bytecode-derived"],
  SmallFireball: ['Partial', 'blaze-ghast.md', "saved, imported and /summoned; the small ball refuses deflection as natively; small-fireball block case bytecode-derived"],
  ThrownEnderpearl: ['Implemented', 'ender-pearl-live.md', ''],
  EyeOfEnderSignal: ['Implemented', 'eye-of-ender.md', "stronghold flight and portal frames; the End exists (dimensions.md; eye-of-ender.md now says so too); saved in flight, /summoned, on the server (server-eyes.js)"],
  ThrownPotion: ['Partial', 'potions.md', "saved, imported and /summoned (potions in flight are in the region export); thrown by players and witches on the server; the aim gaussian is unseeded, as the native world Random; flight not among the executed EntityFlightProbe cases (eggs, bottles, pearls)"],
  ThrownExpBottle: ['Implemented', 'spawn-eggs.md', 'Bottle o\' Enchanting throw and XP'],
  ItemFrame: ['Partial', 'hanging-entities.md', "saved, exported and imported from Java regions (item, rotation and drop chance) and /summoned; on the dedicated server too (server-hanging.js: placing, hits, drops, frame item and rotation, saved per dimension, thrown and shot hits, S10 and S0E 71 spawn records; blasts break them; pistons break them off since batch 69 (piston-push.js, server-pistons.js); framed maps update on the server since batch 69 (server-maps.js))"],
  WitherSkull: ['Partial', 'wither-boss.md', "skull impact, heal and wither DoT on mobs probed (b15); saved and /summoned; flies on the server (server-wither.js); skull model orientation approximate"],
  PrimedTnt: ['Implemented', 'creepers.md', 'explosion replay in explosion.md; TNT is never written to saves, as in 1.7.10'],
  FallingSand: ['Partial', 'anvil-blocks.md', "falling.js sand/gravel/anvil/dragon egg; saved, imported, /summoned and ticked on the server; see scheduled-ticks tests; no native GL render capture"],
  FireworksRocketEntity: ['Partial', 'fireworks.md', "saved, /summoned and fired by server dispensers; the rocket still moves with the particle mover (firework-rocket.js moveParticleEntity), so block collisions are approximate; starTintComponents has no non-test caller (star overlay tint not wired)"],
  MinecartCommandBlock: ['Partial', 'polish.md', "runs every 4 ticks while powered as natively; editor and rule gating in command-blocks.md; imported from Java regions, /summoned and run on the server (server-cart-commands.js, --command-blocks)"],
  Boat: ['Partial', 'boats.md', "standing on and walking into boats are in (boats.md, batch 14); mobs ride through Riding chains, /summon and region import (vehicle-riders.js); on the server (server-vehicles.js); boat-pair pushes, lava burning and the void kill have no native record"],
  MinecartRideable: ['Partial', 'minecarts.md', "powered/detector/activator rail behaviour in powered-rails.md; imported from Java regions, /summoned, on the server (server-vehicles.js); the TNT cart's wall explosion never fires on rails natively, so no recorded case"],
  MinecartChest: ['Partial', 'minecarts.md', "imported from Java regions, /summoned and on the server"],
  MinecartFurnace: ['Partial', 'minecart-variants.md', "imported from Java regions and /summoned; the furnace cart block in the model is approximated from boxes, not compared with native screenshots"],
  MinecartTNT: ['Partial', 'minecart-variants.md', "imported from Java regions and /summoned; the TNT cart block in the model is approximated from boxes, not compared with native screenshots"],
  MinecartHopper: ['Partial', 'minecart-variants.md', "imported from Java regions and /summoned (cart-hopper.js); the hopper cart block in the model is approximated from boxes, not compared with native screenshots"],
  MinecartSpawner: ['Partial', 'spawner-cart.md', "NBT, spawn timing and drops probe-verified; imported from Java regions and /summoned; mob display approximate; on the server a spawner cart only arrives through a Riding chain or saved data (no /summon there)"],
  Creeper: ['Implemented', 'creepers.md', ''],
  Skeleton: ['Partial', 'bows.md', "wither skeleton variant: wither-skeleton.js, magma-pigman.md/fortress.md; server skeletons and wither skeletons; the bows.md gap list (no Power/Punch/Flame, no wither skeletons) carries a batch 68 stale-claims note; difficulty and AI timers derived from bytecode"],
  Spider: ['Partial', 'spiders.md', 'legacy EntityCreature AI adapted; see doc'],
  Giant: ['Partial', 'giant.md', "summon/region only as native; pathing reach unverified; not among the server's SUPPORTED kinds"],
  Zombie: ['Partial', 'pathfinding.md', "baby/villager/jockey variants in mob-riding.md and zombie-villager.md; server zombies convert villagers on Hard; village sieges run their state machine (village-siege.js, batch 67) but 1.7.10 never spawns the siege zombies (executed SiegeProbe)"],
  Slime: ['Partial', 'slime.md', 'natural spawns replayed vs the jar (slime chunk, swamp by moon phase, sizes)'],
  Ghast: ['Implemented', 'blaze-ghast.md', ''],
  PigZombie: ['Implemented', 'magma-pigman.md', 'portal spawning in nether-portal-live.js'],
  Enderman: ['Implemented', 'enderman.md', 'held-block use by the player probe not covered'],
  CaveSpider: ['Partial', 'spiders.md', "spawner-only in 1.7.10 (mineshaft spawners), as natively; on the server"],
  Silverfish: ['Partial', 'silverfish.md', "sneak and invisibility range scaling is ported (MobAI.closestVulnerablePlayer, silverfish.md updated in batch 68); on the server (server-golems.js); explosions release silverfish from monster egg blocks in single player and on the server (batch 67)"],
  Blaze: ['Implemented', 'blaze-ghast.md', 'fortress spawners wired in fortress.md'],
  LavaSlime: ['Implemented', 'magma-pigman.md', ''],
  EnderDragon: ['Partial', 'dragon.md', "parts hit by projectiles and explosions (probed explosions); ModelDragon and the End-chunk spawn are bytecode-derived, not probed; fight on the server (server-dragon.js)"],
  WitherBoss: ['Partial', 'wither-boss.md', "target order approximated; head particles bytecode-read; spawn snow is a server no-op; built in any dimension on the server (server-wither.js)"],
  Bat: ['Partial', 'squid-bat.md', 'spawn caps probed; cave spawns replayed vs the jar (date limit 4/7, ambient cap)'],
  Witch: ['Partial', 'witch.md', "witch hut list looked up only in swamp slots; silent because the 1.7.10 asset index has no mob.witch events (a native fact); on the server"],
  Pig: ['Implemented', 'pig-saddle.md', ''],
  Sheep: ['Implemented', 'sheep.md', 'dye/shear/breeding in sheep.md, dyes.md'],
  Cow: ['Implemented', 'pathfinding.md', ''],
  Chicken: ['Implemented', 'chickens.md', 'jockeys in mob-riding.md'],
  Squid: ['Partial', 'squid-bat.md', 'flow push and model bytecode-derived'],
  Wolf: ['Implemented', 'wolves.md', 'natural packs replayed in spawn-lists-reference.json'],
  MushroomCow: ['Partial', 'mooshroom-golem.md', "EntityAnimal.getCanSpawnHere needs grass, so mooshrooms come from chunk population and /summon only, as natively; on the server"],
  SnowMan: ['Implemented', 'mooshroom-golem.md', "also built by pumpkins on the server (server-golems.js)"],
  Ozelot: ['Implemented', 'ocelots.md', ''],
  VillagerGolem: ['Partial', 'iron-golem.md', "step sounds, collide retargeting, rose model and walking dust are ported; the monster target nearbyOnly path check is probed and ported (villager-polish-reference.json); on the server the village golem and player-built golem exist, its walking dust is drawn on client copies (batch 67), and snowballs give it no knockback as in 1.7.10 (zero damage returns before the knockback)"],
  EntityHorse: ['Implemented', 'horses.md', 'renderer not visually verified'],
  Villager: ['Partial', 'villager-trading-live.md', "every trade-table item maps to a browser item; village systems in village.md; status 12/13/14 particles, the +5 default-reputation flag and the MoveIndoors gate probed and ported; villager NBT is imported (java-mobs.js); villagers, trading and reputation on the server (server-villagers.js, server-trade.js); the default server world has no generated villages"],
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

All **${native.entities.length} numeric EntityList registrations**, read from its complete map rather than inferred from spawn eggs. Native class names are obfuscated names from the pinned original JAR. Abstract entries are registrations, not independently spawnable creatures. Spawn-egg presence is native evidence only; the browser has spawn eggs for 24 mobs; every concrete registration is a \`/summon\` type (55 of 55, 2 abstract) ([spawn eggs](spawn-eggs.md)).

${auditSentence(entityRows)}

Status words (batch 19 audit; the rows with \`/summon\`, server or region-import notes were re-read in the batch 67 audit against src/, src/multiplayer and the batch 59-66 notes): **Implemented** means the browser has the entity and the linked doc replays it against native probe records; it is never whole-feature verified, because natural spawning is a SpawnerAnimals port with the approximations in [natural spawning](natural-spawning.md) and each doc lists approximations. **Partial** names the specific gap. **Missing** was confirmed absent in src/. Per-mob gaps beyond the row text are in [remaining gaps](remaining-gaps.md).

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

${auditSentence(biomeRows)} Every slot is Partial by rule (batch 19 audit): generation, spawn lists, tint/weather and decoration are probe-checked, per-biome gameplay is not.

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
  doMobSpawning: ['Partial', 'gates the SpawnerAnimals port ([natural spawning](natural-spawning.md)) and the live Overworld portal pigman'],
  doTileDrops: ['Implemented', 'block drops'],
  keepInventory: ['Implemented', 'death handling'],
  mobGriefing: ['RAW', 'Wired at all 11 native read sites (javap scan); [game rules](game-rules.md). Silverfish, dragon and door gates are probe-replayed; the loot, enderman, wither, skull and fireball gates are bytecode-read and unit-tested. Partial: not every site\'s surrounding behaviour is probed'],
  naturalRegeneration: ['Implemented', 'including the Peaceful heal check'],
};
const ruleRows = native.gamerules.map(r => { assert(R[r.name], r.name); return `| ${r.name} | ${r.defaultValue} | ${R[r.name][0] === 'RAW' ? R[r.name][1] : `${R[r.name][0]}; [game rules](game-rules.md), ${R[r.name][1]}`} | R |`; });
await write('gamerule-parity-catalogue.md', `# Original default gamerule parity catalogue

${common}

All **${native.gamerules.length} GameRules constructor defaults**, enumerated from the unchanged original object. Later-version gamerules are outside the target. The browser has a configurable gamerule store and \`/gamerule\` ([commands](commands.md), [game rules](game-rules.md)): every name can be set and read, the nine defaults are wired at the native call sites listed in game-rules-reference.json, and the active world record persists them. Rows below are never marked verified; effects are replayed in \`src/game-rules.test.js\`.

${auditSentence(ruleRows)} (batch 19 audit: each rule's call sites re-read against game-rules.md.)

Gate **R** depends on SIM-01, commands/world settings and each affected subsystem. For every key, execute original default and toggled-value scenarios, exact tick/update ordering and all relevant call sites (not just one obvious effect), command/query permissions/output, world save/import/export and multiplayer synchronization (out of scope). GameRules also supports arbitrary named string values; custom-key storage, string/boolean conversion and persistence are covered by the command tests.

| Default key | Original default string | Status | Gate |
| --- | --- | --- | --- |
${ruleRows.join('\n')}
`);
console.log(`${check ? 'Checked' : 'Wrote'} ${entityRows.length} entity, ${biomeRows.length} biome and ${ruleRows.length} gamerule audit rows.`);
