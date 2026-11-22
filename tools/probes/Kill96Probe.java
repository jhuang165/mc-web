import java.io.File;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Batch 96 (horse96): /kill (CommandKill: attackEntityFrom(DamageSource.outOfWorld, Float.MAX_VALUE)) on a REAL EntityPlayerMP that is riding. The player double, server double and world double are CmdExec83Probe's
// (PlayerDamageProbe.Player: a real mw with a server double, StatisticsFile, containers and a recording NetHandlerPlayServer); the mount is a real horse (wi, saddled, tame) or pig (wo), put in the loaded entity
// list with the player so the unchanged World.updateEntities (ahb.h) runs both. Each tick: ahb.h(), then the player's own mw.i (onUpdateEntity, the network phase). Records per tick: the player's and mount's
// links (m / l), isDead (K), health, deathTime, positions, and the packets the player's NetHandlerPlayServer was handed. The respawn (oi.a(mw, int, boolean)) needs a WorldServer, tracker and chunk manager, so only its
// first world-side step is run: ahb.f(Entity) (mt.f, removePlayerEntityDangerously), after which the unchanged ahb.h() runs again to show when the mount lets go.
public class Kill96Probe extends CmdExec83Probe {

  public static class KP extends mw {
    List<String> direct = new ArrayList<>();
    KP() { super(null, null, null, null); }
    public void a(fj c) { direct.add(CmdChatProbe.comp(c)); }
    public boolean a(int level, String name) { return true; }
  }
  static KP mkKP(String name, double x, double y, double z) throws Exception {
    KP p = (KP) u.allocateInstance(KP.class); p.direct = new ArrayList<>();
    // CmdChatProbe.player(...) fields, copied from a CP double
    CmdChatProbe.CP base = mk(name, x, y, z, 0f, 0f, 0);
    for (Class<?> c = mw.class; c != Object.class; c = c.getSuperclass())
      for (Field f : c.getDeclaredFields()) { if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue; f.setAccessible(true); f.set(p, f.get(base)); }
    fd(sa.class, "o").set(p, PlayerDamageProbe.w);
    ((CmdChatProbe.NH) p.a).b = p;
    // what mw.h / mw.i / sv.h need beyond CmdExec83's double (as Horse95Probe's rider): the lists of mw, sv.f / sv.g, FoodStats, the armour array, StatFileWriter reads
    for (Field f : mw.class.getDeclaredFields()) if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(p, new ArrayList()); }
    fd(sv.class, "f").set(p, new HashMap()); fd(sv.class, "g").set(p, new add[5]);
    fd(yz.class, "bp").set(p, u.allocateInstance(Horse95Probe.FD.class));
    fd(mw.class, "bO").set(p, u.allocateInstance(Horse96Probe.ST2.class));
    fd(mw.class, "c").set(p, u.allocateInstance(Horse95Probe.IM.class));
    Object ct = u.allocateInstance(Horse95Probe.CT.class); fd(sa.class, "o"); fd(yz.class, "bn").set(p, ct); fd(yz.class, "bo").set(p, ct);
    return p;
  }
  static String st(KP a, sw m, List list) throws Exception {
    return "{\"riding\":" + (a.m != null) + ",\"ridden\":" + (m.l != null) + ",\"playerDead\":" + a.K + ",\"mountDead\":" + m.K + ",\"health\":" + num(a.aS()) + ",\"mountHealth\":" + num(m.aS()) + ",\"deathTime\":" + fd(sv.class, "aA").getInt(a) + ",\"mountDeathTime\":" + fd(sv.class, "aA").getInt(m)
      + ",\"loaded\":" + list.size() + ",\"player\":[" + num(a.s) + "," + num(a.t) + "," + num(a.u) + "],\"mount\":[" + num(m.s) + "," + num(m.t) + "," + num(m.u) + "],\"packets\":" + ((CmdChatProbe.NH) a.a).got.size() + "}";
  }
  public static void main(String[] argv) throws Exception {
    run96();
  }
  static void run96() throws Exception {
    PlayerDamageProbe.init();
    u = PlayerDamageProbe.u;
    CmdChatProbe.u = u;
    // The world double: PlayerDamageProbe's World fields copied into a W.
    W w = (W) u.allocateInstance(W.class);
    for (Class<?> c = PlayerDamageProbe.World.class; c != Object.class; c = c.getSuperclass())
      for (Field f : c.getDeclaredFields()) {
        if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
        f.setAccessible(true); f.set(w, f.get(PlayerDamageProbe.w));
      }
    { Field l = ahb.class.getDeclaredField("L"); l.setAccessible(true); l.set(w, new ArrayList<>()); } // World.collidingBoundingBoxes (func_147461_a), which a dismount reads
    PlayerDamageProbe.w = w; SuffocationProbe.w = w; DifficultyProbe.w = w;
    pp.a(); pc.a();
    statsDir = java.nio.file.Files.createTempDirectory("cmdexec83").toFile();
    server = (CmdChatProbe.Srv) u.allocateInstance(CmdChatProbe.Srv.class);
    oi mgr = (oi) u.allocateInstance(CmdChatProbe.MgrImpl.class);
    Field e = oi.class.getDeclaredField("e"); e.setAccessible(true);
    online = new ArrayList<>();
    u.putObject(mgr, u.objectFieldOffset(e), online);
    Field mi = oi.class.getDeclaredField("i"); mi.setAccessible(true);
    u.putObject(mgr, u.objectFieldOffset(mi), server);
    Field uf = net.minecraft.server.MinecraftServer.class.getDeclaredField("u"); uf.setAccessible(true);
    u.putObject(server, u.objectFieldOffset(uf), mgr);
    Field jf = net.minecraft.server.MinecraftServer.class.getDeclaredField("j"); jf.setAccessible(true);
    u.putObject(u.staticFieldBase(jf), u.staticFieldOffset(jf), server);
    u.putObject(server, u.objectFieldOffset(net.minecraft.server.MinecraftServer.class.getDeclaredField("b")), new qi());
    mt ws = (mt) u.allocateInstance(mt.class);
    for (Field f : ahb.class.getDeclaredFields()) {
      if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
      f.setAccessible(true); f.set(ws, f.get(w));
    }
    Field wsf = net.minecraft.server.MinecraftServer.class.getDeclaredField("c"); wsf.setAccessible(true);
    wsf.set(server, new mt[] { ws, ws, ws });
    y.a(new Admin());
    String[] classes = { "bz", "ar", "aq", "al", "aw", "ca", "cb", "ap", "bv", "at", "am", "ao", "an", "bq", "au", "ak", "az", "ah", "bp", "bn", "as", "ai", "by", "br", "bf", "bk", "ae", "bu", "bm", "bx", "ba", "bg" };
    handler = new z();
    for (String c : classes) { aa cmd = (aa) Class.forName(c).getDeclaredConstructor().newInstance(); handler.a(cmd); byName.put(cmd.c(), cmd); }
    Field of = net.minecraft.server.MinecraftServer.class.getDeclaredField("o"); u.putObject(server, u.objectFieldOffset(of), handler);



    // The player double of CmdExec83Probe.mk with the REAL EntityPlayerMP.onDeath (mw.a(ro): the death message to the server's player list, inventory drops, scoreboard, stats, combat tracker).
    PlayerDamageProbe.World.cells.clear();
    for (int x = -4; x < 16; x++) for (int z = -4; z < 16; z++) PlayerDamageProbe.World.cells.put(PlayerDamageProbe.World.key(x, 63, z), 1);
    ro kill = null;
    for (Field f : ro.class.getDeclaredFields()) if (java.lang.reflect.Modifier.isStatic(f.getModifiers()) && f.getType() == ro.class && "outOfWorld".equals(((ro) f.get(null)).o)) kill = (ro) f.get(null);
    final apx empty = (apx) u.allocateInstance(apx.class);
    for (Field f : apx.class.getDeclaredFields()) if (f.getType() == List[].class) { f.setAccessible(true); List[] l = new List[16]; for (int i = 0; i < 16; i++) l[i] = new ArrayList(); f.set(empty, l); }
    MobMoveProbe.set(PlayerDamageProbe.w, "v", java.lang.reflect.Proxy.newProxyInstance(apu.class.getClassLoader(), new Class[] { apu.class }, (proxy, m, a) -> { Class r = m.getReturnType(); if (r == apx.class) return empty; if (r == boolean.class) return true; if (r == int.class) return 0; return null; })); // the chunk provider: every chunk exists and is empty
    Method upd = MobMoveProbe.method(ahb.class, "h");
    Method pupd = MobMoveProbe.method(mw.class, "i");
    Method rem = MobMoveProbe.method(ahb.class, "f", sa.class);
    for (String kind : new String[] { "horse", "pig" }) for (int variant = 0; variant < 3; variant++) {
      // variant 0: /kill only; 1: /kill, then the respawn's world step (ahb.f) 8 ticks later; 2: /kill with the mount killed too
      online.clear();
      KP alex = mkKP("Alex", 5.5, 64, 5.5);
      online.add(alex);
      sw mount;
      if (kind.equals("horse")) { wi h = new wi(PlayerDamageProbe.w); h.a((sy) null); h.i(true); h.n(true); MobMoveProbe.set(h, "Z", new Random(1)); mount = h; }
      else mount = new wo(PlayerDamageProbe.w);
      PlayerDamageProbe.pos(mount, 5.5, 64, 5.5);
      MobMoveProbe.set(mount, "Z", new Random(1));
      MobMoveProbe.set(mount, "D", true);
      alex.a((sa) mount);
      List list = (List) MobMoveProbe.field(ahb.class, "e").get(PlayerDamageProbe.w);
      list.clear(); list.add(mount); list.add(alex);
      ((CmdChatProbe.NH) alex.a).got.clear(); alex.direct.clear();
      StringBuilder rows = new StringBuilder();
      for (int i = 0; i < 40; i++) {
        String err = "";
        if (i == 3) {
          boolean r = alex.a(kill, Float.MAX_VALUE);
          if (variant == 2) mount.a(kill, 1000f);
          rows.append("{\"event\":\"kill\",\"result\":" + r + ",\"state\":" + st(alex, mount, list) + "},");
        }
        if (i == 11 && variant == 1) { rem.invoke(PlayerDamageProbe.w, alex); rows.append("{\"event\":\"removePlayerEntityDangerously\",\"state\":" + st(alex, mount, list) + "},"); }
        for (sa x : new sa[] { mount, alex }) {
          MobMoveProbe.field(sa.class, "ag").setBoolean(x, true);
          MobMoveProbe.field(sa.class, "ah").setInt(x, (int) Math.floor(MobMoveProbe.d(x, "s") / 16));
          MobMoveProbe.field(sa.class, "ai").setInt(x, (int) Math.floor(MobMoveProbe.d(x, "t") / 16));
          MobMoveProbe.field(sa.class, "aj").setInt(x, (int) Math.floor(MobMoveProbe.d(x, "u") / 16));
        }
        try { upd.invoke(PlayerDamageProbe.w); } catch (java.lang.reflect.InvocationTargetException x) { Throwable t = x.getCause(); while (t.getCause() != null && t.getCause() != t) t = t.getCause(); err = t + " @" + t.getStackTrace()[0] + " " + t.getStackTrace()[1] + " " + t.getStackTrace()[2]; }
        try { if (!alex.K) pupd.invoke(alex); } catch (java.lang.reflect.InvocationTargetException x) { Throwable t = x.getCause(); while (t.getCause() != null) t = t.getCause(); err += " i:" + t + " @" + t.getStackTrace()[0] + " " + t.getStackTrace()[1]; }
        rows.append("{\"t\":" + i + ",\"state\":" + st(alex, mount, list) + ",\"err\":\"" + err.replace("\"", "'") + "\"}" + (i < 39 ? "," : ""));
      }
      System.out.println("{\"case\":\"killRider\",\"mount\":\"" + kind + "\",\"variant\":" + variant + ",\"death\":" + q(String.valueOf(PlayerDamageProbe.Player.message)) + ",\"rows\":[" + rows + "]}");
    }
  }
}
