// F2 / key.screenshot: ScreenShotHelper.saveScreenshot (bbp). It reads the whole framebuffer after the frame is drawn (nothing is
// hidden or changed), writes screenshots/<yyyy-MM-dd_HH.mm.ss>[_N].png and returns the chat component screenshot.success with the
// file name underlined and clickable (OPEN_FILE), or screenshot.failure with the exception message. The browser version
// downloads the PNG instead of writing to a folder, and captures the 3D canvas only (the DOM HUD is not part of the WebGL canvas).
import { screenshotName } from "./chat.js";
import { t } from "./menu-screens.js";

// The chat text and click spans for a saved file (the name is the underlined, clickable part).
export function successMessage(name) {
  return { text: t("screenshot.success", "§n" + name + "§r"), links: [{ text: name, click: { action: "open_file", value: name } }] };
}
export const failureMessage = (reason) => ({ text: t("screenshot.failure", String(reason)), links: [] });

// `capture(cb)` asks the renderer for a blob of the next drawn frame (cb(blob | null)); `save(blob, name)` stores it;
// `print({ text, links })` writes the result to chat. `taken(name)` is true for a name already used this session.
export function takeScreenshot({ capture, save, print, taken = () => false, now = () => new Date() }) {
  capture((blob) => {
    try {
      if (!blob) throw new Error("no image data");
      const name = screenshotName(now(), taken);
      save(blob, name);
      print(successMessage(name));
    } catch (e) {
      print(failureMessage(e.message));
    }
  });
}

// Browser download of a PNG blob.
export function downloadBlob(blob, name, doc = document) {
  const url = URL.createObjectURL(blob), a = doc.createElement("a");
  a.href = url;
  a.download = name;
  doc.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
