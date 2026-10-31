import * as THREE from "three";
import { WorldEffects } from "./effects.js";
import { SIZE, HEIGHT, SEA, BLOCKS, hash, blockHeight, isPlant } from "./world.js";
import {createBlockAtlas,blockTile,tileRect,ATLAS_ROWS} from "./block-textures.js";
export {blockTile} from "./block-textures.js";
const FACES = [
  {
    n: [1, 0, 0],
    v: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    shade: 0.78,
  },
  {
    n: [-1, 0, 0],
    v: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    shade: 0.64,
  },
  {
    n: [0, 1, 0],
    v: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    shade: 1,
  },
  {
    n: [0, -1, 0],
    v: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    shade: 0.5,
  },
  {
    n: [0, 0, 1],
    v: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    shade: 0.9,
  },
  {
    n: [0, 0, -1],
    v: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    shade: 0.72,
  },
];
export class VoxelScene {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#c6dddd");
    this.scene.fog = new THREE.Fog("#c6dddd", 65, 155);
    this.effects = new WorldEffects(this.scene);
    this.camera = new THREE.PerspectiveCamera(
      65,
      innerWidth / innerHeight,
      0.1,
      280,
    );
    this.camera.rotation.order = "YXZ";
    this.ambient = new THREE.HemisphereLight("#fff7df", "#68795b", 2.2);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight("#fff2d7", 2.3);
    this.sun.position.set(-60, 100, 40);
    this.scene.add(this.sun);
    this.sunDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(14,14),
      new THREE.MeshBasicMaterial({ map:new THREE.TextureLoader().load("/media/1.7.10/environment/sun.png"),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false }),
    );
    this.moonTexture=new THREE.TextureLoader().load("/media/1.7.10/environment/moon_phases.png");this.moonTexture.magFilter=this.moonTexture.minFilter=THREE.NearestFilter;this.moonTexture.repeat.set(.25,.5);
    this.moonDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(12,12),
      new THREE.MeshBasicMaterial({map:this.moonTexture,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}),
    );
    this.scene.add(this.sunDisc, this.moonDisc);
    this.torchMaterial = new THREE.MeshLambertMaterial({ color: "#996b3f" });
    this.flameMaterial = new THREE.MeshBasicMaterial({ color: "#ffcb76" });
    this.torchLights = Array.from({ length: 4 }, () => {
      const l = new THREE.PointLight("#ffbd67", 0, 13, 1.4);
      this.scene.add(l);
      return l;
    });
    this.skyColor = new THREE.Color();
    this.setTime(6000);
    this.textures=createBlockAtlas();
    this.material = new THREE.MeshLambertMaterial({map:this.textures.texture,vertexColors:true,alphaTest:.4,side:THREE.FrontSide});
    this.torchMaterial=new THREE.MeshLambertMaterial({map:this.textures.texture,alphaTest:.1});
    this.waterTexture = new THREE.TextureLoader().load(
      "/media/1.7.10/blocks/water_still.png",
      (t) => {
        t.magFilter = t.minFilter = THREE.NearestFilter;
        t.repeat.set(1, 1 / 32);
      },
    );
    this.waterMaterial = new THREE.MeshLambertMaterial({
      map: this.waterTexture,
      color: "#3f76e4",
      transparent: true,
      opacity: 0.66,
      side: THREE.DoubleSide,
    });
    this.chunks = new Map();
    this.clouds = new THREE.Group();
    const cm = new THREE.MeshLambertMaterial({
      color: "#f7f4e7",
      transparent: true,
      opacity: 0.87,
    });
    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          10 + hash(i, 2, 8) * 17,
          1.3,
          5 + hash(i, 4, 2) * 7,
        ),
        cm,
      );
      mesh.position.set(
        hash(i, 0, 4) * 260 - 60,
        58 + hash(i, 0, 7) * 8,
        hash(i, 1, 3) * 220 - 40,
      );
      this.clouds.add(mesh);
    }
    this.scene.add(this.clouds);
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.008, 1.008, 1.008)),
      new THREE.LineBasicMaterial({
        color: "#f9f9e5",
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.scene.add(this.outline);
    this.outline.visible = false;
    this.resize = () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    };
    window.addEventListener("resize", this.resize);
  }
  setWorld(world) {
    this.effects.clear();
    this.world = world;
    this.textures.setBiome(world.biome);
    this.litFurnaces=new Set();
    for (const v of this.chunks.values()) {
      this.scene.remove(v);
      for (const child of v.children) child.geometry.dispose();
    }
    this.chunks.clear();
    for (let x = 0; x < SIZE; x += 16)
      for (let z = 0; z < SIZE; z += 16) this.buildChunk(x, z);
  }
  buildChunk(cx, cz) {
    const key = `${cx},${cz}`,
      old = this.chunks.get(key);
    if (old) {
      this.scene.remove(old);
      for (const child of old.children) child.geometry.dispose();
    }
    const p = [],
      n = [],
      uv = [],
      color = [],
      idx = [],
      wp = [],
      wuv = [],
      wi = [];
    let vi = 0,
      wvi = 0;
    const w = this.world;
    for (let x = cx; x < cx + 16; x++)
      for (let z = cz; z < cz + 16; z++)
        for (let y = 0; y < HEIGHT; y++) {
          const b = w.get(x, y, z);
          if (!b || b === 20 || b === 41) continue;
          if(isPlant(b)){
            const rect=tileRect(blockTile(b,0));
            for(const corners of [[[.12,0,.12],[.88,0,.88],[.88,1,.88],[.12,1,.12]],[[.88,0,.12],[.12,0,.88],[.12,1,.88],[.88,1,.12]]]){for(const v of corners){p.push(x+v[0],y+v[1],z+v[2]);n.push(0,1,0);color.push(.95,.95,.95);}uv.push(rect.u0,rect.v0,rect.u1,rect.v0,rect.u1,rect.v1,rect.u0,rect.v1);idx.push(vi,vi+1,vi+2,vi,vi+2,vi+3,vi,vi+2,vi+1,vi,vi+3,vi+2);vi+=4;}continue;
          }
          if (b === 10) {
            if (!w.get(x, y + 1, z)) {
              wp.push(
                x,
                y + 0.87,
                z + 1,
                x + 1,
                y + 0.87,
                z + 1,
                x + 1,
                y + 0.87,
                z,
                x,
                y + 0.87,
                z,
              );
              wuv.push(0, 1, 1, 1, 1, 0, 0, 0);
              wi.push(wvi, wvi + 1, wvi + 2, wvi, wvi + 2, wvi + 3);
              wvi += 4;
            }
            continue;
          }
          FACES.forEach((f, fi) => {
            const nb = w.get(x + f.n[0], y + f.n[1], z + f.n[2]);
            if(nb&&nb!==10&&nb!==20&&!isPlant(nb)&&nb!==5&&nb!==9&&blockHeight(nb)===1)return;
            if((b===9&&nb===9)||(b===5&&nb===5))return;
            const rect=tileRect(blockTile(b,fi,this.litFurnaces?.has(`${x},${y},${z}`)));
            const variation = 0.96 + hash(x, z, y) * 0.07;
            for (const v of f.v) {
              p.push(x + v[0], y + v[1]*blockHeight(b), z + v[2]);
              n.push(...f.n);
              const shade = f.shade * variation;
              color.push(shade, shade, shade);
            }
            uv.push(rect.u0,rect.v0,rect.u1,rect.v0,rect.u1,rect.v1,rect.u0,rect.v1);
            idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
            vi += 4;
          });
        }
    const group = new THREE.Group();
    group.userData.torches = [];
    for (let x = cx; x < cx + 16; x++)
      for (let z = cz; z < cz + 16; z++)
        for (let y = 0; y < HEIGHT; y++)
          if (w.get(x, y, z) === 20) {
            const geometry=new THREE.BoxGeometry(.125,.625,.125),attr=geometry.attributes.uv,t=blockTile(20,0);const tx=t%16*16,ty=Math.floor(t/16)*16;
            for(let f=0;f<6;f++){const x0=(tx+7)/256,x1=(tx+9)/256,y0=1-(ty+16)/(ATLAS_ROWS*16),y1=1-(ty+6)/(ATLAS_ROWS*16);attr.setXY(f*4,x0,y1);attr.setXY(f*4+1,x1,y1);attr.setXY(f*4+2,x0,y0);attr.setXY(f*4+3,x1,y0);}
            const torch=new THREE.Mesh(geometry,this.torchMaterial);torch.position.set(x+.5,y+.3125,z+.5);group.add(torch);
            group.userData.torches.push(
              new THREE.Vector3(x + 0.5, y + 0.65, z + 0.5),
            );
          }
    for(const key of this.litFurnaces||[]){const [x,y,z]=key.split(",").map(Number);if(x>=cx&&x<cx+16&&z>=cz&&z<cz+16)group.userData.torches.push(new THREE.Vector3(x+.5,y+.5,z+.5));}
    if (p.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
      g.setIndex(idx);
      g.computeBoundingSphere();
      group.add(new THREE.Mesh(g, this.material));
    }
    if (wp.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(wp, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(wuv, 2));
      g.setIndex(wi);
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g, this.waterMaterial));
    }
    this.chunks.set(key, group);
    this.scene.add(group);
  }
  setFurnaces(data){const next=new Set(Object.entries(data).filter(([,f])=>f.burn>0).map(([key])=>key));const changed=[...new Set([...next,...this.litFurnaces||[]])].filter(k=>next.has(k)!==this.litFurnaces?.has(k));this.litFurnaces=next;const chunks=new Set(changed.map(k=>{const[x,,z]=k.split(',').map(Number);return[Math.floor(x/16)*16,Math.floor(z/16)*16].join(',');}));for(const k of chunks)this.buildChunk(...k.split(',').map(Number));}
  updateBlock(x, z) {
    const cx = Math.floor(x / 16) * 16,
      cz = Math.floor(z / 16) * 16;
    this.buildChunk(cx, cz);
    if (x % 16 === 0 && cx > 0) this.buildChunk(cx - 16, cz);
    if (x % 16 === 15 && cx + 16 < SIZE) this.buildChunk(cx + 16, cz);
    if (z % 16 === 0 && cz > 0) this.buildChunk(cx, cz - 16);
    if (z % 16 === 15 && cz + 16 < SIZE) this.buildChunk(cx, cz + 16);
  }
  preview(time) {
    this.setTime(6000);
    this.camera.position.set(
      91 + Math.sin(time * 0.025) * 4,
      48,
      108 + Math.cos(time * 0.025) * 4,
    );
    this.camera.lookAt(49, 20, 44);
    this.outline.visible = false;
  }
  setTime(ticks) {
    if(this.moonTexture){const phase=Math.floor(ticks/24000)%8;this.moonTexture.offset.set(phase%4*.25,1-(Math.floor(phase/4)+1)*.5);}
    const a = ((ticks % 24000) / 24000 - 0.25) * Math.PI * 2;
    this.daylight = Math.max(0.04, Math.min(1, (Math.cos(a) + 0.2) * 1.7));
    this.skyColor
      .set("#152337")
      .lerp(new THREE.Color("#c6dddd"), this.daylight);
    this.scene.background.copy(this.skyColor);
    this.scene.fog.color.copy(this.skyColor);
    this.ambient.intensity = 0.19 + this.daylight * 2.01;
    this.sun.intensity = 0.12 + this.daylight * 2.18;
    this.sun.position.set(Math.sin(a) * 100, Math.cos(a) * 100, 40);
    this.sunDisc.position.set(
      64 + Math.sin(a) * 115,
      24 + Math.cos(a) * 115,
      15,
    );
    this.sunDisc.lookAt(64, 24, 64);
    this.moonDisc.position.set(
      64 - Math.sin(a) * 115,
      24 - Math.cos(a) * 115,
      100,
    );
    this.moonDisc.lookAt(64, 24, 64);
  }
  render(time, dt = 1 / 60) {
    this.effects.update(dt);
    this.waterTexture.offset.y = 1 - ((Math.floor(time * 10) % 32) + 1) / 32;
    this.clouds.position.x = Math.sin(time * 0.004) * 5;
    const torches = [...this.chunks.values()]
      .flatMap((c) => c.userData.torches || [])
      .filter((p) => p.distanceToSquared(this.camera.position) < 30 * 30)
      .sort(
        (a, b) =>
          a.distanceToSquared(this.camera.position) -
          b.distanceToSquared(this.camera.position),
      );
    this.torchLights.forEach((light, i) => {
      light.intensity = torches[i] ? 6 : 0;
      if (torches[i]) light.position.copy(torches[i]);
    });
    this.renderer.render(this.scene, this.camera);
    this.worldTriangles = this.renderer.info.render.triangles;
  }
  setDistance(distance) {
    this.scene.fog.near = distance * 0.48;
    this.scene.fog.far = distance;
  }
  setDrops(drops) {
    this.dropMarkers ??= [];
    while (this.dropMarkers.length > drops.length) {
      const m = this.dropMarkers.pop();
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    drops.forEach((d, i) => {
      if (!this.dropMarkers[i]) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.4, 0.4),
          new THREE.MeshLambertMaterial({
            color: "#d6c49a",
            emissive: "#5b5038",
            emissiveIntensity: 0.4,
          }),
        );
        this.dropMarkers[i] = m;
        this.scene.add(m);
      }
      this.dropMarkers[i].position.set(
        d.position.x,
        d.position.y + 0.3,
        d.position.z,
      );
      this.dropMarkers[i].rotation.y = this.camera.rotation.y + 0.7;
    });
  }
}
