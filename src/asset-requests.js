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
