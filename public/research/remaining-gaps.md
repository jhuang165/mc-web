# Remaining 1.7.10 gaps

Verified against `src/`, the generated parity catalogues and the research docs on branch b11-catalogue. This list is not a parity claim: rows marked Partial elsewhere in the catalogues still need audits that are not listed here. Where a research doc contradicts the code (for example `slime.md` saying magma cubes are missing, `eye-of-ender.md` saying there is no End), the code and tests were treated as authoritative and the doc is stale.

## Done in batch 99

Batch 99 covered these areas (track agents ran on Sonnet):
- **Horses.** The client applies the server's `dismount` message as S08, S1B, S08 (`client-dismount.js`): position and previous position at the spot, motion and ySize 0, riding cleared, in one step instead of from the next tick row. `Horse99Probe` explains the probe's 64.1 / 64.7 seat height as a random foal versus an adult; the port already matched.
- **Portals.** A player riding a mob, cart or boat that travels through a portal now gets the `dismount` message on the dedicated server (bytecode-read `ahb.e`). Away runs use `mobLinks` (consistency only). Leads through portals were audited and are already native.
- **Multiplayer objects.** An iron golem's rose status 11 is sent on every `setHoldingRose`, including an offer that ends with the counter already 0 (bytecode-read `wt.a(boolean)`). The server villager AI and the End snapshot lane are pinned by tests; both were already native.
- **Kill credit.** A logged-out shooter's removed body hit by Thorns plays the hurt or death sound, counts the `deaths` and killed-by stats (and `deathCount` objectives), and refreshes the saved record's stats. A tamed wolf's kill and a dispenser arrow or fire charge kill were already native (no owner credit, no XP flag).
- **The dedicated server.** `Console99Probe` executes the S0F, S1C, S20 and S04 sizes and the dirty attribute set for zombie, horse, villager and wolf; `/netstat` already matched.
- **Server speed.** Behind `MC_MPPERF99=on|off|verify`: the Overworld spawner player list is built only when read, `ChunkSet.chunks` returns its kept list for unchanged input, `deliverSounds` builds one player list per call. Hashes unchanged; gain within noise.
- **The single-player copy.** The Teleporter's 128-block search reads saved portal columns from edits and stored columns (`TerrainPeek.searchGet`), so a saved portal outside the exit window no longer builds terrain or loses the arrival hint. The End exit was audited (bytecode-read `mw.b(int)`) and matches.
- **Tiles.** A ghost jukebox disc leaves an inert id-0 drop in single player, saved inside `musicTiles`, exported as an `Item` entity with Health and no PickupDelay, and imported back. A known tag key with the wrong type is kept raw (`tag-types.js`, `Tiles99Probe` executed): it no longer enchants, renames or colours the stack.
- **Entity NBT.** F3 shows the loaded walk and fly speeds (walk raw). The XP bar fill follows `(int)(XpP * 183F)` (bytecode-read `bbv`): NaN, zero and negative draw nothing, above 1 overflows the track. The dedicated server loads, saves and moves with per-player ability speeds; non-finite saturation and exhaustion survive its JSON save.
- **Mob records.** 8 executed villager birth records (5, 9 and 12 doors, two and three villagers) replay with no divergence. Fix: `WatchClosest` keeps the later of two equal-distance candidates (`ahb.a`, `dcmpl; ifle`), so an adult looks at a child standing on its parent.

Found wrong in the batch 98 list:
- The probe horse's seat height was a foal versus an adult, not a port gap.
- "`tickSpawners`' per-tick player list" was built by its Overworld caller, not by `tickSpawners`, and is too small to show in the sampler.
- `inertDropNbt` wrote a PickupDelay that 1.7.10 `xk.b` does not write.

Still open from batch 99:
- **Multiplayer.**
  - Horses: a `dismount` message arriving while the client loads terrain is dropped; S08 carries no yaw or pitch on the port wire.
  - The dedicated server: a default-skin player's empty textures property (needs a captured session-server response); textures size modelled, not signed. Clients predict movement with default ability speeds.
  - Kill credit: the removed body gets no death throw, S19, XP orbs or kill credit.
  - Speed: `moveEntityBody` / `moveWith` boxing, the `next` iterator tail, `bb.slice()` for own-bb entities, `track` packet pushes, `FineGrid`, `explosionBlocksWith`.
  - Tiles: the server's ghost jukebox disc ejects no inert drop (`server-music.js`).
  - The golem rose statuses are bytecode-read only, not executed against a real tracker.
  - Server commands: /publish stays off. End island tails past 128 blocks are cut on some seeds (left for the user's decision). WebSocket compression stays off.
  - Not seen in a browser: the client dismount snap, the golem arm after an offer ends, plus the batch 67 to 98 lists.
- **Single player.**
  - The copy: the terrain read beside the picked portal still needs the worker when the wait is shorter than one cell build; whether the credits screen pauses a public-LAN host's server is unconfirmed.
  - Tiles: tolerant numeric tags (`Unbreakable`, `map_is_scaling`, enchantment id and lvl) are rewritten as byte or short; extra keys in `ench` entries and the insides of `Fireworks` and `Explosion` are lossy.
  - Entity NBT: a non-positive `xpBarCap` (about level 3e8) hides the whole bar natively, the port only zeroes the fill; a non-finite walk or fly speed is ignored (deliberate).
  - Mob records: iron golem rose offering and village spawn, witch potions, a bat in water; villager sounds and hearts not compared.
  - Not seen in a browser: the F3 walk/fly line, the XP bar at odd XpP, the batch 98 list.
- **Rendering.** No native pixel capture.
- **Effects.** The game uses the Java 8 effect order; which JRE 1.7.10 players ran is not settled.

## Done in batch 98

Batch 98 covered these areas (track agents ran on Sonnet):
- **Horses.** Every `mountEntity(null)` on the dedicated server (a sneak off a pig, horse, cart or boat, a horse's buck, a rider in water) queues a `dismount` message counted as the native S08, S1B, S08; a vanished mount, a death release and a logout stay silent. `Horse98Probe` (real classes): a pig rider stays linked in 1-deep water and is let go in 2 and 4 deep, a horse rider in 1 and 2 deep stays and in 4 deep is let go; the port already matched.
- **Multiplayer objects.** The client predicts the shear with count-0 shears in hand (sheep and mooshroom), wearing the held stack as the server does. A joining client's snapshot keeps the live lit set, because its columns are live too (pinned, Port-read).
- **Kill credit.** A Thorns hit on a logged-out shooter damages the removed body; a lethal one broadcasts the death and drops the inventory (`ServerSurvival.dieGone`, bytecode-read `mw.a(ro,F)`, `mw.a(ro)`). A player victim's Thorns now runs after the mob's Knockback and Fire Aspect (`yg.n`).
- **The dedicated server.** A spawning player with a skin or cape counts a modelled textures property in its S0C (`profile-properties.js`). `watcherSig` is the nine watcher values, so an amplifier change with the same potion colour no longer forces the off-beat position. Other attribute modifiers need nothing: only max health and movement speed are watched (bytecode-read `yj`, `tq.a(tn)`).
- **Server speed.** Behind `MC_MPPERF98=on|off|verify`: `movePlayer` stores fields without literals, the beacon player list is built only on a beacon's 80th tick, `deliverSounds` skips an empty queue. Hashes unchanged; whole-tick heap and time within noise.
- **The single-player copy.** A Nether-to-Overworld trip whose portal wait ended before the exit window was built (or a scripted trip) waits for the worker-built 8 x 8 window, bounded at 15 s, and then gets the arrival hint before the old world's save; no generation on the page thread. The window covers the neighbouring cell of an arrival near a cell border.
- **Portals.** Only a mob that rides something is held back; a mob ridden after it touched the portal travels at the threshold and its rider (player or mob) is let go and stays behind, in single player and on the server (`Portals98Probe`, 6 executed records). The cooldown audit for riding mobs, carts and boats found nothing diverging.
- **Tiles.** Raw unknown tag keys survive mob helmet copies (`skullFields`) and cart item tags (`minecarts.js`). Command block LastOutput/SuccessCount/TrackOutput and sign records (`tiles95-reference.json`) already round-tripped. `inert-drops.js` holds an inert id-0 drop for a null-item jukebox eject but is not wired yet.
- **Entity NBT.** `Entnbt98Probe` (20 entity ids, 48 edge tags): Fire, Air, PortalCooldown and Dimension were already native; projectile `Invulnerable` is now exported. XpP, XpLevel and XpTotal are kept raw; NaN HealF, saturation and exhaustion survive; loaded walkSpeed and flySpeed drive movement (two code-read `main.js` lines); `playerState` and `abilitySpeeds` pass the `world-import.js` whitelist.
- **Mob records.** 32 executed villager records (wander, indoors, doors, zombie avoidance, breeding gates, restock, trading look, a birth) replay with no divergence. Fixes: the trade look task runs the native 40 + nextInt(40) timer and outlives the closed screen; a born villager draws its follow-range bonus on its own Random and faces yaw 0.

Found wrong in the batch 97 list:
- "Attributes beyond Health Boost / Speed / Slowness / sprint not modelled" needs nothing: no other attribute is watched.
- A ridden mob that counted down in a portal is reachable, not "practically unreachable".
- `playerState` never reached a real import (missing from the whitelist), so loaded Motion and speeds did not survive.
- The `item-component.js` display extras and the sign / command block round trips were already native.
- The horse95 probe gave its player yOffset 1.62 (`mw` has 0); its verdicts still hold.

Still open from batch 98: carried into the batch 99 list above, less what batch 99 fixed or found wrong.

## Done in batch 97

Batch 97 covered these areas (track agents ran on Sonnet):
- **Horses.** A player who dies on any mount keeps the seat through the 20 death ticks and is let go where they sat the tick after, or at the respawn. Single player now matches the server (`death-ride.js`); the old `die()` detached at once and searched a landing spot, which native never does. `Kill97Probe` (real `mw`, `xi` boat, `xs` cart) shows boats and carts work the same, and the server's cart and boat path follows it. The water-dismount spot for a horse, pig, boat and cart matches executed `mountEntity(null)` records.
- **Multiplayer objects.** The tick message's `redstone.lit` is the lit set at the `mq.b` flush in all three lanes, not the end-of-tick set (Port-read against the bytecode-read `mt.b` order). Portal-arriving orb ids were shown not to collide (pinned). S22/S23 go out before S24 in every lane (code-read).
- **Kill credit.** A real reload drops a stashed thrower's dead body (`EntityThrowable` saves only `ownerName`; `EntityArrow` saves no owner). Balls and potions thrown before the save now credit the living player, and arrows credit no one. On the server, a mob's Thorns now hits an arrow whose shooter logged out. Fire Aspect, Smite and Bane on mob weapons were audited and already native.
- **The dedicated server.** `Console97Probe`: a spawning player's armour S04s, one S1D per active effect and the S20's modifier bytes are counted; a changed watcher's S1C (changed entries only) and a dirty attribute's S20 are counted each tick for viewers and the player. The spawn-only row fields ride only on the tick a viewer starts tracking.
- **Server speed.** Behind `MC_MPPERF97=on|off|verify`: the move scratch list keeps its backing store (`blockBoxesFast` 6 to 0.05 MB per 150 travel ticks); `itemList` and `presence` lost their closures. Sampled heap 255.6 to 250.0 MB, bench heap per tick 2.5% lower, tick time unchanged, hashes unchanged.
- **The single-player copy.** Standing in or near an End portal arms the early arrival, so End trips compute it in the portal tick (the `SpCopy97Probe` `overToEnd` case executed that native does it all in the one tick). Finite Overworld roots now get a hint. The exit prewarm builds the arrival's chunks first.
- **Portals.** A mob arriving in the End has pitch 0 (bytecode-read `oi.a`; `Portals97Probe` ran the real `travelToDimension` for 25 mobs). Leashes and the other copied fields were already native.
- **Tiles.** Unknown item tag keys (in `tag` and `display`) are kept raw through saves, Java import and export, container moves and jukeboxes; an empty `tag` compound is kept and does not stack with a plain item. Offline player-head ExtraType was already native (`Tiles97Probe`).
- **Entity NBT.** `Entnbt97Probe` and `Entnbt97MobProbe`: player NaN Motion and negative awake SleepTimer are kept, food fields are no longer clamped, Score may be negative, fly and walk speeds pass through export. Mob attributes: no Health tags give the modified maximum, a missing UUID is zero, duplicate UUIDs replace, a missing Base is 0. An unticked lost lead writes `Leashed` with no `Leash` compound.
- **Mob records.** 22 new executed records (15 bat, 7 shears) replay with no divergence. Fixes: bats no longer push or get pushed, and broken shears stay in the hand at count 0 and keep shearing a sheep until a melee blow clears them.

Found wrong in the batch 96 list:
- Single-player `die()` also searched a landing spot.
- Natively, S1D/S1E for an effect added or removed while tracked go only to the player; and the whole-watcher S1C is 37 bytes for any id.
- `blockBoxesFast`'s cost was the scratch list's backing store, not box arrays.
- Count-0 shears are not empty, and NaN Motion is not 0.
- A batch 29 claim: an unusable Leash tag is not written back.
- The finite real arrival used the wrong peek and disagreed with its hint.

Still open from batch 97: carried into the batch 98 list above, less what batch 98 fixed or found wrong.

## Done in batch 96

Batch 96 covered these areas (track agents ran on Sonnet):
- **Horses.** `Kill96Probe` (a real `mw`): a killed player rider stays seated through the 20 death ticks and is unlinked the tick after with no teleport; respawn unlinks it. The dedicated server now holds mob-mount riders until then (`server-vehicles.js`, `server-survival.js respawn`). `Horse96Probe` (real `td.bL`): a lead on a ridden horse was already native, the rider keeps its seat.
- **Multiplayer objects.** The Nether and End lanes flush block changes right after weather, as the Overworld did in batch 95. Village and siege ticks run in `ServerMobs.villageStep()` after the flush and before block events and the entity pass in all three dimensions (bytecode-read `mt.b`: `mq.b`, `wc.a`, `wb.a`, portal forcer, block events).
- **Kill credit.** Mob-on-mob Knockback pushes along the attacker's yaw and slows the attacker by 0.6 (`yg.n`); a player's splash-potion kill applies the thrower's Looting. Skeleton Power/Punch/Flame, wither skeleton fire, Thorns on mob arrows and the `yg.n` order were audited and already native (bytecode-read).
- **The dedicated server.** `Console96Probe`: a player entering the tracked set counts its S0C and the native follow-ups (S1C, S20, S1B, S04, S0A, S1D). Tracked player rows count only the packets their tracker entry sent each tick (`pk`); far rows count nothing.
- **Server speed.** Behind `MC_MPPERF96=on|off|verify`: tracker loops walk maps and sets without iterators (`eachValue96`); several hot array loops became index loops. Sampled iterator allocation 15.2 to 10.4 MB per 150 travel ticks; bench heap per tick and tick time unchanged; hashes unchanged. The travel baseline hash in earlier notes was stale.
- **The single-player copy.** A Nether-to-Overworld trip now gets its early arrival from the exit prewarm's built cells (`announceNow`, no generation, no stall), computed inside the portal tick when the destination edits were pre-read. A batch 95 guard skipped every Overworld trip (`target` 0). `SpCopy96Probe` executed the Nether-to-Overworld listing.
- **Portals.** A hopper cart without `TransferCooldown` reads 0. The server's cart records were already right; the wire state now carries custom display watchers 20 to 22 to client copies. Server items, orbs and boats were audited.
- **Tiles.** `Tiles96Probe` (real authlib): the jukebox keeps the record's tag and Damage (`rawDamage`), an unregistered `Record` loads as native's id 0 stack, out-of-range skull types drop their raw damage, an unregistered moving-piston `blockId` is air. Hopper, dispenser, dropper, brewing stand, chest, note block, end portal, daylight sensor and piston records were executed.
- **Entity NBT.** `Entnbt96Probe`: loaded effects carry no attribute modifiers until re-added (a loaded Speed stays at 0.1), and export writes the real potion Modifiers; player Motion and the awake SleepTimer (100 to 109) round-trip; AttackTime stays 0 for players (bytecode-read).
- **Mob records.** 65 new executed records replay with no divergence: cows, mooshrooms, pigs, chickens (eggs, breeding, chick growth), shears with a real stack, bats. Fixes: breeding spawns one XP orb of `nextInt(7)+1`, breaking shears draw the world Random for the break pitch, a growing baby widens its box and nudges back.

Found wrong in the batch 95 list:
- A lead on a ridden horse was already native; a dying player rider's immediate dismount was not.
- The server's cart records were fine; the gap was the wire state.
- "Skull Owner not re-executed" was stale (executed in `item-tags2-reference.json`).
- The batch 95 arrival guard skipped every Overworld trip.
- Session effects did write empty Modifiers, and loaded effects wrongly acted.

Still open from batch 96: carried into the batch 97 list above, less what batch 97 fixed or found wrong.

## Done in batch 95

Batch 95 covered these areas (track agents ran on Sonnet):
- **Horses.** A player rider whose eyes are in water steps off a horse or pig at once, on the dedicated server and in single player (`sv.C`, Executed: `Horse95Probe`, `horse95-reference.json`); mob riders already did. The killed saddled horse's rare drift is the native wander of an unridden horse (`wi.bh` has no health test), not a port bug.
- **Multiplayer objects.** The Overworld dedicated server builds its block-change flush right after weather, at `mq.b`'s place before block events and the entity pass, so changes made later in the tick (falling blocks, pistons, hoppers, mob griefing) reach clients in the next tick's flush (bytecode-read).
- **Kill credit.** A player victim of a player runs its held item's Thorns after its armour; mob-on-mob `hitMob` runs the victim's Thorns once (not for wolves, slimes, magma cubes, iron golems, ocelots and snow golems, whose attacks skip `yg.n`). Bytecode-read.
- **The dedicated server.** Only a player entity's S13 is sent at once (`mw.d` executed in `Console95Probe`); mobs, items and carts killed during network handling are removed in the next tick's entity pass, so the batch 94 queue was already right for them. `/netstat` counts the immediate S13 of a player leaving the tracked set or disconnecting.
- **Server speed.** Behind `MC_MPPERF95=on|off|verify`: a flat explosion position set reproducing Java HashMap resize and bin order. Explosion allocation 5.5 to 3.2 MB per 150 travel ticks, heap per tick 1 to 3% lower in travel; tick time within noise; scenario hashes unchanged.
- **The single-player copy.** The Teleporter result is computed on a copy of the destination before the old world's save point (`announceArrival`), so a copy that left reads as standing at its arrival and mobs targeting it keep it within follow range (Nether and End destinations). `SpCopy95Probe` executed the old world's listing at the scaled chunk (none for End exits), modelled by `PlayerView.listedIn`. The chunk-gate switch is set at `launch`.
- **Portals.** Only a world opened from the title screen (and the dedicated server's start) resets port-only mob transients and gives dropped items delay 0 and a fresh hover (`xk.a(dh)` reads no PickupDelay, bytecode-read); portal trips, away runs and dimension switches keep them. Cart custom display fields survive save and portals; furnace cart Fuel is no longer clamped.
- **Tiles.** An idle-stopped away run counts its unrun ticks with `skipTicks`. `Tiles95Probe` (81 records over 12 tiles): spawner Type defaults to `""`, cart command block string reads, raw skull SkullType and Rot bytes survive saves and export, the jukebox holds and ejects any stack.
- **Entity NBT.** `Entnbt95Probe` (a real `EntityPlayerMP`): player export writes Sleeping/SleepTimer, HurtTime, DeathTime at Health 0, OnGround, FallDistance, the held weapon or tool attack modifier and the sprint speed entry (`player-nbt.js`). Zombie and horse random attributes round-trip from executed compounds.
- **Mob records.** 31 new executed records replay with no divergence: long pigman and giant fights, sheep and squid. Fixes: the giant's age drives its despawn roll, shearing uses the sheep's own Random, a lamb's undyed colour draws the world Random.

Found wrong in the batch 94 list:
- The killed-horse drift was an unridden horse's wander, not a rider case.
- A PvP victim's held Thorns visit is its only one, not a second.
- A removal during network handling sends its S13 at once only for player entities.
- A player saved at Health 0 was modelled (`die()` saves); a later save on the death screen kept DeathTime 0.
- Two old tests encoded port assumptions (skull type clamp, disc-only jukebox) and were corrected.

Still open from batch 95: carried into the batch 96 list above, less what batch 96 fixed or found wrong.

## Done in batch 94

Batch 94 covered these areas (track agents ran on Sonnet):
- **Horses.** The `horse88-b88` and `horse92-b92` flakes were in the tests, not the port: unseeded wander and idle-rear rolls leaked into replays; the tests now stub the AI and inject a no-hit Random (40 runs, no failure). The dedicated server now decays a player rider's strafe and forward input by 0.98 on every C05 before a C0C overwrites it (`mw.i`, `decayRideInput`; boats share it). `Horse94Probe` (6 scenarios): mount and rider setDead and kills already matched.
- **Multiplayer objects.** The dedicated server and its Nether and End flush block events after random ticks and weather bolts, before the entity pass (`tickBlockEvents`), as `mt.b` does. The Overworld Teleporter cache sweeps before the portal checks, so a Nether-to-Overworld trip on a multiple of 100 ticks no longer misses an expired entry. Sieges (no zombie spawns in 1.7.10), chunk unloading and the tree's other block kinds needed no change.
- **Portals.** Single player keeps a player-held lead across a portal when the holder is in the destination (the 10-block rule, as on the server); the away run follows. A `/summon` or a single-player portal copy starts the port-only mob transients over (`mob-transient.js`); the lead found that stripping them on every browser-save restore broke away-run ticksExisted (awaytracker-b60), so saved-record restores now keep them, and the single-player portal handoff strips them as the server's arrive does. Items cross portals without their pickup delay and hover, and orbs, carts and boats keep their OnGround.
- **The single-player copy.** An entity is first sent to the player when its chunk column is sent, at login and after every portal arrival: five columns per tick in the native spiral, own column first, each sent column re-testing its entities (`sp-chunk-gate.js` over the server's `ChunkWatch`; single player only).
- **Kill credit.** A mob holding a Bane weapon rolls the slowness once, not twice (`afv.b` adds the held item only for players). A player's hit or arrow visits a mob victim's held Thorns item twice, a mob's once (`afv.a`). Balls, potions and arrows left in a Nether or End stash keep the dead body (`ownerBody`). A dead body keeps the armour it wore (server `deadBody`, single-player `deathBodyHere`), which feeds Bane on its arrows; its arrows no longer hurt the new player through Thorns.
- **The dedicated server.** Every kind's S13 ids (mobs, items, thrown rows, carts and boats, TNT and fireballs) share one queue per connection, drained once at the end of the player's slot as packets of at most 127 ids; a dead cart's or boat's S13 waits a tick. The End tracker lookup is tested on a live server.
- **Server speed.** Behind `MC_MPPERF94=on|off|verify`: `legacyThink` uses one shared environment object instead of 14 closures per call, and `scratchBox` copies only in mpperf81 verify mode. Heap per tick is 2 to 4% lower; tick time is within noise. The terrain hash change was explained: the batch 92 note's value predates a batch 92 merge, and console93's golem-ball `kinds` field moved it again.
- **Tiles.** `awayResult` applies the away run's time shift whatever the live rule at return (`away-time-shift.js`), and ticks skipped on the wall budget count under the rule in force when the run stopped (`skipTicks`). Dispenser, dropper, hopper and brewing stand state was already in cell metadata; an unread `facing` field on generated dispensers was removed.
- **Entity NBT.** `Entnbt94Probe`: a Health 0 mob with `DeathTime` 20 or more is an immortal corpse, a negative `DeathTime` counts up to 20, a live mob keeps its `DeathTime`, and the dragon writes what it loaded. Unknown effect ids are dropped, enderman carried ids from 128 read as air (the data is kept), minecart display values are masked, `ItemRotation` keeps Java's `% 4` sign, an empty item frame writes no rotation or drop chance, and a chested horse always writes `Items`.
- **Mob records.** 18 new executed records replay with no divergence: wither blue skulls, armour against arrows, mob attackers, block breaking (also with mobGriefing off), regeneration and a wither-effect kill; pigman group anger at 20, 30 and 34 blocks, pigman and giant hit by a zombie, a giant with pigmen. Fixes: bow arrows now trigger the armoured wither's arrow immunity (`directArrow`), wither block-break drops use the world Random, and a mob killed by the wither effect skips its AI and ambient roll.

Found wrong in the batch 93 list:
- The horse test flakes came from unseeded test rolls, not port randomness.
- `ServerMobs.restore` does not exist; mobs load through `EntityWorld.restore`.
- Item, orb, cart and boat portal records were not fully NBT-shaped (delay and hover, forced OnGround).
- A keepInventory body keeps its armour natively.
- Dispenser, dropper, hopper and brewing stand facing needed no audit fix.
- A live mob's `DeathTime` does not tilt the client copy (the spawn packet does not carry it).
- The probe's explosion double not pushing skulls was a probe artefact; the armoured wither's arrow immunity existed but never fired for bow arrows.

Still open from batch 94: carried into the batch 95 list above, less what batch 95 fixed or found wrong.

## Done in batch 93

Batch 93 covered these areas (track agents ran on Sonnet):
- **Horses.** The multiplayer client copy of a mob rider now gets the rear shift (it read only the live horse's counters). The player seat reads `bM`, the previous rear amount, without interpolation (`wi.ac`), so the rider no longer sits one tick early. A mob rider's input decayed twice (0.9604 instead of 0.98); `sv.e` scales `bd`/`be` by 0.98 once and the horse reads them raw (`Horse93Probe`, 5 scenarios, `horse93-reference.json`).
- **Multiplayer objects.** The dedicated server and its Nether and End run natural spawning right after the sleep skip and before scheduled ticks (`ServerMobs.spawnStep`). Fluids, fire, falling blocks and redstone share one `TickTree` per dimension, run in (time, priority, id) order under the 1000 cap (`attachTickTree`); redstone entries deferred while their column was not resident now run once released.
- **Portals.** On the dedicated server a lead held by a player survives the trip when the holder is in the destination within 10 blocks (`sw.bP`); a knot-held lead was already native. A mob copy drops about 30 port-only transients (`TRANSIENT_MOB`), since native `copyDataFrom` carries only NBT, the portal cooldown and the teleport direction.
- **The single-player copy.** `SpCopy93Probe` (distinct ids, a real `mw`, real `mn`/`mq`) corrected batch 92's probe: the player leaves its departure chunk and is listed in the old world's chunk at the scaled position (`oi.a` calls `mt.a(sa,Z)`); `trackEntity` sends nothing at arrival and entities spawn as each chunk is sent, five per tick. No port change.
- **Kill credit.** A landed arrow runs the shooter's attacker-side enchantment hook after Thorns (`afv.b`: armour, plus the held item for players); only Bane of Arthropods overrides it, so Slowness IV now applies; Fire Aspect does nothing on arrow hits. Single-player deaths in the Nether and End leave a dead body for balls, potions and arrows. A thrower who changes dimension keeps the same EntityPlayerMP (already modelled on the server).
- **The dedicated server.** The join S1C carries a command-block cart's command and last output, and a string change sends its own S1C (`Console93Probe`, 18 records). Golem snowballs get tracker entries (64 / 10 / velocity). TNT, fireball, skull and golem-ball rows queue their S13 for the player's next tick (`mw.d` / `mw.h`, at most 127 ids). The Nether tracker lookup is tested on a live server.
- **Server speed.** Behind `MC_MPPERF93=on|off|verify`: `FineGrid` keeps its maps when the entity list is unchanged, and the portal step rewrites its records in place. Heap per tick is 5% lower in travel, 9% in pen and 2.5% in terrain; tick time is within noise.
- **Tiles.** The away clock fixes each tick's increment and darkness before command blocks run, so a `/time` shift or a `doDaylightCycle` change first reaches the next tick, as natively. Chest facing reads only cell metadata; old records migrate once at load.
- **Entity NBT.** A mob saved mid-death keeps Health 0 and its `DeathTime`, loads as dying and goes at 20 (`Entnbt93Probe`).
- **Mob records.** 32 new executed records replay with no divergence: squid and bat (14), wither skeleton (8), the wither's spawn and first attacks (6), pigman (2) and giant (2). Fixes: squid and bat corpse tails, squid head yaw and silent pitch draws, bat bounding box; wither skeleton sounds, sunburn draw and coal/bone drops (this build's 301/311); the wither's despawn roll, invulnerable task offset, corpse targets and float yaw; a hit on a pigman in its hurt window still re-rolls its anger.

Found wrong in the batch 92 list:
- A knot-held lead already re-attached at the destination.
- Mob rider input values were not just port-read: they decayed twice.
- The b92 probe's "the old world keeps updating the player" and "it stays in its chunk list" came from every probe entity having id 0.
- Only golem snowballs lacked tracker packets, and mobs, thrown rows and items already delayed their S13.
- A dying mob is saved natively; the port dropped it.
- The wither skeleton dropped original-numbered items, played zombie-family sounds and skipped the sunburn draw.

Still open from batch 93: carried into the batch 94 list above, less what batch 94 fixed or found wrong.

## Done in batch 92

Batch 92 covered these areas (track agents ran on Sonnet):
- **Horses.** `Vehicle92Probe` showed the released rider's push runs in the network tick after the world tick whatever the list order, so the port was already native. A C0C sent before the C02 mount is dropped, as natively (`takeRideOrQueue`). `Horse92Probe` (9 scenarios): a mob rider sets `prevRotationYaw`, the rear seat shift uses `prevRearAmount`, riders copy the mount's body yaw, and the port's non-native half-turn of the rider in `endRidden` is gone.
- **Multiplayer objects.** The dedicated server and its Nether run the sleep skip, then scheduled ticks and block events, then random ticks, then entities, then hoppers, brewing stands and moving pistons, then the tracker flush (`tickScheduledSystems`, `tickTileSystems` in `world-tick.js`; bytecode-read `mt.b` / `ahb.h`). Same-pass spawns survive a removal in the same turn.
- **Portals.** Mobs, dropped items, XP orbs, minecarts and boats cross portals on the dedicated server with the 300-tick cooldown, placement through the Teleporter path, riders put down and leads dropped (`server-portal-travel.js`, reusing `EntityPortals.step`, `entityDeparture` and `ServerPortalShots.placed`). Ridden mobs, the dragon and crystals stay.
- **The single-player copy.** `SpCopy92Probe` ran the real `transferPlayerToDimension`: the old world drops the player at its turn in the entity walk and the entity that moves into its slot is skipped that tick (not for End exits). The port now flips `left` at the player's turn with the same skip. The away run's `absent` stand-in reads as `left`, and player edits return `player-left` while away.
- **Kill credit.** A dead thrower's snowballs, eggs, pearls and potions keep the old body as thrower (knockback from its position, mobs target it); a dead thrower's pearl moves the new player without the 5 damage. An arrow landing on a mob that wears Thorns hurts the shooter, on the server and in single player (`thornsOfVictim`).
- **The dedicated server.** S1C changes count on the native schedule (a still mob no longer undercounts), including creeper state, enderman carried block and wither targets; the S1C and S12 after a cart or boat join count; TNT and fireballs send one S0E, then tracker moves and an S13 (`Console92Probe`).
- **Server speed.** Behind `MC_MPPERF92=on|off|verify`: the mob target box store now survives `tickMobs` replacing the list (it had been thrown away every tick), and boxes are rewritten in place across ticks; one shared `PathFinder` and pooled `beginMemo` pages. Heap per tick is about 6 to 9% lower in travel and 11% in terrain; tick time is within noise.
- **Tiles.** Single-player random-tick and sleep light reads use the entity-time darkness. The away run's clock started at the trip's end time; it now starts at `plan.time - ticks`, counts only while `doDaylightCycle` is on, and reads darkness at the native point.
- **Entity NBT.** `HurtTime` and `AttackTime` round-trip; a witch keeps Equipment, DropChances and CanPickUpLoot; fireballs keep their in-ground state; the firework item writes `Explosions` only when it had one; the item import no longer reads `PickupDelay`; hanging entities write `Fire` 0 (`Entnbt92Probe`).
- **Mob records.** 15 new executed records replay with no divergence, including size 2 and 4 slime and magma cube splits with ticked children (the probe now updates spawned entities for `b92mr` records), snow golem fights and an iron golem against a blaze. Fixes: a size 1 slime dropped this build's Water bucket (item 341) instead of the Slimeball (460); slime and magma cube target boxes now scale with size, so bigger ones are hit; split children start at body yaw 0; the server copy pushes at its own list place; a witch reads a mob target's health and effects.

Found wrong in the batch 91 list:
- "Box reuse would alias held records": the store was discarded every tick, so there was no cross-tick reuse to alias.
- "`sleep.worldTick` stays after the darkness capture" was wrong: native computes skylight after the skip.
- Dead entities leave the list in their own turn; only unloaded ones are swept at the start of the next pass.
- "A forward key in the mounting tick arrives late" was a harness limit; the real gap was a C0C before the C02.
- `away-entities.js` did not just keep its own clock: it started at the wrong time.
- The away `absent` stand-in did not read as `left` (the away run despawned spiders, pigmen, silverfish, blazes and endermen on its first tick).
- Hanging `Fire` is written as 0 natively; `PickupDelay` was a non-native import read.
- Enderman scream and wither invulnerability were already counted, and Nether and End mob sizes were already right.

Still open from batch 92: carried into the batch 93 list above, less what batch 93 fixed or found wrong.

## Done in batch 91

Batch 91 covered these areas (track agents ran on Sonnet):
- **Horses.** `Vehicle91Probe` ran a real EntityPlayerMP sneaking off a boat and an empty cart (14 records, `vehicle91-reference.json`): the mount makes its full move with the rider's input, then the rider is released in the same tick, and the dismount spot is searched from the previous tick's seat. The port already matched, in single player (14/14) and on the dedicated server (7/7). A living mob on a saddled horse now steers it and blocks the horse's AI (`steeringRider`; `wi.e(FF)` and `wi.bh()` test EntityLivingBase, bytecode-read); vanilla reaches this only through commands or NBT.
- **Multiplayer objects.** The dedicated server and its Nether run weather, random block ticks, lightning and bolts before the entity pass, and maps just before the tracker flush (`mt.b`, `mt.h`, bytecode-read). Remote boats and carts cast the 0.5 shadow (`vehicleShadowCasters`).
- **Mob packets.** `copy-meta` carries watcher 8 (ambient); any dirty watched value now opens the tracker's gated branch, so S20, the head and the position no longer lag a potion, burning, air or similar change (`copyMetaDirty`). Mobs spawned during another entity's update (babies, reinforcements, slime children, chicks from eggs, converted villagers) update in the same pass (`adoptSpawns`). `MobPackets91Probe` executed the order S1C, S20, S19, S12 (`mobpackets91-reference.json`).
- **The single-player copy.** `PlayerView.alive` reads false while `left`, and mob targeting, despawning, wolf and ocelot owners, villager trading, leashes, sieges, pushes, spawners and beacons skip a copy that left the world. The new world arrives in one tick, as natively (port-read).
- **Kill credit.** A dead body as attacker becomes the target of the hit pigman, pigmen within 32 blocks, other legacy mobs and zombie reinforcements (bytecode-read). A dead shooter's arrow on the new body is no self hit: the hit sound plays, Thorns run on the old body, and item frames and paintings read the old body's Creative flag. Live players' arrows trigger Thorns on the server. Queued attacks, uses and bow releases keep the look they arrived with.
- **The dedicated server.** S0F and S1C count owner strings and name tags (probe sizes: wolf 102, ocelot 95, horse 108); later S1C changes are counted per connection and key; carts, boats, items, XP orbs and falling blocks count their real tracker packets (`Console91Probe`). The light hash costs about 0.09 ms per column (about 3% of a cache miss), so it was left alone.
- **Server speed.** Behind `MC_MPPERF91=on|off|verify`: `sendAttributes` returns early for plain mobs whose numbers did not change. Heap per tick is 7.5% lower in travel, 4.6% in terrain and 19% in pen; tick time is within noise.
- **Tiles.** Chest facing lives in cell metadata 2 to 5, as in native; old saves migrate lazily from the tile record, which stays as a fallback for one release. Mob light reads (`mobs.lightAt`, `isDaytime`, `lightSubtracted`, the spawner pass) use the entity-time darkness.
- **Entity NBT.** The away run and the dedicated server move arrows and rockets between dimensions (`server-portal-shots.js`). An audit of 84 native entity ids (`entnbt91-reference.json`) fixed: mobs always write `CustomName` and `CustomNameVisible`, saved `Air` survives, minecart display blocks import, no `PickupDelay` export, pigman baby and villager flags only when set, no `Age` or `InLove` on giants and dragons.
- **Mob records.** 22 new executed records replay with no divergence (dead-player fights, slime and magma cube fights, iron golem against slime, magma cube, silverfish, witch, pigman and giant; `enderman-wolf-b91mr-reference.json`). The dead copy keeps ticking until removed; legacy mobs' closest player has no alive test; the wither and zombie-door aux pitch uses the client world random; slime contact hits run at the moved position, slime hurt volume is 0.4 × size, and `faceEntity` takes a float square root. The batch 90 self-target rule is confirmed in `vu.a` bytecode.

Found wrong in the batch 90 list:
- Native runs scheduled block ticks before random block ticks, not after.
- Remote XP orbs already cast a shadow.
- Item, orb and falling-block packets were not counted as S18; they were not counted at all.
- The Thorns gap was wider: the server ran no Thorns for player arrows at all.
- The mob-light lag held only with a frozen clock (`doDaylightCycle` off).
- Mobs always write `CustomName`; `PickupDelay` is not a 1.7.10 key.

Still open from batch 91: carried into the batch 92 list above, less what batch 92 fixed or found wrong.

## Done in batch 90

Batch 90 covered these areas (track agents ran on Sonnet):
- **Horses.** A sneaking rider of a horse or pig gets off right after the mount's own update in the sneak tick: on the dedicated server (`server-vehicles.js` `finishSneak`, `sneakOffVehicles`) and in the single-player copy (`PlayerView.sneakOff`); a dying pig's sneaking rider too. `Entity.setDead` and `onDeath` never touch the rider (bytecode-read).
- **Multiplayer objects.** Falling blocks update before the tracker pass, so their S0E goes out in the tick they spawn; summoned and loaded falling blocks get their spawn-time join state; a pushed crystal explodes on cactus, fire and lava; the multiplayer client's falling copies cast the falling-block shadow.
- **Mob packets.** Re-adding Speed, Slowness or Health Boost sends the S20 row again; the head S19 goes after S1C and S20; the wither's movementSpeed is the widened 0.6F.
- **The single-player copy.** onGround carries through a portal trip; an S08 sent from the world pass or a click is answered in the next network tick; a broken mount sends one S08, not two.
- **Kill credit.** A respawned player's TNT, arrows and punched fireballs keep the dead body as the attacker mobs see (revenge drops it at their next update); queued digs and placements use the look the click arrived with; away-run dispensed snowballs and imported ownerless snowballs are marked, and a player's snowball exports its owner name.
- **The dedicated server.** Spam, illegal-character and duplicate-login kicks count an S40; the cached chunk length changes with light; chunk data carries real metadata and S23 sizes use the native id; tracker packets count under their own ids, and S0F/S1C use executed DataWatcher sizes for 29 living classes (`Console90Probe`).
- **Server speed.** Behind `MC_MPPERF90=on|off|verify` (identical state hashes): the per-view vehicle loop without arrays, recycled `FineGrid` arrays and answers, an inline `world.get` for the last column, no closure in `moveEntityBody`. Heap per tick is 3.4% lower in travel, 1.3% in terrain and 5% in pen; tick time is within noise.
- **Tiles.** Furnace facing round-trips through cell metadata in import and export; `/setblock` of a dispenser or dropper takes the facing from `onBlockAdded`, and `/setblock lit_furnace` stays lit; mob spawning reads the previous tick's darkness in single player and on the server.
- **Entity NBT.** Arrows and firework rockets go through portals with their NBT (an arrow that starts the update in the ground touches none); a copy arriving in the player's own dimension joins the live lists at once.
- **Mob records.** 13 new executed records replay with no divergence: a spider jockey on a ring wall (5) and a blaze against dead or creative players (8). A mob is never its own target (its own arrow), the blaze keeps a dead player target as `td.bq` does, the player's eye is the float 1.62, and the blaze's shot pitch no longer draws the world random.

Found wrong in the batch 89 list:
- "PlayerView sees the sneak one tick late" held only for horses and pigs; carts and boats were already in order.
- The S20 row order cannot be matched: the native set holds attribute instances with identity hashes, so its order varies between JVM runs.
- S1D has no ambient field in 1.7.10; ambient travels only as watcher 8 in S1C.
- "Block states outside the cell" was wrong only for chunk data; S22/S23 carry a fixed metadata byte.
- Natively `/setblock` ignores a dispenser's metadata; the port kept it.
- A broken mount sent two S08s.

Still open from batch 90: carried into the batch 91 list above, less what batch 91 fixed or found wrong.

## Done in batch 89

Batch 89 covered these areas (track agents ran on Opus, by request):
- **Horses.** On the sneak tick the horse makes one more ridden move and lands a jump sent that tick before the dismount; a fresh horse's first ridden tick has air speed 0; when the mount dies the client stays at the seat; a buck moves the client (`Horse89Probe`, 10 scenarios).
- **Multiplayer objects.** The server tracks falling blocks (type 70, range 160, frequency 20) from every dimension with their join state, and the client draws and collides with the copies; the multiplayer client walks into remote boats; the server's reach check uses the native eye (0 for a crystal, height × 0.85 for living mobs; it was NaN for every mob); `/summon EnderCrystal` lifts y by 1; piston-pushed crystals keep their centred box with step height 0; fireballs sweep the crystal box.
- **Mob packets.** Remote mobs get S20 attribute rows at spawn and on change (maxHealth, movementSpeed, horse jump strength); a new watcher gets one S1D per effect; the tracker entry and spawn packet come from the mob's state at spawn; skeleton arrows update in their spawn tick (`MobPackets89Probe`, 32 records).
- **The single-player copy.** A boat or cart broken under the player sends a position set to the seat; the old copy stops ticking during a portal trip; motion carries through the Teleporter (turned for Nether portals, zeroed on the End platform); the mount and sleep-start ticks are position sets. Batch 88's portal carry-over never ran in the game (the trip was deleted before launch read it); it does now.
- **Kill credit.** The server credits the combat tracker's best attacker, then the attacking player, then the revenge target; a respawned player's primed TNT belongs to a frozen copy of the dead body; the fireball punch uses the look the click arrived with; dispensed arrows save no shooter; a dispensed snowball is a plain thrown hit.
- **The dedicated server.** Autosave every 900 ticks, silently; /netstat counts real deflated chunk lengths and item tags, one record per native packet (S03 every 20 ticks, one S26 per five columns), and an S40 for each kick (`Console89Probe`, byte-exact).
- **Tiles.** Non-command world edits that swap a chest or furnace go through `swapTiles` in single player and the away world; `/setblock` compares chest and furnace facing; the server's darkness reads the time before the increment.
- **Entity NBT.** `travelToDimension` departs from the saved Dimension; fireballs and rockets count PortalCooldown down; mob import keeps the raw Fire. Eggs and bobbers are never saved natively, so nothing changed there.
- **Mob records.** 20 executed records replay with no divergence (`b89mr`): snow golem against a blaze, poison on mobs and on the player up to Poison IV, hunger and regeneration. Poison on a mob goes through the magic damage path; snow golems target every hostile type except creepers and ghasts; a blaze keeps flying at a dead mob target for the tick; exhaustion adds as a float.
- **Server speed.** Behind `MC_MPPERF89=on|off|verify` (identical state hashes): the remaining for-of loops, restored mobs reshaped, empty sense-cache clears skipped, the AI getter without a closure, and `TaskList` walking only running tasks. Heap per tick is 5.5% lower in travel, 13% in pen and 6% in terrain; tick time is unchanged.

Found wrong in the batch 88 list:
- Crystals had no eye height of 1.7 on the server: the reach check read a field the server's mob records lack, so the eye was NaN for every mob.
- 1.7.10 sends no S1D/S1E for a mob's effect changes; watchers see only the watcher 7 colour and S20.
- Eggs and fishing bobbers are never saved by 1.7.10, so there is nothing to export.
- Batch 88's portal carry-over and batch 59/60's away-run catch-up never ran in the game: both read `record.transit` after `DimensionLive.arrive` deleted it.

Still open from batch 89: carried into the batch 90 list above, less what batch 90 fixed or found wrong.

## Done in batch 88

Batch 88 covered these areas (track agents ran on Opus, by request):
- **Horses.** Single-player riding matches native tick for tick in 18 executed runs (`Horse88Probe`). The ridden move takes the rider's input as is (the port decayed it by 0.98, also on the server); a jump released in mid air no longer fires on landing; a plain rear holds still; jump strength reads the attribute with its modifiers; yaw wraps `% 360`. Pigs with a carrot on a stick already matched.
- **Boat placement and crystals.** The server's boat ray uses MathHelper's tables and the server eye (`BoatRayProbe`, 116 edge records, 0 mismatches); a dead player blocks a boat through death tick 20 only. The crystal box is [y-1, y+1] everywhere (`crystalBox` in `ender-crystal.js`); carts pass through crystals, boats stop at them, witch potions skip them, and they press only "everything" plates. The single-player player collides with the tracker's boat copies, so standing on a boat goes from 167 corrections in 200 ticks to 5.
- **Entity tracking.** The mob trackers give a returning player the native spawn, metadata and double delta; an arriving player takes its place after the pass's new entities; a late viewer gets spawn, full metadata, attach and one equipment packet per slot, and the client copy draws the equipment. With no mob system, objects spawned inside `tickEntitySimulation` keep their spawn state.
- **The single-player copy.** Landing dust, farmland trampling and the fall stat come from the copy's `handleFalling`; a position set inside the copy's tick ends the packet; a dismount is a position set; a dead mount leaves the copy at its seat; a portal trip carries fall distance and water state.
- **Explosions and kill credit.** The server reads the player's look from its per-tick copy; a punched fireball deflects another ball and kills with the puncher's Looting; fireballs save no shooter; an ownerless wither skull does 5 magic damage with no knockback and hits players. One player's TNT hitting another is the placer's "explosion.player", unscaled, refused with pvp off; a self kill counts. Arrow kills take the Looting of the item held at that moment.
- **The dedicated server.** Player data saves during /save-off (chunks do not); /save-all saves every world; /netstat reports native packet sizes from executed sizes of 99 packet classes (`Console88Probe`); /stop follows the native order. `/save-all flush` exists in 1.7.10.
- **Tiles.** A server chest/trapped chest swap spills and starts empty; a meta-only sign rewrite leaves a blank sign; the live daylight sensor runs on `getTotalWorldTime() % 20` with native inputs (`Tiles88Probe`, 728 records); in single player `/setblock` over an open container closes its screen; `/setblock` over an ender chest makes a new tile.
- **Entity NBT.** Mob saves keep Fire, OnGround, FallDistance and pitch; non-living entities keep the tag's Air or 0; every entity gets a random UUID at construction; projectiles keep PortalCooldown and Dimension; hanging entities keep theirs; an untagged Nether summon writes Dimension 0; no PortalCooldown clamps on load; boat falls already matched (`Entnbt88Probe`).
- **Mob records.** 20 executed records replay with no divergence: cave spider poison on each difficulty, an iron golem against creepers and spiders, a snow golem against zombies and creepers. Snow golem snowballs draw the constructor's three aim randoms, skip creepers as targets, and round the lift twice.
- **Server speed.** Behind `MC_MPPERF88=on|off|verify` (identical state hashes): stable number fields on mobs, index loops instead of for-of on the hot paths, departed watchers' stamps released, target numbers in a Float64Array. Heap growth per tick is 30% lower in travel, 34% in terrain and 6% in pen; tick time is unchanged.

Found wrong in the batch 87 list:
- `/save-all flush` exists in 1.7.10 (its lang keys are missing, so players see the raw keys).
- The live daylight sensor gated on the port's own redstone counter, neither world time nor total time.
- Boat fall distance already matched native.

Still open from batch 88: carried into the batch 89 list above, less what batch 89 fixed or found wrong.

## Done in batch 87

Batch 87 covered these areas (track agents ran on Opus, by request):
- **Riding.** Horses jump only through C0B action 6 and the native jump counter (`horseJumpCounter`); the C0C jump flag affects no mount natively. In single player a boat breaking a lily pad goes through `boatClearCell` (no exhaustion, stat or tool wear). Creative armour stays in the hand, with a window resend.
- **Boat placement.** `src/boat-place-entities.js`: `Boats.place` checks every collidable entity kind and the world border on the server, in single player and on the client. The client's check adds hooks, falling blocks, dragon parts and the crystal box [y-1, y+1]. `BoatEntityProbe` holds 60 executed records, 0 mismatches.
- **Object tracking.** The single-player tracker sends the first spawn with the state before the object's first update (`birth`, `birthWalks`). A player returning to a dimension gets this tick's state, with the native double delta. Explosions push every hook of the blast's world (`hooksIn`), its angler there or not. A stand-in lane's spawn to a Nether player never goes out, as `ServerDispense.flush` rechecks the dimension (no change needed).
- **The single-player copy.** The riding and sleeping branches are ported; fall damage comes from the copy through `handleFalling` (the client's `landPlayer` no longer deals it).
- **Explosions.** Players are filed by feet (candidate-order.js; 200 feet scenes, 2100 records). Server fireballs take the player's look and owner. TNT kills credit the placer; TNT with no placer no longer knocks mobs back; Blast Protection on mobs counts. A skeleton's burning arrow gives its TNT a placer. `ocelot-ai.js` read the look in the wrong unit (fixed).
- **Console and offline mode.** Offline logins use the offline UUID (`ServerAdmin.loginProfile`); /netstat counts by packet id (`net-packet-ids.js`); `levelSaving` is per world and the 4 partial rows replay; /netstat is Partial in the catalogue (`Offline87Probe`).
- **Tiles.** Beacons use total time; a sign id swap gives a fresh tile; `/setblock` over a container spills its contents (native in 1.7.10; it is 1.8 that clears them); away daylight sensors follow the world's time; a spawner removed in the away run leaves the saved list.
- **/summon.** `src/entity-base-nbt.js` reads and saves the shared Entity fields (Invulnerable, OnGround, FallDistance kept negative, Air, PortalCooldown, Rotation % 360, Dimension, UUID) for TNT and falling blocks; the export writes PortalCooldown and the real Dimension. Item `Age` keeps negative values (in 1.7.10 an item at -32768 still dies at 6000). A summoned mob's head keeps the constructor's random 0 to 6.28 degrees, its body yaw 0 (`Summon87Probe`, 88 executed rows).
- **Mob records.** 27 executed records: a witch fight, pigmen on Easy, in a group and killed by a golem, a squid against a ridden boat, villagers killed by a baby zombie. Dying pigmen now get angered (`nether-melee-live.js`).
- **Server speed.** Behind `MC_MPPERF87=on|off|verify` (identical state hashes): no per-mob closures in `tickMobs`, index walks in `push`, in-place item box tests, packet stamps in arrays, one shared copy of each non-spawn packet. Heap growth per tick is 6 to 18% lower; tick time is unchanged.

Found wrong in the batch 86 list:
- `/setblock` over a chest spills natively in 1.7.10; it is 1.8 that clears the contents.
- Minecarts have no collision box, so they do not block the copy; 1.7.10 has no hay bale fall cushion and no slime block.
- Boats were already in the browser copy's collisions.
- The C0C jump flag affects no mount in 1.7.10, so "stored but unused" is native.
- The batch 86 pigman damage record was the Hard value, not Normal.
- Away-run daylight sensors did not read noon: the run never refreshed them, so they kept their value from when the player left.

Still open from batch 87: carried into the batch 88 list above, less what batch 88 fixed.

## Done in batch 86

Batch 86 covered these areas (track agents ran on Opus, by request):
- **Riding in multiplayer.** A rider sends C05 and C0C every tick (sneak and 0.98 factors), and the server's ridden branch takes only the angles, onGround and the steer values in range; the rider's own boat steers on the previous tick's input. A boat breaking a lily pad plays the 2001 effect on the rider's client and to everyone within 64 blocks, and the dedicated server drops the pad.
- **Item-use prediction.** The empty map makes the client's own map (id counter from 0 per connection); armour equips at once; the boat ray starts at the native eye with the native sin/cos tables, and the sight and box checks see every entity copy. A client never spawns an overflow drop, as natively.
- **Thrown-entity tracking.** One shared tracker entry per thrown entity with a set of watchers; a late viewer gets the current state; a player who changes dimension is dropped from the old trackers and gets a fresh spawn on return. The stand-in lanes have their own trackers at the native range and frequency. A hook survives its angler's dimension change and dies past 32 blocks.
- **The single-player copy.** Mobs see only the accepted position (the packet is processed in the network tick). The 10-block guard and the `packetGround` gate are gone; server moves go through `setLocation` (/tp, pearls, bed wake); the hasMoved wait and the 20-tick correction resend are ported.
- **/summon.** An untagged summon runs onSpawnWithEgg before adding the mob, so kittens and jockey riders precede it in the world list (executed `Summon86Probe`). `Invulnerable` saves and loads on items, orbs, hanging entities, boats and carts, and exports per record. Item Health and OnGround are saved.
- **The away run.** It uses the world's own game rules (doTileDrops, doFireTick, mobGriefing), and every drop is gated. Sign, beacon, pot, note block and jukebox tiles ride the plan and come back; support loss pops blocks; beacons recheck their pyramid every 80 ticks. Five redstone hooks hidden by a stray comment since batch 84 are back.
- **Explosion cover.** `BlastOrderProbe` adds 600 executed scenes with blocks between the blast and the entities (1900 records, 0 mismatches). Fixed ray boxes: end portal, stems, trapped and ender chests, portals, nether wart, dragon egg, skulls, mushrooms and vines. On the server, flint and steel and burning arrows give primed TNT its placer, and a Creative placer's TNT breaks hanging entities with no drop. Dispensed TNT has no placer natively. A large fireball no longer gets NaN motion from the player's TNT.
- **Mob records.** 22 executed records replay with no port change: squids pushing boats and ticked players, villager-to-zombie conversion on each difficulty, and a zombie pigman fight.
- **Console and offline mode.** The console runs as "Server" at level 4 with its log; /netstat answers the console; `online-mode=false` gives unknown names their offline profile (`OfflinePlayer:` UUIDs). The probe holds 1979 executed rows, and the 675 new console and offline rows replay with 0 mismatches.
- **Server speed.** Behind `MC_MPPERF86=on|off|verify` (identical state hashes): no packet queue triples, cached state parses and wire numbers, one-pass tracker walks, pooled item move boxes. Heap growth per tick is 5 to 6% lower; tick time is unchanged.

Still open from batch 86: carried into the batch 87 list above, less what batch 87 fixed.

## Done in batch 85

Batch 85 covered these areas (track agents ran on Sonnet):
- **Riding boats in multiplayer.** The local player is seated on the client's own boat copy (`RemoteVehicles.seatOf`), so the 2-block snap back to the server's boat is gone. After a dismount the boat stays non-empty for `noteRiders`, as natively. The client copy clears snow layers and lily pads it runs into.
- **Item-use prediction.** A new `clientUseItem` predicts lily pads, buckets, glass bottles, boats and throwables on the client after the C08 goes out.
- **Fishing hooks on the wire.** Hooks ride the thrown lane (S0E type 90 with the angler id). A thrown copy keeps its join baseline. Arrow and hook copies get hit targets; native throwable copies never hit entities on the client (`zk.h` checks isRemote).
- **The single-player copy's moves.** New `server-process-player.js`: the copy moves from the last accepted position, with collisions zeroed and the moved-wrongly check, and mobs are corrected through `mobs.serverCorrect`. The integrated owner skips moved-too-quickly, as natively.
- **Pickup and drops.** Creative players pick up items on the server and take the whole stack. The away run stores skull tiles. The farmland and crop self-check is gone: BlockFarmland has no onBlockAdded, and setBlock notifies only the neighbours.
- **Dedicated-server tab completion.** All 64 recorded tab rows replay and match. Admin notices go only to ops whose level reaches the command's level. The probe now holds 1401 executed rows.
- **Summon tags.** `Invulnerable` is honoured on every kind, and summoned items and XP orbs read Health as `&255` (0 when absent). The replay covers hanging entities and fireballs.
- **Explosion probe.** `BlastOrderProbe` now also executes 300 scenes each for the dragon, hanging entities and ender crystals (1300 records, 0 mismatches). Fixes: dragon health is clamped at 0, and a Creative player's TNT breaks paintings and frames with no drop (single player).
- **Zombie conversion and squids.** A converted villager is seeded from the record and ticks in the zombie's pass. A converting corpse runs its whole death update. A zombie killed by fire in that update keeps health 0. 23 executed conversion records and 7 squid push records replay.
- **Server speed.** Behind `MC_MPPERF85=on|off|verify` (identical state hashes): no per-tick observe records, size arrays, entry sets or per-packet destination arrays. Heap growth per tick is about 4% lower on the travel scene and 10% lower on the pen scene; tick time is unchanged.

Found wrong in the batch 84 list:
- A non-positive fire counter already rests as natively.
- Carts, hanging entities, falling blocks and crystals have no native water pass.
- onSpawnWithEgg runs only with no tag (`{}` skips it), so the ocelot summon already matched.
- The farmland self-check was not native (removed, above).

Still open from batch 85: carried into the batch 86 list above, less what batch 86 fixed.

## Done in batch 84

Batch 84 covered these areas:
- **Boats in multiplayer.** A boat copy draws its water-entry and speed splashes on its own random. The rider's own boat runs the boat physics from the rider's input on their client, with S12 and far position packets correcting it as `xi.a(DDDFFI)V` does. A late joiner gets a spawn state built from the vehicle's current position, rotation and motion.
- **Thrown entities on the wire.** Arrows, snowballs, eggs, pearls, potions, XP bottles, rockets and eyes of ender reach clients as tracker packets at the native range, frequency and velocity flag (bytecode-read `mn.a(sa)`), and each client copy flies itself between them. Blast-hit arrows set velocityChanged, so their S12 goes out.
- **Placement refusals.** Every ItemBlock `canPlace` refusal (entities, occupied, support) is withheld from the block C08 and sends the item use; the extra S23 was only the result of the old C08. Lily pads are placed by the native ray trace onto source water, in single player and on the server. Placement collisions and sleeper boxes only see players in the same dimension.
- **Drops.** A skull drops on any block replacement (explosions, /setblock, /fill, the dragon, fire) unless its no-drop bit is set; the Wither build drops none. The server pops carpet, signs, stems, cake, flowers, crops, ladders and snow layers when their support goes. Creative worlds drop items as in 1.7.10; only a Creative player's own break skips drops. Away-world piston drops lost a doubled half-block offset.
- **Dedicated-server commands executed.** `Dedicated84Probe` ran the 16 dedicated commands (`netstat` included) on the real classes: 645 rows replay clean. Fixes: /list is op-only, the profile cache learns directory profiles, the one-character argument checks of ban-ip, pardon-ip and kick, the whitelist's seen count, the save-all flush keys, netstat for players.
- **Mobs.** A zombie that converts alive runs the rest of its update; a projectile hit teleports an enderman corpse; the wither's head particles draw on its own random; the live squid pushes.
- **Explosions.** The dragon body takes its blast push and its parts are collected before the first hurt; single-player hanging drops spawn at the entity's turn; the ender crystal uses its native box (posY at the centre) and eye height.
- **Rain and fire.** Boats, falling blocks and fishing hooks get rain in their fire tail (single player, server, away run). Item and orb fizzes play at the feet. `RainFireProbe` (executed) replays a burning primed TNT and minecart through rain, roofs and dry fire.
- **Commands.** Player-to-player /tp copies the target's yaw and pitch (with a server look op). Falling blocks, carts, hanging entities, arrows, fireballs, eyes and throwables keep a summoned `Fire`; untagged summons get Air 0. `{Item:0}` leaves an empty pot, a meta-only /setblock makes a fresh sign, and /setblock ejects a jukebox's record.
- **Server speed.** Behind `MC_MPPERF84=on|off|verify` (identical state hashes): cached mob boxes for ball targets (about half the `mobTargets` allocation), indexed loops in entity and item moves, fewer modifier arrays and step results. Batch 83's verify mode no longer throws on dragon tests.

Still open from batch 84: carried into the batch 85 list above, less what batch 85 fixed or found wrong.

## Done in batch 83

Batch 83 covered these areas:
- **Redstone drops.** The dedicated server's redstone now drops items (pistons, pot plants, components losing support, nether wart), into the dimension's own item list, with `doTileDrops` applied inside the drop. A crushed block drops what its 1.7.10 class drops, with the same draws (no more "Water" item or bad bed and skull ids), and single-player piston drops no longer get a second spread.
- **Command blocks.** /gamemode from a block or cart no longer becomes its LastOutput, and the target's own line reaches the target. Player commands run without a player from a block give "You must specify which player you wish to perform this action on." The multiplayer comparator preview reads the synced SuccessCount; the GUI shows the command in Previous Output when there is no output yet.
- **Rain.** One `isWet` (water or `canLightningStrikeAt` at the feet or head cell) is used by rockets, primed TNT, items, XP orbs, minecarts, arrows, wolves and endermen, in single player, the away run and the server: burning TNT, rockets and carts fizz out. The minecart fire counter already existed; native never sends a cart's flames.
- **Explosion order.** A blast fetches one list of every entity kind once, in native chunk-list order, and damages and pushes each in turn (executed, `BlastOrderProbe`: 400 scenes, 0 mismatches, nested crystal blasts included). The away run's blasts reach carts and boats.
- **Corpses.** A dying mob runs the potion countdown, the revenge lapse, its water flag and splash, and the squid, enderman, wither, wolf and snow golem living updates (executed, `CorpseLivingProbe`, for the squid and enderman). The iron golem's counters already ran.
- **Attacks and placement.** The attacker's own motion slows by 0.6 only where the client's target returns true (players, dragon parts, crystals, carts, boats); a sprint hit on a mob only stops the sprint. Crystal hits skip crits, enchantments and wear. Single player's server copy gets the jump rule and the sneak, fly and ride state; sleeping players use a 0.2 × 0.2 box; a place refused for entities sends an item use (C08 255); the dedicated server copy has riding and sleeping branches.
- **Multiplayer tracking.** Blast-pushed items and orbs send S12 to every tracking player; boats use the cart tracker (range 80, frequency 3, velocity, 1/32 steps, the 400-tick teleport) and coast on the client; vehicles drop out of range on the native 4-block re-check (executed vehicle records replay exactly). Fireballs and skulls splash on entering water.
- **Plants and /setblock tags.** Dandelion, shrub and double plant metadata survive placement, drops, pick and saves; shears and explosions drop the right plants. /setblock applies tags to flower pots, signs, note blocks, jukeboxes and comparators, in single player, the server and the away world, where a replaced pot now drops its plant.
- **Commands executed.** `CmdExec83Probe` ran /kill, /tp, /clear, the height checks, /achievement and 171 /summon rows on the real classes. Fixes: /kill's message, /clear's matcher, data check and cursor stack, the /tp dismount, the ±30000000 y limit and /summon's truncation, and /summon tags (Fire, OnGround, FallDistance, Air; the dragon and crystal with a tag).
- **Server speed.** Behind `MC_MPPERF83=on|off|verify` (identical hashes): an exact two-part JavaRandom seed (5 ns a draw instead of 35), frozen per-type sizes, reused push boxes, one player-position shape: 12 to 16 % less heap growth per tick; wall time within noise.

Still open from batch 83: carried into the batch 84 list above, less what batch 84 fixed.

## Done in batch 82

Batch 82 covered these areas:
- **Single-player and server blasts.** Ghast fireball blasts and the wither spawn blast now run inline, in the entity pass, as native does; the flaming fire roll draws from an unseeded `JavaRandom` (no `Date.now` left in `explosion.js`). Blasts push every entity kind (rockets, eyes, hooks, fireballs; leash knots break), and server blasts push dropped items, orbs and minecarts (`explodeNonLiving`).
- **Fireballs.** Ghast and blaze fireballs start at the shooter's angles, turn toward their motion, and save, import and export Rotation. They burn natively (executed, `BallFlagProbe`: the fire counter is 20 after each update, 0 in water), so flames are drawn over them; a large ball sends S12 every tick out of water. Multiplayer copies take angle bytes from S0E and S16/S17/S18, the burning flag from S1C, water's 0.8 and the flow push. A remote copy flies through blocks, as native does.
- **Fire counters.** Eyes of ender, firework rockets and primed TNT keep fire counters (TNT never counts down once lit), are drawn burning and save it; cauldrons no longer put out client copies.
- **Server command blocks.** `/spawnpoint <player>` from a block uses the target's position. Counts above 15 through wires and comparators already matched native (now tested). An optional chunk residency model for server ticks exists behind `residency: true`, off by default (the 128×128 server world makes "far from spawn" moot by default).
- **Commands.** An executed probe of 32 command classes (142 Tab texts, 265 command forms) is replayed in tests; about 25 fixes to texts, argument checks, feedback targets and Tab lists (for example "Hard", /tp across dimensions, /enchant check order, /gamerule unknown rules, /testforblock names, /summon's 57 names). Every Partial row in the command catalogue has a dated note.
- **Placement, dragon hits, exhaustion.** Client placement prediction checks entities (other players, mob, cart and boat copies, primed TNT), so a refused place does not swing. A sprint or Knockback hit on a dragon part slows the attacker to 0.6 and always lands; a PvP attacker sees its own crit burst too. The server player's own movement step (`mw.i()`) charges exhaustion a second time, as native does (sinking, knockback).
- **Corpses and horses.** Corpses age, run love mode, turn their body, catch fire in daylight and run the pigman countdown; converting zombies drop their XP at death tick 20. Horse herd following only records its target: in 1.7.10 it never moves a horse.
- **Entities.** Every Partial row in the entity catalogue has a dated note. Zombies and skeletons with a helmet take the sun on the helmet; firework stars show their colour; giants exist on the server.
- **Flower pots and Mining Fatigue.** Every way of removing a pot drops what it held (explosions, wither, dragon, water and lava, buckets, pistons, /setblock). `rawDamage` pots pick, save, sync and place correctly; exploded saplings keep their type. Under Mining Fatigue V the crack stage is `(int)(p * 10) - 1` and the meter never shows NaN.
- **Server speed.** Behind `MC_MPPERF82=on|off|verify` (identical results): a pruned `nearestView` scan, cached chunk keys, reused motion buffers and piston walks in place; travel allocation fell from 1293 to 1161 MB sampled.

Still open from batch 82: carried into the batch 83 list above, less what batch 83 fixed.

## Done in batch 81

Batch 81 covered these areas:
- **Chained blasts and fireball copies.** A crystal or TNT set off by another blast now explodes in the same tick, inside the outer blast, in single player and on the server (bytecode-read `wz.a`: setDead then createExplosion inline; TNT primed by a blast updates in the same entity pass). The multiplayer client's fireball and wither skull copies fly on their own between tracker packets (motion 0 at spawn, acceleration normalised to 0.1, update before packets as in `Minecraft.runTick`), smoke every update and draw twice more after impact; a punched ghast ball sends its new motion. The batch 80 gap "the client does no neighbour updates when it clears an exploded block" was wrong: a remote world runs none (`ahb.d` and `apx.a` test isRemote).
- **Server command blocks.** The success count is the number of players a selector matched (`/testfor @a` with three players gives 3, and the comparator reads it), in single player and on the server. Server blocks run with nobody in their dimension (the port's Overworld is always loaded); Nether and End carts run in their own dimension. The command cart setter follows MC|AdvCdm type 1 (no reach limit, the advMode replies). `/summon ~ ~ ~` from a block uses the block, and commands aimed at another player from a server block no longer throw.
- **Server speed.** Collision boxes and the per-move scratch boxes are reused (`MC_MPPERF81=on|off|verify`, identical seeded hashes): 14 to 42 % less allocation per tick; the cow pen tick drops from 1.18 to 0.92 ms, other scenes are within noise.
- **Multiplayer copies.** A revived dying wolf's copy was checked end to end and already matched. Dragon parts are picked only when the dragon's body is inside the crosshair search box, so the frozen parts stop being pickable once the dying body rises (single player and client). Wither skull copies take the spawn angles and the tracker's look packets and turn from their own motion between them, as the native client does.
- **Movement exhaustion.** Exhaustion and the `stat.*OneCm` counters follow `EntityPlayer.addMovementStat`: whole centimetres, 0.015 per cm diving (3-D) and swimming, 0.01 walking, 0.099999994 sprinting, nothing on ladders, in the air, riding or in Creative (executed, 360 records with a real EntityPlayerMP). The server's climb stat uses the ladder test.
- **Mining and collisions.** Haste and Mining Fatigue scale the speed inside `getBreakSpeed` before the water and air divisions (executed, 9,675 rows; Fatigue V never breaks a block). Items, particles, carts and projectiles meet a fence's two arm boxes, not their union. Snow, slab and block placement refuse when any colliding entity is in the way (`checkNoEntityCollision`), and a slab merge reads the cell past a one-layer snow or vine.
- **Corpses.** A dying horse keeps running its AI for its 20 death ticks (EntityHorse's own isMovementBlocked); a converting zombie can be cured again and keeps converting while dying; the inventory key on a horse asks for the horse window whenever the player rides one (single player opens it only for a tame horse); hits on a dragon part skip enchantment damage, knockback, crits, Fire Aspect and Thorns, which native applies only to a living target.
- **Throwables and fire.** Arrows in lava flag a velocity change (EntityArrow does not override attackEntityFrom); potions and experience bottles save their Fire; items, orbs, arrows, boats, potions and bottles draw the fire overlay (a sweep of all classes found only falling blocks refuse it), in single player and multiplayer.
- **Rendering.** End portal passes are clamped per pass, the shader's eye backs off 0.1 in first person, and every loaded portal tile is drawn within the 64-block cull (indexed per column). Wither skull projectiles keep their rotation through saves, import and export. The batch 80 gaps "the wither has no pitch" and "saved skulls start at rotation 0" were wrong for the wither and the skull block.
- **Flower pots and packs.** Breaking or picking a pot gives the stored item and Data (`rawDamage` when the catalogue has no variant); any registered item in a pot imports, saves and exports unchanged; pots sync their exact Data through S35. Stored packs that no longer load can be removed from the pack screen (a port choice: native leaves the file in the folder).

Still open from batch 81: carried into the batch 82 list above, less what batch 82 fixed.

## Done in batch 80

Batch 80 covered these areas:
- **Multiplayer explosions and fireballs.** The client runs its own half of the explosion packet (`client-explosion.js`, bytecode-read `bjb.a(gu)` and `doExplosionB(true)`): it clears the listed blocks after each cell's particles and makes the World.rand draws that ores and spawners make on a client, without undoing a block the server already changed (fire from a ghast blast). Server ghast fireballs now light fire (the `flaming` flag was dropped); server TNT minecarts send the explosion packet; wither skulls and crystals were confirmed. Wither skull smoke comes after the move with four bubbles in water, and clients draw smoke and bubbles behind server fireballs and skulls.
- **Server command blocks.** A powered command block runs its command on the server on the rising edge (one-tick delay, the success count for comparators, `commandBlockOutput`, level 2, only commands the server already supports; `enable-command-block` off runs nothing). Clients get the command and last output through S35, and the GUI's Done button sets the command for a Creative op of level 2 or more. `/gamerule` now reaches the shared mob and fire code on the dedicated server (`mobGriefing`, `doMobLoot` and `doFireTick` used to read their defaults there).
- **Collect animation and "Diamonds to you!".** A mob collector's item ends 0.5 below its feet (`EntityPickupFX` with -0.5), follows the live mob in multiplayer, and single-player mob pickups now fly too. The server award looks the thrower up only in the mob's own dimension.
- **Server speed.** Path search runs 20 to 30 % faster with identical output (`MC_MPPERF80=on|off|verify`): a cell-kind table, the safe-fall tries read once per search, a closure-free edge clamp, an original-id table. The spread scene's whole tick is unchanged (path search is about 2.4 % of it). Measured, not changed: deflate would cut bandwidth 70 to 90 % at 1.4 to 3.5 ms per tick; TLS cipher cost is under 0.5 ms per tick.
- **Corpse clicks.** Wolves, ocelots, horses, mooshrooms (stew and shears), pigs (saddle and carrot on a stick) and zombie villagers (curing) now take right clicks while dying, in single player, on the server and in client prediction; heals do nothing at health 0 (`sv.f`), and a bone tames and revives a wild dying wolf. A rider stays on a dying mount until it is removed. The dying dragon is aimed at and hit through its frozen parts.
- **Right-click swing.** Minecarts on any rail (a stack of 0 places and leaves -1), spawn eggs on a block with water around (block path, swings), slab merges (swing even with the player in the way), snow layer stacking (collision with the current height), and Adventure mode (no effect in 1.7.10) are swept; the empty map no longer swings. Multiplayer prediction uses the same rules (`right-click-swing.js`); a right click on a remote vehicle or the book screen no longer swings.
- **Fluids, falling blocks and fire.** Snowballs, eggs and pearls burn in lava (fire 300, saved and imported) and draw the entity fire overlay; still fluid falling blocks land without a scheduled tick and flowing ones with theirs; flowing and still fluid stacks no longer merge; region import reads sign and spawner tiles the native way; a loaded burning item keeps its Fire (executed, 107 records).
- **Flower pots and packs.** Tall grass pots at any Data 0 to 15 and cobweb pots import and draw as native; pot plant tint follows the pot's metadata. Pack descriptions with `translate` components work through the shared chat component (with the English fallback retry, which chat now uses too). A pack whose pack.mcmeta fails to load (no `pack_format`, bad JSON, no file) is left out of both lists, as native does (executed, 50 rows).
- **Rendering.** The end portal draws TileEntityEndPortalRenderer's 16 passes (texture, depth, scale, colour from `Random(31100)`, scroll), with the texgen computed in a shader; the wither skull uses the native turn, matrix and texture offset (0, 35); the stem quads are exact (all executed against the unchanged classes with stub GL).
- **World generation guards.** A survey of 201 streamed cells (Default, Large Biomes, Amplified, six Superflat presets, generations 13 to 20) reached none of the `unported` guards in gen-world.js and mineshaft-world.js and never used the neighbour retry; the jungle temple's tripwire diff between the old quiet callbacks and generation 20 is pinned. No generated output changed.
- **Docs.** Dated corrections in `parity.md` for hunger, mining, crafting, tools, item drops, boats, buckets and pigs; the Nether generator's `canNeighborBurn` and solid-top test are ported (7 ids had a wrong solid top).

Still open from batch 80: carried into the batch 81 list above, except the items batch 81 closed or found wrong.

## Done in batch 79

Batch 79 covered these areas:
- **Horse and rider view.** The local player's own body now turns with the pig or horse it rides, clamped to ±85° like a remote rider (boats and carts excluded, as native `boh` tests for a living mount); the inventory paperdoll is drawn seated. The horse window preview reads the live mob every frame (saddle, armour, chest, age), and a foal no longer draws as an adult in single player.
- **Explosions.** The S27 packet carries the affected block offsets (signed bytes from the truncated centre, bytecode-read `gu`), and the client's per-block explode and smoke particles come from that list; single player loops its blast through the same encoding. A dedicated-server creeper blast now sends S27, particles and sound (it used to send only the knockback record).
- **Corpse clicks.** Every dying mob except the ender dragon is aimed at, in single player and on the multiplayer client. A lead, name tag, saddle, shears, dye, wheat, spawn egg, bucket or flint and steel works on a corpse as in 1.7.10 (bytecode-read: only the villager's `interact` tests `isEntityAlive`); trading a dying villager is still refused. The server knot box is the client copy's (floored tile + 0.5).
- **Server lanes.** A mob picking up an item sends the collect animation (S0D with the mob as collector), in the Overworld, the Nether and the End. The server keeps command block data (`server-command-blocks.js`), so a falling command block lands with its command; command blocks still do not run from it. The eye of ender's sound and aux use the thrower's dimension (the lead confirmed that the Nether and End providers return no stronghold, so a throw there does nothing). A click on a piston-moving block with no tile removes it on the server too.
- **Right-click swing.** Single player swings after a block click only when the item's client-side `onItemUse` returns true (bytecode-read for hoes, bone meal, cocoa, flint and steel, fire charges, spawn eggs, beds, the reed family, redstone, skulls, leads, fireworks, paintings and item frames). The piston-moving swing uses the held block's dry-run placement. "Diamonds to you!" is awarded when a mob picks up a diamond thrown by a player, in single player and on the server.
- **Effects checked against the real game.** Executed probe (92 records) for a calf mooshroom with a bowl, pearls landing in water and lava, and a dispenser fire charge on a client world. One fix: fireball smoke spawns after the move (and in water with four bubbles), bytecode-read `ze.h`. The item spill, dispenser smoke and enderman gaussians now use `java-random.js`. Batch 78's pearl and milk records replay through the server paths unchanged.
- **Falling blocks.** Executed probe (401 rows) lands every tile kind with unknown, missing and wrong-typed keys; three fixes (sign text, spawner entity and its gate keys, command block command with a wrong tag type). Flowing water and lava items (8 and 10) round-trip through import, drops and export. An imported item that never ticks exports its saved Fire.
- **Flower pots and packs.** Pot `Data` the item catalogue cannot hold is kept and drawn with the native icon rule (red flower 9 to 15 as poppy, sapling `Data & 7` clamped). Pack descriptions given as a styled chat component are read like `IChatComponent.Serializer` (executed, 24 rows). The `block-textures.js` canvas fallbacks only serve a corrupt texture and stay.
- **Server speed.** Three exact speed-ups behind `MC_MPPERF79` (air cells skipped in collision boxes, a cached nearest player, a fireball sweep box); the profile is flat and gains are small (Nether block scan about 30 ms less per 200 ticks).
- **Docs and catalogues.** 19 item rows that said "no item form natively" now say the native ItemBlock exists but is not in the Creative lists (executed `Item.getItemFromBlock` over blocks 1 to 175); stale anaglyph and difficulty settings rows and 15 `parity.md` rows got dated corrections.

Still open from batch 79: carried into the batch 80 list above, except the items batch 80 closed or found wrong.

## Done in batch 78

Batch 78 covered these areas:
- **Server horses.** Temper is not a watched value (bytecode-read `wi.c()` registers ids 16 and 19 to 22), so the client no longer guesses temper: a wild-horse feed that only temper would accept is left to the server. Arrows from the rider no longer hurt their own horse (`wi.a(ro,F)`, single player too). A rider who logs out in the Nether or End is remounted on rejoin. A shutdown with riders keeps the horse in the saved world and in `Riding`, as native `stopServer` does.
- **Horse client view.** A remote rider's body turns by its mount's body yaw, clamped to ±85° (bytecode-read `boh`); the multiplayer horse window preview draws the horse's own variant, armour, saddle and age. The server's rider position rows were found redundant, not wrong: the native tracker sends a riding entity only look packets, and the client already ignores those positions.
- **Adventure mode and knots.** 1.7.10 never refuses an item use in Adventure when a stack is held (`canPlayerEdit` passes the stack and `Item.v()` is true; the lead confirmed no item overrides it). Wrong refusals were removed for fireworks, fire charges, bone meal, cake and hoes on the server, and for eggs on water and fire charges in single player. A leashed mob in its death animation can be freed and re-tied. A non-lead item on a knot's fence clicks the knot when the ray meets the knot first.
- **Explosions.** Knockback now reaches the player in the native S27 explosion packet (unreduced push, players within 64 blocks); a creative player is pushed but not hurt, and Blast Protection reduces the server's own motion. Server relighting after a blast is about 15 times cheaper (one flood per merged box) with identical light arrays (`MC_RELIGHT=verify`).
- **Server speed.** The mob push looks only at entities in nearby 2-block cells; a 400-animal pen tick drops from about 19 ms to 5 ms with identical seeded state (`MC_MPPERF78=verify`). First real-socket bench on localhost: 8 to 16 clients, 19.6 to 19.8 ticks per second, 92 to 292 KB/s per player.
- **Block right clicks.** A declined block click with an item that cannot be placed no longer swings (bytecode-read `bao.am`, `bje.a`). Multiplayer prediction uses the batch 77 activation table. Clicking a piston-moving block that has lost its tile removes it in single player.
- **Mob loot.** Every mob with `canPickUpLoot` picks up floor items, and server mobs share the code, so server dispensers now dress mobs. Armour is drawn on zombie villagers; drawing it only on zombies, skeletons, pigmen and zombie villagers is native (only `RenderBiped` subclasses draw armour).
- **Effects checked against the real game.** Executed probes (208 records) for jukebox aux 1005, snowball, egg and pearl impacts, ghast and blaze fireballs, milking and mooshroom shearing. Three fixes: the pearl particle gaussian uses `StrictMath.log`; a jukebox record shows no "Now playing" line (1.7.10 looks up `records.<name>` in a map keyed by the bare name, lead-checked); fire resistance refuses every fireball damage.
- **Falling blocks.** `TileEntityData` is applied for spawners, skulls, pots, command blocks, note blocks, jukeboxes, beacons and comparators, and on the server. Water, lava, fire and portal falling blocks drop their native ItemBlock (executed); landing uses the native replaceable set; item Fire exports as native. With fire an item, chainmail crafts from fire blocks as in 1.7.10 (all 312 mapped recipes now replay). The eye of ender's aux 1002 reaches players on a server.
- **Resource packs.** Pack row descriptions end in `§r` and wrap with the native formatted line split; pack animation frames, clock frames and spawn egg tints no longer pass through a canvas (straight alpha kept).

Still open from batch 78: carried into the batch 79 list above, except the items batch 79 closed or found wrong.

## Done in batch 77

Batch 77 covered these areas:
- **Horses on a server.** The client sends horse jumps (single-player jump counter, power × 100) and the horse window key, and draws the jump bar and horse hearts for its own ride; the server's jump-key fallback stops at the first wire jump. Horse and lead clicks are predicted on the client, checked against the real server. On the server, horse and rider take `ceil(d × 0.5 − 3)` fall damage with the land sound (single player too: the rider took none before); the horse copies the rider's pitch × 0.5; a player who logs out riding comes back on a new horse made from the saved `Riding` data (bytecode-read `oi`); horse armour counts 5/7/11; foals age; taming draws follow the horse's own random in native order.
- **Owner velocity.** A landed hit (mob, player, arrow, explosion, fall, fire; not drowning) and the death throw send the victim's own velocity (clamped ±3.9, 1/8000 steps, bytecode-read `my.b`). Remote riders sit on their mount's copy on the client; a cape change forces the early send.
- **Leash knots and cauldrons on a server.** The knot sweep found one gap (a sneaking player with another item tied mobs to fences; single player had the reverse); a cauldron click starts no eating, drinking, blocking or drawing; the server's Adventure bucket refusal was wrong and is removed.
- **Block clicks in single player.** A bytecode table of every block's `onBlockActivated` answer decides when the held item's right click is skipped: cauldrons, fences, wooden buttons and comparators were missing; a jukebox swallows only when loaded. Clicking an entity never swings the arm in 1.7.10 (only the creeper ignite and the rod do).
- **Dispensers.** Armour goes to the first qualifying entity in list order, and any mob that can pick up loot qualifies; the fire charge spawn height used the wrong axis (native uses the X offset for Y, 0.3F); 94 executed registry, fire charge, boat and firework rows. Away-run sounds are silent by design.
- **Sounds.** Executed sweep part 3 (244 records: doors, trapdoors, gates, levers, buttons, plates, repeaters, comparators, chests, note blocks, bow, lily pad, eye of ender, eating, drinking, flint and steel, impacts, shears, arrows): only the eye of ender's second launch sound (aux 1002) was missing.
- **Falling blocks.** Drops use each block's native damage value (executed for blocks 1 to 175 at every Data value); `TileEntityData` is read, saved, exported and applied on landing for chests, furnaces, dispensers, droppers, hoppers, brewing stands and signs; the anvil damage roll needs HurtEntities and a fall over one block, and keeps the full Data int. Item entities keep Owner, Thrower and PortalCooldown on import.
- **World flags.** A world with Generate Structures off matches the native generator (executed, 26 records); region export writes `MapFeatures:0`. The client learns the server's hardcore flag (death screen, hearts). Resource Packs rows and the LAN scan line are recorded and replayed.
- **Server speed.** Measured 8 to 32 players and the Nether and End (mobs are 70 to 85% of a tick); the villager zombie check tests the box before casting a ray (about 7% to under 2% of a tick), with identical state hashes (`MC_MPPERF77=verify`).

Still open from batch 77: carried into the batch 78 list above, except the items batch 78 closed or found wrong.

## Done in batch 76

Batch 76 covered these areas:
- **Server horses.** Riding a horse on the server steers with the single-player rules; taming by riding raises temper by 5 and throws the rider; saddle, armour or sneaking on a tame horse opens the horse window (saddle, armour and chest slots); a horse tamed by riding records its owner; horse distance counts as `stat.horseOneCm`.
- **Server cauldron.** Water buckets, glass bottles and leather washing work on the server (136 recorded wash rows replayed); a cauldron click consumes the use, so held items no longer act through it. Rain filling already ran on the server.
- **Server hanging entities.** Frames and paintings replayed against the executed hanging records: entity reach now uses the native rule (it accepted clicks about 2 blocks too far), and hitting a frame, painting or knot no longer costs exhaustion.
- **Server tracker.** A score change forces the early position send (watched value 18); a riding player runs the native riding branch (S1B attach, look-only sends, a teleport after dismount). Sleeping and riding were found not to be watched values, and a remote player copy never moves by its own velocity (bytecode-read), so those gap lines were wrong.
- **Client clicks.** The multiplayer client predicts name tags, spawn eggs, flint and steel on creepers and Creative stacks for entity clicks, checked against the real server simulation. The owner already sees the death throw, and server `/setblock` already keeps table names (tests added).
- **Server speed.** The line-of-sight block walk is about 40% cheaper (3.6 to 2.2 ms per 600-mob tick) with bit-identical results (`MC_RAYTRACE=verify`).
- **Single-player right click.** The clicked entity is tried first (bytecode-read `rightClickMouse`); bows, buckets, potions, rods and books act only after the entity declines or on a miss. Paintings decline right clicks.
- **Single-player dispensers.** Executed probe of the filled-bucket dispense (240 records): buckets replace non-solid blocks, Nether water only fizzes; spawn eggs, boats and armour now dispense in single player; smoke and bone-meal particles are drawn; click sounds play at the block corner; the fire-charge sound is added.
- **Sounds.** Executed sweep of right-click items (62 records): the plant a bucket replaces sounds from its own cell, throw pitches use the native float chain. Hoe, bone meal, lily pad, shears, flint and steel and the dig hit already matched.
- **Region import.** Orbs with Value 0 or above 2477, falling stone and other non-falling blocks, the full falling-block Data byte and DropItem now import, save and export; crystals read only Entity fields.
- **Menus.** Generate Structures is a working toggle (bytecode-read GuiCreateWorld); a remote hardcore death shows "Leave server" and deletes no local world; Multiplayer, Add Server, Direct Connect, Disconnected, Rename World and the confirm screens replay the recorded menus; the Add Server pack label gained its trailing `§r`.

Still open from batch 76: carried into the batch 77 list above, except the items batch 77 closed or found wrong.

## Done in batch 75

Batch 75 covered these areas:
- **Server buckets.** Empty and full buckets work on the server in all three dimensions (41 executed client-predict records replayed); Nether water fizzes; server fluids fizz and wash plants and torches into items; server dispensers place liquids into plants and fizz in the Nether.
- **Server clicks.** A sweep of every item on every entity kind and in the air found ten server gaps, now closed: name tags, spawn-egg babies, flint and steel on creepers, horse feeding/chests/saddles/armour, armour equip, glass bottles on water, eggs on water, rockets on blocks, pig saddle hits, cart and boat sprint knockback.
- **Server player state.** The death throw reaches every client; a jump or a watched-value change forces an early position send; the head angle has its own baseline; the idle timer counts wall-clock milliseconds. A PvP attacker is slowed (EntityOtherPlayerMP takes every client hit, bytecode-read); a mob hit only stops the sprint.
- **Server speed.** A cell grid for the mob push scan cuts a 600-mob tick by about 25% with identical seeded state.
- **Sounds.** An executed sweep of place, break and step sounds for every block (1902 records): seeds and nether wart are silent, the double plant sounds, place sounds come from the placed cell.
- **Textures.** Skins, remote skins, skulls, capes and the item sprite sheets upload straight-alpha pixels.
- **Single player.** Bonus torches that cannot stay drop as items; the death throw angle comes from the last hit; table names are removed with the table and saved per column. Exploded tables were found effectively wrong (no blast breaks a table).
- **Entities.** Orb, falling block, TNT and crystal NBT match native field by field (executed); orbs, TNT and falling blocks import from Java regions; thrown balls entering water no longer throw an error; the wither skull uses the fireball water test.
- **Menus.** About 40 screens recorded from the real classes; the Difficulty button, the Controls list width and Open to LAN on a server were fixed; 13 catalogue rows settled.
- **Research docs.** `parity.md` and 11 docs corrected; skeleton-horse traps were checked and are not in 1.7.10 (WorldServer creates no horse).

Still open from batch 75: carried into the batch 76 list above, except the items batch 76 closed or found wrong.

## Done in batch 74

Batch 74 covered these areas:
- **Server player positions.** Remote players move on the native 2-tick tracker cadence and the client smooths them over 3 steps; a player arriving from another dimension only receives the players they track.
- **Server place sounds.** Every block placement sends the native place sound to players within 16 blocks, the placer included; the client now plays server block sounds; seeds and nether wart place silently.
- **Server pickup order.** Items and stuck arrows are taken in one pass in list order on the server (700 executed scenes replayed); a partial item take sends no collect packet (found wrong before).
- **Server combat.** Sprinting player hits knock mobs back further and slow the attacker; crit particles follow the live entity.
- **Server performance.** Tick time measured with up to 600 mobs (about 20 ms per tick); see `server-performance.md`.
- **Server leftovers.** `/debug stop` writes the native profile file; only the native packet set resets the idle timer (movement does not, bytecode-read). The separate brewing flag was found native for a dedicated server.
- **Single player.** The death throw; falling anvils hit items, orbs, boats, carts, frames and paintings; bonus torches use the normal-cube rule. Item farmland trampling was found wrong (only living entities trample).
- **Custom names.** Chests, furnaces, dispensers, droppers, hoppers, brewing stands and enchanting tables keep `CustomName` (placement, saves, NBT, window titles, server), checked by an executed probe.
- **Order and skins.** Orb sounds and xp follow the pickup list order; a mob rider takes the vehicle's fall at once; skin PNGs decode without premultiplication (13 executed images).
- **Lighting.** The client recheckGaps gap was wrong: the client runs the pass (one column per tick) and it changes no light (executed, 8 scripts).

Still open from batch 74: carried into the batch 75 list above, except the items batch 75 closed or found wrong.

## Done in batch 73

Batch 73 covered these areas:
- **Server player tracking.** Remote players are only sent within the native tracking range; remote players and client tile entities go away with their chunk and come back with it.
- **Server placement.** Cake, beds and hoe tilling work on the server (found by an executed sweep of every item); player heads keep their owner.
- **Server riders.** Boat and cart landings hurt and sound for the riding player; arrow pickup uses the ridden box. A rider mounted mid-fall was found right already (executed).
- **Tile entity NBT.** Flower pots and three more tile kinds import and export. Two listed gaps were wrong.
- **Entity order.** The native entity list order is kept every tick; items and arrows are picked up in one pass in native order (executed); entity boxes use float sizes.
- **Server mob cap.** The flat 80-mob cap is gone; the native per-type caps decide.
- **Particles.** Fishing wake, mycelium aura and brewing stand / end portal particles; crit particles from the server.
- **Offline skin.** Single player can load a skin file; the skin cleanup matches native pixel for pixel (executed).
- **Sounds.** Every 1.7.10 sound event is listed; cake and cauldron are silent as natively; the arrow hit ding plays.
- **Research docs.** 30 more docs swept.

Still open from batch 73: carried into the batch 74 list above, except the items batch 74 closed or found wrong.

## Done in batch 72

Batch 72 covered these areas:
- **Cake and fog.** Left click on a cake eats a slice, in single player and on the server; the Nether and End use the short fog distances.
- **Offline cape.** Single player can load a cape file from Chat Settings.
- **Client settings on the server.** The server receives all client settings and hides chat from players who turned it off. Four planned items were found wrong (native has no such server behaviour).
- **Spawn caps.** Spawn eggs, `/summon` and natural spawning have no entity cap; the dragon and crystals block spawns; stems use the shared random; spawner counts include subclasses.
- **Small fixes.** The step `ySize` item was wrong (executed); vines count for the climb stat; away-run droppers transfer.
- **Flower pots and seeds.** All 113 pot stacks compared with native; big oaks grow in legacy worlds; the structure seed atlas uses the native spawn.
- **Server item cadence.** Items and orbs go out on the native 20-tick tracker cadence and the client moves them in between.
- **Riders.** Rider fall order fixed; boat and cart landings hurt and sound for the rider; chicken jockeys search in native order; no step sounds while riding.
- **Projectile order.** Ties between entities at equal distance follow the native chunk order (executed); the arrow pickup box is native (executed).
- **Chunk streaming.** The join streams its columns; block changes and entities only go to players that have the column; the legacy End window is limited.

Still open from batch 72: carried into the batch 73 list above, except the items batch 73 closed or found wrong.

## Done in batch 71

Batch 71 covered these areas:
- **Step sounds.** The player and mobs take the step block from the native cell, with the fence, wall and gate rule (7776 executed cases); mobs on fences are no longer silent.
- **Mob rules.** Weakness lowers mob damage (executed); slimes split without a cap; spawners take squid, bats, magma cubes and villagers; server XP orbs keep their target.
- **Mob rendering.** Slimes, magma cubes and falling blocks cast shadows; mobs wear skulls; owned heads show loaded player skins; `jeb_` sheep cycle colours.
- **HUD and effects.** The vignette is drawn with fancy graphics; witches show their magic particles; the brewing stand selection box follows the native shared bounds (executed); glowstone takes Fortune (executed). The stem darkness pop was found wrong.
- **Server reach and carts.** PvP reach measures from posY; away-run hoppers find carts; cart positions go out on the native tracker cadence.
- **Server item and orb ranges.** Players only receive items within 64 blocks and orbs within 160 (clamped by the view distance).
- **Server chunk loading.** Columns load and unload around each player by the view distance in the native order (executed).
- **Capes.** Accounts can upload a cape; capes and the Show Cape choice travel over the connection; the Show Cape button works.
- **Server admin lists.** List commands print in native order; the four JSON list files are read at start-up and written atomically; `generate-structures=false` works on generation 10+ worlds.
- **Research docs.** 32 more docs swept; four claims were wrong.

Still open from batch 71: carried into the batch 72 list above, except the items batch 72 closed or found wrong.

## Done in batch 70

Batch 70 covered these areas:
- **Single-player fixes.** Chickens breed on any seeds (bytecode); ender chests draw portal particles; Smite and Bane apply to mob-versus-mob hits and Bane's slowness is applied. Resistance was already ported.
- **Entity clicks on a server.** Clicks on vehicles and mobs measure from posY, so a sleeper clicks from the bed; piston-pushed boats stop at hanging entities; arrows stuck in the End and `mapData` over a real socket are tested. Frame ids on the map wire were found wrong (native sends none).
- **Single-player Tab and user lists.** Tab in single player follows the native remote flow with the integrated command set (60 executed records); UserList names come out in HashMap order; `/whitelist add/remove/reload` use `whitelist.json`.
- **Cart inventories.** Block hoppers and droppers push into and pull from chest and hopper carts; the client interpolates carts over 5 ticks.
- **server.properties, second pass.** Vehicle range and spawner puffs follow the view distance; allow-nether=false stops Nether and End ticking; game mode is saved per player; spawn protection uses the native spawn; `/setidletimeout` is written back.
- **Projectile replays.** Arrow pickup (300 executed records, one Creative fix) and the fireball punch pick (2400 scenes) are executed.
- **Particles.** The snow golem build burst is drawn; cloud and footstep particles are ported but unused in 1.7.10. Witch sounds were found wrong (no assets in 1.7.10).
- **Player rendering.** Cape chase and deadmau5 ears are drawn; no cape texture source yet.
- **Research docs.** About 40 more docs swept; the dragon egg claim was wrong.

Still open from batch 70: carried into the batch 71 list above, except the items batch 71 closed or found wrong.

## Done in batch 69

Batch 69 covered these areas:
- **server.properties.** The dedicated server creates and reads `server.properties` with the native defaults: view distance (and the tracker limit), max players, spawn protection, allow-nether, allow-flight, the spawn switches, difficulty, game mode and force-gamemode, hardcore, PvP, command blocks, the op permission level, the whitelist, the MOTD, the build height and the idle timeout; `server-icon.png` is the status favicon.
- **Maps on a server.** Empty maps take ids, held and framed maps update in every dimension and reach the right players at the native cadence, and map data is saved with the world (executed packet record). Found wrong: framed-map updates go to every player of the world.
- **Tab completion on a server.** Commands, arguments and player names complete over the connection in the native chat flow; the command order matches the real CommandHandler at every op level (90 executed records). The "Pinging..." sprite animates.
- **Multiplayer fixes.** Pistons break hanging entities off; `/summon` tag coordinates map into the End window; spawn eggs and dispenser eggs ignore the mob cap; a sleeper reaches and aims from posY (minY + 0.2), which corrects batch 68's eye note.
- **Single-player farming.** Farmland, crops, stems and cocoa tick only in the render-distance active chunks in the native draw order (executed orders); cocoa grows at all now, in single player and on the server.
- **Fireworks in fluids.** Rockets in water and lava and against boats and carts match 34 executed records (flow push, splash draws, entity boxes added).
- **Spawn replays.** 15 more executed natural-spawn replays; the Slime and Bat catalogue rows were stale.
- **Catalogues.** Server list and admin command rows; /netstat is the only dedicated command left Out of scope.
- **Research docs.** About 85 more docs swept; no closed gap found wrong on a live path.

Still open from batch 69: carried into the batch 70 list above, except the items batch 70 closed or found wrong.

## Done in batch 68

Batch 68 covered these areas:
- **World commands on a server.** /setblock, /testforblock, /testfor, /setworldspawn, /playsound, /spreadplayers and /debug run in the sender's dimension; the world spawn is saved and used for new players and the compass. Found wrong: single player's /testfor printed on success and ran from chat (natively command blocks only, silent); single player's /setworldspawn, /playsound and /spreadplayers corrected.
- **Server administration.** /op, /deop, /kick, /ban, /ban-ip, /pardon, /pardon-ip, /banlist, /whitelist, /stop, /save-all, /save-on, /save-off and /setidletimeout, op levels, and join refusals with the native texts; lists saved by UUID.
- **Hanging entities on a server.** Paintings, item frames and leash knots: placing, random art, hits and drops, frame items and rotation, surface checks, blasts, thrown and shot hits, saved per dimension, and `/summon` of all three.
- **`/summon` finished.** Native coordinates (the End window's origin), no natural mob cap, the tracker clamp of view distance x 16 - 16, revenge liveness checked in the victim's tick.
- **Ping, server list and Disconnected screen.** Keep-alive ping and the Tab list bars, the Multiplayer server list with Add, Edit, Delete, Direct Connect and a status ping, and the 1.7.10 Disconnected screen.
- **Server chunk activity, finished.** Farming rides the random ticks over active chunks; Java 8 tree bins and the End origins are exact (11 executed cases).
- **Small fixes.** A sleeper's blast box and eye; a never-ticked TNT cart explodes when struck; bone meal clicks use the world Random. Found wrong: the bed blast already matched.
- **Projectile evidence.** Fireworks collide like any moving entity (31 executed records; the port matched, the y < -64 kill added); mob potions pass frames, mob balls and a server player's pearl at frames match (12 records).
- **Pistons and carts.** Carts on rails already matched (9 executed scenarios); riding players are pushed and snap back; push landings wait a tick as natively.
- **Research docs.** About 30 linked docs corrected.

Still open from batch 68: carried into the batch 69 list above, except the items batch 69 closed or found wrong.

## Done in batch 67

Batch 67 covered these areas:
- **Boats and moving blocks on a server.** Server players and mobs stand on boats; players collide with a moving piston block, a push that lands a player gives fall damage, carts and boats are pushed, and a client joining mid-move gets the moving tile.
- **Bone meal from dispensers.** Dispensers fertilise every IGrowable through the shared module; sapling and grass gates draw from the world Random (308 executed records).
- **Item frames and the bobber line.** Thrown snowballs, eggs, pearls, potions and XP bottles at frames match 22 executed records with no port change; a connected client's own bobber line starts at its body.
- **Village sieges.** The VillageSiege state machine and its draws are ported. Executed: 1.7.10 never spawns siege zombies (the spawn spot search always fails). A single-player village's legacy "Player" reputation maps to a named owner on a server. Found wrong: 1.7.10 has no per-dimension village file, so Nether and End collections are not saved natively either.
- **Beds.** The sleeper's body box sits at bed y + 0.7375 and is 0.2 x 0.2. Found wrong: native does not refuse a sleeper's clicks on the server; the weather re-roll already waits a tick.
- **Lightning and blasts.** Bolts break boats and carts, a TNT cart explodes; blasts release silverfish from monster eggs in single player and on the server; golem snowballs are used up at players; golem dust shows on copies. Found wrong: a snowball gives a player no knockback (zero damage returns early); thrown projectiles take nothing from a bolt.
- **Server chunk activity.** Weather, random ticks and bolts run over per-dimension active chunk sets of radius 10 in HashSet order (executed).
- **`/summon` on the server**, square tracker ranges, and a revenge fallback that needs a live attacker.
- **Catalogues.** Generator rows brought up to date.

Still open from batch 67: carried into the batch 68 list above, except the items batch 68 closed or found wrong.

## Done in batch 66

Batch 66 covered these areas:
- **Villages on a server.** Villagers and the village's iron golems are server mobs; the profession and age ride in the mob state and the spawn packet; the village collection and its reputation are saved, by player name; a hit on a village villager costs that player's reputation and the golem's target lookup finds a connected player by name; zombie kills convert villagers on Hard and a golden apple starts a cure; villagers of generated village structures join a fresh world once.
- **Trading on a server.** A villager click opens the merchant window (`openWindow` kind `merchant`), the offers go as `tradeList` (MC|TrList) and `tradeSelect` is MC|TrSel; the customer is released on close or disconnect. Bytecode-read `EntityVillager.interact`: no sneak or name-tag test; `useRecipe` gives no XP orb in 1.7.10.
- **Pistons on a server.** Extending and retracting pistons push players, mobs and items, S24 block events and the moving tile entity reach clients within 64 blocks (`pistonTiles`), piston sounds within 16, in the Overworld and the Nether.
- **Lightning on a server.** Thunderstorm bolts roll per chunk as WorldServer does, hurt and set fire to players and mobs (pig to pigman, charged creeper), burn items and orbs, and go to clients within 512 blocks (`boltSpawn`), with the sky flash and thunder. Found wrong: a villager does not become a witch in 1.7.10 (only Entity, EntityPig and EntityCreeper override onStruckByLightning).
- **Golems and silverfish on a server.** Pumpkins build snow golems and player-made iron golems; the golem's strike and poppy (S19 status 4 and 11) are drawn; golem snowballs are on the wire; monster eggs release silverfish (one in Creative, two in Survival), and their hide and call puffs reach clients. Found wrong: building a golem sends no break particles natively (flag 2 and the server's empty spawnParticle).
- **Books, jukeboxes and note blocks on a server.** MC|BEdit and MC|BSign with the server's author name and the native "Invalid book tag!" kick; book tags survive window clicks; records play and eject with level event 1005; note blocks run in all three dimensions and send their sound and S24.
- **Beds on a server.** The native refusals, the Nether and End bed blast with fire, the all-asleep night skip (clock to the next morning, rain and thunder cleared), Leave Bed, bed respawn at y + 0.1 with `tile.bed.notValid` on a missing bed. Found wrong: a fishing bobber wakes a sleeper (the wake comes before the zero-damage refusal); single player's bed mob check let blazes and withers through and wrongly counted slimes and magma cubes; `/spawnpoint` respawned at y exactly.
- **Bone meal.** One IGrowable module for single player and the server: mushrooms (40% into a huge mushroom), tall grass and ferns, double plants, cocoa, with saplings, grass, crops and stems; checked against 223 executed `BoneMealProbe` records; the server sends the 2005 sparkles. Found wrong: 1.7.10 has no per-block sparkle count (data 0, 15 particles).
- **The End, finished.** Ends saved by 0.93.0 now upgrade into the 256 window on load (stored coordinates move by +103, +32, the new area is generated from the seed, crystals added only while the dragon lives). Found wrong: the eye of ender does nothing in the Nether and End natively, which the server already did.
- **Item atlas.** Block sprites share the terrain atlas texture; held, dropped, worn, carried and framed block meshes rebake their uv after a pack switch, and a chunk meshed under an older layout is dropped; `flatBlockTileUrl` and `flatTileImpl` are gone. Found wrong: tinted item sprites keep their raw tint under Anaglyph natively (RenderItem and ItemRenderer never read the flag), as the port does.

Still open from batch 66: carried into the batch 67 list above, except the items batch 67 closed or found wrong.

## Done in batch 65

Batch 65 covered these areas:
- **The End on a server, finished.** A new server End is a 256x256 window (native = local - 128), so the whole main island and every spike in it has its crystal; Ends saved by 0.93.0 load as their old 128 window. Crystal blasts set no fire (found wrong in single player, which had set it); the dragon egg teleports on a click (`server-egg.js`, no server particles: akp.m draws them only on the client); a player waiting for the credits leaves the End mob view; clients draw the flying eye's portal trail. Found wrong: the dragon's block eating sends no break particles (bytecode-read: setBlockToAir only); the spikes are a seeded roll per chunk, not a fixed ring of ten.
- **Remote players.** Invisible players are hidden, or drawn at alpha 0.15 for a teammate with `seeFriendlyInvisibles`; name tags follow the native ranges (64, 32 sneaking), the below-name score within 10 blocks, unshadowed text on a 0.25 background (bytecode-read).
- **Item use over a connection.** A predicted eat or drink runs on past 32 ticks until the server's S19 status 9 (lead fix, bytecode-read `EntityPlayerMP.onItemUseFinish`), a held-slot S2F, a held-item change or release; status 9 plays the 16-crumb burst and ends it. The server's item drop matches the executed flight record; the 1012/1014 cell truncates.
- **Statistics, continued.** Fire charges and bone meal now work on the server and count `use`; setting an eye in a frame counts, a thrown eye does not (bytecode-read). Kill credit is a port of CombatTracker checked against 24 executed scenarios (`CombatBestProbe`); the kill-by-type stat goes only to the killing source's player. Found wrong: a hook never hooks a player (attackEntityFrom refuses 0 damage, executed); hooks are not saved natively (no EntityList entry).
- **Spawners on a server.** The client's smoke, flame, spin and the 2004 burst now run over a connection (`dispFx` kinds `spawnerBurst`, `spawnerDelay`, `spawnerPuff`); Riding chains are checked and their carts and boats made; spawner minecarts tick and spawn. Found wrong: block event 1 carries no delay value.
- **Tracker.** Transient mobs and an away run's transient orbs and items take their HashSet entries; a falling enderman copy screams. Found wrong: a burning copy in rain never fizzes (executed: the client zeroes `fire` every tick).
- **Rendering.** The terrain atlas re-stitches at an HD pack's sprite sizes (`terrain-layout.js`, executed Stitcher cases; the vanilla layout is pinned); tinted flat block items draw from the blocks sheet times their colour; item sprites play `.mcmeta` animation in the atlas; first-person map mode matches 67 executed cases.
- **Client replays.** The fishing line matches 96 executed `RenderFish` cases (`fishing-line.js`: swing offsets, eye height 0.12 for others, no sneak term, the curve's end); the Java 7 effect order has a port checked against 52 sequences but the game stays on the Java 8 order. Found wrong: no client copy pushes (`EntityLivingBase.onLivingUpdate` pushes only when `!isRemote`, bytecode-read, lead-checked), so the controlled player is no longer pushed by mobs (`CLIENT_PUSHES_PLAYER = false`); the dragon's crystal search and silent growl were already closed.

Still open from batch 65: carried into the batch 66 list above, except the items batch 66 closed or found wrong.

## Done in batch 64

Batch 64 covered these areas:
- **The Ender Dragon on a server.** A new End gets the dragon and the crystals of the spikes inside the window; every End player is a target and in the wing sweep; C02 hits the dragon's parts; crystals explode; the 200-tick death leaves orbs, the exit portal and the egg; the fight is saved as `dragon: alive|dead`; the exit portal plays the credits (S2B state 4) and respawns the player. The stand-in exit portal is gone. The killing blow credits mobKills, killEnemy and totalKillCount (lead join).
- **The End, continued.** F3 and native lookups read End coordinates (the platform is x 100, z 0); End arrows, balls, potions, skulls and fireballs are saved in the End's own lane; the flying eye of ender runs on the server (nearest stronghold, drop or shatter 1 in 5, saved in flight); the enderman spawn test now runs with mobs on.
- **The wither, continued.** Built in any dimension, the Nether too; the side heads and flying skulls see every player of the dimension; skulls are saved with the fireball fields (bytecode-read: no shooter or blue flag natively); level events 1012 and 1014 go out as S28 within 64 blocks (bytecode-read). Found already native: the wither effect icon (S1D/S1E).
- **Scoreboards and teams on a server.** `/scoreboard` objectives, players and teams, the sidebar, Tab list and below-name slots (S3B-S3E, bytecode-read), criteria from the server's stats, deaths, kills, health and achievements; team friendly fire blocks PvP between teammates.
- **Statistics, continued.** Fishing on the server (1.7.10 loot with Luck of the Sea and Lure, wear, XP, hooked mobs, fishCaught, junkFished, treasureFished; clients draw other players' bobbers); seeds and spawn eggs on the server with the `use` stat, nether wart and flint and steel too; a later death credits the player who hurt the mob within 100 ticks; `--command-blocks` and `--legacy-owner` flags. Found wrong: mob damageDealt is `round(damage * 10)` like PvP (bytecode-read), not the health lost; single player's fishing drops used native ids.
- **Connected client.** The client predicts its own eating, drinking and sword block; overkill at 18 damage over a connection.
- **Item atlas.** A port of the 1.7.10 Stitcher; HD item and block sheets re-stitch at the pack's size.
- **Entity flight records.** Executed `EntityFlightProbe`: thrown eggs, bottles and pearls, piston-pushed mobs, a cart picking up a cow and in-flight positions match; the player's item drop (`dropPlayer`) now uses the sine table, float scatter and posY - 0.3 + 1.62.
- **Tracker.** An entity born and gone within one tick is a transient HashSet entry, so the table doubles at the native count; rain counts as wet for client copies.
- **Mob models and first person.** Executed `BabyModelProbe`: a baby pigman's head is 1.5 like a baby zombie's, the kitten head sits at its native offset, and mobs hold blocks (adult and baby). Executed `FirstPersonProbe` (42 cases): no swing translate while an item is in use, and the fishing rod turns 180 degrees.

Still open from batch 64: carried into the batch 65 list above, except the items batch 65 closed or found wrong.

Still open from batch 63: carried into the batch 64 list above, except the items batch 64 closed or found wrong.

Still open from batch 62: carried into the batch 63 list above, except the items batch 63 closed or found wrong.

## Done in batch 61

Batch 61 covered these areas:
- **Dispensers on a server.** Server dispensers fire arrows, eggs, snowballs, splash potions, XP bottles, fire charges and fireworks, prime TNT, hatch spawn eggs, and use buckets, flint and steel, bone meal and armour, with the single-player behaviours; boats and plain, furnace and TNT carts go to the server's vehicles. Clients draw them from `dispEnts` / `dispFx`.
- **Animals over a connection.** C02 interact feeds, breeds, shears, milks, saddles and dyes animals with the single-player rules; breedCow goes to the feeder; sheep grazing reaches clients (status 10). The client predicts the click and the server settles it.
- **Vehicles and riding.** Plain, furnace and TNT minecarts and boats are server entities: placed, ridden (use mounts, sneak dismounts, boats steer), seen seated by others, broken into items and saved; onARail is awarded (bytecode-read `yz.k`). A creative hit drops nothing natively.
- **The Nether on a server.** A server Nether is built on first use; the portal timer (80 / 1) and the `Teleporter` move players, `dimRespawn` swaps the client's world, each player sees only their own dimension, flint and steel lights portals on the server, and the portal achievement, the player's dimension and the Nether's edits are saved.
- **Multiplayer health.** Other players' hurt tint, limb swing and S29 hurt/die sounds; a mob kill's death goes out in the tick of the hit; effects are saved; the S1D burst walks `effects.ordered()` at login and after a trip. Found wrong: the client's `performEffect` changes nothing visible (`EntityPlayerSP.heal` is empty), and the cursor and 2x2 grid are lost at death, not dropped.
- **Multiplayer inventory.** Accepted window 0 clicks get diffed slot corrections; Survival no longer mirrors the hotbar; Creative slots are C10 (`invCreative`) with the native drop limit; a partly taken stack is hidden on every client as natively (the tracker does not re-add it). Found wrong: no level-up sound on enchanting or the anvil, and the native anvil field is 40 characters.
- **Mob types and tracker on a server.** Enderman, slime, witch, cave spider, squid, bat, wolf, ocelot, horse, mooshroom and zombie villagers run on the server and are drawn by clients; spider jockeys attach. One tracker entry per mob is shared by all watchers. Found wrong: a delayed kill credits the source of the killing blow, as before (bytecode-read).
- **Tracker after a trip.** The away run's moving ticks are replayed into the tracker, and entities spawned during the trip get their own age.
- **Saved order.** Frozen entities are invisible to the trackers, AI searches and collision pushes; reloaded entities take new ids in stamp order (executed `SavedOrderLoginProbe`).
- **Mob copies' Random.** Water splash and drowning, the wither's charge particles, status-packet particles (zombie conversion, witch, wolf shake, love, villager, tamables) and the enderman's watcher 18 (executed `MobCopies2Probe`, 567 records). The live iron golem no longer drowns.
- **Small checks.** Brewing-stand takes award `potion` only for a potion (damage > 0). Comparators read no item frames in 1.7.10 (bytecode-read `BlockRedstoneComparator`), so that gap was wrong.

Still open from batch 61: carried into the batch 62 list above, except the items batch 62 closed or found wrong.

## Done in batch 60

Batch 60 covered these areas:
- **Multiplayer health.** The connected client plays the hurt and death sounds, tilts the camera and blinks the hearts from the server's S19 and S06 (bytecode-read). A Survival server drops the dead player's inventory through the single-player drop path and the XP orbs at death tick 20 (`min(level*7, 100)`, `keepInventory`, `doMobLoot`). Effects from food, golden apples, beacons, `/effect` and milk reach the client (`healthEffect` / `healthEffectEnd`), and milk now clears them on the server. Other players see a dead player tilt and poof. Dead players stay in the tab list natively (S38 is only sent on login, logout and ping), so that gap was wrong.
- **Multiplayer inventory.** The server runs window 0 (main, armour, 2x2 grid and result, shift-click, drags, cursor) and confirms or refuses each click; armour is saved and server-authoritative; closing throws the cursor and the grid. A partial pickup flies in. A broken tool is the breaker's own sound and crumbs (`invBroke`), and others hear `random.break`; no packet carries the break natively.
- **Stations.** The workbench, enchanting table (server-rolled costs as S31 0..2, C11) and anvil (MC|ItemName with the native 30-character limit, repair cost, 1020/1021) are server windows.
- **Containers.** Hoppers and dispensers/droppers tick on the server with their aux effects; a lit furnace swaps block and light for clients; a viewed trapped chest powers its neighbours; a never-opened chest gets its lid from the chunk data, and furnace takes spawn smelting XP.
- **Mobs over a connection.** Mob sounds go out as S29, status 2/3/18 as `mobStatus` (hurt flash, death poof; the destroy now goes one tick later so the poof is drawn), kill XP orbs, knockback applied to the hit server player, one spawn pass per tick over the union of players' chunks (bytecode-read `SpawnerAnimals`), and the velocity flags cleared after every tracker. Natively there is no S12 to the hit player in this port's model: the server position moves him.
- **Achievements on a server.** `server-achievements.js` awards crafting (workbench and 2x2), smelting (furnace takes), kills (killEnemy, snipeSkeleton, overkill), exploreAllBiomes and fullBeacon; Q-drops are made on the server with a `Thrower`, and diamondsToYou is awarded to the thrower on another player's pickup (bytecode-read `EntityItem`).
- **Tracker.** The Overworld spawn area's items, orbs, arrows, throwables, TNT, falling blocks, rockets, eyes, boats, carts, paintings, frames and knots keep their tracker phase across a Nether or End trip, with the mobs in one order. "Caught up at the final state" was mostly wrong (executed b58: the re-entry spawn packet is the current state, no interpolation); copies start at age 0 natively (a new WorldClient), so the age gap was wrong for copies.
- **Mob copies' Random.** Every living copy draws the living-sound roll with its talk interval and sound draws, plus the enderman, blaze, wither and slime per-tick draws (executed `MobSoundsProbe`, 28 mobs).
- **Saved order.** Leaving chunks are queued and unloaded once per tick after the spawner, 100 per call, cancelled when the chunk returns; their entities stop ticking and counting and rejoin in native order (executed `SavedOrderLoginProbe` scenarios). The "same tick" part was half wrong: the timing already matched.
- **Small checks.** The comparator toggle with powered inputs is predicted from the client world's own blocks (402 executed records). The F3+H suffix of a named stack is no longer italic (native `§oBob§r (#0035/5)`). Effects follow Java 8 HashMap order in the tick, the save and the inventory list.

Still open from batch 60: carried into the batch 61 list above, except the items batch 61 closed or found wrong.

## Done in batch 59

Batch 59 covered these areas:
- **Survival state on the server.** A dedicated Survival server keeps each player's health, food, saturation and exhaustion with the single-player rules (fall and void damage, hunger by difficulty, regeneration, eating). It sends an S06-style `health` message when one changes (`EntityPlayerMP`, bytecode-read), opens the death screen at 0 and respawns on request; vitals are saved. A `--difficulty` option sets the difficulty.
- **Items on the server.** The server mirrors all 36 main slots with real counts and tags; placing spends the stack and breaking wears the tool, sent back as numbered `slot` corrections the client acknowledges (S2F). Ores drop real XP orbs; leaf decay, plants, rails, torches, doors, beds and falling blocks drop real items in Survival; items and orbs are saved. Other players see the break effect (aux 2001 within 64, not to the breaker, bytecode-read) and the pickup fly-in, and hear the pop; a partial pickup takes what fits.
- **Server world commands.** `/time`, `/weather`, `/toggledownfall`, `/difficulty`, `/gamerule` (with `doDaylightCycle`), `/defaultgamemode`, `/list` and `/tellraw` run on the server's world; `/clear` walks the whole inventory; `/spawnpoint` and `/enchant` work on other players. `openInventory` and the pickup achievements are server triggers (bytecode-read).
- **Containers over a connection.** Chests, furnaces, dispensers and droppers, hoppers, brewing stands and ender chests open as server windows: S2D, S30, C0E clicks run by the server's `Container.click`, S32 accept or refuse, S2F, S31 progress bars, C0D / S2E. Lids animate for everyone (S24); furnaces and brewing stands tick on the server; ender chest contents are per player and saved.
- **Mobs over a connection.** The server runs one `EntityWorld` for the dedicated world with the nearest player as each mob's player, spawns naturally and sends the mobs through each player's `MobTracker`; clients draw them with the mob renderer. Players attack mobs with the held weapon (C02); mob hits go through the player's real `Survival.scaledDamage` (lead fix at the merge). Pig, cow, sheep, chicken, zombie, skeleton, creeper and spider; mobs are saved.
- **Client prediction, part 5.** Flower pots, empty-bucket stacks above 1, the command block screen at the click, the dragon egg's portal particles at the click and on a punch, splash potion counts, real fire losing its support after a predicted break, and flint and steel are predicted (`client-predict-reference.json`, 258 records).
- **Mob copy deaths.** Client mob copies count deathTime, tilt and draw the 20 poof particles at 20 from their own Random (executed `DeathFxProbe`); the live mob no longer draws a second poof when a copy is tracked.
- **Tracker while away.** The Overworld's spawn-area mobs keep their tracker phase across a Nether or End trip (`idleTrack`); the Nether and End keep nothing loaded without a player, so their arrival at age 0 is right (bytecode-read `ChunkProviderServer`).
- **Saved order, part 7.** Chunk unloading renumbers only chunks more than 128 blocks from the spawn (executed, `saved-order7-reference.json`); the taken seat is freed at the mob's own turn and at the player's place in the list.
- **Small checks.** F3+H item titles end with `(#0035/14)`-style ids (executed over all 315 items). The sneak 0.08 held-light drop is confirmed in bytecode. The comparator toggle was found wrong when leaving subtract mode with a powered input; the full rule is in `comparator-toggle.js`. Java 7 and 8 effect orders differ only for effect ids 16 and up.

Still open from batch 59: carried into the batch 60 list above, except the items batch 60 closed or found wrong.

## Done in batch 58

Batch 58 covered these areas:
- **Survival over a connection.** A dedicated server started with `--gamemode survival` breaks through its dig timer and drops the block's items as real entities (the single-player drop rules); clients see them and pick them up (the server checks the delay and reach). The browser client digs with status 0, 1 and 2 and the 5-tick hit delay (`PlayerControllerMP`, bytecode-read). Lead fix: the client's mining timer did not run over a connection (`movementTick` returned first), so the finish was never sent.
- **Remote eating.** Another player's eating or drinking shows crumbs from the food's icon every 4 ticks from 24 down (executed `updateItemUse` on `EntityOtherPlayerMP`, 18 records); the eat, drink and burp sounds come from the server as S29 within 16 blocks, as the client's own call is silent. The burp is heard by everyone in range, not only the eater (the gap was wrong).
- **Server broadcasts and commands.** Death messages and first achievement unlocks go to every player as chat components with hover and click; 1.7.10 has no showDeathMessages gamerule (bytecode-read). Operators (`MC_WEB_OPS`) run `/give`, `/clear`, `/xp`, `/effect`, `/gamemode`, `/tp` and `/achievement` on other players, and other operators see the grey admin line; `/kill <name>` kills the sender as in 1.7.10. Chat and command lines carry component JSON.
- **Client prediction, part 4.** The held stack changes at the click (a placed block, a used item, a bucket swapping to the filled or empty bucket) and the server's run settles it; the wooden button press and the comparator mode toggle are drawn at the click. The client's own button click is silent natively; the one click is the server's packet, so the port's extra click was removed. The Nether water smoke shows at the click (8 puffs at `y + random`) and the fizz comes from the server. The probe covers comparators, stations, jukebox, note block, command block and flower pots (241 records).
- **Item tags, part 2.** A non-string Lore list is kept as raw NBT and shows nothing; SkullOwner profiles (Name, Id, textures) survive every path including the placed skull; a dispenser's splash potion keeps its custom effects; map tooltips ("Scaling at 1:N", "(Level L/4)") show with F3+H only (executed `ItemTags2Probe`).
- **Rendering.** The hopper picked from a placed hopper is drawn as its item sprite in slots, hands, drops and frames. The held-item light reads the player's current tick cell, not the interpolated camera (bytecode-read).
- **Vehicles and crystal fire.** The boat copy's walk order, the dismount fall and the cart rider's fall match executed records with no code change; the horse copy's hurt and death sounds draw from its own Random. The flag metadata delay was wrong (the S1C goes out in the same update). The crystal overlay fire ends when the real cell changes (WorldClient has no timeout); the 1.7.10 client never spreads fire (only WorldServer ticks blocks), so that gap was wrong.
- **Tracker and saved order.** Tracker entries already alive in the other world keep their phase through a silent tick (executed for arrivals at several ages), but the game does not tick the other world while away yet. Taking a boat from a mob seats the player and frees the mob at its turn; falling blocks saved by the away run carry order stamps; chunks loaded after login rank in load order (executed `PlayerManager` moves).

Still open from batch 58: carried into the batch 59 list above, except the items batch 59 closed or found wrong.

## Done in batch 57

Batch 57 covered these areas:
- **Vehicle copies.** The ridden boat's copy collides with every other entity's box (boats, carts, players, items, mob copies), as `EntityBoat.getCollisionBox` makes them obstacles; a boat beside it leaves its run unchanged (25 executed `bx-*` records). The rider's landing plays the fall and step sounds on the client. The horse copy makes the living-sound draw on its own Random (the client sound is silent in 1.7.10); a hurt or killed horse opens its mouth, and a stretched lead stops grazing. The "`bq` starters" were wrong: `bq` is only a counter, and every caller of the mouth, rear and eating methods is covered.
- **End crystal fire.** The crystal copy lights fire on the client block layer (the predicted-cell overlay) and the entry ends when the real world agrees. Lead fix: crystals wrote the original fire id 51 raw into the port world, where 51 is the cobweb, so the End's crystals had stood in cobwebs; they now light port fire. The predicted relight skips ring columns (it crashed on a crystal in one).
- **Display lighting and item shapes.** Tinted display and held faces clamp after the colour (`min(1, C * lit)`), as fixed-function lighting does: tinted leaves and grass items and lit cart display tops were too dark. The executed render type sweep (blocks 1..255) made ladders, rails, lily pads, vines, mushrooms, tall grass, ferns, double plants and the stained glass pane flat item sprites; the hopper block item is its item sprite. Held-item lighting already matched (executed `enableStandardItemLighting`).
- **Item tags.** `display.Lore`, `SkullOwner`, `CustomPotionEffects` and `map_is_scaling` survive moves, saves, Java import and export, `/give`, drops and pickups. Lore prints dark purple italic, a player head is "<name>'s Head", and custom effects drive the name, tooltip, glint, drink and splash. The splash instant branch is executed for instant health and damage at amplifiers 0..3, several distances and undead targets (342 rows); heal and harm run in effect order.
- **Chat over several players.** Selectors and `/tell`, `/say` and `/me` work over every player record, so the 336 three-player cmd-chat rows replay. The `/tell @p[r=5]` command-block row was a selector count rule (`@p` and `@r` reach the command's own lookup). A player sender keeps `@p` literal in the message. `/effect` already matched (no Ambient written, natively false). On the dedicated server a "/" chat line runs through the command layer and reaches only its recipient.
- **Client prediction, part 3.** Buckets (34 executed records), cocoa, buttons and repeaters are drawn at the click; door, trapdoor, gate and button sounds play at the click once. Leads, beds, signs and skulls change nothing on the 1.7.10 client (executed), so the gap was wrong. The server's range limits are wider than the aim, and the draw-refuse-revert cycle is tested, including relight on a streaming world.
- **Multiplayer dig and use.** In a Survival dedicated world digs go through the server dig timer and direct breaks are refused; crack stages reach other players within 32 blocks and are drawn per breaker; remote players show the blocking and bow poses from a synced item-in-use flag.
- **Tracker and saved order.** The probe's second world now ticks before the arrival; the "network spawn one update early" gap was wrong (four records replay every packet). The Nether and End have no spawn grid in 1.7.10 (`initialWorldChunkLoad` loads dimension 0 only), so that gap was wrong too. A boat holding a mob can be clicked: both end up free next pass, as natively. The mount's chunk ranks after the view square. Non-mob entities saved above y 256 already matched.
- **Browser check.** The door toggle showed 25 ms after the press (real 80 ms) with one sound; a water bucket placed water at the click. `/give` with Lore, SkullOwner and CustomPotionEffects kept all three. The ridden boat's copy matched the live boat until it broke on the second boat at 0.25 speed (natively over 0.2). In the End 15 crystals stood with fire and no cobwebs. Ticks held at 160 per 8 s in the Overworld, the Nether and the End with no long tasks while turning.

Still open from batch 57: carried into the batch 58 list above, except the items batch 58 closed or found wrong.

## Done in batch 56

Batch 56 covered these areas:
- **Prediction, part 2.** A break predicts its cascade (a door's or bed's other half), and right-click uses are predicted: door toggles, door, reed, redstone, repeater, stand, cauldron and flower pot items. Predicted cells are relit at once, meshing each touching column once. A mouse right click is now predicted like the key (it had bypassed the prediction).
- **Vehicle copies.** The ridden boat's client copy runs the executed boat physics in remote mode and seats the player on it. The horse copy gets its flags through the tracker, runs its tail roll on its own Random, and the renderer draws ModelHorse's executed rearing, eating and mouth pose from the copy's counters.
- **Tracker spawn phases.** Mob spawns from the spawner pass and the tile-entity pass are placed against the player's flush as the executed records show (`b56tm`).
- **Saved order, part 4.** Login chunk ranks follow the executed order, and the chain below the player's mount is not saved. The away run's mount gap was backwards (no change).
- **Display brightness.** Display blocks and entities take the executed brightness rules; carts light their display block by their own brightness.
- **Chat.** Hover text prints the full NBTTagCompound.toString; `/tell`, `/say` and `/me` run on the real CommandHandler, and usage errors are bare red.
- **Dragon death.** The XP orb spawn ticks and positions are executed; the dragon egg has no living sound in 1.7.10.
- **Browser check.** A torch break and a door place and toggle were predicted ahead of the queued packet (door seen 38 ms after the press, real 84 ms; toggle 35 ms, real 75 ms). A ridden boat's copy matched the live boat with the player seated, and the dismount worked. A ridden horse's copy got its flags and drew the rearing pose. `/say` with no text printed bare red `commands.say.usage`. Ticks held at 160 per 8 s in the Overworld and the Nether with no long tasks.

Still open from batch 56: carried into the batch 57 list above, except the items batch 57 closed or found wrong.

## Done in batch 55

Batch 55 covered these areas:
- **Item names in chat.** Death messages with a named weapon, `/give` and item statistic names show the item as "[name]" in its rarity colour with a `show_item` hover, as `ItemStack.func_151000_E` does. The rarity table is executed (315 items): enchanted stacks and records are rare, a golden apple is rare or epic, an enchanted book uncommon; the Nether star, beacon, potions and the experience bottle are common in 1.7.10. The component sets no italic. Only the player, arrow, fireball, thrown and indirect magic deaths have an ".item" key in 1.7.10, so a mob melee kill never names the weapon.
- **Client break and place prediction.** Instant, finished and creative breaks and plain block placements are drawn, sounded and aimed at on the click through a predicted-cell overlay, before the queued packet runs in the network tick. The queued run does not repeat the sound or particles, and a change the server refuses is rebuilt from the real world.
- **The tracker at a respawn and a dimension change.** Executed records (`b55dt`) of a respawn, a dimension change and spawns made inside the entity pass. The b54 respawn re-send and the port's dimension change replay equal with no change. An object spawned by an entity before the player's slot now reaches the client before that tick's destroys, and the old world's tracker lets the player go on a dimension change.
- **The horse copy's own animation and the buck.** The copy runs EntityHorse's client animation counters (head lean, rearing, mouth, tail) from its watcher-16 flags, and the seat shift reads the copy's own rearing amount. The run-around buck lands the player on the `dismountEntity` spot: the old b47 record left the player on the seat only because its probe stub ignored `setPlayerLocation` (re-recorded). A ridden unsaddled horse's copy matches an executed record with no change.
- **Combining and refusing effects.** `PotionEffect.combine` applies with its ambient rule for mobs and the player. `addMobEffect` checks `isPotionApplicable` (the undead refuse Regeneration and Poison, spiders and cave spiders refuse Poison). One executed undead set is used everywhere, including the witch's splash potions and the wither's targets; zombie and skeleton horses are not undead in 1.7.10, and the silverfish is an arthropod.
- **Browser check.** A torch broke on the click: the predicted cell read air 36 ms after the press and the real world 75 ms after, with one break sound. A placed block showed on the next frame with one place sound. `/give` printed an aqua "[Edge]"; a skeleton's arrow death named "[Edge]" in aqua with a `show_item` hover. A ridden horse's copy reared from its own flags. Ticks held at 160 per 8 s in the Overworld and the Nether with no long tasks.

Still open from batch 55: carried into the batch 56 list above, except the items batch 56 closed.

## Done in batch 54

Batch 54 covered these areas:
- **The ridden horse's copy.** A saddled horse's client copy no longer follows the live horse. Its position comes from the packets, and its yaw and half its pitch follow the rider's look, as `wi.e(FF)` does natively (the server moves and jumps the horse). Horses and pigs seat the player on the copy, and a rearing horse shifts its rider 0.7 * rearAmount along the body yaw. The dismount puts the player at the `dismountEntity` spot, as for carts. Executed: 8 steer scenarios and 20 rear rows (`HorseCopyProbe`); the server side is bytecode-read.
- **Display cubes and the hopper.** Every cube-path display shape (full cubes, slabs, logs, stairs, fence, wall, cactus, anvil, dragon egg, beacon, enchanting table) was compared vertex by vertex with the executed `renderBlockAsItem` quads, and the port already matched. The hopper on a cart and the hopper minecart now draw the 17 executed quads (bowl, inner walls, floor and funnel) instead of 5 boxes. Flat display shapes carry the item normal (0, -1, 0), so under the standard item lighting they shade at the 0.4 ambient level (bytecode-read). The chest display matches the executed chest item model.
- **Player names in death and achievement chat.** Death messages name a player victim or killer with the team-formatted player component and the `/msg` click; a mob killer stays plain text. The achievement broadcast uses the same component. The scoreboard sidebar and tab list draw Strings natively, so the gap was wrong for them (bytecode-read). Executed: 4 new `b54cn` component rows.
- **Dig abort and crack stages.** The server dig model has `cancelDestroyingBlock`: it clears the dig and sends crack -1 at the last start cell, without resetting the remembered damage or stopping a delayed break. Starts and ticks send the crack stage `(int)(damage * 10)` in float arithmetic. The client sends the abort when an unfinished dig ends, and before a new start while another dig is running. Executed: 20 new `da-*` records (1741 in all), with every crack event compared.
- **The tracker at a respawn.** A respawn re-sends every tracker entry to the new player in HashSet order, before that tick's new spawns, and the client copies are reset in place. The non-joint server tick path joins the player in set order too. Leash knots, fireworks, falling blocks, primed TNT and thrown potions are now in the executed joint record (2 new cases, `b54rt`). The re-send itself is bytecode-read.
- **Instant effects, health boost and effect order.** Instant health and instant damage are kept on import and act on each update (reversed for the undead). Health boost applies its transient max-health modifier when added and clamps health when it ends or is re-added. Effects are exported in the HashMap's bucket order, and a repeated id on load replaces the earlier entry. A negative Jump Boost lengthens a fall. Executed: 371 `MobEffects2Probe` records (order, import, instant, health boost, jump).
- **Saved order, part 3.** The section check runs after each entity's own update. The player's mount is taken out of the chunk walk and stamped last, as the player's `Riding` tag loads after the chunks. A mob saved above y 256 is restored. A despawn and the dragon's end keep the health as `removedHealth`. Executed: 9 `b54so` scenarios. Lead fix: a rider skipped at its own place gets no section check there (bytecode-read).
- **Item tints and boat copies.** The item atlas no longer bakes the reed block tile in the grass colour. Tall grass meta 0 is the dead shrub, whose icon was never tinted (the gap was wrong). A boat copy in flowing water matches 8 executed `BoatCopyProbe` records with no code change, so batch 53's water movement is now executed-confirmed.
- **Browser check.** A short click on dirt was released and the block stayed; a held click then broke it. A right click mounted a saddled horse: the player sat on the copy, the copy's yaw followed the look, and the sneak dismount landed beside the horse. The display carts drew the hopper bowl and darker flat shapes. Opening the inventory printed the achievement line with the player's name. Ticks held at 160 per 8 s in the Overworld and the Nether. The lead fixed a loot flush crash found by this check (loot queued outside the tick, such as a killed horse's saddle).

Still open from batch 54: carried into the batch 55 list above, except the items batch 55 closed.

## Done in batch 53

Batch 53 covered these areas:
- **Pig mounts and boat copies.** A player riding a pig sits on the pig's client copy (its seat height is the mounted offset), and the copy is no longer pulled to the live pig. A boat copy runs its own `handleWaterMovement`: the flow push, the enter-water splash sound, and the bubble and splash particles from the copy's Random. Bytecode-read.
- **Chat components for /tell, /say, /me and player chat.** `/tell` sends the gray italic `commands.message.display.incoming` line to the target and the outgoing line to the sender. The `/say`, `/me` and `/tell` messages are built one word at a time with " " siblings, as `func_147176_a` does, and `/say` expands selectors. A player's name in chat carries a `suggest_command` click with "/msg <name> ". Executed: 8 new `b53ct` component rows. The command trees are recalled from the 1.7.10 source.
- **Item colours.** An executed sweep of `Item.getColorFromItemStack` (`b53lc`, 315 items): held, dropped, inventory and item-frame leaves take 48b518 (spruce 619961, birch 80a755), and the vine 48b518. The grass block item has a tinted top and plain sides, with no overlay.
- **Display shapes executed.** The real `renderBlockAsItem` ran with a recording GL11 and Tessellator stub (96 `b53dq` records). Crossed squares, small stems and torches matched unchanged. Crops are now one block tall from the origin (not 1/16 low), in the native plane order. The tints and the grass block's face order matched.
- **The server dig timer.** `ItemInWorldManager`'s own tick count decides a finished dig: at 0.7 of the server's damage it breaks whatever block is in the cell, softer ones included. Below that the block is resent and breaks from the server's tick once the damage reaches 1. Executed: 1721 `b53df` records. Lead fixes (bytecode-read): an instant break does not move the remembered dig cell, and the finish compares with the float `0.7F`.
- **The player in the tracker.** The player takes a place in the entity list and an entity id at its join, and a new place and id at a respawn. Its tracker entry is a key of the HashSet. The entities already in the world are sent to it in set order at the join. Due destroys reach the client before the tick's new spawns. Boats, minecarts, paintings, item frames, eyes and a fish hook are now in the executed joint record (2 new 60-tick cases, `b53tj`).
- **Fire on mobs.** Every fire-immune mob, the wither included, ends each update with its fire counter at 0 (executed: `sv.C` extinguishes after `sa.C`'s run-down). This corrects batch 52. Fire Aspect, flame arrows, zombie hits, small fireballs, lava, sunlight and fire blocks on a mob are shortened by Fire Protection on its equipment. A flame arrow never ignites an enderman (lead fix, bytecode-read). Effects with no mob behaviour (haste, mining fatigue, jump boost, resistance, blindness and others) are kept, counted down, saved and exported, and Jump Boost raises a mob's jump. Executed: 420 `setfire`, 35 `firetick` and 28 new effect rows.
- **Saved order, part 2.** An entity that changes chunk or section moves to the end of its new list, and one above 256 or below 0 is refiled every tick. A rider is saved with its mount nested, and the load files the mount right after it. Fireballs and wither skulls are stamped. A cured zombie and a sheared mooshroom keep their health as `removedHealth`. Executed: 13 `b53so` scenarios.
- **Browser check.** A held click dug a block through the server timer and continued into the next one. A right click mounted a saddled pig, and the player sat on the pig's copy. The display carts drew mature wheat, young wheat, carrots, leaves and the grass block. Inventory icons show the plain grass sides and the new leaf tone. `/me` printed its word list, keeping a double space as an empty word. `/tell` to two names not in the world printed the red "That player cannot be found" error. The whisper lines themselves were not seen (only the local player exists).

Still open from batch 53: carried into the batch 54 list above, except the items batch 54 closed.

## Done in batch 52

Batch 52 covered these areas:
- **The ridden cart's copy.** The cart the player rides is drawn and aimed through its client copy, and the player sits on the copy, so the camera trails the live cart as natively. The sneak dismount still uses the live cart's seat. Bytecode-read.
- **Dig start and finish in the network tick.** The dragon egg teleport, the note block click and the redstone ore touch of a dig start are queued with the other block clicks. A finished dig is refused when the block in the cell changed. Bytecode-read.
- **Display block colours.** An executed sweep of `Block.getRenderColor` over every id and meta (`b52dx`): leaves (by type), tall grass, fern and stems on a cart's display block take their colour, drawn from the grey block atlas instead of the pre-tinted item atlas. The grass block's top face alone is green, as `renderBlockAsItem` draws it (lead fix, bytecode-read). The boat splash matched executed records unchanged.
- **Command output in the chat window.** Command feedback, errors, help pages, `/say`, `/me` and the command block broadcast draw their formatted components. An invalid `LastOutput` in an imported chunk now fails the whole chunk, which is then treated as absent. Executed: `ChatComponentProbe` (15 trees, `b52cc`).
- **Mob effects and lightning.** Every mob kind exports `ActiveEffects` in the native map order, with the signed amplifier and `Ambient` (168 executed `b52me` records). Lightning's 8-second ignition is shortened by Fire Protection, and a fire-immune mob's rested counter stays at -1, so a strike ignites it (54 executed `bolt` records). A player's arrow on a zombie pigman matched 4 executed records.
- **Saved entity order.** A save stamps every entity record with its place in the native chunk save walk (chunk, then vertical section, then list order), and a load restores it, so mixed kinds tick in the order a native chunk load gives (7 executed `b52so` scenarios). A spawn egg draws its yaw before `onSpawnWithEgg`, and a villager from an egg rolls its profession from the world Random (54 executed rows).
- **Tracker walk and destroys.** The joint mob and object tracker walk matches an executed `EntityTracker` run tick by tick (3 cases of 60 ticks). An entity removed before the player in the list has its destroy flushed in the same tick. Eyes of ender, fish hooks and restored items, arrows and orbs take their entity id when created or loaded. The squid's client copy and the client dragon's body turn matched executed records unchanged.
- **Browser check.** A real click placed a block, a held click dug a grass block, a click hit a cow, a right click mounted a cart and the player followed the cart's copy, and the display carts drew with the native tints. The lead fixed the grass block's top tint.

Still open from batch 52: carried into the batch 53 list above, except the items batch 53 closed.

## Done in batch 51

Batch 51 covered these areas:
- **The ridden boat's copy.** The client copy of the boat the player rides takes the live boat's position, motion and heading each tick, so it splashes from its own `Entity.rand` (`ObjectClient.mirrorRidden`). Bytecode-read: the attach packet sets the ridden boat non-empty, so its client update skips interpolation. A ridden cart interpolates like any other.
- **Command texts as chat components.** Help pages (`commands.help.header` in dark green, footer in green), the gray deprecated-id text, the gamerule query and list (plain text; the list joined "a, b and c"), and the gray italic `chat.type.admin` op broadcast. An invalid-JSON `LastOutput` now fails the load of that command block or cart. Executed: `CmdTextsProbe` builds the components with the real chat classes (10 `b51ct` rows); the command classes themselves are absent from the client jar.
- **Mob victims.** A mob's absorption amount is saved and loaded (`AbsorptionAmount`, also in `/summon` and the export). The real skeleton, wither skeleton, zombie pigman and wither were executed as victims (1669 `b51mv` records). Fixes: fire immunity is the callers' check, not `attackEntityFrom`'s, and the wither skeleton and wither are fire-immune; the wither's armour is a flat 4; the wither refuses arrows from undead shooters.
- **One tracker walk.** With the list walk, the mob and object tracker entries run as one loop in the shared order, so their packets queue together, and new entities of a tick enter in id order. Items, arrows, thrown entities, TNT, falling blocks and rockets take their entity id when they join the world. Bytecode-read; the vehicles reference was regenerated byte-identical.
- **Block clicks in the network tick.** Right clicks on a block and finished digs (C08, C07) are queued with the entity actions and applied after the walk in arrival order; the swing, dig progress, sounds and hit particles stay at once. Bytecode-read (`MinecraftServer` world ticks, then the network).
- **Flying turns.** The ghast's turn matched 6 executed flights unchanged. The dragon's body yaw now runs the legacy body turn over the tick's travel and leaves the head yaw alone, and its growl timer starts at 0 and draws two floats for the pitch (5 executed flights, `b51ft`). The silverfish pulled into a retracting piston matched 3 executed records (`b51sf`) unchanged.
- **Dispensers.** Spawn eggs are dispensed at the dispenser's own level + 0.2 with a world-Random yaw and the stack's name; one egg is always used. The exp bottle dispense and the away item-frame drop matched executed records unchanged (108 `b51ad` records).
- **Dragon beam and display tint.** The healing beam scrolls by the dragon's tick count, not the crystal's. Tall grass and fern on a cart's display block take the grass colour; the dead shrub stays untinted. Bytecode-read.
- **Browser check.** A real right click placed a block through the queue, a click hit a cow after the walk, and the grass, fern and shrub display carts drew with the right tints. The lead fixed the gamerule list join.

Still open from batch 51: carried into the batch 52 list above, except the items batch 52 closed.

## Done in batch 50

Batch 50 covered these areas:
- **Leash knots and boat splash on the client.** The crosshair picks a leash knot, placed or summoned, through its client copy's 0.5 box grown by the 0.1 border (`aimKnotBox`). A right click ties the held mobs to it or removes it, and a left click breaks it. The boat copy spawns "splash" particles above 0.2625 blocks a tick from its own `Entity.rand` (`ObjectClient.splash`, bytecode-read).
- **Cart display shapes and the TNT cart fuse.** A custom display block is drawn in its item form. Stairs, fences, walls and chests draw in 3D, flowers, saplings, crops, stems and torches draw their flat shapes, and the render types `renderBlockAsItem` has no branch for (fluids, doors, rails and others) draw nothing. The TNT cart copy spawns smoke at y + 0.5 each tick its fuse runs. The swell scales only the display block and the flash, inside the 0.75 frame (bytecode-read).
- **Command output as a chat component.** The command block's and command cart's `LastOutput`, NBT and watcher 24 hold the native `{"extra":[...],"text":"[hh:mm:ss] "}` JSON, with translations as `translate`/`with`, Gson's HTML escaping, and old saves re-serialized on load. The GUI shows the output whatever `TrackOutput` says. Executed: `CmdOutputProbe` runs the real `CommandBlockLogic` (22 rows).
- **Mob Resistance and absorption.** The mob damage path runs armour, Resistance (20% per level, not for the void or absolute sources), worn enchantments, then the absorption amount. Mobs can carry Resistance and Absorption. Mob armour never wears. Executed: 771 `b50mr` records, including PvP.
- **One tracker order, a late destroy.** Mobs and objects share the entity id counter and one `JavaHashSetOrder`. A removed entity's copy stays one tick, until its destroy packet is flushed (still a target and a crystal for the dragon that tick). Client copies step in spawn-packet order. Executed: `TrackerIdsProbe`; the `b49dc` mounts records were regenerated with the late destroy.
- **The player's entity actions in the network tick.** A click that hits or uses an entity, or throws or places one, waits until after the mob walk (C02/C07/C08 in `NetworkSystem.networkTick`); the swing stays at once. `EntityWorld.kill` is an outOfWorld `Float.MAX_VALUE` hit with no player credit. Executed: 5 `b50mo` `EntityListProbe` scenarios.
- **Legacy body turn audit.** Every 1.7.10 mob's `isAIEnabled` was read. Silverfish, giants, pigmen, blazes and ghasts join `LEGACY_BODY`, and the silverfish, giant and blaze head and body yaw now match. Executed: 23 `b50lb` records. `b46mp` was regenerated under the batch 47 harness, and its two replay workarounds are gone.
- **Away list order and dispensers.** The away run's list order matched 8 executed `AwayOrderProbe` scenarios unchanged. Dispensed thrown entities join the list, an exp bottle is thrown as a projectile, the fire charge draws from `world.rand`, and away items and orbs own an `Entity.rand`.
- **Browser check.** A real click hit a cow after the walk, a summoned knot broke on a click, and display carts and the TNT cart smoke drew. The lead fixed the aimed-knot click, which threw in `serverAcceptsClick`.

Still open from batch 50: carried into the batch 51 list above, except the items batch 51 closed.

## Done in batch 49

Batch 49 covered these areas:
- **Cart display blocks, the client fuse and cart shadows.** A cart draws the custom display block of its watchers 20 to 22 at 0.75 scale, raised by the offset, from the client copy; `/summon`, NBT and saves keep `CustomDisplayTile`, `DisplayTile`, `DisplayData` and `DisplayOffset`. The TNT cart's flash reads the copy's fuse, set by entity status 10 and counted down on the copy. Carts cast the RenderMinecart shadow (0.5). Executed: `CartDisplayProbe` (`cart-display-reference.json`).
- **Aiming at the client copies.** The crosshair tests the client copy's box for boats, carts, paintings and item frames, and the use, attack or ride reaches the live entity (`aimBox` in `object-tracker.js`). An entity the tracker follows with no copy is not aimable; the ridden vehicle and an entity not yet listed keep the live box. Bytecode-read (`EntityRenderer.getMouseOver`).
- **Furnace-cart collisions and the command cart's last output.** When exactly one cart is a furnace cart, the plain cart is damped to 0.2 and takes the furnace cart's motion with the push, and the furnace cart keeps 0.95 (1050 executed `FurnaceCartProbe` records). The command cart's watcher 24 reads "" when fresh or after a run with no output, and "null" only after a load, `/summon` or closing its GUI (executed).
- **Damage sources decide armour.** `Survival.damage` applies armour by the damage source (`isUnblockable`), not the caller's flag. Resistance no longer reduces starvation. A hit that gets past absorption adds 0.3 exhaustion, except for the sources that bypass armour. Mobs now treat a thrown harming potion (`indirectMagic`) as bypassing armour. Executed: 675 `b49fa` records (`ArmorSourceProbe`, 21 sources, armour, the five protections, Resistance and absorption).
- **Pistons after the mobs.** The live piston tile loop runs after the entity walk (`tickTiles`, `deferTiles`), as `World.updateEntities` orders them. Executed: 12 `b49po` records of mobs on a pushed block, a spider, a size 4 slime and an iron golem. They also showed that spiders and slimes turn their body the legacy way (`LEGACY_BODY`; cave spiders and magma cubes by inheritance).
- **Tracker walk order.** The entity tracker walks its entries in `java.util.HashSet` order of the entity id (Java 8 and later), so packets go out in bucket order, not list order (`java-hashset-order.js`). Executed: `TrackerOrderProbe`, 713 orders over 10 add/remove histories.
- **Death drops at the hurt call.** Drops, death orbs, breeding orbs, shear wool and chicken eggs join the list when they are spawned, including kills outside the walk (a player's hit, the void, a blast). A zombie that converts a villager joins ahead of the loot. A blast takes its entity list before any hurt, so its own drops are not blasted. Live items and orbs each own an `Entity.rand`. Executed: `EntityListProbe`, 88 scenarios (10 new `b49hd`).
- **The client dragon's crystals.** The client dragon copy searches the crystal copies itself (the `nextInt(10)` roll, the nearest within 32), drops a target whose copy is gone, heals its own health every 10th tick, and the beam is drawn from its target. Crystal copies are tracked at 256 with no velocity and no longer fall. Executed: 3 `b49dc` scenarios of 80 ticks (`TrackerMountsProbe`).

Still open from batch 49: carried into the batch 50 list above, except the items batch 50 closed.

## Done in batch 48

Batch 48 covered these areas:
- **Vehicles drawn from their client copies.** Boats, minecarts, paintings, item frames and leash knots are drawn from their batch 47 client copies, as are the boat shadow and the spawner cart's display mob (`vehicleViews`, `hangingViews`, `knotViews` in `object-tracker.js`). A view keeps the copy's position, rotation and watched values (wobble, damage, the frame item, the painting art) over the live entity. The boat or cart the player rides is still drawn from the live one. Bytecode-read: the boat and cart wobble counts down on the client copy between S1C updates.
- **Sword blocking takes less damage.** While blocking, blockable damage is halved, `(1 + amount) * 0.5`, before armour. Fire, drowning, starving, falls, the void, magic and wither are not blockable. A rider is no longer slowed by using an item; walking while blocking was already slowed. Executed: 119 `sword-block-reference.json` records (`BlockingProbe`).
- **Death drops in the walk.** A mob's death drops and xp spawn at its own step in the one walk, so they join the tick order and update in the same pass. Live carts, boats and hanging entities now report their joins. Exp-bottle orbs draw from `World.rand`. Executed: `EntityListProbe`, 78 scenarios: a cow that falls and dies, with and without a player hit.
- **Tracker timing for vehicles.** Boats and carts placed by the player start their tracker entry at creation (`tracker-birth.js`). Collisions set `airBorne` and hits set `velocityChanged`, so the entry sends at once. The furnace cart's watcher 16 and the command cart's watchers 23 and 24 are ported. A changed string watcher now sends its S1C. Executed in `TrackerVehiclesProbe`: the far boat is untracked at tick 71, as the port already did; the probe was wrong.
- **Pistons push the server's copy of the player.** The piston tile loop moves the integrated server's copy of the player with the same move as mobs. The copy keeps its own `onGround` between packets. Executed: 25 `b48pp` records (mobs and the copy, extending and retracting tiles, walls, ceilings, lifts).

Still open from batch 48: carried into the batch 49 list above, except the items batch 49 closed.

## Done in batch 47

Batch 47 covered these areas:
- **Two passes for thrown and mob-held items.** A thrown potion draws its liquid pass tinted by the potion colour, then the bottle (`projectile-renderer.js`). Mobs draw held eggs and potions in two passes (`held-sprite.js`), and baby bipeds use the child held frame. The witch's nose pivot is the executed [0,-2,0], and its held potion sits at the nose. Bytecode-read: the inventory's tinted egg and potion layers equal the native two alpha-blended passes. The item-frame compass's own canvas has the pixels of the native shared cell, so neither needed a change.
- **Sword blocking pose.** Holding use with a sword blocks (EnumAction.block, 72000 ticks) in first person and in third person until the button is released. This is the pose only.
- **Away throws and the live rocket.** Away snowballs, eggs and pearls hit carts, boats and hanging entities. The live firework rocket ticks at its join place in the one walk, not after it. A chick hatched mid-walk joins the tick order, and a rider seated mid-pass updates right after its mount. A cart no longer leaves its mob rider's box out of its blockers. Executed: `EntityListProbe`, 74 scenarios.
- **Client copies of vehicles and hanging entities.** The object tracker spawns client copies of boats, minecarts, paintings, item frames and leash knots, and client arrows and hooks hit those copies. The ridden vehicle stays the live one. Executed: the boat spawns 0.3 higher, interpolates for 8 ticks and then coasts on its last velocity packet with float drag. The cart interpolates for 5 ticks and never moves on its own. Hanging copies are static at the tile in their spawn packet. A client dragon-part hit draws three `Entity.rand` floats. Executed: `TrackerVehiclesProbe`.
- **The integrated server's copy of the player.** It rests at the last position a C03 packet gave it: one is sent when the squared move since the last exceeds 9.0E-4, or on the 21st call. Its update has block collisions, the sneak edge, water, lava, web and ladder friction, and the flying 0.6 vertical drag. The server puts the copy back after the update, so only the motion, the web flag and pushes persist. Dragon, cart and boat pushes reach it. The revenge target is dropped when the attacker dies or leaves, or after 100 ticks. Executed: 19 `b47sp` records.
- **Horses, continued.** Running around with an untamed rider is the native AI task: a 1 in 50 roll, temper, the tame roll, the buck and the angry rear. A rider without a saddle does not steer. Further fixes:
  - The status 6 and 7 particles draw no server randoms.
  - A type 0 gallop step draws `nextInt(10)` and breathes at 0.6 volume.
  - Feeding plays `eating`, which has no sound in the manifest, so it is silent.
  - The hurt sound is `mob.horse.hit`, and the angry volume is the float 0.8.
  - A talk-sound rear is skipped while the horse rears or eats.
  - A growing foal's nudge stops flush at a wall.
  - Executed: 62 `b47h` records.

Still open from batch 47:
- **Server copy of the player.** The physics of a riding copy is not modelled, and neither is the velocity of the mob client copies. The order between the position packet and the mob update is bytecode-read only.
- **Away runs.** The away list order and the item-frame and dispenser throws are not probed.
- **Not yet in a browser check.** Arrows hitting the boat copies: the batch 47 smoke's shot missed its aim, so only the unit tests cover it. Riding a wild horse.

## Done in batch 46

Batch 46 covered these areas:
- **Client hit targets beyond mobs.** On a client world, boats, minecarts, paintings, item frames, leash knots and the dragon's seven parts answer `attackEntityFrom` with true. So a client arrow plays `random.bowhit` and ends there instead of ricocheting, and a client hook sets `hooked` and keeps flying. The dragon itself is not collidable, only its parts. A burning client arrow calls `setFire(5)` before the hit (not on an enderman); the copy's next update zeroes it, so the flame shows for one update. A burning server arrow resyncs its velocity every 20th tick (`fire % 20 == 0` runs `attackEntityFrom(onFire)`). Executed: `TrackerHitsProbe`, 11 new scenarios.
- **Player-thrown entities.** The player's throws draw exactly the constructor's three gaussians; the potion and exp bottle used `Math.sin`/`Math.cos` where MathHelper's sine table belongs, and now share `launch` (25 executed launch records). The player's snowballs, eggs and pearls hit carts and boats (a wobble with 0 damage; a Creative thrower breaks the vehicle with no drop), and eggs and pearls break paintings. A pearl moves once more after its impact, as `EntityThrowable.onUpdate` goes on. Executed: `EntityListProbe`, 63 scenarios.
- **Mobs push the player.** The player you control is pushed out of mobs after its move each tick (`EntityLivingBase.collideWithNearbyEntities` on the client player, bytecode-read), from the client copies' positions, Creative included. The integrated server's copy of the player keeps its own motion: mob pushes, hit knockback and blast pushes, the motion snap, ground friction and its own push of the mobs it meets (19 executed `b46mp` records). The witch leads its aim by that motion (or a mob target's own).
- **Item atlas, continued.** Spawn eggs and potions draw their two native passes from atlas cells (`item-passes.js`), so held and dropped potions now show their liquid. The clock and compass are atlas cells that show the current frame. Bytecode-read: the item TextureMap has no mipmaps (only the blocks map gets them), and the piston item is a cube with its native faces (executed draws), so neither needed a change.
- **Away vehicles in the walk.** The away run ticks minecarts, boats, hanging entities and firework rockets at their join place in the one walk with the mobs; a mob rider updates right after its mount, and carts and boats now meet the away mobs as blockers.

Still open from batch 46 (items closed in batch 47 removed):
- The client half of the mob push (the mob side) is not modelled, because client copies keep no motion (serverplayer, bytecode-read: the server's mob packets overwrite the client copy within a tick).
- Egg hatching and exp-bottle orbs on a vehicle or painting hit are not probed, and neither is a pearl thrown by a real `EntityPlayerMP` at a cart.

## Done in batch 45

Batch 45 covered these areas:
- **Client copies hitting client mobs.** A client arrow searches the client world's entities, and `attackEntityFrom` returns false there, so it ricochets at a tenth of its speed. A crit arrow still makes its extra damage roll, and a creative client player is skipped. A client hook calls the hit with 0 damage and never attaches. Thrown entities do no entity search on the client and fly through. Executed in `TrackerHitsProbe`, 19 scenarios. The client copies' own impact, splash, step and launch sounds are logged in call order but stay silent, because `RenderGlobal.playSound` is empty in 1.7.10 (javap). Only the server's sound is heard.
- **The dragon and squid on the client.**
  - Dragon: the client copy has its own seven parts (ids +1 to +7), its health from the spawn packet and S1C, and its death branch with the executed puff offsets. The boss bar and death rays read it. Its wing sound, living-sound roll and puffs draw on the client copy's own random.
  - Squid: the client counts its own air, and the server sends the air in S1C every tick.
  - Executed in `TrackerMountsProbe`.
- **Horses.** 88 executed records replay exactly (`enderman-wolf-b45-reference.json`): spawn rolls and herds, seven foods on tame, wild and foal horses, and horse, donkey and mule breeding in both orders. Also a hurt parent, a wild partner, a second breed after the cooldown, and foal growth. Fixes:
  - Golden food sets love at age 0.
  - A wild horse rears at food it does not use, and the stack is kept.
  - The foal's max health is the plain mean of both parents and the roll.
  - Mating checks that the partner is in love.
  - Foals grow a little every tick, and the horse box is the float 1.4 x 1.6.
  - The rear sound draws on the horse's own random.
- **Creepers and witches.** 77 executed records replay exactly (`enderman-wolf-b45cw-reference.json`): fuses, flint and steel, lightning, power 3 and 6, mobGriefing, difficulty, damage and knockback, drops, a skeleton-arrow kill, potion choice and throws, self drinking and witch drops. Fixes:
  - A creeper's explosion runs inside its own update.
  - The player's blast push uses the 1.62F eye height.
  - The ignite pitch draws on the creeper's random.
  - The witch's drink timer ends one update later.
  - A thrown witch potion makes the constructor's three gaussians before the aim. Every throw velocity was wrong without them.
  - A dead witch still rolls its drinks.
- **Small mob fixes.** Ocelots sitting on a chest and on a lit furnace are recorded, and the port already matched. A piston-pushed mob lands before its step sound; this follows the same `Entity.moveEntity` order as the executed walking records, and no piston push itself is recorded. The blaze strafe yaw uses the float pi, which removes the golem layout drift, and layout 4517 is recorded.
- **More of the entity list.** Explosions attack and push minecarts and boats (they break above 40 damage, and the drop joins the list at once), and push witch potions and golem snowballs. Thrown balls hit paintings and item frames. Cart and boat pushes on a mob run inside the mob's own update. `Boats.collide` takes a float square root. 20 new executed `EntityListProbe` scenarios, 49 in total.
- **Item atlas and cactus icon.** Item sprites are cells of one atlas laid out by the executed Stitcher (256x256, 212 sprites, 0.01 px inset) in the hand, on the ground, in frames, on mobs, under the glint and on projectiles. The cactus inventory icon uses the executed render type 13 quads.
- **Model faces and held poses.** The bottom face of every model box had its texture rows reversed. It is fixed in `skinBox` for every model, from the executed ModelBox quads (`model-faces-reference.json`). Third-person held items follow the executed renderers (`held-pose-reference.json`): fishing rods and carrots on a stick get their extra turn, and a cast rod is a stick in the third-person hand.
- **Away run edges and order.** An entity next to a natively loaded column that the run has no copy of is held, so it does not walk into air. This uses an 8-block bound chosen for the port. Items, orbs, TNT, thrown entities, arrows, falling blocks, potions, golem balls, skulls and knots tick in one join-ordered walk with the mobs, as in the live world.
- **Fire effects re-audit.** Punching out fire in Creative plays two fizzes, the client's own and the server packet's, and Survival plays one (javap of `ItemInWorldManager.onBlockClicked`). An item's lava fizz plays at posY. Re-read and matching: the water, in-wall and fire overlays, flint and steel, the orb fizz and fire on burning entities ([fire-fx.md](fire-fx.md)).

Still open from batch 45 (items closed in batches 46 and 64 removed):
- Tracker and client:
  - The tracker walks the live list. Native walks a HashSet in entity id order.
  - The dragon's client crystal search and its living-sound emission are not modelled.
  - A ridden pig's client copy follows the live pig. Natively it is packet-driven and the rider sits on it, so the seat and camera would have to move to the client copy too. A ridden horse's client steering is not ported, and boat and cart rider copies are not examined.
  - The angler end of the line has no native replay.
- Rendering:
  - An HD pack scales the terrain atlas's 16 px cells (the item and block-item sheets re-stitch since batch 64).
  - Block-atlas items are not item atlas cells.
  - The water overlay tint is not pixel-compared.
- Away:
  - The 8-block edge hold is a port bound.
  - The death screen after a shadow kill shows on return.
- Multiplayer (unchanged from batch 44):
  - Nothing applies the S1D effect on the client.
  - There are no other server windows.
  - Saves imported at 16/17 keep the quiet neighbour callbacks.

## Done in batch 44

Batch 44 covered these areas:
- **Passive mobs on their own random.** Cows, mooshrooms, pigs, horses, ocelots, both golems, witches and creepers draw every AI task on `Entity.rand`, with the 1.7.10 task lists (bytecode-read constructors). 52 executed records replay exactly: idle, panic, tempt, breeding with wheat or carrots, wolf taming, feeding and mating, ocelot taming, avoid and sit, golems, witch and creeper. They forced these fixes:
  - A parent's age is 5999 after the mating tick.
  - A rearing or eating horse does not move.
  - The ocelot's sprint boost, its sphere avoid check and its degree tempt check.
  - Landing sounds before the step sound ([wolf.md](wolf.md)).
- **The rest of the entities in the one list.** Minecarts, boats, paintings, item frames, leash knots, witch potions, snow golem snowballs and wither skulls run in the `World.updateEntities` walk:
  - A rider updates through its mount, and hanging entities do their surface check in place.
  - Thrown balls and skulls move once after impact.
  - Potions and snowballs hit carts and boats, and carts and boats block each other.
  - 28 of 29 executed records replay exactly.
- **Multiplayer screens.** The client opens the sign editor after placing a sign and sends the lines. Beacons open a real server window (`ContainerBeacon`) with the payment slot. The held-item stand-in is gone ([multiplayer.md](multiplayer.md)).
- **Dedicated world.**
  - Beacons apply their effects every 80 ticks through the singleplayer `tickBeacons`, and grants go out as an S1D effect message.
  - The beacon sky check uses `canSeeSky`, so glass no longer blocks it.
  - A hopper waiting on a loading container gives up after 600 updates. Natively the chunk loads on demand (bytecode-read).
  - The rim piston event was found to be needed, and is now tested.
- **Held and dropped items.**
  - Flat items: they are extruded vertex for vertex like `renderItemIn2D`. Dropped sprites draw 1 to 4 copies in fancy graphics (`item-sprite-reference.json`, executed).
  - Hand models: the cactus is its inset quads in the hand, and only the native render types turn 90 degrees there.
  - Fixed faces: the chest bottom face uvs (world chests too) and the cube bottom faces. Pistons, dispensers and droppers show their item facing.
- **Client copies, continued.**
  - Arrows, snowballs, eggs, pearls, rockets and hooks emit their own client particles: impact puffs, the pearl trail, crit trails, water splashes and bubbles, rocket sparks, and the firework burst at the client rocket.
  - The fishing hook counts as in water; an old probe stub had hidden this.
  - The Ender Dragon's 64-step ring buffer and wings, and the squid's body and tentacles, are computed on the client copy.
  - Drawn mob yaw and the rod end of the fishing line come from the client copies.
  - Negative spawn angles truncate as natively (`tracker-hits-reference.json`, `tracker-mounts-reference.json`).
- **Away run.** The batch 43 lost delivery is explained. The portal sat in a column the away run had not copied, so those entities never ticked and the returning player collected them. The run now copies ring columns beyond the streamed window, raises the cap to 160 columns with work columns first, and logs entities left as saved (`outside`). Six of six trips after the fix delivered through the away run ([dimensions.md](dimensions.md)).

Still open from batch 44: carried into the batch 45 list above, except the items batch 45 closed.

## Done in batch 43

Batch 43 covered these areas:
- **More objects drawn where the client sees them.**
  - Tracked kinds: eyes of ender, firework rockets, fishing hooks and witch-thrown potions are now on the tracker, each with its own range and update rate. Their client copies run the native client behaviour.
  - Metadata: the item stack, arrow crit flag, firework item, TNT fuse and falling block id and meta now arrive through the metadata packet. Renderers read the client copy, not the live entity.
  - Knocks: items, orbs, TNT and falling blocks send a velocity update when hurt or pushed by an explosion.
  - Falling blocks: they move with step height 0 as natively, so they no longer climb half slabs. Their packet uses the native block id (9 executed scenarios, `tracker-extras-reference.json`).
- **Mounts, riders, leashes and flyers on the client.**
  - The tracker sends the attach packet for riding and leashing. Rider, mount and leash holder positions follow the client entities, and the lead is drawn between them.
  - Water and lava flags come from the client entity's own box.
  - Ghasts, squid, blazes, the Wither and bats have their own client motion. The bat's hanging flag travels as metadata. Ghasts and squid turn their bodies the legacy way (10 executed client scenarios, `tracker-mounts-reference.json`).
- **Enderman and wolf, every tick.**
  - Enderman: it runs the native `EntityCreature` wander flow, with its own pick, teleport and place draws. Its first chase teleport attempt is on the 31st chase tick.
  - Endermen pick up and place blocks again. A lookup read the block id wrongly, so the live game never found a block to carry.
  - Wolf and sheep: their AI tasks draw on the entity's own random. A wild wolf also begs for meat, and a tamed wolf's kill counts as a player kill for rare drops.
  - Replays: all 59 batch 42 records (11,270 ticks) and 17 new ones replay exactly, comparing positions, motion, yaw, sounds and every draw ([enderman.md](enderman.md), [wolf.md](wolf.md)).
- **Idle legacy mobs and corpses.**
  - Silverfish: they keep the 0.98 forward decay between ticks and age 2 extra ticks in bright light. 120 idle spider, pigman, blaze and silverfish runs then replayed exactly.
  - Seeds 4213, 4214, 4222 and 4226: the silverfish deaths at tick 0 were the replay's handling of `setDead`.
  - Corpses: a dying mob drops its strafe, and a dying blaze still hovers. The golem against a blaze matched on 168 layouts, so the batch 42 miss could not be reproduced (27 executed records with each entity's draws, [blaze-ghast.md](blaze-ghast.md)).
- **One entity list for more kinds.** Arrows, thrown entities, items, XP orbs, primed TNT and falling blocks update in one insertion-ordered walk with the mobs and fireballs, as `World.updateEntities` walks `loadedEntityList`. Executed records show the order decides which merged stack survives, which orb the player takes first and whether a blast meets an item before or after it moves (13 of 15 replay exactly, [blaze-ghast.md](blaze-ghast.md)).
- **Inventory icons and held blocks.**
  - Icons: slabs, plates, buttons, carpet, trapdoors, farmland, the dragon egg and the other non-cube items draw their executed boxes in the inventory, with the native GUI transform and GL pixel-centre edges. Flat icons use the same edge model.
  - Block item ids: ids such as the stone slab item use the block's geometry in the hand and on the ground.
  - Chests: the chest, trapped chest and ender chest items are executed through the chest model and match pixel for pixel ([post-shaders.md](post-shaders.md)).
- **Away run.**
  - Riding and leashes: mounted pairs and chains run together while all their members are inside the 32-block rule. A mob on the player's lead keeps it and runs.
  - Hanging entities: paintings and item frames use their real position for that rule.
  - Shadow kill: it drops the inventory and experience where the player was, in that dimension, and the live player dies through the usual path on return.
  - Wall stamp: a command block's output time follows the trip's measured elapsed time ([dimensions.md](dimensions.md)).
- **Tile edits in multiplayer.**
  - Cell resends: resends of fewer than 64 cells and tile edits now carry the sign, skull, spawner, beacon and flower pot descriptions with the native action ids.
  - Messages: the server has messages and native checks for editing a sign and choosing beacon effects. Placing a sign or skull makes its tile.
  - Hoppers: a hopper or hopper cart beside a column whose saved containers are still loading waits instead of picking up items ([streaming.md](streaming.md), [multiplayer.md](multiplayer.md)).

Still open from batch 43: carried into the batch 44 list above, except the items batch 44 closed.

## Done in batch 42

Batch 42 covered these areas:
- **Dropped items, orbs and projectiles drawn where the client sees them.** Items, XP orbs, arrows, snowballs, eggs, ender pearls, potions, bottles o' enchanting, falling blocks and primed TNT now go through the native `EntityTrackerEntry` with their per-type range, delay and velocity flag. They spawn on the client with the object spawn and orb spawn packets and move there as the client entity does. Renderers and shadows draw them at that position; pickups, merges and impacts stay on the server entity (executed client scenarios, [natural-spawning.md](natural-spawning.md)).
- **Enderman and wolf targets.** 58 executed records against a real server player:
  - Enderman: an enderman being stared at teleports only when its target is within 4 blocks, not 16. A mob that hits an enderman becomes its target. A creative player who hits one stays its target for that tick only.
  - Wolf: wild and tamed wolves, angry wolves, owner defence and sheep hunting matched inside the compared windows ([enderman.md](enderman.md), [wolf.md](wolf.md)).
- **Zombie wander.** The seed 4109 turn difference was the replay world's light, not the AI: the probe world is fully lit, and a wander try under the floor weighed differently in the port. Eighteen executed wander records (flat, slope, pool, sunlight, fire) replay exactly ([pathfinding.md](pathfinding.md)).
- **One entity id counter.** Mobs, minecarts, boats, paintings and item frames, and XP orbs in every dimension and in the away run share one `Entity.nextEntityID`, as natively (executed). Saved ids are kept and never repeated. While the player is away, `/xp` from a command block acts on the shadow player, and away tick n sees total time T0 + n + 1 ([dimensions.md](dimensions.md)).
- **Entity update order.** Fireballs update in one insertion-ordered walk with the mobs, as `World.updateEntities` walks `loadedEntityList`. Ghast fireballs hitting mobs are recorded. A snowball now does 3 damage to a blaze, where it did 0. The blaze crackle plays at the +0.5 offset (17 executed records, [blaze-ghast.md](blaze-ghast.md)).
- **Item shapes and block shapes, round 5.**
  - Items: the executed `renderBlockAsItem` covers 397 items. Slabs, plates, buttons, carpet, trapdoors, cake, walls and the other non-cube items draw with their native boxes and face crops in the hand and on the ground. The beacon base and the anvil item are fixed.
  - Blocks: the second render-type set matches at 320 more positions, including negative coordinates and y 0 and 255. Slabs and stairs at the bottom and top of the world now take the right light ([post-shaders.md](post-shaders.md)).
- **Atlas and cube icons.** The block atlas uses the layout of the executed 1.7.10 `Stitcher` (512x256, 349 sprites, 0.01 px uv inset) instead of a 16-column grid. Inventory cube icons are drawn with GL pixel-centre edges ([atlas-stitcher.md](atlas-stitcher.md)).
- **Ring chests and chunk resends.**
  - Chests: a ring hopper reaching a chest in a visited and evicted column waits for that column's saved containers instead of making an empty chest. The first loot lookup in an unbuilt area is built by the generation worker.
  - Resends: a resent chunk carries the sign, skull, spawner, beacon and flower pot descriptions that `PlayerInstance` sends after it (executed `getDescriptionPacket`, [streaming.md](streaming.md)).

Still open from batch 42: carried into the batch 43 list above, except the items batch 43 closed.

## Done in batch 41

Batch 41 covered these areas:
- **Duplicate mob ids after a portal trip.** A mob that came through a portal had no id and took the next number counted from 1, which could be an id a saved mob already had. Ids now start above every saved id. A unit check follows a pig, an item and an orb through a portal while their world is away and finds each once in the Nether, near the portal ([natural-spawning.md](natural-spawning.md)).
- **Fence gate item and render positions.** The fence gate is drawn with its item boxes in the inventory, the hand, the third-person hand and on the ground (bytecode-read boxes); every block in the third-person hand used to be a cube. An executed probe at 24 positions, with plant, lily pad and vine sweeps (704 fixtures), found and fixed float offsets of grass and flowers, bitten cake sides, and the vine top under glowstone, leaves, ice and TNT ([post-shaders.md](post-shaders.md)).
- **Mobs drawn where the client sees them.** The client entity now follows the tracker's position and velocity packets with the native three-step interpolation and its own drag and movement; mobs, their shadows, leads and name tags are drawn there with the partial tick, and the crosshair aims at it, as `EntityRenderer.getMouseOver` reads the client world ([natural-spawning.md](natural-spawning.md)).
- **Mob targets against a real server player.** An executed `EntityPlayerMP` probe records zombies, skeletons and spiders against survival, creative, adventure, invisible and sneaking players, at range, and spiders reaching players on pillars; the port matched every record. Stuck fireballs, blaze volleys at a mob attacker and the blaze's float distance now match executed records ([blaze-ghast.md](blaze-ghast.md)).
- **Ring chests and pistons.** A hopper or dropper reaching a chest in a never-visited chunk finds its generated loot instead of making an empty chest. An executed probe shows a piston at the edge of the loaded area makes the server load the next chunk; the port's waiting event reaches the same end state.

Still open from batch 41: carried into the batch 42 list above, except the items batch 42 closed.

## Done in batch 40

Batch 40 covered these areas:
- **Nether trips that never loaded.** A trip could stay on "Downloading terrain" for good when a mob or dropped item was in view as the player left: three's `compileAsync` shader warm-up threw inside its timer once the render loop disposed that entity's material, and its promise never settled. The warm-up now polls itself and skips disposed materials (`shader-warm.js`); scripted trips with a pig, an item and an orb in the portal went from 7 stalls in 8 to 5 loads in 5 ([loading-screens.md](loading-screens.md)).
- **Slab light.** A slab whose own cell has no light takes the light of the cell below, as `Block.getMixedBrightnessForBlock` does; an executed probe of 408 slab, stair, farmland, soul sand and other fixtures under opaque blocks, beside lights and in the dark matches every vertex. Sandstone and wood single slabs hide their sides against single slabs like stone ones ([post-shaders.md](post-shaders.md)).
- **Block shapes, round 4.** Flower pot plants (all 14 contents), bent stems, iron bars with every neighbour mask, and grass, flowers, lily pads and fire at several positions now match the executed RenderBlocks; every render type in the second probe is exact. Iron bars with a north or south arm were drawn turned 90 degrees, now fixed ([post-shaders.md](post-shaders.md)).
- **Entity tracking.** The client's view of a mob follows the native `EntityTrackerEntry`: positions in 1/32 blocks, the per-type update delay, the 4-block and 400-tick resends, and ranges clamped to the view distance. Hurt, death and other client sounds of a mob play at that client position and only while the client knows the mob; dragon wing sounds follow it too (executed tracker probe, [natural-spawning.md](natural-spawning.md)).
- **Fireballs.** 27 executed records of ghast and blaze fireballs replay exactly: flight and drag, block, entity and fireball hits, the player's punch, explosion power and fire with mobGriefing on and off, small-fireball fire and fire-immune targets, water. Blazes, silverfish and giants now turn on any living attacker; the blaze crackle is a client sound ([blaze-ghast.md](blaze-ghast.md)).

Still open from batch 40: carried into the batch 41 list above, except the items batch 41 closed.

## Done in batch 39

Batch 39 covered these areas:
- **Block shapes, round 3.** Fence gates (open, closed and lowered between walls), cobblestone walls, anvils, the End portal frame, the dragon egg, buttons, cauldrons, hoppers, cocoa, pumpkin and melon stems, brewing stands and fire now match every vertex of the executed RenderBlocks probe at AO 0, 1 and 2 (`render-shapes.js`, `render-vessels.js`). A block with a light value always takes the flat lighting path, as `renderStandardBlock` does. Wood stairs, fences and wood slabs are flammable (5/20), so fire spreads to them and draws floor flames on them. Only the flower pot's plant is unchecked ([post-shaders.md](post-shaders.md)).
- **Slime, magma cube, ghast and blaze AI.** All four run the native update with the native Random order; 33 executed records replay exactly, including positions, motion, sounds, level events and fireball launches. The blaze now runs the EntityCreature flow. Dying slimes squish, split children tick in the same pass, falls over 3 blocks send the landing dust event, and the splash volume uses the motion before the water drag ([slime.md](slime.md), [blaze-ghast.md](blaze-ghast.md)).
- **Spider climbing and kills.** 13 records of spiders and cave spiders climbing rings, roofed rings, pillars and plateaus, 7 kill records (by the player, by an iron golem, jockeys by day and night) and the two night jockey records whose knockback draws `Math.random` now replay exactly. A jump asked for in the air is taken on landing (`isJumping` persists), damage without an attacker draws its `Math.random` yaw, and a dead mount lets its rider go the same tick ([village.md](village.md), [spiders.md](spiders.md)).
- **Portals while away.** Mobs, dropped items and XP orbs of the away run travel through Overworld portals as in the live world (they leave the tick after touching the portal, with the 300-tick cooldown), and each traveller reaches the shared Teleporter at the total time of the tick it left. An executed probe pins a cart or boat that gets a rider mid-trip; the world clock through loading screens has a unit test ([loading-screens.md](loading-screens.md)).

Still open from batch 39: carried into the batch 40 list above, except the items batch 40 closed.

## Done in batch 38

Batch 38 covered these areas:
- **Panes, vines, beds, lily pads and fences.** `renderBlockPane` is ported segment by segment, and vines, beds, lily pads and fences are rewritten from the bytecode: every render type in the batch 37 probe (28656 vertices) now matches the executed RenderBlocks, and the known-gap table is empty. Fences draw every box face as natively (some invisible). The face in front of a partial block takes the neighbour's light when that neighbour is fancy leaves (`BlockLeaves.isOpaqueCube` is `!fancyGraphics`) ([post-shaders.md](post-shaders.md)).
- **Redstone rendering.** A second executed RenderBlocks probe (581 fixtures, 96960 vertices at AO 0, 1 and 2): redstone wire, levers, repeaters, comparators, pistons and piston heads, tripwire hooks and tripwire, pressure plates and the daylight sensor now match every vertex (`render-redstone.js`). Gates, walls, cauldrons, hoppers, anvils, flower pots, cocoa, stems, the End portal frame, brewing stands, the dragon egg, fire and buttons are pinned with counts ([post-shaders.md](post-shaders.md)).
- **Legacy mob AI.** Spiders, cave spiders and zombie pigmen run the native `EntityCreature.updateEntityActionState` (`legacy-creature.js`) with the native Random order: the spider hunts below brightness 0.5, forgets in light 1 in 100 and leaps at 2 to 6 blocks; a pigman has no target until angered and a player hit angers every pigman within 32 blocks; any living attacker other than the rider or mount becomes the target; cave spider poison reaches mobs. The look timer and the yaw-velocity decay shared with silverfish and giants were fixed. A despawning mount frees its rider the same tick. 27 native records, including five 450-tick spider jockeys, replay exactly ([village.md](village.md)).
- **Teleporter, round 2.** The portal search abandons the remaining rotations at a cell after one fails, as the native `continue` does, so all eight executed cache sequences replay. One Teleporter Random per world, seeded with the world seed, is shared by player and entity arrivals. A cart or boat already counting down when the player mounts it travels and leaves the player behind; a ridden one never starts. Away-run carts and boats travel at return. The save's total time advances through loading screens, as the server's does (`DerivedWorldInfo` setters are empty, bytecode-read) ([loading-screens.md](loading-screens.md)).
- **Ring tracking ranges.** A mob's status hurt and death sounds play only inside its `EntityTracker` square; explosion bursts need a player within 64 blocks (S27); firework rockets follow the 32-block loaded rule. Ring loot pickup, fireballs and wither skulls were already gated and are now tested. Particles' 16-block cull is native (`WorldServer.spawnParticle` has one caller, the fishing hook) (bytecode-read, [natural-spawning.md](natural-spawning.md)).

Still open from batch 38: carried into the batch 39 list above, except the items batch 39 closed.

## Done in batch 37

Batch 37 covered these areas:
- **Render types.** An executed probe of the unchanged RenderBlocks covers render types 1, 2, 4, 6-11, 13, 14, 18/41, 20, 23, 31 and 39 plus irregular cubes at AO off, on and smooth (354 fixtures, 28656 vertices). Crossed plants, double plants, torches, crops, ladders, rails, all stairs, doors, cactus, fluids, logs and quartz now match every vertex (position, uv, colour, light; order within a quad not compared). Fixed: doors draw every face with flat light, log, hay and quartz side uvs turn per face, fluids use raw uvs, two-sided sides, brightness without their own emission and `Material.isSolid` for corner heights, unconnected fences draw their x bars, pumpkin and workbench faces were mirrored. The six face-culling neighbourhoods (stained glass beside another colour, slabs, cake, stairs) now follow `shouldSideBeRendered` ([post-shaders.md](post-shaders.md)).
- **Riders and spider jockeys.** A mob riding a mob runs its whole update, its own move and push included, before the seat takes it (the batch 36 seed 113 drift). Spider jockeys (the 1 in 100 roll, the Hard potion roll, the skeleton's spawn rolls and per-tick draws) replay seven native records. The seed 1406 chicken was a replay world error (grass below y 0); on stone the port matches native, and five underground wanders are recorded ([village.md](village.md), [pathfinding.md](pathfinding.md)).
- **Away shadow, round 2.** The away trace carries health, food, saturation, exhaustion and effects, so `/effect` and score or level selectors see the state at firing, and the net change applies on return. Redstone ticks in a column that unloads mid-run are held instead of run against refused writes. Items, orbs, TNT, carts, boats, arrows, thrown items, potions, rockets and falling blocks follow the 32-block loaded rule each tick (bytecode-read) ([dimensions.md](dimensions.md)).
- **Portals for every entity.** Mobs, items, orbs and the player share one Teleporter cache per world and dimension, swept by the save's total time as natively. Minecarts and boats travel through portals with their contents and a 300-tick cooldown, checked against the executed `EntityMinecart.onUpdate` and `EntityBoat.onUpdate` (8 scenarios) and 8 persistent-Teleporter sequences ([loading-screens.md](loading-screens.md)).
- **Ring pistons and hoppers.** A piston at the ring rim whose line reached an unheld chunk read it as air and could lose a pushed block; its block event now waits until the column takes writes and the chunks within 14 blocks are held, and a moving piston block runs only where its column takes writes. Hopper blocks tick in ring columns, and hopper carts wait for their column's edits. Pistons, sticky retracts, a wire and repeater line, hoppers and hopper carts replay 120 ticks equal to an all-resident world ([natural-spawning.md](natural-spawning.md)).

Still open from batch 37: carried into the batch 38 list above, except the items batch 38 closed.

## Done in batch 36

Batch 36 covered these areas:
- **Path cap.** The path finder caches each search's cell tests in pooled 16x16x16 pages and keeps its points in a pooled open-addressing table keyed by the native hash, with identical results. The live cap rose from 30000 to 250000 expanded points: the largest native follow range is about 156, whose sealed flat flood expands about 55000 points, so no realistic search is truncated. A range-100 native record replays with equal point counts under the live cap; range-100 floods take about 15 ms in Node, half the earlier cost on the replay world ([pathfinding.md](pathfinding.md)).
- **Chicken jockeys and held items.** `EntityZombie.onSpawnWithEgg` is ported with its World.rand draws: a nearby chicken, a new chicken, and a new chicken refused in an unloaded chunk (the rider is never ticked and the mount keeps it). Equipment syncs at the native time; attack damage and experience use the previous equipment; a skeleton resets its combat task on every held-item write. Chickens lay and think with their own random. 20 native records, including gates and doors on slopes and villagers fleeing across storeys, replay exactly ([village.md](village.md)).
- **Light and AO arithmetic.** An executed probe of the unchanged RenderBlocks (render type 0, 168 neighbourhoods, AO off, on and smooth) gives 11160 vertices; 10776 replay byte-exact through the new `ChunkMesher.meshBlock`. Fixed: the AO-solid and corner-open block sets (leaves, ice, glowstone and the redstone block occlude), neighbour-brightness blocks no longer read the cell below (chunks, mesh regions and the away world), emitters take the flat path, the east/west corner fallback, half-slab vertices, and partial blocks interpolating top and bottom faces. AO sums, shades and tints are floats. Icons with translucent texels (ice, stained glass, panes) are composed from exact tile bytes ([post-shaders.md](post-shaders.md)).
- **Away commands, round 4.** The away run records a player trace (a sample about once a second and each state change), so the shadow player is where the player was at each firing and carries their inventory, experience and game mode. Give and clear return as one net inventory change instead of re-running on the return state. `/spawnpoint @p` uses the target's position with the native `floor(y + 0.5)`, live and away. A mid-run `/setworldspawn` unloads the old spawn area at the next autosave. Away fluids notify redstone per write, and entities tick only when every chunk within 32 blocks is loaded (bytecode-read) ([dimensions.md](dimensions.md)).
- **Travel, round 6.** The Teleporter's portal cache is kept per world and dimension, so a repeat trip within about 600 ticks goes to the cached portal without a search, and the exit prewarm builds round it. Resident chunks beside the ring-light window no longer count as able to see the sky unless one of their columns can (same answers on 3000 random cells). The speculative and worker caps measured the same within noise under load 7-10, so they are unchanged ([loading-screens.md](loading-screens.md)).

Still open from batch 36: carried into the batch 37 list above, except the items batch 37 closed.

## Done in batch 35

Batch 35 covered these areas:
- **Away commands, round 3.** A command block in the Overworld acts on the player in the Nether or End through a plain `@p`, `@a`, `@r` or name; only selectors with `r`, `rm`, `x`, `y` or `z` stay in the sender's world (bytecode-read). The away run keeps a shadow player built from the return state, so SuccessCount, LastOutput and comparators are current at fire time and later commands see earlier ones; the queue still replays on the real player at return. `/spawnpoint` with four absolute integers, `/difficulty` and `/setworldspawn` come back with the run. The live `/spawnpoint` follows the native argument rules (0, 1 or 4 arguments; `~` and decimals are number errors). Away sky light is computed under cover as chunks do. The 1200-tick idle counter is executed on the unchanged `WorldServer` ([dimensions.md](dimensions.md)).
- **Shared tick tree, round 3.** A real piston driven by a lever through `attachTickTree` keeps the standalone timeline, in a unit test and in the browser. Fluid writes notify redstone and falling blocks one by one, as each native `setBlock` does. Three executed sequences over 1000 due entries (a falling sand slab, 900 water sources, sand and gravel into water and lava) replay tick for tick after two fixes: flowing cells taken but not yet run are no longer rescheduled, and sand beside a fluid write now falls ([region-import.md](region-import.md)).
- **Mob paths.** Native search sizes are measured: a Hard zombie's follow range is (40 + bonus) x (1 + d0), about 80 to 130, and a flat range-100 search expands about 31000 points, a seven-storey tower 28000. Eight records replay with equal point counts. A mob that despawns earlier in its update still searches with its real health ([pathfinding.md](pathfinding.md)).
- **Travel, round 5.** The exit prewarm's saved-portal pick weighs height and follows the Teleporter's scan and tie order, checked against the executed Teleporter on 60 random worlds. Ring-light cells beside the resident window skip the block-light spread when no resident emitter can reach them (about 60 us to 5-7 us per query in Node, same answers) ([loading-screens.md](loading-screens.md)).
- **Atlas pixels.** Both block atlases are built from exactly decoded PNG bytes (`atlas-texels.js`), so translucent pixels no longer round through a 2D canvas; the item atlas tint is a float triple. A native probe over all 349 block textures at mipmap 0, 1 and 4 matches every level hash, and fixed an off-by-one in the mip port. Chunk vertex colours are quantised as `Tessellator.setColorOpaque_F` does (bytecode-read) ([post-shaders.md](post-shaders.md)).

Still open from batch 35: carried into the batch 36 list above, except the items batch 36 closed.

## Done in batch 34

Batch 34 covered these areas:
- **Live tick fix.** Since 0.62.0 the live tick with the shared tick tree skipped the end of the redstone tick: block events, the redstone tile-entity loop and piston pushes did not run in play. `world-tick.js` now calls `tickEnd` after hoppers and brewing, where `redstone.tick()` ran it before the tree.
- **Away commands and spawning.** While the player is in the Nether or End, commands from command blocks and command carts that act on the player are queued in firing order and replayed on return through the live command host, with the native SuccessCount and LastOutput; `/give` puts the stack in the inventory, `/tp` prints success and discards the move, `/kill` fails as from a block. Nothing spawns away natively (the Overworld player list is empty, bytecode-read), now pinned by a test. The away run ticks through the shared tick tree, and lit furnaces emit light there. In play, a selector that matches nobody at a command's username argument is silent, as natively ([dimensions.md](dimensions.md)).
- **Shared tick tree, round 2.** Redstone ticks save the shared creation id, so export order uses it for every kind. Redstone learns of fluid changes after each fluid run instead of after the whole batch. Two executed backlog scenarios (2600 and 3300 entries over six world times) replay through the tree. 14 seeds and 21 population areas hold no structure that primes TNT ([region-import.md](region-import.md)).
- **Village fights, round 6.** The native `ChunkCache` does not bound the path search (only the swimming start loop reads it; a region bound made a record diverge), so the live cap rose from 6000 to 30000 points and a sealed target at the zombie's spawn-bonus range gets the full search. A reinforcement site in an unloaded chunk is lost, not retried, and still draws the world Random. Reinforcement zombies roll their own yaw as natively. 23 new records (chunk borders, unloaded sites, cobblestone walls, nether fences, cobweb arrows and falls) replay exactly ([village.md](village.md), [pathfinding.md](pathfinding.md)).
- **Server checks, round 3.** A refused placement on the dedicated server sends the native chat and both cells to the clicker only, checked over a live WebSocket. 64 or more changed cells in one chunk go as one chunk packet (`PlayerInstance.sendChunkUpdate`); the protocol stays 2 and only a client that joins with `chunks: true` gets them. Horse, player and particle eye heights come from the real constructors (95 of 95). The weather mood player is the feet, as `EntityPlayerMP` has yOffset 0; the port passed feet + 1.62 ([multiplayer.md](multiplayer.md)).
- **Travel, round 4.** The exit prewarm reads the destination's saved portals once per trip and builds the windows round the one the Teleporter would pick within 128 blocks, so a return to a saved portal in another population cell no longer builds after the countdown (0.5-0.8 s instead of 2.6-3.1 s, measured under different machine load). The Nether shell keeps up to 36 spare columns, so a Nether portal a chunk off the target no longer waits for a second fetch (1-2 ms instead of about 250 ms). Ring-light searches skip the block-light spread when no emitter is within 14 cells in y (same answers; about 50 us to 0.55 us per surface query in Node) ([loading-screens.md](loading-screens.md)).

Still open from batch 34: carried into the batch 35 list above, except the items batch 35 closed.

## Done in batch 33

Batch 33 covered these areas:
- **Away run, round 4.** Command blocks and command minecarts run while away through the live command host. A selector the original resolves to nobody (rm, r, x, y or z) gives the silent zero, and SuccessCount and LastOutput are kept (CommandHandler and PlayerSelector, bytecode-read). Ender pearls tick and land with nobody teleported. Leash knots tick. Away mobs read block light from a lazy flood. Time, weather, game rules and chat from those commands apply on return.
- **Eye heights.** The server player's eye is the feet + 1.62 in `ai.js` and `enderman.js` (was 0.12), and mobs use height x 0.85, wolf 0.8. These come from an executed `EyeHeightProbe`. Breathing, suffocation, the witch drink check, rider water and explosions use them. Enderman and village fight records are regenerated, and a cart behind a wall is refused in the browser.
- **Shared tick tree.** Fluid, fire, falling, redstone and foreign ticks are taken from one tree in time, priority, creation order under one 1000 cap. The batch 32 `tickUpdates` records replay through it. Shared creation ids are saved, and older saves are renumbered on load. Redstone now runs inside the tree, before hoppers and brewing. Powered TNT from population callbacks becomes live primed TNT, saved and exported (tested on synthetic areas; its motion is `Math.random`).
- **Village fights, round 5.** 31 new native records on stairs, ladders, trapdoors, fence gates, lava, ice, packed ice, soul sand, cobweb and Hard reinforcements at light 9, 10 and 15. All replay. Fixed: path Y truncation, trapdoor, gate, fence and wall path classes, the converted baby zombie's box anchor, and shaped ray bounds for slabs, gates, trapdoors and walls. The live path cap is 6000 nodes, up from 1500.
- **Portal exits.** After 5 ticks in a portal (survival), the exit's window is built in the stream workers during the countdown and adopted by the trip. Overworld returns went from 1.6-2.9 s to about 0.55-0.65 s of wall time; Nether trips from 0.94-1.26 s to 0.43-0.86 s. Terrain is identical with and without the prewarm. Nether arrival windows were already on a worker.

Still open from batch 33: carried into the batch 34 list above, except the items batch 34 closed.

## Done in batch 32

Batch 32 covered these areas:
- **Away mobs.** For the first 1200 away ticks the away run also ticks mobs (with no player, despawnEntity does nothing, bytecode-read), arrows, thrown projectiles and potions, rockets, fireballs, hanging entities and spawner and hopper carts; dispensers shoot every projectile kind there. In play, dispensed fire charges and fireworks reached no host and now do.
- **Server click checks, round 2.** Every aimed entity goes through C02 with the native sight ray from the feet + 1.62 (36 seen, 9 unseen) and the attack kick; mob clicks, refused in batch 31 by a NaN position, work again. The dedicated server edit path applies C07/C08 and sends the refusal as chat. Fallen buttons drop and powered TNT primes in population callbacks (262 native records).
- **Import, round 9.** An executed `WorldServer.tickUpdates` probe: at most 1000 entries per call in time, priority, creation order; falling blocks are capped too. Foreign TileTicks age in the live world and run when the port ticks their block. Fluid, fire and falling priorities are saved. Horse chest stacks keep an unmapped `Damage`.
- **Village fights, round 4.** 22 new native records on steps, a terrace, a pool, a walled house with doors, arrow hits on stone, fence, glass and slab, and Hard reinforcements in a dark world; all 48 records replay exactly. Fixed: fdlibm `StrictMath.log` in `nextGaussian`, skeleton damage rounding, sight by `rayTraceBlocks`, long-memory attacks, path start cell, splash timing, mobs created mid-pass ticking in that pass. Arrow start headings are derived, not recorded.
- **Walking and travel.** A window shift relights in about 14 ms (21 before) with the same light; ring-light searches skip work they can prove useless (same answers); a Teleporter exit with no saved portal no longer pays a second window fetch.

Still open from batch 32: carried into the batch 33 list above, except the items batch 33 closed.

## Done in batch 31

Batch 31 covered these areas:
- **Server click checks.** The integrated server's C08 placement (under 8 blocks from the feet), C07 dig (6 from the eye) and C02 use-entity (under 6) checks run in play behind the client reach, replayed against the batch 30 NetHandlerPlayServer records; a refused click resends both cells and a click above the build limit prints the native message. Creative survival-tab drops go through the drop limiter; the dedicated server applies the chat spam gate.
- **Away entities.** For the first 1200 away ticks (re-read from WorldServer's idle counter, bytecode-read) items, xp orbs, primed TNT, minecarts on rails and boats tick in the away run; dispensers and droppers fire through them; weather timers and the clock advance for every trip's loading ticks.
- **Import, round 8.** TileTicks the port cannot run (air, unknown ids, y outside 0..255, blocks without a handler, the low border outside an area) are kept raw and written back aged against world time instead of being dropped; ThisTick tails of mid-tick saves are replayed; float `getInteger` wraps like `floor_double`.
- **Village fights, round 3.** 19 new native records (three bow skeletons, three zombies at Normal and Hard, Hard door breaking and conversion, a player fighting back, an equipment swap, a hit on a Peaceful-removed mob); all 26 records replay exactly. WatchClosest, kept combat tasks, per-mob loot pickup and converted-villager removal were fixed.
- **Ring light, round 3.** An executed rim probe (chunk-by-chunk loading through the unchanged light code, 5 records) shows the outermost loaded chunks hold vertical-only sky and no block light; the port now does the same (Overworld rim cells off by 4-29 sky, 2-24 block per chunk, down from 66-164 and 13-240).
- **Generation neighbour callbacks, round 2.** Powered doors, door falls and every power provider run in the population callbacks (pinned by 80 native door records); the quiet fallback fired 0 times over 12 seeds. Level.dat imports generate at 22/23 (16/17 plus the callbacks). The default-world jungle difference was the pre-16 biome map; the whole jungle temple area replays.
- **Walking frames.** The biome halo reaches the ring's tick radius and ring biomes are warmed ahead of ice rolls: frames over 50 ms per 120 blocks walked went from 5-7 to 0-4 at similar load. A Teleporter return to a saved portal no longer pays a second window fetch (0.8-1.35 s before).
- **Structure data export.** Generation 20 worlds (new since batch 30) and 22 imports write `data/*.dat` again.

Still open from batch 31: carried into the batch 32 list above, except the items batch 32 closed.

## Done in batch 30

Batch 30 covered these areas:
- **Village fights, round 2.** All seven recorded fights replay exactly, with bit-identical positions, health, targets and Random draws. Before this batch they diverged at ticks 114-322. The tick 114 split was a probe double, not a port bug. Also fixed: death-tick particle draws on the mob's Random, the mob bounding box kept between moves (the zombie drift), the golem lift as a double, and a skeleton's combat task following its held item. New probe records: Peaceful (hostiles tick once, then go) and villagers fleeing two zombies (WatchClosest lists corpses) ([village.md](village.md), [combat.md](combat.md)).
- **Away ticks.** While the player is in the Nether or End, the Overworld spawn-area columns that hold work run in a worker on return: scheduled ticks for the whole time, and tile entities, falling blocks and pistons for the first 1200 ticks. The Overworld clock catches up the loading-screen ticks. Native rules bytecode-read ([dimensions.md](dimensions.md)).
- **Ring light, round 2.** Chunks that are neither resident nor held count as unloaded, so rim columns are no longer lit against air. Resident edits drop the light of ring columns beside them (`World.put` -> `HeadlessColumns.edited`). An executed probe compared server and client light: block light and height maps never differ, and sky light differs only in empty sections beside pillar shadows and for one floating slab ([light-engine.md](light-engine.md)).
- **Mesh workers.** Column meshing runs in a pool of up to 3 workers with byte-identical output; single-block edits stay on the page. End shaders compile during the loading screen. End portal frames are meshed again (a shadowed method name had hidden them). Under heavy machine load, Nether trips went from 3.4-3.6 s to 1.9 s and Overworld returns from 5.5 s to 2.6-2.8 s ([loading-screens.md](loading-screens.md)).
- **Import, round 7.** An executed TileTicks probe found the native pending order (time, priority, creation) and the save box `[c*16-2, c*16+16)`; batch 29 used +18, now fixed. Comparator `OutputSignal` imports and exports. Horse chest stacks with count <= 0 are kept, as natively, and an unusable `Leash` tag round-trips unchanged ([region-import.md](region-import.md)).
- **Anaglyph, round 4.** Toggles and page loads convert the GUI ahead and commit it in one step, with no raw frames; converted PNGs are cached across reloads. The item atlas applies tints after conversion, as natively. Resource-pack icons and the profile skin are converted, and the GUI converts in legacy mode ([post-shaders.md](post-shaders.md)).
- **Generation neighbour callbacks.** New streamed worlds are generation 20. Population runs the door, redstone, tripwire, button, plate and dispenser neighbour callbacks call-for-call against the unchanged areas: 44 flat, 6 temple and 9 default-world areas, village door chains included. Generation 15-19 saves are unchanged ([superflat.md](superflat.md), [scattered-features.md](scattered-features.md)).
- **Server handlers.** An executed NetHandlerPlayServer probe covered MC|BEdit and MC|BSign (41 cases, already matching), the Creative drop limiter (+20, refused at 200, now ported), the chat spam kick (single-player owner without cheats is not exempt, now ported, along with the 100-character cut and illegal-character kick), and the held-slot, sign, placement, digging and use-entity checks. Creative reach was swapped; it is now 5 for blocks and 6 for entities ([books.md](books.md)).

Still open from batch 30: carried into the batch 31 list above, except the items batch 31 closed.

## Done in batch 29

Batch 29 covered these areas:
- **Anaglyph, round 3.** The DOM GUI (stylesheet sprites, inline styles, `<img>` icons, canvas screens and the paperdoll, horse, enchanting book and panorama contexts) is converted with the native formula through an exact PNG codec; the hashes match the unchanged `bqi.a(int[])` over 263 jar textures. The toggle works on the title screen. The chunk-update skip needs occlusion queries and Advanced OpenGL, which the port lacks, so it is unobservable ([post-shaders.md](post-shaders.md)).
- **Text, round 3.** Bidi follows ICU 51 across paragraphs (0 differences in about 1.1M fuzzed strings). Visible §k signs and the sign editor re-pick every frame. The Language screen sets the bidi flag for ar_SA and he_IL ([languages.md](languages.md)).
- **Mob AI.** Mob-on-mob revenge targets (golem, skeleton arrow, zombie call for help), EntityAITasks start-after-evaluation order, no age gate on the despawn check, EntityMob light ageing, skeleton task order and Random. Five native village fights replay exactly to ticks 114-322 (before: tick 0) ([village.md](village.md), [combat.md](combat.md)).
- **Dimension rules, round 2.** Overworld weather timers, strengths and `worldRandom` keep running while the player is in the Nether or End. Nether/End sapling and leaf ticks were probed and already matched. World import keeps the `simulation` streams ([dimensions.md](dimensions.md)).
- **Leads, round 3.** A leashed mob's death keeps the lead on the corpse as natively; an unusable `Leash` tag drops the lead item; the arrival lead item gets random motion; mob riders on untamed horses; horse armour and saddle slots take 64; the Creative drop bounds (1..64, damage >= 0).
- **Import, round 6.** Saved TileTicks (fluid, fire, falling and redstone, with repeater delay and priority) import and export, with border copies as natively; export prefers the stored exact cell ([region-import.md](region-import.md)).
- **Ring light.** Held ring columns with eight neighbours present are lit whole with the volume's fixed point; height and precipitation maps are cached per column; `canLightningStrikeAt` returns early when dry ([light-engine.md](light-engine.md), [natural-spawning.md](natural-spawning.md) round 10).
- **Trip speed, round 2.** The Overworld spawn cell is built while the player is away, loading slices pause with a task instead of two frames, and ring workers end once the ring is full (4 workers to 1). Overworld return from the End 2.8-3.3 s to 1.1-1.4 s, from the Nether 3.8-4.6 s to 2.2-2.6 s ([loading-screens.md](loading-screens.md)).

Still open from batch 29:
- Bidi and §k have no pixel comparison against native frames; §k signs are re-picked only when visible (16 per frame), unseeded.
- Decaying-leaf drops in the Nether/End are unprobed; ring worker thread memory is unmeasured.

## Done in batch 28

Batch 28 covered these areas:
- **Anaglyph, round 2.** Block colour multipliers (biome tints, stems) are converted in the mesher at the native RenderBlocks sites; water, vines, lily pads and redstone wire stay raw as natively. The sunrise fan centre is converted. Toggling remeshes every chunk ([post-shaders.md](post-shaders.md)).
- **Villages.** Reputation is name-ordered like the native TreeMap. Killing a village iron golem (not player-made) costs 5 reputation. A scripted village fight is probed and its village layer replayed ([village.md](village.md)).
- **Dimension rules.** The End has no sky and an actual height of 128 everywhere, not only in the light engine; `hasNoSky` and `isHellWorld` now carry the native names and meanings. The Nether and End use their own Random stream (`simulation`). Nether and End mushroom ticks were probed and already matched.
- **Text.** Bidi handles later strong-less paragraphs as ICU 51 does. §k picks from all 256 cells with the native random stream, and DOM text re-picks every frame. The § colour table follows the anaglyph option at startup ([languages.md](languages.md)).
- **Leads and size 0 stacks on mobs.** A lead held by another mob works live, on Java import and on export. Tamed wolves and ocelots refuse a non-owner's lead. Feeding, dyeing and wild-horse clicks with size 0 or less stacks match 2700 probe records; horse owner checks were probed and already matched.
- **Negative stacks, round 3.** `/give` drops the whole stack at the player with pickup delay 0 and the player as owner. Dispensers and droppers fire from negative slots. The drop key keeps refusing only an exact size 0. Furnace, brewing and hopper ticks were probed (8100 records) and already matched ([combat.md](combat.md)).
- **Import, round 5.** Nether and End chunks with TerrainPopulated=false are populated at import (406 native populate calls). Stored cells keep level-0 flowing fluid, hardened lava levels and chest facing through an `orig` overlay. Populate-time animals, villagers, flower pots and fire and falling-block ticks are kept. Imported furnaces keep their saved lit state ([region-import.md](region-import.md)).
- **Dimension trip speed.** Nether and End columns and the headless ring are built in workers, and the arrival warm-up is shared over up to three workers. Nether long tasks over 50 ms fell from about 53 to 1-4 in the first 50 s; the Nether ring fills in 8-10 s instead of 44 s ([loading-screens.md](loading-screens.md)).

Still open from batch 28 (the anaglyph GUI and chunk skip, bidi embedding codes, §k signs, the village fight targets, Nether/End tree ticks, the import `simulation` stream, leashed mob death, the unusable Leash tag, the Creative drop filter, TileTicks and the overlay on export were done in batch 29):
- Several named village players are model-only. Hopper negative-stack coverage is one layout per scenario. `/give` motion matches within 1e-4.
- The Nether populate RNG and the End per-chunk seed are modelled (natively provider-history and time dependent).

## Done in batch 27

Batch 27 covered these areas:
- **Negative stacks, round 2.** Picking up a -n stack, and -n items kept in armour slots, are native. -n stacks drop on death and on dropOneItem. Name tags are no longer used up in Creative. The 362 records are in [combat.md](combat.md).
- **Mob attributes.** Owners are checked by UUID. The fixed-damage mobs, hit amounts and speed bases are simulated ([attributes3.md](attributes3.md)).
- **Text.** The FontRenderer bidi port (ICU4J 51 replay, [languages.md](languages.md)), and §n/§m/§o on unicode pages.
- **Nether and End ticks.** Random and scheduled ticks run in both, with ring mood sounds and the Nether melt and fluid rules ([natural-spawning.md](natural-spawning.md) round 9).
- **Light.** The native light engine runs in the Nether and End and at the window ring. Edits replay after the window moves. A `world.set` without `updateBlock` now feeds the light ([light-engine.md](light-engine.md)).
- **Import.** Imported Overworld chunks with TerrainPopulated=false are populated at import with the native rule. Portal search and `/spreadplayers` read the stored-column index. The runtime list caps were raised to 1<<20 ([region-import.md](region-import.md)).
- **Atlas and anaglyph.** GPU sub-rect atlas uploads. Anaglyph colours are now converted at texture upload and in the fog, sky and cloud colours, as natively ([post-shaders.md](post-shaders.md), [resource-packs.md](resource-packs.md)).

Still open from batch 27 (the /give drop, End sky and height, Nether/End import population, stored fluids and chest facing, populate-time animals, furnace lit state, the separate Nether Random, mushroom ticks, anaglyph tints and sunrise, the font table, and the lead/horse/container probes were done in batch 28):
- Anaglyph overlay pixels were not compared with native frames.
- One light volume serves both server light and client relight, which are separate natively.

## Done in batch 22

Native GuiContainer screens for every container and the book ([container-screens.md](container-screens.md)); F3+B hitboxes, F3+S/T, F3+C and the overlay under open GUIs ([debug-screen.md](debug-screen.md)); sliced light builds, GuiDownloadTerrain and sliced work on portal and dimension trips, and worker presolve for generation 13-17 saves ([loading-screens.md](loading-screens.md)); a skeleton's arrow on a villager, the player as a zombie's target through a door and size-0 broken player armour ([village.md](village.md), [combat.md](combat.md)); and ticking ring mobs with edits applied in ring columns ([natural-spawning.md](natural-spawning.md)).

## Done in batch 21

The worker-built resident window and sliced meshing for new worlds with GuiDownloadTerrain and the bonus chest at creation ([loading-screens.md](loading-screens.md)); GuiGameOver, its quit question and the sign editor chrome on the glyph font ([modal-dialogs.md](modal-dialogs.md)); natural spawning over the whole 15x15 set through headless ring columns ([natural-spawning.md](natural-spawning.md)); owner and leash UUID links and full Attributes lists in Java interchange ([region-import.md](region-import.md)); Thorns wear with Unbreaking and team-formatted death names ([combat.md](combat.md)); the native F3 debug text and Shift+F3 pie ([debug-screen.md](debug-screen.md)); the first-person fire, underwater and in-block overlays and the fizz sounds ([fire-fx.md](fire-fx.md)); and the removal of the port's non-native hint toasts.

## Done in batch 20

Native-style LoadingScreenRenderer "Loading world"/"Building terrain" and GuiErrorScreen for title-screen starts, with the spawn walk in a worker ([loading-screens.md](loading-screens.md)); moving piston blocks collide and push every entity system with `moveEntity` (49 native scenarios, [piston-live.md](piston-live.md)); Thorns both ways, falling-block damage sources, wolf revenge for any living attacker, pearl and rider fall sites ([combat.md](combat.md)); a native light propagation audit with the port's LightVolume equal after every probed edit ([light-engine.md](light-engine.md)); entity UUIDs, any-mount Player.Riding import, leader Attributes modifiers and replayed spider jockey gear ([region-import.md](region-import.md)); minecart moving sounds with the imported clips and the S29 range filter ([sound.md](sound.md)); the full village aggressor list and a replayed zombie door attack ([village.md](village.md)); and the GuiSelectWorld extras row, Taking Inventory toast wrap, a bitmap GuiCommandBlock and the book arrow hover.

## Done in batch 19

CombatTracker death messages for falls, drowning, fire, lava, cactus, lightning and wither with `.player`/`.item` forms (`combat.md`), sign text through the FontRenderer glyph pages (`signs.md`), a probed zombie door walk and pigman CanBreakDoors (`village.md`, `mob-riding.md`), light-grid plant survival, mushroom spread, seeded drop streams and the moving-piston box (`block-behaviour-audit.md`), the native createSpawnPosition walk and spawn fuzz for new worlds as generations 18/19 (`world-spawn.md`), the interpolated sneak-aware listener and SoundManager bookkeeping (`sound.md`), lit-area and real-fortress spawning replays (`natural-spawning.md`), and regenerated parity catalogues with a consistency test (`*-parity-catalogue.md`).

## Done in batch 18

Bitmap-font item, container and HUD text with translated entity names and attacker deaths (`languages.md`), a native box/neighbour/tick sweep of 132 more block classes (`block-behaviour-audit.md`), boats/falling blocks/potions on tripwires and probed MoveThroughVillage (`scattered-features.md`, `village.md`), animated mob/third-person held items and pack compass/clock frames (`resource-packs.md`), the probed GuiScreenBook (`books.md`), the replayed flat populate and MapFeatures-off generation 17 (`superflat.md`, `level-dat.md`), paulscode falloff and channels (`sound.md`), and seeded slime/ocelot/horse/Nether/End spawning replays (`natural-spawning.md`).

## Done in batch 17

Translated firework, creative tab, horse, beacon, trade and boss bar text (`languages.md`), block atlas mcmeta animation and animated drops and frames (`resource-packs.md`), probed wither targeting, particles and model (`wither-boss.md`), the full block light table and audit column replays with the powered repeater's light (`block-behaviour-audit.md`), tripwire shears/ticks/entity sensing and jungle temple NBT (`scattered-features.md`), villager particles, reputation, golem reach and indoors gate (`villager-trading-live.md`), forced-slot and structures-on decoration replays with lily pad rotation (`biome-decoration-audit.md`), and the player's mount in level.dat, summon offsets and hanging directions (`region-import.md`, `commands.md`).

## Done in batch 16

Translated item, block and container names (`languages.md`), item atlas animation, F2 HUD screenshots and options.txt import/export (`resource-packs.md`), native dragon hit gates (`dragon.md`), fortress structure NBT and `Fortress.dat`, witch hut NBT state, whole-save bases in JSON export (`structure-nbt.md`), spawner `Riding` chains and the pigman chicken jockey, `/summon` hanging entities, the PlayerSelector port, a 38-block native audit with fixes (`block-behaviour-audit.md`), and the per-biome decoration replay with the native mutated-biome rule as streamed generation 16 (`biome-decoration-audit.md`).

## Done in batch 15

Boat and vehicle `Riding` chains in region export/import (`region-import.md`), whole Java save import into stored columns (`region-import.md`), dragon part hit boxes and the wither effect on mobs (`dragon.md`, `wither-boss.md`), in-place resource pack refresh, `.png.mcmeta` animation, pack sounds, HD chests and colormaps (`resource-packs.md`), per-position biome tint and per-column precipitation (`biome-colors.md`), villager trade items and iron golem details (`villager-trading-live.md`), languages and the unicode font (`languages.md`), and live tripwire temple traps (`scattered-features.md`). Each doc lists what is still open.

## Done in batch 14

The Resource Packs screen and pack loading (`resource-packs.md`), Super Secret Settings shaders and 3D Anaglyph (`post-shaders.md`), standable boats, mob passengers on boats and carts, the boat shadow (`boats.md`), hardcore mode and the in-browser Java save-folder import (`hardcore.md`), and the natural spawning cap, cadence, spawn point, witch hut lookup and portal pigmen fixes (`natural-spawning.md`). The rows below say what is still partial.

## Done in batch 13

Music, records and cave ambience (`music.md`), level.dat, player and stats import with paintings, item frames and minecarts in region import (`level-dat.md`), key rebinding, options.txt, F1/F3 and Max Framerate (`controls.md`), natural spawning through one SpawnerAnimals port with the 1.7.10 biome spawn lists (`natural-spawning.md`), /tellraw chat components, /achievement, /spreadplayers, /debug and /scoreboard (`commands-b13.md`), and the glazed-leaf fix: cutout materials write opaque alpha and the mip transparency flag checks only the first `levels + 1` texels (`render-settings.md`). The rows below say what is still partial.

## Done in batch 12

Book and Quill/Written Book (`books.md`), Pumpkin Pie, Enchanted Golden Apple and monster eggs 97:3-5 (`food-items.md`), Chat Settings, the Tab list and F2 (`chat-options.md`), Superflat and the bonus chest (`superflat.md`), and the spawner minecart with wider `/summon` coverage and `Riding` mounts (`spawner-cart.md`). The rows below say what is still partial.

## Done in batch 11

Statistics (`stats.md`), Graphics/Smooth Lighting/Clouds/Mipmap/Anisotropic settings (`render-settings.md`), void fog (`void-fog.md`), the Giant (`giant.md`) and rider save/portal/fall work (`mob-riding.md`) were merged after this list was written; their remaining limits are in those docs.

## Priority 1: visible, commonly hit

### Items and blocks
1. Book and Quill, Written Book and the book screen (items 386, 387; GuiScreenBook). Mostly done: items, recipe, cloning, tags, NBT and the edit/sign screen are probed against the unchanged GuiScreenBook (page wrap, indicator, cursor, keys, limits, paste, sign flow, buttons, sent stacks, real glyph widths; [books.md](books.md)); the author is the fixed local player "Player"; the page-arrow hover offset follows the bytecode since batch 20; remaining: bidi and the MC|BEdit/MC|BSign server handlers are bytecode-read, no pixel render comparison.
2. Pumpkin Pie (item 400). Done; see [food-items.md](food-items.md).
3. Enchanted Golden Apple (322:1). Done; see [food-items.md](food-items.md). 1.7.10 has no Overpowered achievement.
4. Mossy, cracked and chiseled monster eggs (97:3, 97:4, 97:5). Done; see [food-items.md](food-items.md).
5. Filled map and fireworks items are technical-only rows: see `item-parity-catalogue.md`.

### GUI and settings
6. Chat Settings screen (ScreenChatOptions): Partial. All nine options persist and apply, Show Cape is disabled (see `chat-options.md`). Since batch 13, /tellraw ClickEvents (open_url behind the Chat Links Prompt, run_command, suggest_command) produce clickable links ([commands-b13.md](commands-b13.md)); plain text is not auto-linked, as in vanilla 1.7.10.
7. Player list (Tab). Partial: native layout. It is shown while Open to LAN (native hides it for a lone host) or, as natively, when a list-slot scoreboard objective exists. With that objective it draws the score column and team-formatted name ([commands-b13.md](commands-b13.md)). There are no other players.
8. F2 screenshot. Mostly done: the PNG now includes the HUD, chat and any open GUI (DOM rasterised over the canvas frame, `screenshot-compose.js`, browser-checked on the title screen; an in-world HUD capture was not exercised), with the native name and chat message. Differences: the capture is a few milliseconds after the frame. Batch 17 creates the title panorama context with `preserveDrawingBuffer` so it is no longer blank in the image (not yet browser-checked). F1 hides the GUI ([controls.md](controls.md)).
9. Resource Packs screen and pack loading. Partial: GuiScreenResourcePacks lists, arrows, zip/folder packs in IndexedDB, options.txt `resourcePacks`, texture/sound/lang overrides through a service worker, in-place refresh without a page reload, `.png.mcmeta` animation for water/lava/portal/fire (probed against the original classes; no `interpolate` in 1.7.10), `sounds.json`, HD chest scaling, grass/foliage colormap overrides and a non-native delete control. Batch 16 adds animated item icons and held items (probed frame logic, browser-checked on icons), and hooks the clouds, title panorama, fonts, sign editor and texture clones into the refresh (browser-checked with a generated pack). Batch 17 animates every block atlas tile with a `.png.mcmeta` strip (only changed tiles and their mip chains are redrawn; vanilla 1.7.10 animates only water, lava, portal and fire) and dropped items and item frames follow animated item icons. Batch 18: mob and third-person held items follow animated icons (rebuilt on a frame change), compass/clock take their frame count from the pack strip and mcmeta (probed with 1-128 frame lists), framed compasses use the frame's own angle, and the native loading overlay was bytecode-read to be absent (none shown). GPU sub-rect atlas upload is in since batch 27. Still open: browser verification of the compass/clock pack paths ([resource-packs.md](resource-packs.md)).
10. Key rebinding and options.txt. Partial: every KeyBinding can be rebound on the Controls screen, including mouse buttons, with conflict highlighting and Reset/Reset Keys. A native-format options.txt mirror is kept in localStorage, and a clearly non-native Import/Export pair on the Controls screen reads and downloads it. The mapping from browser keys to LWJGL codes assumes a US layout, and browser-reserved shortcuts cannot all be captured ([controls.md](controls.md)).
11. Superflat world type and its customization screens. Partial: generator, presets, Customize/Presets screens, level.dat export and import, and ChunkProviderFlat.populate (44 native areas, structures, lakes, dungeons, decoration, mapFeatures on/off) are in ([superflat.md](superflat.md)); Add/Edit Layer are hidden as in 1.7.10; live-world door/redstone/tripwire neighbour reads and jungle-temple updater writes are not replayed.
12. Bonus chest (WorldGeneratorBonusChest). Partial: contents and placement replayed against the jar ([superflat.md](superflat.md)); the game uses an unseeded Random like World.rand (native contents differ per creation); torches take the BlockTorch.onBlockAdded orientation since batch 20 (bytecode-read neighbour order); the chest is placed on first world open rather than inside world creation.
13. Super Secret Settings shaders and 3D Anaglyph: Partial. The 22 post chains, the Options button cycle with its random sound, F4 deactivate and a red/cyan two-pass anaglyph are in ([post-shaders.md](post-shaders.md)); since batch 27 anaglyph colours are converted at texture upload and in the fog, sky and cloud colours (vertex colours, the font table and sunrise colours are not), and no pixel comparison was made. Max Framerate and Use VSync: Partial, because frames cannot exceed the display refresh rate ([controls.md](controls.md)).

### Audio
14. Music and music discs/jukebox record audio. Partial: MusicTicker with the seven MusicTypes, the Music slider, pause/stop rules and positional records (volume 4, 64 blocks) are in ([music.md](music.md)); the paulscode LINEAR gain, 28 + 4 channel takeover, interpolated sneak-aware listener, distance delay, isSoundPlaying's 20-tick rule and the update pass are probe-replayed ([sound.md](sound.md)); minecart moving sounds play the imported `minecart.base`/`minecart.inside` clips since batch 20 (loop in Web Audio; carts outside the client tracking range also sound), and positioned world sounds outside the S29 broadcast range are dropped (wired by event name). The 41 streams are not in Git (`npm run music:fetch`); without them music and records are silent. OpenAL Soft's mono panning law (azimuth/90) is an assumption and stream start timing is not modelled (the JAR has no paulscode streaming configuration).
15. Cave ambience (`ambient.cave.cave`). Done for the World mood sound including World.C's light-check Random draws, probe-replayed ([music.md](music.md), [sound.md](sound.md)); 13 clips shipped. Other World Random draws between ticks are not in the stream.

## Priority 2: entities and AI
- Spawner minecart (MinecartSpawner): implemented, see `spawner-cart.md`; Java region import of carts is in (batch 13); `SpawnData` Riding chains are probe-replayed since batch 16; batch 17 probes the `onSpawnWithEgg` SpawnData-absent path (no change needed) and gives summoned carts the native 0.35 yOffset.
- Natural spawning: Partial. findChunksForSpawning is probed (batches 13-19: biome lists, caps, HashMap order, group data, cadence, Nether/End lists, and seeded slime, ocelot, horse, Nether and End replays; slime size and horse foals draw from the seeded entity Random in native order); every resident chunk of the 15x15 non-edge set is eligible (`natural-spawning.md`). Batch 19 replays lit day/night/thunder light rolls and a Nether over the real MapGenNetherBridge boxes (fixing the anchored shrunk box of babies rolled at spawn). Batch 21 holds the chunks outside the 8x8 window as headless ring columns so the whole 15x15 set spawns (a spider jockey's skeleton gear is replayed since batch 20). Batch 22 ticks ring mobs with the normal AI, despawn and hazards and applies player edits in ring columns. Remaining: projectiles, items, xp orbs, falling blocks, redstone and fluids tick only in the resident window; ring edits get no mesh until resident (batch 27 replays their light when the window moves, and the Nether and End now take random ticks); events from out-of-window mobs other than explosions are dropped; Nether/End rings take about 30 s to fill (Overworld 10-20 s), worlds without a Worker at generation 13+ have no ring.
- Boats: standable and collidable (batch 14 native records), with the ItemBoat entity line of sight, mob passengers and the 0.5 shadow; remaining gaps in `boats.md`.
- Fireballs and thrown potions: both persist in browser saves (`fireballs`, `thrownPotions`) and in Java region export/import (`java-projectiles.js`, 31 native records in `projectile-nbt.md`). EntityFireball saves only `direction`, the tile fields and (large) `ExplosionPower`; acceleration, owner and any life counter are not native NBT, so an imported ball flies on its motion.
- Wither: batch 15 probes the wither effect on mobs, skull impact by difficulty and the shooter heal; batch 17 probes head target selection (chunk entity query, selector, line of sight, timers), head particles with both Randoms and the ModelWither boxes and per-part pose (`wither-targets-reference.json`, `wither-model-reference.json`); open: the slice/chunk re-append order for moved entities, and the armour-pass GL state and skull model orientation are bytecode-read (`wither-boss.md`).
- Ender Dragon: batch 15 routes projectiles and explosions to the individual parts and uses the native wing-sound sequence; batch 16 probed ModelDragon boxes/poses (two port bugs fixed) and the part sweep gate; the hurt pass alpha is bytecode-read only (`dragon.md`).
- Villager: Partial; see the entity catalogue gap text. Region NBT import/export verified (`riding-nbt-reference.json`). Batches 15 and 17: trade items map, golem sounds/retargeting/rose, status 12/13/14 particles (client Random draws), +5 default reputation, MoveIndoors biome/hasNoSky gate and the golem's nearbyOnly path check are probed and ported (`villager-polish-reference.json`); batch 18 probes MoveThroughVillage (visited doors by coordinates, navigator door flag, nocturnal gate; `mob-doors-reference.json`) and the golem's reach check no longer shares the navigator budget; batch 19 probes a zombie's full door walk (pathing, door collision, EntityAIBreakDoor, entity Random draws, 18 native walks of 380 ticks; the zombie AI now draws from its own Random) and stores/exports pigman CanBreakDoors (no AI task runs on a pigman natively); batch 20 makes every living attacker of a villager a village aggressor (native 300-tick expiry, dead/removed removal, nearest search; 9 native scenarios) and replays a zombie attacking a villager behind a door (10 native records); leader zombie/pigman health bonuses are stored as Attributes modifiers; batch 22 replays a skeleton's arrow making the skeleton an aggressor (52 records) and the player as a zombie's target through a door (11 records); batch 27 simulates the mob movement speed and attack damage bases; remaining: a moving player fighting back, several zombies or shooters, and the player is still the only reputation holder.
- Riders: region chains are saved since batch 11; `/summon` with a `Riding` tag mounts mob on mob; mobs on carts and boats are kept by pickup, `/summon` and browser saves (batch 14); region export/import of those chains is in (batch 15). Batch 17: the player's own boat, cart, pig or horse is probed (`player-riding-reference.json`), exported as `Player.Riding` and remounted on import; batch 20 writes UUIDMost/UUIDLeast for every exported entity (stored for mobs, boats and carts) and remounts every cart variant and every importable adult mob except chicken, dragon, wither and crystal; batch 21 links OwnerUUID and Leash to the exported player and writes the native Attributes list for every living class; batch 27 probes foreign owners, hit amounts, speed bases and steering (attributes3.md); open: a lead held by another mob, unprobed horse owner checks, knot leashes carry no holder UUID.

## Priority 3: commands
- Batch 13 implemented /tellraw (chat components with click/hover), /achievement, /spreadplayers, /debug and /scoreboard. See [commands-b13.md](commands-b13.md). No registered command reports itself unavailable now. What is still Partial:
  - The scoreboard criteria completion order: batch 16 replays all 803 positions from the jar's own StatList order through a Java HashMap model (probe-recorded `statOrder`). The shipped default matches 700+ positions; the craftItem run is identity-hash dependent and differs per JVM run, so it stays approximate.
  - Stat criteria granularity: they follow the port's stat call sites.
  - belowName, friendlyfire and seeFriendlyInvisibles are stored only, because there is no other player.
  - /debug sections are browser tick phases.
- Selectors (@p/@a/@r) operate over the single local player only (`src/command-selector.js`). Batch 16 ported PlayerSelector faithfully: the token regex, the positional-then-key=value parser, the score map, the defaults and parseIntWithDefault are probe-replayed (`selector-reference.json`, 201 records); the findPlayers filter loop (case-insensitive name/team with `!`, float radius over block coordinates with int-overflowing squares, r<=0 unlimited, m, lm/l, score_*, @r count) is bytecode-read, not probed, because it needs a live server. @e does not exist in 1.7.10 and @f never selects. Not modelled: the score-argument HashMap iteration order (only matters for the score-creation side effect), dimension matching.
- /summon covers 55 of the 57 EntityList registrations (Mob and Monster are abstract and fail natively); Painting, ItemFrame and LeashKnot since batch 16. Batch 17 (`summon-reference.json`): any byte Direction is accepted as natively and summoned knots are clickable. Open: summoned knots share tile (0,0,0) as natively, native item frame rendering with a bad Direction is not probed.
- mobGriefing: all 11 native read sites are wired and tested (batch 16; the site scan is `game-rules-reference.json`), Partial only for the unprobed behaviour around each site; doMobSpawning gates the SpawnerAnimals port and, since batch 14, the live Overworld portal pigman (`BlockPortal.updateTick`, probe-replayed roll; the second entity on one probe spawn was a baby pigman's chicken jockey, now modelled: `EntityPigZombie.onSpawnWithEgg` keeps the child roll and the chicken roll and resets only the villager flag, probed over 80000 spawns in `pigman-jockey-reference.json`).

## Priority 4: world generation, structures, dimensions
- Nether Fortress: batch 16 puts all 15 `Ne*` pieces and the `Fortress` start in the structure NBT and writes/reads `data/Fortress.dat` (probed: `fortress-nbt-reference.json`, 16 driver worlds, 8 populations, byte-equal to the native writer and native reload). Bytecode-read only: Fortress.dat lives in the root `data/` because MapStorage is shared across dimensions, and the Seed/Chest/Mob field meanings. Exported starts are in created state; native probe flaked once on a reload (fortress-6), four reruns identical, cause unknown.
- Desert/jungle temples and witch huts: Partial in `structure-parity-catalogue.md`. The jungle tripwire traps, lever puzzle and desert plate-and-TNT trap run live (batch 15); batch 17 replays 33 native tripwire scenarios (shears disarm, random ticks, entity classes, projectiles) and the jungle pyramid populated `Temple.dat` byte-identically (`scattered-features.md`). Batch 18: boats, falling blocks and witch/dispensed potions are sensed live (40 probed scenarios). Batch 19: idle thrown potions and bottles never trip a string (42 scenarios). Open: a moving boat/falling block's own onUpdate through a string is javap-checked, not executed; the jungle populate replay covers unpowered generation only.
- Per-biome decoration audit (batches 16-17): the unchanged native `ChunkProviderGenerate.populate` is replayed on 79 regions over 59 slots (slots 10, 20, 151 via forced single-biome terrain), desert wells and jungle melons at chunk level, and 14 structure-on areas ([audit](biome-decoration-audit.md)); lily pads take the native hashed UV rotation. Rows stay Partial: Desert Hills/M wells, jungle temple areas, the light fixture, the lily pad underside shade, and finite worlds (generation 14) and streamed worlds below generation 16 keep the earlier mutated-biome rule.
- Block behaviour audit: light, opacity, boxes, six-side neighbour reactions and key random ticks of every registered block (ids 1-175) are probed and replayed (batches 17-19; selection outlines follow the native boxes); batch 19 probes plant survival over a light grid (flowers have no light rule; mushrooms need full light < 13 off mycelium/podzol and spread), crop growth light, seeded drop streams at fortune 0-3 and the moving-piston box ([block-behaviour-audit.md](block-behaviour-audit.md)); legacy generation 4-8 flower decoration keeps the earlier light rule so old saves regenerate unchanged; batch 20 feeds the moving-block box into entity collision and pushes items, TNT, orbs, falling blocks, carts, boats, player and mobs with `moveEntity` (30 probed stored-block boxes, no entity pulling on sticky retract); open: unprobed stored-block pool boxes, player velocity/rider details during a push, drop streams outside harvestBlock.

- Light engine (batch 20, [light-engine.md](light-engine.md)): the unchanged `updateLightByType`/`computeLightValue` and Chunk light code ran natively over 18 scenarios and 660 random edits; the port's LightVolume equals native after each. Not replicated on purpose (pinned by tests): native stale light under a block set into an empty section, lazy lateral light at generation, skipped updates beside unloaded chunks, the bounded update queue, the Nether heightMap value.
- World loading (batches 21-22, [loading-screens.md](loading-screens.md)): the resident window is built in the worker, column meshes and the light volume flood run in 12 ms slices on the page thread (no worker light); portal and dimension trips show a blank frame then GuiDownloadTerrain with the search, makePortal and End crystals sliced (bytecode-read sequence; duration assumed); `TerrainPeek.portalColumns` assumes generated terrain never holds a portal block (unprobed); the Overworld return still takes about 8 s of wall time; GuiScreenWorking is unwired (no native screen in this flow), the boot overlay is page HTML.
- F3 debug screen (batches 21-22, [debug-screen.md](debug-screen.md)): native text, positions, the Shift+F3 pie, F3+B hitboxes, F3+S/T, F3+C (simulated crash dialog, does not exit) and the overlay under open GUIs; renderer/entity/chunk-update counts are approximations, hitbox line width and some entity sizes are assumed.
- Screen overlays and fire sounds (batch 21, [fire-fx.md](fire-fx.md)): the underwater overlay tint is not pixel-compared; punch-out fizz, flint and steel and orb-in-lava fizz were not driven live; third-person fire not re-audited.

## Priority 5: saves and interchange
- level.dat import: Done (batch 13, `level-dat.md`) through the Node CLI (`--save`, `--level`, `--player-file`, `--stats`): level.dat (WorldInfo, WorldType and generator options, game rules), the player (Data.Player, playerdata/players fallbacks) and stats/<uuid>.json import; painting, item frame and all minecart types in region import; thrown potions were already in. Batch 14 (hardcore track, `hardcore.md`): hardcore play, flying/SpawnForced/Sleeping on import and an in-browser Java save-folder picker (Import screen: showDirectoryPicker, else `webkitdirectory`) are in. Batch 15 (whole-save track, `region-import.md`): the browser import now takes every chunk of region/, DIM-1 and DIM1 as stored full columns with lazy per-region decoding, progress, and Java ZIP round-trip; batch 27 populates imported TerrainPopulated=false Overworld chunks (Nether and End are not), lets portal search and `/spreadplayers` read stored columns, raises the merged list caps to 1<<20, and the CLI `--whole-save` is a whole-save import. Batch 18: MapFeatures off is streamed generation 17 (no structure generator, native mutated-biome rule, default and Superflat). Batch 20: the exported player writes UUIDMost/UUIDLeast like every other entity ([region-import.md](region-import.md)).
- Stats and achievements export: already in since batch 11; the Java ZIP export writes `stats/<uuid>.json` under the offline UUID of "Player" ([stats.md](stats.md)).
- One local player. Other languages need `npm run lang:fetch` (batch 15, [languages](languages.md)); item and block names, container titles, potion/enchantment tooltips, bed messages and the Now playing line follow the selected language since batch 16 (item keys probed, container keys bytecode-read), and since batch 17 firework tooltips, creative tabs, horse/beacon/trade labels and boss bar names do too (`lang-keys-reference.json`); since batch 18 item, container and HUD text is drawn with the 1.7.10 FontRenderer glyphs (`bitmap-text.js`) and F3 entity names and attacker death messages are translated; since batch 19 signs use the same glyph pages and every death message the port can produce goes through the CombatTracker port; still English or page font: `Durability:` (container screens and the book use the native GuiContainer shell and glyphs since batch 22) (hardcoded English in 1.7.10); batch 27 ports the FontRenderer bidi reordering and Arabic shaping and draws underline, strikethrough and italic on unicode pages (no pixel comparison).

## Stale strings outside this track's scope
- Both resolved in batch 12: Multiplayer Settings opens Chat Settings, and the golden apple comment is fixed.

## Out of scope
- Multiplayer: the first dedicated Creative building milestone has a connection form, server-owned movement/edits, chat, player presence and saves ([scope](multiplayer.md)); Survival/containers, mobs/items/projectiles/TNT, sounds/events, full tile/redstone/pistons, dimensions, infinite residency, Java protocol 5, real ping, account permissions and a server list remain missing. Realms remains unavailable. Open to LAN still has only local effects.
- Twitch integration and the snooper/usage reporting.
- Demo mode.
- The 16 dedicated-server-only commands (not registered by the native integrated server either).
