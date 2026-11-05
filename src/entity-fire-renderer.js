import * as THREE from 'three';
import { pixelTexture } from './first-person.js';

// Render.renderEntityOnFire (bno.a): width * 1.4 scale, alternating fire sprites, 0.45-high steps,
// shrinking width and advancing depth. The GUI uses playerViewY = 180, independently of the model's body yaw.
const f = Math.fround;
export function entityFireLayers(width, height, yOffset = 0) {
  const scale = f(f(width) * f(1.4)), layers = [];
  let remaining = f(f(height) / scale), offset = f(yOffset), half = f(0.5), depth = 0;
  const z = f(f(-0.3) + f(Math.trunc(remaining) * f(0.02)));
  for (let i = 0; remaining > 0 && i < 128; i++) {
    layers.push({ sprite: i % 2, flip: Math.trunc(i / 2) % 2 === 0, half, bottom: f(-offset), top: f(f(1.4) - offset), z: f(z + depth), scale });
    remaining = f(remaining - f(0.45)); offset = f(offset - f(0.45)); half = f(half * f(0.9)); depth = f(depth + f(0.03));
  }
  return layers;
}
export class EntityFireRenderer {
  constructor(scene, width = 0.6, height = 1.8, yOffset = 1.62) {
    this.root = new THREE.Group(); this.root.visible = false; scene.add(this.root);
    this.materials = [0, 1].map(i => {
      const map = pixelTexture(`/media/1.7.10/blocks/fire_layer_${i}.png`);
      const m = new THREE.ShaderMaterial({ uniforms: { map: {value:map}, frame:{value:0}, frames:{value:32} }, side:THREE.DoubleSide, transparent:true, depthWrite:true,
        vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:'uniform sampler2D map;uniform float frame,frames;varying vec2 vUv;void main(){vec4 c=texture2D(map,vec2(vUv.x,(vUv.y+frames-1.-frame)/frames));if(c.a<.1)discard;gl_FragColor=c;}' });
      return m;
    });
    for (const l of entityFireLayers(width,height,yOffset)) {
      const geometry = new THREE.PlaneGeometry(l.half*2*l.scale,(l.top-l.bottom)*l.scale);
      const uv=geometry.attributes.uv;
      if(l.flip)for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));
      const mesh=new THREE.Mesh(geometry,this.materials[l.sprite]);
      mesh.position.set(0,(l.bottom+l.top)*l.scale/2,l.z*l.scale);
      mesh.renderOrder=3; this.root.add(mesh);
    }
    this.yOffset=yOffset;
  }
  update(position, visible, viewYaw = 180, ticks = performance.now()/50) {
    this.root.visible=visible;
    if(!visible)return;
    this.root.position.set(position.x,position.y+this.yOffset,position.z);
    this.root.rotation.y=-viewYaw*Math.PI/180;
    for(const m of this.materials) {
      const img=m.uniforms.map.value.image, frames=img?img.height/img.width:32;
      m.uniforms.frames.value=frames; m.uniforms.frame.value=Math.floor(ticks)%frames;
    }
  }
  // The fire textures come from pixelTexture's shared cache, so only the layer geometry and materials go.
  dispose() {
    this.root.removeFromParent();
    this.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of this.materials) m.dispose();
  }
}
