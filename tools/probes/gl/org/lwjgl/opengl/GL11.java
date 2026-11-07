package org.lwjgl.opengl;

import java.nio.*;
import java.util.*;

// Headless stand-in for LWJGL's GL11 used only by DragonModelProbe: it keeps a float modelview stack (column-major, like GL) and logs the
// display-list calls, so the unchanged ModelDragon/ModelRenderer classes can run without a GL context. Everything else is a no-op.
public class GL11 {
  public static final List<Object[]> LOG = new ArrayList<>();
  static final Deque<float[]> stack = new ArrayDeque<>();
  static float[] m = identity();
  static int nextList = 1;
  public static float[] identity() { float[] r = new float[16]; r[0] = r[5] = r[10] = r[15] = 1f; return r; }
  public static void reset() { stack.clear(); m = identity(); LOG.clear(); }
  static void mul(float[] b) {
    float[] r = new float[16];
    for (int c = 0; c < 4; c++) for (int row = 0; row < 4; row++) {
      float s = 0f;
      for (int k = 0; k < 4; k++) s += m[k * 4 + row] * b[c * 4 + k];
      r[c * 4 + row] = s;
    }
    m = r;
  }
  public static void glPushMatrix() { stack.push(m.clone()); }
  public static void glPopMatrix() { m = stack.pop(); }
  public static void glTranslatef(float x, float y, float z) { float[] t = identity(); t[12] = x; t[13] = y; t[14] = z; mul(t); }
  public static void glScalef(float x, float y, float z) { float[] t = identity(); t[0] = x; t[5] = y; t[10] = z; mul(t); LOG.add(new Object[] {"scale", new float[] {x, y, z}}); }
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
  public static int glGenLists(int n) { int r = nextList; nextList += n; return r; }
  public static void glNewList(int id, int mode) {}
  public static void glEndList() {}
  public static void glCallList(int id) { LOG.add(new Object[] {"call", id, m.clone()}); }
  public static void glCullFace(int mode) { LOG.add(new Object[] {"cull", mode}); }
  public static void glEnable(int cap) {}
  public static void glDisable(int cap) {}
  public static void glColor4f(float r, float g, float b, float a) {}
  public static void glNormal3f(float x, float y, float z) {}
  public static void glDepthFunc(int f) {}
  public static void glAlphaFunc(int f, float r) {}
  public static void glBlendFunc(int a, int b) {}
  public static void glShadeModel(int m) {}
  public static void glDrawArrays(int mode, int first, int count) {}
  public static void glEnableClientState(int c) {}
  public static void glDisableClientState(int c) {}
  public static void glVertexPointer(int size, int stride, FloatBuffer b) {}
  public static void glTexCoordPointer(int size, int stride, FloatBuffer b) {}
  public static void glColorPointer(int size, boolean u, int stride, ByteBuffer b) {}
  public static void glNormalPointer(int stride, ByteBuffer b) {}
  public static void glDeleteLists(int a, int b) {}
}
