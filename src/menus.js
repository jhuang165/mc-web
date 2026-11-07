// The 1.7.10 menu screens as Gui screens (menu-ui.js): GuiMainMenu, GuiSelectWorld, GuiCreateWorld,
// GuiYesNo (delete), GuiRenameWorld, GuiIngameMenu, GuiOptions, GuiVideoSettings, GuiControls,
// GuiScreenOptionsSounds, GuiLanguage and GuiShareToLan. Layouts and strings are in menu-screens.js. Buttons the
// browser cannot act on (Multiplayer, Realms, Quit, ...) keep their places, drawn disabled
// with a reason. main.js supplies `ctx` (options, worlds and the game actions).
import {
  t, textWidth, COLOR, pickSplash, splashScale, LOGO, MINCERAFT_LOGO,
  mainMenuLayout, selectWorldLayout, createWorldLayout, yesNoLayout, renameWorldLayout, ingameMenuLayout, shareToLanLayout,
  optionsLayout, VIDEO_OPTIONS, videoSettingsLayout, CONTROLS_OPTIONS, controlsLayout, KEY_ENTRY, soundsLayout, languageLayout,
  FLOAT_OPTIONS, denormalize, normalize, optionText, soundText, folderName, worldLines, WORLD_TYPES, worldTypeIndex,
  KEY_BINDINGS, keyListEntries, keyName, javaHash, chatOptionsLayout, confirmLinkLayout,
} from "./menu-screens.js";
import { lwjglCode, mouseCode } from "./keybindings.js";
import { CHAT_SETTING_DEFAULTS } from "./settings.js";
import { canGoEndless } from "./endless-world.js";
import { achievementsScreen } from "./achievements-ui.js";
import { statsScreen } from "./stats-screen.js";
import { PLAYER_NAME } from "./death-messages.js";
import { flatWorldScreen } from "./flat-gui.js";
import { DEFAULT_FLAT_STRING } from "./flat-world.js";
import { resourcePacksScreen } from "./resource-packs-ui.js";

const SOUND_KEYS = ["master", "music", "record", "weather", "block", "hostile", "neutral", "player", "ambient"];
// Why each unavailable vanilla button is disabled here.
export const UNAVAILABLE = {
  multiplayer: "Multiplayer needs a connection to a Minecraft server, which a web page cannot open.",
  online: "Minecraft Realms is an online Mojang service; this browser recreation has no account sign-in.",
  quit: "A web page cannot close its own tab. Close the tab to quit.",
  superSecret: "Super Secret Settings needs the 1.7.10 post-processing shaders, which this renderer does not have.",
  stream: "Twitch broadcasting was a desktop-only feature; a web page cannot stream.",
  showCape: "There are no accounts or capes in this browser build, so the Show Cape button is drawn disabled.",
  snooper: "This build sends no usage data, so there is nothing to configure.",
  forceUnicode: "Only the default font and the English (US) strings are bundled.",
  touchscreen: "Touch input in this browser build uses its own on-screen controls.",
  fixedVideo: "This renderer has no switch for this setting; the button shows what it always does.",
  mapFeatures: "Structure generation is fixed by the world type in this browser build.",
  anaglyph: "3D Anaglyph needs the red/cyan two-pass renderer, which this build does not have.",
};
// The renderer's fixed state, shown by the disabled video buttons.
const FIXED = { ANAGLYPH: false, TOUCHSCREEN: false, FORCE_UNICODE_FONT: false };
// GameSettings fields of the options the port implements.
const FIELDS = { FOV: "fov", SENSITIVITY: "sensitivity", GAMMA: "gamma", RENDER_DISTANCE: "distance", VIEW_BOBBING: "bobbing", GUI_SCALE: "guiScale", PARTICLES: "particles", DIFFICULTY: "difficulty", INVERT_MOUSE: "invertMouse", GRAPHICS: "graphics", AMBIENT_OCCLUSION: "ao", RENDER_CLOUDS: "clouds", MIPMAP_LEVELS: "mipmapLevels", ANISOTROPIC_FILTERING: "anisotropic",
  CHAT_VISIBILITY: "chatVisibility", CHAT_COLOR: "chatColors", CHAT_LINKS: "chatLinks", CHAT_OPACITY: "chatOpacity", CHAT_LINKS_PROMPT: "chatLinksPrompt",
  CHAT_SCALE: "chatScale", CHAT_HEIGHT_FOCUSED: "chatHeightFocused", CHAT_HEIGHT_UNFOCUSED: "chatHeightUnfocused", CHAT_WIDTH: "chatWidth", SHOW_CAPE: "showCape",
  // GameSettings.limitFramerate (frame-limit.js) and enableVsync (saved; requestAnimationFrame is always vsynced).
  FRAMERATE_LIMIT: "maxFps", ENABLE_VSYNC: "vsync" };
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
// SaveFormatComparator: the most recently played first, then by folder name.
export const sortWorlds = (worlds) => [...worlds].sort((a, b) => (b.updated || 0) - (a.updated || 0) || cmp(a.folder || folderName(a.name || "World"), b.folder || folderName(b.name || "World")));

export function createMenus(gui, ctx) {
  const show = (s) => gui.show(s);
  const close = () => ctx.closeScreen();
  const keyOf = (description) => ctx.bindings.code(description);
  const value = (o) => (o === "USE_FULLSCREEN" ? !!document.fullscreenElement : o in FIELDS ? ctx.options[FIELDS[o]] ?? CHAT_SETTING_DEFAULTS[FIELDS[o]] : FIXED[o]);
  // GuiOptionSlider / GuiOptionButton for a GameSettings.Options entry.
  function optionWidget(g, o, r, parent) {
    const fixed = !(o in FIELDS) && o !== "USE_FULLSCREEN";
    const reason = o === "SHOW_CAPE" ? UNAVAILABLE.showCape : o === "TOUCHSCREEN" ? UNAVAILABLE.touchscreen : o === "ANAGLYPH" ? UNAVAILABLE.anaglyph : fixed ? UNAVAILABLE.fixedVideo : "";
    if (o in FLOAT_OPTIONS) {
      return g.slider(r, {
        parent, reason,
        value: normalize(o, value(o)),
        label: optionText(o, value(o)),
        change(v) {
          const raw = denormalize(o, v);
          ctx.options[FIELDS[o]] = raw;
          ctx.saveOptions();
          return { value: normalize(o, raw), label: optionText(o, raw) };
        },
      });
    }
    return g.button(r, optionText(o, value(o)), async (h) => {
      // GameSettings.setOptionValue(option, 1).
      const opts = ctx.options;
      if (o === "GUI_SCALE") opts.guiScale = (opts.guiScale + 1) & 3;
      else if (o === "PARTICLES") opts.particles = (opts.particles + 1) % 3;
      else if (o === "DIFFICULTY") opts.difficulty = (opts.difficulty + 1) & 3;
      else if (o === "AMBIENT_OCCLUSION") opts.ao = ((opts.ao ?? 2) + 1) % 3; // (ambientOcclusion + 1) % 3
      else if (o === "CHAT_VISIBILITY") opts.chatVisibility = (value(o) + 1) % 3; // EnumChatVisibility.getEnumChatVisibility((id + 1) % 3)
      else if (o === "USE_FULLSCREEN") await ctx.toggleFullscreen();
      else opts[FIELDS[o]] = !value(o);
      if (o !== "USE_FULLSCREEN") ctx.saveOptions();
      h.set(optionText(o, value(o)));
      // GuiVideoSettings.mouseClicked: a new GUI scale re-runs setWorldAndResolution.
      if (o === "GUI_SCALE") gui.build();
    }, { parent, reason });
  }

  // --- GuiMainMenu ---
  function mainMenu() {
    const start = performance.now(), splash = pickSplash(ctx.splashes), logo = Math.random() < 1e-4 ? MINCERAFT_LOGO : LOGO;
    let splashEl = null;
    return {
      id: "title",
      background: () => "panorama",
      // panoramaTimer counts ticks from when the screen opened, plus the partial tick.
      panoramaTimer: (now) => (now - start) / 50,
      escape() {},
      init(g, w, h) {
        const L = mainMenuLayout(w, h);
        const box = g.image("mc-logo", L.logo[0], L.logo[1], 310, 44);
        box.setAttribute("role", "img");
        box.setAttribute("aria-label", "Minecraft");
        for (const [u, v, pw, ph, dx] of logo) g.image("", dx, 0, pw, ph, box).style.backgroundPosition = `calc(${-u}*var(--u)) calc(${-v}*var(--u))`;
        // glTranslatef(width / 2 + 90, 70), glRotatef(-20), glScalef(f); drawCenteredString at (0, -8).
        splashEl = g.image("mc-splash", L.splash[0], L.splash[1], 0, 0);
        g.text(splash, 0, -8, { center: true, color: COLOR.splash, parent: splashEl });
        this.frame();
        g.text("Minecraft 1.7.10", L.version[0], L.version[1]);
        g.text("Copyright Mojang AB. Do not distribute!", L.copyright[0], L.copyright[1], { right: true });
        const b = L.buttons;
        g.button(b.singleplayer, t("menu.singleplayer"), () => show(selectWorld()));
        g.button(b.multiplayer, t("menu.multiplayer"), null, { reason: UNAVAILABLE.multiplayer });
        g.button(b.online, t("menu.online"), null, { reason: UNAVAILABLE.online });
        g.button(b.options, t("menu.options"), () => show(optionsScreen(mainMenu)));
        g.button(b.quit, t("menu.quit"), null, { reason: UNAVAILABLE.quit });
        g.languageButton(b.language, () => show(languageScreen(mainMenu)));
      },
      frame() {
        if (splashEl) splashEl.style.transform = `rotate(-20deg) scale(${splashScale(splash, Date.now())})`;
      },
    };
  }

  // --- GuiSelectWorld ---
  function selectWorld() {
    let selected = -1, scroll = 0, records = [], list, buttons;
    const screen = {
      id: "select-world",
      escape: close,
      init(g, w, h) {
        const L = selectWorldLayout(w, h);
        // initGui reloads the list (selection -1) and creates the world buttons disabled.
        records = sortWorlds(ctx.worlds);
        selected = -1;
        list = g.slotList(L.list, {
          count: records.length,
          scroll,
          selected: (i) => i === selected,
          entry(i, y, parent, x) {
            const [name, folder, mode] = worldLines(records[i], i);
            g.text(name, x + 2, y + 1, { parent });
            g.text(folder, x + 2, y + 12, { color: COLOR.gray, parent });
            g.text(mode, x + 2, y + 12 + 10, { color: COLOR.gray, parent });
          },
          click(i, double) {
            selected = i;
            for (const k of ["select", "rename", "delete", "recreate", "export"]) buttons[k].enable(true);
            buttons.endless.enable(canGoEndless(records[i]));
            if (double) { g.sound(); play(); }
          },
        });
        g.text(t("selectWorld.title"), L.title[0], L.title[1], { center: true });
        const b = L.buttons, record = () => records[selected];
        const play = () => { const r = record(); if (r) ctx.launch(r); };
        buttons = {
          select: g.button(b.select, t("selectWorld.select"), play),
          create: g.button(b.create, t("selectWorld.create"), () => show(createWorld(screen))),
          rename: g.button(b.rename, t("selectWorld.rename"), () => show(renameWorld(record(), screen))),
          delete: g.button(b.delete, t("selectWorld.delete"), () => {
            const r = record();
            show(yesNo({
              line1: t("selectWorld.deleteQuestion"),
              line2: "'" + worldLines(r, selected)[0] + "' " + t("selectWorld.deleteWarning"),
              yes: t("selectWorld.deleteButton"),
              no: t("gui.cancel"),
              async done(ok) {
                if (ok) await ctx.deleteWorld(r);
                show(screen);
              },
            }));
          }),
          recreate: g.button(b.recreate, t("selectWorld.recreate"), () => show(createWorld(screen, record()))),
          cancel: g.button(b.cancel, t("gui.cancel"), () => show(mainMenu())),
          // Browser additions: .blockworld.json import and export.
          import: g.button(b.import, "Import", () => ctx.importWorld()),
          export: g.button(b.export, "Export", () => { const r = record(); if (r) ctx.exportWorld(r); }),
          // Browser addition: an endless copy of a finite Java world; the original stays as it is.
          endless: g.button(b.endless, "Endless", () => {
            const r = record();
            if (!canGoEndless(r)) return;
            show(yesNo({
              line1: "Make an endless copy of this world?",
              line2: "'" + worldLines(r, selected)[0] + "' stays as it is.",
              yes: "Make Copy",
              no: t("gui.cancel"),
              async done(ok) {
                if (ok) await ctx.makeEndless(r);
                show(screen);
              },
            }));
          }),
        };
        for (const k of ["select", "rename", "delete", "recreate", "export", "endless"]) buttons[k].enable(false);
      },
      close() { scroll = list?.scroll ?? 0; },
    };
    return screen;
  }

  // --- GuiCreateWorld ---
  function createWorld(parent, from = null) {
    const types = WORLD_TYPES;
    const state = {
      name: from ? t("selectWorld.newWorld.copyOf", from.name) : t("selectWorld.newWorld"),
      seed: from ? String(from.seed ?? "") : "",
      type: Math.max(0, from ? worldTypeIndex(from) : 0),
      mode: from?.mode === "creative" ? "creative" : "survival",
      more: false,
      created: false,
      // GuiCreateWorld.field_146340_t / field_146339_u: Allow Cheats is off by default; changing the game mode sets it (creative on,
      // survival off) until the button has been pressed by hand.
      allowCommands: false,
      manualCommands: false,
      // GuiCreateWorld.field_146334_a (the generator string of a Superflat world) and field_146338_v (Bonus Chest).
      options: from?.generatorOptions ?? DEFAULT_FLAT_STRING,
      bonus: from?.bonusChest === true,
    };
    let name, seed, create;
    const folder = () => folderName(state.name, (s) => ctx.worlds.some((w) => (w.folder || folderName(w.name || "World")) === s));
    const submit = () => {
      if (!create.enabled || state.created) return;
      state.created = true;
      ctx.launch(ctx.makeRecord({
        name: state.name.trim() || folder(),
        folder: folder(),
        seed: state.seed.trim() || String(Math.floor(Math.random() * 2147483647)),
        biome: types[state.type].biome,
        worldType: types[state.type].worldType,
        mode: state.mode,
        allowCommands: state.allowCommands,
        generatorOptions: state.options,
        bonusChest: state.bonus,
      }));
      // launch closes the screen; a world that failed to open leaves it usable.
      state.created = false;
    };
    const screen = {
      id: "create-world",
      // keyTyped never calls GuiScreen.keyTyped, so Escape does nothing here; Enter creates.
      escape() {},
      key(e) {
        if (e.code === "Enter" || e.code === "NumpadEnter") { submit(); return true; }
        return false;
      },
      init(g, w, h) {
        const L = createWorldLayout(w, h), b = L.buttons, gray = { color: COLOR.label };
        g.text(t("selectWorld.create"), L.title[0], L.title[1], { center: true });
        const front = [], back = [];
        // The name page.
        front.push(g.text(t("selectWorld.enterName"), ...L.labels.enterName, gray).el);
        const result = g.text("", ...L.labels.resultFolder, gray);
        front.push(result.el);
        const line1 = g.text("", ...L.labels.line1, gray), line2 = g.text("", ...L.labels.line2, gray);
        front.push(line1.el, line2.el);
        // More World Options.
        back.push(g.text(t("selectWorld.enterSeed"), ...L.labels.enterSeed, gray).el);
        back.push(g.text(t("selectWorld.seedInfo"), ...L.labels.seedInfo, gray).el);
        back.push(g.text(t("selectWorld.mapFeatures.info"), ...L.labels.mapFeaturesInfo, gray).el);
        back.push(g.text(t("selectWorld.allowCommands.info"), ...L.labels.allowCommandsInfo, gray).el);
        let notice = null;
        const update = () => {
          // func_146314_g and func_146319_h.
          result.set(t("selectWorld.resultFolder") + " " + folder());
          create.enable(state.name.length > 0);
          gameMode.set(t("selectWorld.gameMode") + " " + t("selectWorld.gameMode." + state.mode));
          line1.set(t(`selectWorld.gameMode.${state.mode}.line1`));
          line2.set(t(`selectWorld.gameMode.${state.mode}.line2`));
          mapFeatures.set(t("selectWorld.mapFeatures") + " " + t(types[state.type].biome.startsWith("java") ? "options.on" : "options.off"));
          mapType.set(t("selectWorld.mapType") + " " + types[state.type].name);
          bonusItems.set(t("selectWorld.bonusItems") + " " + t(state.bonus ? "options.on" : "options.off"));
          allowCommands.set(t("selectWorld.allowCommands") + " " + t(state.allowCommands ? "options.on" : "options.off"));
          notice?.remove();
          notice = state.more && types[state.type].notice ? g.splitText(types[state.type].notice, ...L.notice, COLOR.label) : null;
        };
        const page = () => {
          // func_146316_a: which buttons and text the page shows.
          gameMode.show(!state.more);
          for (const k of [mapFeatures, bonusItems, mapType, allowCommands]) k.show(state.more);
          customize.show(state.more && types[state.type].worldType === "flat");
          moreOptions.set(state.more ? t("gui.done") : t("selectWorld.moreWorldOptions"));
          name.show(!state.more);
          seed.show(state.more);
          for (const e of front) e.hidden = state.more;
          for (const e of back) e.hidden = !state.more;
          (state.more ? seed : name).focus();
          update();
        };
        create = g.button(b.create, t("selectWorld.create"), submit);
        g.button(b.cancel, t("gui.cancel"), () => show(parent));
        // Survival -> Creative -> Survival; Hardcore is skipped (no hardcore worlds in this build).
        const gameMode = g.button(b.gameMode, "", () => {
          state.mode = state.mode === "survival" ? "creative" : "survival";
          if (!state.manualCommands) state.allowCommands = state.mode === "creative";
          update();
        });
        const moreOptions = g.button(b.moreOptions, "", () => { state.more = !state.more; page(); });
        const mapFeatures = g.button(b.mapFeatures, "", null, { reason: UNAVAILABLE.mapFeatures });
        const bonusItems = g.button(b.bonusItems, t("selectWorld.bonusItems") + " " + t("options.off"), () => { state.bonus = !state.bonus; update(); });
        // actionPerformed id 5: the next type clears field_146334_a (the Superflat string) and re-runs func_146316_a, so Customize follows.
        const mapType = g.button(b.mapType, "", () => { state.type = (state.type + 1) % types.length; state.options = DEFAULT_FLAT_STRING; page(); });
        const allowCommands = g.button(b.allowCommands, t("selectWorld.allowCommands") + " " + t("options.off"), () => { state.manualCommands = true; state.allowCommands = !state.allowCommands; update(); });
        const customize = g.button(b.customize, t("selectWorld.customizeType"), () => {
          // GuiCreateFlatWorld: Done stores info.toString() and returns to this screen; Cancel and Escape change nothing.
          show(flatWorldScreen({ show, icon: ctx.icon, options: state.options, done: (s) => { state.options = s; show(screen); }, cancel: () => show(screen) }));
        });
        name = g.field(L.field, { value: state.name, label: t("selectWorld.enterName"), input: (v) => { state.name = v; update(); } });
        seed = g.field(L.field, { value: state.seed, label: t("selectWorld.enterSeed"), input: (v) => { state.seed = v; } });
        page();
      },
    };
    return screen;
  }

  // --- GuiYesNo ---
  function yesNo({ line1, line2, yes, no, done }) {
    return {
      id: "confirm",
      escape: close,
      init(g, w, h) {
        const L = yesNoLayout(w, h);
        g.text(line1, ...L.line1, { center: true });
        g.text(line2, ...L.line2, { center: true });
        g.button(L.buttons.yes, yes, () => done(true));
        g.button(L.buttons.no, no, () => done(false));
      },
    };
  }

  // --- GuiRenameWorld ---
  function renameWorld(record, parent) {
    let text = record.name || "";
    let rename;
    const submit = async () => {
      if (!rename.enabled) return;
      await ctx.renameWorld(record, text.trim());
      show(parent);
    };
    return {
      id: "rename-world",
      escape() {},
      key(e) {
        if (e.code === "Enter" || e.code === "NumpadEnter") { submit(); return true; }
        return false;
      },
      init(g, w, h) {
        const L = renameWorldLayout(w, h);
        g.text(t("selectWorld.renameTitle"), ...L.title, { center: true });
        g.text(t("selectWorld.enterName"), ...L.label, { color: COLOR.label });
        rename = g.button(L.buttons.rename, t("selectWorld.renameButton"), submit);
        g.button(L.buttons.cancel, t("gui.cancel"), () => show(parent));
        g.field(L.field, { value: text, focus: true, label: t("selectWorld.enterName"), input: (v) => { text = v; rename.enable(v.trim().length > 0); } });
        rename.enable(text.trim().length > 0);
      },
    };
  }

  // --- GuiIngameMenu ---
  function ingameMenu() {
    return {
      id: "game-menu",
      escape: close,
      init(g, w, h) {
        const L = ingameMenuLayout(w, h), b = L.buttons;
        g.text(t("menu.game"), ...L.title, { center: true });
        g.button(b.returnToMenu, t("menu.returnToMenu"), (h) => { h.enable(false); ctx.goHome(); });
        g.button(b.returnToGame, t("menu.returnToGame"), () => ctx.resume());
        g.button(b.options, t("menu.options"), () => show(optionsScreen(ingameMenu)));
        // GuiIngameMenu: enabled while singleplayer and the integrated server is not public yet.
        g.button(b.shareToLan, t("menu.shareToLan"), () => show(shareToLan(ingameMenu)), { enabled: !ctx.lanOpen() });
        g.button(b.achievements, t("gui.achievements"), () => show(achievementsScreen({
          achievements: ctx.achievements, icon: ctx.icon, hash: javaHash(PLAYER_NAME), back: ingameMenu, close, show,
          keyName: () => keyName(keyOf("key.inventory")), inventoryKey: () => keyOf("key.inventory"),
        })));
        g.button(b.stats, t("gui.stats"), () => show(statsScreen({ stats: ctx.stats, icon: ctx.icon, back: ingameMenu, show })));
        // Browser addition in the row vanilla leaves empty: download the world.
        g.button(b.export, "Export World", () => ctx.exportWorld());
      },
    };
  }

  // --- GuiShareToLan --- (lan.js: what starting a LAN world can do in a browser)
  function shareToLan(parent) {
    let mode = "survival", cheats = false;
    return {
      id: "share-to-lan",
      escape: close,
      init(g, w, h) {
        const L = shareToLanLayout(w, h), b = L.buttons;
        g.text(t("lanServer.title"), ...L.title, { center: true });
        g.text(t("lanServer.otherPlayers"), ...L.otherPlayers, { center: true });
        g.button(b.start, t("lanServer.start"), () => ctx.shareToLan(mode, cheats));
        g.button(b.cancel, t("gui.cancel"), () => show(parent()));
        // actionPerformed 104: survival -> creative -> adventure -> survival.
        const modeLabel = () => t("selectWorld.gameMode") + " " + t("selectWorld.gameMode." + mode);
        const cheatsLabel = () => t("selectWorld.allowCommands") + " " + t(cheats ? "options.on" : "options.off");
        g.button(b.gameMode, modeLabel(), (button) => {
          mode = mode === "survival" ? "creative" : mode === "creative" ? "adventure" : "survival";
          button.set(modeLabel());
        });
        g.button(b.allowCommands, cheatsLabel(), (button) => { cheats = !cheats; button.set(cheatsLabel()); });
      },
    };
  }

  // --- GuiOptions ---
  function optionsScreen(parent) {
    const screen = {
      id: "options",
      escape: close,
      init(g, w, h) {
        const L = optionsLayout(w, h), b = L.buttons;
        g.text(t("options.title"), ...L.title, { center: true });
        optionWidget(g, "FOV", b.fov);
        // The difficulty button exists only with a world loaded.
        if (ctx.inGame()) optionWidget(g, "DIFFICULTY", b.difficulty);
        g.button(b.superSecret, "Super Secret Settings...", null, { reason: UNAVAILABLE.superSecret });
        g.button(b.sounds, t("options.sounds"), () => show(soundsScreen(screen)));
        g.button(b.stream, t("options.stream"), null, { reason: UNAVAILABLE.stream });
        g.button(b.video, t("options.video"), () => show(videoScreen(screen)));
        g.button(b.controls, t("options.controls"), () => show(controlsScreen(screen)));
        g.button(b.language, t("options.language"), () => show(languageScreen(() => screen)));
        // GuiOptions.actionPerformed 101: the "Multiplayer Settings..." button opens ScreenChatOptions.
        g.button(b.multiplayer, t("options.multiplayer.title"), () => show(chatOptionsScreen(screen)));
        g.button(b.resourcepack, t("options.resourcepack"), () => show(resourcePacksScreen(ctx, () => screen, show)));
        g.button(b.snooper, t("options.snooper.view"), null, { reason: UNAVAILABLE.snooper });
        g.button(b.done, t("gui.done"), () => { ctx.saveOptions(); show(parent()); });
      },
    };
    return screen;
  }

  // --- ScreenChatOptions ---
  function chatOptionsScreen(parent) {
    return {
      id: "chat-options",
      escape: close,
      init(g, w, h) {
        const L = chatOptionsLayout(w, h);
        g.text(t("options.chat.title"), ...L.title, { center: true });
        g.text(t("options.multiplayer.title"), ...L.subtitle, { center: true });
        for (const [o, r] of L.options) optionWidget(g, o, r);
        // SHOW_CAPE is a GuiOptionButton; there are no skins or capes here, so it is drawn disabled (value ON, the default).
        optionWidget(g, "SHOW_CAPE", L.cape);
        g.button(L.buttons.done, t("gui.done"), () => { ctx.saveOptions(); show(parent); });
      },
    };
  }

  // --- GuiConfirmOpenLink ---
  // `done(yes)` runs after the screen closes: Yes opens the link, Copy to Clipboard copies it (then both return to the chat).
  function confirmOpenLink(url, done) {
    return {
      id: "confirm-link",
      escape: () => done(false),
      init(g, w, h) {
        const L = confirmLinkLayout(w, h), b = L.buttons;
        g.text(t("chat.link.confirm"), ...L.title, { center: true });
        g.text(url, ...L.url, { center: true });
        g.text(t("chat.link.warning"), ...L.warning, { center: true, color: 0xffcc4c });
        g.button(b.yes, t("gui.yes"), () => done(true));
        g.button(b.copy, t("chat.copy"), () => { ctx.copyText?.(url); done(false); });
        g.button(b.no, t("gui.no"), () => done(false));
      },
    };
  }

  // --- GuiVideoSettings ---
  function videoScreen(parent) {
    let scroll = 0, list;
    return {
      id: "video-settings",
      escape: close,
      init(g, w, h) {
        const L = videoSettingsLayout(w, h), rows = Math.ceil(VIDEO_OPTIONS.length / 2);
        list = g.slotList(L.list, {
          count: rows,
          scroll,
          entry(i, y, parent) {
            for (let k = 0; k < 2; k++) {
              const o = VIDEO_OPTIONS[i * 2 + k];
              if (o) optionWidget(g, o, { x: L.columns[k], y, w: 150, h: 20 }, parent);
            }
          },
        });
        g.text(t("options.videoTitle"), ...L.title, { center: true });
        g.button(L.buttons.done, t("gui.done"), () => { ctx.saveOptions(); show(parent); });
      },
      close() { scroll = list?.scroll ?? 0; },
    };
  }

  // --- GuiControls ---
  // Every KeyBinding of GameSettings.keyBindings; ctx.bindings is the game's KeyBindings (keybindings.js).
  function controlsScreen(parent) {
    let scroll = 0, list, editing = null, screenRef;
    const binds = ctx.bindings;
    const entries = keyListEntries();
    const maxLabel = Math.max(...KEY_BINDINGS.map((k) => textWidth(t(k.description))));
    // setOptionKeyBinding (saves options.txt) and resetKeyBindingArrayAndHash.
    const setKey = (description, code) => {
      binds.setKeyCode(description, code);
      ctx.saveOptions();
    };
    const capture = (e) => {
      // mouseClicked while a key is being set: the button becomes the binding (-100 + button).
      if (!editing) return;
      e.preventDefault();
      e.stopPropagation();
      setKey(editing, mouseCode(e.button));
      editing = null;
      gui.build();
    };
    screenRef = {
      id: "controls",
      // GuiControls.time: when keyTyped last took a key (dispatchKeypresses ignores it for 20 ms).
      time: -Infinity,
      escape: close,
      key(e) {
        if (!editing) return false;
        // keyTyped while a key is being set: Escape (1) unbinds it (NONE), any other key binds its code.
        e.preventDefault();
        const code = lwjglCode(e);
        setKey(editing, code === 1 ? 0 : code);
        editing = null;
        screenRef.time = performance.now();
        gui.build();
        return true;
      },
      init(g, w, h) {
        const L = controlsLayout(w, h);
        gui.layer.addEventListener("pointerdown", capture, true);
        list = g.slotList(L.list, {
          count: entries.length,
          scroll,
          entry(i, y, parent, x) {
            const e = entries[i];
            if (e.category) {
              // CategoryEntry: centred at y + slotHeight - FONT_HEIGHT - 1, no shadow.
              const name = t(e.category);
              g.text(name, Math.trunc(w / 2) - Math.trunc(textWidth(name) / 2), y + KEY_ENTRY.categoryY, { shadow: false, parent });
              return;
            }
            const k = e.key, code = binds.code(k.description), name = t(k.description);
            g.text(name, x + KEY_ENTRY.label - maxLabel, y + KEY_ENTRY.labelY, { shadow: false, parent });
            // KeyEntry: the key button shows "> NAME <" while it is being set, red when another key shares it.
            let label = keyName(code);
            if (editing === k.description) label = "\u00a7f> \u00a7e" + label + "\u00a7f <";
            else if (binds.conflict(k.description)) label = "\u00a7c" + label;
            const [kx, kw, kh] = KEY_ENTRY.key, [rx, rw, rh] = KEY_ENTRY.reset;
            g.button({ x: x + kx, y, w: kw, h: kh }, label ?? "", () => {
              editing = k.description;
              gui.build();
            }, { parent });
            g.button({ x: x + rx, y, w: rw, h: rh }, t("controls.reset"), () => { setKey(k.description, k.lwjgl); gui.build(); }, { parent, enabled: code !== k.lwjgl });
          },
        });
        g.text(t("controls.title"), ...L.title, { center: true });
        CONTROLS_OPTIONS.forEach((o, i) => optionWidget(g, o, L.options[i]));
        g.button(L.buttons.done, t("gui.done"), () => show(parent));
        // Reset Keys (enabled while any key differs from its default) resets every binding and the
        // hash without saving options.txt, as GuiControls does.
        g.button(L.buttons.resetAll, t("controls.resetAll"), () => { binds.resetAll(); gui.build(); }, { enabled: binds.changed() });
      },
      close() { scroll = list?.scroll ?? 0; gui.layer.removeEventListener("pointerdown", capture, true); },
    };
    // Rebuilding keeps the scroll position.
    const init = screenRef.init;
    screenRef.init = (g, w, h) => { gui.layer.removeEventListener("pointerdown", capture, true); scroll = list?.scroll ?? scroll; init(g, w, h); };
    return screenRef;
  }

  // --- GuiScreenOptionsSounds ---
  function soundsScreen(parent) {
    return {
      id: "sounds",
      escape: close,
      init(g, w, h) {
        const L = soundsLayout(w, h);
        g.text(t("options.sounds.title"), ...L.title, { center: true });
        for (const k of SOUND_KEYS) {
          const level = ctx.soundLevel(k);
          g.slider(L.sliders[k], {
            value: level,
            label: soundText(k, level),
            releaseSound: true,
            change(v) {
              ctx.options.soundLevels = { ...ctx.options.soundLevels, [k]: v };
              ctx.saveOptions();
              return { value: v, label: soundText(k, v) };
            },
          });
        }
        g.button(L.buttons.done, t("gui.done"), () => { ctx.saveOptions(); show(parent); });
      },
    };
  }

  // --- GuiLanguage ---
  function languageScreen(parent) {
    return {
      id: "language",
      escape: close,
      init(g, w, h) {
        const L = languageLayout(w, h);
        // Only en_US.lang is bundled.
        g.slotList(L.list, {
          count: 1,
          selected: () => true,
          entry(i, y, parent) { g.text("English (US)", Math.trunc(w / 2), y + 1, { center: true, parent }); },
        });
        g.text(t("options.language"), ...L.title, { center: true });
        g.text("(" + t("options.languageWarning") + ")", ...L.warning, { center: true, color: COLOR.gray });
        optionWidget(g, "FORCE_UNICODE_FONT", L.buttons.forceUnicode);
        g.button(L.buttons.done, t("gui.done"), () => show(parent()));
      },
    };
  }

  return { mainMenu, selectWorld, ingameMenu, optionsScreen, createWorld, chatOptionsScreen, confirmOpenLink };
}
