import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;

// The player's own mount in level.dat, written and read by the unchanged 1.7.10 classes. EntityPlayer (yz, real constructor on the
// MobMoveProbe world double, as LevelDatProbe) rides a mount through Entity.mountEntity (sa.a(sa)); Entity.writeToNBT (sa.e) is what
// SaveHandler.writePlayerData calls and nests the mount as "Riding" (Entity.writeMountToNBT, sa.c); the mount alone through the chunk path
// (Entity.writeToNBTOptional, sa.d) is refused while ridden. ServerConfigurationManager.initializeConnectionToPlayer (oi) then does
// `if (tag.hasKey("Riding", 10)) { e = EntityList.createEntityFromNBT(tag.getCompoundTag("Riding"), world); if (e != null) { spawn; player.mountEntity(e); } }`:
// replayed here as sg.a(compound, world) and player.a(entity) (no nested chain is built). Mounts: boat (xi), empty and chest minecart (xl), a
// saddled pig (wo) and a tame saddled horse (wi). One JSON object per line:
//   playerRiding {kind, mountId, playerNbt (hex of sa.e), mountChunkSaved (sa.d of the mount while ridden), loadedId, mounted, loaded {x,y,z,mx,my,mz,yaw,pitch},
//                 again (hex of the reloaded, remounted player written with sa.e), nestedRidingLinked (a Riding compound inside Riding: did sg.a link it?)}
//   playerRidingBad {name, loadedId} createEntityFromNBT results for an unknown id and a compound without id.
public class PlayerRidingProbe {
  static LevelDatProbe.W W;
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static void place(sa e, double x, double y, double z, float yaw, double mx, double my, double mz) throws Exception {
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    e.y = yaw; e.v = mx; e.w = my; e.x = mz;
  }
  static String vec(sa e) { return "{\"x\":" + e.s + ",\"y\":" + e.t + ",\"z\":" + e.u + ",\"mx\":" + e.v + ",\"my\":" + e.w + ",\"mz\":" + e.x + ",\"yaw\":" + e.y + ",\"pitch\":" + e.z + "}"; }
  static LevelDatProbe.P player() throws Exception { return new LevelDatProbe.P(W, new com.mojang.authlib.GameProfile(new UUID(1L, 2L), "Player")); }

  static void run(String kind, sa mount, boolean nested) throws Exception {
    LevelDatProbe.P p = player();
    place(p, mount.s, mount.t + 0.5, mount.u, 30f, 0, 0, 0);
    p.a(mount);
    dh t = new dh();
    p.e(t);
    LevelDatProbe.fixUuid(t);
    boolean chunkSaved = mount.d(new dh());
    String playerNbt = LevelDatProbe.hex(t);
    dh riding = t.m("Riding");
    if (nested) { dh inner = new dh(); inner.a("id", "Boat"); riding.a("Riding", inner); }
    sa loaded = sg.a(t.m("Riding"), W);
    boolean nestedLinked = loaded != null && loaded.m != null;
    LevelDatProbe.P p2 = player();
    p2.f(t);
    if (loaded != null) p2.a(loaded);
    dh again = new dh();
    p2.e(again);
    LevelDatProbe.fixUuid(again);
    System.out.println("{\"case\":\"playerRiding\",\"kind\":" + q(kind) + ",\"mountId\":" + q(sg.b(mount)) + ",\"playerNbt\":\"" + playerNbt + "\",\"mountChunkSaved\":" + chunkSaved
      + ",\"loadedId\":" + q(loaded == null ? null : sg.b(loaded)) + ",\"mounted\":" + (loaded != null && p2.m == loaded && loaded.l == p2) + ",\"loaded\":" + (loaded == null ? "null" : vec(loaded))
      + ",\"nestedRidingLinked\":" + nestedLinked + ",\"again\":\"" + LevelDatProbe.hex(again) + "\"}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    LevelDatProbe.u = u;
    W = (LevelDatProbe.W) u.allocateInstance(LevelDatProbe.W.class);
    MobMoveProbe.set(W, "s", new Random(2));
    MobMoveProbe.set(W, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(W, new ArrayList()); }
    MobMoveProbe.set(W, "t", u.allocateInstance(aqq.class));
    ays worldInfo = new ays(new ahj(17L, ahk.b, true, false, ahm.b), "Probe");
    worldInfo.a(8, 64, 8);
    MobMoveProbe.field(ahb.class, "x").set(W, worldInfo);
    LevelDatProbe.world = W;

    xi boat = new xi(W, 100.5, 64.0, -20.25);
    place(boat, 100.5, 64.0, -20.25, 90f, 0.125, 0.0, -0.25);
    run("boat", boat, false);
    run("boat-nested-riding", boat, true);
    xl cart = xl.a(W, 50.5, 70.0, 12.5, 0);
    place(cart, 50.5, 70.0, 12.5, 180f, 0.0, 0.0, 0.25);
    run("cart", cart, false);
    xl chest = xl.a(W, -10.5, 40.0, 3.5, 1);
    place(chest, -10.5, 40.0, 3.5, 0f, 0.0, 0.0, 0.0);
    run("chest-cart", chest, false);
    wo pig = new wo(W);
    place(pig, 8.5, 63.0, 9.5, 270f, 0, 0, 0);
    dh pt = new dh(); pig.e(pt); pt.a("Saddle", true); pig.f(pt);
    run("saddled-pig", pig, false);
    wi horse = new wi(W);
    place(horse, 20.5, 66.0, -3.5, 135f, 0, 0, 0);
    dh ht = new dh(); horse.e(ht); ht.a("Tame", true); ht.a("Temper", 40); dh sd = new dh(); sd.a("id", (short) 329); sd.a("Count", (byte) 1); sd.a("Damage", (short) 0); ht.a("SaddleItem", sd); ht.a("Variant", 258); horse.f(ht);
    run("horse", horse, false);
    for (String[] bad : new String[][] {{"unknown-id", "Nope"}, {"no-id", null}}) {
      dh c = new dh();
      if (bad[1] != null) c.a("id", bad[1]);
      c.a("Pos", LevelDatProbe.doubles(1, 2, 3));
      sa e = sg.a(c, W);
      System.out.println("{\"case\":\"playerRidingBad\",\"name\":" + q(bad[0]) + ",\"loadedId\":" + q(e == null ? null : sg.b(e)) + "}");
    }
  }
}
