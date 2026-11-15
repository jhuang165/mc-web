package org.lwjgl.opengl;
// Test double for GuiMenusProbe: a capability set that reports OpenGL 2.0 (the real class needs a native context).
public class GLContext {
  private static ContextCapabilities caps;
  public static ContextCapabilities getCapabilities() {
    if (caps == null) {
      try {
        java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true);
        sun.misc.Unsafe u = (sun.misc.Unsafe) uf.get(null);
        caps = (ContextCapabilities) u.allocateInstance(ContextCapabilities.class);
        java.lang.reflect.Field f = ContextCapabilities.class.getDeclaredField("OpenGL20");
        u.putBoolean(caps, u.objectFieldOffset(f), true);
      } catch (Exception e) { throw new RuntimeException(e); }
    }
    return caps;
  }
}
