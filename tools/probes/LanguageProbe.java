import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

// Original-bytecode harness for FontRenderer (bbu) widths and the Locale (brs) lang parser. The unchanged client classes run
// against minimal test doubles: bao (Minecraft: only getMinecraft/getResourceManager), bbj (GameSettings: the anaglyph flag the
// constructor reads), bqf (TextureManager: bindTexture) and a bqy resource manager that serves files from the extracted
// JAR (and, for Locale, fixtures or installed lang files). No original code or text is shipped.
// Usage: java LanguageProbe <extracted-jar-dir> [<lang-dir-with-xx_YY.lang>]
class bao {
  static final bao I = new bao();
  static bqy rm;
  public static bao B() { return I; }
  public bqy Q() { return rm; }
}
class bbj { public boolean e = false; }
class bqf { public bqf(bqy m) {} public void a(bqx l) {} }
class Res implements bqy {
  final Path root; final Map<String, String> fixtures = new HashMap<>(); Path langDir;
  Res(Path root) { this.root = root; }
  static String path(bqx l) { return l.a().equals("minecraft") ? l.b() : l.a(); }
  public Set a() { return new HashSet<>(Arrays.asList("minecraft")); }
  InputStream open(String path) throws IOException {
    if (path.startsWith("lang/")) {
      String code = path.substring(5, path.length() - 5);
      if (fixtures.containsKey(code)) return new ByteArrayInputStream(fixtures.get(code).getBytes("UTF-8"));
      Path p = langDir != null ? langDir.resolve(code + ".lang") : null;
      if (p != null && Files.exists(p)) return Files.newInputStream(p);
      if (code.equals("en_US")) return Files.newInputStream(root.resolve("assets/minecraft/lang/en_US.lang"));
      throw new FileNotFoundException(path);
    }
    return Files.newInputStream(root.resolve("assets/minecraft/" + path));
  }
  public bqw a(bqx l) { try { return res(path(l)); } catch (IOException e) { throw new RuntimeException(e); } }
  bqw res(String path) throws IOException {
    final InputStream in = open(path);
    return new bqw() { public InputStream b() { return in; } public boolean c() { return false; } public bru a(String s) { return null; } };
  }
  public List b(bqx l) {
    try { return new ArrayList<>(Arrays.asList(res(path(l)))); } catch (IOException e) { return new ArrayList<>(); }
  }
}
public class LanguageProbe {
  static String q(String s) {
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static String sha256(int[] v) throws Exception {
    MessageDigest md = MessageDigest.getInstance("SHA-256");
    byte[] b = new byte[v.length * 2];
    for (int i = 0; i < v.length; i++) { b[i * 2] = (byte) (v[i] >> 8); b[i * 2 + 1] = (byte) v[i]; }
    return String.format("%064x", new java.math.BigInteger(1, md.digest(b)));
  }
  @SuppressWarnings("unchecked")
  static Map<String, String> map(brs l) throws Exception {
    java.lang.reflect.Field f = brs.class.getDeclaredField("a"); f.setAccessible(true);
    return new TreeMap<>((Map<String, String>) f.get(l));
  }
  static void locale(String name, Res r, String... codes) throws Exception {
    brs l = new brs();
    l.a(r, new ArrayList<>(Arrays.asList(codes)));
    Map<String, String> m = map(l);
    StringBuilder e = new StringBuilder();
    for (Map.Entry<String, String> en : m.entrySet()) { if (e.length() > 0) e.append(','); e.append('[').append(q(en.getKey())).append(',').append(q(en.getValue())).append(']'); }
    System.out.println("{\"locale\":" + q(name) + ",\"codes\":" + Arrays.toString(codes).replace("[", "[\"").replace("]", "\"]").replace(", ", "\",\"") + ",\"unicode\":" + l.a() + ",\"entries\":[" + e + "]}");
  }
  public static void main(String[] args) throws Exception {
    Res res = new Res(Paths.get(args[0]));
    bao.rm = res;
    if (args.length > 1) res.langDir = Paths.get(args[1]);
    // ---- FontRenderer widths: every char, both flags ----
    String[] samples = {"", "Hello, world!", "WWW iii", "§lBold§r text", "§aGreen§r", "a§", "§", "éàüÀÉ", "ßñœŒ",
      "あいう", "中文字", "Абвг", "العربية", "שלום", "한글", "Done █░ ☃ ❤", "tab\there",
      "§L§lbold §Rreset", "§kobf", "Mixed Ångström Łódź", "─│┌", "100%", "😀"};
    for (boolean unicode : new boolean[] {false, true}) {
      bbu f = new bbu(new bbj(), new bqx("textures/font/ascii.png"), new bqf(null), unicode);
      f.a((bqy) res); // onResourceManagerReload: readFontTexture
      int[] w = new int[65536];
      for (int c = 0; c < 65536; c++) w[c] = f.a((char) c);
      StringBuilder s = new StringBuilder();
      for (int i = 0; i < samples.length; i++) { if (i > 0) s.append(','); s.append("[").append(q(samples[i])).append(',').append(f.a(samples[i])).append(']'); }
      StringBuilder first = new StringBuilder();
      for (int c = 0; c < 256; c++) { if (c > 0) first.append(','); first.append(w[c]); }
      System.out.println("{\"font\":true,\"unicode\":" + unicode + ",\"widthsSha256\":\"" + sha256(w) + "\",\"first256\":[" + first + "],\"samples\":[" + s + "],\"all\":[" + Arrays.toString(w).replaceAll("[\\[\\] ]", "") + "]}");
    }
    // ---- Locale: parser rules and the unicode threshold ----
    res.fixtures.put("fx_base", "# comment\n\nplain=Hello\nnovalue\nk=v=w\nnum=%d items\nfmt=%2$.1f of %1$d\nfmts=%s and %1$s\nempty=\n=emptykey\n #notcomment=1\ncrlf=line\r\nuni=あい\nperc=100%% done\n");
    locale("parse", res, "fx_base");
    res.fixtures.put("fx_over", "a=Hello\nb=World\n");
    res.fixtures.put("fx_ovr", "a=Override\nc=Extra\n");
    locale("fallback-order", res, "fx_over", "fx_ovr");
    StringBuilder x90 = new StringBuilder(); for (int i = 0; i < 90; i++) x90.append('x');
    String[][] ratios = {{"ratio-0pct", "100", "0"}, {"ratio-9pct", "91", "9"}, {"ratio-exact10pct", "90", "10"}, {"ratio-11pct", "89", "11"}, {"ratio-1pct", "99", "1"}};
    for (String[] rr : ratios) {
      StringBuilder v = new StringBuilder();
      for (int i = 0; i < Integer.parseInt(rr[1]); i++) v.append('x');
      for (int i = 0; i < Integer.parseInt(rr[2]); i++) v.append('あ');
      res.fixtures.put(rr[0], "k=" + v + "\n");
      locale(rr[0], res, rr[0]);
    }
    // The selected language merges over en_US: the ratio is taken over the merged table (en_US is ASCII).
    brs en = new brs();
    // ---- Real installed language files ----
    if (res.langDir != null) {
      File[] files = res.langDir.toFile().listFiles((d, n) -> n.endsWith(".lang"));
      Arrays.sort(files);
      for (File fl : files) {
        String code = fl.getName().replace(".lang", "");
        brs l = new brs();
        l.a(res, new ArrayList<>(Arrays.asList("en_US", code)));
        Map<String, String> m = map(l);
        System.out.println("{\"real\":" + q(code) + ",\"unicode\":" + l.a() + ",\"keys\":" + m.size() + ",\"gui.done\":" + q(String.valueOf(m.get("gui.done"))) + ",\"menu.singleplayer\":" + q(String.valueOf(m.get("menu.singleplayer"))) + ",\"death.attack.starve\":" + q(String.valueOf(m.get("death.attack.starve"))) + ",\"formatted\":" + q(l.a("commands.give.success", new Object[] {"A", "B", 3, "C"})) + "}");
      }
    }
  }
}
