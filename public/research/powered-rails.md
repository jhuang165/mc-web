# Powered, detector and activator rails (1.7.10)

Internal ids 135 / 136 / 137 map to original 27 (powered), 28 (detector), 157 (activator); block items are 1135-1137. No plain items were added (ids 400-405 unused). Metadata is the original 4 bits: shape 0-5 (straight only) plus bit 8 as the powered/active state, so Java import/export uses `same()` and round-trips unchanged.

## Native-verified (tools/probes/RailProbe.java -> public/research/powered-rails-reference.json, replayed by src/powered-rails.test.js)
The unchanged BlockRailPowered (amt), BlockRailDetector (aki), BlockRail (amy), BlockRailBase / $Rail (aje/ajf) and real EntityMinecartEmpty / EntityMinecartChest run inside the RedstoneProbe World double (real chunks, native setBlock/notify/power code, scripted pending ticks). 11 cases, 388 ticks, compared tick for tick on cart position, motion, onGround, dead, yaw, rail metadata (id and meta), detector weak / strong-up / strong-down / comparator override, comparator tile signal and drops:
chain (8-rail propagation limit), hill (slopes pass power), mixed (powered and activator lines do not feed each other), boost-toggle (boost then brake), push-start (0.02 push from a solid block), activator-ride, detector-pass (chest cart, 20-tick recheck, comparator reading 5), detector-parked, place (straight-shape placement), break (support loss drops each rail's own item), plain-tee (plain rail curve reshape).

## Behaviour notes
- Activator rails: in 1.7.10 EntityMinecart.onActivatorRailPass is empty for empty and chest carts (only TNT, hopper and command-block carts override it), so riders are not ejected. The port has none of those carts; the hook is a documented no-op.
- Detector: power 15 weak, 15 strong upward only; rechecks every 20 ticks while a cart is on it; comparator override reads the first chest cart.
- Pressure plates: wooden plates count carts, stone plates do not (living entities only), via the runtime's entity list.

## Approximated or not covered
- Sounds: the powered, detector and activator rails (original 27, 28, 157) are `soundTypeMetal` like the plain rail: the stone files at frequency 1.5 (place and break pitch 1.2, hit 0.75, footstep 1.5), from the native table in [block sounds](block-sounds.md).
- Hopper/TNT/command-block carts do not exist, so those activator effects are absent.
- Pressure-plate and cart-collision interplay is not part of the native recording beyond the entity list adapter.
- Full parity is not claimed.
