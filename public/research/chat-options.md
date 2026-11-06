# Chat Settings, tab player list and F2 screenshots

Target: Minecraft Java 1.7.10. Evidence: `ChatOptionsProbe` (executes `GuiNewChat.func_146233_a/func_146243_b`, `EnumChatFormatting.getTextWithoutFormattingCodes` and the `EnumChatVisibility` table in the unchanged JAR) plus javap of `ScreenChatOptions` (bcs), `GuiChat` (bct), `GuiConfirmOpenLink` (bcu), `GuiNewChat` (bcc), `ScreenShotHelper` (bbp), `GuiIngame` (bbv), `NetHandlerPlayServer` (nh), `Minecraft.runTick` (bao) and `GameSettings.getKeyBinding` (bbj). Run `MC_RESEARCH=tools/research node tools/verify-chat-options.mjs` to regenerate `chat-options-reference.json`; `src/chat-options.test.js` replays it.

## Chat Settings (ScreenChatOptions)

GuiOptions "Multiplayer Settings..." opens it (bytecode: id 101 of GuiOptions shows ScreenChatOptions). Nine options in two columns at `w/2 - 155 + (i % 2) * 160`, `h/6 + 24 * (i >> 1)`: Chat (visibility button), Colors, Web Links, Opacity (slider), Prompt on Links, Scale, Focused Height, Unfocused Height, Width. The "Multiplayer Settings..." heading sits at `h/6 + 127`, Show Cape at `h/6 + 144`, Done at `h/6 + 168`. Labels: opacity `(int)(f*90+10)%`, scale `OFF` at 0 else `(int)(f*100)%`, width and heights in px through the GuiNewChat conversions (`floor(f*280+40)`, `floor(f*160+20)`). Values are saved in the device settings with the GameSettings defaults (`chatVisibility` 0, colours, links and prompt on, opacity/scale/width/focused height 1, unfocused 0.44366196, `showCape` true) and validated by `migrateSettings`.

Show Cape is drawn disabled: there are no accounts, skins or capes in this build.

## What the settings do

- Visibility (`options.chat.visibility`): the server side of 1.7.10 filters. `NetHandlerPlayServer.sendPacket` drops an S02PacketChat when the player is HIDDEN, and under SYSTEM (Commands Only) unless the packet's system flag is set. Player chat is sent with the flag false; command feedback, achievement and death broadcasts use the one-argument constructor (flag true). `printChat(text, id, system)` applies exactly that rule: death, bed, achievement and command output are system messages, the player's own chat line is not. HIDDEN also makes `GuiNewChat.drawChat` return and `Minecraft.runTick` skips opening GuiChat (`key.chat`/`key.command`). The `chat.cannotSend` reply is itself a gj sent through the same filter, so under HIDDEN it is dropped too (this is how the bytecode reads); tab-completion lists are printed locally and not filtered.
- Colours: when off, lines are stripped of `§0-9a-fk-or` codes at layout time (`func_146235_b`) and rewrapped when toggled.
- Width, scale, heights, opacity: `ChatLog` uses `chatWidth`/`chatHeight`, wraps at `floor(width / scale)`, draws at `scale`, and line alpha is multiplied by `0.9 * opacity + 0.1`. Changing a setting calls `ChatLog.refresh` (the `func_146245_b` rebuild from the stored 100 messages).
- Web links: vanilla 1.7.10 does not auto-link text; a click only follows a `ClickEvent` on a chat component. The browser has two producers: the screenshot file name (OPEN_FILE) and any message printed with link spans (OPEN_URL, SUGGEST_COMMAND, RUN_COMMAND). `GuiChat.mouseClicked` requires `chatLinks`, inserts the text with Shift, limits URL schemes to http/https, and with `chatLinksPrompt` opens `GuiConfirmOpenLink` (title `chat.link.confirm`, the URL, a `chat.link.warning` line in 0xFFCC4C, buttons Yes / Copy to Clipboard / No at `w/3 - 83` + 0/105/210, `h/6 + 96`). Yes opens a new tab (`window.open`, noopener); every choice returns to the chat with the typed text kept. OPEN_FILE does nothing in a browser.
- `§n` now renders underlined in `textHtml` (a colour code or `§r` clears it, as FontRenderer does).

## Tab player list

`GuiIngame.renderGameOverlay` draws it while `key.playerlist` (Tab) is held, unless `mc.isIntegratedServerRunning() && playerInfoList.size() <= 1 && no scoreboard objective`. So native single player, with only the local player, never shows it, and the browser can never have a second player. Decision: the list is shown while the world is Open to LAN (a documented deviation so the overlay is reachable and testable; native would still hide it for a lone host). Layout is exact: slots = max players (8 for `IntegratedPlayerList`), columns grow while rows exceed 20, column width `min(150, 300 / columns)`, block centred at y = 10, backdrop `0x80000000` from `(x0-1, 9)`, a `0x20FFFFFF` cell per slot, the name in white with shadow, and the ping sprite from `textures/gui/icons.png` at `(0, 176 + 8*row)` (10 x 8) drawn at `x + colWidth - 12`; row by latency: `<0` 5, `<150` 0, `<300` 1, `<600` 2, `<1000` 3, else 4. The local player has ping 0. No scoreboard column and no teams.

## F2 screenshot

`ScreenShotHelper.saveScreenshot` reads the framebuffer after the frame (it hides nothing; F1 hiding the HUD is a separate toggle and this build has no F1 toggle), writes `screenshots/<yyyy-MM-dd_HH.mm.ss>.png`, trying `_2`, `_3`, ... when the name exists, and returns `screenshot.success` with the file name underlined and clickable, or `screenshot.failure` with the exception message. The result is printed with `GuiNewChat.printChatMessage` directly, so it ignores chat visibility. The port calls `Scene.requestCapture`: the next `renderer.render` is followed by `canvas.toBlob` in the same task (no `preserveDrawingBuffer`), the PNG is downloaded under the native name, and the same message is printed. Approximate: only the WebGL canvas is saved, not the DOM HUD, hotbar or chat; the name uses the browser's local time; "taken" names are tracked for the session because a download folder cannot be probed; `key.screenshot` follows `options.keys` but is not rebindable in the menu.

## Open

- Real clickable producers beyond the screenshot name (no server sends click events here).
- Player list scoreboard objective column, teams, and other players.
- Screenshots include the HUD and chat.
- F1 hide-HUD, `options.txt` persistence of these settings.
