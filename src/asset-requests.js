// HTTP/2 can dispatch hundreds of atlas images at once. Bound the burst before
// it reaches a loopback reverse proxy; a failed image must still free its slot.
export function createAssetQueue(limit = 16) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Invalid asset concurrency');
  let active = 0;
  const pending = [];
  function pump() {
    while (active < limit && pending.length) {
      const { load, resolve, reject } = pending.shift();
      active++;
      void (async () => {
        try { resolve(await load()); }
        catch (error) { reject(error); }
        finally { active--; pump(); }
      })();
    }
  }
  return load => new Promise((resolve, reject) => { pending.push({ load, resolve, reject }); pump(); });
}

export const requestAsset = createAssetQueue();

// Static hosts briefly answer 5xx right after a deploy (seen on GitHub Pages),
// and one missing atlas tile aborts startup. `load(attempt)` is retried after
// each delay; the queue slot is released while waiting.
export const RETRY_DELAYS = [500, 2000];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function retryAsset(load, { delays = RETRY_DELAYS, wait = sleep } = {}) {
  for (let attempt = 0; ; attempt++) {
    try { return await load(attempt); }
    catch (error) { if (attempt >= delays.length) throw error; await wait(delays[attempt]); }
  }
}
// Distinct URL per retry so no cached failure is reused; the resource-pack
// service worker matches overrides by path, so the query does not affect them.
export const retryUrl = (url, attempt) => attempt ? url + (url.includes('?') ? '&' : '?') + 'retry=' + attempt : url;
