package com.mojang.authlib;

// Batch 45 stand-in for authlib's GameProfile (the library is not in libs-1.7.10): only the type the unchanged player classes name in their signatures.
public class GameProfile {
  private final String name;
  public GameProfile(java.util.UUID id, String name) { this.name = name; }
  public String getName() { return name; }
}
