import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 85 convert85: a live squid pushing and being pushed (EntityLivingBase.collideWithNearbyEntities, sv.bo, inside ws.e's blocked-free update) on the unchanged
// 1.7.10 classes. The world double is SquidBatProbe's (water above the stone floor) whose getEntitiesWithinAABBExcludingEntity (ahb.b(sa, azt)) answers the entities
// whose box meets the query box. Entity.rand is CorpseLivingProbe.Log (LCG copy with a draw counter). ticksExisted counts before each ws.h().
//   pair    two squids, B's start offset from A's by (dx, dz), A.h() then B.h() each tick for 40 ticks, in water: rows [tick, A state, A draws, A random, B state, B draws, B random]
//   player  one squid and a stub EntityPlayer (a bare yz, never ticked) at an offset: the squid's rows, and the player's motion after each tick
//   three   three squids in a cluster (pushes chain)
// Batch 86 mobrec86 (names b86-*): a pool world (EntityListProbe.EW, map-backed blocks: still water 9 at x 44..85, z 44..85, y 0..9, stone walls around, the real
// World.handleMaterialAcceleration and isAABBInMaterial, getCollidingBoundingBoxes with the boat's getBoundingBox and the mover's getCollisionBox) holding
//   boat    a squid and an EntityBoat (xi, empty) in one list walked in order (World.updateEntities: lastTickPos, ticksExisted++, onUpdate): the squid's sv.bo pushes the boat
//           (boat.applyEntityCollision(squid)); the boat's own update pushes only boats; each blocks the other's move. Rows: squid state, boat [x, posY, z, vx, vy, vz, yaw, isDead]
//   tplayer a squid and a real EntityPlayerMP (ServerPlayerProbe) ticked after the world's entities by EntityPlayerMP.onUpdateEntity (mw.i: EntityPlayer.onUpdate, onLivingUpdate's
//           move and collideWithNearbyEntities) and put back where it stood (NetHandlerPlayServer.processPlayer's setPositionAndRotation): both push. Rows: squid state, player motion
// Batch 87 mobrec87 (SQ_B87, names b87-*): the b86 boat set-up with a rider: an EntityListProbe.Cow (EntityCow with updateAITasks switched off) mounted on the boat (Entity.mountEntity)
//   rider   the list walked as World.updateEntities does: a rider whose mount is live is skipped at its own place and updated right after its mount (updateRidden, then the
//           mount's updateRiderPosition); the squid's sv.bo pushes the boat and the cow. Rows: squid state, boat row, cow [x, y, z, vx, vy, vz]
public class SquidPushProbe {
  public static class World extends SquidBatProbe.World {
    static List<sa> ents = new ArrayList<>();
    public List b(sa entity, azt box) {
      List out = new ArrayList();
      for (sa e : ents) if (e != entity && e.C.b(box)) out.add(e);
      return out;
    }
  }
  public static class P extends yz {
    P(ahb world) { super(world, new com.mojang.authlib.GameProfile(java.util.UUID.nameUUIDFromBytes("probe".getBytes()), "probe")); }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
  }
  static final sun.misc.Unsafe u;
  static { try { u = MobMoveProbe.unsafe(); } catch (Exception e) { throw new RuntimeException(e); } }
  static String num(double v) { return Double.toString(v); }

  static ws squid(World w, long seed, double x, double y, double z, CorpseLivingProbe.Log[] logOut, int i) throws Exception {
    ws e = SquidBatProbe.squid(w, seed, x, y, z);
    logOut[i] = new CorpseLivingProbe.Log(seed);
    MobMoveProbe.set(e, "Z", logOut[i]);
    World.ents.add(e);
    return e;
  }
  static String state(ws e, CorpseLivingProbe.Log r, int before, int tick) throws Exception {
    String s = SquidBatProbe.squidState(e, tick, 0);
    s = s.substring(s.indexOf(",\"tick\"") + 1, s.length() - 1);
    return "{" + s + ",\"draws\":" + (r.calls - before) + ",\"random\":" + r.json() + "}";
  }

  static void run(World w, String name, long seed, double[][] at, boolean withPlayer, int ticks) throws Exception {
    World.wet = true;
    World.ents.clear();
    int n = at.length - (withPlayer ? 1 : 0);
    CorpseLivingProbe.Log[] logs = new CorpseLivingProbe.Log[n];
    ws[] sq = new ws[n];
    for (int i = 0; i < n; i++) sq[i] = squid(w, seed + 31L * i, at[i][0], at[i][1], at[i][2], logs, i);
    yz player = null;
    if (withPlayer) {
      player = new P(w);
      MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(player, at[n][0], at[n][1], at[n][2]);
      World.ents.add(player);
    }
    StringBuilder rows = new StringBuilder();
    for (int t = 1; t <= ticks; t++) {
      StringBuilder row = new StringBuilder("[");
      for (int i = 0; i < n; i++) {
        int before = logs[i].calls;
        CorpseLivingProbe.tick(sq[i]);
        sq[i].h();
        row.append(i > 0 ? "," : "").append(state(sq[i], logs[i], before, t));
      }
      if (player != null) row.append(",[").append(num(player.v)).append(",").append(num(player.w)).append(",").append(num(player.x)).append("]");
      rows.append(t > 1 ? "," : "").append(row).append("]");
    }
    StringBuilder pos = new StringBuilder("[");
    for (int i = 0; i < at.length; i++) pos.append(i > 0 ? "," : "").append("[" + num(at[i][0]) + "," + num(at[i][1]) + "," + num(at[i][2]) + "]");
    System.out.println("{\"name\":\"" + name + "\",\"seed\":" + seed + ",\"squids\":" + n + ",\"player\":" + withPlayer + ",\"at\":" + pos + "],\"rows\":[" + rows + "]}");
  }

  // --- batch 86: the pool world ---
  public static class Pool extends EntityListProbe.EW {
    static sa extra; // the ticked player: answered by the entity queries, not walked with the list
    public ahu a(int x, int z) { return ahu.d(1); } // plains: mw.i's biome achievement check (every 20 ticks)
    public List b(sa except, azt box) {
      List out = super.b(except, box);
      if (extra != null && extra != except && !extra.K && extra.C.b(box)) out.add(extra);
      return out;
    }
  }
  static Pool pool() throws Exception {
    Pool w = (Pool) u.allocateInstance(Pool.class);
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, false);
    MobMoveProbe.field(ahb.class, "h").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "L").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "u").set(w, new ArrayList());
    w.cells = new java.util.HashMap<>();
    w.entities = new ArrayList<>();
    Object info = u.allocateInstance(ays.class);
    MobMoveProbe.set(info, "x", new agy());
    MobMoveProbe.set(w, "x", info);
    MobMoveProbe.set(w, "r", rd.values()[2]); // difficultySetting (FoodStats.onUpdate reads it)
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new bac()); } // the scoreboard mw.i's health criteria read
    for (int x = 43; x <= 86; x++) for (int z = 43; z <= 86; z++) for (int y = 0; y <= 10; y++) {
      boolean wall = x == 43 || x == 86 || z == 43 || z == 86;
      if (wall) w.put(x, y, z, 1, 0); else if (y <= 9) w.put(x, y, z, 9, 0);
    }
    Pool.extra = null;
    return w;
  }
  static String boatRow(xi b) { return "[" + num(b.s) + "," + num(b.t) + "," + num(b.u) + "," + num(b.v) + "," + num(b.w) + "," + num(b.x) + "," + Float.toString(b.y) + "," + (b.K ? 1 : 0) + "]"; }
  static ws poolSquid(Pool w, long seed, double x, double y, double z, CorpseLivingProbe.Log[] logs, int i) throws Exception {
    ws e = new ws(w);
    MobMoveProbe.set(e, "by", 1.0F / (new Random(seed).nextFloat() + 1.0F) * 0.2F);
    logs[i] = new CorpseLivingProbe.Log(seed);
    MobMoveProbe.set(e, "Z", logs[i]);
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    SquidBatProbe.zeroYaw(e);
    return e;
  }
  static void step(sa e) { e.S = e.s; e.T = e.t; e.U = e.u; e.A = e.y; e.B = e.z; e.aa++; e.h(); } // World.updateEntityWithOptionalForce
  // order "sb": squid first; "bs": boat first. at = {squid x, y, z}, boat = {x, y, z, vx, yaw}.
  static void boat(String name, long seed, String order, double[] at, double[] bt, int ticks) throws Exception {
    Pool w = pool();
    CorpseLivingProbe.Log[] logs = new CorpseLivingProbe.Log[1];
    ws sq = poolSquid(w, seed, at[0], at[1], at[2], logs, 0);
    xi boat = new xi(w, bt[0], bt[1], bt[2]);
    boat.y = (float) bt[4]; boat.A = boat.y; boat.v = bt[3];
    PlayerStepProbe.field(sa.class, "c").setInt(boat, 1);
    PlayerStepProbe.field(sa.class, "Z").set(boat, new Random(7));
    String start = boatRow(boat);
    if (order.equals("sb")) { w.entities.add(sq); w.entities.add(boat); } else { w.entities.add(boat); w.entities.add(sq); }
    StringBuilder rows = new StringBuilder();
    for (int t = 1; t <= ticks; t++) {
      int before = logs[0].calls;
      for (int i = 0; i < w.entities.size(); i++) { sa e = w.entities.get(i); if (!e.K) step(e); }
      rows.append(t > 1 ? "," : "").append("[").append(state(sq, logs[0], before, t)).append(",").append(boatRow(boat)).append("]");
    }
    System.out.println("{\"name\":\"" + name + "\",\"kind\":\"boat\",\"seed\":" + seed + ",\"order\":\"" + order + "\",\"at\":[" + num(at[0]) + "," + num(at[1]) + "," + num(at[2]) + "],\"boat\":[" + num(bt[0]) + "," + num(bt[1]) + "," + num(bt[2]) + "," + num(bt[3]) + "," + num(bt[4]) + "],\"boatStart\":" + start + ",\"rows\":[" + rows + "]}");
  }
  static void rideStep(Pool w) { // World.updateEntities: the rider rule of EntityListProbe's walk
    for (int i = 0; i < w.entities.size(); i++) {
      sa e = w.entities.get(i);
      if (e.m != null) { if (!e.m.K && e.m.l == e) continue; e.m.l = null; e.m = null; }
      if (!e.K) EntityListProbe.update(e);
    }
  }
  // order "sb": squid, boat, cow; "bs": boat, squid, cow (the cow is listed last; it updates right after the boat either way).
  static void rider(String name, long seed, String order, double[] at, double[] bt, int ticks) throws Exception {
    Pool w = pool();
    CorpseLivingProbe.Log[] logs = new CorpseLivingProbe.Log[1];
    ws sq = poolSquid(w, seed, at[0], at[1], at[2], logs, 0);
    xi boat = new xi(w, bt[0], bt[1], bt[2]);
    boat.y = (float) bt[4]; boat.A = boat.y; boat.v = bt[3];
    PlayerStepProbe.field(sa.class, "c").setInt(boat, 1);
    PlayerStepProbe.field(sa.class, "Z").set(boat, new Random(7));
    EntityListProbe.Cow cow = new EntityListProbe.Cow(w);
    PlayerStepProbe.field(sa.class, "Z").set(cow, new Random(7));
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(cow, bt[0], bt[1] + 1, bt[2]);
    SquidBatProbe.zeroYaw(cow);
    cow.a(boat); // Entity.mountEntity
    String start = boatRow(boat);
    if (order.equals("sb")) { w.entities.add(sq); w.entities.add(boat); } else { w.entities.add(boat); w.entities.add(sq); }
    w.entities.add(cow);
    StringBuilder rows = new StringBuilder();
    for (int t = 1; t <= ticks; t++) {
      int before = logs[0].calls;
      rideStep(w);
      rows.append(t > 1 ? "," : "").append("[").append(state(sq, logs[0], before, t)).append(",").append(boatRow(boat)).append(",[").append(num(cow.s)).append(",").append(num(cow.t)).append(",").append(num(cow.u)).append(",").append(num(cow.v)).append(",").append(num(cow.w)).append(",").append(num(cow.x)).append("]]");
    }
    System.out.println("{\"name\":\"" + name + "\",\"kind\":\"rider\",\"seed\":" + seed + ",\"order\":\"" + order + "\",\"at\":[" + num(at[0]) + "," + num(at[1]) + "," + num(at[2]) + "],\"boat\":[" + num(bt[0]) + "," + num(bt[1]) + "," + num(bt[2]) + "," + num(bt[3]) + "," + num(bt[4]) + "],\"boatStart\":" + start + ",\"rows\":[" + rows + "]}");
  }
  static void tplayer(String name, long seed, double[] at, double[] pl, int ticks) throws Exception {
    Pool w = pool();
    CorpseLivingProbe.Log[] logs = new CorpseLivingProbe.Log[1];
    ws sq = poolSquid(w, seed, at[0], at[1], at[2], logs, 0);
    w.entities.add(sq);
    ServerPlayerProbe.PM player = ServerPlayerProbe.make(w, "probe");
    for (java.lang.reflect.Field f : mw.class.getDeclaredFields()) if (pq.class.isAssignableFrom(f.getType())) { f.setAccessible(true); Object sf = f.get(player); if (sf == null) { sf = MobMoveProbe.unsafe().allocateInstance(f.getType()); f.set(player, sf); } java.lang.reflect.Field m = pq.class.getDeclaredField("a"); m.setAccessible(true); m.set(sf, new java.util.HashMap()); }
    PlayerStepProbe.field(sa.class, "Z").set(player, new Random(9));
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(player, pl[0], pl[1], pl[2]);
    player.bE.a = false; player.bE.d = false;
    Pool.extra = player;
    StringBuilder rows = new StringBuilder();
    for (int t = 1; t <= ticks; t++) {
      int before = logs[0].calls;
      for (int i = 0; i < w.entities.size(); i++) { sa e = w.entities.get(i); if (!e.K) step(e); }
      String sqs = state(sq, logs[0], before, t);
      String pushed = "[" + num(player.v) + "," + num(player.w) + "," + num(player.x) + "]"; // after the squid's push, before the player's own update
      double sx = player.s, sy = player.t, sz = player.u;
      player.aa++;
      player.i();
      MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(player, sx, sy, sz);
      rows.append(t > 1 ? "," : "").append("[").append(sqs).append(",").append(pushed).append(",[").append(num(player.v)).append(",").append(num(player.w)).append(",").append(num(player.x)).append("]]");
    }
    System.out.println("{\"name\":\"" + name + "\",\"kind\":\"tplayer\",\"seed\":" + seed + ",\"at\":[" + num(at[0]) + "," + num(at[1]) + "," + num(at[2]) + "],\"player\":[" + num(pl[0]) + "," + num(pl[1]) + "," + num(pl[2]) + "],\"rows\":[" + rows + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    if (System.getenv("SQ_B87") != null) {
      rider("b87-rider-sb", 8701, "sb", new double[] {65.1, 9.2, 64.7}, new double[] {64.5, 9.6, 64.5, 0, 0}, 40);
      rider("b87-rider-bs", 8701, "bs", new double[] {65.1, 9.2, 64.7}, new double[] {64.5, 9.6, 64.5, 0, 0}, 40);
      rider("b87-rider-drift", 8702, "bs", new double[] {65.2, 9.2, 64.5}, new double[] {63.5, 9.6, 64.6, 0.1, 90}, 40);
      rider("b87-rider-ram", 8703, "bs", new double[] {65.2, 9.2, 64.5}, new double[] {63.9, 9.6, 64.6, 0.15, 90}, 40);
      return;
    }
    if (System.getenv("SQ_B86") != null) {
      boat("b86-boat-sb", 8601, "sb", new double[] {65.1, 9.2, 64.7}, new double[] {64.5, 9.6, 64.5, 0, 0}, 40);
      boat("b86-boat-bs", 8601, "bs", new double[] {65.1, 9.2, 64.7}, new double[] {64.5, 9.6, 64.5, 0, 0}, 40);
      boat("b86-boat-drift", 8602, "bs", new double[] {65.2, 9.2, 64.5}, new double[] {63.5, 9.6, 64.6, 0.1, 90}, 40);
      for (int v : new int[] {15, 25}) boat("b86-boat-ram-" + v, 8603, "bs", new double[] {65.2, 9.2, 64.5}, new double[] {63.9, 9.6, 64.6, v / 100.0, 90}, 40);
      tplayer("b86-tplayer-0", 8610, new double[] {64.5, 5, 64.5}, new double[] {64.8, 5, 64.6}, 30);
      tplayer("b86-tplayer-1", 8611, new double[] {64.5, 5, 64.5}, new double[] {64.2, 5.3, 64.9}, 30);
      return;
    }
    World w = (World) u.allocateInstance(World.class);
    CorpseLivingProbe.setupWorld(w);
    for (int k = 0; k < 4; k++) {
      double[][] d = { {0.1, 0.05}, {0.3, -0.2}, {0.0, 0.0}, {0.55, 0.4} }; // B's offset from A: overlapping, touching-ish, coincident, apart (0.2 margin)
      run(w, "pair-" + k, 100 + k, new double[][] { {64.5, 10, 64.5}, {64.5 + d[k][0], 10.2, 64.5 + d[k][1]} }, false, 40);
    }
    run(w, "three", 300, new double[][] { {64.5, 10, 64.5}, {64.8, 10.1, 64.6}, {64.6, 10.3, 64.9} }, false, 40);
    run(w, "player-0", 400, new double[][] { {64.5, 10, 64.5}, {64.7, 10, 64.6} }, true, 30);
    run(w, "player-1", 401, new double[][] { {64.5, 10, 64.5}, {64.2, 10, 64.9} }, true, 30);
  }
}
