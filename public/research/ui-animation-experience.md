# First-person correction, classic UI and experience (0.5)

## Hands and held items

The old renderer applied the same swing to empty hands and items, reduced translation to 28–35% and X rotation to 60%, combined ordered Y/Z/X rotations as an XYZ Euler rotation, used undersized flat sprites, and added an idle oscillation. These caused the reported unnatural motion.

The replacement preserves ItemRenderer `bly.a(float)`'s sequential matrix multiplication. Item movement uses the full −0.4/+0.2/−0.2 translations, base (0.56, −0.52, −0.72), 45° Y turn, ordered swing rotations, 0.4 scale, and sprite-local transforms. Empty hands use −0.3/+0.4/−0.4 translations, base (0.64, −0.6, −0.72), 70° swing Y turn, and the original biped arm basis/pivot. Skin UV rows follow ModelBiped's shoulder-to-fingertip axis. Sprites have the original 1/16 depth and 16 edge strips per axis. Hand projection uses 70° FOV; narrow panels receive a horizontal fit adjustment.

Equip lowers by 0.6 units, retaining the original 0.4-per-tick equip rate and display swap threshold. Eating applies `1 - (remaining/32)^27`, the original approach rotations/translations and cosine chewing movement. The added idle wobble is removed; walking bob and look lag remain. Tick interpolation, lighting, Java trig-table precision and some special item states remain approximations; maps, bows and blocking are not implemented.

## UI

Title artwork, button sprites, native inventory/workbench/furnace backgrounds and the original font bitmap replace the custom presentation. The original glyph pixels are traced to TrueType by `tools/build-pixel-font.py`; this derived font and original artwork remain © Mojang / Microsoft. Source PNGs are unchanged and listed in the texture provenance manifest.

`GuiGameOver` (`bdc`) draws the 0x60500000 → 0xA0303030 gradient, doubled “You died!” title at y=30 in its scaled coordinates, score at y=100, Respawn/Title screen at quarter-height +72/+96, and enables buttons after 20 ticks. The browser uses equivalent GUI-scale-two positions and a one-second lockout. Unlike later versions, the 1.7.10 screen does not add a death-message line.

Menus and container art now follow the original style. Inventory remains aggregate storage rather than Java's full 36-slot/cursor model; crafting reserves ingredients until the result is taken. The inventory sheet uses scale three. Furnace resource clicks load one supported item; clicking the fuel slot selects it for materials that are both input and fuel. Browser-specific settings, import/export and controls remain adapted. Multiplayer is not implemented.

## Experience

`EntityPlayer.bP()` gives the original level cost: 17 below level 15; `17 + (level-15)*3` for 15–29; `62 + (level-30)*7` above. Thus level 16 takes 272 total points, level 30 takes 825, and level 31 takes 887. These are the 1.7.10 values, not the modern formula.

Orbs spawn from harvestable coal/diamond ore, retrieved furnace results, player melee kills of adult creatures, and cow breeding. They attract within eight blocks, can be collected, expire after 6,000 ticks, and save/reload with their values. The HUD shows native XP bar sprites and green levels; pickup/level-up sounds use two additional original clips (135 shipped effects total). Death resets levels/progress and drops `min(level*7,100)` points; the score shows accumulated XP before respawn. Respawn clears the score as well.

Orb movement/rendering/pickup cadence and precise kill eligibility are simplified. XP cannot yet be spent on enchanting or anvils; neither system is implemented. Creative mode hides the XP HUD and does not earn rewards.

## Cow breeding

Adult cows follow held wheat. Feeding two ready adults consumes one wheat each and starts 600 ticks of love. Nearby partners breed after 60 ticks, create one half-size calf with growing age −24,000, and receive a 6,000-tick breeding cooldown. Age/love/cooldown survive saves. Native heart sprites accompany feeding; breeding awards 1–7 XP. Calves mature over time and do not drop adult loot/XP. Pig breeding, other species, full navigation and original baby model proportions remain unfinished.

## Checks

Tests cover native matrix amplitudes/equip lowering, separate arm paths, extruded sprite dimensions, level boundaries, death rewards, orb conservation/pickup/expiration, original-media hashes, feeding prerequisites/resource consumption, breeding uniqueness, and calf/cooldown persistence. Local browser checks exercise the menu, hand/item selection, XP pickup, inventory, feeding, death and respawn.
