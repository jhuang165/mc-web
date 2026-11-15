// Client half of server-crit-fx.js: EntityCrit2FX for each pfx73 event. EntityCrit2FX holds the live entity for its 3 ticks, so `live` (b74 mpcombat74) resolves the
// event's mob (`i`, wire id -> a { x, z, minY, width, height, mx, my, mz } record) or player (`pl`, wire id -> the remote player's { x, y, z, ySize } state) at each step.
// Without a resolver, or once the copy is gone (the entity untracked), it falls back to the snapshot of the packet.
export function applyCritFx(message, fx, live = {}) {
  for (const e of message?.events ?? []) {
    if (![e.x, e.y, e.z].every(Number.isFinite)) continue;
    const snap = { x: e.x, z: e.z, minY: e.y, width: e.w || 0.6, height: e.h || 1.8, mx: e.mx || 0, my: e.my || 0, mz: e.mz || 0 };
    fx.crit2(() => {
      const mob = e.i !== undefined ? live.mob?.(e.i) : null;
      if (mob) return mob;
      const p = e.pl !== undefined ? live.player?.(e.pl) : null;
      if (p && [p.x, p.y, p.z].every(Number.isFinite)) return { ...snap, x: p.x, z: p.z, minY: p.y - (p.ySize ?? 0) };
      return snap;
    }, !!e.m);
  }
}
