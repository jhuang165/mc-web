import { inLava, waterAcceleration } from './fluids.js';
import { moveEntity, entityPushOut } from './entities.js';
import { LAVA, slipperiness } from './world.js';
import { explosionImpact } from './explosion.js';
import {mhSin} from "./lighting.js";
export const levelCost = level => level >= 30 ? 62+(level-30)*7 : level >= 15 ? 17+(level-15)*3 : 17;
export class Experience {
 constructor(data={}){data=data&&typeof data==='object'?data:{};this.total=Number.isFinite(data.total)?Math.max(0,Math.min(1000000,Math.floor(data.total))):0;this.score=Number.isFinite(data.score)?Math.max(0,Math.min(2147483647,Math.floor(data.score))):this.total;this.update();}
 update(){let points=this.total;this.level=0;while(points>=levelCost(this.level)){points-=levelCost(this.level++);}this.points=points;this.progress=points/levelCost(this.level);}
 add(n){n=Number.isFinite(n)?Math.max(0,Math.floor(n)):0;this.total=Math.min(1000000,this.total+n);this.score=Math.min(2147483647,this.score+n);this.update();}
 // EntityPlayer.addExperienceLevel [yz.a(I)] for each level gained: a multiple of 5 plays
 // random.levelup at (level > 30 ? 1 : level / 30F) * 0.75F, pitch 1, unless the last one
 // (field_82249_h, not saved) is within 100 ticks of ticksExisted. Returns the volume or 0.
 levelUp(oldLevel,ticks){const f=Math.fround;for(let l=oldLevel+1;l<=this.level;l++)if(l%5===0&&f(this.lastLevelUp||0)<f(ticks)-100){this.lastLevelUp=ticks;return f(f(l>30?1:f(l/30))*f(0.75));}return 0;}
 death(){const dropped=Math.min(this.level*7,100);this.total=0;this.update();return dropped;}
 serialize(){return{total:this.total,score:this.score};}
}
export const splitExperience=n=>{const out=[];for(const size of [2477,1237,617,307,149,73,37,17,7,3,1])while(n>=size){out.push(size);n-=size;}return out;};
export function oreExperience(block,random=Math.random){return block===15?Math.floor(random()*3):block===17?3+Math.floor(random()*5):0;}
export const SMELT_EXPERIENCE={324:.35,302:.7,304:1,303:1,301:.1,9:.1,3:.1,308:.15,203:.35,205:.35,306:.3,40:.35};
// FurnaceRecipes.func_151398_b keys the experience by the output stack; cactus green (dye
// damage 2) gives 0.2, so damaged outputs are looked up as "id:damage" first.
SMELT_EXPERIENCE["351:2"]=.2;
export const smeltExperience=s=>s?SMELT_EXPERIENCE[`${s.id}:${s.damage||0}`]??SMELT_EXPERIENCE[s.id]??0:0;
// EntityXPOrb.getTextureByXP (sq.f): the 16x16 frame of experience_orb.png.
export const orbIcon=v=>v>=2477?10:v>=1237?9:v>=617?8:v>=307?7:v>=149?6:v>=73?5:v>=37?4:v>=17?3:v>=7?2:v>=3?1:0;
// RenderXPOrb.func_76986_a (bnp.a): the tint cycles with (xpColor + partial) / 2
// through MathHelper.sin; each channel is truncated to 0..255.
export function orbColor(color,partial){const f=Math.fround,t=f(f(color+f(partial))/2);return [Math.trunc(f(f(f(mhSin(t)+1)*0.5)*255)),255,Math.trunc(f(f(f(mhSin(f(t+f(4.1887903)))+1)*f(0.1))*255))];}
// EntityXPOrb [sq] from the 1.7.10 JAR, replayed in src/xp-orbs.test.js against the unchanged
// onUpdate (tools/probes/XpOrbProbe.java). A 0.5 x 0.5 box; `y` is its bottom and posY (`posY`,
// kept for exact arithmetic) is 0.25 above it. Not saved: px/py/pz (lastTickPos, equal to
// prevPos for an orb), `color` (xpColor, ticks since spawn or load), the player search state
// (`retarget`, xpTargetColor, and `target`) and `bb` (rebuilt from the position on load).
const f=Math.fround,SIZE=0.5,HALF=0.25,LIFETIME=6000,EYE=f(1.62);
const strip=({px,py,pz,posY,bb,color,retarget,target,dead,inWeb,fallDistance,collidedH,...o})=>o;
const boxAt=(x,posY,z)=>[x-HALF,posY-HALF,z-HALF,x+HALF,posY-HALF+SIZE,z+HALF];
let nextId=0;
// The EntityXPOrb(world, x, y, z, value) constructor at posY `y`: rotationYaw, then motion from
// Math.random(), each (float)(r * 0.2 [- 0.1]) * 2F.
export function newOrb(value,x,y,z,random=Math.random){
 random();
 const vx=f(f(random()*0.2-0.1)*2),vy=f(f(random()*0.2)*2),vz=f(f(random()*0.2-0.1)*2);
 return seed({x,y:y-HALF,z,value,age:0,health:5,fire:0,vx,vy,vz,onGround:false},y);
}
const seed=(o,posY=o.y+HALF)=>({...o,posY,bb:boxAt(o.x,posY,o.z),px:o.x,py:o.y,pz:o.z,color:0,retarget:0,target:false,id:nextId++,fallDistance:0});
export class ExperienceOrbs {
 // `random` is the orbs' Entity.rand (lava and pickup sounds, push-out speed); `wet(orb)` is
 // Entity.isWet (rain; EntityXPOrb.handleWaterMovement never sets inWater).
 constructor(saved=[],random=Math.random){
  this.random=random;this.sounds=[];this.cooldown=0;
  this.orbs=Array.isArray(saved)?saved.slice(0,512).filter(o=>o&&[o.x,o.y,o.z,o.value].every(Number.isFinite)&&o.value>0&&o.value<=2477).map(o=>{
   // Saves before 0.21.4 stored the remaining lifetime (`life`) instead of xpOrbAge.
   const age=Number.isFinite(o.age)?o.age:Number.isFinite(o.life)?LIFETIME-o.life:0,n=k=>Number.isFinite(o[k])?o[k]:0;
   return seed({x:o.x,y:o.y,z:o.z,value:o.value,age:Math.max(0,Math.trunc(age)),health:Number.isFinite(o.health)?o.health&255:5,fire:Math.trunc(n('fire')),vx:n('vx'),vy:n('vy'),vz:n('vz'),onGround:!!o.onGround});
  }).filter(o=>o.age<LIFETIME&&o.health>0):[];
 }
 // `p` is the spawn point (posY): EntityXPOrb.getXPSplit pieces, one orb each.
 spawn(value,p){for(const n of splitExperience(Math.max(0,Math.floor(value))).slice(0,128))this.orbs.push(newOrb(n,p.x,p.y,p.z));}
 // EntityXPOrb.attackEntityFrom [sq.a(ro,F)]: health -= amount, truncated; dead at 0. It does
 // not check isDead, so later hits in the same tick keep counting down.
 hurt(o,source,amount){o.health=Math.trunc(o.health-amount);if(o.health<=0)o.dead=true;}
 // Explosion.doExplosionA visits existing orbs before any blocks are removed or ore XP spawns.
 // EntityXPOrb inherits Entity.getEyeHeight = 0: use posY (the box centre) for the push.
 explode(world,x,y,z,size,exploder=null){
  for(const o of this.orbs){
   if(o.dead||o===exploder)continue;
   const hit=explosionImpact(world,x,y,z,size,o.x,o.posY,o.z,o.posY,o.bb);
   if(!hit)continue;
   this.hurt(o,'explosion',hit.damage);
   // Explosion applies motion even when attackEntityFrom returns false or kills the entity.
   o.vx+=hit.push[0];o.vy+=hit.push[1];o.vz+=hit.push[2];
  }
  this.orbs=this.orbs.filter(o=>!o.dead);
 }
 // EntityPlayer.onLivingUpdate (alive players, any game mode) collides the player's box grown by
 // (1, 0.5, 1) with each orb; EntityXPOrb.onCollideWithPlayer [sq.b_] needs xpCooldown 0 and
 // sets it to 2, plays random.orb (0.1, 0.5 * ((r - r) * 0.7 + 1.8)) at the player and adds
 // the value. EntityPlayer.onUpdate counts the cooldown down first, so the player takes at most
 // one orb every other tick. Returns the value picked up.
 collect(feet,width=0.6,height=1.8){
  if(this.cooldown>0)this.cooldown--;
  const r=f(width)/2,a=[feet.x-r-1,feet.y-0.5,feet.z-r-1,feet.x+r+1,feet.y+f(height)+0.5,feet.z+r+1];
  for(const o of this.orbs){
   if(o.dead||this.cooldown)continue;
   const b=o.bb;
   if(!(b[3]>a[0]&&b[0]<a[3]&&b[4]>a[1]&&b[1]<a[4]&&b[5]>a[2]&&b[2]<a[5]))continue;
   this.cooldown=2;
   const r1=this.random(),r2=this.random();
   this.sounds.push({name:'random.orb',volume:f(0.1),pitch:f(f(0.5)*f(f(f(f(r1)-f(r2))*f(0.7))+f(1.8))),x:feet.x,y:feet.y,z:feet.z});
   o.dead=true;this.orbs=this.orbs.filter(x=>x!==o);
   return o.value;
  }
  return 0;
 }
 // EntityXPOrb.onUpdate [sq.h] for every orb; `player` is the server player's feet (EntityPlayerMP,
 // getEyeHeight 1.62F) or null.
 tick(world,player){
  for(const o of this.orbs){
   o.px=o.x;o.py=o.y;o.pz=o.z;
   // Entity.onEntityUpdate: EntityXPOrb.handleWaterMovement pushes with the unshrunk box only;
   // then the fire countdown (onFire 1 when the counter is a multiple of 20) and lava (lava 4,
   // setFire(15)), and the void below -64.
   if(world.getMeta){const {push}=waterAcceleration(world,o.bb);o.vx+=push[0];o.vy+=push[1];o.vz+=push[2];}
   if(o.fire>0){if(o.fire%20===0)this.hurt(o,'onFire',1);o.fire--;}
   if(world.getMeta&&inLava(world,o.bb)){this.hurt(o,'lava',4);o.fire=Math.max(o.fire,300);}
   if(o.posY<-64)o.dead=true;
   o.vy-=0.029999999329447746;
   // The orb's cell is lava: thrown up and sideways with a fizz (0.4, 2 + r * 0.4).
   if(world.get(Math.floor(o.x),Math.floor(o.posY),Math.floor(o.z))===LAVA){
    const r=this.random;
    o.vy=0.20000000298023224;o.vx=f(f(f(r())-f(r()))*f(0.2));o.vz=f(f(f(r())-f(r()))*f(0.2));
    this.sounds.push({name:'random.fizz',volume:f(0.4),pitch:f(2+f(f(r())*f(0.4))),x:o.x,y:o.posY,z:o.z});
   }
   // func_145771_j at the box centre; unlike EntityItem the result does not set noClip.
   const push=entityPushOut(world,o.x,(o.bb[1]+o.bb[4])/2,o.z,o.bb,this.random);
   if(push)o[['vx','vy','vz'][push[0]]]=push[1];
   // Every 20 - entityId % 100 ticks of xpColor (every tick once that is below 1) an orb with no
   // target, or one farther than 8 blocks, looks for the closest player within 8 (distance
   // squared < 64, from posY to the player's feet).
   if(o.retarget<o.color-20+o.id%100){
    const d2=player?(o.x-player.x)**2+(o.posY-player.y)**2+(o.z-player.z)**2:Infinity;
    if(!o.target||d2>64)o.target=d2<64;
    o.retarget=o.color;
   }
   if(o.target&&player){
    const dx=(player.x-o.x)/8,dy=(player.y+EYE-o.posY)/8,dz=(player.z-o.z)/8,d=Math.sqrt(dx*dx+dy*dy+dz*dz);
    let pull=1-d;
    if(pull>0){pull*=pull;o.vx+=dx/d*pull*0.1;o.vy+=dy/d*pull*0.1;o.vz+=dz/d*pull*0.1;}
   }
   // Entity.moveEntity with stepHeight 0; the tail hurts on cactus and fire cells and runs the
   // fire counter (fireResistance 1), with a rain fizz when wet.
   const self=this;
   moveEntity(world,o,SIZE,SIZE,o.vx,o.vy,o.vz,0,{hurt:(source,n)=>this.hurt(o,source,n),get wet(){return !!self.wet?.(o);},
    fizz:()=>this.sounds.push({name:'random.fizz',volume:f(0.7),pitch:f(f(1.6)+f(f(f(this.random())-f(this.random()))*f(0.4))),x:o.x,y:o.posY,z:o.z})});
   o.posY=o.bb[1]+HALF;
   const fr=o.onGround?f(slipperiness(world.get(Math.floor(o.x),Math.floor(o.bb[1])-1,Math.floor(o.z)))*f(0.98)):f(0.98);
   o.vx*=fr;o.vy*=0.9800000190734863;o.vz*=fr;
   if(o.onGround)o.vy*=-0.8999999761581421;
   o.color++;
   if(++o.age>=LIFETIME)o.dead=true;
  }
  this.orbs=this.orbs.filter(o=>!o.dead);
 }
 serialize(){return this.orbs.map(strip);}
}
