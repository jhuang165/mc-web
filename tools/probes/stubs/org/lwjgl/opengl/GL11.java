// No-op stand-in for LWJGL GL11 so TextureUtil's static initialiser (the missing-texture upload) can run without a GL context.
package org.lwjgl.opengl;
import java.nio.*;
public class GL11 {
  public static int glGenTextures() { return 1; }
  public static void glBindTexture(int a, int b) {}
  public static void glDeleteTextures(int a) {}
  public static void glTexParameteri(int a, int b, int c) {}
  public static void glTexParameterf(int a, int b, float c) {}
  public static void glPixelStorei(int a, int b) {}
  public static void glTexImage2D(int a, int b, int c, int d, int e, int f, int g, int h, IntBuffer i) {}
  public static void glTexImage2D(int a, int b, int c, int d, int e, int f, int g, int h, ByteBuffer i) {}
  public static void glTexSubImage2D(int a, int b, int c, int d, int e, int f, int g, int h, IntBuffer i) {}
}
