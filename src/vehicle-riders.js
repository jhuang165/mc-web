// Mobs riding boats and minecarts, Minecraft Java 1.7.10.
// Only EntityMinecartEmpty picks mobs up (EntityMinecart.applyEntityCollision, xl.g(sa)): on the server, an EntityLivingBase that is
// not an EntityPlayer or EntityIronGolem, in a type 0 cart moving faster than sqrt(0.01) with nobody on it, itself riding nothing:
// other.mountEntity(cart); the push of the collision still follows. A boat never takes a mob by itself, but /summon with a Riding tag
// (and a mob riding a boat from a save) uses the same Entity.mountEntity link, so a mob can sit in a boat.
// A passenger is an ordinary mob whose hidden `ridingEntity` is the vehicle (mob-riding.js); the vehicle keeps a hidden `passenger`.
// Saves: the mob's `riding` is "boat-<id>" or "cart-<id>" and the vehicle's save keeps its `id`; linkVehicleRiders turns them back
// into links once both lists are loaded.
import { mountEntity } from "./mob-riding.js";
import { isVehicle } from "./vehicle-seat.js";

const hide = (o, key, value) => Object.defineProperty(o, key, { value, writable: true, configurable: true, enumerable: false });

// EntityMinecart.applyEntityCollision's pickup test (on the server).
export function cartPicksUp(cart, other) {
  return cart.type === 0 && !cart.dead && !cart.rider && !cart.passenger && typeof other.type === "string" && other.type !== "iron_golem"
    && other.type !== "ender_crystal" && other.player !== true && !other.ridingEntity && cart.vx * cart.vx + cart.vz * cart.vz > 0.01;
}

// Entity.mountEntity(vehicle) for a mob. Refused when the vehicle is dead or occupied, or the mob rides something already.
export function mountMobOnVehicle(vehicle, mob, heightOf = () => 0) {
  if (!isVehicle(vehicle) || vehicle.dead || vehicle.rider || vehicle.passenger || mob.ridingEntity) return false;
  if (!mountEntity(mob, vehicle, heightOf)) return false;
  hide(vehicle, "passenger", mob);
  return true;
}


// Mounts every mob whose pending `riding` names a vehicle ("boat-3", "cart-7"). `mobs` is the mob list, `boats` and `carts` the
// vehicle lists; an id nothing carries is dropped. Mob-on-mob ids ("mob-5") are left for mob-riding.js's linkRiders.
export function linkVehicleRiders(mobs, boats, carts, heightOf) {
  const lookup = new Map();
  for (const b of boats ?? []) lookup.set(`boat-${b.id}`, b);
  for (const c of carts ?? []) lookup.set(`cart-${c.id}`, c);
  for (const e of mobs) {
    if (typeof e.riding !== "string" || !/^(boat|cart)-\d+$/.test(e.riding)) continue;
    const v = lookup.get(e.riding);
    delete e.riding;
    if (v && !(e.health <= 0)) mountMobOnVehicle(v, e, heightOf);
  }
}

// After the vehicles and mobs ticked: a passenger that is gone or was released frees the vehicle's side too.
export function syncVehiclePassengers(vehicles) {
  for (const v of vehicles) {
    const p = v.passenger;
    if (p && (v.dead || p.ridingEntity !== v)) {
      if (p.ridingEntity === v) hide(p, "ridingEntity", null);
      hide(v, "passenger", null);
    }
  }
}
