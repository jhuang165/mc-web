// ItemInWorldManager's dig timer (b53 digfinish; probe: tools/probes/DigFinishProbe.java, public/research/dig-finish-reference.json).
// The server keeps its own count of ticks (curblockDamage) and rereads the block at the cell when C07 status 2 arrives: it
// recomputes the damage as getPlayerRelativeBlockHardness * (ticks since the status-0 start + 1). At 0.7 or more it breaks whatever
// block is there (a softer one included); below that, and while no delayed break waits, it remembers the cell (receivedFinishDiggingPacket)
// and breaks it from its own tick once the damage reaches 1. The handler resends the block (S23) whenever the cell is not air afterwards.
// `rate` is Block.getPlayerRelativeBlockHardness for the server's player as it is now, or null for an air cell.
const f = Math.fround;
export function createServerDig() {
  // pos is the last C07 status 0 cell (ItemInWorldManager.partiallyDestroyedBlockX/Y/Z start at 0).
  const s = { cur: 0, initial: 0, pos: [0, 0, 0], received: false, delayed: [0, 0, 0], delayedInitial: 0 };
  const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  return {
    state: s,
    // ItemInWorldManager.updateBlockRemoving (EntityPlayerMP.onUpdate, before the network tick). Returns the cell it breaks, or null.
    tick(rateAt) {
      s.cur++;
      if (!s.received) return null;
      const rate = rateAt(s.delayed);
      if (rate === null) { s.received = false; return null; }
      if (f(rate * (s.cur - s.delayedInitial + 1)) >= 1) { s.received = false; return [...s.delayed]; }
      return null;
    },
    // C07 status 0 (ItemInWorldManager.onBlockClicked, Survival): initialDamage is set on every start, but the cell only moves when the block does not
    // break at once (air, or a rate below 1); an instant break leaves partiallyDestroyedBlockX/Y/Z where an earlier dig put them. `rate` as in finish (omitted: not instant).
    start(pos, rate) { s.initial = s.cur; if (rate == null || !(f(rate) >= 1)) s.pos = [...pos]; },
    // C07 status 2: 'break' (the block at the cell goes now), 'delay' (the server waits for its own damage to reach 1) or 'ignore'.
    finish(pos, rate) {
      if (!same(pos, s.pos) || rate === null) return 'ignore';
      if (f(rate * (s.cur - s.initial + 1)) >= f(0.7)) return 'break'; // the float 0.7F
      if (s.received) return 'ignore';
      s.received = true; s.delayed = [...pos]; s.delayedInitial = s.initial;
      return 'delay';
    },
  };
}
