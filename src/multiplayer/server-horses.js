// Batch 76 mphorse76: riding horses, donkeys and mules on the dedicated server.
// The single-player rules are reused unchanged: EntityHorse.interact (horse-live.js horseInteract / horse.js interactHorse), the seat system `horseSeats`, the ridden walk `horseRideThink`
// (steering from the rider's yaw / strafe / forward, the jump power), the taming task `RunAround` (temper +5, nextInt(100) < temper tames, the rider is thrown and the horse rears) and
// the inventory container HorseContainer (ContainerHorseInventory: saddle, armour, 15 chest slots).
//
// The rider is the record ServerVehicles keeps (`riderOf`, `p.mount = { key: 'm<id>', mob, rider }`), exactly as for a saddled pig (server-riding.js), so presence (`riding`), the sneak
// dismount, the seat copy, the death / unload checks and the mob packets are the existing code. What this file adds:
//   * mount: the `mount` action of horseInteract seats the player (EntityHorse.interact -> func_110237_h -> player.mountEntity);
//   * the jump: C0B action 6 (EntityPlayerSP sends (int)(jumpPower * 100) when the jump key is released) -> EntityHorse.setJumpPower(int); new wire `horseJump { power }`.
//     b87 ride87: that is the only way a server horse jumps. The C0C's jump flag (rider.jumping, server-vehicles.js applyRide) is EntityPlayerMP.isJumping (mw.a(FFZZ));
//     its one reader in the jar is EntityLivingBase.onLivingUpdate (sv.e 423-488, the rider's own update, mw.i() from processPlayer's riding branch): in water / lava
//     motionY += 0.04, else jump() only when onGround, which the riding client's C05 never sets; the seat put-back and the next updateRidden discard both. No mount reads it
//     (EntityHorse, the pig's EntityAIControlledByPlayer, EntityBoat and EntityMinecart steer on moveForward / moveStrafing only). The b76/b77 fallback that charged
//     the bar from the held key on the server is gone;
//   * C0B action 7 (open the horse inventory while riding) -> EntityHorse.openGUI(player): new wire `horseInventory`; and the right click's own "gui" action (saddle / armour / sneak on a tame horse);
//   * the window: S2D `openWindow` with `kind: 'horse'` and `horse: { type, chested, ... }`, then the usual S30 / S2F / S32 traffic of ServerContainers.
// Bytecode-read (NetHandlerPlayServer.processEntityAction, jar class nh.a(jj)): action 6 calls wi.w(param) and action 7 calls wi.g(player) when the player's ridden entity is a wi (EntityHorse), with
// no other check; wi.w sets bI (the rear start) and the power only when cu() (saddled) holds, a negative value counts as 0 (power 0.4); wi.g opens the screen only on the server world with
// no rider (or this player) and cc() (tame).
import { HorseContainer, canInteract, horseChestTitle } from '../horse-gear.js';
import { horseSeatsFor } from '../horse-live.js';
import { serverRiderFall } from './server-rider-fall.js';

const f = Math.fround;

const num = e => Number(String(e.id).replace(/^mob-/, ''));

export class ServerHorses {
  // `host`: the DedicatedSimulation. `vehicles`: ServerVehicles (riderOf, seat, dismount).
  constructor(host, vehicles) { this.host = host; this.vehicles = vehicles; }
  get mobs() { return this.host.mobs.mobs; }
  // The horse a player rides, or null.
  horseOf(p) { const m = p.mount?.mob; return m && m.type === 'horse' && m.rider === p.mount.rider ? m : null; }
  // EntityHorse.interact's mount: true when the horse took (or already holds) the player. Unsaddled horses are mounted too (a wild one runs around, RunAround).
  mount(p, e) {
    if (e.type !== 'horse' || !this.mobs.entities.includes(e)) return false; // b80: wi.i(yz) / mountEntity have no health test
    if (p.mount) return p.mount.mob === e;
    const rider = this.vehicles.riderOf(p), seats = horseSeatsFor(this.mobs, rider);
    if (!seats.mount(e, rider)) return false;
    p.mount = { key: 'm' + String(e.id).replace(/^mob-/, ''), mob: e, rider };
    rider.fallHit ??= serverRiderFall(this.host, p).hit; // b77: EntityHorse.fall damages the rider by the horse's own amount (horse-live.js horseLand)
    this.vehicles.seat(p);
    return true;
  }
  // The `ctx` EntityWorld.horseInteract gets for this click: the mount, and the window instead of the quick equip.
  ctx(p, sneak) {
    const rider = this.vehicles.riderOf(p);
    return { sneak, horses: { player: rider, mount: (e) => this.mount(p, e) }, open: (e) => this.open(p, e) };
  }
  // Each tick before the mobs move (ServerVehicles.riderInput). The held jump key charges nothing here (b87 ride87: only C0B 6 jumps a horse).
  input(p) {
    const e = this.horseOf(p);
    if (!e) return;
    // b77: wi.e(FF) copies the rider's pitch * 0.5 (native pitch: positive looks down, the server's `p.pitch` positive looks up).
    p.mount.rider.pitch = f(-p.pitch * 180 / Math.PI);
  }
  // C0B action 6: wi.w(param) whenever the ridden entity is a horse (nh.a(jj) 109-158: no other test). The parameter is any int (C0B's jumpBoost field); wi.w clamps it.
  jump(p, power) {
    const e = this.horseOf(p);
    if (!e || !Number.isInteger(power) || power < -2147483648 || power > 2147483647) return false;
    this.mobs.horseJump(e, power);
    return true;
  }
  // C0B action 7: wi.g(player) for the ridden horse.
  inventory(p) { const e = this.horseOf(p); return !!e && this.open(p, e); }
  // wi.g(player): !isRemote, no rider (or this player) and tame; the screen is the horse's AnimalChest window.
  open(p, e) {
    if (e.type !== 'horse' || !e.horse?.tame || (e.rider && e.rider !== p.mount?.rider) || !this.mobs.entities.includes(e)) return false; // b80: wi.g(yz) has no health test; the window's canInteractWith (usable) closes it on a corpse
    return this.host.containers.openHorse(p, e, this.mobs.horseGear(e), num(e));
  }
  // The window's reach test (ContainerHorseInventory.canInteractWith: alive and getDistanceToEntity < 8).
  usable(p, e) {
    const at = p.position;
    return canInteract(e.health > 0 && this.mobs.entities.includes(e), Math.hypot(e.x - at.x, e.y - at.y, e.z - at.z));
  }
  // The container (also built by the tests and the client's window): the title follows the horse's name / chest.
  container(inv, e, onChange = null) { return new HorseContainer(inv, this.mobs.horseGear(e), onChange, e.customName); }
  title(e) { return horseChestTitle(e.horse, e.customName); }
  // After EntityAIRunAroundLikeCrazy tamed the horse for a player: EntityHorse.setTamedBy(player) stores the player's name (here the player record's name), not the port's "player" stand-in.
  // Called each tick after the mobs moved; harmless for a horse tamed any other way.
  stamp() {
    for (const e of this.mobs.entities) {
      if (e.type !== 'horse' || !e.horse?.tame || e.horse.owner !== 'player') continue;
      const p = [...this.host.players.values()].find(q => q.mount?.mob === e) ?? e.tamedBy;
      if (p?.name) e.horse.owner = p.name;
    }
  }
  // wi.a(ro, F) (bytecode-read b77): damage whose source entity is the horse's own rider is ignored. True for a melee hit of `p` on `mob`.
  rides(p, mob) { return !!mob && mob.type === 'horse' && !!mob.rider && mob.rider === p.mount?.rider; }
  // Logout (ServerConfigurationManager.playerLoggedOut, oi.e, bytecode-read b77): the player's NBT is written first and Entity.writeToNBT adds `Riding` (the mount's writeMountToNBT: id and data,
  // only for a live mount), then `removePlayerEntityDangerously(mount)` takes the horse out of the world ("removing player mount"). Here the horse record is kept for the player's saved data and
  // the horse leaves the list; the caller then lets the rider down as before. Called before ServerVehicles.dismount.
  logout(p) {
    const e = this.horseOf(p);
    if (!e || e.health <= 0 || !this.mobs.entities.includes(e)) return null;
    const record = JSON.parse(JSON.stringify(this.mobs.serializeOne(e)));
    for (const k of ['playerRides', 'riding', 'id']) delete record[k];
    this.mobs.horseSeats.dismount(this.host.world, p.mount.rider, false); // the seat (the saved position) stays where the player sat
    // b78 mphorse78: a server shutdown (MinecraftServer.stopServer: saveAllPlayerData, removeAllPlayers, saveAllWorlds) never reaches playerLoggedOut: the horse stays in the world and is also in `Riding`.
    if (!this.host.shuttingDown) {
      e.removedNow = true;
      this.mobs.entities.splice(this.mobs.entities.indexOf(e), 1);
    }
    p.ridingSave = record;
    return record;
  }
  // The `riding` field of the player's saved record (SaveHandler data: PlayerData `Riding`).
  savedFields(p) { return p.ridingSave ? { riding: p.ridingSave } : {}; }
  // Login (oi.a(ej, mw), bytecode-read b77): after the player is in the world, `Riding` -> EntityList.createEntityFromNBT, forceSpawn, spawnEntityInWorld, player.mountEntity. The horse is a new entity
  // (new id) at the Pos of its record; an unusable record leaves the player unmounted, as a null entity does. b78: called on the instance of the player's dimension (Nether / End).
  rejoin(p, saved) {
    const record = saved?.riding;
    if (!record || p.mount) return false;
    const mobs = this.mobs, e = mobs.restore({ ...record, id: 'mob-' + mobs.nextId }, { summoned: true });
    if (!e) return false;
    mobs.entities.push(e);
    mobs.nextId++;
    if (!this.mount(p, e)) { mobs.entities.splice(mobs.entities.indexOf(e), 1); return false; }
    return true;
  }
}
