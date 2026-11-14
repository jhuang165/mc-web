import { Matrix4 } from 'three';
const radians = degrees => degrees * Math.PI / 180;
// OpenGL post-multiplies each operation. Preserve that order instead of
// combining Y/Z/X rotations into a Three.js XYZ Euler rotation.
// `bowDraw` is ItemRenderer's bow term while the bow is drawn: getMaxItemUseDuration -
// (itemInUseCount - partial + 1), i.e. the ticks of use - 1 + partial (null otherwise). `blocking` is a sword in use (EnumAction.block).
export function firstPersonMatrix(pose, {empty = !pose.item, sprite = false, eatingTicks = null, bowDraw = null, blocking = false, turnAround = false} = {}) {
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
  }else if(!blocking&&bowDraw===null)translate(pose.swing.x,pose.swing.y,pose.swing.z); // executed (first-person-reference.json): a stack in use (getItemInUseCount > 0) skips the swing translate
  translate(.7*.8,-.65*.8-(1-pose.equip)*.6,-.9*.8);
  rotate('y',radians(45));rotate('y',pose.swing.ry);rotate('z',pose.swing.rz);rotate('x',pose.swing.rx);scale(.4);
  if(turnAround)rotate('y',Math.PI); // Item.shouldRotateAroundWhenRendering (the fishing rod): glRotatef(180, 0, 1, 0) after the 0.4 scale (executed, first-person-reference.json)
  if(blocking){
    // ItemRenderer.renderItemInFirstPerson (bly.a, bytecode-read), EnumAction.block with getItemInUseCount() > 0: after the 0.4 scale the sword moves
    // across the view (translate -0.5, 0.2, 0), then turns 30 about y, -80 about x and 60 about y. The swing translate is skipped, as for food, drink and the bow (executed).
    translate(-.5,.2,0);rotate('y',radians(30));rotate('x',radians(-80));rotate('y',radians(60));
  }
  if(bowDraw !== null){
    // ItemRenderer.renderItemInFirstPerson (bly.a), EnumAction.bow: the pull tilts the bow,
    // wobbles it once it is past 0.1, draws it back 0.1 and stretches it by 20% along z.
    const f32 = Math.fround;
    let pull = f32(bowDraw/20);pull = f32(f32(f32(pull*pull)+f32(pull*2))/3);if(pull>1)pull = 1;
    rotate('z',radians(-18));rotate('y',radians(-12));rotate('x',radians(-8));translate(-.9,.2,0);
    if(pull>.1)translate(0,Math.sin(f32(f32(bowDraw-.1)*1.3))*.01*(pull-.1),0);
    translate(0,0,pull*.1);
    rotate('z',radians(-335));rotate('y',radians(-50));translate(0,.5,0);
    matrix.multiply(scratch.makeScale(1,1,1+pull*.2));
    translate(0,-.5,0);rotate('y',radians(50));rotate('z',radians(335));
  }
  if(sprite){translate(0,-.3,0);scale(1.5);rotate('y',radians(50));rotate('z',radians(335));translate(-.9375,-.0625,0);}
  return matrix;
}
