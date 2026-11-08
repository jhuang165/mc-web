package io.netty.util;

// ej (NetworkManager) of the 1.7.10 client calls the netty 4.0 constructor AttributeKey(String) in its static initialiser; netty 4.1
// made it private. The probe only needs the class to load, so this stand-in (earlier on the class path) restores the constructor.
public class AttributeKey<T> {
  private final String name;
  public AttributeKey(String name) { this.name = name; }
  public static <T> AttributeKey<T> valueOf(String name) { return new AttributeKey<T>(name); }
  public String name() { return name; }
}
