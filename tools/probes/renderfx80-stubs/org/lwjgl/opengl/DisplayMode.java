package org.lwjgl.opengl;

// Minecraft's (bao) static initializer builds two DisplayMode(int, int) values; nothing reads them in this probe.
public class DisplayMode { public DisplayMode(int w, int h) {} }
