// MobSpawnerBaseLogic.a(sa) (agq), Minecraft Java 1.7.10: the Riding loop that follows a SpawnData spawn. After the rider is spawned from its
// Properties, every nested `Riding` compound is turned into a mount: EntityList.createEntityByName(riding.id), its written tag overlaid with the
// compound's keys and read back, setLocationAndAngles at the rider's position and rotation, spawned, then rider.mountEntity(mount); the mount
// becomes the next rider. The loop runs on the SpawnData Properties of the chosen entry (SpawnData or a SpawnPotentials entry) and never
// calls getCanSpawnHere or onSpawnWithEgg for a mount. Replayed against the unchanged class: public/research/spawn-data-reference.json
// (tools/probes/SpawnDataProbe.java, tools/verify-spawn-data.mjs); notes in public/research/spawner-cart.md.
//
// Native quirk, kept: an id that createEntityByName cannot make leaves the next rider null, so a LATER mount that can be made throws a
// NullPointerException on `rider.posX` (after the earlier riders were spawned, before the aux 2004 effect and the timer reset); an unmakeable
// id with nothing valid after it just ends the chain. The port reports the throw as `crashed` instead of taking the server down.
import { NBT } from "./nbt.js";
import { ENTITY_NAMES } from "./command-data.js";

// Entity names EntityList.createEntityByName can instantiate: the registered ids except the abstract Mob and Monster (their constructors fail).
const CREATABLE = new Set(ENTITY_NAMES.map(([name]) => name).filter((name) => name !== "Mob" && name !== "Monster"));
export const creatableEntity = (id) => CREATABLE.has(id);

// dh.m("Riding") when dh.b("Riding", 10): a compound tag, else the loop ends.
export const ridingTag = (props) => {
  const t = props?.get?.("Riding");
  return t?.type === NBT.COMPOUND ? t.value : null;
};
// dh.j("id"): the string, "" when absent or another type.
export const mountId = (tag) => (tag.get("id")?.type === NBT.STRING ? tag.get("id").value : "");

// The chain of `{ id, tag }` steps under a Properties compound, outermost mount first (no spawning).
export function ridingChain(props) {
  const out = [];
  for (let tag = ridingTag(props); tag && out.length < 64; tag = ridingTag(tag)) out.push({ id: mountId(tag), tag });
  return out;
}

// Runs the loop for `rider` (already spawned). ctx.spawnMount(id, tag, rider) creates, places, spawns and mounts one entity and returns it, or
// null when this build keeps no such entity (the chain ends there). Returns { mounts, crashed }.
export function spawnRidingChain(rider, props, ctx) {
  const mounts = [];
  let p = rider;
  for (const { id, tag } of ridingChain(props)) {
    if (!creatableEntity(id)) { p = null; continue; }
    if (!p) return { mounts, crashed: true };
    const mount = ctx.spawnMount(id, tag, p);
    if (!mount) break;
    mounts.push(mount);
    p = mount;
  }
  return { mounts, crashed: false };
}
