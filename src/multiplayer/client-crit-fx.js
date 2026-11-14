// Client half of server-crit-fx.js: EntityCrit2FX for each pfx73 event, following a snapshot of the target (the native one follows the live entity for its 3 ticks).
export function applyCritFx(message, fx) {
  for (const e of message?.events ?? []) {
    if (![e.x, e.y, e.z].every(Number.isFinite)) continue;
    const target = { x: e.x, z: e.z, minY: e.y, width: e.w || 0.6, height: e.h || 1.8, mx: e.mx || 0, my: e.my || 0, mz: e.mz || 0 };
    fx.crit2(() => target, !!e.m);
  }
}
