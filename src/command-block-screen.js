// GuiCommandBlock (bfh) on the bitmap FontRenderer path (menu-ui.js Gui). Read from the unchanged 1.7.10 bytecode with javap (not probed):
//   initGui: Done (id 0) at (w/2 - 4 - 150, h/4 + 120 + 12) and Cancel (id 1) at (w/2 + 4, same y), both 150 x 20; the command field
//   at (w/2 - 150, 50) 300 x 20, max length 32767, focused; the Previous Output field at (w/2 - 150, 135) 300 x 20, max length 32767,
//   disabled, filled from the tile's last output when it has one. Done is enabled while the trimmed command is not empty.
//   drawScreen: title advMode.setCommand centred at y 20 (white); "Console Command" at (w/2 - 150, 37) 0xA0A0A0; the three target
//   hints at (w/2 - 150, 75 + 9 * i) 0xA0A0A0; with a non-empty output field "Previous Output" at y 75 + 3 * 9 + 20 = 122 and the field.
//   keyTyped: Enter / numpad Enter presses Done when it is enabled; Escape presses Cancel. actionPerformed Done sends MC|AdvCdm
//   (position and command; the port applies it to the tile), both buttons close the screen.
// The 1.7.10 screen has no output-tracking toggle: the "O/X" button of earlier builds was an invention and is gone.
import { t } from "./menu-screens.js";
import { lastOutputPlainText } from "./chat-component.js";

const btn = (x, y, w, h = 20) => ({ x, y, w, h });
export function commandBlockLayout(w, h) {
  const c = Math.trunc(w / 2), y = Math.trunc(h / 4) + 120 + 12;
  return {
    title: [c, 20], commandLabel: [c - 150, 37], command: btn(c - 150, 50, 300), hints: [0, 1, 2].map((i) => [c - 150, 75 + 9 * i]),
    outputLabel: [c - 150, 75 + 3 * 9 + 20], output: btn(c - 150, 135, 300), done: btn(c - 4 - 150, y, 150), cancel: btn(c + 4, y, 150),
  };
}
/** The tile's last output as the field text (the stored chat component's text, or the raw string). */
export const lastOutputText = lastOutputPlainText;
export const COMMAND_HINTS = ["advMode.nearestPlayer", "advMode.randomPlayer", "advMode.allPlayers"];

/** `done(command)` applies the edit (Done), `cancel()` closes without it. */
export function commandBlockScreen({ command = "", lastOutput = null, done, cancel }) {
  const gray = 0xa0a0a0;
  return {
    id: "command-block",
    escape: cancel,
    init(g, w, h) {
      const L = commandBlockLayout(w, h);
      g.text(t("advMode.setCommand"), ...L.title, { center: true });
      g.text(t("advMode.command"), ...L.commandLabel, { color: gray });
      COMMAND_HINTS.forEach((k, i) => g.text(t(k), ...L.hints[i], { color: gray }));
      const text = lastOutputText(lastOutput);
      if (text) g.text(t("advMode.previousOutput"), ...L.outputLabel, { color: gray });
      const field = g.field(L.command, { value: command, maxLength: 32767, focus: true, label: t("advMode.command"), input: (v) => doneButton.enable(v.trim().length > 0) });
      if (text) {
        // setEnabled(false) (bcd.c(false)): drawn in the disabledColor 0x707070, not editable.
        const out = g.field(L.output, { value: text, maxLength: 32767, label: t("advMode.previousOutput"), enabled: false });
        out.el.tabIndex = -1;
      }
      const doneButton = g.button(L.done, t("gui.done"), () => done(field.value), { enabled: command.trim().length > 0 });
      g.button(L.cancel, t("gui.cancel"), cancel);
      this.field = field;
      this.press = () => { if (field.value.trim().length > 0) done(field.value); };
    },
    key(e) {
      if (e.code === "Enter" || e.code === "NumpadEnter") { this.press?.(); return true; }
      return false;
    },
  };
}
