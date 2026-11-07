import test from 'node:test';
import assert from 'node:assert/strict';
import {colormapPixels,COLORMAP_SIDE} from './colormap-source.js';

test('a 256x256 map is used as is, a bigger one is read linearly from its first 65536 pixels',()=>{
 const full=new Uint8ClampedArray(256*256*4).fill(7);
 assert.equal(colormapPixels(256,256,full),full);
 const big=new Uint8ClampedArray(512*256*4);big[0]=1;big[256*256*4]=99;
 const out=colormapPixels(512,256,big);
 assert.equal(out.length,256*256*4);assert.equal(out[0],1);assert.ok(!out.includes(99));
});
test('a map with fewer than 65536 pixels is rejected (the native game would crash)',()=>{
 assert.equal(colormapPixels(128,128,new Uint8ClampedArray(128*128*4)),null);
 assert.equal(COLORMAP_SIDE,256);
});
test('a 128x512 map keeps the linear index j<<8|i',()=>{
 const w=128,h=512,d=new Uint8ClampedArray(w*h*4);
 // linear pixel 300 (row 1, col 44 of a 256-wide map) sits at row 2, col 44 of the 128-wide image
 d[(2*w+44)*4]=200;
 assert.equal(colormapPixels(w,h,d)[((1<<8)|44)*4],200);
});
