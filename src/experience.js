export const levelCost = level => level >= 30 ? 62+(level-30)*7 : level >= 15 ? 17+(level-15)*3 : 17;
export class Experience {
 constructor(data={}){data=data&&typeof data==='object'?data:{};this.total=Number.isFinite(data.total)?Math.max(0,Math.min(1000000,Math.floor(data.total))):0;this.score=Number.isFinite(data.score)?Math.max(0,Math.min(2147483647,Math.floor(data.score))):this.total;this.update();}
 update(){let points=this.total;this.level=0;while(points>=levelCost(this.level)){points-=levelCost(this.level++);}this.points=points;this.progress=points/levelCost(this.level);}
 add(n){n=Number.isFinite(n)?Math.max(0,Math.floor(n)):0;this.total=Math.min(1000000,this.total+n);this.score=Math.min(2147483647,this.score+n);this.update();}
 death(){const dropped=Math.min(this.level*7,100);this.total=0;this.update();return dropped;}
 serialize(){return{total:this.total,score:this.score};}
}
export const splitExperience=n=>{const out=[];for(const size of [2477,1237,617,307,149,73,37,17,7,3,1])while(n>=size){out.push(size);n-=size;}return out;};
export function oreExperience(block,random=Math.random){return block===15?Math.floor(random()*3):block===17?3+Math.floor(random()*5):0;}
export const SMELT_EXPERIENCE={302:.7,304:1,9:.1,3:.1,308:.15,203:.35,205:.35,306:.3};
export class ExperienceOrbs {
 constructor(saved=[]){this.orbs=Array.isArray(saved)?saved.slice(0,512).filter(o=>o&&[o.x,o.y,o.z,o.value,o.life].every(Number.isFinite)&&o.value>0&&o.value<=2477&&o.life>0&&o.life<=6000).map(o=>({...o,vx:0,vy:0,vz:0})):[];}
 spawn(value,p){for(const n of splitExperience(Math.max(0,Math.floor(value))).slice(0,128))this.orbs.push({x:p.x,y:p.y+.5,z:p.z,value:n,life:6000,delay:10,vx:(Math.random()-.5)*.12,vy:.12,vz:(Math.random()-.5)*.12});}
 tick(world,player,xp){let picked=0;this.orbs=this.orbs.filter(o=>{if(--o.life<=0)return false;o.delay=Math.max(0,(o.delay||0)-1);const dx=player.x-o.x,dy=player.y+.8-o.y,dz=player.z-o.z,d=Math.hypot(dx,dy,dz);if(d<1&&!o.delay){xp.add(o.value);picked+=o.value;return false;}if(d<8&&d>.01){const pull=(1-d/8)**2*.1;o.vx+=dx/d*pull;o.vy+=dy/d*pull;o.vz+=dz/d*pull;}o.vy-=.03;for(const a of ['x','y','z']){const v='v'+a,p={...o,[a]:o[a]+o[v]};if(!world.solid(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z)))o[a]=p[a];else o[v]*=a==='y'?-.6:-.4;}o.vx*=.98;o.vy*=.98;o.vz*=.98;return true;});return picked;}
 serialize(){return this.orbs.map(o=>({...o}));}
}
