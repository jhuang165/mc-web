// GPU sub-rect upload of changed atlas tiles (TextureUtil.uploadTextureMipmap per-sprite semantics: each animated
// sprite writes its own rectangle of every mip level, here with texSubImage2D through renderer.copyTextureToTexture
// instead of re-uploading the whole atlas). `three` is injected so the logic is testable without WebGL.
export function createAtlasUploader(renderer, THREE) {
  const pending = new Map();
  const stats = { subRects: 0, bytes: 0, flushes: 0 };
  return {
    stats,
    // True when the texture already lives on the GPU at its current version, so a sub-rect write is meaningful
    // (otherwise a full upload is pending anyway).
    ready(tex) {
      const p = renderer.properties.get(tex);
      return p.__webglTexture !== undefined && p.__version === tex.version;
    },
    // Rects are queued and written together: one bind and one pixel-store setup per texture, then a bare texSubImage2D per
    // rect (renderer.copyTextureToTexture re-reads five UNPACK_* parameters per call, which stalls the driver).
    // `data` is RGBA, w*h*4 bytes, top row first (canvas order); (x, y) is the canvas-space origin in that level.
    queue(tex, level, x, y, w, h, data) {
      let q = pending.get(tex);
      if (!q) pending.set(tex, (q = []));
      q.push({ level, x, y, w, h, data: new Uint8Array(data.buffer, data.byteOffset, w * h * 4) });
    },
    flush() {
      const gl = renderer.getContext();
      for (const [tex, rects] of pending) {
        // The destination has flipY set: GL row 0 is the canvas bottom, and the unpacker flips each rect's rows.
        renderer.state.bindTexture(gl.TEXTURE_2D, renderer.properties.get(tex).__webglTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, tex.flipY);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        for (const r of rects) {
          const levelHeight = r.level === 0 ? tex.image.height : Math.floor(tex.image.height / 2 ** r.level);
          gl.texSubImage2D(gl.TEXTURE_2D, r.level, r.x, levelHeight - r.y - r.h, r.w, r.h, gl.RGBA, gl.UNSIGNED_BYTE, r.data);
          stats.subRects++; stats.bytes += r.data.length;
        }
        renderer.state.unbindTexture();
      }
      pending.clear();
      stats.flushes++;
    },
  };
}
