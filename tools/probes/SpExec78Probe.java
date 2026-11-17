import java.lang.reflect.*;
import java.util.*;

// Minecraft Java 1.7.10 single-player effects (batch 78 spexec78), run on the unchanged original classes. No class is patched.
//  - thrown: EntityThrowable.onImpact (zk.a(azu)) of EntitySnowball (zj), EntityEgg (zl) and EntityEnderPearl (zm) on a server and a client world, with no hit, a zombie, a blaze,
//    and the egg's chick rolls over 256 seeds; the pearl with a connected owner, a disconnected owner, a riding owner, an owner of another world, and no owner.
//  - fireball: EntityLargeFireball.onImpact (zg.a(azu)) and EntitySmallFireball.onImpact (zi.a(azu)) on a block face (all six sides, air and solid target), a zombie, a blaze,
//    on both worlds and with mobGriefing on and off.
//  - jukebox: ItemRecord.onItemUse and BlockJukebox.onBlockActivated through the real world double, then the logged aux 1005 events through the real RenderGlobal.playAuxSFX
//    (bma.a) and WorldClient listener chain (World.playRecord -> RenderGlobal.playRecord), recording the sound handler and the GuiIngame record message.
//  - milk: EntityCow.interact (wh.a(yz)) and EntityMooshroom.interact (wm.a(yz)) with a bucket or a bowl, shears on a mooshroom, on both worlds.
// Records (JSON lines): kind thrown / egg-rolls / pearl / fireball / jukebox / milk.
public class SpExec78Probe {
  static String q(String s) { return s == null ? "null" : SoundSweepProbe.q(s); }
  static String num(double v) { return Double.toString(v); }
  static void line(String s) { System.out.println(s); }
  static Field fd(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }
  static String jlist(List<String> l) { return "[" + String.join(",", l) + "]"; }

  // ---------------------------------------------------------------- doubles
  public static class W extends MobMoveProbe.ProbeWorld {
    List<String> ev = new ArrayList<>();
    List<Object> spawned = new ArrayList<>();
    Set<String> solid = new HashSet<>();
    agy rules = new agy();
    W() { super(); }
    public void a(String kind, double x, double y, double z, double mx, double my, double mz) { ev.add(SpExec78Probe.q("particle " + kind + " " + x + " " + y + " " + z + " " + mx + " " + my + " " + mz)); }
    public agw a(sa e, double x, double y, double z, float size, boolean flaming, boolean smoking) { ev.add(SpExec78Probe.q("explosion " + (e == null ? "null" : e.getClass().getSimpleName()) + " " + x + " " + y + " " + z + " " + size + " flaming=" + flaming + " smoking=" + smoking)); return null; }
    public boolean b(int x, int y, int z, aji b) { ev.add(SpExec78Probe.q("setBlock " + x + "," + y + "," + z + " id=" + aji.b(b))); return true; }
    public boolean c(int x, int y, int z) { return !solid.contains(x + "," + y + "," + z); }
    public boolean d(sa e) { spawned.add(e); return true; }
    public agy O() { return rules; }
    public void a(sa e, String s, float v, float p) { ev.add(SpExec78Probe.q("sound " + s + " " + v + " " + p)); }
    public List b(sa e, azt box) { return new ArrayList(); }
    public List a(Class c, azt box) { return new ArrayList(); }
  }
  static W world(boolean remote) throws Exception {
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    W w = (W) u.allocateInstance(W.class);
    w.ev = new ArrayList<>(); w.spawned = new ArrayList<>(); w.solid = new HashSet<>(); w.rules = new agy();
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, remote);
    return w;
  }
  static String attack(String who, ro src, float amount, sa ball, sa shooter) {
    return q("attack " + who + " " + (double) amount + " type=" + src.o + " source=" + (src.i() == null ? "null" : src.i() == shooter ? "shooter" : src.i() == ball ? "ball" : "other") + " direct=" + (src.j() == null ? "null" : src.j() == shooter ? "shooter" : src.j() == ball ? "ball" : "other") + " fire=" + src.e() + " magic=" + src.g() + " absolute=" + src.h());
  }
  public static class Zombie extends yq {
    W w; sa ball, shooter; String name = "zombie";
    Zombie() { super(null); }
    public boolean a(ro s, float a) { w.ev.add(attack(name, s, a, ball, shooter)); return true; }
    public void e(int sec) { w.ev.add(SpExec78Probe.q("setFire " + name + " " + sec)); }
  }
  public static class Blaze extends xx {
    W w; sa ball, shooter;
    Blaze() { super(null); }
    public boolean a(ro s, float a) { w.ev.add(attack("blaze", s, a, ball, shooter)); return true; }
    public void e(int sec) { w.ev.add(SpExec78Probe.q("setFire blaze " + sec)); }
  }
  public static class Owner extends mw {
    W w; boolean connected = true; sa ball;
    Owner() { super(null, null, null, null); }
    public boolean a(ro s, float a) { w.ev.add(attack("owner", s, a, ball, null)); return true; }
    public void a(sa mount) { w.ev.add(SpExec78Probe.q("mountEntity " + (mount == null ? "null" : "entity"))); try { MobMoveProbe.set(this, "m", null); } catch (Exception e) { throw new RuntimeException(e); } } // EntityPlayerMP.mountEntity also sends packets: only the call is recorded
    public void a(double x, double y, double z) { w.ev.add(SpExec78Probe.q("setPositionAndUpdate " + x + " " + y + " " + z)); }
  }
  public static class Net extends ej {
    boolean open;
    Net() { super(false); }
    public boolean d() { return open; }
  }
  public static class Handler extends nh {
    Net net;
    Handler() { super(null, null, null); }
    public ej b() { return net; }
  }

  static <T> T alloc(Class<T> c) throws Exception { return (T) MobMoveProbe.unsafe().allocateInstance(c); }
  static void place(sa e, W w, double x, double y, double z) throws Exception {
    MobMoveProbe.set(e, "o", w); MobMoveProbe.set(e, "s", x); MobMoveProbe.set(e, "t", y); MobMoveProbe.set(e, "u", z);
    MobMoveProbe.set(e, "C", azt.a(x - 0.3, y, z - 0.3, x + 0.3, y + 1.8, z + 0.3));
    MobMoveProbe.set(e, "Z", new Random(5));
  }
  static String spawnedJson(W w) throws Exception {
    List<String> l = new ArrayList<>();
    for (Object o : w.spawned) {
      sa e = (sa) o;
      String extra = e instanceof rx ? ",\"age\":" + ((rx) e).d() : "";
      l.add("{\"class\":" + q(e.getClass().getSimpleName()) + ",\"at\":[" + num(e.s) + "," + num(e.t) + "," + num(e.u) + "],\"yaw\":" + num(e.y) + ",\"pitch\":" + num(e.z) + extra + "}");
    }
    return jlist(l);
  }
  static void invoke(Object ball, azu hit) throws Exception {
    Method m = ball.getClass().getSuperclass() == zk.class || ball.getClass() == zj.class || ball.getClass() == zl.class || ball.getClass() == zm.class ? ball.getClass().getDeclaredMethod("a", azu.class) : null;
    if (m == null) m = ball.getClass().getDeclaredMethod("a", azu.class);
    m.setAccessible(true);
    m.invoke(ball, hit);
  }
  static azu blockHit(int x, int y, int z, int side) { return new azu(x, y, z, side, azw.a(x + 0.5, y + 0.5, z + 0.5)); }

  // ---------------------------------------------------------------- thrown
  static void thrown() throws Exception {
    String[] names = {"snowball", "egg", "pearl"};
    for (int type = 0; type < 3; type++) for (int remote = 0; remote < 2; remote++) for (String target : new String[] {"none", "zombie", "blaze"}) {
      W w = world(remote == 1);
      zk ball = type == 0 ? new zj(w) : type == 1 ? new zl(w) : new zm(w);
      place(ball, w, 10.25, 20.5, 30.75);
      MobMoveProbe.set(ball, "Z", new Random(7));
      sa hit = null;
      if (target.equals("zombie")) { Zombie z = alloc(Zombie.class); z.w = w; z.name = "zombie"; z.ball = ball; place(z, w, 10, 20, 30); hit = z; }
      if (target.equals("blaze")) { Blaze b = alloc(Blaze.class); MobMoveProbe.set(b, "ae", true); b.w = w; b.ball = ball; place(b, w, 10, 20, 30); hit = b; }
      String err = "null";
      try { invoke(ball, hit == null ? blockHit(10, 20, 30, 1) : new azu(hit)); } catch (Throwable t) { err = q(SpSounds77Probe.errOf(t)); }
      line("{\"kind\":\"thrown\",\"entity\":" + q(names[type]) + ",\"remote\":" + (remote == 1) + ",\"target\":" + q(target) + ",\"dead\":" + ball.K + ",\"error\":" + err + ",\"events\":" + jlist(w.ev) + ",\"spawned\":" + spawnedJson(w) + "}");
    }
    // egg chick rolls: the number of chicks for 256 seeds of the egg's own Random, then the full record of one seed per count
    int[] counts = new int[256];
    Map<Integer, Integer> firstSeed = new TreeMap<>();
    for (int seed = 0; seed < 256; seed++) {
      W w = world(false);
      zl egg = new zl(w); place(egg, w, 10.25, 20.5, 30.75);
      MobMoveProbe.set(egg, "Z", new Random(seed * 2654435761L));
      MobMoveProbe.set(egg, "y", 77f);
      invoke(egg, blockHit(10, 20, 30, 1));
      counts[seed] = w.spawned.size();
      firstSeed.putIfAbsent(counts[seed], seed);
    }
    StringBuilder cs = new StringBuilder();
    for (int i = 0; i < 256; i++) cs.append(i > 0 ? "," : "").append(counts[i]);
    List<String> detail = new ArrayList<>();
    for (Map.Entry<Integer, Integer> e : firstSeed.entrySet()) {
      W w = world(false);
      zl egg = new zl(w); place(egg, w, 10.25, 20.5, 30.75);
      MobMoveProbe.set(egg, "Z", new Random(e.getValue() * 2654435761L));
      MobMoveProbe.set(egg, "y", 77f);
      invoke(egg, blockHit(10, 20, 30, 1));
      detail.add("{\"count\":" + e.getKey() + ",\"seed\":" + (e.getValue() * 2654435761L) + ",\"spawned\":" + spawnedJson(w) + "}");
    }
    line("{\"kind\":\"egg-rolls\",\"counts\":[" + cs + "],\"detail\":" + jlist(detail) + "}");
  }

  // ---------------------------------------------------------------- pearl owners
  static void pearls() throws Exception {
    // owner: connected | disconnected | riding | other-world | none ; the pearl lands at (10.25, 20.5, 30.75); fall distance 12 before
    for (String kind : new String[] {"connected", "disconnected", "riding", "other-world", "none", "with-hit"}) for (int remote = 0; remote < 2; remote++) {
      W w = world(remote == 1);
      W other = kind.equals("other-world") ? world(remote == 1) : w;
      zm pearl = new zm(w);
      place(pearl, w, 10.25, 20.5, 30.75);
      MobMoveProbe.set(pearl, "Z", new Random(9));
      Owner o = null;
      if (!kind.equals("none")) {
        o = alloc(Owner.class); o.w = w; o.ball = pearl;
        place(o, other, 3, 64, 3);
        Net net = alloc(Net.class); net.open = !kind.equals("disconnected");
        Handler h = alloc(Handler.class); h.net = net;
        MobMoveProbe.set(o, "a", h);
        o.R = 12f;
        if (kind.equals("riding")) { Zombie horse = alloc(Zombie.class); horse.w = w; horse.name = "mount"; place(horse, w, 3, 63, 3); MobMoveProbe.set(o, "m", horse); MobMoveProbe.set(horse, "l", o); }
        MobMoveProbe.set(pearl, "g", o);
      }
      sa hit = null;
      if (kind.equals("with-hit")) { Zombie z = alloc(Zombie.class); z.w = w; z.name = "zombie"; z.ball = pearl; place(z, w, 10, 20, 30); hit = z; }
      String err = "null";
      try { invoke(pearl, hit == null ? blockHit(10, 20, 30, 1) : new azu(hit)); } catch (Throwable t) { err = q(SpSounds77Probe.errOf(t)); }
      line("{\"kind\":\"pearl\",\"owner\":" + q(kind) + ",\"remote\":" + (remote == 1) + ",\"dead\":" + pearl.K + ",\"error\":" + err + ",\"fallDistance\":" + (o == null ? "null" : num(o.R)) + ",\"riding\":" + (o == null ? "null" : (o.m != null)) + ",\"events\":" + jlist(w.ev) + "}");
    }
  }

  // ---------------------------------------------------------------- fireballs
  static void fireballs() throws Exception {
    for (int large = 0; large < 2; large++) for (int remote = 0; remote < 2; remote++) for (int griefing = 1; griefing >= 0; griefing--) {
      String[][] targets = {{"block-up", "1"}, {"block-down", "0"}, {"block-n", "2"}, {"block-s", "3"}, {"block-w", "4"}, {"block-e", "5"}, {"block-solid-neighbour", "1"}, {"zombie", ""}, {"blaze", ""}};
      for (String[] t : targets) for (String shooterKind : new String[] {"blaze", "none"}) {
        if (griefing == 0 && !(t[0].equals("block-up") || t[0].equals("zombie"))) continue;
        W w = world(remote == 1);
        w.rules.a("mobGriefing", griefing == 1 ? "true" : "false");
        ze ball = large == 1 ? new zg(w) : new zi(w);
        place(ball, w, 10.25, 20.5, 30.75);
        Blaze shooter = null; // Unsafe skips the constructor: xx.<init> sets isImmuneToFire (ae), set it by hand
        if (shooterKind.equals("blaze")) { shooter = alloc(Blaze.class); MobMoveProbe.set(shooter, "ae", true); shooter.w = w; place(shooter, w, 0, 0, 0); MobMoveProbe.set(ball, "a", shooter); }
        if (large == 1) MobMoveProbe.set(ball, "e", 2);
        azu hit;
        if (t[0].equals("zombie")) { Zombie z = alloc(Zombie.class); z.w = w; z.name = "zombie"; z.ball = ball; z.shooter = shooter; place(z, w, 10, 20, 30); hit = new azu(z); }
        else if (t[0].equals("blaze")) { Blaze b = alloc(Blaze.class); MobMoveProbe.set(b, "ae", true); b.w = w; b.ball = ball; b.shooter = shooter; place(b, w, 10, 20, 30); hit = new azu(b); }
        else if (t[0].equals("none")) hit = null;
        else hit = blockHit(10, 20, 30, Integer.parseInt(t[1]));
        if (t[0].equals("block-solid-neighbour")) w.solid.add("10,21,30");
        String err = "null";
        try { invoke(ball, hit); } catch (Throwable x) { err = q(SpSounds77Probe.errOf(x)); }
        line("{\"kind\":\"fireball\",\"large\":" + (large == 1) + ",\"remote\":" + (remote == 1) + ",\"mobGriefing\":" + (griefing == 1) + ",\"target\":" + q(t[0]) + ",\"shooter\":" + q(shooterKind) + ",\"dead\":" + ball.K + ",\"error\":" + err + ",\"events\":" + jlist(w.ev) + "}");
      }
    }
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); alb.e();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    String only = args.length > 0 ? args[0] : "all";
    if (only.equals("all") || only.equals("thrown")) { thrown(); pearls(); }
    if (only.equals("all") || only.equals("fireball")) fireballs();
    if (only.equals("all") || only.equals("jukebox")) SpExec78Jukebox.run();
    if (only.equals("all") || only.equals("milk")) SpExec78Milk.run();
  }
}
