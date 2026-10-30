export const SIZE = 128, HEIGHT = 64, SEA = 16;
export const BLOCKS = [
  { name:'Air' }, { name:'Grass',color:'#71994d',top:'#83ab59',side:'#7d6244' },
  { name:'Dirt',color:'#866444' }, { name:'Stone',color:'#90918a' },
  { name:'Oak log',color:'#79603b',top:'#aa8e58' }, { name:'Leaves',color:'#4c783f' },
  { name:'Sand',color:'#d8c99a' }, { name:'Oak planks',color:'#b49462' },
  { name:'Brick',color:'#a66550' }, { name:'Glass',color:'#bcd9d4' },
  { name:'Water',color:'#5f9fbc' }, { name:'Bedrock',color:'#444941' }
];
export const HOTBAR = [1,2,3,4,5,6,7,8,9];
// Vanilla 1.7.10 values, located using MCP SRG mappings and javap; see research notes.
export const PHYSICS = Object.freeze({ tick:1/20, gravity:0.08, drag:Math.fround(0.98), jump:Math.fround(0.42), width:0.6, height:1.8, eye:1.62 });
export function fallingVelocity(v) { return (v-PHYSICS.gravity)*PHYSICS.drag; }
export function hashSeed(value) { let h=0; for(const c of String(value))h=(Math.imul(h,31)+c.charCodeAt(0))|0; return h; }
export function hash(x,z,seed) { let h=Math.imul(x,374761393)^Math.imul(z,668265263)^seed;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296; }
function noise(x,z,seed) {const ix=Math.floor(x),iz=Math.floor(z);let fx=x-ix,fz=z-iz;fx=fx*fx*(3-2*fx);fz=fz*fz*(3-2*fz);const a=hash(ix,iz,seed)*(1-fx)+hash(ix+1,iz,seed)*fx,b=hash(ix,iz+1,seed)*(1-fx)+hash(ix+1,iz+1,seed)*fx;return a*(1-fz)+b*fz;}
export class World {
  constructor(seed='Overworld',biome='meadow') {this.seed=String(seed);this.biome=biome;this.numericSeed=hashSeed(seed);this.data=new Uint8Array(SIZE*SIZE*HEIGHT);this.edits=new Map();this.generate();}
  index(x,y,z){return(x*SIZE+z)*HEIGHT+y;}
  inside(x,y,z){return x>=0&&x<SIZE&&z>=0&&z<SIZE&&y>=0&&y<HEIGHT;}
  get(x,y,z){if(y<0)return 11;if(!this.inside(x,y,z))return 0;return this.data[this.index(x,y,z)];}
  solid(x,y,z){const b=this.get(x,y,z);return b!==0&&b!==10;}
  set(x,y,z,b,track=true){if(!this.inside(x,y,z)||y===0||!Number.isInteger(b)||b<0||b>=BLOCKS.length)return false;this.data[this.index(x,y,z)]=b;if(track)this.edits.set(`${x},${y},${z}`,b);return true;}
  surface(x,z){for(let y=HEIGHT-1;y>0;y--)if(this.solid(x,y,z))return y+1;return 1;}
  generate(){
    const s=this.numericSeed;const heights=new Uint8Array(SIZE*SIZE);
    for(let x=0;x<SIZE;x++)for(let z=0;z<SIZE;z++){
      const river=Math.abs(x-(57+Math.sin(z*0.052)*14+Math.sin(z*0.018)*11));
      let h=16+noise(x/38,z/38,s)*18+noise(x/13,z/13,s+1)*5+noise(x/5,z/5,s+2)*2;
      if(this.biome==='alpine')h+=noise(x/24,z/24,s+5)*13;
      if(this.biome==='island')h-=Math.pow(Math.hypot(x-64,z-64)/65,2)*18;
      h=Math.floor(h-Math.max(0,1-river/14)*18);h=Math.max(4,Math.min(49,h));heights[x*SIZE+z]=h;
      for(let y=0;y<=Math.max(h,SEA);y++){
        let b=y===0?11:y>h?10:y===h?(h<=SEA+1?6:1):y>h-4?(h<=SEA+1?6:2):3;
        this.data[this.index(x,y,z)]=b;
      }
    }
    for(let x=4;x<SIZE-4;x++)for(let z=4;z<SIZE-4;z++){
      const h=heights[x*SIZE+z];if(h<SEA+3||hash(x,z,s+99)<0.988||Math.abs(x-35)<4&&Math.abs(z-80)<4)continue;
      const trunk=4+Math.floor(hash(x,z,s+51)*3);
      for(let y=h+1;y<=h+trunk;y++)this.set(x,y,z,4,false);
      for(let dy=-2;dy<=1;dy++)for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
        if(Math.abs(dx)+Math.abs(dz)>3+(dy<0?1:0))continue;
        if(dx===0&&dz===0&&dy<1)continue;
        this.set(x+dx,h+trunk+dy,z+dz,5,false);
      }
    }
  }
  spawn(){for(let r=0;r<40;r++)for(let dx=-r;dx<=r;dx++)for(const dz of [-r,r]){const x=35+dx,z=80+dz,y=this.surface(x,z);if(x>3&&x<SIZE-3&&z>3&&z<SIZE-3&&this.get(x,y-1,z)===1)return{x:x+0.5,y:y+0.01,z:z+0.5};}return{x:35.5,y:50,z:80.5};}
  restore(edits){if(!Array.isArray(edits)||edits.length>100000)throw new Error('Invalid world edits');for(const entry of edits){if(!Array.isArray(entry)||entry.length!==2)throw new Error('Invalid edit');const [key,b]=entry;const p=String(key).split(',').map(Number);if(p.length!==3||!p.every(Number.isInteger)||!this.inside(...p)||!Number.isInteger(b)||b<0||b>=BLOCKS.length)throw new Error('Invalid block');this.set(...p,b);}}
}
export function collides(world,x,y,z){const r=PHYSICS.width/2;for(let bx=Math.floor(x-r+1e-6);bx<=Math.floor(x+r-1e-6);bx++)for(let by=Math.floor(y+1e-6);by<=Math.floor(y+PHYSICS.height-1e-6);by++)for(let bz=Math.floor(z-r+1e-6);bz<=Math.floor(z+r-1e-6);bz++)if(world.solid(bx,by,bz))return true;return false;}
export function raycast(world,origin,dir,reach=6){let last=null;for(let d=0;d<=reach;d+=0.025){const p=[Math.floor(origin.x+dir.x*d),Math.floor(origin.y+dir.y*d),Math.floor(origin.z+dir.z*d)];if(last&&p.every((v,i)=>v===last[i]))continue;if(world.solid(...p))return{block:p,adjacent:last,distance:d};last=p;}return null;}
