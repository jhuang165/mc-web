// Guns mod (not 1.7.10): the glue between main.js and firing.js. main.js calls attack(), key() and tick() only while a guns
// world is loaded; each returns false when the held item is not a gun, so vanilla input carries on unchanged.
import { GunController, fireShot, GLASS_BLOCKS } from "./firing.js";
import { GUNS, M870 } from "./catalog.js";
import { ENTITY_TYPES } from "../../entities.js";
import { rayTraceBlocks } from "../../projectiles.js";
import { mobScale } from "../../slime.js";

const KEY_R = 19, KEY_G = 34; // LWJGL codes; neither is bound in 1.7.10's default controls
const HEAD_MARGIN = 0.25; // a hit within this far below the eye line, or above it, is a headshot

// deps: { survival, world, mobs, eye() -> { origin, dir }, playerPos() -> {x, z},
//   sneaking(), moving(), breakBlock([x,y,z]), renderHotbar(), markUnsaved(), toast(text), playing?(), onEvent?(event), random? }
export function createGunHooks(deps) {
  const controller = new GunController();
  let tapTicks = 0; // a tap (touch, or a click without pointer lock) holds the trigger until it fires or for this many ticks
  const held = () => deps.survival.inventory.held;
  const holdingGun = () => GUNS[held()?.id] !== undefined;
  const inventory = () => ({
    held: held(),
    slot: deps.survival.inventory.current,
    creative: deps.survival.creative,
    count: (id) => deps.survival.inventory.count(id),
    take(id, n) {
      const inv = deps.survival.inventory;
      if (inv.count(id) < n) return false;
      for (let i = 0; i < 36 && n > 0; i++) {
        const s = inv.main[i];
        if (s?.id !== id || !(s.count > 0)) continue;
        n -= inv.decr(i, Math.min(n, s.count))?.count ?? 0;
      }
      return n <= 0;
    },
  });

  function shoot(gun) {
    const ray = deps.eye();
    if (!ray) return { hits: [], impacts: [] };
    const { origin, dir } = ray;
    const out = fireShot(gun, {
      origin, dir, random: deps.random ?? Math.random, sneaking: deps.sneaking(), moving: deps.moving(), aiming: false,
      traceBlocks(start, end) {
        const hit = rayTraceBlocks(deps.world, start, end, true);
        return hit && { ...hit, id: deps.world.get(...hit.block) };
      },
      pickEntity(o, d, max) {
        const v = (a) => ({ x: a[0], y: a[1], z: a[2] });
        return deps.mobs.pick(v(o), v(d), max, max);
      },
      breakGlass(block) { if (GLASS_BLOCKS.has(deps.world.get(...block))) deps.breakBlock(block); },
      isHead(e, point) {
        const t = ENTITY_TYPES[e.type];
        if (!t) return false;
        return point[1] >= e.y + t.height * mobScale(e) * 0.85 - HEAD_MARGIN;
      },
    });
    const from = deps.playerPos();
    for (const { entity, amount } of out.hits) {
      if (entity.health <= 0) continue;
      // Every bullet is a fresh hit: TaCZ skips the hurt-resistance window, which would otherwise drop 9 of 10 AKM rounds.
      entity.hurt = 0; entity.lastDamage = 0;
      deps.mobs.attackEntityFrom(entity, amount, {
        name: "player", player: true,
        ...(gun.id === M870 ? { from: { x: from.x, z: from.z } } : {}), // only the shotgun knocks back
      });
    }
    return out;
  }

  return {
    controller,
    holdingGun,
    // key.attack pressed (down) or released while playing. True when a gun took it.
    attack(down) {
      tapTicks = 0;
      if (!holdingGun()) { if (!down) controller.release(); return false; }
      if (down) controller.press(); else controller.release();
      return true;
    },
    // A tap with no held button (the touch break button, a click without pointer lock): one trigger pull. True when a gun took it.
    tap() {
      if (!holdingGun()) return false;
      controller.press();
      tapTicks = 20;
      return true;
    },
    // A raw key press while playing with no screen open: R reloads, G switches fire mode.
    key(code) {
      if (!holdingGun()) return false;
      if (code === KEY_R) { controller.startReload(inventory()); return true; }
      if (code === KEY_G) {
        const mode = controller.toggleMode(held());
        if (mode) deps.toast(`${GUNS[held().id].name}: ${mode === "auto" ? "Automatic" : "Semi-automatic"}`);
        return true;
      }
      return false;
    },
    // Once per game tick.
    tick() {
      if (deps.playing && !deps.playing()) { controller.release(); tapTicks = 0; } // a screen opened mid-burst lets go of the trigger
      const events = controller.tick(inventory());
      if (tapTicks > 0 && (--tapTicks === 0 || events.some((e) => e.type === "shot" || e.type === "empty"))) { tapTicks = 0; controller.release(); }
      let changed = false;
      for (const event of events) {
        if (event.type === "shot") { event.result = shoot(event.gun); changed = true; }
        if (event.type === "reloaded" || event.type === "shell") changed = true;
        deps.onEvent?.(event);
      }
      if (changed) { deps.renderHotbar(); deps.markUnsaved(); }
      return events;
    },
  };
}
