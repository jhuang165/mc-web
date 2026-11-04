import java.lang.reflect.*;
import java.util.*;

// Damage effects of Minecraft Java 1.7.10 read from the unchanged original classes:
//  - MathHelper.sin (qh.a) of the hurtCameraEffect argument ((hurtTime - p) / maxHurtTime)^4 * PI for hurtTime 1..10 and
//    partial ticks 0, 0.25, 0.5, 0.75, 1 (the roll is -sin * 14 degrees), and the death roll 40 - 8000 / (deathTime + p + 200);
//  - EntityLivingBase.func_146067_o (sv.o(int)) of EntityPlayerMP (mw), EntityZombie (yq, an EntityMob) and EntityPig (wo)
//    for 1..8 damage points (the fall sound name);
//  - the fall damage ceiling_float_int(distance - 3 - jumpBoost) via MathHelper.f(F) for a table of distances and levels;
//  - the heart-blink schedule hurtResistantTime / 3 % 2 == 1 && >= 10 for hurtResistantTime 0..20.
// The instances are allocated without constructors (Unsafe), because o(int) reads no field.
public class DamageFxProbe {
  static String q(String s) { return "\"" + s + "\""; }
  static Object blank(Class<?> c) throws Exception {
    Field u = Class.forName("sun.misc.Unsafe").getDeclaredField("theUnsafe");
    u.setAccessible(true);
    Object unsafe = u.get(null);
    return unsafe.getClass().getMethod("allocateInstance", Class.class).invoke(unsafe, c);
  }
  static String fallSound(Class<?> c, int points) throws Exception {
    Method m = sv.class.getDeclaredMethod("o", int.class);
    m.setAccessible(true);
    return (String) m.invoke(blank(c), points);
  }
  public static void main(String[] args) throws Exception {
    StringBuilder camera = new StringBuilder();
    for (int t = 1; t <= 10; t++) for (int pi = 0; pi <= 4; pi++) {
      float p = pi / 4.0F, f1 = (float) t - p;
      f1 /= (float) 10;
      float s = qh.a(f1 * f1 * f1 * f1 * 3.1415927F);
      camera.append(camera.length() == 0 ? "" : ",").append("{\"hurtTime\":" + t + ",\"partial\":" + p + ",\"roll\":" + (-s * 14.0F) + "}");
    }
    StringBuilder death = new StringBuilder();
    for (int d = 0; d <= 20; d += 4) for (int pi = 0; pi <= 2; pi++) {
      float p = pi / 2.0F, f2 = (float) d + p;
      death.append(death.length() == 0 ? "" : ",").append("{\"deathTime\":" + d + ",\"partial\":" + p + ",\"roll\":" + (40.0F - 8000.0F / (f2 + 200.0F)) + "}");
    }
    StringBuilder sounds = new StringBuilder();
    Class<?>[] kinds = {mw.class, yq.class, wo.class};
    String[] names = {"player", "mob", "animal"};
    for (int k = 0; k < kinds.length; k++) for (int pts = 1; pts <= 8; pts++)
      sounds.append(sounds.length() == 0 ? "" : ",").append("{\"entity\":" + q(names[k]) + ",\"points\":" + pts + ",\"sound\":" + q(fallSound(kinds[k], pts)) + "}");
    StringBuilder falls = new StringBuilder();
    float[] distances = {0.5F, 2.9F, 3.0F, 3.01F, 3.5F, 4.0F, 4.5F, 5.0F, 6.2F, 7.99F, 8.0F, 10.0F, 20.0F, 100.0F};
    for (float dist : distances) for (int boost = 0; boost <= 3; boost++) {
      float f1 = boost == 0 ? 0.0F : (float) boost; // amplifier + 1
      falls.append(falls.length() == 0 ? "" : ",").append("{\"distance\":" + dist + ",\"jumpLevel\":" + boost + ",\"points\":" + qh.f(dist - 3.0F - f1) + "}");
    }
    StringBuilder blink = new StringBuilder();
    for (int r = 0; r <= 20; r++) blink.append(blink.length() == 0 ? "" : ",").append("{\"hurtResistantTime\":" + r + ",\"blink\":" + (r / 3 % 2 == 1 && r >= 10) + "}");
    System.out.println("{\"camera\":[" + camera + "],\"death\":[" + death + "],\"fallSounds\":[" + sounds + "],\"fallPoints\":[" + falls + "],\"blink\":[" + blink + "]}");
  }
}
