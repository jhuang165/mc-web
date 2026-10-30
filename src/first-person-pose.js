import { Matrix4 } from 'three';
const radians = degrees => degrees * Math.PI / 180;
// OpenGL post-multiplies each operation. Preserve that order instead of
// combining Y/Z/X rotations into a Three.js XYZ Euler rotation.
export function firstPersonMatrix(pose, {empty = !pose.item, sprite = false, eatingTicks = null} = {}) {
  const matrix = new Matrix4(), scratch = new Matrix4();
  const translate = (x,y,z) => matrix.multiply(scratch.makeTranslation(x,y,z));
  const rotate = (axis,angle) => matrix.multiply(axis === 'x' ? scratch.makeRotationX(angle) : axis === 'y' ? scratch.makeRotationY(angle) : scratch.makeRotationZ(angle));
  const scale = n => matrix.multiply(scratch.makeScale(n,n,n));
  const b = pose.bob;
  translate(b.x,b.y,0);rotate('z',b.rz);rotate('x',b.rx);
  rotate('x',pose.sway?.x || 0);rotate('y',pose.sway?.y || 0);
  const s = pose.progress ?? 0, root = Math.sin(Math.sqrt(s)*Math.PI), squared = Math.sin(s*s*Math.PI);
  if(empty){
    translate(-root*.3,Math.sin(Math.sqrt(s)*Math.PI*2)*.4,-Math.sin(s*Math.PI)*.4);
    translate(.8*.8,-.75*.8-(1-pose.equip)*.6,-.9*.8);
    rotate('y',radians(45));rotate('y',radians(root*70));rotate('z',radians(-squared*20));
    translate(-1,3.6,3.5);rotate('z',radians(120));rotate('x',radians(200));rotate('y',radians(-135));translate(5.6,0,0);
    return matrix;
  }
  if(eatingTicks !== null){
    const remaining = Math.max(0,Math.min(32,eatingTicks)), progress = 1-remaining/32, amount = 1-Math.pow(remaining/32,27);
    translate(0,Math.abs(Math.cos(remaining/4*Math.PI)*.1)*(progress>.2?1:0),0);
    translate(amount*.6,-amount*.5,0);
    rotate('y',radians(amount*90));rotate('x',radians(amount*10));rotate('z',radians(amount*30));
  }else translate(pose.swing.x,pose.swing.y,pose.swing.z);
  translate(.7*.8,-.65*.8-(1-pose.equip)*.6,-.9*.8);
  rotate('y',radians(45));rotate('y',pose.swing.ry);rotate('z',pose.swing.rz);rotate('x',pose.swing.rx);scale(.4);
  if(sprite){translate(0,-.3,0);scale(1.5);rotate('y',radians(50));rotate('z',radians(335));translate(-.9375,-.0625,0);}
  return matrix;
}
