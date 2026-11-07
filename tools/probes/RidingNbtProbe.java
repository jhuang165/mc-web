import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Vehicle riding in chunk NBT, written and read by the unchanged 1.7.10 classes: Entity.writeToNBT (sa.e) nests the mount as a "Riding"
// compound (Entity.writeMountToNBT, sa.c) inside its rider; Entity.writeToNBTOptional (sa.d, the call AnvilChunkLoader makes) returns false
// for an entity that has a rider (riddenByEntity, sa.l); AnvilChunkLoader.loadEntities creates the rider, then every "Riding" compound
// with EntityList.createEntityFromNBT (sg.a) and links rider.mountEntity(mount) (sa.a(sa)). Mounts here: EntityBoat (xi), the empty
// EntityMinecart (xl.a(world, x, y, z, 0)), a chest minecart (type 1) and, in the chain, an EntitySpider (yn) that carries a skeleton.
// One JSON object per line:
//   riding {kind, rider, mounts, riderSaved, riderNbt (hex of sa.d), mountAloneSaved (sa.d of the bottom mount), mountMountSaved (sa.c),
//           ids (EntityList ids of the loaded chain, rider first), linked (every rider.m is the next loaded mount and its l the rider),
//           mount {x, y, z, mx, my, mz, yaw, pitch} (loaded bottom mount), again (the loaded rider written with sa.d, hex)}
public class RidingNbtProbe {
  static HorseProbe.World W;
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static void place(sa e, double x, double y, double z, float yaw, double mx, double my, double mz) throws Exception {
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z);
    e.y = yaw; e.v = mx; e.w = my; e.x = mz;
  }
  static String vec(sa e) { return "{\"x\":" + e.s + ",\"y\":" + e.t + ",\"z\":" + e.u + ",\"mx\":" + e.v + ",\"my\":" + e.w + ",\"mz\":" + e.x + ",\"yaw\":" + e.y + ",\"pitch\":" + e.z + "}"; }

  // chain[0] is the top rider; each entity rides the next one.
  static void run(String kind, sa... chain) throws Exception {
    for (int i = 0; i < chain.length - 1; i++) chain[i].a(chain[i + 1]);
    sa mount = chain[chain.length - 1];
    dh t = new dh();
    boolean saved = chain[0].d(t);
    boolean aloneSaved = mount.d(new dh());
    dh mountOnly = new dh();
    boolean mountMount = mount.c(mountOnly);
    StringBuilder ids = new StringBuilder();
    StringBuilder s = new StringBuilder("{\"case\":\"riding\",\"kind\":" + q(kind) + ",\"rider\":" + q(sg.b(chain[0])) + ",\"mounts\":" + (chain.length - 1)
      + ",\"riderSaved\":" + saved + ",\"mountAloneSaved\":" + aloneSaved + ",\"mountMountSaved\":" + mountMount + ",\"riderNbt\":\"" + MobNbtProbe.hex(t) + "\"");
    // AnvilChunkLoader.loadEntities
    sa rider = sg.a(t, W);
    boolean linked = rider != null;
    List<sa> loaded = new ArrayList<>();
    loaded.add(rider);
    dh c = t;
    sa e = rider;
    while (linked && c.b("Riding", 10)) {
      c = c.m("Riding");
      sa m = sg.a(c, W);
      if (m == null) { linked = false; break; }
      e.a(m);
      linked &= e.m == m && m.l == e;
      loaded.add(m);
      e = m;
    }
    for (sa x : loaded) ids.append(ids.length() > 0 ? "," : "").append(q(sg.b(x)));
    s.append(",\"ids\":[" + ids + "],\"linked\":" + linked + ",\"mount\":" + vec(e));
    dh again = new dh();
    rider.d(again);
    s.append(",\"again\":\"" + MobNbtProbe.hex(again) + "\"}");
    System.out.println(s);
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    HorseProbe.World world = (HorseProbe.World) MobNbtProbe.u.allocateInstance(HorseProbe.World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", MobNbtProbe.u.allocateInstance(aqq.class));
    W = world;
    HorseProbe.W = world;
    xi boat = new xi(W, 100.5, 64.0, -20.25);
    place(boat, 100.5, 64.0, -20.25, 90f, 0.125, 0.0, -0.25);
    yq zombie = new yq(W);
    place(zombie, 100.5, 63.7, -20.25, 90f, 0, 0, 0);
    run("zombie-on-boat", zombie, boat);
    xl cart = xl.a(W, 50.5, 70.0, 12.5, 0);
    place(cart, 50.5, 70.0, 12.5, 180f, 0.0, 0.0, 0.25);
    yl skeleton = new yl(W);
    place(skeleton, 50.5, 69.7, 12.5, 0f, 0, 0, 0);
    run("skeleton-on-cart", skeleton, cart);
    xl chest = xl.a(W, -10.5, 40.0, 3.5, 1);
    place(chest, -10.5, 40.0, 3.5, 0f, 0.0, 0.0, 0.0);
    yq zombie2 = new yq(W);
    place(zombie2, -10.5, 39.7, 3.5, 0f, 0, 0, 0);
    run("zombie-on-chest-cart", zombie2, chest);
    xi boat2 = new xi(W, 8.5, 62.0, 8.5);
    place(boat2, 8.5, 62.0, 8.5, 45f, 0, 0, 0);
    yn spider = new yn(W);
    place(spider, 8.5, 61.7, 8.5, 45f, 0, 0, 0);
    yl rider = new yl(W);
    place(rider, 8.5, 62.0, 8.5, 45f, 0, 0, 0);
    run("skeleton-on-spider-on-boat", rider, spider, boat2);
  }
}
