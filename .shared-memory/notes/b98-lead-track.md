# Batch 98 lead (2026-11-23)

Ten Sonnet tracks in `../wt98-<name>` on `batch98-<name>98`, cut from main 3dd97fce9 (0.126.0) and merged --no-ff on `batch98-lead`. Rules: `../artifacts/b98-lead/track-rules.md` (batch 97 rules plus scratch-file and already-native rules). Released as 0.127.0.

## Merged
- mpobjects98 369b41155: `animal-use.js` predicts count-0 shears (sheep, mooshroom), wear `'held'` as single player; snapshot lit set left live (Port-read, pinned for Overworld and Nether).
- credit98 10ff9ea76: `ServerSurvival.dieGone` for a logged-out shooter's removed body; `hitPlayer` Thorns after Knockback/Fire (`survival.thorns?.`; single-player `Survival.thorns` checked to exist).
- console98 114745186: `profile-properties.js` (circular import with `net-packet-ids.js` is call-time only); `watcherSig` from `watcherEntries`.
- spcopy98 09c46d2e0: `waitExitWindow` in `dimension-live.js` (bounded 15 s, before the save; `openWorld` would wait for the same cells anyway).
- mpperf98 5b5008e41: `MC_MPPERF98`; beacon gate checked against `tickBeacons`' `time: this.ticks`; old mpperf test regexes and `bench-alloc81.mjs` accept `mode98=`.
- portals98 556ba4bd2: `mobLinks`; `riderSneakOff` (horse-live mixin) and `mountEntity(rider, null)` let the rider go.
- tiles98 fa5d56aac: `skullFields` / cart `itemTagsNbt` raw keys; `inert-drops.js` and the jukebox `spawnInert` hook are unused so far.
- horse98 29b0e3063: `dismount(p, native)` queues the `dismount` message; `rider.released` is read nowhere else on the server; `offline87` table entry added.
- mobrec98 90c80e2da: villager look timer and newborn bonus/yaw; 5 reference files under 2 MB.
- entnbt98 a33d7a73a: `setAbilitySpeeds` (module state, reset on every `launch`; defaults equal the old constants); two code-read `main.js` lines.

## Lead checks
- No manual merge resolution. One full `npm test` on the merged tree: 10873/10873; build ok; bridge 5/5. No browser checks.
- Flakes seen in track runs, left unedited: `cmd-exec-b83`, `horse89-b89`.

## Open
"Still open from batch 98" in `public/research/remaining-gaps.md`. Noted by the lead: a portal-travelling mob's player rider is put down without the `dismount` packets (`server-portal-travel.js unmount` calls `dismount(pl)` without `native`); the F3 walk/fly line in `main.js` still shows the constants.
