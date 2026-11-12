// ItemInWorldManager's dig timer (b53 digfinish; probe: tools/probes/DigFinishProbe.java, public/research/dig-finish-reference.json).
// The server keeps its own count of ticks (curblockDamage) and rereads the block at the cell when C07 status 2 arrives: it
// recomputes the damage as getPlayerRelativeBlockHardness * (ticks since the status-0 start + 1). At 0.7 or more it breaks whatever
// block is there (a softer one included); below that, and while no delayed break waits, it remembers the cell (receivedFinishDiggingPacket)
// and breaks it from its own tick once the damage reaches 1. The handler resends the block (S23) whenever the cell is not air afterwards.
// `rate` is Block.getPlayerRelativeBlockHardness for the server's player as it is now, or null for an air cell.
// Batch 54 (digabort): the crack packets. World.destroyBlockInWorldPartially (S25 to the other players, never the digger) is reported through
// `crack(cell, v)`: v 0-9 is the crack stage as (int)(damage * 10) (10 for an air cell, and also any damage past 0.9), -1 clears it. `isDestroyingBlock` (digging)
// is the flag the status 0 start sets and the abort (C07 status 1, ItemInWorldManager.cancelDestroyingBlock) and a status 2 finish clear; `lastCrack`
// is `durabilityRemainingOnBlock` (-1 at first), which only the tick compares and never an abort resets. Abort and tick-side cracks: public/research/dig-finish-reference.json (b54da records).
const f = Math.fround;
export function createServerDig({ crack = () => {} } = {}) {
  // pos is the last C07 status 0 cell (ItemInWorldManager.partiallyDestroyedBlockX/Y/Z start at 0).
  const s = { cur: 0, initial: 0, pos: [0, 0, 0], digging: false, lastCrack: -1, received: false, delayed: [0, 0, 0], delayedInitial: 0 };
  const stage = (damage) => Math.trunc(f(f(damage) * 10)); // (int)(damage * 10.0F), both products in float
  const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  return {
    state: s,
    // ItemInWorldManager.updateBlockRemoving (EntityPlayerMP.onUpdate, before the network tick). Returns the cell it breaks, or null.
    tick(rateAt) {
      s.cur++;
      if (s.received) {
        const rate = rateAt(s.delayed);
        if (rate === null) { s.received = false; return null; }
        const damage = f(rate * (s.cur - s.delayedInitial + 1)), v = stage(damage);
        if (v !== s.lastCrack) { crack(s.delayed, v); s.lastCrack = v; }
        if (damage >= 1) { s.received = false; return [...s.delayed]; }
        return null;
      }
      if (s.digging) {
        const rate = rateAt(s.pos);
        if (rate === null) { crack(s.pos, -1); s.lastCrack = -1; s.digging = false; return null; }
        const v = stage(rate * (s.cur - s.initial + 1));
        if (v !== s.lastCrack) { crack(s.pos, v); s.lastCrack = v; }
      }
      return null;
    },
    // C07 status 0 (ItemInWorldManager.onBlockClicked, Survival): initialDamage is set on every start, but the cell only moves when the block does not
    // break at once (air, or a rate below 1); an instant break leaves partiallyDestroyedBlockX/Y/Z where an earlier dig put them. `rate` as in finish (omitted: not instant).
    // The cracks of the start: a block that is not broken at once (air included, as damage 1) shows (int)(rate * 10) at the cell.
    start(pos, rate) {
      s.initial = s.cur;
      if (rate != null && f(rate) >= 1) return;
      s.digging = true; s.pos = [...pos];
      const v = rate == null ? 10 : stage(rate);
      crack(s.pos, v); s.lastCrack = v;
    },
    // C07 status 1 (ItemInWorldManager.cancelDestroyingBlock): clears the cracks at the last start cell, whatever cell the packet names. A delayed break keeps running.
    abort() { s.digging = false; crack(s.pos, -1); },
    // C07 status 2: 'break' (the block at the cell goes now), 'delay' (the server waits for its own damage to reach 1) or 'ignore'.
    finish(pos, rate) {
      if (!same(pos, s.pos) || rate === null) return 'ignore';
      if (f(rate * (s.cur - s.initial + 1)) >= f(0.7)) { s.digging = false; crack(s.pos, -1); return 'break'; } // the float 0.7F; the cracks clear before the block goes
      if (s.received) return 'ignore';
      s.digging = false; s.received = true; s.delayed = [...pos]; s.delayedInitial = s.initial;
      return 'delay';
    },
  };
}
