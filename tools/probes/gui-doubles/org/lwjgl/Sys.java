package org.lwjgl;
// Test double for GuiMenusProbe: the system clock only (the real class loads the native lwjgl library).
public class Sys {
  // `now` is set by GuiMenusProbe per scenario (0 unless a scenario drives the Multiplayer LAN-scan dots).
  public static long now = 0L;
  public static long getTime() { return now; }
  public static void initialize() {}
  public static long getTimerResolution() { return 1000L; }
}
