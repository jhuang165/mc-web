import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// More player mounts than PlayerRidingProbe covers, through its own run() (Entity.mountEntity, Entity.writeToNBT with the nested Riding compound, the
// EntityList.createEntityFromNBT load replay): a cow, a spider, a zombie, a chicken and the furnace, TNT and hopper minecarts. Every record is a
// `playerRiding` line in PlayerRidingProbe's format; the Riding compound of each carries Entity.writeToNBT's UUIDMost/UUIDLeast.
public class InterchangeMountProbe {
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    LevelDatProbe.u = u;
    LevelDatProbe.W W = (LevelDatProbe.W) u.allocateInstance(LevelDatProbe.W.class);
    PlayerRidingProbe.W = W;
    MobMoveProbe.set(W, "s", new Random(2));
    MobMoveProbe.set(W, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(W, new ArrayList()); }
    MobMoveProbe.set(W, "t", u.allocateInstance(aqq.class));
    ays worldInfo = new ays(new ahj(17L, ahk.b, true, false, ahm.b), "Probe");
    worldInfo.a(8, 64, 8);
    MobMoveProbe.field(ahb.class, "x").set(W, worldInfo);
    LevelDatProbe.world = W;

    sw[] mobs = { new wh(W), new yn(W), new yq(W), new wg(W) };
    String[] kinds = { "cow", "spider", "zombie", "chicken" };
    for (int i = 0; i < mobs.length; i++) {
      PlayerRidingProbe.place(mobs[i], 20.5 + i, 65.0, -4.5, 45f * i, 0, 0, 0);
      PlayerRidingProbe.run(kinds[i], mobs[i], false);
    }
    int[] types = { 2, 3, 5 };
    String[] cartKinds = { "furnace-cart", "tnt-cart", "hopper-cart" };
    for (int i = 0; i < types.length; i++) {
      xl cart = xl.a(W, 30.5 + i, 70.0, 12.5, types[i]);
      PlayerRidingProbe.place(cart, 30.5 + i, 70.0, 12.5, 90f * i, 0.0, 0.0, 0.125);
      PlayerRidingProbe.run(cartKinds[i], cart, false);
    }
  }
}
