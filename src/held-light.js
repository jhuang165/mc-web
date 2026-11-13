// Batch 58 (rendering): the cell the first-person item takes its brightness from. ItemRenderer.renderItemInFirstPerson (bly.a(float), bytecode-read) calls
// World.getLightBrightnessForSkyBlocks(floor(p.posX), floor(p.posY), floor(p.posZ), 0) on mc.thePlayer (bao.h): the entity fields of the current tick, not the interpolated render
// camera and not the view bob. Entity.posY of the client player is the eye: minY + yOffset (1.62) - ySize, so a sneaking player is 0.08 lower after the tick's ySize.
export function heldLightCell(position, eye, drop) {
  return [Math.floor(position.x), Math.floor(position.y + eye - drop), Math.floor(position.z)];
}
