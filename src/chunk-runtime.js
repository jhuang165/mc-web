// Durable runtime payloads are owned by the column containing their position.
// The live systems still hold paused, visited entities in their existing collections.
const ARRAYS = ['entities','drops','projectiles','arrows','tnt','farms','xpOrbs','falling','spawners'];
const TICKS = ['fluidTicks','fireTicks','fallingTicks'];
const key = (x,z) => `${Math.floor(x/16)},${Math.floor(z/16)}`;
export function splitRuntime(record) {
  const metadata = structuredClone(record), columns = new Map();
  const column = (x,z) => {
    const k=key(x,z); let c=columns.get(k);
    if (!c) { const [cx,cz]=k.split(',').map(Number); columns.set(k,c={world:record.id,x:cx,z:cz,state:{}}); }
    return c.state;
  };
  const put = (name, e, order) => {
    const [x,z]=name==='farms'?String(e[0]).split(',').filter((_,i)=>i!==1).map(Number):[e.x,e.z];
    if (![x,z].every(Number.isFinite)) throw new Error(`Invalid ${name} position`);
    const state=column(x,z); (state[name]??=[]).push({order,value:e});
  };
  for (const name of ARRAYS) { (metadata[name]??[]).forEach((e,i)=>put(name,e,i)); delete metadata[name]; }
  for (const name of TICKS) {
    const ticks=metadata[name]; delete metadata[name];
    if (!ticks) continue;
    (metadata.tickClocks??={})[name]={version:ticks.version,time:ticks.time};
    ticks.entries?.forEach((e,i)=>put(name,e,i));
  }
  metadata.minecartHeader=metadata.minecarts ? {...metadata.minecarts,carts:undefined} : metadata.minecartHeader;
  metadata.minecarts?.carts?.forEach((e,i)=>put('carts',e,i)); delete metadata.minecarts;
  for (const name of ['chests','furnaces']) {
    for (const [k,v] of Object.entries(metadata.player?.[name]??{})) {
      const [x,,z]=k.split(',').map(Number); if (![x,z].every(Number.isFinite)) throw new Error('Invalid container position');
      (column(x,z)[name]??={})[k]=v;
    }
    if (metadata.player) delete metadata.player[name];
  }
  metadata.runtimeChunked=true;
  return {metadata,columns:[...columns.values()]};
}
export function joinRuntime(metadata, columns) {
  const record=structuredClone(metadata), lists=new Map();
  for (const c of columns) for (const [name,values] of Object.entries(c.state)) {
    if (name==='chests'||name==='furnaces') { ((record.player??={})[name]??={}); Object.assign(record.player[name],values); }
    else { if (!lists.has(name)) lists.set(name,[]); lists.get(name).push(...values); }
  }
  const ordered = name => (lists.get(name)??[]).sort((a,b)=>a.order-b.order).map(e=>e.value);
  for (const name of ARRAYS) record[name]=ordered(name);
  for (const name of TICKS) if (record.tickClocks?.[name]) record[name]={...record.tickClocks[name],entries:ordered(name)};
  record.minecarts={version:1,...record.minecartHeader,carts:ordered('carts')};
  if (record.player) {record.player.chests??={};record.player.furnaces??={};}
  delete record.tickClocks; delete record.minecartHeader;
  return record;
}
export function hasRuntime(record) { return ARRAYS.some(n=>n in record)||TICKS.some(n=>n in record)||'minecarts' in record||!!record.player?.chests||!!record.player?.furnaces; }
