// The gun server's generation thread: streaming-generator.js createStreamWorker behind worker_threads, so StreamPrefetch drives it as it
// drives the browser's Worker (src/streaming-worker.js; server-world.js ServerColumns). Requests are answered in order, after init.
import { parentPort } from 'node:worker_threads';
import { createStreamWorker } from '../src/streaming-generator.js';

const fail = error => parentPort.postMessage({ type: 'error', message: String(error?.message ?? error) });
let queue = Promise.resolve(null);
parentPort.on('message', data => {
  queue = queue.then(async handle => {
    if (data?.type === 'init') return createStreamWorker(data);
    try { const { message, transfer } = handle(data); parentPort.postMessage(message, transfer); } catch (error) { fail(error); }
    return handle;
  }).catch(error => { fail(error); return null; });
});
