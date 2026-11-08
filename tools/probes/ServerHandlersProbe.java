import io.netty.buffer.Unpooled;
import io.netty.util.concurrent.GenericFutureListener;
import java.lang.reflect.Field;
import java.util.*;

// Drives the unchanged NetHandlerPlayServer (nh) of the 1.7.10 JAR headlessly: MC|BEdit / MC|BSign custom payloads, creative inventory
// action drops (the m spam counter), chat (the l spam counter, the op / single-player owner exemption in ServerConfigurationManager
// func_152596_g, illegal characters), held item change, sign text, block placement and digging reach, and use-entity reach.
// The surroundings are test doubles: the server (MinecraftServer subclass: build limit, owner, command manager), the world (mt subclass:
// entity lookup, block exists, tile entity), the player (mw subclass allocated without its constructor: it records drop / attack /
// interact calls and answers canEntityBeSeen), the item-in-world manager (mx subclass: records which action reached it) and the network
// manager (ej subclass: records packets and the disconnect). The handler code, the inventory (yx), the item classes, the NBT and the
// packet codec (et) are the original classes. One JSON object per line; see tools/verify-server-handlers.mjs.
public class ServerHandlersProbe {
  static sun.misc.Unsafe U;
  static final List<String> ev = new ArrayList<>();
  static String jq(String s) {
    if (s == null) return "null";
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) { if (c == '"' || c == '\\') b.append('\\').append(c); else if (c < 32 || c == 127) b.append(String.format("\\u%04x", (int) c)); else b.append(c); }
    return b.append('"').toString();
  }
  static void out(String s) { System.out.println(s); }
  static void set(Object o, String n, Object v) throws Exception { MobMoveProbe.set(o, n, v); }
  static Object get(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static int geti(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).getInt(o); }
  @SuppressWarnings("unchecked") static <T> T alloc(Class<T> c) throws Exception { return (T) U.allocateInstance(c); }
  static String arr(List<String> l) { return "[" + String.join(",", l) + "]"; }
  static String events() { String s = arr(ev); ev.clear(); return s; }

  // ---- doubles ----
  static class Info extends ays { Info() { super(); } }
  public static class Srv extends net.minecraft.server.MinecraftServer {
    boolean single = true; String owner = "Owner"; TW world;
    Srv() { super(new java.io.File(System.getProperty("java.io.tmpdir")), java.net.Proxy.NO_PROXY); }
    protected boolean e() { return true; } public boolean h() { return false; } public ahk i() { return null; } public rd j() { return null; }
    public boolean k() { return false; } public int l() { return 0; } public boolean m() { return false; } public boolean X() { return false; }
    public boolean ad() { return false; } public String a(ahk k, boolean b) { return ""; }
    public boolean N() { return single; } public String M() { return owner; } public int af() { return 256; }
    public mt a(int d) { return world; }
    public boolean a(ahb w, int x, int y, int z, yz p) { return false; }
    public void f(String s) { ev.add("{\"log\":" + jq(s) + "}"); }
    public ab J() {
      return new ab() {
        public int a(ac s, String t) { ev.add("{\"command\":" + jq(t) + "}"); return 1; }
        public List b(ac s, String t) { return null; } public List a(ac s) { return null; } public Map a() { return null; }
      };
    }
  }
  public static class Ops extends oj {
    boolean op; Ops() { super(null); }
    public boolean d(Object g) { return op; }
  }
  public static class PL extends oi {
    PL() { super(null); }
    public void a(fj c, boolean b) { Object[] args = c instanceof fr ? ((fr) c).j() : null; ev.add("{\"broadcast\":" + (args == null ? jq(c.c()) : jq(String.valueOf(args[1]))) + ",\"sender\":" + (args == null ? "null" : jq(String.valueOf(args[0]))) + "}"); }
  }
  public static class NM extends ej {
    NM() { super(false); }
    public void a(fb l) {}
    public void a(ft p, GenericFutureListener... l) {
      String d = "";
      try { if (p instanceof gs) d = ",\"reason\":" + jq(((gs) p).c().c()); } catch (Exception e) { d = ",\"reason\":\"?\""; }
      ev.add("{\"packet\":" + jq(p.getClass().getSimpleName()) + d + "}");
    }
    public void g() { ev.add("{\"closed\":true}"); }
  }
  public static class MX extends mx {
    MX() { super(null); }
    public boolean d() { return true; }
    public void a(int x, int y, int z, int f) { ev.add("{\"dig\":\"start\",\"pos\":[" + x + "," + y + "," + z + "]}"); }
    public void a(int x, int y, int z) { ev.add("{\"dig\":\"finish\",\"pos\":[" + x + "," + y + "," + z + "]}"); }
    public void c(int x, int y, int z) { ev.add("{\"dig\":\"abort\",\"pos\":[" + x + "," + y + "," + z + "]}"); }
    public boolean a(yz p, ahb w, add s) { ev.add("{\"useItem\":true}"); return true; }
    public boolean a(yz p, ahb w, add s, int x, int y, int z, int f, float a, float b, float c) { ev.add("{\"place\":[" + x + "," + y + "," + z + "," + f + "]}"); return true; }
  }
  public static class PMP extends mw {
    PMP() { super(null, null, null, null); }
    boolean visible = true; zb visibility = zb.a;
    public zb u() { return visibility; }
    public boolean p(sa e) { return visible; }
    public boolean q(sa e) { ev.add("{\"entity\":\"interact\"}"); return true; }
    public void r(sa e) { ev.add("{\"entity\":\"attack\"}"); }
    public xk a(add s, boolean b) { ev.add("{\"drop\":" + (s == null ? "null" : BookProbe.stack(s)) + ",\"random\":" + b + "}"); return null; }
    public xk a(boolean all) { ev.add("{\"dropHeld\":" + all + "}"); return null; }
    public void bA() { ev.add("{\"releaseUse\":true}"); }
    public fj c_() { return new fq(b_()); }
    public void v() {}
  }
  public static class TGT extends sa {
    TGT() { super(null); }
    protected void c() {} protected void a(dh t) {} protected void b(dh t) {}
  }
  public static class TW extends mt {
    TW() { super(null, null, null, 0, null, null); }
    boolean loaded = true; aor tile; Map<Integer, sa> entities = new HashMap<>();
    static final Info INFO = new Info();
    public boolean d(int x, int y, int z) { return loaded; }
    public aor o(int x, int y, int z) { return tile; }
    public void g(int x, int y, int z) { ev.add("{\"markBlock\":[" + x + "," + y + "," + z + "]}"); }
    public aji a(int x, int y, int z) { return aji.e(0); }
    public int e(int x, int y, int z) { return 0; }
    public sa a(int id) { return entities.get(id); }
    public ays N() { return INFO; }
  }

  static class Rig { Srv srv; TW world; PL list; Ops ops; NM net; MX mx; PMP p; nh h; }
  static Rig rig(String name) throws Exception {
    Rig r = new Rig();
    r.srv = alloc(Srv.class); // MinecraftServer's constructor needs a file; the field initialisers it would run are copied by calling it normally
    return r;
  }
  static Rig build(String name) throws Exception {
    Rig r = new Rig();
    r.srv = new Srv();
    r.world = alloc(TW.class); r.world.loaded = true; r.world.entities = new HashMap<>();
    r.srv.world = r.world;
    r.srv.c = new mt[]{r.world, r.world, r.world};
    r.list = alloc(PL.class); set(r.list, "i", r.srv); set(r.list, "e", new ArrayList<>());
    r.ops = alloc(Ops.class); set(r.list, "l", r.ops);
    for (Field f : net.minecraft.server.MinecraftServer.class.getDeclaredFields()) if (f.getType() == oi.class) { f.setAccessible(true); f.set(r.srv, r.list); }
    r.net = alloc(NM.class); r.mx = alloc(MX.class);
    r.p = alloc(PMP.class); r.p.visible = true; r.p.visibility = zb.a;
    MobMoveProbe.field(yz.class, "i").set(r.p, new com.mojang.authlib.GameProfile(new UUID(1L, 2L), name));
    set(r.p, "bm", new yx(r.p));
    set(r.p, "c", r.mx);
    set(r.p, "bn", new aap(r.p.bm, false, r.p));
    r.p.bo = r.p.bn;
    set(r.p, "bE", new yw());
    r.p.ap = 0;
    r.h = new nh(r.srv, r.net, r.p);
    return r;
  }

  static String stackJson(add s) { return s == null ? "null" : BookProbe.stack(s); }
  static byte[] encode(add s) { et b = new et(Unpooled.buffer()); b.a(s); byte[] a = new byte[b.readableBytes()]; b.readBytes(a); return a; }
  static add decode(byte[] d) throws Exception { return new et(Unpooled.wrappedBuffer(d)).c(); }

  // ---- books ----
  static add book(adb item, int count, int damage, dh tag) { add s = new add(item, count, damage); if (tag != null) s.d(tag); return s; }
  static dh tag(dq pages, Object title, Object author) { return BookProbe.tag(pages, title, author); }
  static String rep(char c, int n) { return BookProbe.repeat(c, n); }
  static void bookCase(String name, String channel, add held, int heldSlot, add packet) throws Exception {
    Rig r = build("Steve");
    r.p.bm.a[heldSlot] = held;
    if (heldSlot != 0) r.p.bm.a[0] = null;
    r.p.bm.c = 0;
    if (heldSlot == 5) r.p.bm.c = 0; // the held stack sits in slot 5, selected slot 0 is empty
    String before = stackJson(held), packetJson, after;
    byte[] data = packet == null ? new byte[]{(byte) 0xff, (byte) 0xff} : encode(packet);
    add decoded = decode(data);
    packetJson = stackJson(decoded);
    r.h.a(new iz(channel, data));
    after = stackJson(r.p.bm.a[heldSlot]);
    out("{\"case\":\"book\",\"name\":" + jq(name) + ",\"channel\":" + jq(channel) + ",\"slot\":" + heldSlot + ",\"player\":\"Steve\",\"held\":" + before + ",\"packet\":" + packetJson + ",\"after\":" + after + ",\"events\":" + events() + "}");
  }
  static void books() throws Exception {
    adb w = ade.bA, s = ade.bB;
    dq two = BookProbe.pages("one", "two"), one = BookProbe.pages("x");
    // MC|BEdit
    String E = "MC|BEdit";
    bookCase("edit valid two pages on a plain writable", E, book(w, 1, 0, null), 0, book(w, 1, 0, tag(two, null, null)));
    dh withName = tag(BookProbe.pages("old"), null, null); dh disp = new dh(); disp.a("Name", new dx("Diary")); withName.a("display", disp);
    bookCase("edit keeps the display name, replaces pages", E, book(w, 1, 0, withName), 0, book(w, 1, 0, tag(two, null, null)));
    bookCase("edit page of 256 chars", E, book(w, 1, 0, null), 0, book(w, 1, 0, tag(BookProbe.pages(rep('a', 256)), null, null)));
    bookCase("edit page of 257 chars is invalid", E, book(w, 1, 0, null), 0, book(w, 1, 0, tag(BookProbe.pages(rep('a', 257)), null, null)));
    bookCase("edit second page oversized is invalid", E, book(w, 1, 0, null), 0, book(w, 1, 0, tag(BookProbe.pages("ok", rep('b', 300)), null, null)));
    String[] hundred = new String[100]; Arrays.fill(hundred, "p");
    bookCase("edit 100 pages (no page-count limit)", E, book(w, 1, 0, null), 0, book(w, 1, 0, tag(BookProbe.pages(hundred), null, null)));
    bookCase("edit empty page list", E, book(w, 1, 0, tag(one, null, null)), 0, book(w, 1, 0, tag(BookProbe.pages(), null, null)));
    dh noPages = new dh(); noPages.a("title", new dx("T"));
    bookCase("edit tag without pages is invalid", E, book(w, 1, 0, tag(one, null, null)), 0, book(w, 1, 0, noPages));
    bookCase("edit packet without a tag", E, book(w, 1, 0, tag(one, null, null)), 0, book(w, 1, 0, null));
    bookCase("edit packet stack is a written book onto a held writable", E, book(w, 1, 0, tag(one, null, null)), 0, book(s, 1, 0, tag(two, "T", "A")));
    bookCase("edit packet writable onto a held written book (re-edit of a signed book)", E, book(s, 1, 0, tag(one, "T", "A")), 0, book(w, 1, 0, tag(two, null, null)));
    bookCase("edit with nothing held", E, null, 0, book(w, 1, 0, tag(two, null, null)));
    bookCase("edit packet stack null", E, book(w, 1, 0, tag(one, null, null)), 0, null);
    bookCase("edit extra title and author in the packet are ignored", E, book(w, 1, 0, tag(one, null, null)), 0, book(w, 1, 0, tag(two, "Sneaky", "Mallory")));
    bookCase("edit keeps count and damage of the held stack", E, book(w, 3, 5, tag(one, null, null)), 0, book(w, 1, 0, tag(two, null, null)));
    bookCase("edit with the held book in an unselected slot", E, book(w, 1, 0, tag(one, null, null)), 5, book(w, 1, 0, tag(two, null, null)));
    bookCase("edit section signs and tabs kept in the pages", E, book(w, 1, 0, null), 0, book(w, 1, 0, tag(BookProbe.pages("§4red\tx\u0001", "😀"), null, null)));
    dq ints = new dq(); ints.a(new dw((short) 1));
    bookCase("edit pages list of shorts is invalid", E, book(w, 1, 0, tag(one, null, null)), 0, book(w, 1, 0, tag(ints, null, null)));
    dh pagesString = new dh(); pagesString.a("pages", new dx("nope"));
    bookCase("edit pages as a string tag is invalid", E, book(w, 1, 0, tag(one, null, null)), 0, book(w, 1, 0, pagesString));
    bookCase("edit held item is not a book", E, book(adb.a(aji.e(1)), 1, 0, null), 0, book(w, 1, 0, tag(two, null, null)));
    // MC|BSign
    String S = "MC|BSign";
    bookCase("sign valid", S, book(w, 1, 0, tag(one, null, null)), 0, book(s, 1, 0, tag(two, "My Book", "Mallory")));
    bookCase("sign keeps the held display name and replaces pages, author, title", S, book(w, 1, 0, withName), 0, book(s, 1, 0, tag(two, "T", "Mallory")));
    bookCase("sign on an untagged writable", S, book(w, 1, 0, null), 0, book(s, 1, 0, tag(one, "T", "A")));
    bookCase("sign title of 16 chars", S, book(w, 1, 0, null), 0, book(s, 1, 0, tag(one, rep('t', 16), "A")));
    bookCase("sign title of 17 chars is invalid", S, book(w, 1, 0, null), 0, book(s, 1, 0, tag(one, rep('t', 17), "A")));
    bookCase("sign without a title is invalid", S, book(w, 1, 0, null), 0, book(s, 1, 0, tag(one, null, "A")));
    bookCase("sign empty title", S, book(w, 1, 0, null), 0, book(s, 1, 0, tag(one, "", "A")));
    bookCase("sign title with spaces is not trimmed", S, book(w, 1, 0, null), 0, book(s, 1, 0, tag(one, "  T  ", "A")));
    bookCase("sign section sign in the title is kept", S, book(w, 1, 0, null), 0, book(s, 1, 0, tag(one, "§4T", "A")));
    bookCase("sign without an author is invalid", S, book(w, 1, 0, null), 0, book(s, 1, 0, tag(one, "T", null)));
    bookCase("sign author as a short tag is invalid", S, book(w, 1, 0, null), 0, book(s, 1, 0, tag(one, "T", new Object())));
    bookCase("sign title as a short tag is invalid", S, book(w, 1, 0, null), 0, book(s, 1, 0, tag(one, new Object(), "A")));
    bookCase("sign oversized page is invalid", S, book(w, 1, 0, null), 0, book(s, 1, 0, tag(BookProbe.pages(rep('p', 257)), "T", "A")));
    bookCase("sign held is already written (re-sign)", S, book(s, 1, 0, tag(one, "Old", "Alice")), 0, book(s, 1, 0, tag(two, "New", "Mallory")));
    bookCase("sign packet stack is a writable book", S, book(w, 1, 0, tag(one, null, null)), 0, book(w, 1, 0, tag(two, "T", "A")));
    bookCase("sign with nothing held", S, null, 0, book(s, 1, 0, tag(two, "T", "A")));
    bookCase("sign keeps count and damage of the held stack", S, book(w, 3, 7, tag(one, null, null)), 0, book(s, 1, 0, tag(two, "T", "A")));
    bookCase("sign with the held writable in an unselected slot", S, book(w, 1, 0, tag(one, null, null)), 5, book(s, 1, 0, tag(two, "T", "A")));
    dh extra = tag(two, "T", "A"); extra.a("foo", new dx("bar")); extra.a("generation", new dw((short) 2));
    bookCase("sign extra keys in the packet are ignored", S, book(w, 1, 0, null), 0, book(s, 1, 0, extra));
    bookCase("sign a writable holding a Mallory author tag first", S, book(w, 1, 0, tag(one, "Old", "Mallory")), 0, book(s, 1, 0, tag(two, "T", "Trent")));
    bookCase("sign packet with a null tag", S, book(w, 1, 0, null), 0, book(s, 1, 0, null));
  }

  // ---- creative drops ----
  static void creativeCase(String name, int[] script) throws Exception {
    // script: positive n = tick n times, -1 = valid drop (slot -1, 16 dirt), -2 = invalid damage -1, -3 = size 0, -4 = size 65, -5 = null stack,
    // -6 = size 64, -7 = slot 5 set (no drop), -8 = slot 44 set, -9 = slot 45 set, -10 = slot 0 set
    Rig r = build("Steve");
    List<String> steps = new ArrayList<>();
    adb dirt = adb.a(aji.e(3));
    for (int op : script) {
      if (op > 0) {
        for (int i = 0; i < op; i++) { set(r.h, "k", geti(r.h, "e")); r.h.a(); }
        ev.clear();
        steps.add("{\"op\":\"tick\",\"n\":" + op + ",\"m\":" + geti(r.h, "m") + "}");
        continue;
      }
      add st = null; int slot = -1;
      switch (op) {
        case -1: st = new add(dirt, 16, 0); break;
        case -2: st = new add(dirt, 16, 0); st.b(-1); break;
        case -3: st = new add(dirt, 0, 0); break;
        case -4: st = new add(dirt, 65, 0); break;
        case -5: st = null; break;
        case -6: st = new add(dirt, 64, 0); break;
        case -7: st = new add(dirt, 8, 0); slot = 5; break;
        case -8: st = new add(dirt, 8, 0); slot = 44; break;
        case -9: st = new add(dirt, 8, 0); slot = 45; break;
        case -10: st = new add(dirt, 8, 0); slot = 0; break;
        default: throw new RuntimeException("op " + op);
      }
      add sent = st == null ? null : decode(encode(st));
      int m0 = geti(r.h, "m");
      String err = "null";
      try { r.h.a(new jm(slot, st)); } catch (Exception e) { err = jq(e.toString()); }
      int m1 = geti(r.h, "m");
      steps.add("{\"op\":" + op + ",\"slot\":" + slot + ",\"sent\":" + stackJson(sent) + ",\"before\":" + m0 + ",\"after\":" + m1 + ",\"events\":" + events() + ",\"error\":" + err + "}");
    }
    out("{\"case\":\"creative\",\"name\":" + jq(name) + ",\"steps\":" + arr(steps) + "}");
  }
  static void creative() throws Exception {
    int[] burst = new int[14]; Arrays.fill(burst, -1);
    creativeCase("fourteen drops in one tick", burst);
    creativeCase("ten drops, one tick, drop again", new int[]{-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1});
    creativeCase("decay: refuse at 200, one tick lets one through", new int[]{-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 20, -1, -1});
    creativeCase("a drop every 20 ticks never fills the counter", new int[]{-1, 20, -1, 20, -1, 20, -1, 20, -1});
    creativeCase("a drop every 2 ticks", new int[]{-1, 2, -1, 2, -1, 2, -1, 2, -1, 2, -1, 2, -1, 2, -1, 2, -1, 2, -1, 2, -1, 2, -1, 2, -1, 2, -1, 2, -1, 2, -1});
    creativeCase("invalid stacks do not count", new int[]{-2, -3, -4, -2, -1});
    creativeCase("a null stack drop counts", new int[]{-5, -5, -5, -1});
    creativeCase("size 64 is accepted", new int[]{-6, -6});
    creativeCase("slot sets do not count", new int[]{-7, -8, -9, -10, -7, -1});
    creativeCase("counter far above 200 decays 1 per tick", new int[]{-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 100, -1});
  }

  // ---- chat ----
  static void chatCase(String name, boolean single, boolean cheats, boolean op, boolean lan, String sender, zb vis, Object[] script) throws Exception {
    Rig r = build("Owner");
    r.srv.single = single; r.srv.owner = "Owner";
    set(TW.INFO, "v", cheats);
    r.ops.op = op;
    set(r.list, "s", lan);
    r.p.visibility = vis;
    String exempt; try { exempt = String.valueOf(r.list.g(r.p.bJ())); } catch (Throwable t) { exempt = jq(t.toString()); }
    List<String> steps = new ArrayList<>();
    int n = 0;
    for (Object o : script) {
      if (o instanceof Integer) {
        for (int i = 0; i < (Integer) o; i++) { set(r.h, "k", geti(r.h, "e")); r.h.a(); }
        ev.clear();
        steps.add("{\"op\":\"tick\",\"n\":" + o + ",\"l\":" + geti(r.h, "l") + "}");
        continue;
      }
      String msg = (String) o; n++;
      String err = "null";
      try { r.h.a(new ir(msg)); } catch (Exception e) { err = jq(e.toString()); }
      steps.add("{\"op\":\"chat\",\"text\":" + jq(msg) + ",\"l\":" + geti(r.h, "l") + ",\"events\":" + events() + ",\"error\":" + err + "}");
    }
    set(TW.INFO, "v", false);
    out("{\"case\":\"chat\",\"name\":" + jq(name) + ",\"singlePlayer\":" + single + ",\"cheats\":" + cheats + ",\"op\":" + op + ",\"lan\":" + lan + ",\"exempt\":" + exempt + ",\"steps\":" + arr(steps) + "}");
  }
  static Object[] msgs(int n, String m) { Object[] a = new Object[n]; Arrays.fill(a, m); return a; }
  static Object[] cat(Object[]... parts) { List<Object> l = new ArrayList<>(); for (Object[] p : parts) l.addAll(Arrays.asList(p)); return l.toArray(); }
  static void chat() throws Exception {
    chatCase("single player owner, cheats off: kicked on the 11th message", true, false, false, false, "Owner", zb.a, msgs(12, "hi"));
    chatCase("single player owner, cheats on: exempt", true, true, false, false, "Owner", zb.a, msgs(15, "hi"));
    chatCase("single player owner, cheats off but opped in the op list", true, false, true, false, "Owner", zb.a, msgs(15, "hi"));
    chatCase("single player owner, LAN allow cheats (commandsAllowedForAll)", true, false, false, true, "Owner", zb.a, msgs(15, "hi"));
    chatCase("not a single player server, cheats on, owner name: kicked", false, true, false, false, "Owner", zb.a, msgs(12, "hi"));
    chatCase("ten messages then a tick then one more", true, false, false, false, "Owner", zb.a, cat(msgs(10, "hi"), new Object[]{1}, msgs(2, "hi")));
    chatCase("one message every 20 ticks is sustainable", true, false, false, false, "Owner", zb.a, cat(msgs(10, "a"), new Object[]{20, "b", 20, "c", 20, "d", 20, "e", 20, "f", 20, "g"}));
    chatCase("commands count like chat", true, false, false, false, "Owner", zb.a, cat(msgs(5, "hi"), msgs(6, "/list")));
    chatCase("counter decays 1 per tick, 200 ticks empties it", true, false, false, false, "Owner", zb.a, cat(msgs(10, "hi"), new Object[]{200}, msgs(10, "hi"), new Object[]{9}, msgs(1, "x")));
    chatCase("illegal character section sign", true, false, false, false, "Owner", zb.a, new Object[]{"a§b", "ok"});
    chatCase("illegal character control and DEL", true, false, false, false, "Owner", zb.a, new Object[]{"a\u0001b", "ok", "a\u007fb"});
    chatCase("tabs and newlines are normalised to a space", true, false, false, false, "Owner", zb.a, new Object[]{"a\tb\nc", "  x   y  "});
    chatCase("a 150 char message is cut to 100", true, false, false, false, "Owner", zb.a, new Object[]{rep('z', 150)});
    chatCase("chat hidden: cannotSend, no spam count", true, false, false, false, "Owner", zb.c, msgs(14, "hi"));
    chatCase("commands only visibility still sends chat", true, false, false, false, "Owner", zb.b, new Object[]{"hi", "/list"});
  }

  // ---- held item, sign, reach, entities ----
  static void held() throws Exception {
    List<String> cs = new ArrayList<>();
    for (int slot : new int[]{0, 4, 8, 9, 10, -1, 100, -2147483648, 2147483647}) {
      Rig r = build("Steve");
      r.p.bm.c = 3;
      r.h.a(new jl(slot));
      cs.add("{\"sent\":" + slot + ",\"selected\":" + r.p.bm.c + "}");
    }
    out("{\"case\":\"held\",\"cases\":" + arr(cs) + "}");
  }
  static String signLines(apm t) { List<String> l = new ArrayList<>(); for (String s : t.a) l.add(jq(s)); return arr(l); }
  static void signCase(List<String> cs, String name, String[] lines, boolean editable, boolean ownPlayer, boolean loaded, boolean hasTile) throws Exception {
    Rig r = build("Steve");
    apm t = new apm();
    t.a(editable); if (ownPlayer) t.a((yz) r.p);
    r.world.tile = hasTile ? t : null; r.world.loaded = loaded;
    r.h.a(new jn(3, 64, 5, lines));
    cs.add("{\"name\":" + jq(name) + ",\"sent\":" + arr(Arrays.stream(lines).map(ServerHandlersProbe::jq).collect(java.util.stream.Collectors.toList())) + ",\"after\":" + (hasTile ? signLines(t) : "null") + ",\"events\":" + events() + "}");
  }
  static void sign() throws Exception {
    List<String> cs = new ArrayList<>();
    signCase(cs, "plain lines", new String[]{"a", "bb", "ccc", ""}, true, true, true, true);
    signCase(cs, "15 chars fit", new String[]{rep('w', 15), rep('i', 15), "", ""}, true, true, true, true);
    signCase(cs, "16 chars become !?", new String[]{rep('w', 16), "ok", rep('x', 100), ""}, true, true, true, true);
    signCase(cs, "section sign becomes !?", new String[]{"a§b", "§", "§§§", "ok"}, true, true, true, true);
    signCase(cs, "control chars and DEL become !?", new String[]{"a\u0001", "\t", "x\u007f", "\n"}, true, true, true, true);
    signCase(cs, "non-ASCII is allowed", new String[]{"éèü", "中文", "אבג", "😀"}, true, true, true, true);
    signCase(cs, "15 chars but one section sign", new String[]{"abcdefghijklmn§", "", "", ""}, true, true, true, true);
    signCase(cs, "a surrogate pair counts two chars", new String[]{rep('a', 14) + "😀", rep('a', 13) + "😀", "", ""}, true, true, true, true);
    signCase(cs, "tile not editable", new String[]{"a", "b", "c", "d"}, false, true, true, true);
    signCase(cs, "tile editable by someone else", new String[]{"a", "b", "c", "d"}, true, false, true, true);
    signCase(cs, "chunk not loaded", new String[]{"a", "b", "c", "d"}, true, true, false, true);
    signCase(cs, "no tile entity", new String[]{"a", "b", "c", "d"}, true, true, true, false);
    out("{\"case\":\"sign\",\"cases\":" + arr(cs) + "}");
  }
  // Player at (px,py,pz); a placement or dig at (x,y,z).
  static void placeCase(List<String> cs, String name, double px, double py, double pz, int x, int y, int z, int face, boolean hasMoved, add stack) throws Exception {
    Rig r = build("Steve");
    r.p.s = px; r.p.t = py; r.p.u = pz;
    set(r.h, "r", hasMoved);
    r.h.a(new jo(x, y, z, face, stack, 0.5f, 0.5f, 0.5f));
    cs.add("{\"name\":" + jq(name) + ",\"player\":[" + px + "," + py + "," + pz + "],\"pos\":[" + x + "," + y + "," + z + "],\"face\":" + face + ",\"hasMoved\":" + hasMoved + ",\"events\":" + events() + "}");
  }
  static void digCase(List<String> cs, String name, double px, double py, double pz, int status, int x, int y, int z) throws Exception {
    Rig r = build("Steve");
    r.p.s = px; r.p.t = py; r.p.u = pz;
    r.h.a(new ji(status, x, y, z, 1));
    cs.add("{\"name\":" + jq(name) + ",\"player\":[" + px + "," + py + "," + pz + "],\"status\":" + status + ",\"pos\":[" + x + "," + y + "," + z + "],\"events\":" + events() + "}");
  }
  static void reach() throws Exception {
    adb dirt = adb.a(aji.e(3));
    List<String> pl = new ArrayList<>();
    // squared distance from the feet position to the block centre: 7.5^2 = 56.25 passes, 8.0^2 = 64 fails (strict < 64)
    for (int dx : new int[]{0, 5, 7, 8, 9}) placeCase(pl, "east " + dx, 0.5, 64, 0.5, dx, 64, 0, 1, true, new add(dirt, 1, 0));
    placeCase(pl, "exactly 64 squared (x 8 centre)", 0, 64, 0, 7, 64, -1, 1, true, new add(dirt, 1, 0));
    placeCase(pl, "just under 64 squared", 0.0, 64, 0.0, 7, 64, 0, 1, true, new add(dirt, 1, 0));
    placeCase(pl, "above, 7 blocks up from the feet", 0.5, 64, 0.5, 0, 71, 0, 1, true, new add(dirt, 1, 0));
    placeCase(pl, "above, 8 blocks up from the feet", 0.5, 64, 0.5, 0, 72, 0, 1, true, new add(dirt, 1, 0));
    placeCase(pl, "below, 8 blocks down", 0.5, 64, 0.5, 0, 56, 0, 1, true, new add(dirt, 1, 0));
    placeCase(pl, "player has not moved yet", 0.5, 64, 0.5, 1, 64, 0, 1, false, new add(dirt, 1, 0));
    placeCase(pl, "build limit: y 255 on top is too high", 0.5, 250, 0.5, 0, 255, 0, 1, true, new add(dirt, 1, 0));
    placeCase(pl, "build limit: y 255 on a side is allowed", 0.5, 250, 0.5, 0, 255, 0, 2, true, new add(dirt, 1, 0));
    placeCase(pl, "build limit: y 256 any side is too high", 0.5, 250, 0.5, 0, 256, 0, 2, true, new add(dirt, 1, 0));
    placeCase(pl, "build limit: y 254 on top", 0.5, 250, 0.5, 0, 254, 0, 1, true, new add(dirt, 1, 0));
    placeCase(pl, "use item (face 255) with a stack", 0.5, 64, 0.5, -1, -1, -1, 255, true, new add(dirt, 1, 0));
    placeCase(pl, "use item (face 255) without a stack", 0.5, 64, 0.5, -1, -1, -1, 255, true, null);
    placeCase(pl, "place with nothing in the packet stack", 0.5, 64, 0.5, 1, 64, 0, 1, true, null);
    out("{\"case\":\"placement\",\"cases\":" + arr(pl) + "}");
    List<String> dg = new ArrayList<>();
    // distance from (posY + 1.5) to the block centre must be at most 6 (squared 36)
    for (int st : new int[]{0, 1, 2}) {
      digCase(dg, "status " + st + " 5 blocks east", 0.5, 64, 0.5, st, 5, 64, 0);
      digCase(dg, "status " + st + " 6 blocks east (centre 6.0)", 0.5, 64, 0.5, st, 6, 64, 0);
      digCase(dg, "status " + st + " 7 blocks east", 0.5, 64, 0.5, st, 7, 64, 0);
    }
    digCase(dg, "start, centre exactly 6.0 away from the eye offset", 0.5, 64, 0.5, 0, 6, 65, 0);
    digCase(dg, "start, 5 up (eye offset 1.5 makes it 4.0)", 0.5, 64, 0.5, 0, 0, 69, 0);
    digCase(dg, "start, 7 down", 0.5, 64, 0.5, 0, 0, 58, 0);
    digCase(dg, "start, 8 down", 0.5, 64, 0.5, 0, 0, 57, 0);
    digCase(dg, "start, 7 up", 0.5, 64, 0.5, 0, 0, 71, 0);
    digCase(dg, "start, 6 up", 0.5, 64, 0.5, 0, 0, 70, 0);
    digCase(dg, "start at the build limit y 256", 0.5, 250, 0.5, 0, 0, 256, 0);
    digCase(dg, "start at y 255", 0.5, 250, 0.5, 0, 0, 255, 0);
    digCase(dg, "drop one item (status 4) any distance", 0.5, 64, 0.5, 4, 90, 64, 0);
    digCase(dg, "drop stack (status 3)", 0.5, 64, 0.5, 3, 90, 64, 0);
    digCase(dg, "release use item (status 5)", 0.5, 64, 0.5, 5, 90, 64, 0);
    out("{\"case\":\"digging\",\"cases\":" + arr(dg) + "}");
  }
  static void entityCase(List<String> cs, String name, double ex, double ey, double ez, boolean visible, jb action, String type) throws Exception {
    Rig r = build("Steve");
    r.p.s = 0; r.p.t = 64; r.p.u = 0; r.p.visible = visible;
    sa e = type.equals("item") ? alloc(xk.class) : type.equals("self") ? r.p : alloc(TGT.class);
    if (e != r.p) { e.s = ex; e.t = ey; e.u = ez; }
    int id = 77;
    if (e != r.p) MobMoveProbe.field(sa.class, "c").set(e, id); else id = e.y();
    r.world.entities.put(id, e);
    ja pk = new ja(); set(pk, "a", id); set(pk, "b", action);
    r.h.a(pk);
    cs.add("{\"name\":" + jq(name) + ",\"type\":" + jq(type) + ",\"entity\":[" + ex + "," + ey + "," + ez + "],\"visible\":" + visible + ",\"action\":" + jq(action.name()) + ",\"events\":" + events() + "}");
  }
  static void entities() throws Exception {
    List<String> cs = new ArrayList<>();
    for (jb a : new jb[]{jb.a, jb.b}) {
      for (double d : new double[]{3, 5.9, 5.99, 6, 6.01, 8}) entityCase(cs, "visible, " + d + " east", d, 64, 0, true, a, "mob");
      for (double d : new double[]{2.9, 3, 3.01, 5}) entityCase(cs, "not visible, " + d + " east", d, 64, 0, false, a, "mob");
      entityCase(cs, "visible diagonal 4.3/4.3 (36.98)", 4.3, 64, 4.3, true, a, "mob");
      entityCase(cs, "visible diagonal 4.2/4.2 (35.28)", 4.2, 64, 4.2, true, a, "mob");
      entityCase(cs, "visible vertical 5.9 up", 0, 69.9, 0, true, a, "mob");
      entityCase(cs, "missing entity id", 0, 64, 0, true, a, "none");
    }
    entityCase(cs, "item entity attacked", 1, 64, 0, true, jb.b, "item");
    entityCase(cs, "item entity interacted", 1, 64, 0, true, jb.a, "item");
    entityCase(cs, "self attacked", 0, 64, 0, true, jb.b, "self");
    out("{\"case\":\"useEntity\",\"cases\":" + arr(cs) + "}");
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    U = MobMoveProbe.unsafe();
    BookProbe.u = U;
    books();
    creative();
    chat();
    held();
    sign();
    reach();
    entities();
  }
}
