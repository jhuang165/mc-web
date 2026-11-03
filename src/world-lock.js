// One writable app per origin prevents stale shelves and concurrent simulation saves.
// Web Locks are released by the browser on tab/process exit, without lease races.
export async function acquireWorldWriter(locks = globalThis.navigator?.locks) {
  if (!locks) throw new Error('World storage needs a browser with Web Locks support');
  let release;
  const held=new Promise(resolve=>{release=resolve;});
  let resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  const request=locks.request('blockworld.storage.writer',{mode:'exclusive',ifAvailable:true},async lock=>{
    if (!lock) {rejectReady(new Error('Blockworld is already open in another tab. Close that tab, then reload here.'));return;}
    resolveReady(release);await held;
  });
  request.catch(rejectReady);
  return ready;
}
