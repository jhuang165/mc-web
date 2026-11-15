// Batch 74 mpmisc74: where /debug stop writes its profiler results on the dedicated server.
// Bytecode-read (CommandDebug ak, javap of the 1.7.10 jar): func_147205_a does `new File(MinecraftServer.getFile("debug"), "profile-results-" +
// new SimpleDateFormat("yyyy-MM-dd_HH.mm.ss").format(new Date()) + ".txt")`, `getParentFile().mkdirs()`, then `new FileWriter(file).write(text)` and
// `close()`; an IOException is only logged ("Could not save profiler results to <file>"). So the file goes under the server directory (the folder that
// holds server.properties here), as `debug/<name>`, with no atomic rename and no special mode. The text itself is profileResults() in profiler.js.
import path from 'node:path';

/**
 * The saveDebugFile(name, text) function of a dedicated simulation. `fs` is injectable ({ mkdirSync, writeFileSync }) so tests can stub the disk.
 * Errors propagate: the /debug handler (commands-extra.js) logs them as the native one does.
 */
export function debugFileWriter(serverDir, fs) {
  return (name, text) => {
    const dir = path.join(serverDir, 'debug');
    fs.mkdirSync(dir, { recursive: true }); // File.getParentFile().mkdirs()
    fs.writeFileSync(path.join(dir, name), text);
  };
}
