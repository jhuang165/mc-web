# mpobjects97 (batch 97): redstone.lit is the flush moment's set; portal-orb ids and block-event order checked

## Summary
- **`multiplayer/simulation.js`**: `flushedLit = [...beforeLit]` right after `flushChanges` (which advances `beforeLit` to the lit set at mq.b's place); the tick message's `redstone.lit` is that, not the end-of-tick set. Cells lit/unlit by the entity pass, block events or tile entities show up in `redstone.lit` together with their block change in the NEXT tick.
- **`multiplayer/server-nether.js`** (`flushDimension`) returns `lit` (the flush's set); **`server-dimensions.js`** `netherMessage` uses it (falls back to the live set when the dimension was not ticked). Nether and End share this path.
- New test `src/mpobjects97-b97.test.js` (3 tests).

## Evidence
- **Port-read**: the only consumer of `message.redstone.lit` is `main.js` (replaces the client's `redstone.lit` Set each tick; used for `scene.repeaterLit`, repeater light, comparator input). Native keeps the lit state in the block id (93/94, lamps, rails), so it arrives only with the S23/S22 of the flush: the client could never see a lit state ahead of its block change. The port's end-of-tick set showed it a tick early.
- **Bytecode-read (b95/b96 notes)**: mq.b flushes S22/S23 before the block events and entity pass in `mt.b`.
- **Item 2, Port-read**: server orbs (all dimensions, summon, items) are built with `new ExperienceOrbs(...)` without an `EntityIds`, so every orb id comes from the one module counter; the portal arrival (`seed` ignores the record's id) takes the next value: unique among all server orbs, ascending. The tracker keys rows per kind (`orb:${i}`, `server-object-tracker.js`), the client keeps its own `remoteOrbs` map, so ids of different kinds never meet on the wire; the server already uses four independent counters (mobs, vehicles, item eids, orbs). No collision or wrong-sequence is observable: left as is, pinned by a test (passes without any fix).
- **Item 3, Port-read**: the tick message is broadcast (`server/server.js` ~358) before `pistonOut` (~391), and `pistons.flush` queues S24 after the entity pass in all three lanes, so the flush's S22/S23 precede S24 as natively. Chest-lid / note-block S24 (`blockActions`) ride in the same tick message as `changes`; the cell change a piston event itself makes goes out in the next tick's flush, as native (S24 of tick T, S23 of T+1). Not changed; no new test for this item.

## Verification
- `node --test --test-concurrency=2 src/mpobjects97-b97.test.js`: 3 pass; with the three source files reverted: 2 fail (lit tests), orb pin passes.
- Neighbours: 192 test files naming DedicatedSimulation, multiplayer/simulation, server-dimensions/nether/end, redstone.lit, server-portal-travel (xargs node --test --test-concurrency=2): 1711 tests, 1710 pass, 1 fail. The failure (mpchunks71-b71 'a snapshot square leaves other columns blank', in two batch runs under load) passes alone with my change (10 of 10); recorded as a load flake, not edited.

## Found wrong in the batch 96 list
- None.

## Follow-ups
- Joining-client snapshot (`snapshot`, line ~765) still sends the live lit set; cells not yet flushed arrive with their change next tick (harmless, state converges).
- Browser-only: a repeater lit by an entity-pass event now lights its mesh one tick later on the client (not viewed).
