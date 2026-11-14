// Batch 66 mpvillage: villagers and villages on the dedicated server.
// Single player's villager (villager.js, village-ai.js), village collection (village.js, village-host.js) and zombie villager rules (zombie-villager.js) already run inside the
// EntityWorld each ServerMobs wraps, so this module adds what a server needs:
//   * `VILLAGE_KINDS` join ServerMobs' SUPPORTED set (the iron golem is the village's own spawn; `SUPPORTED.add` of the same kind by another track is idempotent).
//   * `installServerVillagers(sm)`: the collection's player lookup (`Village.findNearestTargetPlayer`, reputation -15 or lower) names the connected player instead of the one local
//     "Player", and a hit of a player's weapon carries that player's NAME (`source.playerName`), so reputation is kept by name like Village.playerReputation (a TreeMap of names).
//   * `loadVillages` / `saveVillages`: the Overworld collection is saved with the world as the browser save keeps it (`villages`, village.js toJSON) and the villagers that village
//     structures generated (world.generatedStructures.animals, the records restorePopulation turns into mobs) join a fresh world once.
//   * `villagerUse` is the interact hook of a villager click: ServerMobs calls `sm.villagerUse(player, mob)`. It is a stub here (returns false); the trading track fills it.
// Zombie sieges: village-siege.js (1.7.10's VillageSiege never spawns a zombie, its spawn-spot search discards the result; see that file). The collection is per EntityWorld, so the Nether and the End hold their own (native 1.7.10 builds every
// WorldServer from the one "villages" key, bytecode-read in ahb's constructor; that sharing is not reproduced and no doors exist there).
import { villagerFields } from '../villager.js';
import { PLAYER_NAME } from '../village-host.js';
import { REPUTATION_MAX, REPUTATION_MIN } from '../village.js';

export const VILLAGE_KINDS = ['villager', 'iron_golem'];

// The AI view (PlayerView) of the connected player called `name`, or null when that player is offline or dead (Village.findNearestTargetPlayer asks World.getPlayerEntityByName).
export function viewByName(sm, name) {
  for (const v of sm.views.values()) if (v.player.name === name) return v.view.alive ? v.view : null;
  return null;
}
// The name of the player whose view the AI currently uses (EntityWorld.ai.player), or undefined.
export function currentName(sm) {
  const view = sm.mobs.ai.player;
  if (!view) return undefined;
  for (const v of sm.views.values()) if (v.view === view) return v.player.name;
  return undefined;
}

// Called by ServerMobs' constructor, once per dimension's instance.
export function installServerVillagers(sm) {
  const mobs = sm.mobs;
  mobs.villages.host.playerEntity = name => viewByName(sm, name);
  // EntityWorld.damage builds the source; the player's name rides along for the village rules (villagerHurtBy, villagerDied, the golem's -5), which read `source.playerName`.
  const damage = mobs.damage;
  mobs.damage = function (e, amount, fromX, fromZ, byPlayer = true, attacker = null, extra = null) {
    if (byPlayer && !extra?.playerName) {
      const name = currentName(sm);
      if (name !== undefined) extra = { ...extra, playerName: name };
    }
    return damage.call(this, e, amount, fromX, fromZ, byPlayer, attacker, extra);
  };
  // b67 sieges: VillageSiege walks every player of this world and reads the world clock (EntityWorld.tickMobs runs it after the village tick)
  mobs.siegePlayers = () => [...sm.views.values()].map(v => v.player.position);
  mobs.siegeTime = () => sm.host.time ?? 0;
  sm.villagerUse ??= null; // (player, mob) => boolean: the merchant window (mptrade); null leaves a villager click to the other rules
}

// Villager records of the world's generated structures (restorePopulation's rule: a version 11+ world, once, never over a saved mob list).
export function generatedVillagers(world, saved) {
  if (Array.isArray(saved?.mobs) || !(world.generationVersion >= 11)) return [];
  return (world.generatedStructures?.animals ?? []).filter(a => a?.type === 'Villager');
}

// b67 sieges: Village.playerReputation (vz.j) is a TreeMap keyed by the player's name. Single player keeps one fixed name ("Player", village-host.js), so a village saved there holds its
// reputation under that key. With `legacyOwner` (the server option naming the single-player save's player, as for tamed wolves) the key becomes that name (summed and clamped to
// -30..10 if the name already has a score); without it the key stays, and a player called "Player" would inherit it. The change is on the saved JSON, so the next save keeps it.
export function mapLegacyReputation(json, name) {
  if (!json?.villages || typeof name !== 'string' || !name || name === PLAYER_NAME) return 0;
  let n = 0;
  for (const v of json.villages) {
    if (!Array.isArray(v.players)) continue;
    const i = v.players.findIndex(p => p?.[0] === PLAYER_NAME);
    if (i < 0) continue;
    const [, score] = v.players.splice(i, 1)[0], j = v.players.findIndex(p => p?.[0] === name);
    if (j >= 0) v.players[j] = [name, Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, v.players[j][1] + score))];
    else v.players.push([name, score]);
    n++;
  }
  return n;
}

// Restores the collection of a saved world and adds the generated villagers of a fresh one. `limit` is the server's mob cap.
export function loadVillages(sm, saved, world, limit = Infinity, legacyOwner = null) {
  const mobs = sm.mobs;
  if (saved?.villages) { mapLegacyReputation(saved.villages, legacyOwner); mobs.villages.loadJSON(saved.villages); }
  let made = 0;
  for (const a of generatedVillagers(world, saved)) {
    if (mobs.entities.length >= limit) break;
    const e = mobs.create('villager', a.x, a.y, a.z);
    Object.assign(e, villagerFields(a.profession, 0));
    mobs.entities.push(e);
    made++;
  }
  return made;
}
export const saveVillages = sm => sm.mobs.villages.toJSON();
