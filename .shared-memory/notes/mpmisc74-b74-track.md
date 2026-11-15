# Batch 74 mpmisc74: dedicated server leftovers (brewing flag, /debug file, idle activity)

## Summary
- `src/multiplayer/server-debugfile.js` (new): `debugFileWriter(serverDir, fs)` writes `<server dir>/debug/<name>` (mkdir recursive first). `server/server.js` sets `simulation.saveDebugFile` from it (`debugFs` option, so tests can stub the disk). `server-worldcmds.js`: a server with a disk writer no longer keeps an in-memory copy.
- `src/multiplayer/server-idle.js` (new): `idleActivity(message, prev, chatAllowed)`, the exact set of activity packets. `ServerAdmin.activity` uses it (`looks` now holds `{current, sneak, sprint}`); `server/server.js` passes chat visibility.
- Brewing stand flag: no code change (found already right, see below).
- Tests: `src/mpmisc74-b74.test.js`; `mpadmin-b68.test.js` idle expectations updated.

## Evidence
- Bytecode-read (javap, 1.7.10 jar): CommandDebug `ak`: `new File(server.getFile("debug"), "profile-results-" + SimpleDateFormat("yyyy-MM-dd_HH.mm.ss") + ".txt")`, `getParentFile().mkdirs()`, FileWriter, IOException only logged. The text format (`profileResults` in `profiler.js`) was ported in batch 68 and matches `ak.b(long,int)` and `ak.a(int,String,StringBuilder)`.
- Bytecode-read: `NetHandlerPlayServer` (`nh`) idle check: `mw.x() > 0 && idle > 0 && now - mw.x() > idle * 60000` kicks "You have been idle for too long!". `mw.v()` (sets the time to wall-clock now; the constructor also sets it) is called only from the handlers for C07 (all), C08 (all), C09 (valid slot only), C01 (not when chat is hidden), C0A, C0B, C02 (all), C16, C10, C11, C12. Not from C03-C06 movement, C00, C0D, C0E, C0F, C13, C14, C15, C17.
- Brewing flag, bytecode-read plus the executed batch 71 `BrewingBoundsProbe`: the bounds live on the single `Block` instance, so they are per JVM. A dedicated server and its clients are separate JVMs, so separate flags are native; the port's server (Node process) and browser client already have separate `brewing.js` module state. Single player has one JVM (integrated server) and one module here, so the flag is shared, as natively. The listed gap is found wrong (nothing to fix); the test only pins the flip.
- Recalled, not checked: the native client sends C0B on sneak/sprint changes and C09 on slot changes; the port maps these to changes in the `input` message.

## Verification
- `node --check` on the touched files: clean.
- `node --test src/mpmisc74-b74.test.js src/mpadmin-b68.test.js src/mpworldcmds-b68.test.js`: 26 pass, 0 fail.
- `node --test src/serverprops2-b70.test.js src/serverprops-b69.test.js`: 25 pass, 0 fail.
- Full npm test not run (batch rule).

## Follow-ups
- Native idle uses wall-clock milliseconds; the port counts ticks at 50 ms, so a lagging server idles slightly later.
- The wire has no separate C0A swing or C09 message; `edit`/`dig` and the `input.current` change stand in.
- Only a real client could show the idle kick after walking in place.
