// ColorizerGrass/ColorizerFoliage (bytecode-read, not probed): the pack's colormap png is read through ImageIO.getRGB into a
// linear int[] and indexed j<<8|i (j = row, i = column of a 256 wide map). An image that is not 256 wide is therefore
// reinterpreted linearly, a bigger one is read as its first 65536 pixels, and a shorter one crashes the native game
// (ArrayIndexOutOfBounds); here such a short image falls back to the vanilla map instead.
export const COLORMAP_SIDE=256;
export function colormapPixels(width,height,data){
 const need=COLORMAP_SIDE*COLORMAP_SIDE;
 if(width*height<need)return null;
 return data.length===need*4?data:data.slice(0,need*4);
}
// Re-lay the linear pixels out as a 256x256 canvas so the unchanged tint() lookup reads the same texel natively would.
export function colormapSource(img,fallback,warn=()=>{}){
 if(img.width===COLORMAP_SIDE&&img.height===COLORMAP_SIDE)return img;
 const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);
 const px=colormapPixels(img.width,img.height,x.getImageData(0,0,img.width,img.height).data);
 if(!px){warn(`colormap ${img.width}x${img.height} has fewer than 65536 pixels (native would crash); using the vanilla map`);return fallback||img;}
 const out=document.createElement('canvas');out.width=out.height=COLORMAP_SIDE;out.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px),COLORMAP_SIDE,COLORMAP_SIDE),0,0);return out;
}
