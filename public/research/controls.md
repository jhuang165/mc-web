# Controls, key bindings, options.txt and the F-keys

Target: Minecraft Java 1.7.10. Evidence: `ControlsProbe` (`tools/probes/ControlsProbe.java`). It builds a headless `GameSettings` from the unchanged client JAR (SHA-1 `e80d9b3b...`) with LWJGL 2.9.1, then calls `KeyBinding.setKeyBindState/onTick/isPressed/getIsKeyPressed`, `GameSettings.setOptionKeyBinding`, `setOptionFloatValue(FRAMERATE_LIMIT)`, `saveOptions`, `loadOptions` and `Keyboard.getKeyName/getKeyIndex`. The `GuiControls` (bew), `GuiKeyBindingList` (bes/bev/beu) layout constants and the `Minecraft.runTick` (bao) F-key table come from javap and are asserted by the probe. Run `MC_RESEARCH=tools/research node tools/verify-controls.mjs` to regenerate `controls-reference.json` (85 records). `src/keybindings.test.js` replays it.

## Key bindings

- The table has all 32 `GameSettings.keyBindings` with their descriptions, categories, default LWJGL codes and registration order (`src/keybindings.js`, `BINDINGS`). The nine hotbar bindings are part of it.
- Codes are LWJGL 2 `Keyboard` numbers. `KeyboardEvent.code` is mapped to them in `CODE_TO_LWJGL`, so a binding means the same physical key as on a US layout. Names are the 131 `Keyboard.getKeyName` strings.
- Mouse buttons are stored as `-100 + button`, using the LWJGL numbering: 0 left, 1 right, 2 middle. The browser numbers the middle button 1 and the right button 2, so `mouseCode` swaps them. They are displayed as `Button N` (`key.mouseButton`, code + 101). Unknown codes show an empty label, as `getKeyDisplayString` returns null.
- The `KeyBinding.hash` rule is replayed:
  - A shared code is owned by the binding registered later.
  - Code 0 is never hashed.
  - `setKeyBindState` presses only the hash owner, and `isPressed` counts down `pressTime`.
  - A rebind without `resetKeyBindingArrayAndHash` keeps routing the old code.
  - The probe's `loadOptions` result reports `hash17 = key.forward` after `key.forward` was rebound. This is an artefact of the static `keybindArray`, which also holds bindings from earlier `GameSettings` instances in the same JVM. With a single set of bindings, nothing owns code 17, and the test says so.
- Every input path in `main.js` goes through the bindings:
  - Movement and sneak, through `captureMovementInput` and `binds.isDown`.
  - Jump, sprint, attack/use/pick on keys or mouse buttons, inventory, drop, chat, command, player list, perspective, smooth camera, the hotbar, screenshot and fullscreen.
  - `GuiContainer` (hotbar swap, drop and close on the inventory code), `GuiAchievements` (close on `key.inventory`) and `GuiContainerCreative` (search opens on `key.chat`) compare binding codes directly.
- `dispatchKeypresses` (screenshot, fullscreen, the stream keys) runs in every screen. It skips repeats and code 0, and skips presses within 20 ms of `GuiControls.time`.
- The stream bindings exist and can be rebound, but pressing them does nothing because there is no Twitch support.
- Losing focus, opening a screen or closing the pointer lock clears held keys (`KeyBinding.unPressAllKeys`, `HeldKeys.clear`).

## Controls screen (GuiControls)

- Layout:
  - Invert Mouse, Sensitivity and Touchscreen Mode (disabled) are at `w/2 - 155 + (i % 2) * 160`, `18 + 24 * (i >> 1)`.
  - The list runs from 63 to `h - 32` with a slot height of 20.
  - Each row has a label at `x + 90 - maxLabelWidth`, a 75x18 key button at `x + 105` and a 50x18 Reset button at `x + 190`. Reset is enabled when the code differs from the default.
  - Done and Reset Keys are at `h - 29`.
- Rebinding:
  - Clicking a key button shows `§f> §e<name>§f <`.
  - The next key press binds its code, and Escape binds 0 (NONE).
  - A mouse click binds `-100 + button`.
  - Each rebind calls `setOptionKeyBinding`, which rebuilds the hash and saves options.
- A binding whose code is non-zero and shared with another binding is drawn with `§c` (red), and so is the other binding.
- Reset Keys resets every binding and the hash and does not save. This matches GuiControls: the next save writes the reset codes.

## options.txt

- The port's own `blockworld.settings` JSON stays the primary save.
- Every save also writes a native-format `options.txt` mirror to the `blockworld.options.txt` localStorage key (`src/options-txt.js`). The mirror contains:
  - all 55 `saveOptions` lines in their original order
  - `key_<description>:<code>` lines
  - `soundCategory_*` lines
  - floats formatted with Java `Float.toString` (`0.5`, `1.0E-4`)
  - fov saved as `(fov - 70) / 40`
  - `ao` saved as true/false
- Lines the port has no field for, such as `lang`, `anaglyph3d`, `skin`, `lastServer` and `overrideWidth`, keep their defaults. If they came from an imported file, they keep the imported values (`optionsTxtExtra`).
- When no JSON save exists, the mirror is read with the `loadOptions` rules:
  - lines are split on `:`
  - a line that fails to parse is skipped
  - unknown keys are ignored
  - `key_` lines take integer codes
- The test checks that the default file is byte-identical to the probe's `saveOptions` output, and that a native input file re-saves to the probe's text.
- Browser-only helper (not native): small Import and Export buttons in the top-right corner of the Controls screen. Export downloads the mirror text as `options.txt`; Import runs the `loadOptions` rules over the current settings (bad lines are skipped and counted), applies them live (FOV, sound levels, key bindings, chat settings) and keeps the current resource pack selection. Browser check: an imported file with `fov:0.5`, `key_key.jump:30` and a bad line set FOV 90, rebound jump and reported one skipped line.
- Older saves that stored `options.keys` as `KeyboardEvent.code` strings are migrated to LWJGL codes once.

## F-keys (Minecraft.runTick, no screen open)

| Key | 1.7.10 | Port |
| --- | --- | --- |
| F1 | `hideGUI` toggle | Hides the HUD, hotbar, chat, vignette, pumpkin blur, boss bar, player list, block outline and first-person hand. Open screens still draw. |
| F3 | `showDebugInfo` toggle on key **down**, and `showDebugProfilerChart` = Shift held | Debug toggles on press. F3+H therefore also toggles debug, as in 1.7.10 (1.8 moved this to key release). No profiler chart. |
| F3+A | `loadRenderers` | Marks every loaded chunk mesh dirty. |
| F3+H | `advancedItemTooltips`, then `saveOptions`. No chat line. | Same: toggles and saves, with no message. |
| F3+P | `pauseOnLostFocus`, then `saveOptions` | Same. Off removes the 500 ms lost-focus pause (`EntityRenderer`). |
| F3+F | `setOptionValue(RENDER_DISTANCE, ±1)`, but 1.7.10 has no RENDER_DISTANCE branch there, so it only saves | Only saves options. |
| F3+B | `RenderManager.debugBoundingBox` | Draws the native white entity boxes (batch 22, `debug-keys.js`). |
| F3+S / F3+T | `refreshResources` | In-place `refreshResources` plus every chunk mesh marked dirty; works in every GUI. |
| F3+C | Held for 6 s: manual debug crash | Held 6 s with F3: shows the crash report with "Manually triggered debug crash" in a dialog, non-destructively. |
| F4 | `deactivateShader` | Ported: drops the active post shader ([post-shaders.md](post-shaders.md)). |
| F5 | `key.togglePerspective` | The binding (rebindable). |
| F8 | No such check in 1.7.10. Cinematic camera is only `key.smoothCamera`, unbound by default | Nothing bound. The test asserts that `main.js` has no F8 or code 66 path. |

F2 (`key.screenshot`) saves the canvas frame with the DOM GUI drawn over it (`src/screenshot-compose.js`: matching page CSS, images and the Minecraft font inlined into an SVG foreignObject; native ScreenShotHelper reads the whole framebuffer). Limits: WebGL canvases inside the DOM (the title panorama) come out transparent. F2 and F11 (`key.fullscreen`) are bindings handled by `dispatchKeypresses`.

## Max Framerate and VSync

- Max Framerate is a slider from 10 to 260 in steps of 10, with 260 shown as "Unlimited". It defaults to 120 and is saved as `maxFps`.
- `Display.sync(limit)` applies below 260. `getLimitFramerate` is 30 when there is no world and a screen is open (the title screen).
- The frame loop (`src/frame-limit.js`) skips `requestAnimationFrame` callbacks until `next`, then sets `next = max(next + 1000/fps, now)`. At 30 fps on a 60 Hz display, every other frame is drawn.
- Use VSync toggles and saves `enableVsync`. The browser always synchronizes animation frames to the display, so VSync off cannot unlock frames above the refresh rate, and Unlimited means one frame per display refresh.

## Verified vs approximate

- Verified against the JAR:
  - binding defaults, order and categories
  - key names and display strings
  - the hash, press and conflict rules
  - Reset Keys not saving
  - the options.txt default text, `loadOptions` and re-save
  - `Float.toString` formatting
  - the framerate slider range and title-screen limit
  - the runTick F-key table
  - the GuiControls layout constants
- Approximate:
  - `KeyboardEvent.code` to LWJGL is a US-layout physical mapping. Keys the browser reserves (Ctrl+W, Cmd+Q, some F-keys) cannot always be captured.
  - Drop-the-stack reads the Ctrl modifier, not LWJGL `isCtrlKeyDown`, which is Command on macOS.
  - Holding one mouse button while pressing a second does not fire a second `pointerdown`, so mouse bindings do not chord.
  - A lost pointer lock while the window keeps focus still opens the pause menu even with pauseOnLostFocus off. The browser needs a click to regain the lock.
  - The touch d-pad and Jump buttons hold their actions directly, whatever key those actions are bound to. Native 1.7.10 has no touch buttons.
- Missing:
  - 3D Anaglyph: enabled and saved as `anaglyph3d` ([post-shaders.md](post-shaders.md)); an approximation of the native texture conversion. Batch 69 (docs sweep): later batches use the native conversion formulas for textures and the GUI (`src/anaglyph.js`, `gui-anaglyph.js`, `anaglyph-gui2.test.js`; notes `anaglyph4-b30-track.md`), so "approximation" now means only that it cannot be compared against a native render here.
  - The stream actions (no Twitch stream). Hitbox line width is fixed at 1 px.
  - Touchscreen Mode stays disabled.
