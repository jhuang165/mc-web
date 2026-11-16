# Batch 77 mphorseclient77: client side of horses on the dedicated server

## Summary
- `multiplayer/client-horse.js` (new): `MpHorseRider` runs the single-player jump counter (`horseSeats.charge`, `heldJumpPower`) for the ridden server horse each client tick and sends `horseJump(int(power*100))` on release (C0B 6). `mountedHorse` maps the players row's seat key (`riding: 'm<id>'`) to the copy's stand-in. main.js: tick call in `movementTick`, `inventory()` sends `horseInventory` (C0B 7) while riding a saddled horse, `renderVitals` uses the same `jumpBar` and mount-hearts paths for the server horse (the bar replaces the xp bar, the horse health replaces the food row).
- Wire: `mobState.horse` now also carries `tame`, `hp` (ceil health), `max` (live max health); `remote-mobs.js` stores them on the stand-in (health, `horse.tame`, `horse.maxHealth`).
- Server (`server-horses.js`, tiny): the key fallback records when it fired; a `horseJump` arriving within 3 ticks of that release is the same release and is not applied twice. From the first wire message the fallback is off (as b76; `p.horseJumpWire`).
- `predictAnimalUse` (animal-use.js): lead (tie one lead on any leashable mob, `leadWire` = this player; free when the holder is this player; another holder's lead and tamed wolf/ocelot not predicted) and horse clicks (food: health/growth/love + one item; chest on a donkey/mule; claimed click for mount, gear window, wild rear; foals unclaimed; a name tag in hand on a mount click is left to the name tag branch). New options `selfId`, `sneak` (main.js passes them).

## Evidence
- Bytecode-read (b76 note): action 6 / 7 handling on the server, `wi.w`, `wi.g`. EntityPlayerSP.isRidingHorse is the saddled check (port `riddenHorse` also requires tame; the MP copy gates on saddled as natively).
- Port-read: horse-live.js charge/horseInteract, horse-gear-live.js leashInteract, server-leads.js, server-use-entity.js order (extras, lead, species, horse, name tag).
- Executed: `src/mphorseclient77-b77.test.js` compares each prediction's stack with the real DedicatedSimulation (feed, golden apple, chest, empty hand, saddle, sneak, wild rear, lead tie and free on horse/cow/pig).
- Not claimed: the jump counter's exact EntityPlayerSP source is still the recalled formula (b76 follow-up); no native probe of the client click paths; no browser check (rules).

## Verification
`node --test`: mphorseclient77-b77 12/0; mphorse76, mpclicks76, mpusesweep75, mpanimals61, mpriding2-b62 and mpmobs tests 55/0 together. `npm run build` ok. No full npm test, no browser.

## Follow-ups
- Temper is not on the wire: feeding a wild horse at the temper cap is a wrong guess (corrected by `animResend`).
- Remote riders' pose and the horse window's preview mob are other tracks / open.
- A leash tie on a tamed wolf/ocelot and a villager's window stay server-driven.
