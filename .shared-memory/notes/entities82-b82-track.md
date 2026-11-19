# Batch 82 entities82: entity catalogue audit, daylight helmets, the firework star overlay, the giant on the server

## Summary
- **Audit of `entity-parity-catalogue.md` (57 EntityList rows: 20 Implemented, 35 Partial, 2 Abstract).**
  - No row is Missing. The "no" values are the native Abstract and spawn-egg columns, not statuses. The status-words paragraph now says so.
  - Every Partial row was re-read against src/, tests and the linked docs. The `E` map in `tools/build-content-catalogue.mjs` now gives each row a dated "batch 82 audit (2026-11-18)" sentence that says what keeps it Partial. The catalogue was regenerated, not hand-edited.
  - Stale gaps corrected (port-read):
    - XPOrb import gap: java-objects.js keeps Value 0, Value over 2477 and Health 0 (b76).
    - FallingSand import gaps: stone, the whole Data byte, Time 0 and TileEntityData are kept.
    - WitherSkull orientation: pinned by b80 renderfx80; Rotation saved since b81.
    - Witch: the hut list is consulted whatever the biome, and potion break particles are sent (event 2002).
    - WitherBoss target order: probed in b17. Only the chunk-slice re-append order remains.
    - MinecartSpawner: `/summon` works on the server.
    - Furnace, TNT and hopper carts: "approximated from boxes" was wrong. They use block textures, and the hopper has 17 executed quads.
    - Zombie: the follow-range bonus, ignite and chicken-jockey gaps in pathfinding.md are stale.
    - Mooshroom/golem: the snowshovel burst is drawn.
    - Slime: the shadow has been the native constant 0.25 since b71.
  - Rows with no named gap (Item, Painting, Arrow, Snowball, ThrownPotion, ItemFrame, the minecarts, CaveSpider, Silverfish, VillagerGolem) now say why they stay Partial: no whole-feature native record or render capture, or the gaps listed in the linked doc.
  - Rows owned by other batch 82 tracks were not re-audited: Fireball and SmallFireball (mpball82, fireext82), MinecartCommandBlock (mpcmd82).
- **Fix 1: zombie and skeleton daylight helmets.**
  - Before: a zombie or skeleton wearing a helmet still burned in daylight.
  - Native (`yq.e`, `yl.e`): after the daylight roll passes, any slot-4 stack blocks the burn.
    - A damageable helmet gets `damage += rand.nextInt(2)` on the mob's Random.
    - At maxDamage it runs renderBrokenItemStack (the random.break sound at 0.8, pitch from the world Random, plus 15 entity-rand floats) and the slot is cleared.
    - A pumpkin, a skull or an Unbreakable helmet blocks without wear.
  - New `mob-equipment.js` `daylightHelmet(equipment, random, broken)`.
  - `entities.js`: the daylight block calls it before `setMobFire(e, 8)`. That is a one-line change plus the import.
- **Fix 2: the firework star overlay tint.**
  - Before: the star showed only its base texture, because `starTintComponents` had no non-test caller.
  - `item-passes.js`:
    - New `itemPassColor(stack)`: `starTint(stack, 1)` for a star, otherwise `stack.color`.
    - `itemPasses` gives the star an untinted `fireworks_charge.png` base and a `fireworks_charge_overlay.png` overlay tinted by that colour.
  - The colour reaches every icon path:
    - `main.js`: the inventory icon (two `.tinted-item` masks), the held colour and the first-person colour.
    - `drop-renderer.js`
    - `hanging-renderer.js` (item frame key). This file was not in the original claim.
- **Fix 3: the giant on the dedicated server.**
  - `server-mobs.js`: `SUPPORTED.add('giant')`. The giant was the last port mob kind outside the set.
  - `/summon Giant`, spawner SpawnData (also as a Riding mount) and saved mobs now keep it. The tracker sends it at the IAnimals default range of 80, and the client copy has the 3.6 x 10.8 box.
  - It still has no natural spawn and no egg, as natively.

## Evidence
- **Executed:** `tools/probes/ZombieWanderProbe.java`.
  - New `helmet` script op and row column [20] (the helmet id, damage and count). The probe keeps `sv.g` previousEquipment in sync, because the probe world is `ahb`, not `mt`.
  - Three new families, run in daylight:
    - `zw-helm-leather` 42401 (leather cap at damage 54): 5 records. 4 break the helmet; 2 then burn.
    - `zw-helm-diamond` 42501: 2 records. The helmet wears from 0 to 5; the zombie never burns.
    - `zw-helm-pumpkin` 42601: 2 records. No wear, no burn.
  - `public/research/zombie-wander-reference.json` now has 27 records. The 18 old records are unchanged.
  - With the `entities.js` change removed, all 9 helmet records diverge on "fire".
- **Bytecode-read:**
  - `yl.e` (the skeleton branch is identical apart from the child check; not probed).
  - `add.g` isItemStackDamageable.
  - `sv.a(add)` renderBrokenItemStack draws (already probed in b76/b78 zero-stacks thorns).
  - `acr.a(int,int)` / `acr.a(add,int)`: star pass 1 is the integer Colors average, or 9079434 without Colors; pass 0 is 16777215.
  - The tracker default (`EntityTracker`, IAnimals: 80 / 3).
- **Port-read:** the catalogue audit and the dated research corrections in fireworks.md, witch.md (2), pathfinding.md, minecart-variants.md, mooshroom-golem.md, wither-boss.md and giant.md.

## Verification
- `node --test --test-timeout=600000 src/entities82-b82.test.js`: 5 pass, 0 fail (new file: star passes, star colour average and default, the helmet units, the giant on the server).
- `src/zombie-wander.test.js` (in a 17-file run): the count is now 27, and a new test checks the helmet records.
- Item-pass and equipment neighbours, 17 files: atlasunify-b66, attributes2, babyrender-b64, catalogue-consistency, fireworks, gate-item, heldrender-b63, item-passes, itemsprites2-b65, leather-items, mob-gear-nbt, mob-equipment, mobrender-b71, neg-stacks2, passes2-b47, zero-stacks, zombie-wander. Result: 164 pass, 0 fail.
- Daylight and entity neighbours: entities, bow, zombie-villager, away-mobs, fire-times-b53, skeleton-arrow-villager, fire-armor-b49, spdispense77-b77, lang-keys. Result: 106 pass, 0 fail.
- Giant gap tests: mpmobtypes-b61, mpspawners2-b65, mpsummon-b67, summon2-b68, mpdispense-b61. Result: 57 pass, 0 fail.
  - These tests encoded the gap ("the giant is refused"). They now assert the giant is kept, and each takes the giant out of SUPPORTED for a moment so the refusal path stays covered.
- `content-catalogue` and `catalogue-consistency`: 6 pass, 0 fail.
- `npm run build`: passes.
- No full `npm test` and no browser check (track rules).

## Follow-ups
- Browser-only checks:
  - the star's two-pass icon in the inventory, as a drop, held (first and third person) and in an item frame
  - the helmet break sound and crumbs on a burning-day zombie or skeleton
  - the giant copy's look on a multiplayer client
- Native edge cases not ported: a star without an Explosion tag throws in `acr.a(add,int)`, and an empty Colors array divides by zero. The port draws the default 9079434 for both.
- The skeleton helmet path is not probed; a SkeletonProbe family would pin it.
- Still open in the catalogue:
  - the giant's pathing reach
  - native records for boat pair pushes, lava and the void
  - the squid flow push
  - the chunk-slice re-append order of the wither's targets
  - XP orb pickup order and the level-up throttle on respawn
  - whether the default server world generates villages (not re-checked)
