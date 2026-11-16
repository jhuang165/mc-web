// ServerListEntryLanScan (bga) and the vertical placement of GuiMultiplayer's list (b77 worldflags77).
// Executed (public/research/gui-menus-reference.json rows GuiMultiplayer, +t300..+t1200, +servers1..4): the entry is the last row of the list
// (after the saved servers), draws "Scanning for games on your local network" centred on the screen at y + 12 (white) and the dots at y + 21
// (gray, 0x808080), with the dots chosen by Minecraft.getSystemTime() / 300 % 4: 0 "O o o", 1 "o O o", 2 "o o O", 3 "o O o".
// The same rows show the list's content sits at max(0, (viewHeight - contentHeight) / 2 - 2) under the usual 4 unit top margin when it is shorter
// than the view (viewHeight = bottom - top, contentHeight = rows * 36, the scan row included); Executed rows give 52 (empty list at 240 high),
// 34, 16 (one and two servers), 0 (three or more) and 7 (empty list at 150 high). The cause is not read from bytecode.
export const LAN_SCAN_DOTS = Object.freeze(['O o o', 'o O o', 'o o O', 'o O o']);
export const lanScanDots = (ms) => LAN_SCAN_DOTS[Math.trunc(ms / 300) % 4];
export const serverListOffset = (viewHeight, contentHeight) => Math.max(0, Math.trunc((viewHeight - contentHeight) / 2) - 2);
// Text y of the two lines inside the row whose top is `y`.
export const LAN_SCAN_LINE_Y = Object.freeze([12, 21]);
