import { SIZE, HEIGHT, hash, raycast as voxelRay } from "./world.js";
import { ITEMS } from "./survival.js";
// Widths and heights are each 1.7.10 constructor's setSize: EntityPig (wo)
// 0.9 x 0.9, EntityCow (wh) 0.9 x 1.3, EntityZombie (yq) 0.6 x 1.8.
export const ENTITY_TYPES = {
  pig: { health: 10, width: 0.9, height: 0.9, speed: 0.045, drop: 202 },
  cow: { health: 10, width: 0.9, height: 1.3, speed: 0.045, drop: 204 },
  zombie: {
    health: 20,
    width: 0.6,
    height: 1.8,
    speed: 0.09,
    damage: 3,
    drop: 206,
  },
};
export function actorCollides(world, x, y, z, w, h) {
  for (
    let bx = Math.floor(x - w / 2 + 0.001);
    bx <= Math.floor(x + w / 2 - 0.001);
    bx++
  )
    for (let by = Math.floor(y + 0.001); by <= Math.floor(y + h - 0.001); by++)
      for (
        let bz = Math.floor(z - w / 2 + 0.001);
        bz <= Math.floor(z + w / 2 - 0.001);
        bz++
      )
        if (world.solid(bx, by, bz)) return true;
  return false;
}
export function entityHit(origin, dir, e, reach) {
  const base = ENTITY_TYPES[e.type], scale=e.growingAge<0?.5:1,t={width:base.width*scale,height:base.height*scale};
  let near = 0,
    far = reach;
  for (const [axis, min, max] of [
    ["x", e.x - t.width / 2, e.x + t.width / 2],
    ["y", e.y, e.y + t.height],
    ["z", e.z - t.width / 2, e.z + t.width / 2],
  ]) {
    if (Math.abs(dir[axis]) < 1e-8) {
      if (origin[axis] < min || origin[axis] > max) return null;
    } else {
      const a = (min - origin[axis]) / dir[axis],
        b = (max - origin[axis]) / dir[axis];
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (far < near) return null;
    }
  }
  return near <= reach ? near : null;
}
export class EntityWorld {
  constructor(world, saved) {
    this.world = world;
    this.events = [];
    this.entities = [];
    this.nextId = 1;
    this.spawnClock = 0;
    if (Array.isArray(saved)) {
      for (const e of saved.slice(0, 40)) {
        const t = ENTITY_TYPES[e.type];
        if (
          !t ||
          ![e.x, e.y, e.z, e.health].every(Number.isFinite) ||
          e.x < 1 ||
          e.x >= SIZE - 1 ||
          e.z < 1 ||
          e.z >= SIZE - 1 ||
          e.y < 0 ||
          e.y >= HEIGHT ||
          e.health <= 0
        )
          continue;
        this.entities.push({
          ...this.create(e.type, e.x, e.y, e.z),
          ...e,
          id: /^mob-\d+$/.test(e.id) ? e.id : "mob-" + this.nextId++,
          health: Math.min(t.health, e.health),
          yaw: Number.isFinite(e.yaw) ? e.yaw : 0,
          gait: Number.isFinite(e.gait) ? e.gait : 0,
          age: Number.isFinite(e.age) ? e.age : 0,
          growingAge:Number.isInteger(e.growingAge)?Math.max(-24000,Math.min(6000,e.growingAge)):0,
          love:Number.isInteger(e.love)?Math.max(0,Math.min(600,e.love)):0,
          mateTicks:0,
          wander: 0,
          hurt: 0,
          attack: 0,
          flee: 0,
          vx: 0,
          vz: 0,
          vy: 0,
        });
        this.nextId++;
      }
      this.nextId = Math.max(
        this.nextId,
        ...this.entities
          .map((e) => Number(String(e.id).replace("mob-", "")) + 1)
          .filter(Number.isFinite),
      );
    } else this.seedAnimals();
  }
  create(type, x, y, z) {
    return {
      id: "mob-" + this.nextId++,
      type,
      x,
      y,
      z,
      health: ENTITY_TYPES[type].health,
      yaw: 0,
      vy: 0,
      vx: 0,
      vz: 0,
      gait: 0,
      age: 0,
      wander: 0,
      hurt: 0,
      attack: 0,
      flee: 0,
      burn: 0,
      growingAge:0,love:0,mateTicks:0,
    };
  }
  seedAnimals() {
    const spawn = this.world.spawn();
    for (let i = 0; i < 8; i++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const angle = hash(i, attempt, this.world.numericSeed) * Math.PI * 2,
          r = 10 + hash(i, attempt, 313) * 24,
          x = Math.floor(spawn.x + Math.sin(angle) * r),
          z = Math.floor(spawn.z + Math.cos(angle) * r);
        if (x < 3 || z < 3 || x > SIZE - 3 || z > SIZE - 3) continue;
        const y = this.world.surface(x, z), type = i % 2 ? "cow" : "pig", t = ENTITY_TYPES[type];
        if (
          this.world.get(x, y - 1, z) !== 1 ||
          actorCollides(this.world, x + 0.5, y, z + 0.5, t.width, t.height)
        )
          continue;
        this.entities.push(this.create(type, x + 0.5, y, z + 0.5));
        break;
      }
    }
  }
  pick(origin, dir, reach, wallDistance = reach) {
    let result = null;
    for (const e of this.entities) {
      if (e.health <= 0) continue;
      const distance = entityHit(origin, dir, e, Math.min(reach, wallDistance));
      if (distance !== null && (!result || distance < result.distance))
        result = { entity: e, distance };
    }
    return result;
  }
  attack(e, tool, survival, player) {
    if (!this.entities.includes(e) || e.health <= 0 || e.hurt > 0) return false;
    const item = ITEMS[tool],
      owned = survival.creative || survival.count(tool) > 0;
    let damage = 1;
    if (owned && ["sword","axe","pickaxe","shovel"].includes(item?.kind)) {
      damage =
        item.kind === "sword"
          ? 5 + (item.name.startsWith("Golden") ? 0 : item.tier)
          : item.kind === "axe"
            ? 4 + item.tier
            : item.kind === "pickaxe"
              ? 3 + item.tier
              : 2 + item.tier;
    }
    e.health -= damage;
    e.hurt = 10;
    e.flee = 60;
    e.love=0;e.mateTicks=0;
    e.yaw = Math.atan2(e.x - player.x, e.z - player.z);
    e.vx = Math.sin(e.yaw) * 0.28;
    e.vz = Math.cos(e.yaw) * 0.28;
    e.vy = 0.2;
    survival.exhaust(0.3);
    if (owned&&["sword","axe","pickaxe","shovel"].includes(item?.kind)) survival.wear(tool,item.kind==='sword'?1:2);
    if (e.health <= 0) {
      this.events.push({
        sound: "mob." + e.type + (e.type === "cow" ? ".hurt" : ".death"),
        position: e,
      });
      if(e.growingAge>=0)this.events.push({xp:e.type==='zombie'?5:1+Math.floor(Math.random()*3),position:{x:e.x,y:e.y,z:e.z}});
      if(e.growingAge>=0)this.events.push({
        drop: ENTITY_TYPES[e.type].drop,
        count:
          1 + Math.floor(hash(e.age, e.id.length, this.world.numericSeed) * 3),
        position: { x: e.x, y: e.y, z: e.z },
      });
      // EntityCow.dropFewItems also drops zero to two leather.
      const leather = e.type === "cow" && e.growingAge >= 0 ? Math.floor(hash(e.age + 7, e.id.length, this.world.numericSeed) * 3) : 0;
      if (leather) this.events.push({ drop: 315, count: leather, position: { x: e.x, y: e.y, z: e.z } });
      e.death = 1;
    } else
      this.events.push({
        sound: e.type === "pig" ? "mob.pig.say" : "mob." + e.type + ".hurt",
        position: e,
      });
    return true;
  }
  feed(e,id,survival){
    if(!this.entities.includes(e)||e.health<=0||e.type!=='cow'||id!==305||(!survival.creative&&!survival.count(id)))return false;
    if(e.growingAge!==0||e.love>0)return false;e.love=600;
    if(!survival.creative)survival.take(id);this.events.push({hearts:true,position:{x:e.x,y:e.y+1,z:e.z}});return true;
  }
  breed(){
    const cows=this.entities.filter(e=>e.type==='cow'&&e.health>0&&e.growingAge===0&&e.love>0);
    for(const a of cows){if(!a.love)continue;const b=cows.find(b=>b!==a&&b.love>0&&Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<3);
      if(!b){a.mateTicks=0;continue;}if(++a.mateTicks<60)continue;if(this.entities.length>=40)continue;
      const baby=this.create('cow',a.x,a.y,a.z);baby.growingAge=-24000;this.entities.push(baby);a.growingAge=b.growingAge=6000;a.love=b.love=0;a.mateTicks=b.mateTicks=0;
      this.events.push({hearts:true,position:{x:a.x,y:a.y+1,z:a.z}},{xp:1+Math.floor(Math.random()*7),position:{x:a.x,y:a.y,z:a.z}});
    }
  }
  tick(player, survival, heldItem=0) {
    const night =
      survival.time % 24000 > 13000 && survival.time % 24000 < 23000;
    this.spawnClock++;
    if (
      night &&
      !survival.creative &&
      this.spawnClock >= 200 &&
      this.entities.filter((e) => e.type === "zombie").length < 5
    ) {
      this.spawnClock = 0;
      for (let i = 0; i < 16; i++) {
        const a = hash(i, survival.time, this.world.numericSeed) * Math.PI * 2,
          x = Math.floor(player.x + Math.sin(a) * 24),
          z = Math.floor(player.z + Math.cos(a) * 24);
        if (x < 2 || z < 2 || x > SIZE - 2 || z > SIZE - 2) continue;
        const y = this.world.surface(x, z);
        if (this.world.get(x, y - 1, z) !== 1) continue;
        this.entities.push(this.create("zombie", x + 0.5, y, z + 0.5));
        break;
      }
    }
    for (const e of this.entities) {
      if (e.health <= 0) {
        e.death = (e.death || 0) + 1;
        continue;
      }
      const base=ENTITY_TYPES[e.type],scale=e.growingAge<0?.5:1,t={...base,width:base.width*scale,height:base.height*scale};
      e.age++;
      if(e.growingAge<0)e.growingAge++;else if(e.growingAge>0)e.growingAge--;
      e.love=Math.max(0,e.love-1);
      if(e.love&&e.age%10===0)this.events.push({hearts:true,position:{x:e.x,y:e.y+1,z:e.z}});
      e.hurt = Math.max(0, e.hurt - 1);
      e.attack = Math.max(0, e.attack - 1);
      e.flee = Math.max(0, e.flee - 1);
      const distance = Math.hypot(e.x - player.x, e.z - player.z);
      let speed = 0;
      if (
        e.type === "zombie" &&
        !survival.creative &&
        distance < 30 &&
        survival.health > 0
      ) {
        e.yaw = Math.atan2(player.x - e.x, player.z - e.z);
        speed = distance > 1.1 ? t.speed : 0;
        if (
          distance < 1.4 &&
          Math.abs(e.y - player.y) < 1.5 &&
          e.attack === 0 &&
          !voxelRay(
            this.world,
            { x: e.x, y: e.y + 1.2, z: e.z },
            {
              x: (player.x - e.x) / Math.max(0.01, distance),
              y: 0,
              z: (player.z - e.z) / Math.max(0.01, distance),
            },
            distance,
          )
        ) {
          survival.damage(t.damage, "a zombie", true);
          e.attack = 20;
        }
      } else if(e.type==='cow'&&!e.flee&&(e.love>0||(heldItem===305&&(survival.creative||survival.count(305))&&distance<10)||e.growingAge<0)){
        const partner=e.love?this.entities.find(b=>b!==e&&b.type==='cow'&&b.love>0&&b.health>0&&b.growingAge===0):null;
        const mother=e.growingAge<0?this.entities.find(b=>b!==e&&b.type==='cow'&&b.growingAge>=0&&b.health>0&&Math.hypot(b.x-e.x,b.z-e.z)<8):null;
        const goal=partner||mother||player,d=Math.hypot(goal.x-e.x,goal.z-e.z);e.yaw=Math.atan2(goal.x-e.x,goal.z-e.z);speed=d>(partner?1:mother?2:2.5)?t.speed*1.25:0;e.walking=speed>0;
      } else if (e.flee) {
        speed = 0.13;
      } else {
        if (--e.wander <= 0) {
          e.yaw =
            hash(e.age, e.id.length, this.world.numericSeed) * Math.PI * 2;
          e.wander = 60 + Math.floor(hash(e.age, 7, 4) * 120);
          e.walking = hash(e.age, 1, e.id.length) > 0.35;
        }
        if (e.walking) speed = t.speed;
      }
      if (e.type === "zombie" && !night) {
        let sky = true;
        for (let y = Math.floor(e.y + t.height); y < HEIGHT; y++)
          if (this.world.solid(Math.floor(e.x), y, Math.floor(e.z))) {
            sky = false;
            break;
          }
        e.burn = sky ? 1 : 0;
        if (sky && e.age % 20 === 0) {
          e.health--;
          e.hurt = 8;
        }
      } else e.burn = 0;
      const dx = Math.sin(e.yaw) * speed + e.vx,
        dz = Math.cos(e.yaw) * speed + e.vz,
        oldX = e.x,
        oldZ = e.z;
      for (const [axis, delta] of [
        ["x", dx],
        ["z", dz],
      ]) {
        const next = Math.max(0.6, Math.min(SIZE - 0.6, e[axis] + delta)),
          x = axis === "x" ? next : e.x,
          z = axis === "z" ? next : e.z;
        if (!actorCollides(this.world, x, e.y, z, t.width, t.height))
          e[axis] = next;
        else if (!actorCollides(this.world, x, e.y + 1, z, t.width, t.height)) {
          e.y += 1;
          e[axis] = next;
        } else e.yaw += Math.PI * 0.55;
      }
      e.vx *= 0.65;
      e.vz *= 0.65;
      e.vy = Math.max(-0.7, (e.vy - 0.08) * 0.98);
      let next = e.y + e.vy;
      if (actorCollides(this.world, e.x, next, e.z, t.width, t.height)) {
        if (e.vy < 0) {
          let floor = Math.floor(e.y);
          while (
            floor > 0 &&
            !actorCollides(
              this.world,
              e.x,
              floor - 0.01,
              e.z,
              t.width,
              t.height,
            )
          )
            floor--;
          e.y = Math.max(floor, e.y - 0.7);
        }
        e.vy = 0;
      } else e.y = next;
      e.gait += Math.hypot(e.x - oldX, e.z - oldZ) * 4;
      if (e.age % 160 === 0 && distance < 18)
        this.events.push({
          sound: "mob." + e.type + ".say",
          position: { x: e.x, y: e.y, z: e.z },
        });
      if (e.health <= 0 && !e.death) {
        e.death = 1;
        this.events.push({ sound: "mob.zombie.death", position: e });
        this.events.push({
          drop: t.drop,
          count: 1,
          position: { x: e.x, y: e.y, z: e.z },
        });
      }
      if (e.y < 0) {
        e.health = 0;
        e.death = 20;
      }
    }
    this.breed();
    this.entities = this.entities.filter((e) => e.health > 0 || e.death < 20);
  }
  serialize() {
    return this.entities.filter((e) => e.health > 0).map((e) => ({ ...e }));
  }
  drain() {
    const events = this.events;
    this.events = [];
    return events;
  }
}
