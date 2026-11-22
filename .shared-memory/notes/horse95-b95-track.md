# horse95 b95 track

## Summary
- Item 4 only (root cause of the killed-saddled-horse drift). It is not a port bug: no code change. New test `src/horse95-b95.test.js` pins the cause.
- Items 1 (rider in water), 2 (lead pulls a ridden horse), 3 (/kill on a real EntityPlayerMP rider) are left open: no probe was written; one item done instead of four.

## Evidence
- Bytecode-read: `wi.bh()` is `l != null && cu()` (rider and saddle) `|| cm() || cn()` (rearing, eating). No health test. So a dying horse with no rider runs its AI (wander) for 20 death ticks; with a saddled rider it never does.
- Executed on the port (scratch loop, 400 seeds per case, kill after 3 ticks, then 1 and 4 ticks): unridden saddled horse drifted in 6/400 (1.5%, wander roll on the kill tick: seeds 37, 70, 99, 268, 285); zombie rider 0/400; player rider (horseSeats.mount) 0/400. The old "3%" was the unridden case, a saddle alone does not block the AI.
- Port-read: `entities.js` `dying()` runs `this.ai.think` for a horse unless saddled-with-rider, rearing or eating; matches `wi.bh`.

## Verification
- `node --test --test-concurrency=2 src/horse95-b95.test.js`: 2 pass, 0 fail. No fix exists, so there is no fails-without check.

## Found wrong in the batch 94 list
- "a killed saddled horse drifted ... not root-caused" was read as a rider case. It is native AI wander of an unridden corpse.

## Follow-ups
- Open: mount enters water, lead pulls rider off, /kill on a real `mw` rider (each needs a new Java probe in `tools/research/horse95-probe/`, copying Horse94Probe).
- Browser-only: none checked.
