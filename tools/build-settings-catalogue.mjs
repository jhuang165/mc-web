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
  ANAGLYPH: ['Missing', 'No 3D anaglyph rendering.'],
  ADVANCED_OPENGL: ['Missing', 'No occlusion-culling toggle (WebGL renderer).'],
  FRAMERATE_LIMIT: ['Missing', 'Browser requestAnimationFrame pacing; no 10-260 limiter or "Unlimited".'],
  FBO_ENABLE: ['Missing', 'Not applicable to WebGL; no browser counterpart.'],
  DIFFICULTY: ['Implemented', 'Select Peaceful/Easy/Normal/Hard, default Normal (main.js, difficulty.js; difficulty.test.js, particle/difficulty references). Hardcore lock and server-side difficulty open.'],
  GRAPHICS: ['Missing', 'No Fast/Fancy toggle; one render quality. In progress (batch 11 render settings, render-settings.md).'],
  AMBIENT_OCCLUSION: ['Missing', 'Smooth lighting always on (scene.js smoothFace); no Off/Minimum/Maximum selector. In progress (batch 11 render settings, render-settings.md).'],
  GUI_SCALE: ['Implemented', 'Since 0.23.2: Auto/Small/Normal/Large only (settings.js GUI_SCALE_NAMES, values masked with & 3, saved "Larger" migrates to Large); gui.js guiScale() uses the native 320x240 loop. A select replaces the cycling button.'],
  RENDER_CLOUDS: ['Missing', 'Fancy clouds always rendered (sky.js); no toggle.'],
  PARTICLES: ['Implemented', 'All/Decreased/Minimal select, default All, native filtering and rain attempts (particle-settings.js; particle-settings.test.js).'],
  CHAT_VISIBILITY: ['Missing', 'Chat exists (chat.js, chat-ui.js) but is always shown; no Shown/Commands Only/Hidden mode and no option control.'],
  CHAT_COLOR: ['Missing', 'Chat exists but formatting codes always render; no Colors toggle.'],
  CHAT_LINKS: ['Missing', 'Chat exists but has no clickable links.'],
  CHAT_OPACITY: ['Partial', 'chat.js applies the native default (0.9 * opacity + 0.1 background alpha); no slider and not persisted.'],
  CHAT_LINKS_PROMPT: ['Missing', 'Chat exists but has no clickable links, so no prompt.'],
  SNOOPER_ENABLED: ['Missing', 'Mojang snooper telemetry; no counterpart and likely out of scope (needs acceptance decision).'],
  USE_FULLSCREEN: ['Partial', 'HUD fullscreen button uses the Fullscreen API (main.js); not an options.txt-style persisted option and no F11 binding.'],
  ENABLE_VSYNC: ['Missing', 'Not applicable to the browser; no counterpart.'],
  SHOW_CAPE: ['Missing', 'No cape rendering or toggle.'],
  TOUCHSCREEN: ['Missing', 'Mobile on-screen controls exist but are not the native touchscreen option.'],
  CHAT_SCALE: ['Partial', 'chat.js applies the native default scale 1; no slider and not persisted.'],
  CHAT_WIDTH: ['Partial', 'chat.js uses the native default width (320 plus 4); no slider and not persisted.'],
  CHAT_HEIGHT_FOCUSED: ['Partial', 'chat.js uses the native default (20 lines focused); no slider and not persisted.'],
  CHAT_HEIGHT_UNFOCUSED: ['Partial', 'chat.js uses the native default (10 lines unfocused); no slider and not persisted.'],
  MIPMAP_LEVELS: ['Missing', 'Textures upload with generateMipmaps=false (scene.js); no level setting. In progress (batch 11 render settings, render-settings.md).'],
  ANISOTROPIC_FILTERING: ['Missing', 'No anisotropic filtering setting.'],
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
const KEY_STATUS = {
  'key.attack': ['Partial', 'Left click mines/attacks; fixed, not rebindable.'],
  'key.use': ['Partial', 'Right click places/uses; fixed, not rebindable.'],
  'key.forward': ['Partial', 'KeyW fixed (main.js).'], 'key.left': ['Partial', 'KeyA fixed.'], 'key.back': ['Partial', 'KeyS fixed.'], 'key.right': ['Partial', 'KeyD fixed.'],
  'key.jump': ['Partial', 'Space fixed.'], 'key.sneak': ['Partial', 'ShiftLeft/ShiftRight fixed.'],
  'key.drop': ['Partial', 'KeyQ fixed (Ctrl+Q whole stack).'], 'key.inventory': ['Partial', 'KeyE fixed.'],
  'key.chat': ['Partial', 'KeyT opens the chat window (main.js, chat-ui.js); fixed, not rebindable.'], 'key.playerlist': ['Missing', 'No player list (GuiPlayerInfo); Tab only default-prevented.'],
  'key.pickItem': ['Partial', 'Middle click pick block (main.js); fixed.'], 'key.command': ['Partial', 'Slash opens chat pre-filled with "/" (main.js); fixed, not rebindable.'],
  'key.screenshot': ['Missing', 'No F2 screenshot.'], 'key.togglePerspective': ['Partial', 'F5 cycles first/behind/front; fixed.'],
  'key.smoothCamera': ['Partial', 'Unbound by default natively, and Minecraft.runTick toggles smoothCamera only through this binding (no F8 check in 1.7.10). Options > Controls rebinds it to a key or mouse button (saved on the device in options.keys; menus.js); smoothCamera is session-only (not in options.txt). MouseFilter.smooth, the 0.05 x curve tick filter and the partial-tick spread are ported (mouse-look.js; mouse-look.test.js). Not rebindable.'], 'key.sprint': ['Partial', 'ControlLeft/ControlRight fixed.'],
  'key.streamStartStop': ['Missing', 'Twitch streaming.'], 'key.streamPauseUnpause': ['Missing', 'Twitch streaming.'], 'key.streamCommercial': ['Missing', 'Twitch streaming.'], 'key.streamToggleMic': ['Missing', 'Twitch streaming.'],
  'key.fullscreen': ['Missing', 'HUD button exists; F11 key unbound.'],
};
for (let i = 1; i <= 9; i++) KEY_STATUS[`key.hotbar.${i}`] = ['Partial', `Digit${i} fixed; scroll also selects slots.`];
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
  GuiVideoSettings: 'Partial: the GuiOptionsRowList of two-column options (without Advanced OpenGL); render distance, view bobbing, GUI scale, brightness, particles and fullscreen work; Graphics, Smooth Lighting, Max Framerate, 3D Anaglyph, Clouds, VSync, Mipmap Levels and Anisotropic Filtering show the renderer\'s fixed state, disabled.',
  ScreenChatOptions: 'Missing: chat exists (chat.js) but there is no chat options screen; the Multiplayer/chat button in GuiOptions is drawn disabled and the chat settings stay at native defaults.',
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

Notable differences: loadOptions reads mouseSensitivity before invertYMouse and overrideHeight before overrideWidth. Not backed by an Options constant (saved GameSettings fields): resourcePacks, lastServer, lang, hideServerAddress, advancedItemTooltips, pauseOnLostFocus, overrideWidth, overrideHeight, heldItemTooltips, showInventoryAchievementHint, streamPreferredServer. Defaults for those are in the reference JSON (hideServerAddress false, advancedItemTooltips false, pauseOnLostFocus true, heldItemTooltips true, showInventoryAchievementHint true, lang en_US, overrideWidth/Height 0). Browser: pauseOnLostFocus is an unconditional window blur pause (Partial); advancedItemTooltips toggles with F3+H (Partial); the rest are Missing or not applicable. The port stores its own \`blockworld.settings\` localStorage JSON, not options.txt.

## Sound categories

| Ord | SoundCategory | options.txt key | Default volume | Browser status |
| --- | --- | --- | --- | --- |
${soundRows.join('\n')}

## Key bindings

Index is the position in GameSettings.keyBindings (saved as \`key_<description>:<code>\` in options.txt, one per entry; LWJGL 2 codes, negative values are mouse buttons offset by 100). Registration is the position in the static KeyBinding list, which is also construction order. The controls screen sorts a copy by localized category then localized description, so its displayed order needs the English lang file and is not derived here. Category HashSet iteration order: ${ref.keyCategoryHashSet.join(', ')}.

| Array index | Registration | Description key | Default key | Category | Browser status |
| --- | --- | --- | --- | --- | --- |
${keyRows.join('\n')}

The browser rebinds only Toggle Cinematic Camera (stored per device in options.keys, with Reset Keys), has no key conflict highlighting, no options.txt key persistence and otherwise uses fixed KeyboardEvent codes; every other Partial row is a fixed equivalent, not rebindable parity. Native F3 debug and F3+H are not KeyBindings; browser F3 behavior is outside this table.

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
