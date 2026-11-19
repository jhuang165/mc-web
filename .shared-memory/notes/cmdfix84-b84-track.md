# cmdfix84 (batch 84): command follow-ups from cmdexec83 and plants83

## Summary
- /tp <player> <target> now gives the teleported player the target's yaw and pitch (CommandTeleport -> setPlayerLocation). Server: `lookOf` host method, `p.yaw/pitch` set, S08-style `playerOp "look"` so the client adopts it (`player-op.js`, `main.js` `setLook`). Single player: `env.teleport(x,y,z,look)`.
- Fire (short) is kept as native on FallingSand, minecarts, paintings/frames, arrows, fireballs, eyes and throwables (raw value, negatives too). Record writers/loaders and region export carry it.
- Untagged mob /summon sets Air 0 (native readFromNBT on an empty compound).
- `/setblock flower_pot <meta> replace {Item:0}` keeps an explicitly empty tile (`EMPTY_POT`, also through tile-sync); untagged keeps the meta's plant.
- Untagged /setblock of a sign with only another meta makes a fresh sign tile; /setblock over a jukebox ejects its disc first.

## Evidence
- Executed (CmdExec83Probe, `public/research/cmd-exec-reference.json`, 6 tab / 97 run / 228 summon rows, 0 crashed): the tp rotation (run rows carry yaw/pitch), untagged summon Air, and a one-tick `tick` row per `{Fire:...}` summon (fire, burning, dead after one `h()`).
- Bytecode-read: `bv` setPlayerLocation form; `sa.C`/`sa.h` fire part and which classes call `sa.h` (FallingSand, Minecart, Hanging never do, so Fire is only kept; `ze.h` calls setFire(1) so a fireball reads 20 after its first update); `sa.B` extinguish and handleWaterMovement zeroing; `ald.a(ahb,I)` createNewTileEntity; Chunk.func_150807_a calling the old block's breakBlock for the same block with another meta; BlockJukebox.breakBlock dropRecord.
- Not executed natively: pot, sign and jukebox rows (the probe's world double has no tile entities).

## Verification
- `node --test src/cmd-exec-b83.test.js`: 4 pass (replay now compares yaw/pitch, raw throwable Fire, falling/cart/arrow/eye fire, untagged Air).
- `node --test src/cmdfix84.test.js`: 4 pass (new).
- 49 neighbour test files (projectiles, fireballs, hanging, falling, setblock, plants83, jukebox, summon...): 691 pass, 0 fail. 65 files touching server-broadcast/player-op/region-export/tile-sync: 930 pass, 1 fail fixed afterwards (`serverbroadcast-b58.test.js`, 10 pass).
- Old tests updated because they encoded a gap: `plants83-b83.test.js` (Item:0 pot used to have no record; now an empty record, `potContents` null) and `serverbroadcast-b58.test.js` (ops now include "look"). `cmd-exec-b83.test.js` throwable branch used `max(0, fire)`; now raw.

## Follow-ups
- Executed: a minecart (every moveEntity user) rests a counter <= 0 at -1 after its first update; the port keeps the value as summoned.
- Water/rain extinguishing for the new kinds is bytecode-read only; the port has no per-kind water pass for carts, hanging, falling blocks.
- Fireball and hanging summons are covered by round-trip unit tests, not the probe-replay (the replay harness has no recording host for them).
- Native untagged summon does not run onSpawnWithEgg (an ocelot gets no kittens); the port still does.
- Browser-only: client look application after the `look` op, SP /tp rotation, empty pot drawing.
