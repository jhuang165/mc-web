# Batch 15 villagers track

Branch b15-villagers (base 01887b4, app 0.44.0). Owner claude-b15-villagers.

- Trade "?" items resolved: 350 cooked fish, 387 written book, 347 clock, 384 bottle o' enchanting, 89 glowstone. `src/villager-trade-items.test.js` checks every trade-table item maps.
- Iron golem: step sounds, 1-in-20 collide retargeting (IMob set), attack/rose timers, walking dust, rose model. Probe records in `public/research/village-live-reference.json` (VillageLiveProbe.java, verify-village.mjs). Rose geometry is bytecode-read, not probed.
- Spawn egg on ageable mobs spawns a baby.
- Flaky test "an iron golem walks up to a monster and hits it": random zombie armour reduced damage below the asserted 7. Fixed by clearing equipment and seeding entity randoms; 0 failures in 60 runs.
- Remaining: villager NBT import (interchange track), particles from a visual Random, NearestAttackable path check is a distance test, +5 default reputation has no setter.
- Parity is not complete.
