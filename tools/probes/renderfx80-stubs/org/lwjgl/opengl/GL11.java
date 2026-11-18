package org.lwjgl.opengl;

import java.nio.*;
import java.util.*;

// Headless stand-in for LWJGL's GL11 used only by RenderFx80Probe (batch 80). It keeps float modelview and texture matrix stacks
// (column-major, each call right-multiplies as fixed-function GL does), logs texgen, capability, blend and display-list calls, and hands every
// glDrawArrays to a hook so the probe can read the real Tessellator's raw buffer. Nothing is rasterised.
public class GL11 {
  public static final int MODELVIEW = 5888, TEXTURE = 5890;
  public static final List<String> LOG = new ArrayList<>();
  static final Deque<float[]> mvStack = new ArrayDeque<>(), texStack = new ArrayDeque<>();
  public static float[] mv = identity(), tex = identity();
  public static int mode = MODELVIEW, list = 0, nextList = 1;
  public static Runnable onDraw = null;
  public static float[] identity() { float[] r = new float[16]; r[0] = r[5] = r[10] = r[15] = 1f; return r; }
  public static void reset() { mvStack.clear(); texStack.clear(); mv = identity(); tex = identity(); mode = MODELVIEW; LOG.clear(); list = 0; }
  public static String mat(float[] m) { StringBuilder s = new StringBuilder("["); for (int i = 0; i < 16; i++) s.append(i > 0 ? "," : "").append(m[i]); return s.append("]").toString(); }
  static void mul(float[] b) {
    float[] m = mode == TEXTURE ? tex : mv, r = new float[16];
    for (int c = 0; c < 4; c++) for (int row = 0; row < 4; row++) {
      float s = 0f;
      for (int k = 0; k < 4; k++) s += m[k * 4 + row] * b[c * 4 + k];
      r[c * 4 + row] = s;
    }
    if (mode == TEXTURE) tex = r; else mv = r;
  }
  public static void glMatrixMode(int m) { mode = m; LOG.add("[\"matrixMode\"," + m + "]"); }
  public static void glPushMatrix() { if (mode == TEXTURE) texStack.push(tex.clone()); else mvStack.push(mv.clone()); }
  public static void glPopMatrix() { if (mode == TEXTURE) tex = texStack.pop(); else mv = mvStack.pop(); }
  public static void glLoadIdentity() { if (mode == TEXTURE) tex = identity(); else mv = identity(); }
  public static void glTranslatef(float x, float y, float z) { float[] t = identity(); t[12] = x; t[13] = y; t[14] = z; mul(t); }
  public static void glScalef(float x, float y, float z) { float[] t = identity(); t[0] = x; t[5] = y; t[10] = z; mul(t); }
  public static void glRotatef(float a, float x, float y, float z) {
    float len = (float) Math.sqrt(x * x + y * y + z * z);
    if (len == 0f) return;
    x /= len; y /= len; z /= len;
    float c = (float) Math.cos(a * Math.PI / 180.0), s = (float) Math.sin(a * Math.PI / 180.0), k = 1f - c;
    float[] t = identity();
    t[0] = x * x * k + c; t[1] = y * x * k + z * s; t[2] = x * z * k - y * s;
    t[4] = x * y * k - z * s; t[5] = y * y * k + c; t[6] = y * z * k + x * s;
    t[8] = x * z * k + y * s; t[9] = y * z * k - x * s; t[10] = z * z * k + c;
    mul(t);
  }
  public static void glTexGeni(int coord, int pname, int param) { LOG.add("[\"texGeni\"," + coord + "," + pname + "," + param + "]"); }
  public static void glTexGen(int coord, int pname, FloatBuffer b) {
    LOG.add("[\"texGen\"," + coord + "," + pname + ",[" + b.get(0) + "," + b.get(1) + "," + b.get(2) + "," + b.get(3) + "]," + mat(mv) + "]");
  }
  public static void glEnable(int cap) { LOG.add("[\"enable\"," + cap + "]"); }
  public static void glDisable(int cap) { LOG.add("[\"disable\"," + cap + "]"); }
  public static void glBlendFunc(int a, int b) { LOG.add("[\"blend\"," + a + "," + b + "]"); }
  public static int glGenLists(int n) { int r = nextList; nextList += n; return r; }
  public static void glNewList(int id, int m) { list = id; }
  public static void glEndList() { list = 0; }
  public static void glCallList(int id) { LOG.add("[\"callList\"," + id + "," + mat(mv) + "]"); }
  public static void glDeleteLists(int a, int b) {}
  public static void glColor4f(float r, float g, float b, float a) {}
  public static void glDrawArrays(int m, int first, int count) { if (onDraw != null) onDraw.run(); }
  public static void glEnableClientState(int c) {}
  public static void glDisableClientState(int c) {}
  public static void glVertexPointer(int size, int stride, FloatBuffer b) {}
  public static void glTexCoordPointer(int size, int stride, FloatBuffer b) {}
  public static void glTexCoordPointer(int size, int stride, ShortBuffer b) {}
  public static void glColorPointer(int size, boolean u, int stride, ByteBuffer b) {}
  public static void glNormalPointer(int stride, ByteBuffer b) {}
}
