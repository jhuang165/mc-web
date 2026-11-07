import {defineConfig} from 'vite';
import basePath, {normalizeBase} from './tools/vite-base-path.mjs';
// The streaming generation worker (src/streaming-worker.js) is a module worker that shares the
// page's generator code, including its dynamic import of the block registry.
// BASE_PATH (e.g. /mc-web/ for GitHub Pages) serves the build under a subpath; unset keeps the root.
const base = normalizeBase(process.env.BASE_PATH);
export default defineConfig({base,plugins:[basePath(base)],build:{rollupOptions:{output:{manualChunks:{three:['three']}}}},worker:{format:'es',plugins:()=>[basePath(base)]}});
