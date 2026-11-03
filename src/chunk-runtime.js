// Durable runtime payloads are owned by the column containing their position.
// The live systems still hold paused, visited entities in their existing collections.
const ARRAYS = ['entities','drops','projectiles','arrows','tnt','farms','xpOrbs','falling','spawners'];
const TICKS = ['fluidTicks','fireTicks','fallingTicks'];
const key = (x,z) => `${Math.floor(x/16)},${Math.floor(z/16)}`;
export function splitRuntime(record) {
  const metadata = structuredClone(record), columns = new Map();
  delete metadata.containerScope;
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
  for (const name of ['chests','furnaces','dispensers']) {
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
    if (name==='chests'||name==='furnaces'||name==='dispensers') { ((record.player??={})[name]??={}); Object.assign(record.player[name],values); }
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
export function hasRuntime(record) { return ARRAYS.some(n=>n in record)||TICKS.some(n=>n in record)||'minecarts' in record||!!record.player?.chests||!!record.player?.furnaces||!!record.player?.dispensers; }

// Stationary inventories have their own store so window reads do not deserialize
// the inventories of every visited column just to restore moving entities.
export function separateContainers(columns) {
  const runtime=[], containers=[];
  for (const c of columns) {
    const {chests,furnaces,dispensers,...state}=c.state, inventories={};
    if(chests&&Object.keys(chests).length)inventories.chests=chests;
    if(furnaces&&Object.keys(furnaces).length)inventories.furnaces=furnaces;
    if(dispensers&&Object.keys(dispensers).length)inventories.dispensers=dispensers;
    if(Object.keys(state).length)runtime.push({...c,state});
    if(Object.keys(inventories).length)containers.push({...c,state:inventories});
  }
  return {runtime,containers};
}

export function validateContainerColumns(records,coordinates) {
  const requested=new Set(coordinates.map(c=>c.join(','))),seen=new Set();
  for(const c of records) {
    const k=`${c?.x},${c?.z}`;
    if(!Number.isInteger(c?.x)||!Number.isInteger(c?.z)||!requested.has(k)||seen.has(k)||!c.state||typeof c.state!=='object'||Array.isArray(c.state))throw new Error('Saved containers are damaged');
    seen.add(k);
    for(const [name,values] of Object.entries(c.state)) {
      if(!['chests','furnaces','dispensers'].includes(name)||!values||typeof values!=='object'||Array.isArray(values))throw new Error('Saved containers are damaged');
      for(const [position,value] of Object.entries(values)) {
        const [x,,z]=position.split(',').map(Number);
        if(!/^-?\d+,\d+,-?\d+$/.test(position)||key(x,z)!==k||!value||typeof value!=='object'||Array.isArray(value))throw new Error('Saved containers are damaged');
      }
    }
  }
  if(seen.size!==requested.size)throw new Error('Saved containers are missing');
}
