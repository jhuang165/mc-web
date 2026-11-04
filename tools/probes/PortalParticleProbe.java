import java.lang.reflect.Field;
import java.util.Random;

// Unchanged EntityPortalFX with the existing headless FX world/Tessellator harness.
public class PortalParticleProbe extends FxProbe {
  static String draws(bkt p) throws Exception {
    StringBuilder out = new StringBuilder();
    for (float partial : new float[]{0, 0.5F, 1}) for (int light : new int[]{0, 0x500020, 0xF000F0}) {
      drawLight = light;
      draw(p, partial, new float[]{1, 0, 0, 0, 1});
      if (out.length() > 0) out.append(',');
      out.append("{\"age\":"+i(p,"f")+",\"partial\":"+partial+",\"packed\":"+light+",\"scale\":"+(double)fl(p,"h")+",\"light\":"+p.c(partial)+"}");
    }
    return out.toString();
  }
  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); U=(sun.misc.Unsafe)uf.get(null);
    seedField=Random.class.getDeclaredField("seed"); seedField.setAccessible(true);
    Math.random(); Field holder=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator"); holder.setAccessible(true); mathRandom=(Random)holder.get(null);
    aji.p(); FW w=(FW)U.allocateInstance(FW.class); set(w,"s",new Random(0)); set(w,"t",U.allocateInstance(aqq.class)); set(w,"C",new qi()); w.E=true;
    for (int c=0;c<8;c++) {
      mathRandom.setSeed(9123+c); long math=raw(mathRandom);
      double[] input={10.5,65.25,10.5, c==0?0:0.125*c, c%2==0?0:-0.25, -0.1*c};
      bkt p=new bkt(w,input[0],input[1],input[2],input[3],input[4],input[5]);
      Random rand=(Random)get(p,"Z"); long entityAfter=raw(rand),mathAfter=raw(mathRandom);
      String init=spawn(p); init="{\"seed\":"+back(entityAfter,6)+init.substring(init.indexOf(",\"x\""));
      StringBuilder track=new StringBuilder(),render=new StringBuilder(draws(p));
      int max=i(p,"g");
      for(int t=0;t<60&&!p.K;t++) {
        p.h(); if(track.length()>0)track.append(','); track.append(state(p));
        if(i(p,"f")==1||i(p,"f")==max/2||p.K)render.append(',').append(draws(p));
      }
      System.out.println("{\"case\":"+c+",\"math\":"+math+",\"mathAfter\":"+mathAfter+",\"entityAfter\":"+entityAfter+",\"args\":["+input[0]+","+input[1]+","+input[2]+","+input[3]+","+input[4]+","+input[5]+"],\"initial\":"+init+",\"noClip\":"+p.X+",\"tracks\":["+track+"],\"draws\":["+render+"]}");
    }
  }
}
