import * as THREE from "three";
import { firstPersonMatrix } from "./first-person-pose.js";
import { spriteGeometry } from "./sprite-geometry.js";
import { ITEMS } from "./survival.js";
import { blockTile,tileRect } from "./block-textures.js";
const loader = new THREE.TextureLoader(),
  cache = new Map();
export function pixelTexture(url) {
  if (!cache.has(url)) {
    const t = loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = t.minFilter = THREE.NearestFilter;
    cache.set(url, t);
  }
  return cache.get(url);
}
export function skinBox(w, h, d, u, v, tw, th) {
  const g = new THREE.BoxGeometry(w / 16, h / 16, d / 16);
  const regions = [
      [u + d + w, v + d, d, h],
      [u, v + d, d, h],
      [u + d, v, w, d],
      [u + d + w, v, w, d],
      [u + d, v + d, w, h],
      [u + d + w + d, v + d, w, h],
    ],
    uv = g.attributes.uv;
  regions.forEach(([x, y, rw, rh], face) => {
    const a = x / tw,
      b = (x + rw) / tw,
      c = 1 - y / th,
      e = 1 - (y + rh) / th;
    uv.setXY(face * 4, a, c);
    uv.setXY(face * 4 + 1, b, c);
    uv.setXY(face * 4 + 2, a, e);
    uv.setXY(face * 4 + 3, b, e);
  });
  return g;
}
export function itemTexture(id) {
  const item = ITEMS[id];
  if(id===20||id===39)return "/media/1.7.10/blocks/"+(id===20?"torch_on":"tallgrass")+".png";
  if(id===125)return "/media/1.7.10/items/shears.png";
  if(item?.texture)return "/media/1.7.10/items/"+item.texture+".png";
  if (item?.kind) {
    const material = item.name.startsWith("Wooden")
      ? "wood"
      : item.name.startsWith("Golden")
        ? "gold"
        : item.name.split(" ")[0].toLowerCase();
    return "/media/1.7.10/items/" + material + "_" + item.kind + ".png";
  }
  const names = {
    200: "apple",
    201: "bread",
    202: "porkchop_raw",
    203: "porkchop_cooked",
    204: "beef_raw",
    205: "beef_cooked",
    206: "rotten_flesh",
    300: "stick",
    301: "coal",
    302: "iron_ingot",
    303: "diamond",
    304: "gold_ingot",
    305: "wheat",
    312:"snowball",313:"flint",314:"book",
    306: "brick",
    307: "clay_ball",
    308: "coal",
    309:"seeds_wheat",310:"dye_powder_white",311:"bone",
  };
  return names[id] ? "/media/1.7.10/items/" + names[id] + ".png" : null;
}
export class FirstPerson {
  constructor(renderer, atlas) {
    this.renderer = renderer;
    this.atlas = atlas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      70,
      innerWidth / innerHeight,
      0.01,
      10,
    );
    this.scene.add(new THREE.HemisphereLight("#fff6e2", "#71826c", 2.6));
    this.pivot = new THREE.Group();
    this.pivot.matrixAutoUpdate = false;
    this.scene.add(this.pivot);
    this.arm = new THREE.Group();
    const armGeometry=skinBox(4,12,4,40,16,64,32),armUv=armGeometry.attributes.uv;
    // ModelBiped's local +Y points from shoulder to fingertips. Its UV rows
    // increase in that direction, unlike the world-space upright skin boxes.
    for(const face of [0,1,4,5]){const top=armUv.getY(face*4),bottom=armUv.getY(face*4+2);for(let v=0;v<4;v++)armUv.setY(face*4+v,top+bottom-armUv.getY(face*4+v));}
    const armMesh=new THREE.Mesh(armGeometry,new THREE.MeshLambertMaterial({map:pixelTexture('/media/1.7.10/entity/steve.png')}));
    armMesh.position.set(-1/16,4/16,0);this.arm.add(armMesh);this.arm.position.set(-5/16,2/16,0);this.arm.rotation.z=.1;
    this.pivot.add(this.arm);
    this.item = null;
    this.last = -1;
  }
  select(id) {
    if (id === this.last) return;
    this.last = id;
    if (this.item) {
      this.pivot.remove(this.item);
      this.item.geometry.dispose();
      this.item.material.dispose();
      this.item = null;
    }
    const data = ITEMS[id];
    this.arm.visible = !id;
    if (!id || !data) return;
    let mesh;
    const url = itemTexture(id);
    if (url) {
      mesh = new THREE.Mesh(
        spriteGeometry(),
        new THREE.MeshLambertMaterial({
          map: pixelTexture(url),
          transparent: true,
          alphaTest: 0.2,
          side: THREE.DoubleSide,
        }),
      );

    } else {
      const g = new THREE.BoxGeometry(1, 1, 1),
        uv = g.attributes.uv;
      for (let f = 0; f < 6; f++) {
        const r=tileRect(blockTile(id,f));uv.setXY(f*4,r.u0,r.v1);uv.setXY(f*4+1,r.u1,r.v1);uv.setXY(f*4+2,r.u0,r.v0);uv.setXY(f*4+3,r.u1,r.v0);
      }
      mesh = new THREE.Mesh(
        g,
        new THREE.MeshLambertMaterial({ map: this.atlas,alphaTest:.4 }),
      );
      mesh.rotation.y = Math.PI / 2;
    }
    this.sprite = !!url;
    this.pivot.add(mesh);
    this.item = mesh;
  }
  render(pose, { visible = true, daylight = 1, eating = null, time = 0 } = {}) {
    if (!visible) return;
    this.select(pose.item);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.pivot.matrix.copy(firstPersonMatrix(pose,{sprite:this.sprite,eatingTicks:eating}));
    // Keep the native pose visible when the browser panel is narrower than a game window.
    if(this.camera.aspect<1.3)this.pivot.matrix.premultiply(new THREE.Matrix4().makeTranslation((pose.item ? .56 : .64)*(this.camera.aspect/1.3-1),0,0));
    this.scene.children[0].intensity = 0.7 + daylight * 1.9;
    const clear = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = clear;
  }
}
