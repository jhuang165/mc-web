import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const research = new URL('../public/research/', import.meta.url);
const ref = JSON.parse(await readFile(new URL('settings-reference.json', research)));
assert.equal(ref.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
const { options, keyBindings, hotbarKeys, soundCategories, valueSets, enums, screenArrays, screenLayouts, gameSettingsFields } = ref;
assert.deepEqual([options.length, keyBindings.length, hotbarKeys.length, soundCategories.length, screenLayouts.length], [44, 32, 9, 9, 8]);

// options.txt key written/read for each Options constant, from saveOptions bytecode field binding (verified below against defaults).
export const OPTION_FILE_KEY = {
  INVERT_MOUSE: 'invertYMouse', SENSITIVITY: 'mouseSensitivity', FOV: 'fov', GAMMA: 'gamma', SATURATION: 'saturation', RENDER_DISTANCE: 'renderDistance',
  VIEW_BOBBING: 'bobView', ANAGLYPH: 'anaglyph3d', ADVANCED_OPENGL: 'advancedOpengl', FRAMERATE_LIMIT: 'maxFps', FBO_ENABLE: 'fboEnable', DIFFICULTY: 'difficulty',
  GRAPHICS: 'fancyGraphics', AMBIENT_OCCLUSION: 'ao', GUI_SCALE: 'guiScale', RENDER_CLOUDS: 'clouds', PARTICLES: 'particles', CHAT_VISIBILITY: 'chatVisibility',
  CHAT_COLOR: 'chatColors', CHAT_LINKS: 'chatLinks', CHAT_OPACITY: 'chatOpacity', CHAT_LINKS_PROMPT: 'chatLinksPrompt', SNOOPER_ENABLED: 'snooperEnabled',
  USE_FULLSCREEN: 'fullscreen', ENABLE_VSYNC: 'enableVsync', SHOW_CAPE: 'showCape', TOUCHSCREEN: 'touchscreen', CHAT_SCALE: 'chatScale', CHAT_WIDTH: 'chatWidth',
  CHAT_HEIGHT_FOCUSED: 'chatHeightFocused', CHAT_HEIGHT_UNFOCUSED: 'chatHeightUnfocused', MIPMAP_LEVELS: 'mipmapLevels', ANISOTROPIC_FILTERING: 'anisotropicFiltering',
  FORCE_UNICODE_FONT: 'forceUnicodeFont', STREAM_BYTES_PER_PIXEL: 'streamBytesPerPixel', STREAM_VOLUME_MIC: 'streamMicVolume', STREAM_VOLUME_SYSTEM: 'streamSystemVolume',
  STREAM_KBPS: 'streamKbps', STREAM_FPS: 'streamFps', STREAM_COMPRESSION: 'streamCompression', STREAM_SEND_METADATA: 'streamSendMetadata',
  STREAM_CHAT_ENABLED: 'streamChatEnabled', STREAM_CHAT_USER_FILTER: 'streamChatUserFilter', STREAM_MIC_TOGGLE_BEHAVIOR: 'streamMicToggleBehavior',
};
// Values that the GameSettings constructor holds in a different field type than the option accessor returns.
const fieldDefault = new Map(gameSettingsFields.filter(f => f.optionsKey).map(f => [f.optionsKey, f.defaultValue]));
for (const o of options) {
  const key = OPTION_FILE_KEY[o.name];
  assert(key, `no options.txt key for ${o.name}`);
  assert(ref.optionsFile.saveOrder.some(r => r.key === key), `${key} not saved`);
  if (o.default !== null) assert.equal(o.default, fieldDefault.get(key), `${o.name} default does not match ${key} field`);
}
assert.equal(Object.keys(OPTION_FILE_KEY).length, options.length);

// Browser status. Conservative: Verified is never used here; Implemented requires an exact native value set/default plus a named test.
const S = {
  INVERT_MOUSE: ['Implemented', 'Saved invertMouse switch "Invert Mouse" (en_US.lang), default off; negates the pitch argument of setAngles in plain and cinematic look, as the -1 multiplier in EntityRenderer.updateCameraAndRender (mouse-look.js; mouse-look.test.js, settings-catalogue.test.js). The "Invert Mouse: ON/OFF" button sits on the Controls screen beside Sensitivity, as in GuiControls (menus.js).'],
  SENSITIVITY: ['Partial', 'Since 0.23.2: slider 0-1 default 0.5 with the native EntityRenderer curve (settings.js lookCurve, f=s*0.6+0.2, f^3*8, Entity.setAngles 0.15 deg per unit) and native *yawn*/HYPERSPEED!!!/percent labels (settings.test.js). Mouse movement is gathered per frame, pitch clamps to +-90 degrees as in Entity.setAngles, and the cinematic camera (MouseFilter) uses the same curve (mouse-look.js). Browser movement is in CSS pixels, not LWJGL device pixels.'],
  FOV: ['Implemented', 'Since 0.23.2: slider 30-110 step 1, default 70, Normal/Quake Pro labels (main.js, settings.js; settings.test.js, settings-catalogue.test.js). Bow/sprint/flight FOV modifiers exist in bow.js and main.js; the modifier set is audited separately.'],
  GAMMA: ['Partial', 'Slider 0-1 default 0 (Moody) matches native range/default; scene.setGamma lightmap application and native label strings not audited against native output.'],
  SATURATION: ['Missing', 'Unused by 1.7.10 screens; no browser counterpart.'],
  RENDER_DISTANCE: ['Partial', 'Since 0.23.2: chunk slider 2-16 step 1, default 12 (the 64-bit JVM default), "N chunks" label; fog far plane renderDistanceChunks*16 (settings.js renderDistanceBlocks). Chunk loading/culling by distance is open because worlds are finite columns.'],
  VIEW_BOBBING: ['Partial', 'Toggle default on matches native; bobbing application not audited here.'],
  ANAGLYPH: ['Missing', 'No 3D anaglyph rendering; the Video Settings button is drawn disabled with a reason and options.txt keeps anaglyph3d (default false or an imported value).'],
  ADVANCED_OPENGL: ['Missing', 'No occlusion-culling toggle (WebGL renderer).'],
  FRAMERATE_LIMIT: ['Partial', 'Max Framerate slider 10-260 step 10 (260 "Unlimited"), default 120, saved as maxFps. The frame loop skips animation frames as Display.sync spaces them (max(next + 1000/fps, now)), 30 fps on the title screen as getLimitFramerate; frames cannot exceed the display refresh (frame-limit.js; controls.md).'],
  FBO_ENABLE: ['Missing', 'Not applicable to WebGL; no browser counterpart.'],
  DIFFICULTY: ['Implemented', 'Select Peaceful/Easy/Normal/Hard, default Normal (main.js, difficulty.js; difficulty.test.js, particle/difficulty references). Hardcore lock and server-side difficulty open.'],
  GRAPHICS: ['Implemented', 'Fast/Fancy button (menus.js), saved as options.graphics; Fast: opaque *_opaque leaves with leaf-to-leaf faces culled, flat 8-block clouds, rain/snow radius 5, flat sprite items, one blended translucent pass, no entity shadows (render-settings.js; render-settings.md). Fast clouds, vignette and sprite items are approximated, not byte-compared.'],
  AMBIENT_OCCLUSION: ['Implemented', 'Off = flat per-face light, Minimum = full smooth path, Maximum = partial-bounds path for non-full-cube bounds (lighting.js flatFace/partialFace; render-settings.md). Changing it rebuilds chunk meshes.'],
  GUI_SCALE: ['Implemented', 'Since 0.23.2: Auto/Small/Normal/Large only (settings.js GUI_SCALE_NAMES, values masked with & 3, saved "Larger" migrates to Large); gui.js guiScale() uses the native 320x240 loop. A select replaces the cycling button.'],
  RENDER_CLOUDS: ['Implemented', 'Clouds button (menus.js, saved as options.clouds); GameSettings.shouldRenderClouds also needs render distance >= 4 chunks; Fancy graphics draws the 3D layer, Fast the flat layer (sky.js).'],
  PARTICLES: ['Implemented', 'All/Decreased/Minimal select, default All, native filtering and rain attempts (particle-settings.js; particle-settings.test.js).'],
  CHAT_VISIBILITY: ['Partial', 'Chat Settings button cycles Shown/Commands Only/Hidden and is saved; printChat drops messages as NetHandlerPlayServer does (bytecode-read) and Hidden blocks opening chat. Player chat/commands from other players do not exist.'],
  CHAT_COLOR: ['Partial', 'Colors toggle saved; off strips codes at layout time (EnumChatFormatting.getTextWithoutFormattingCodes, probe-replayed) and rewraps.'],
  CHAT_LINKS: ['Partial', 'Web Links toggle saved; clicks run the ClickEvent of a span (screenshot file name, open_url). Vanilla 1.7.10 does not auto-link plain text, so nothing else is clickable; open_file is a no-op in a browser.'],
  CHAT_OPACITY: ['Partial', 'Slider in Chat Settings, saved; 0.9 * opacity + 0.1 line alpha as GuiNewChat; label (int)(f * 90 + 10)% is bytecode-read.'],
  CHAT_LINKS_PROMPT: ['Partial', 'Prompt on Links toggle saved; on, an http/https click opens GuiConfirmOpenLink (Yes opens a new tab, Copy to Clipboard, No); off opens at once.'],
  SNOOPER_ENABLED: ['Missing', 'Mojang snooper telemetry; no counterpart and likely out of scope (needs acceptance decision).'],
  USE_FULLSCREEN: ['Partial', 'The Video Settings button, the HUD button and key.fullscreen (F11, dispatchKeypresses) use the Fullscreen API (main.js); the options.txt mirror writes fullscreen:false (a browser cannot start in fullscreen).'],
  ENABLE_VSYNC: ['Partial', 'Use VSync toggles and saves enableVsync; requestAnimationFrame is always synchronized to the display, so turning it off cannot unlock frames above the refresh rate (controls.md).'],
  SHOW_CAPE: ['Partial', 'Button drawn disabled in Chat Settings (ON, the default); there are no skins or capes.'],
  TOUCHSCREEN: ['Missing', 'Mobile on-screen controls exist but are not the native touchscreen option.'],
  CHAT_SCALE: ['Partial', 'Slider, saved; wrap width floor(width / scale) and the drawn scale follow GuiNewChat; label OFF at 0 else (int)(f * 100)%.'],
  CHAT_WIDTH: ['Partial', 'Slider, saved; floor(f * 280 + 40) px (probe-replayed) and rewrapped; label in px.'],
  CHAT_HEIGHT_FOCUSED: ['Partial', 'Slider, saved; floor(f * 160 + 20) px / 9 lines (probe-replayed).'],
  CHAT_HEIGHT_UNFOCUSED: ['Partial', 'Slider, saved; floor(f * 160 + 20) px / 9 lines (probe-replayed).'],
  MIPMAP_LEVELS: ['Partial', '0-4 levels, default 4: per-tile TextureUtil.generateMipmapData chains with NEAREST_MIPMAP_LINEAR (block-textures.js, render-settings.js). Only the block atlas is mipmapped; other textures are not (render-settings.md).'],
  ANISOTROPIC_FILTERING: ['Partial', '1-16 snapped to a power of two, applied to the block atlas when EXT_texture_filter_anisotropic exists (clamped to the GPU maximum); other textures unchanged.'],
  FORCE_UNICODE_FONT: ['Missing', 'No Unicode font page switch.'],
  STREAM_BYTES_PER_PIXEL: ['Missing', 'Twitch streaming service; acceptance decision needed.'],
  STREAM_VOLUME_MIC: ['Missing', 'Twitch streaming service; acceptance decision needed.'],
  STREAM_VOLUME_SYSTEM: ['Missing', 'Twitch streaming service; acceptance decision needed.'],
  STREAM_KBPS: ['Missing', 'Twitch streaming service; acceptance decision needed.'],
  STREAM_FPS: ['Missing', 'Twitch streaming service; acceptance decision needed.'],
  STREAM_COMPRESSION: ['Missing', 'Twitch streaming service; acceptance decision needed.'],
  STREAM_SEND_METADATA: ['Missing', 'Twitch streaming service; acceptance decision needed.'],
  STREAM_CHAT_ENABLED: ['Missing', 'Twitch streaming service; acceptance decision needed.'],
  STREAM_CHAT_USER_FILTER: ['Missing', 'Twitch streaming service; acceptance decision needed.'],
  STREAM_MIC_TOGGLE_BEHAVIOR: ['Missing', 'Twitch streaming service; acceptance decision needed.'],
};
assert.deepEqual(Object.keys(S).sort(), options.map(o => o.name).sort());

const KEY_NAMES = { 0: 'NONE', 2: '1', 3: '2', 4: '3', 5: '4', 6: '5', 7: '6', 8: '7', 9: '8', 10: '9', 15: 'TAB', 16: 'Q', 17: 'W', 18: 'E', 20: 'T', 29: 'LCONTROL', 30: 'A', 31: 'S', 32: 'D', 42: 'LSHIFT', 53: 'SLASH', 57: 'SPACE', 60: 'F2', 63: 'F5', 64: 'F6', 65: 'F7', 87: 'F11', '-100': 'Mouse button 0 (left)', '-99': 'Mouse button 1 (right)', '-98': 'Mouse button 2 (middle)' };
const keyName = code => { assert(KEY_NAMES[code] !== undefined, `unnamed LWJGL code ${code}`); return `${KEY_NAMES[code]} (${code})`; };
// Every binding is rebindable on the Controls screen (keybindings.js, menus.js; controls.md); the rows say what the action does.
const R = 'Rebindable (LWJGL code; KeyBinding hash, later registration wins a shared code).';
const KEY_STATUS = {
  'key.attack': ['Partial', `${R} Mines/attacks while held; a keyboard binding works too.`],
  'key.use': ['Partial', `${R} Places/uses; releasing it stops using an item (bow).`],
  'key.forward': ['Partial', `${R} MovementInputFromOptions reads it held (player-input.js).`], 'key.left': ['Partial', `${R} Held strafe.`], 'key.back': ['Partial', `${R} Held.`], 'key.right': ['Partial', `${R} Held strafe.`],
  'key.jump': ['Partial', `${R} Held.`], 'key.sneak': ['Partial', `${R} Held; RSHIFT no longer sneaks by default, as natively.`],
  'key.drop': ['Partial', `${R} Drops one (Ctrl: the stack; the browser reads the Ctrl modifier, not LWJGL isCtrlKeyDown/Command on macOS); GuiContainer compares its code for the hovered slot.`], 'key.inventory': ['Partial', `${R} Opens the inventory; GuiContainer and GuiAchievements close on its code.`],
  'key.chat': ['Partial', `${R} Opens the chat window (chat-ui.js); GuiContainerCreative opens search with it.`], 'key.playerlist': ['Partial', `${R} Held draws the GuiIngame player list (player-list.js) only while Open to LAN is on: native 1.7.10 hides it for a lone integrated player, so showing it is a documented deviation; no other players or ping.`],
  'key.pickItem': ['Partial', `${R} Pick block (main.js); no GuiContainer clone through a keyboard binding.`], 'key.command': ['Partial', `${R} Opens chat pre-filled with "/".`],
  'key.screenshot': ['Partial', `${R} dispatchKeypresses in every screen: downloads the 3D canvas as yyyy-MM-dd_HH.mm.ss.png and prints screenshot.success/failure; the DOM HUD is not captured and the file is a download.`], 'key.togglePerspective': ['Partial', `${R} Cycles first/behind/front.`],
  'key.smoothCamera': ['Partial', `${R} Unbound by default natively, and Minecraft.runTick toggles smoothCamera only through this binding (no F8 check in 1.7.10); smoothCamera is session-only (not in options.txt). MouseFilter.smooth, the 0.05 x curve tick filter and the partial-tick spread are ported (mouse-look.js; mouse-look.test.js).`], 'key.sprint': ['Partial', `${R} Held (with the double-tap forward rule).`],
  'key.streamStartStop': ['Missing', `${R} No Twitch stream; the press does nothing.`], 'key.streamPauseUnpause': ['Missing', `${R} No Twitch stream.`], 'key.streamCommercial': ['Missing', `${R} No Twitch stream.`], 'key.streamToggleMic': ['Missing', `${R} No Twitch stream.`],
  'key.fullscreen': ['Partial', `${R} dispatchKeypresses toggles the Fullscreen API (also the HUD button).`],
};
for (let i = 1; i <= 9; i++) KEY_STATUS[`key.hotbar.${i}`] = ['Partial', `${R} Selects slot ${i}; GuiContainer swaps the hovered slot with it; scroll also selects slots.`];
assert.deepEqual(Object.keys(KEY_STATUS).sort(), keyBindings.map(k => k.description).sort());

// Every category has a 0-1 slider (default 1, "<soundCategory label>: OFF/N%") saved in soundLevels; audio.js applies
// SoundManager.getNormalizedVolume with the sounds.json category of the played event (settings.js; settings.test.js).
const ROUTED = 'Slider default 1 with the en_US label and OFF/percent value; audio.js multiplies sounds of this sounds.json category by its level inside getNormalizedVolume (clamp 0-1), skips 0 results and stops playing ones when set to 0 (settings.js normalizedVolume; settings.test.js).';
const SOUND_STATUS = {
  MASTER: ['Implemented', 'Master Volume slider default 1 with OFF/percent label. As in SoundManager: getSoundCategoryVolume(MASTER) is 1, the level is the master gain over every sound, and playSound skips all sounds at 0 (audio.js; settings.test.js). A non-native Sounds on/off switch remains.'],
  MUSIC: ['Partial', 'Slider and gain path exist, but the port has no MusicTicker, so no music category sound plays.'],
  RECORDS: ['Partial', 'Slider and gain path exist; the jukebox block and 12 discs exist (note-jukebox.md) but no record audio files are shipped, so no record plays.'],
  AMBIENT: ['Partial', 'Slider and gain path exist; only weather ambience is shipped (public/audio/1.7.10/ambient), no cave ambience.'],
};
const soundStatus = c => SOUND_STATUS[c] ?? ['Implemented', ROUTED];

const cell = v => String(v).replace(/\|/g, '\\|');
const f = v => (Number.isInteger(v) ? String(v) : String(Number(v)));
const typeOf = o => (o.isFloat ? 'float slider' : o.isBoolean ? 'boolean' : 'enumerated');
const rangeOf = o => (o.isFloat ? `${f(o.min)} to ${f(o.max)}, step ${f(o.step)}` : '—');
const setByOption = {
  DIFFICULTY: 'EnumDifficulty: ' + enums.find(e => e.class === 'rd').constants.map(c => `${c.ordinal} ${c.name}`).join(', '),
  CHAT_VISIBILITY: 'EnumChatVisibility: ' + enums.find(e => e.class === 'zb').constants.map(c => `${c.ordinal} ${c.name}`).join(', '),
  GRAPHICS: 'boolean fancyGraphics: options.graphics.fast / options.graphics.fancy',
};
for (const [role, name] of [['GUI_SCALES', 'GUI_SCALE'], ['PARTICLES', 'PARTICLES'], ['AMBIENT_OCCLUSION', 'AMBIENT_OCCLUSION'], ['STREAM_COMPRESSION', 'STREAM_COMPRESSION'], ['STREAM_CHAT_ENABLED', 'STREAM_CHAT_ENABLED'], ['STREAM_CHAT_USER_FILTER', 'STREAM_CHAT_USER_FILTER'], ['STREAM_MIC_TOGGLE_BEHAVIOR', 'STREAM_MIC_TOGGLE_BEHAVIOR']]) {
  const set = valueSets.find(v => v.role === role);
  assert(set, role);
  setByOption[name] = set.values.map((v, i) => `${i} ${v}`).join(', ');
}
const defaultOf = o => {
  if (o.name === 'DIFFICULTY') return '2 NORMAL';
  if (o.name === 'CHAT_VISIBILITY') return '0 FULL';
  const k = OPTION_FILE_KEY[o.name], d = fieldDefault.get(k);
  if (o.name === 'GRAPHICS') return `${d} (fancy)`;
  if (o.name === 'RENDER_DISTANCE') return `${d} chunks (64-bit JVM; 8 on 32-bit)`;
  if (o.name === 'FOV') return `${d} degrees`;
  return String(d);
};
const optionRows = options.map(o => `| ${o.ordinal} | ${o.name} | ${o.translationKey} | ${typeOf(o)} | ${rangeOf(o)} | ${cell(defaultOf(o))} | ${OPTION_FILE_KEY[o.name]} | ${cell(setByOption[o.name] ?? '—')} | ${S[o.name][0]}: ${cell(S[o.name][1])} |`);

const fileRows = ref.optionsFile.saveOrder.map((r, i) => {
  const load = ref.optionsFile.loadOrder.findIndex(l => l.key === r.key);
  return `| ${i + 1} | ${r.key} | ${r.srgField ?? '—'} | ${load >= 0 ? load + 1 : '—'} | ${r.note ?? ''} |`;
});

const keyRows = keyBindings.map(k => {
  const reg = ref.keyRegistrationOrder.findIndex(r => r.description === k.description);
  assert(reg >= 0);
  return `| ${k.index} | ${reg} | ${k.description} | ${keyName(k.defaultKey)} | ${k.category} | ${KEY_STATUS[k.description][0]}: ${cell(KEY_STATUS[k.description][1])} |`;
});
const soundRows = soundCategories.map(c => `| ${c.ordinal} | ${c.enum} | soundCategory_${c.key} | ${c.default} | ${soundStatus(c.enum)[0]}: ${cell(soundStatus(c.enum)[1])} |`);

const layoutNote = s => s.initEvents.map(e => e.string ?? e.widget?.replace(/^net\/minecraft\/client\/gui\//, '') ?? e.call).filter(x => x !== ':').join(' > ');
const arrayRows = screenArrays.map(a => `| ${a.mappedClass.replace(/^net\/minecraft\/client\/gui\//, '')}.${a.srgField} | ${a.options.map((o, i) => `${i + 1} ${o}`).join(', ')} |`);
const layoutRows = screenLayouts.map(s => `| ${s.mappedClass.replace(/^net\/minecraft\/client\/gui\//, '')} | ${cell(layoutNote(s))} |`);
const SCREEN_STATUS = {
  GuiOptions: 'Partial: the 1.7.10 layout and buttons (menus.js, menu-screens.js); FOV, difficulty (in a world), Music & Sounds, Video Settings, Controls and Language work; Super Secret Settings, Broadcast, Multiplayer, Resource Packs and Snooper are drawn disabled and explain why.',
  GuiVideoSettings: 'Partial: the GuiOptionsRowList of two-column options (without Advanced OpenGL); render distance, view bobbing, GUI scale, brightness, particles and fullscreen work; Graphics, Smooth Lighting, Clouds, Mipmap Levels and Anisotropic Filtering work (render-settings.js); Max Framerate, 3D Anaglyph and VSync show the renderer\'s fixed state, disabled.',
  ScreenChatOptions: 'Partial: Multiplayer Settings... in GuiOptions opens the screen with the nine native options in native order and positions (bytecode-read) and Done; Show Cape is drawn disabled. See chat-options.md.',
  GuiScreenOptionsSounds: 'Partial: its own screen with the full-width Master Volume row and the eight category sliders in two columns, en_US "<category>: <value>" labels, gui.button.press on release (menus.js).',
  GuiControls: 'Partial: Invert Mouse, Sensitivity and a disabled Touchscreen Mode button above the sorted GuiKeyBindingList with Reset and Reset Keys (menus.js); only key.smoothCamera can be rebound, the other keys are fixed by the browser game loop.',
  GuiLanguage: 'Partial: the screen with a one-entry list (English (US), the only bundled lang file), the accuracy warning and a disabled Force Unicode Font button.', GuiSnooper: 'Missing.', GuiScreenResourcePacks: 'Missing (fixed original assets).',
};
const screenStatusRows = screenLayouts.map(s => {
  const n = s.mappedClass.split('/').pop();
  assert(SCREEN_STATUS[n], n);
  return `| ${n} | ${SCREEN_STATUS[n]} |`;
});

const valueSetRows = valueSets.map(v => `| ${v.role} | ${v.srgField} | ${v.values.join(', ')} |`);
const counts = { options: options.length, floats: options.filter(o => o.isFloat).length, bools: options.filter(o => o.isBoolean).length, enums: options.filter(o => !o.isFloat && !o.isBoolean).length };
assert.deepEqual(counts, { options: 44, floats: 18, bools: 16, enums: 10 });
const statusCount = rows => ['Missing', 'Partial', 'Implemented'].map(s => `${rows.filter(r => r[0] === s).length} ${s}`).join(', ');

const md = `# Original settings and controls parity catalogue

Generated by \`node tools/build-settings-catalogue.mjs\`; refresh original evidence with \`node tools/verify-settings-catalogue.mjs\` (JDK, pinned client JAR, MCP SRG names and local libraries; also needs a Netty-all JAR and tiny verifier-only stubs under tools/probes/stubs). [Roadmap](parity-roadmap.md) · [GUI catalogue](gui-parity-catalogue.md) · [original evidence and provenance](settings-reference.json). Enumeration does not certify whole-feature parity; no row is marked Verified.

The original GameSettings.Options enum has **${counts.options} constants** (${counts.floats} float sliders, ${counts.bools} booleans, ${counts.enums} enumerated cycle options), plus **${keyBindings.length} KeyBindings** (23 named fields and 9 hotbar keys), **${soundCategories.length} SoundCategory entries** and **${screenLayouts.length} settings-related screens** inspected. Browser status counts: options ${statusCount(options.map(o => S[o.name]))}; key bindings ${statusCount(Object.values(KEY_STATUS))}; sound categories ${statusCount(soundCategories.map(c => soundStatus(c.enum)))}.

Evidence classes. Native-executed: Options static initialization and slider conversion methods, the unchanged GameSettings constructor run headlessly (a null-field Minecraft instance supplying only the isJava64bit flag, no options file), every constructed KeyBinding, SoundCategory constants/volumes, private string value arrays, EnumDifficulty/EnumChatVisibility and the static option arrays of GuiVideoSettings, ScreenChatOptions, GuiOptions and GuiControls. Bytecode-read: options.txt save/load key order and field binding, widget/string order in each screen initGui, display/cycle strings, and the mouse-look and sound gain constants (reference \`controls\`: EntityRenderer sensitivity curve, cinematic-camera factor 0.05, invert multiplier -1, MouseFilter.smooth, Entity.setAngles 0.15 degrees per unit and the [-90, 90] pitch clamp, SoundManager category/normalized volume clamp 0-1, pitch clamp 0.5-2, attenuation distance 16 x max(1, volume), and smoothCamera toggled only by key.smoothCamera). en_US.lang strings are read from the JAR (reference \`lang\`). Not executed: other locales, widget coordinates, controls-screen English sort order, per-click cycle arithmetic, resource pack and language list contents, snooper data. Render distance is 12 chunks here because the probe sets the 64-bit flag; the 32-bit path gives 8.

## Options (GameSettings.Options ordinal order)

| Ord | Native constant | Translation key | Type | Min/max/step | Default (constructor) | options.txt key | Value set | Browser status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${optionRows.join('\n')}

Float options without an explicit range use 0 to 1, step 0 (continuous). FOV is stored in options.txt as (degrees - 70) / 40 per saveOptions bytecode and read back by the inverse; the in-memory value is degrees. Slider normalize/denormalize results (e.g. RENDER_DISTANCE: 0 maps to 2, 0.5 to 9, 1 to 16) are in the reference JSON. GameSettings also clamps RENDER_DISTANCE maximum to 16 in its constructor. Display strings read from getKeyBinding bytecode: ${ref.optionDisplayStrings.filter(s => s.startsWith('options.')).join(', ')}.

## Value sets and enums

| Role | Native array field | Values (index order) |
| --- | --- | --- |
${valueSetRows.join('\n')}

Difficulty and chat visibility come from the EnumDifficulty and EnumChatVisibility constants (translation keys options.difficulty.{peaceful,easy,normal,hard}, options.chat.visibility.{full,system,hidden}). GRAPHICS is a boolean (fast/fancy).

## options.txt keys (saveOptions order; load order differs)

| Save position | Key | Native field (SRG) | Load position | Note |
| --- | --- | --- | --- | --- |
${fileRows.join('\n')}

Notable differences: loadOptions reads mouseSensitivity before invertYMouse and overrideHeight before overrideWidth. Not backed by an Options constant (saved GameSettings fields): resourcePacks, lastServer, lang, hideServerAddress, advancedItemTooltips, pauseOnLostFocus, overrideWidth, overrideHeight, heldItemTooltips, showInventoryAchievementHint, streamPreferredServer. Defaults for those are in the reference JSON (hideServerAddress false, advancedItemTooltips false, pauseOnLostFocus true, heldItemTooltips true, showInventoryAchievementHint true, lang en_US, overrideWidth/Height 0). Browser: pauseOnLostFocus toggles with F3+P and gates the 500 ms lost-focus pause (Partial: a lost pointer lock still pauses); advancedItemTooltips toggles with F3+H (Partial); the rest are Missing or not applicable. The port keeps its \`blockworld.settings\` localStorage JSON and mirrors a native-format options.txt (every line in saveOptions order, key_* as LWJGL codes, Float.toString values) in \`blockworld.options.txt\`, read with the loadOptions rules when no JSON save exists (options-txt.js; controls.md).

## Sound categories

| Ord | SoundCategory | options.txt key | Default volume | Browser status |
| --- | --- | --- | --- | --- |
${soundRows.join('\n')}

## Key bindings

Index is the position in GameSettings.keyBindings (saved as \`key_<description>:<code>\` in options.txt, one per entry; LWJGL 2 codes, negative values are mouse buttons offset by 100). Registration is the position in the static KeyBinding list, which is also construction order. The controls screen sorts a copy by localized category then localized description, so its displayed order needs the English lang file and is not derived here. Category HashSet iteration order: ${ref.keyCategoryHashSet.join(', ')}.

| Array index | Registration | Description key | Default key | Category | Browser status |
| --- | --- | --- | --- | --- | --- |
${keyRows.join('\n')}

Every binding is rebindable on the Controls screen (click, then press a key or click a mouse button; Escape unbinds), with red conflict labels, per-row Reset and Reset Keys. Codes are LWJGL 2 numbers mapped from KeyboardEvent.code (keybindings.js), stored as options.keyBindings and in the options.txt mirror as key_<description>:<code>. Rows stay Partial because the actions themselves are approximations and browser-reserved shortcuts cannot all be captured. Native F1/F3 and the F3 combinations are raw LWJGL codes, not KeyBindings (controls.md).

## Option screens

Static option arrays (native order; the two-column row list pairs entries left to right):

| Array | Options in order |
| --- | --- |
${arrayRows.join('\n')}

GuiOptions builds its FOV and difficulty widgets from its array (a hardcore string is also present for the locked difficulty case), plus Super Secret Settings, sounds, stream, video, controls, language, multiplayer title (chat options), resource packs and snooper buttons. GuiControls uses the INVERT_MOUSE/SENSITIVITY/TOUCHSCREEN array for option widgets alongside the key list. ScreenChatOptions has two arrays (chat options, then SHOW_CAPE). Exact widget positions are not derived. Ordered initGui strings and widget classes (bytecode-read, includes titles and buttons; ":" omitted):

| Screen | Ordered strings and widgets |
| --- | --- |
${layoutRows.join('\n')}

| Screen | Browser status |
| --- | --- |
${screenStatusRows.join('\n')}

## Gate

Gate **U** from the GUI catalogue applies to every screen row, plus settings storage/input: all control values above, options.txt-compatible persistence or an explicit adaptation decision, rebinding with conflict handling and Reset All, sound category routing, chat option behavior once chat exists, and fixed scene comparisons under supported video settings. Localized text and layout coordinates need the English lang and a GUI renderer run before any row can be Verified.
`;
await writeFile(new URL('settings-parity-catalogue.md', research), md);
console.log(`Wrote ${options.length} options, ${keyBindings.length} key bindings, ${soundCategories.length} sound categories, ${screenLayouts.length} screens.`);
