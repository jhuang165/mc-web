package org.lwjgl;
// Test double for GuiMenusProbe: the system clock only (the real class loads the native lwjgl library).
public class Sys {
  public static long getTime() { return 0L; }
  public static void initialize() {}
  public static long getTimerResolution() { return 1000L; }
}
