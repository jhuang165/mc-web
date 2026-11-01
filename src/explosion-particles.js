// EntityHugeExplodeFX, EntityLargeExplodeFX, EntityExplodeFX and EntitySmokeFX, Java 1.7.10.
// Original-class constructor/update records: public/research/explosion-particles-reference.json.
// The particles live in the shared EffectRenderer: smoke and explode in layer 0, the huge
// emitter in layer 1 and the large puffs in layer 3 (EntityFX.getFXLayer).
import { moveParticleEntity } from './particles.js';
import { acceptsParticle } from './particle-settings.js';
import { EffectRenderer, entityFX } from './effect-renderer.js';
import { JavaRandom } from './lighting.js';
const f=Math.fround;
const LAYER={hugeexplosion:1,largeexplode:3,explode:0,smoke:0,largesmoke:0};
export class ExplosionParticles {
  constructor({random=Math.random,entityRandom=()=>new JavaRandom(Math.floor(Math.random()*2**48)),worldRandom=new JavaRandom(Date.now()),limit=4000,effects=new EffectRenderer({limit})}={}) {
    this.random=random;this.entityRandom=entityRandom;this.worldRandom=worldRandom;this.effects=effects;
    this.setting=0;this.viewer=null;
  }
  // This system's particles: sprites (layer 0) and large puffs (layer 3); emitters (layer 1).
  get list(){return [...this.effects.layers[0],...this.effects.layers[3]].filter(p=>p.owner===this);}
  get emitters(){return this.effects.layers[1].filter(p=>p.owner===this);}
  clear(){this.effects.clear();}
  spawn(kind,x,y,z,vx=0,vy=0,vz=0,viewer=this.viewer){
    if(!acceptsParticle(kind,this.setting,this.worldRandom,x,y,z,viewer))return null;
    return this.effects.add(this.make(kind,x,y,z,vx,vy,vz));
  }
  // The constructors. EntitySmokeFX(..., 2.5F) is RenderGlobal's "largesmoke".
  make(kind,x,y,z,vx=0,vy=0,vz=0){
    const rand=this.entityRandom(), r=this.random;
    const p=entityFX(x,y,z,kind==='explode'?vx:0,kind==='explode'?vy:0,kind==='explode'?vz:0,rand,r);
    if(!(kind in LAYER))throw new Error('Unknown explosion particle: '+kind);
    Object.assign(p,{kind,rand,frame:0,layer:LAYER[kind],owner:this});
    if(kind==='hugeexplosion'){p.age=0;p.max=8;return p;}
    if(kind==='largeexplode'){
      p.max=6+rand.nextInt(4);p.r=p.g=p.b=f(f(rand.nextFloat()*f(0.6))+f(0.4));
      p.size=f(2*f(1-f(f(vx)*f(0.5))));
    } else if(kind==='explode'){
      p.mx=vx+f(f(r()*2-1)*f(0.05));p.my=vy+f(f(r()*2-1)*f(0.05));p.mz=vz+f(f(r()*2-1)*f(0.05));
      p.r=p.g=p.b=f(f(rand.nextFloat()*f(0.3))+f(0.7));
      p.scale=f(f(f(rand.nextFloat()*rand.nextFloat())*6)+1);
      p.max=Math.trunc(16/(rand.nextFloat()*0.8+0.2))+2;
    } else {
      const k=kind==='largesmoke'?f(2.5):1;
      p.kind='smoke';
      p.mx=p.mx*0.10000000149011612+vx;p.my=p.my*0.10000000149011612+vy;p.mz=p.mz*0.10000000149011612+vz;
      p.r=p.g=p.b=f(r()*0.30000001192092896);p.scale=f(f(p.scale*f(0.75))*k);
      p.max=Math.trunc(f(Math.trunc(8/(r()*0.8+0.2))*k));
    }
    return p;
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
  // The billboard EffectRenderer draws (explosion-particle-renderer.js).
  sprite(p,partial){return explosionSprite(p,partial);}
  // EffectRenderer.updateEffects for the whole pool (main.js ticks the shared one).
  tick(world){this.effects.tick(world);}
  step(world,p){
    if(p.kind==='hugeexplosion'){
      const r=p.rand;
      for(let i=0;i<6;i++)this.spawn('largeexplode',p.x+(r.nextDouble()-r.nextDouble())*4,p.y+(r.nextDouble()-r.nextDouble())*4,p.z+(r.nextDouble()-r.nextDouble())*4,f(p.age/p.max),0,0);
      if(++p.age===p.max)p.dead=true;
      return;
    }
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
