// GuiMainMenu's rotating panorama (Minecraft Java 1.7.10): drawPanorama renders the six
// gui/title/background faces 64 times with sub-pixel jitter into a 256 x 256 viewport,
// rotateAndBlurSkybox copies that to a linear-filtered texture and redraws it transposed with a
// three-tap blur (seven times; the texture the screen samples holds the sixth result), and
// renderSkybox stretches the texture over the screen with transposed coordinates. Plain WebGL 1.
const SIZE = 256;
const VS = `attribute vec3 p;attribute vec2 uv;uniform mat4 m;varying vec2 v;void main(){v=uv;gl_Position=m*vec4(p,1.);}`;
const FS = `precision mediump float;uniform sampler2D tex;uniform float a;varying vec2 v;void main(){gl_FragColor=vec4(texture2D(tex,v).rgb,a);}`;

// Column-major 4 x 4 helpers mirroring the fixed-function matrix stack.
const mul = (a, b) => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
};
const rotate = (deg, x, y, z) => {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), k = 1 - c;
  return new Float32Array([x * x * k + c, y * x * k + z * s, x * z * k - y * s, 0, x * y * k - z * s, y * y * k + c, y * z * k + x * s, 0, x * z * k + y * s, y * z * k - x * s, z * z * k + c, 0, 0, 0, 0, 1]);
};
const translate = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
// Project.gluPerspective(fovy, aspect, near, far).
const perspective = (fovy, aspect, n, fa) => {
  const ft = 1 / Math.tan((fovy * Math.PI) / 360);
  return new Float32Array([ft / aspect, 0, 0, 0, 0, ft, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0]);
};
// glOrtho(0, w, h, 0, ...) of the GUI, z ignored.
const ortho = (w, h) => new Float32Array([2 / w, 0, 0, 0, 0, -2 / h, 0, 0, 0, 0, 0, 0, -1, 1, 0, 1]);
const FACES = [null, [90, 0, 1, 0], [180, 0, 1, 0], [-90, 0, 1, 0], [90, 1, 0, 0], [-90, 1, 0, 0]];

export class Panorama {
  constructor(canvas, base = "/media/1.7.10/gui/title/background/panorama_") {
    this.canvas = canvas;
    const gl = (this.gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, premultipliedAlpha: false }));
    if (!gl) return;
    const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = (this.prog = gl.createProgram());
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    this.loc = { p: gl.getAttribLocation(prog, "p"), uv: gl.getAttribLocation(prog, "uv"), m: gl.getUniformLocation(prog, "m"), a: gl.getUniformLocation(prog, "a") };
    this.buffer = gl.createBuffer();
    // The rendered panorama and the copy rotateAndBlurSkybox samples (GL_LINEAR, GL_REPEAT).
    this.targets = [0, 1].map(() => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIZE, SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fb };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.faces = [];
    this.ready = Promise.all([0, 1, 2, 3, 4, 5].map((i) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        // SimpleTexture: nearest, repeat (the faces are 256 x 256).
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        this.faces[i] = tex;
        resolve();
      };
      img.onerror = resolve;
      img.src = base + i + ".png";
    }))).then(() => (this.loaded = this.faces.filter(Boolean).length === 6));
  }
  quad(verts, matrix, alpha) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(this.loc.p);
    gl.enableVertexAttribArray(this.loc.uv);
    gl.vertexAttribPointer(this.loc.p, 3, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(this.loc.uv, 2, gl.FLOAT, false, 20, 12);
    gl.uniformMatrix4fv(this.loc.m, false, matrix);
    gl.uniform1f(this.loc.a, alpha);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
  }
  // `timer` is panoramaTimer + partial ticks; `w`, `h` the scaled GUI size.
  render(timer, w, h) {
    const gl = this.gl;
    if (!gl || !this.loaded) return false;
    const width = this.canvas.width, height = this.canvas.height;
    gl.useProgram(this.prog);
    gl.enable(gl.BLEND);
    // OpenGlHelper.glBlendFunc(770, 771, 1, 0) with the alpha channel masked.
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ZERO);
    gl.disable(gl.CULL_FACE);
    // drawPanorama.
    const [first, second] = this.targets;
    gl.bindFramebuffer(gl.FRAMEBUFFER, first.fb);
    gl.viewport(0, 0, SIZE, SIZE);
    gl.colorMask(true, true, true, true);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.colorMask(true, true, true, false);
    const base = mul(mul(perspective(120, 1, 0.05, 10), rotate(180, 1, 0, 0)), rotate(90, 0, 0, 1));
    const face = new Float32Array([-1, -1, 1, 0, 0, 1, -1, 1, 1, 0, 1, 1, 1, 1, 1, -1, 1, 1, 0, 1]);
    const pitch = Math.sin(timer / 400) * 25 + 20, yaw = -timer * 0.1;
    for (let k = 0; k < 64; k++) {
      const jitter = translate(((k % 8) / 8 - 0.5) / 64, ((Math.trunc(k / 8)) / 8 - 0.5) / 64, 0);
      const view = mul(mul(mul(base, jitter), rotate(pitch, 1, 0, 0)), rotate(yaw, 0, 1, 0));
      for (let l = 0; l < 6; l++) {
        gl.bindTexture(gl.TEXTURE_2D, this.faces[l]);
        this.quad(face, FACES[l] ? mul(view, rotate(...FACES[l])) : view, Math.trunc(255 / (k + 1)) / 255);
      }
    }
    // rotateAndBlurSkybox x 6 (the seventh pass draws only into the hidden 256 x 256 corner).
    const gui = ortho(w, h);
    let src = first, dst = second;
    for (let pass = 0; pass < 6; pass++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      for (let i = 0; i < 3; i++) {
        const o = (i - 1) / SIZE;
        this.quad(new Float32Array([w, h, 0, 0 + o, 1, w, 0, 0, 1 + o, 1, 0, 0, 0, 1 + o, 0, 0, h, 0, 0 + o, 0]), gui, 1 / (i + 1));
      }
      [src, dst] = [dst, src];
    }
    // renderSkybox: the full-screen quad.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.colorMask(true, true, true, true);
    const f1 = w > h ? 120 / w : 120 / h, f2 = (h * f1) / 256, f3 = (w * f1) / 256;
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    this.quad(new Float32Array([0, h, 0, 0.5 - f2, 0.5 + f3, w, h, 0, 0.5 - f2, 0.5 - f3, w, 0, 0, 0.5 + f2, 0.5 - f3, 0, 0, 0, 0.5 + f2, 0.5 + f3]), gui, 1);
    return true;
  }
}
