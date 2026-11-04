import { readContainerColumns } from './world-storage.js';
import { Survival } from './survival.js';
import { validateContainerColumns } from './chunk-runtime.js';

const columnKey=(x,z)=>`${Math.floor(x/16)},${Math.floor(z/16)}`;
const owner=position=>{const [x,,z]=position.split(',').map(Number);return columnKey(x,z);};
const coords=k=>k.split(',').map(Number);
// The same persisted representation as Survival.serialize, without copying player state.
function inventories(player) {
  const columns=new Map();
  for(const name of ['chests','furnaces','dispensers','hoppers','brewing'])for(const [position,value] of Object.entries(player[name]??{})) {
    const k=owner(position);if(!columns.has(k))columns.set(k,{});
    const saved=structuredClone(name==='chests'?{facing:value.facing,items:value.items}:value);
    (columns.get(k)[name]??={})[position]=saved;
  }
  return columns;
}
const fingerprint=state=>JSON.stringify(state??{});

export class ContainerResidency {
  constructor(world,id,survival,{scope=[],read=readContainerColumns,onError=()=>{}}={}) {
    Object.assign(this,{world,id,survival,read,onError});
    this.live=new Set([...world.chunks.keys(),...scope.map(c=>c.join(',')),...inventories(survival).keys()]);
    this.cache=new Map();this.pending=new Map();this.saving=new Map();this.durable=new Map();
    this.wanted=new Set(world.chunks.keys());this.disposed=false;this.failed=null;this.bounds=null;
  }
  columns(x,z,margin=0) {
    const {minX,minZ}=this.world.windowAt(x,z),out=[];
    for(let cx=minX/16-margin;cx<minX/16+8+margin;cx++)for(let cz=minZ/16-margin;cz<minZ/16+8+margin;cz++)out.push([cx,cz]);
    return out;
  }
  async ensure(columns) {
    if(this.disposed)return;
    const missing=columns.filter(c=>{const k=c.join(',');return !this.live.has(k)&&!this.cache.has(k)&&!this.pending.has(k);});
    if(missing.length) {
      const job=this.read(this.id,missing).then(records=>{
        if(this.disposed)return;
        // Reject the complete batch before any column becomes ready.
        validateContainerColumns(records,missing);
        for(const c of records)if(!this.live.has(`${c.x},${c.z}`))this.cache.set(`${c.x},${c.z}`,c.state);
      }).catch(e=>{if(!this.disposed){this.failed=e;this.onError(e);}throw e;}).finally(()=>{for(const c of missing)this.pending.delete(c.join(','));});
      for(const c of missing)this.pending.set(c.join(','),job);
    }
    await Promise.all([...new Set(columns.map(c=>this.pending.get(c.join(','))).filter(Boolean))]);
  }
  ready(x,z) {return this.columns(x,z).every(c=>this.live.has(c.join(','))||this.cache.has(c.join(',')));}
  admit() {
    for(const k of this.world.chunks.keys())if(!this.live.has(k)) {
      if(!this.cache.has(k))throw new Error('Saved containers are not ready');
      const restored=new Survival(this.cache.get(k));
      Object.assign(this.survival.chests,restored.chests);Object.assign(this.survival.furnaces,restored.furnaces);Object.assign(this.survival.dispensers,restored.dispensers);Object.assign(this.survival.hoppers,restored.hoppers);Object.assign(this.survival.brewing??={},restored.brewing??{});
      this.cache.delete(k);this.live.add(k);
    }
  }
  update(x,z) {
    if(this.disposed)return [];
    const columns=this.columns(x,z,1);this.wanted=new Set(columns.map(c=>c.join(',')));
    const bounds=`${this.world.minX},${this.world.minZ}`,changed=bounds!==this.bounds;
    this.bounds=bounds;
    const evicted=changed?this.trim():[];
    for(const k of this.cache.keys())if(!this.wanted.has(k)&&!this.world.chunks.has(k))this.cache.delete(k);
    if(!this.failed)this.ensure(columns).catch(()=>{});
    return evicted;
  }
  beginSave(player) {
    const states=inventories(player);
    for(const k of states.keys())this.live.add(k);
    const scope=[...this.live];
    for(const k of scope)this.saving.set(k,(this.saving.get(k)??0)+1);
    return {scope,states};
  }
  finishSave(token,ok) {
    for(const k of token.scope) {
      if(ok)this.durable.set(k,fingerprint(token.states.get(k)));
      const n=this.saving.get(k)-1;if(n)this.saving.set(k,n);else this.saving.delete(k);
    }
    return this.trim();
  }
  trim() {
    if(this.disposed)return [];
    const candidates=[...this.live].filter(k=>!this.wanted.has(k)&&!this.world.chunks.has(k)&&!this.saving.has(k));
    if(!candidates.length)return [];
    const states=inventories(this.survival),evicted=[];
    for(const k of candidates)if(this.durable.get(k)===fingerprint(states.get(k))) {
      for(const name of ['chests','furnaces','dispensers','hoppers','brewing'])for(const position of Object.keys(this.survival[name]))if(owner(position)===k)delete this.survival[name][position];
      this.live.delete(k);this.durable.delete(k);this.cache.delete(k);evicted.push(k);
    }
    return evicted;
  }
  // Release the last autosave's duplicate inventories too. Its scope describes
  // that snapshot; newly admitted columns enter the scope only on the next save.
  pruneRecord(record) {
    if(this.disposed||!record?.containerScope)return;
    record.containerScope=record.containerScope.filter(c=>this.live.has(c.join(',')));
    for(const name of ['chests','furnaces','dispensers','hoppers','brewing'])for(const position of Object.keys(record.player?.[name]??{}))if(!this.live.has(owner(position)))delete record.player[name][position];
  }
  scope(token) {return token.scope.map(coords);}
  dispose() {this.disposed=true;this.cache.clear();this.durable.clear();}
}
