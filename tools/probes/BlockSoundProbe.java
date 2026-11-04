import java.lang.reflect.*;
import java.util.*;

// Block.SoundType (ajm) of every registered Block of Minecraft Java 1.7.10, read from the unchanged original classes after
// Block.registerBlocks: the stepSound field (aji.H) of each block compared by identity against the twelve static
// Block.soundType* fields (aji.e-p, names from joined-1.7.10.srg field_1497..._e..p in declaration order: Stone, Wood,
// Gravel, Grass, Piston, Metal, Glass, Cloth, Sand, Snow, Ladder, Anvil), and the SoundType accessors getBreakSound a(),
// getStepResourcePath e(), func_150496_b (place) b(), getVolume c() and getFrequency d(). Also prints the type table.
public class BlockSoundProbe {
  static final String[] FIELDS = {"e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p"};
  static final String[] NAMES = {"soundTypeStone", "soundTypeWood", "soundTypeGravel", "soundTypeGrass", "soundTypePiston", "soundTypeMetal", "soundTypeGlass", "soundTypeCloth", "soundTypeSand", "soundTypeSnow", "soundTypeLadder", "soundTypeAnvil"};

  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static String describe(ajm s) {
    return "\"class\":" + q(s.getClass().getName()) + ",\"name\":" + q(s.a) + ",\"volume\":" + s.c() + ",\"frequency\":" + s.d()
      + ",\"break\":" + q(s.a()) + ",\"step\":" + q(s.e()) + ",\"place\":" + q(s.b());
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    ajm[] types = new ajm[FIELDS.length];
    StringBuilder table = new StringBuilder();
    for (int i = 0; i < FIELDS.length; i++) {
      Field f = aji.class.getDeclaredField(FIELDS[i]);
      f.setAccessible(true);
      types[i] = (ajm) f.get(null);
      table.append(i == 0 ? "" : ",").append("{\"field\":").append(q(NAMES[i])).append(",\"obf\":").append(q(FIELDS[i])).append(",").append(describe(types[i])).append("}");
    }
    System.out.println("{\"kind\":\"types\",\"types\":[" + table + "]}");
    for (int id = 0; id < 4096; id++) {
      aji b = aji.e(id);
      if (b == null || (id != 0 && aji.b(b) != id)) continue;
      ajm s = b.H;
      int hit = -1;
      for (int i = 0; i < types.length; i++) if (types[i] == s) hit = i;
      System.out.println("{\"kind\":\"block\",\"id\":" + id + ",\"blockClass\":" + q(b.getClass().getName()) + ",\"type\":" + (hit < 0 ? "null" : q(NAMES[hit])) + "," + describe(s) + "}");
    }
  }
}
