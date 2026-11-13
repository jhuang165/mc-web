package org.lwjgl.opengl;

import java.nio.*;
import java.util.*;

// Batch 53 displayquads stub: replaces LWJGL's GL11 on the probe classpath so the unchanged 1.7.10 RenderBlocks.renderBlockAsItem (blm.a(aji, int, float)) and the static Tessellator
// (bmh.a) run headless. Every call RenderBlocks and the Tessellator make is appended to `log` as text; glDrawArrays runs `drawHook` (the probe reads the Tessellator's raw buffer there).
public class GL11 {
  public static final List<String> log = new ArrayList<>();
  public static Runnable drawHook;
  public static int drawMode, drawFirst, drawCount;
  static String f(float v) { return Float.toString(v); }
  public static void glTranslatef(float x, float y, float z) { log.add("translate " + f(x) + " " + f(y) + " " + f(z)); }
  public static void glRotatef(float a, float x, float y, float z) { log.add("rotate " + f(a) + " " + f(x) + " " + f(y) + " " + f(z)); }
  public static void glScalef(float x, float y, float z) { log.add("scale " + f(x) + " " + f(y) + " " + f(z)); }
  public static void glColor4f(float r, float g, float b, float a) { log.add("color " + f(r) + " " + f(g) + " " + f(b) + " " + f(a)); }
  public static void glColor3f(float r, float g, float b) { log.add("color3 " + f(r) + " " + f(g) + " " + f(b)); }
  public static void glEnable(int cap) { log.add("enable " + cap); }
  public static void glDisable(int cap) { log.add("disable " + cap); }
  public static void glPushMatrix() { log.add("push"); }
  public static void glPopMatrix() { log.add("pop"); }
  public static void glBindTexture(int t, int id) { log.add("bind " + id); }
  public static void glEnableClientState(int a) { }
  public static void glDisableClientState(int a) { }
  public static void glTexCoordPointer(int s, int t, FloatBuffer b) { }
  public static void glTexCoordPointer(int s, int t, ShortBuffer b) { }
  public static void glColorPointer(int s, boolean u, int t, ByteBuffer b) { }
  public static void glNormalPointer(int t, ByteBuffer b) { }
  public static void glVertexPointer(int s, int t, FloatBuffer b) { }
  public static void glDrawArrays(int mode, int first, int count) {
    drawMode = mode; drawFirst = first; drawCount = count;
    log.add("draw " + mode + " " + count);
    if (drawHook != null) drawHook.run();
  }
  // Batch 57 displaypixel: the lighting calls of RenderHelper.enableStandardItemLighting (bam.b()).
  public static void glColorMaterial(int face, int mode) { log.add("colormaterial " + face + " " + mode); }
  public static void glShadeModel(int mode) { log.add("shademodel " + mode); }
  public static void glLight(int light, int pname, FloatBuffer b) { log.add("light " + light + " " + pname + " " + f(b.get(0)) + " " + f(b.get(1)) + " " + f(b.get(2)) + " " + f(b.get(3))); }
  public static void glLightModel(int pname, FloatBuffer b) { log.add("lightmodel " + pname + " " + f(b.get(0)) + " " + f(b.get(1)) + " " + f(b.get(2)) + " " + f(b.get(3))); }
}
