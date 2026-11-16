import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

// Runs initGui (and drawScreen text) of the unchanged 1.7.10 menu screens headlessly: a Minecraft (bao) subclass allocated without its
// constructor, the real GameSettings (bbj) built on a scratch directory, the real FontRenderer (ascii.png, glyph_sizes.bin) that records
// its drawString / drawSplitString calls, the real GuiButton (bcb) list. Output: one JSON object per line (screen, size, buttons, text).
// Usage: java GuiMenusProbe <extracted-jar-dir>; driven by tools/verify-gui-menus.mjs.
class MC extends bao {
  static final List<bdw> shown = new ArrayList<>();
  static boolean single = false;
  MC() { super((bbs) null, 0, 0, false, false, null, null, null, null, null, null, null); }
  public void a(bdw s) { shown.add(s); }
  public void l() { }
  public bqf P() { return GuiMenusProbe.tm; }
  public bqy Q() { return GuiMenusProbe.rm; }
  public boolean G() { return single; }
  public boolean F() { return single; }
  public aze d() { return GuiMenusProbe.saves; }
  public brc R() { return GuiMenusProbe.packs; }
  public bbs M() { return GuiMenusProbe.session; }
  public bmg a() { return GuiMenusProbe.fb; }
  public bsx H() { return GuiMenusProbe.server; }
  public brr S() { return GuiMenusProbe.lang; }
}
// Test double for the TextureManager (bqf): binding a texture only needs to succeed; the bound names are not recorded.
class bqf { public bqf(bqy m) {} public void a(bqx l) {} public bqx a(String n, bpq t) { return new bqx(n); } public bqh b(bqx l) { return null; } public void c(bqx l) {} }
class ProbeFramebuffer extends bmg {
  ProbeFramebuffer() { super(0, 0, false); }
  public void a(int w, int h) {} public void a() {} public void b(int w, int h) {} public void a(int i) {} public void b() {} public void c() {} public void d() {} public void e() {}
}
class R2 implements bqy {
  final Path root;
  R2(Path root) { this.root = root; }
  static String path(bqx l) { return l.a().equals("minecraft") ? l.b() : l.a(); }
  public Set a() { return new HashSet<>(Arrays.asList("minecraft")); }
  bqw res(String path) throws IOException {
    final InputStream in = Files.newInputStream(root.resolve("assets/minecraft/" + path));
    return new bqw() { public InputStream b() { return in; } public boolean c() { return false; } public bru a(String s) { return null; } };
  }
  public bqw a(bqx l) { try { return res(path(l)); } catch (IOException e) { throw new RuntimeException(e); } }
  public List b(bqx l) { try { return new ArrayList<>(Arrays.asList(res(path(l)))); } catch (IOException e) { return new ArrayList<>(); } }
}
class F2 extends bbu {
  static final List<String> draws = new ArrayList<>();
  F2(bbj s, boolean unicode) { super(s, new bqx("textures/font/ascii.png"), new bqf(null), unicode); }
  public int a(String s, int x, int y, int c, boolean shadow) {
    draws.add("{\"op\":\"drawString\",\"text\":" + GuiMenusProbe.q(s) + ",\"x\":" + x + ",\"y\":" + y + ",\"color\":" + c + ",\"shadow\":" + shadow + "}");
    return 0;
  }
  public void a(String s, int x, int y, int w, int c) {
    draws.add("{\"op\":\"drawSplitString\",\"text\":" + GuiMenusProbe.q(s) + ",\"x\":" + x + ",\"y\":" + y + ",\"width\":" + w + ",\"color\":" + c + "}");
  }
}
public class GuiMenusProbe {
  static sun.misc.Unsafe u;
  static bqf tm = new bqf(null);
  static bqy rm;
  static MC mc;
  static F2 font;
  static aze saves;
  static brc packs;
  static bbs session;
  static bmg fb;
  static bsx server;
  static brr lang;
  /** b77: GuiMultiplayer with `n` saved servers (servers.dat in mcDataDir); the LAN-scan entry is drawn after them. */
  static void serverFixtures(int n) {
    try {
      Files.deleteIfExists(((File) get(mc, bao.class, "w")).toPath().resolve("servers.dat"));
      bjp l = new bjp(mc);
      for (int i = 0; i < n; i++) l.a(new bjn("Server " + (i + 1), "127.0.0.1:" + (25565 + i)));
      l.b();
    } catch (Exception e) { throw new RuntimeException(e); }
  }
  static Path packDir;
  static boolean packsMade = false;
  static void pack(String name, String mcmeta) throws Exception {
    Path d = packDir.resolve(name);
    Files.createDirectories(d);
    if (mcmeta != null) Files.write(d.resolve("pack.mcmeta"), mcmeta.getBytes("UTF-8"));
  }
  /** b77: real folder packs in the repository directory (GuiScreenResourcePacks lists them through ResourcePackRepository). `selected` puts "Alpha Pack" in the selected list. */
  static void packFixtures(boolean selected) {
    try {
      if (!packsMade) {
        packsMade = true;
        pack("Alpha Pack", "{\"pack\":{\"pack_format\":1,\"description\":\"A short description.\"}}");
        pack("Beta Pack With A Very Long Name That Cannot Fit Inside The Pack List Row", "{\"pack\":{\"pack_format\":1,\"description\":\"First line of a long description that should wrap across several lines in the pack row, more than two.\"}}");
        pack("Gamma", "{\"pack\":{\"pack_format\":1,\"description\":\"\\u00a7aGreen\\u00a7r and plain text\"}}");
        pack("Broken Pack", null);
      }
      packs.a();
      List<Object> chosen = new ArrayList<>();
      if (selected) for (Object o : packs.b()) if (((brf) o).d().equals("Alpha Pack")) chosen.add(o);
      packs.a(chosen);
    } catch (Exception e) { throw new RuntimeException(e); }
  }
  static ays info(boolean hardcore, String name) {
    dh t = new dh();
    t.a("LevelName", name);
    t.a("hardcore", hardcore);
    return new ays(t);
  }
  static void setByType(Object o, Class<?> c, Class<?> type, Object v) throws Exception {
    for (Field f : c.getDeclaredFields()) if (f.getType() == type && !Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(o, v); return; }
    throw new RuntimeException("no field of " + type);
  }
  static void world(boolean hardcore) throws Exception {
    bjf w = (bjf) u.allocateInstance(bjf.class);
    setByType(w, ahb.class, ays.class, info(hardcore, "World1"));
    mc.f = w;
    if (mc.h == null) {
      mc.h = (bjk) u.allocateInstance(bjk.class);
      te dw = new te(mc.h);
      dw.a(18, Integer.valueOf(0)); // score
      set(mc.h, sa.class, "af", dw);
    }
    if (mc.r == null) {
      mc.r = (bbv) u.allocateInstance(bbv.class);
      setByType(mc.r, bbv.class, bcc.class, new bcc(mc));
    }
  }
  static String q(String s) {
    if (s == null) return "null";
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static Object get(Object o, Class<?> c, String name) throws Exception { Field f = c.getDeclaredField(name); f.setAccessible(true); return f.get(o); }
  static void set(Object o, Class<?> c, String name, Object v) throws Exception { Field f = c.getDeclaredField(name); f.setAccessible(true); f.set(o, v); }
  static String buttons(bdw g) {
    List<String> bj = new ArrayList<>();
    for (Object o : g.n) {
      bcb b = (bcb) o;
      Field fw, fh;
      try {
        fw = bcb.class.getDeclaredField("f"); fh = bcb.class.getDeclaredField("g"); fw.setAccessible(true); fh.setAccessible(true);
        bj.add("{\"id\":" + b.k + ",\"class\":" + q(b.getClass().getName()) + ",\"x\":" + b.h + ",\"y\":" + b.i + ",\"w\":" + fw.get(b) + ",\"h\":" + fh.get(b) + ",\"label\":" + q(b.j) + ",\"enabled\":" + b.l + ",\"visible\":" + b.m + "}");
      } catch (Exception e) { throw new RuntimeException(e); }
    }
    return "[" + String.join(",", bj) + "]";
  }
  static brr lang0() throws Exception { return new brr(new brw(), "en_US"); }
  static void click(bdw g, int id) throws Exception {
    for (Object o : new ArrayList<>(g.n)) {
      bcb b = (bcb) o;
      if (b.k == id) {
        if (!b.l || !b.m) throw new RuntimeException("button " + id + " not clickable");
        Method m = bdw.class.getDeclaredMethod("a", bcb.class); m.setAccessible(true); m.invoke(g, b);
        return;
      }
    }
    throw new RuntimeException("no button " + id);
  }
  /** `world`: 0 none, 1 normal, 2 hardcore. `ticks` runs updateScreen; `clicks` runs actionPerformed for those button ids in order. */
  static String run(String name, int w, int h, java.util.function.Supplier<bdw> make, int world, boolean single, int ticks, int[] clicks, boolean draw) {
    try {
      if (world == 0) { mc.f = null; } else world(world == 2);
      MC.single = single;
      MC.shown.clear();
      org.lwjgl.Sys.now = 0L;
      bdw g = make.get();
      mc.n = g;
      g.a(mc, w, h);
      for (int i = 0; i < ticks; i++) g.e();
      for (int id : clicks) { click(g, id); if (!MC.shown.isEmpty()) break; }
      String texts = "[]";
      String drawError = null;
      if (draw) {
        F2.draws.clear();
        List saved = new ArrayList(g.n);
        g.n.clear();
        try { g.a(0, 0, 0f); } catch (Throwable t) { drawError = t.toString(); } finally { g.n.addAll(saved); }
        texts = "[" + String.join(",", F2.draws) + "]";
      }
      List<String> shown = new ArrayList<>();
      for (bdw d : MC.shown) shown.add(q(d == null ? "null" : d.getClass().getName()));
      return "{\"screen\":" + q(name) + ",\"w\":" + w + ",\"h\":" + h + ",\"world\":" + world + ",\"single\":" + single + ",\"ticks\":" + ticks
        + ",\"clicks\":" + Arrays.toString(clicks) + ",\"buttons\":" + buttons(g) + ",\"text\":" + texts + ",\"shown\":[" + String.join(",", shown) + "],\"drawError\":" + q(drawError) + "}";
    } catch (Throwable t) {
      Throwable r = t; while (r.getCause() != null) r = r.getCause();
      StackTraceElement[] st = r.getStackTrace();
      return "{\"screen\":" + q(name) + ",\"w\":" + w + ",\"h\":" + h + ",\"error\":" + q(r.toString() + " @ " + String.join(" < ", Arrays.stream(st).limit(6).map(Object::toString).toArray(String[]::new))) + "}";
    }
  }
  public static void main(String[] args) throws Exception {
    Path root = Paths.get(args[0]);
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); u = (sun.misc.Unsafe) uf.get(null);
    rm = new R2(root);
    brs locale = new brs();
    locale.a(rm, new ArrayList<>(Arrays.asList("en_US")));
    Method setLocale = brp.class.getDeclaredMethod("a", brs.class); setLocale.setAccessible(true); setLocale.invoke(null, locale);
    aji.p();
    mc = (MC) u.allocateInstance(MC.class);
    set(null, bao.class, "M", mc);
    Path tmp = Files.createTempDirectory("guimenus");
    bbj settings = (bbj) u.allocateInstance(bbj.class);
    try { settings = new bbj(mc, tmp.toFile()); } catch (Throwable t) { System.err.println("GameSettings: " + t); settings = (bbj) u.allocateInstance(bbj.class); }
    mc.u = settings;
    set(mc, bao.class, "w", tmp.toFile()); // mcDataDir: servers.dat for the Multiplayer scenarios below
    font = new F2(settings, false);
    font.a(rm);
    mc.l = font; mc.m = font;
    saves = (aze) Proxy.newProxyInstance(GuiMenusProbe.class.getClassLoader(), new Class[] {aze.class}, (proxy, m, a) -> {
      if (m.getName().equals("b") && a == null) {
        List<azf> l = new ArrayList<>();
        l.add(new azf("World1", "My World", 1000000L, 4096L, ahk.values()[0], false, false, false));
        l.add(new azf("New World", "New World", 2000000L, 8192L, ahk.values()[1], false, true, true));
        return l;
      }
      if (m.getName().equals("c")) return a[0].equals("World1") ? info(false, "World1") : null;
      if (m.getReturnType() == boolean.class) return false;
      return null;
    });
    bra defaultPack = (bra) Proxy.newProxyInstance(GuiMenusProbe.class.getClassLoader(), new Class[] {bra.class}, (proxy, m, a) -> {
      if (m.getName().equals("a") && a == null) return new java.awt.image.BufferedImage(64, 64, java.awt.image.BufferedImage.TYPE_INT_ARGB);
      if (m.getName().equals("b") && a == null) return "Default";
      if (m.getName().equals("c")) return new HashSet<>();
      if (m.getReturnType() == boolean.class) return false;
      return null;
    });
    brw metadata = new brw();
    metadata.a(new bsh(), bsg.class); // Minecraft's constructor registers the pack section serializer the same way
    packDir = tmp.resolve("resourcepacks");
    packs = new brc(packDir.toFile(), tmp.resolve("server-resource-packs").toFile(), defaultPack, metadata, settings);
    server = (bsx) u.allocateInstance(bsx.class);
    lang = new brr(new brw(), "en_US");
    set(mc, bao.class, "as", lang);
    Method setLocale2 = brp.class.getDeclaredMethod("a", brs.class); setLocale2.setAccessible(true); setLocale2.invoke(null, locale); // the LanguageManager constructor installs an empty Locale
    fb = (bmg) u.allocateInstance(ProbeFramebuffer.class);
    session = new bbs("Player", "uuid", "token", "legacy");
    String[] only = args.length > 1 ? args[1].split(",") : null;
    int[][] sizes = {{320, 240}, {427, 240}, {200, 150}};
    Scenarios.run(only, sizes);
    System.exit(0); // the server-list ping pool threads are not daemons
  }
}
