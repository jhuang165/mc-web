import { readChunkColumns } from './world-storage.js';
const key=(x,z)=>`${x},${z}`;
// Prefetch durable edits separately from generated terrain. A missing/erroring read
// never counts as ready: the caller must not enter an unhydrated column.
export class StreamStorage {
  constructor(world,id,{read=readChunkColumns,onError=()=>{}}={}) {
    this.world=world;this.id=id;this.read=read;this.onError=onError;
    this.loaded=new Set();this.pending=new Map();this.disposed=false;this.failed=null;
  }
  columns(x,z,margin=0) {
    const {minX,minZ}=this.world.windowAt(x,z), out=[];
    for(let cx=minX/16-margin;cx<minX/16+8+margin;cx++) for(let cz=minZ/16-margin;cz<minZ/16+8+margin;cz++) out.push([cx,cz]);
    return out;
  }
  async ensure(columns) {
    if(this.disposed) return;
    const missing=columns.filter(c=>!this.loaded.has(key(...c))&&!this.pending.has(key(...c)));
    if(missing.length) {
      const job=this.read(this.id,missing).then(records=>{
        if(this.disposed)return;
        this.world.restoreColumns(records);
        for(const c of missing)this.loaded.add(key(...c));
      }).catch(e=>{if(!this.disposed){this.failed=e;this.onError(e);}throw e;}).finally(()=>{for(const c of missing)this.pending.delete(key(...c));});
      for(const c of missing)this.pending.set(key(...c),job);
    }
    await Promise.all([...new Set(columns.map(c=>this.pending.get(key(...c))).filter(Boolean))]);
  }
  update(x,z) {if(!this.failed&&!this.disposed)this.ensure(this.columns(x,z,1)).catch(()=>{});}
  ready(x,z) {return this.columns(x,z).every(c=>this.loaded.has(key(...c)));}
  dispose() {this.disposed=true;}
}
