import * as THREE from "three";
import { firstPersonMatrix } from "./first-person-pose.js";
import { spriteGeometry } from "./sprite-geometry.js";
import { ITEMS } from "./survival.js";
import { isPistonBase, DISPENSER, DROPPER } from "./dispenser-piston.js";
import { CACTUS, DYE, DYES, RED_FLOWER, RED_FLOWERS, YELLOW_FLOWER } from "./world.js";
import { itemSpec, isGateItem, itemBlockId } from './item-boxes.js';
import { STAIR_ITEM_BOXES } from './stairs.js';
import { GATE_ITEM_BOXES, itemBoxUv, BOX_FACE_CORNERS, CACTUS_ITEM_QUADS } from './render-shapes.js';
import { blockTile,tileRect } from "./block-textures.js";
import { entityMaterial, ITEM_LIGHTS } from "./light-material.js";
import { leatherItemLayers } from "./leather-dye.js";
import { FISHING_ROD, rodState } from "./fishing-content.js";
import { ITEM_SKULL, skullIconUrl } from "./skull.js";
import { ITEM_SPAWN_EGG, spawnEggTexture } from "./spawn-eggs.js";
import { ITEM_CLOCK } from "./clock.js";
import { clockFrameUrl, clockFrame } from "./maps-clock-live.js";
import { ITEM_COMPASS, COMPASS_STATIC, COMPASS_STRIP } from "./compass.js";
import { ITEM_FILLED_MAP, mapStore } from "./maps.js";
import { MapSurface, mapHandMatrices } from "./map-render.js";
import { onResourcesRefreshed } from "./resource-refresh.js";
import { versioned } from "./media-version.js";
import { animatedItemUrl, itemFrameTag, onItemFramesReady } from "./item-animation.js";
import { chestItemTexture, chestItemModel } from "./chest-renderer.js";
const loader = new THREE.TextureLoader(),
  cache = new Map();
const BLOCK_FACES=BOX_FACE_CORNERS.map((v)=>({v}));
// The box list of a block item that the unchanged renderBlockAsItem draws as boxes instead of a unit cube (null: a cube or a sprite item): stairs, the gate, fences and the
// ITEM_BOXES blocks, found through the block an item id stands for (item-boxes.js itemBlockId: 1103, the stone slab item, and the other ItemBlock / ItemSlab ids).
export function itemModelBoxes(id){const m=itemSpec(id,0,blockTile);return m&&m.kind!=='anvil'&&m.kind!=='beacon'?m.boxes:null;}
// The geometry a block item takes in a hand, a dropped item (`scale` .25) or an inventory model, or null when it is a plain cube. The anvil and the beacon use their own
// face textures (item-boxes.js itemSpec).
export function blockItemGeometry(id,damage=0,scale=1){
 if(itemBlockId(id)===CACTUS)return cactusItemGeometry(scale);
 const m=itemSpec(id,damage,blockTile);
 return m?boxItemGeometry(m.boxes,m.tileOf,scale,m.uvOf):null;
}
// The yaw a block item takes in a hand or a drop: renderBlockAsItem turns types 0, 16, 22, 26, 31, 39 by 90 degrees about y; stairs, fences, the gate, the beacon, the anvil, the wall,
// the dragon egg and the cactus are not turned (itemSpec.turned). Everything else (cubes, the chest family) is.
export function blockItemTurn(id,damage=0){
 if(itemBlockId(id)===CACTUS)return 0;
 const m=itemSpec(id,damage,blockTile);
 return m&&!m.turned?0:Math.PI/2;
}
// The unit cube of a block item (renderBlockAsItem's single box), each face on its own tile, at `scale` of a block.
export function blockCubeGeometry(id,damage=0,scale=1){
 // renderBlockAsItem draws the dispenser and the dropper as metadata 3 (front side) and a piston as metadata 1, whatever the stack's damage (executed, item-render-reference.json).
 const b=itemBlockId(id);if(b===DISPENSER||b===DROPPER)damage=3;else if(isPistonBase(b))damage=1;
 id=b>0&&b<256?b:id;
 const g=new THREE.BoxGeometry(scale,scale,scale),uv=g.attributes.uv;
 for(let f=0;f<6;f++){const r=tileRect(blockTile(id,f,false,damage));uv.setXY(f*4,r.u0,r.v1);uv.setXY(f*4+1,r.u1,r.v1);uv.setXY(f*4+2,r.u0,r.v0);uv.setXY(f*4+3,r.u1,r.v0);}
 // renderFaceYNeg runs the bottom texture's v along +z (the executed record), the opposite of BoxGeometry's -y face.
 for(const i of[12,13]){const a=uv.getY(i),b=uv.getY(i+2);uv.setY(i,b);uv.setY(i+2,a);}
 return g;
}
// The cactus item (CACTUS_ITEM_QUADS: full top and bottom, sides inset 1/16), at `scale` of a block.
export function cactusItemGeometry(scale=1){
 const positions=[],uvs=[],indices=[];
 for(const [fi,quad] of CACTUS_ITEM_QUADS){
  const r=tileRect(blockTile(CACTUS,fi)),base=positions.length/3;
  for(const [x,y,z,s,t] of quad){positions.push((x-.5)*scale,(y-.5)*scale,(z-.5)*scale);uvs.push(r.u0+(r.u1-r.u0)*s,r.v1-(r.v1-r.v0)*t);}
  indices.push(base,base+1,base+2,base,base+2,base+3);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
// RenderBlocks.renderBlockAsItem for render type 10 (STAIR_ITEM_BOXES), at `scale` of a block.
export function stairItemGeometry(id,scale=1){return boxItemGeometry(STAIR_ITEM_BOXES,(fi)=>blockTile(id,fi),scale);}
// RenderBlocks.renderBlockAsItem for render type 21 (GATE_ITEM_BOXES), at `scale` of a block. `id` is the fence gate item (1167) or block (167).
export function gateItemGeometry(id=1167,scale=1){return boxItemGeometry(GATE_ITEM_BOXES,(fi)=>blockTile(id,fi),scale);}
export { isGateItem };
// Every box with its six faces, the texture cropped to the face's extent as renderFaceXPos... do (itemBoxUv, executed in item-render-reference.json); `uvOf(fi,p,box)` replaces it (the anvil's turned faces).
export function boxItemGeometry(boxes,tileOf,scale=1,uvOf=itemBoxUv){
 const positions=[],uvs=[],indices=[];
 for(const [bk,box] of boxes.entries()){const [x0,y0,z0,x1,y1,z1]=box;for(let fi=0;fi<BLOCK_FACES.length;fi++){
  const face=BLOCK_FACES[fi],tile=tileOf(fi,bk),r=tileRect(tile),base=positions.length/3;
  for(let i=0;i<4;i++){const v=face.v[i],p=[v[0]?x1:x0,v[1]?y1:y0,v[2]?z1:z0],[s,t]=uvOf(fi,p,box);positions.push((p[0]-.5)*scale,(p[1]-.5)*scale,(p[2]-.5)*scale);uvs.push(r.u0+(r.u1-r.u0)*s,r.v1-(r.v1-r.v0)*t);}
  indices.push(base,base+1,base+2,base,base+2,base+3);
 }}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
// RenderItem.renderEffect / ItemRenderer glint (ItemStack.hasEffect): the item's geometry again, with
// misc/enchanted_item_glint.png added over its opaque pixels (the original redraws with depth func EQUAL and the
// colour 0.5, 0.25, 0.8, blend SRC_COLOR, ONE), two layers scrolling at -50 and 10 degrees with periods of 3000 and
// 4873 ms. The scroll scale and offsets are an APPROXIMATION in item UV space (the original scrolls atlas UVs, whose
// scale depends on where the icon sits in the atlas), so the pattern is not pixel exact; the silhouette and the
// colour/blend are the original's.
let glintTexture = null;
export function glintMesh(geometry, map) {
  if (!glintTexture) {
    glintTexture = loader.load("/media/1.7.10/misc/enchanted_item_glint.png");
    glintTexture.wrapS = glintTexture.wrapT = THREE.RepeatWrapping;
  }
  const material = new THREE.ShaderMaterial({
    uniforms: { item: { value: map }, glint: { value: glintTexture }, time: { value: 0 } },
    vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `uniform sampler2D item,glint;uniform float time;varying vec2 vUv;
vec2 turn(vec2 p,float degrees){float a=radians(degrees),c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
void main(){if(texture2D(item,vUv).a<=0.1)discard;
vec3 a=texture2D(glint,turn(vUv*.5,-50.)+vec2(mod(time*1000.,3000.)/3000.,0.)).rgb,b=texture2D(glint,turn(vUv*.5,10.)+vec2(-mod(time*1000.,4873.)/4873.,0.)).rgb;
gl_FragColor=vec4((a+b)*vec3(.5,.25,.8),1.);}`,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcColorFactor, blendDst: THREE.OneFactor,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  mesh.onBeforeRender = () => { material.uniforms.time.value = performance.now() / 1000; };
  return mesh;
}
let compassFrame = 0, compassCanvas, compassImage, compassTexture;
function drawCompassFrame() {
  // CompassTexture frames are square cells of the strip's width (16 px vanilla, bigger in HD packs).
  const f = compassImage.naturalWidth || 16;
  if (compassCanvas.width !== f) { compassCanvas.width = compassCanvas.height = f; compassTexture.dispose(); }
  const ctx = compassCanvas.getContext("2d");
  ctx.clearRect(0, 0, f, f);
  ctx.drawImage(compassImage, 0, compassFrame * f, f, f, 0, 0, f, f);
  compassTexture.needsUpdate = true;
}
onResourcesRefreshed((gen) => { if (compassImage) compassImage.src = versioned(COMPASS_STRIP, gen); });
// Draws strip frame `frame` of compass.png into `canvas` (an item frame's own compass, hanging-renderer.js). False until the strip loads.
export function drawCompassCell(canvas, frame) {
  pixelTexture(COMPASS_STATIC); // makes sure the strip image is requested
  if (!compassImage?.naturalWidth) return false;
  const f = compassImage.naturalWidth;
  if (canvas.width !== f) canvas.width = canvas.height = f;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, f, f);
  ctx.drawImage(compassImage, 0, frame * f, f, f, 0, 0, f, f);
  return true;
}
export function setCompassTextureFrame(frame) {
  if (frame === compassFrame) return;
  compassFrame = frame;
  if (compassImage?.naturalWidth) drawCompassFrame();
}
onItemFramesReady((urls) => { for (const u of urls) pixelTexture(u); }); // decode every frame up front: no blank frame on the first switch
export function pixelTexture(url) {
  if (url === COMPASS_STATIC) {
    if (!compassTexture) {
      compassCanvas = document.createElement("canvas");
      compassCanvas.width = compassCanvas.height = 16;
      compassTexture = new THREE.CanvasTexture(compassCanvas);
      compassTexture.magFilter = compassTexture.minFilter = THREE.NearestFilter;
      compassImage = new Image();
      compassImage.onload = drawCompassFrame;
      compassImage.src = versioned(COMPASS_STRIP);
    }
    return compassTexture;
  }
  if (!cache.has(url)) {
    const t = loader.load(url);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    cache.set(url, t);
  }
  return cache.get(url);
}
// `mirror` is ModelRenderer.mirror (the left arm and leg of a skeleton): every face is flipped
// in u and the two side faces trade their regions.
export function skinBox(w, h, d, u, v, tw, th, mirror = false) {
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
  if (mirror) [regions[0], regions[1]] = [regions[1], regions[0]];
  regions.forEach(([x, y, rw, rh], face) => {
    const a = (mirror ? x + rw : x) / tw,
      b = (mirror ? x : x + rw) / tw,
      c = 1 - y / th,
      e = 1 - (y + rh) / th;
    uv.setXY(face * 4, a, c);
    uv.setXY(face * 4 + 1, b, c);
    uv.setXY(face * 4 + 2, a, e);
    uv.setXY(face * 4 + 3, b, e);
  });
  return g;
}
// `use` is the bow's draw stage (bow.js bowStage: 0 standby, 1 to 3 bow_pulling_0 to 2).
// The versioned url (a pack change re-requests it) or, for a pack-animated item strip, the current frame (item-animation.js).
export function itemTexture(id, damage = 0, use = 0) {
  const url = itemTextureRaw(id, damage, use);
  return typeof url === "string" && url.startsWith("/media/") ? animatedItemUrl(versioned(url)) : url;
}
function itemTextureRaw(id, damage = 0, use = 0) {
  const item = ITEMS[id];
  if (id === ITEM_SKULL) return skullIconUrl(damage); // skull.js: one flat sprite per head type
  if (id === ITEM_SPAWN_EGG) return spawnEggTexture(damage); // two tinted layers composed (spawn-eggs.js)
  if (id === ITEM_CLOCK) return clockFrameUrl(); // TextureClock frame (maps-clock-live.js)
  if (id === ITEM_COMPASS) return COMPASS_STATIC; // pixelTexture shares a mutable sprite across 3D renderers
  if (id === FISHING_ROD && use > 0) return "/media/1.7.10/items/fishing_rod_cast.png";
  if (id === 127 && use > 0) return "/media/1.7.10/items/bow_pulling_" + (Math.min(3, use) - 1) + ".png";
  // Flowers are flat sprites cut from the terrain atlas textures; dyes are one item per damage.
  if(id===YELLOW_FLOWER)return "/media/1.7.10/blocks/flower_dandelion.png";
  if(id===RED_FLOWER)return "/media/1.7.10/blocks/flower_"+RED_FLOWERS[Math.max(0,Math.min(RED_FLOWERS.length-1,damage|0))].texture+".png";
  if(id===DYE)return "/media/1.7.10/items/dye_powder_"+DYES[Math.max(0,Math.min(15,damage|0))].texture+".png";
  if(id===20||id===39)return "/media/1.7.10/blocks/"+(id===20?"torch_on":"tallgrass")+".png";
  if(id===51)return "/media/1.7.10/blocks/web.png";
  // BlockPane items are flat sprites of the side texture (ItemBlock icon of render types 18 and 41).
  if(id===99||id===1100)return "/media/1.7.10/blocks/"+(id===99?"iron_bars":"glass")+".png";
  // Lever and tripwire hook items are flat sprites of their block textures (ItemBlock icons of render types 12 and 29).
  if(id===1108||id===1113)return "/media/1.7.10/blocks/"+(id===1108?"lever":"trip_wire_source")+".png";
  // The redstone torch item (block 1120 - 1000) is a flat sprite of its lit texture like torch 20.
  if(id===1120)return "/media/1.7.10/blocks/redstone_torch_on.png";
  if(id===48)return "/media/1.7.10/blocks/sapling_oak.png";
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
    316:"egg",317:"feather",318:"chicken_raw",319:"chicken_cooked",
    306: "brick",
    307: "clay_ball",
    308: "coal",
    309:"seeds_wheat",311:"bone",
  };
  return names[id] ? "/media/1.7.10/items/" + names[id] + ".png" : null;
}
export class FirstPerson {
  constructor(renderer, atlas, lighting) {
    this.renderer = renderer;
    this.atlas = atlas;
    this.lighting = lighting;
    // ItemRenderer turns the standard item lights by the player's pitch and
    // yaw, so they stay fixed in the world while the hand follows the view.
    this.lights = ITEM_LIGHTS.map((l) => l.clone());
    this.materials = [];
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      70,
      innerWidth / innerHeight,
      0.01,
      10,
    );
    this.pivot = new THREE.Group();
    this.pivot.matrixAutoUpdate = false;
    this.scene.add(this.pivot);
    this.arm = new THREE.Group();
    const armGeometry=skinBox(4,12,4,40,16,64,32),armUv=armGeometry.attributes.uv;
    // ModelBiped's local +Y points from shoulder to fingertips. Its UV rows
    // increase in that direction, unlike the world-space upright skin boxes.
    for(const face of [0,1,4,5]){const top=armUv.getY(face*4),bottom=armUv.getY(face*4+2);for(let v=0;v<4;v++)armUv.setY(face*4+v,top+bottom-armUv.getY(face*4+v));}
    const armMesh=new THREE.Mesh(armGeometry,this.material({map:pixelTexture('/media/1.7.10/entity/steve.png')},true));
    armMesh.position.set(-1/16,4/16,0);this.arm.add(armMesh);this.arm.position.set(-5/16,2/16,0);this.arm.rotation.z=.1;
    this.pivot.add(this.arm);
    this.item = null;
    this.last = -1;
  }
  // `meta` is the wool colour (the stack's damage) of a held block.
  select(id, meta = 0, use = 0, glint = false, color = undefined) {
    const leather = leatherItemLayers(id, color),
      cast = id === FISHING_ROD && rodState.cast ? 1 : 0, key = id + ":" + meta + ":" + use + ":" + (glint ? 1 : 0) + ":" + (leather?.color ?? 0) + ":" + cast + ":" + (id === ITEM_CLOCK ? clockFrame() : 0) + ":" + (id ? itemFrameTag(itemTexture(id, meta, cast ? 1 : use)) : 0);
    if (key === this.last) return;
    this.last = key;
    if (this.item) {
      this.pivot.remove(this.item);
      const owned = new Set();
      this.item.traverse((node) => { node.geometry?.dispose(); if (node.material) for (const material of Array.isArray(node.material) ? node.material : [node.material]) owned.add(material); });
      for (const material of owned) material.dispose();
      this.materials = this.materials.filter((material) => !owned.has(material));
      this.item = null;
    }
    const data = ITEMS[id];
    this.arm.visible = !id;
    if (!id || !data) return;
    let mesh;
    const url = itemTexture(id, meta, cast ? 1 : use), chestUrl = !url && chestItemTexture(id);
    if (chestUrl) {
      mesh = chestItemModel(this.material({ map: pixelTexture(chestUrl) }));
      mesh.rotation.y = Math.PI / 2;
    } else if(blockItemGeometry(id,meta)){
      mesh=new THREE.Mesh(blockItemGeometry(id,meta),this.material({map:this.atlas,alphaTest:.1}));
      mesh.rotation.y=blockItemTurn(id,meta);
    } else if (url) {
      mesh = new THREE.Mesh(
        spriteGeometry(),
        this.material({
          map: pixelTexture(url),
          ...(leather ? { color: leather.tint } : {}),
          transparent: true,
          alphaTest: 0.1,
          side: THREE.DoubleSide,
        }),
      );
      if (leather) {
        const overlay = new THREE.Mesh(mesh.geometry, this.material({
          map: pixelTexture(leather.overlay),
          transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, depthWrite: false,
          polygonOffset: true, polygonOffsetFactor: -1,
        }));
        overlay.renderOrder = 1;
        mesh.add(overlay);
        if (glint) overlay.add(glintMesh(mesh.geometry, pixelTexture(leather.overlay)));
      }

    } else {
      mesh = new THREE.Mesh(blockCubeGeometry(id, meta), this.material({ map: this.atlas,alphaTest:.1 }));
      mesh.rotation.y = blockItemTurn(id, meta);
    }
    this.sprite = !!url;
    if (glint && mesh.geometry) mesh.add(glintMesh(mesh.geometry, url ? pixelTexture(url) : this.atlas));
    this.pivot.add(mesh);
    this.item = mesh;
  }
  material(options) {
    const m = entityMaterial(this.lighting, { ...options, fog: false, lights: this.lights });
    if (options.depthWrite !== undefined) m.depthWrite = options.depthWrite;
    if (options.polygonOffset !== undefined) m.polygonOffset = options.polygonOffset;
    if (options.polygonOffsetFactor !== undefined) m.polygonOffsetFactor = options.polygonOffsetFactor;
    this.materials.push(m);
    return m;
  }
  // `light` is the packed brightness at the player; `view` the world camera.
  // ItemRenderer's filled-map branch (map-render.js): both arms and the map on its background, in place of the held sprite.
  mapPose(pose, pitchDeg, data) {
    if (!this.mapSurface) {
      this.mapSurface = new MapSurface((o) => this.material(o), { background: true });
      this.mapRoot = new THREE.Group();
      this.mapArms = [0, 1].map(() => { const holder = new THREE.Group(), arm = this.arm.clone(); arm.visible = true; holder.matrixAutoUpdate = false; holder.add(arm); this.mapRoot.add(holder); return holder; });
      this.mapRoot.add(this.mapSurface.root);
      this.pivot.add(this.mapRoot);
    }
    const m = mapHandMatrices(pose, pitchDeg);
    this.mapArms.forEach((h, k) => h.matrix.copy(m.arms[k]));
    this.mapSurface.root.matrix.copy(m.map);
    this.mapSurface.update(data);
    return m.base;
  }
  render(pose, { visible = true, light = 15 << 20, view = null, eating = null, time = 0, bow = null, glint = false, color = undefined, map = null, pitchDeg = 0 } = {}) {
    if (!visible) return;
    // `bow` is { stage, draw } while the bow is drawn (bow.js bowStage and the draw term).
    this.select(pose.item, pose.meta, bow ? bow.stage : 0, glint, color);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    const mapMode = !!map?.data && pose.item === ITEM_FILLED_MAP;
    this.pivot.matrix.copy(mapMode ? this.mapPose(pose, pitchDeg, map.data) : firstPersonMatrix(pose,{sprite:this.sprite,eatingTicks:eating,bowDraw:bow ? bow.draw : null}));
    if (this.mapRoot) this.mapRoot.visible = mapMode;
    if (this.item) this.item.visible = !mapMode;
    // Keep the native pose visible when the browser panel is narrower than a game window.
    if(this.camera.aspect<1.3)this.pivot.matrix.premultiply(new THREE.Matrix4().makeTranslation((pose.item ? .56 : .64)*(this.camera.aspect/1.3-1),0,0));
    if (view) this.lights.forEach((l, i) => l.copy(ITEM_LIGHTS[i]).transformDirection(view.matrixWorldInverse));
    for (const m of this.materials) m.setLight(light);
    const clear = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = clear;
  }
}
