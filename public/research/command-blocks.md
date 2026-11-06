# Command blocks (0.43.0)

Target: Java 1.7.10. Original block 137 maps to browser block 139/item 1139 (browser 137 was already an activator rail).
Obtain with `/give @p command_block`; native command blocks have no creative tab or ordinary block drops.
The original texture is used. The editor opens on use for a Creative player with command permission, has the 32767-character
command field, @p/@r/@a hints, previous output, Track Output toggle, Done and Cancel.

`tools/verify-command-blocks.mjs` checks the pinned client JAR and javap of BlockCommandBlock (akb), CommandBlockLogic (agp),
ServerCommandManager (bl), and GuiCommandBlock (bfh); the [reference](command-block-reference.json) records the bytecode hashes.
This is inspected bytecode evidence, not integrated native server execution. Port regressions exercise the live World/redstone
adapter, permissions, command effects, NBT comparison and chunk save/reload.

A rising power edge sets metadata bit 0 and schedules a one-tick update. Continued power does not repeat. A falling edge clears
the bit; a pending update still executes after power falls. The sender has permission level 2, its tile position, and default name
`@`. Player arguments resolve @p/@a/@r against the one local player; radius/name/mode/level filters are supported. Relative block
coordinates start at the sender. Commands that require an implicit player refuse a block sender. SuccessCount supplies comparator
input; Control NBT and browser runtime snapshots retain command, custom name, count, tracking and last output.

`commandBlockOutput` suppresses operator feedback; it does not suppress tracked timestamped output. Track Output suppresses that
stored output independently. Say/me broadcast to local chat. The integrated-server command-block enable option is treated as enabled.

Remaining adaptations: one local player (batch 13 added teams/scoreboard and `@p[team=,score_…]` selectors, [commands-b13.md](commands-b13.md)), no Java network server, styled HTML editor rather than pixel-exact
GuiCommandBlock, plain-text output represented as chat JSON, one success per command in the single-player adapter. Unsupported
commands still fail. Complete native server/command/selector parity is not claimed.
