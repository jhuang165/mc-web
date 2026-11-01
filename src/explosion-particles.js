// EntityHugeExplodeFX, EntityLargeExplodeFX, EntityExplodeFX and EntitySmokeFX, Java 1.7.10.
// Original-class constructor/update records: public/research/explosion-particles-reference.json.
import { ParticleSystem, moveParticleEntity } from './particles.js';
import { acceptsParticle } from './particle-settings.js';
import { JavaRandom } from './lighting.js';
const f=Math.fround;
export class ExplosionParticles {
  constructor({random=Math.random,entityRandom=()=>new JavaRandom(Math.floor(Math.random()*2**48)),worldRandom=new JavaRandom(Date.now()),limit=4000}={}) {
    this.random=random;this.entityRandom=entityRandom;this.worldRandom=worldRandom;this.limit=limit;
    this.setting=0;this.viewer=null;
    this.list=[];this.emitters=[];this.counts=[0,0];
    // The common EntityFX constructor, already replayed for block particles.
    this.base=new ParticleSystem({random,entityRandom});
  }
  clear(){this.list=[];this.emitters=[];this.counts=[0,0];}
  spawn(kind,x,y,z,vx=0,vy=0,vz=0,viewer=this.viewer){
    if(!acceptsParticle(kind,this.setting,this.worldRandom,x,y,z,viewer))return null;
    const rand=this.entityRandom(), r=this.random;
    this.base.entityRandom=()=>rand;
    const p=this.base.digging(x,y,z,kind==='explode'?vx:0,kind==='explode'?vy:0,kind==='explode'?vz:0,3);
    Object.assign(p,{kind,rand,scale:f(p.scale*2),gravity:0,r:1,g:1,b:1,frame:0});
    if(kind==='hugeexplosion'){
      p.age=0;p.max=8;if(this.emitters.length>=this.limit)this.emitters.shift();this.emitters.push(p);return p;
    }
    if(kind==='largeexplode'){
      p.max=6+rand.nextInt(4);p.r=p.g=p.b=f(f(rand.nextFloat()*f(0.6))+f(0.4));
      p.size=f(2*f(1-f(f(vx)*f(0.5))));
    } else if(kind==='explode'){
      p.mx=vx+f(f(r()*2-1)*f(0.05));p.my=vy+f(f(r()*2-1)*f(0.05));p.mz=vz+f(f(r()*2-1)*f(0.05));
      p.r=p.g=p.b=f(f(rand.nextFloat()*f(0.3))+f(0.7));
      p.scale=f(f(f(rand.nextFloat()*rand.nextFloat())*6)+1);
      p.max=Math.trunc(16/(rand.nextFloat()*0.8+0.2))+2;
    } else if(kind==='smoke'){
      p.mx=p.mx*0.10000000149011612+vx;p.my=p.my*0.10000000149011612+vy;p.mz=p.mz*0.10000000149011612+vz;
      p.r=p.g=p.b=f(r()*0.30000001192092896);p.scale=f(p.scale*f(0.75));
      p.max=Math.trunc(8/(r()*0.8+0.2));
    } else throw new Error('Unknown explosion particle: '+kind);
    // EffectRenderer keeps separate 4000-entry texture layers (regular sprites / custom puffs).
    const layer=kind==='largeexplode', index=layer?1:0;
    if(this.counts[index]>=this.limit){
      this.list.splice(this.list.findIndex(q=>(q.kind==='largeexplode')===layer),1);
    } else this.counts[index]++;
    this.list.push(p);return p;
  }
  // Client Explosion.doExplosionB(true). World.rand is separate from server drops/terrain RNG.
  burst(x,y,z,size,positions,{smoking=true,viewer=null}={}){
    const r=this.worldRandom, previousViewer=this.viewer;
    this.viewer=viewer??previousViewer;
    r.nextFloat();r.nextFloat(); // the sound's pitch consumes two floats before particle positions
    this.spawn(size>=2&&smoking?'hugeexplosion':'largeexplode',x,y,z,1,0,0);
    if(!smoking){this.viewer=previousViewer;return;}
    for(const [bx,by,bz] of positions){
      const px=f(f(bx)+r.nextFloat()),py=f(f(by)+r.nextFloat()),pz=f(f(bz)+r.nextFloat());
      let dx=px-x,dy=py-y,dz=pz-z;
      const d=f(Math.sqrt(dx*dx+dy*dy+dz*dz));
      const speed=0.5/(d/size+0.1)*f(f(r.nextFloat()*r.nextFloat())+f(0.3));
      dx=dx/d*speed;dy=dy/d*speed;dz=dz/d*speed;
      this.spawn('explode',(px+x)/2,(py+y)/2,(pz+z)/2,dx,dy,dz);
      this.spawn('smoke',px,py,pz,dx,dy,dz);
    }
    this.viewer=previousViewer;
  }
  tick(world){
    // EffectRenderer updates sprite layers before the custom-particle layer. New puffs from
    // the huge emitter (sprite layer) therefore receive their first update later this tick.
    for(const p of this.list.filter(p=>p.kind!=='largeexplode'))this.step(world,p);
    for(const p of this.emitters){
      const r=p.rand;
      for(let i=0;i<6;i++)this.spawn('largeexplode',p.x+(r.nextDouble()-r.nextDouble())*4,p.y+(r.nextDouble()-r.nextDouble())*4,p.z+(r.nextDouble()-r.nextDouble())*4,f(p.age/p.max),0,0);
      if(++p.age===p.max)p.dead=true;
    }
    this.emitters=this.emitters.filter(p=>!p.dead);
    for(const p of this.list.filter(p=>p.kind==='largeexplode'))this.step(world,p);
    this.list=this.list.filter(p=>!p.dead);
    this.counts=[0,0];for(const p of this.list)this.counts[p.kind==='largeexplode'?1:0]++;
  }
  step(world,p){
    p.px=p.x;p.py=p.y;p.pz=p.z;
    if(p.kind==='largeexplode'){if(++p.age===p.max)p.dead=true;return;}
    if(p.age++>=p.max)p.dead=true;
    p.frame=7-Math.trunc(p.age*8/p.max);
    p.my+=0.004;
    moveParticleEntity(world,p,p.mx,p.my,p.mz);
    if(p.kind==='smoke'&&p.y===p.py){p.mx*=1.1;p.mz*=1.1;}
    const drag=p.kind==='smoke'?0.9599999785423279:0.8999999761581421;
    p.mx*=drag;p.my*=drag;p.mz*=drag;
    if(p.onGround){p.mx*=0.699999988079071;p.mz*=0.699999988079071;}
  }
}
// Texture frame, UV bounds and half-size of the billboard, from the original render methods.
export function explosionSprite(p,partial){
  if(p.kind==='largeexplode'){
    const frame=Math.trunc(f(f(f(p.age+f(partial))*15)/p.max));
    if(frame>15)return null;
    const u=f((frame%4)/4),v=f(Math.trunc(frame/4)/4);
    return {u0:u,u1:f(u+f(0.24975)),v0:v,v1:f(v+f(0.24975)),size:p.size};
  }
  const frame=p.frame,u=f((frame%16)/16),v=f(Math.floor(frame/16)/16);
  const growth=p.kind==='smoke'?Math.min(1,Math.max(0,f(f(f(f(p.age+f(partial))/p.max)*32)))):1;
  return {u0:u,u1:f(u+f(0.0624375)),v0:v,v1:f(v+f(0.0624375)),size:f(f(0.1)*f(p.scale*growth))};
}
