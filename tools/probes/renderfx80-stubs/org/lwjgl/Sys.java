package org.lwjgl;

// Headless stand-in for LWJGL's Sys used only by RenderFx80Probe: Minecraft.getSystemTime (bao.K) is getTime() * 1000 / getTimerResolution(),
// so the probe sets the clock in milliseconds.
public class Sys {
  public static long time = 0L;
  public static long getTime() { return time; }
  public static long getTimerResolution() { return 1000L; }
}
