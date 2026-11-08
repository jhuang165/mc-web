// Serving the game under a subpath (GitHub Pages project sites live at /<repo>/).
// The source refers to public assets by root-absolute strings ("/media/1.7.10/...", "/audio/...", url('/fonts/...')),
// and the bundled sound manifest and resource-pack service worker do the same. With the default base "/" this plugin
// does nothing; with BASE_PATH=/mc-web/ it prefixes those strings in the bundle and in the copied public files, then
// fails the build if any root-absolute asset reference is left, so a new asset path cannot silently 404 on Pages.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOTS = ["media", "audio", "lang", "research", "fonts", "mods"];
// A quote, backtick or url( opener followed directly by one of the public roots.
const ASSET = new RegExp(`([\`"'(])/(${ROOTS.join("|")})/`, "g");
// Public files that carry root-absolute URLs the page fetches at runtime.
const PUBLIC_FILES = ["audio/1.7.10/manifest.json", "audio/1.7.10-streams/manifest.json", "resource-pack-sw.js"];

export function normalizeBase(raw) {
  if (!raw || raw === "/") return "/";
  return "/" + raw.replace(/^\/+|\/+$/g, "") + "/";
}

export function rebase(code, base) {
  if (base === "/") return code;
  return code
    .replace(ASSET, (_, open, root) => `${open}${base}${root}/`)
    // The resource-pack worker: its script URL and its scope, which may not reach above the script's directory.
    .replace(/(["'`])\/resource-pack-sw\.js\1/g, (_, q) => `${q}${base}resource-pack-sw.js${q}`)
    .replace(/scope:\s*(["'`])\/\1/g, (_, q) => `scope: ${q}${base}${q}`);
}

export function leftovers(code) {
  return [...code.matchAll(ASSET)].map((m) => m[0]);
}

export default function basePath(base) {
  let outDir = "dist";
  return {
    name: "mc-web-base-path",
    enforce: "pre",
    apply: () => base !== "/",
    configResolved(config) { outDir = config.build.outDir; },
    transform(code, id) {
      if (id.includes("node_modules") || !/\.(m?js|css)(\?|$)/.test(id)) return null;
      const out = rebase(code, base);
      return out === code ? null : { code: out, map: null };
    },
    generateBundle(_, bundle) {
      const bad = [];
      for (const [name, chunk] of Object.entries(bundle)) {
        const text = chunk.type === "chunk" ? chunk.code : typeof chunk.source === "string" ? chunk.source : null;
        if (!text) continue;
        // Already-rebased references contain the base, so only bare root-absolute ones remain in leftovers().
        const found = leftovers(text);
        if (found.length) bad.push(`${name}: ${[...new Set(found)].slice(0, 5).join(", ")}`);
      }
      if (bad.length) this.error(`root-absolute asset URLs left with base ${base}:\n${bad.join("\n")}`);
    },
    async writeBundle() {
      for (const rel of PUBLIC_FILES) {
        const file = join(outDir, rel);
        let text;
        try { text = await readFile(file, "utf8"); } catch { continue; } // the music streams are optional local installs
        await writeFile(file, rebase(text, base));
      }
    },
  };
}
