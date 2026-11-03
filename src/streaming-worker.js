// Generation worker for streamed worlds; see streaming-generator.js. Requests are answered in order.
import { createStreamWorker } from './streaming-generator.js';

let queue = Promise.resolve(null);
self.onmessage = ({ data }) => {
  queue = queue.then(async (handle) => {
    if (data.type === 'init') return createStreamWorker(data);
    try {
      const { message, transfer } = handle(data);
      self.postMessage(message, transfer);
    } catch (error) {
      self.postMessage({ type: 'error', message: String(error?.message ?? error) });
    }
    return handle;
  }).catch((error) => {
    self.postMessage({ type: 'error', message: String(error?.message ?? error) });
    return null;
  });
};
