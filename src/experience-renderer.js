import * as THREE from 'three';
import {orbIcon,orbColor} from './experience.js';
export class ExperienceRenderer {
 constructor(scene){this.scene=scene;this.sprites=[];const t=new THREE.TextureLoader().load('/media/1.7.10/entity/experience_orb.png');t.magFilter=t.minFilter=THREE.NearestFilter;t.repeat.set(.25,.25);this.texture=t;}
 // RenderXPOrb: position is lastTickPos lerped by `partial` at posY (0.25 above the box
 // bottom `y`); the quad is 0.3 wide and spans y -0.25..0.75 around it (centre 0.075 up);
 // frame from getTextureByXP, tint from orbColor(xpColor, partial).
 update(orbs,partial=1){while(this.sprites.length>orbs.length){const s=this.sprites.pop();this.scene.remove(s);s.material.map.dispose();s.material.dispose();}orbs.forEach((o,i)=>{let s=this.sprites[i];if(!s){const t=this.texture.clone();t.needsUpdate=true;s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));s.scale.setScalar(.3);this.scene.add(s);this.sprites.push(s);}const icon=orbIcon(o.value);s.material.map.offset.set(icon%4*.25,.75-Math.floor(icon/4)*.25);s.position.set(o.px+(o.x-o.px)*partial,o.py+(o.y-o.py)*partial+.325,o.pz+(o.z-o.pz)*partial);const [r,g,b]=orbColor(o.color,partial);s.material.color.setRGB(r/255,g/255,b/255);});}
}
