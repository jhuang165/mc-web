# Handoff: settings controls after 0.23.2 (invert mouse, pitch clamp, cinematic camera, sound categories)

Owner: claude-settings-controls. Branch: worktree-agent-aebfee841e2e84351 (not pushed). package.json stays 0.23.2; the integrator owns the version, parity.md, parity-roadmap.md and PROJECT.md.

## Changed
- `src/mouse-look.js` (new): `MouseFilter` is a port of qm.smooth with float arithmetic. `MouseLook` covers EntityRenderer.updateRenderer, a per-tick filter at 0.05 * curve, and updateCameraAndRender, which applies per-frame partial-tick spreading and the invert multiplier of -1. `setAngles` ports Entity.setAngles: 0.15 degrees per unit and a pitch clamp of [-90, 90].
- `src/main.js` (only the mouse-look and options code is touched):
  - pointermove now only accumulates deltas, and animate applies them once per frame.
  - `invertMouse` is saved.
  - A session-only "Toggle Cinematic Camera" switch is added.
  - Nine `sound-<category>` sliders with the en_US.lang labels replace the single Master Volume slider.
  - The saved-pitch clamp on load is now +-pi/2, replacing the old +-1.55.
- `src/settings.js`:
  - `SETTINGS_VERSION = 3`.
  - New exports: `SOUND_CATEGORIES`, `soundLevel`, `categoryVolume`, `normalizedVolume`, `normalizedPitch` and `lookCurve`.
  - Migration: the v2 `volume` moves to `soundLevels.master`. soundLevels is validated to known keys clamped to 0..1, and invertMouse must be a boolean.
- `src/audio.js`:
  - Each clip carries its sounds.json category, and nested events keep the outer event's category.
  - Gain is the SoundManager getNormalizedVolume times the master level times attenuation.
  - Master 0 skips every sound, and a normalized volume of 0 skips that sound.
  - The pitch clamp is now 0.5..2 (previously 0.3..2).
  - The attenuation distance is 16, or 16 * volume when volume is above 1 (previously 20).
  - `updateVolumes()` regains playing sounds and stops non-master sounds that drop to 0.
- `tools/verify-settings-catalogue.mjs`: javap -c asserts the constants in blt, qm, sa, btj and bao, plus the en_US.lang map. Additions to `public/research/settings-reference.json`: `controls`, `controlsMethod` and `lang`.
- `tools/build-settings-catalogue.mjs` and the regenerated `public/research/settings-parity-catalogue.md` carry these statuses:
  - INVERT_MOUSE: Implemented.
  - key.smoothCamera: Partial.
  - Sound categories: MASTER, WEATHER, BLOCKS, MOBS, ANIMALS and PLAYERS are Implemented; MUSIC, RECORDS and AMBIENT are Partial because the port has no sources for them.
- Tests: `src/mouse-look.test.js` (new, 4 tests), plus updates to `src/settings.test.js` and `src/settings-catalogue.test.js`.

## Native finding: no F8 binding
The brief's "F8 toggle" for smooth camera is not in 1.7.10:
- smoothCamera (bbj.aB) is flipped only in Minecraft.runTick (`bao.p()`), through keyBindSmoothCamera (bbj.al).
- That key is unbound by default (keycode 0), and there is no bipush 66 / F8 check.
- smoothCamera is not written to options.txt.

The port therefore binds no key. The Options switch stands in for rebinding the key and resets every session.

## Tests
- `npm test`: 715/715 passed (previously 708).
- `npm run build`: OK.

Browser check: headless Chrome with --mute-audio on its own vite port; the tab was blanked afterwards.
- A v2 save `{volume: 0.4}` shows "Master Volume: 40%". Saving afterwards writes v3 with soundLevels and invertMouse; smoothCamera is not saved.
- Mouse look:
  - Inverted, 100px down gives +15 degrees of pitch.
  - 200px right gives -30 degrees of yaw.
  - A large movement clamps to exactly -pi/2.
- The cinematic camera converges with the native undershoot.
- Category routing: zombie -> hostile, step.grass -> neutral, random.click -> block, gui.button.press -> master, rain -> weather, levelup -> player.

## Verified natively vs not
- Verified from bytecode (javap and the verifier):
  - smooth factors 0.6, 0.2, 8, 0.05 and 0.05
  - the qm 0.5 constant
  - the invert multiplier of -1
  - setAngles 0.15 and the +-90 clamp
  - the btj master path returning 1
  - the volume clamp 0..1 and the pitch clamp 0.5..2
  - the 16.0f distance and its x volume pattern
  - the single toggle site and the unbound key
- Verified from en_US.lang: all labels.
- Not verified:
  - The paulscode attenuation curve is assumed linear; it lives outside the JAR.
  - LWJGL device-pixel deltas differ from browser CSS pixels.
  - Other locales.
  - The separate GuiScreenOptionsSounds and GuiControls screen layouts; the sliders live in the port's single Options modal.

## Still open
- Key rebinding UI and the key_* options.txt entries.
- options.txt persistence format.
- Sources for music, records and ambient sounds.
- The non-native "Sound" on/off switch, which is still present.
- The Touchscreen option.
- Integrator: fold this into parity.md, parity-roadmap.md, PROJECT.md and the version bump.
