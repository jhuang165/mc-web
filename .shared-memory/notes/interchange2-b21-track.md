# interchange2 batch 21 track

## Summary
- Owner and leash links in Java export/import now use the real exported Player UUID (imported `playerUuid`, else offline UUID of "Player"); import re-links them, whole-save assembly drops leads held by another UUID.
- Every living class writes the native Attributes list (`src/mob-attribute-list.js`); import applies bases/modifiers the port models and preserves the rest as `attributeBases`.
- Pigman now writes/reads `IsBaby`. Modules: `src/owner-links.js`, `src/mob-attribute-list.js`; probe `tools/probes/InterchangeLinkProbe.java`, runner `tools/verify-interchange-links.mjs`.

## Native evidence
- Probed (125 records, `public/research/interchange-links-reference.json`): owner 6, ownerRead 9, leashWrite 4, attrs 29, attrsError 2 (Mob, Monster abstract), notLiving 26, attrVariant 49. Tameable `OwnerUUID` String, no `Owner` on write; horse `OwnerUUID` + `Tame`; Leash UUIDMost/UUIDLeast or X/Y/Z; attribute order and bases per class; baby boost UUID; no potion modifiers saved.
- Bytecode-read only: legacy `Owner` name conversion (`nz.a`), taming stores `getUniqueID().toString()`.
- Assumed: horse "Random spawn bonus" rolls are compared by amount only; zombie reinforcement roll is random per instance.

## Tests
- `src/interchange-links.test.js` (92 tests): counts and digests, owner and leash replays, 29 class lists, 49 variants, round trip export/import/export. Updated `mob-gear-nbt.test.js` for `holderUuid`. Full `npm test` and `npm run build` pass (see commit).

## Remaining gaps
- Legacy Owner name conversion not probed; port draws follow-range spawn bonus for only some mobs; speed/attackDamage bases not simulated; baby modifier without IsBaby lost; foreign owners stay player-owned in the browser; knot holders have no UUID; leads re-linked only with a known player UUID; default exported player UUID changed to offline UUID of "Player".

## Proposed remaining-gaps lines
- Foreign-owner tameables and horses keep the owner string but behave as player-owned; knot leashes carry no holder UUID.
- Movement speed and attack damage attribute bases are round-tripped but not simulated; mobs other than zombies and horses have no spawn-bonus draw.
