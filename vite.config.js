import {defineConfig} from 'vite';
// The streaming generation worker (src/streaming-worker.js) is a module worker that shares the
// page's generator code, including its dynamic import of the block registry.
export default defineConfig({build:{rollupOptions:{output:{manualChunks:{three:['three']}}}},worker:{format:'es'}});
