import java.io.*;
import java.nio.file.*;
import java.util.zip.*;

// Original CompressedStreamTools for gzip; the JDK zlib streams used by regions
// wrap the original raw NBT methods. No RegionFile/Anvil execution is claimed.
public class NbtCompressionProbe {
  static String hex(byte[] bytes) {
    StringBuilder out = new StringBuilder();
    for (byte v : bytes) out.append(String.format("%02x", v & 255));
    return out.toString();
  }
  static dh rawRead(byte[] bytes) throws Exception {
    return du.a((DataInput)new DataInputStream(new ByteArrayInputStream(bytes)), new ds(16 * 1024 * 1024));
  }
  static byte[] rawWrite(dh tag) throws Exception {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    du.a(tag, (DataOutput)new DataOutputStream(bytes));
    return bytes.toByteArray();
  }
  static dh read(byte[] bytes, String format) throws Exception {
    if (format.equals("gzip")) return du.a(bytes, new ds(16 * 1024 * 1024));
    try (DataInputStream in = new DataInputStream(new InflaterInputStream(new ByteArrayInputStream(bytes)))) {
      return du.a((DataInput)in, new ds(16 * 1024 * 1024));
    }
  }
  static byte[] write(dh tag, String format) throws Exception {
    if (format.equals("gzip")) return du.a(tag);
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    try (DataOutputStream out = new DataOutputStream(new DeflaterOutputStream(bytes))) {
      du.a(tag, (DataOutput)out);
    }
    return bytes.toByteArray();
  }
  public static void main(String[] args) throws Exception {
    Path dir = Paths.get(args[1]);
    int count = Integer.parseInt(args[2]);
    for (int i = 0; i < count; i++) {
      dh expected = rawRead(Files.readAllBytes(dir.resolve(i + ".nbt")));
      byte[] normalized = rawWrite(expected);
      if (args[0].equals("capture")) {
        for (String format : new String[]{"gzip", "zlib"}) {
          byte[] compressed = write(expected, format);
          if (!java.util.Arrays.equals(rawWrite(read(compressed, format)), normalized)) throw new AssertionError(i + format);
          System.out.println("{\"index\":" + i + ",\"format\":\"" + format + "\",\"hex\":\"" + hex(compressed) + "\",\"rawHex\":\"" + hex(normalized) + "\"}");
        }
      } else if (args[0].equals("verify")) {
        for (String format : new String[]{"gzip", "zlib"}) {
          dh actual = read(Files.readAllBytes(dir.resolve(i + "." + format)), format);
          // Compare a complete native re-serialization, including NaN canonicalization.
          if (!java.util.Arrays.equals(rawWrite(actual), normalized)) throw new AssertionError(i + format);
        }
      } else throw new IllegalArgumentException("Unknown mode");
    }
    if (args[0].equals("verify")) System.out.println((count * 2) + " JS compressed documents read by original NBT classes");
  }
}
