// Batch 84 (rain84): a burning primed TNT (xw) and a burning minecart (xs) in rain. The unchanged Entity.moveEntity tail (sa.d: ++fire in a fire cell unless sa.L, the wet fizz and the -fireResistance rest),
// EntityTNTPrimed.onUpdate and EntityMinecart.onUpdate on the FireworkCollideProbe world double. The double's canLightningStrikeAt (ahb.y) is replaced by the rain condition on its cell map: `rain` is on and
// no cell above is solid (a roof block puts the column in cover); everything else is the jar's code. `playSoundAtEntity` (ahb.a(sa, String, F, F)) is logged with the entity's feet, posY - yOffset
// (sa.t - sa.L, the bytecode-read formula of that method). Each record: the per-tick rows [tick, rain, fire, posY, boxMinY, onGround, soundsThisTick..] with the fizz as [name, volume, pitch, x, feetY, z].
import java.lang.reflect.Field;
import java.util.*;

public class RainFireProbe extends FireworkCollideProbe {
  static boolean rain = false;
  static int FIRE_Y = Integer.getInteger("fireY", 63); // the entities rest in cell 63 on this double (box bottom 63.0)
  static List<String> tickSounds = new ArrayList<>();

  static class RW extends FW {
    RW() { super(); }
    public boolean y(int x, int y, int z) {
      if (!rain) return false;
      for (int k = y + 1; k < 256; k++) if (cell(x, k, z)[0] != 0 && cell(x, k, z)[0] != 51) return false;
      return true;
    }
    public boolean d(sa e) { return true; } // spawnEntityInWorld: a broken cart's drop goes nowhere
    public List b(sa e, azt box) { return new ArrayList(); } // getEntitiesWithinAABBExcludingEntity (EntityMinecart.onUpdate's push of nearby entities): none here
    public void a(sa e, String name, float vol, float pitch) {
      tickSounds.add("[\"" + name + "\"," + vol + "," + pitch + "," + e.s + "," + (e.t - (double) e.L) + "," + e.u + "]");
    }
  }

  static int fireOf(sa e) throws Exception { Field f = sa.class.getDeclaredField("e"); f.setAccessible(true); return f.getInt(e); } // Entity.fire (xl declares its own `e`)

  static void setup() throws Exception {
    init();
    world = (PWorld) U.allocateInstance(RW.class);
    set(world, "s", new Random(7));
    set(world, "t", U.allocateInstance(aqq.class));
    set(world, "C", new qi());
    world.E = false;
  }

  // kind: "tnt" or "cart". Events by tick (1-based, applied before that tick runs): fireAt, rainAt, roofAt (0 = never).
  static void scenario(String name, String kind, int fireAt, int rainAt, int roofAt, int ticks) throws Exception { scenario(name, kind, fireAt, 0, rainAt, roofAt, ticks); }
  static void scenario(String name, String kind, int fireAt, int fireOff, int rainAt, int roofAt, int ticks) throws Exception {
    cells.clear(); rain = false; tickSounds.clear(); sparkCalls.clear(); sounds.clear();
    sa e;
    if (kind.equals("tnt")) {
      xw t = new xw(world, 10.5, 64.49, 10.5, null); // posY = box bottom + 0.49: the box rests on the stone floor at 64
      t.v = 0; t.w = 0; t.x = 0; // the constructor's random throw
      e = t;
    } else {
      e = new xs(world, 10.5, 64.0, 10.5);
    }
    StringBuilder rows = new StringBuilder();
    for (int tick = 1; tick <= ticks; tick++) {
      if (tick == fireAt) put(10, FIRE_Y, 10, 51, 0);
      if (tick == fireOff) put(10, FIRE_Y, 10, 0, 0); // the fire burns out: a cart in it for long takes inFire damage 1 a tick (damage +10) and breaks on the fifth
      if (tick == roofAt) put(10, 70, 10, 1, 0);
      if (tick == rainAt) rain = true;
      tickSounds.clear();
      e.h();
      rows.append(tick > 1 ? "," : "").append("[").append(tick).append(",").append(rain ? 1 : 0).append(",").append(fireOf(e)).append(",").append(e.t).append(",").append(e.C.b).append(",")
        .append(e.D ? 1 : 0).append(",[").append(String.join(",", tickSounds)).append("]]");
    }
    System.out.println("{\"name\":" + q(name) + ",\"kind\":" + q(kind) + ",\"fireAt\":" + fireAt + ",\"fireOff\":" + fireOff + ",\"rainAt\":" + rainAt + ",\"roofAt\":" + roofAt + ",\"start\":[10.5," + (kind.equals("tnt") ? 64.49 : 64.0) + ",10.5],\"rows\":[" + rows + "]}");
  }

  public static void main(String[] args) throws Exception {
    setup();
    for (String kind : new String[] { "tnt", "cart" }) {
      int off = kind.equals("cart") ? 5 : 0; // a cart is in the fire for one tick (fire at 4, out at 5); the TNT stays in it
      scenario(kind + "-fire-then-rain", kind, 4, off, 8, 0, 16);   // burns from tick 4 (settled counter -1 -> 0 -> setFire 160), rain from tick 8
      scenario(kind + "-rain-then-fire", kind, 6, off == 0 ? 0 : 7, 2, 0, 16);   // rain first: the wet entity takes no ++fire in the fire cell
      scenario(kind + "-roofed", kind, 4, off, 8, 1, 16);           // a roof block above: rain does not reach it, it keeps burning
      scenario(kind + "-dry-fire", kind, 4, off, 0, 0, 16);         // no rain at all
    }
  }
}
