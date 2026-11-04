import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LEATHER_COLOR, LEATHER_ARMOR, leatherColorComponents, leatherItemLayers } from './leather-dye.js';

test('held and dropped leather item appearance exposes the native base tint and untinted overlay textures',()=>{
  assert.equal(LEATHER_ARMOR.length,4);
  for(let i=0;i<4;i++){
    const layer=leatherItemLayers(400+i);
    assert.equal(layer.color,LEATHER_COLOR);
    assert.equal(layer.base,`/media/1.7.10/items/${['leather_helmet','leather_chestplate','leather_leggings','leather_boots'][i]}.png`);
    assert.equal(layer.overlay,layer.base.replace('.png','_overlay.png'));
    assert.deepEqual(layer.tint,leatherColorComponents(layer.color));
  }
  const dyed=leatherItemLayers(400,0x1265af),black=leatherItemLayers(401,0);
  assert.equal(dyed.color,0x1265af);assert.deepEqual(dyed.tint,[0x12/255,0x65/255,0xaf/255]);
  assert.equal(black.color,0);assert.deepEqual(black.tint,[0,0,0]);
  assert.deepEqual(leatherItemLayers(402,-1).tint,leatherColorComponents());
  assert.equal(leatherItemLayers(103,0x123456),null);
});

test('held and dropped item renderers tint the base, leave overlay white, and dispose owned glint materials',async()=>{
  const originalLoad=THREE.TextureLoader.prototype.load;
  THREE.TextureLoader.prototype.load=function(url){const texture=new THREE.Texture();texture.userData.url=url;return texture;};
  try {
    const [{FirstPerson},{DropRenderer},{PlayerRenderer}]=await Promise.all([import('./first-person.js'),import('./drop-renderer.js'),import('./player-renderer.js')]);
    const lighting={uniforms:{lightmap:{value:new THREE.Texture()},fogColor:{value:new THREE.Vector3()},fogNear:{value:1},fogFar:{value:2},fogDensity:{value:0}}};
    const first=Object.create(FirstPerson.prototype);Object.assign(first,{lighting,lights:[],materials:[],pivot:new THREE.Group(),arm:new THREE.Group(),atlas:new THREE.Texture(),last:-1,item:null});first.pivot.add(first.arm);
    first.select(400,0,0,true,0);
    const firstOld=first.item,firstMeshes=[];firstOld.traverse(n=>{if(n.isMesh)firstMeshes.push(n);});
    assert.deepEqual(firstMeshes[0].material.uniforms.tint.value.toArray(),[0,0,0]);
    assert.deepEqual(firstMeshes.find(n=>n.renderOrder===1).material.uniforms.tint.value.toArray(),[1,1,1]);
    assert.equal(firstMeshes.find(n=>n.renderOrder===1).material.depthWrite,false);
    const disposedFirst=[];firstOld.traverse(n=>{if(n.material)n.material.addEventListener('dispose',()=>disposedFirst.push(n.material));});
    first.select(400,0,0,true,0x123456);
    assert.notEqual(first.item,firstOld);assert.ok(disposedFirst.length>=3);
    assert.deepEqual(first.item.material.uniforms.tint.value.toArray(),[0x12/255,0x34/255,0x56/255]);

    const third=Object.create(PlayerRenderer.prototype);Object.assign(third,{view:{lighting},atlas:new THREE.Texture(),materials:[],heldKey:'0:0',heldId:0,held:null,heldMaterial:null,heldOverlayMaterial:null,heldGeometry:null,pivots:{rightArm:new THREE.Group()}});
    third.syncHeld(400,0,0,true);
    const heldOld=third.held,heldNodes=[];heldOld.traverse(n=>{if(n.isMesh)heldNodes.push(n);});
    assert.deepEqual(third.heldMaterial.uniforms.tint.value.toArray(),[0,0,0]);
    assert.deepEqual(third.heldOverlayMaterial.uniforms.tint.value.toArray(),[1,1,1]);
    assert.equal(third.heldOverlayMaterial.depthWrite,false);
    const disposedThird=[];heldOld.traverse(n=>{if(n.material)n.material.addEventListener('dispose',()=>disposedThird.push(n.material));});
    third.syncHeld(400,0,0x123456,true);
    assert.notEqual(third.held,heldOld);assert.ok(disposedThird.length>=3);
    assert.deepEqual(third.heldMaterial.uniforms.tint.value.toArray(),[0x12/255,0x34/255,0x56/255]);

    const scene=new THREE.Scene(),view={lighting,textures:{texture:new THREE.Texture()},brightness:()=>15<<20},drops=new DropRenderer(scene,view),entity={stack:{id:400,count:2,damage:0,color:0,enchantments:[]},hover:0,x:1,y:2,z:3,px:1,py:2,pz:3,age:0};
    drops.update([entity]);const oldPile=drops.piles.get(entity),oldMaterials=new Set();oldPile.group.traverse(n=>{if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material])oldMaterials.add(m);});
    const disposedDrop=[];for(const m of oldMaterials)m.addEventListener('dispose',()=>disposedDrop.push(m));
    assert.ok(oldPile.group.children[0].children.some(n=>n.renderOrder===1));
    assert.equal(oldPile.overlayMaterial.depthWrite,false);
    entity.stack={...entity.stack,color:0x123456};drops.update([entity]);
    assert.notEqual(drops.piles.get(entity),oldPile);assert.equal(disposedDrop.length,oldMaterials.size);
    assert.deepEqual(drops.piles.get(entity).material.uniforms.tint.value.toArray(),[0x12/255,0x34/255,0x56/255]);
    drops.clear();
  } finally {THREE.TextureLoader.prototype.load=originalLoad;}
});
