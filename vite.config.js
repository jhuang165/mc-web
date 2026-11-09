import {defineConfig} from 'vite';
import basePath, {normalizeBase} from './tools/vite-base-path.mjs';
import {execSync} from 'node:child_process';
// The gameplay build a gun server checks at join (protocol.js BUILD_ID): MC_GUNS_BUILD, else the checkout's commit, else 'dev'.
const build = process.env.MC_GUNS_BUILD || (() => { try { return execSync('git rev-parse --short=12 HEAD', {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim(); } catch { return 'dev'; } })();
// The streaming generation worker (src/streaming-worker.js) is a module worker that shares the
// page's generator code, including its dynamic import of the block registry.
// BASE_PATH (e.g. /mc-web/ for GitHub Pages) serves the build under a subpath; unset keeps the root.
const base = normalizeBase(process.env.BASE_PATH);
export default defineConfig({base,define:{__MC_BUILD__:JSON.stringify(build)},plugins:[basePath(base)],build:{rollupOptions:{output:{manualChunks:{three:['three']}}}},worker:{format:'es',plugins:()=>[basePath(base)]}});
