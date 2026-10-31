import java.lang.reflect.*;
import java.util.*;

// Runs unchanged ItemFood, Potion, PotionEffect and milk methods. Only damage,
// exhaustion and effect delivery are captured on the minimal player test double.
public class EffectProbe {
  public static class W extends ahb {
    W(){super((azc)null,null,(aqo)null,(ahj)null,null);}
    protected apu j(){return null;} protected int p(){return 0;}
    public sa a(int id){return null;}
  }
  public static class P extends yz {
    float exhaustion; int hits; rw received; boolean cleared;
    P(){super(null,null);}
    public void a(fj message){}
    public boolean a(int level,String command){return false;}
    public r f_(){return new r(0,0,0);}
    void init(float health){af=new te(this);af.a(6,Float.valueOf(health));bE=new yw();}
    public void g(float health){af.b(6,Float.valueOf(health));}
    public boolean a(ro source,float amount){hits++;g(aS()-amount);return true;}
    public void a(float amount){exhaustion+=amount;}
    public void c(rw effect){received=effect;}
    public void aP(){cleared=true;}
  }
  static sun.misc.Unsafe unsafe()throws Exception{Field f=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");f.setAccessible(true);return(sun.misc.Unsafe)f.get(null);}
  public static void main(String[] args)throws Exception{
    aji.p();adb.l();sun.misc.Unsafe u=unsafe();
    W w=(W)u.allocateInstance(W.class);
    Method food=acx.class.getDeclaredMethod("c",add.class,ahb.class,yz.class);food.setAccessible(true);
    for(int id:new int[]{365,367,394,391})for(float roll:new float[]{0f,.29999998f,.3f,.59999996f,.6f,.79999995f,.8f,.999f}){
      P p=(P)u.allocateInstance(P.class);p.init(20);
      final float value=roll;w.s=new Random(){public float nextFloat(){return value;}};
      food.invoke(adb.d(id),new add(adb.d(id)),w,p);rw e=p.received;
      System.out.println("{\"case\":\"food\",\"item\":"+id+",\"roll\":"+roll+",\"effect\":"+(e==null?"null":"["+e.a()+","+e.b()+","+e.c()+"]")+"}");
    }
    for(int id:new int[]{17,19})for(int amp:new int[]{0,1,4,5})for(int duration:new int[]{1,24,25,26,100,600}){
      P p=(P)u.allocateInstance(P.class);p.init(20);rw e=new rw(id,duration,amp);
      List<Integer> hits=new ArrayList<>();
      for(int tick=0;tick<duration;tick++){int before=p.hits;e.a(p);if(p.hits>before)hits.add(tick);}
      System.out.println("{\"case\":\"ticks\",\"id\":"+id+",\"amplifier\":"+amp+",\"duration\":"+duration+",\"health\":"+p.aS()+",\"exhaustion\":"+p.exhaustion+",\"hits\":"+hits+",\"remaining\":"+e.b()+"}");
    }
    for(int oldAmp:new int[]{0,1,3})for(int newAmp:new int[]{0,1,3})for(int duration:new int[]{20,100,200}){
      rw e=new rw(19,100,oldAmp);e.a(new rw(19,duration,newAmp));
      System.out.println("{\"case\":\"combine\",\"oldAmplifier\":"+oldAmp+",\"newAmplifier\":"+newAmp+",\"duration\":"+duration+",\"after\":["+e.b()+","+e.c()+"]}");
    }
    for(boolean creative:new boolean[]{false,true}){
      P p=(P)u.allocateInstance(P.class);p.init(20);p.bE.d=creative;
      add result=adb.d(335).b(new add(adb.d(335)),w,p);
      System.out.println("{\"case\":\"milk\",\"creative\":"+creative+",\"cleared\":"+p.cleared+",\"item\":"+adb.b(result.b())+",\"count\":"+result.b+"}");
    }
  }
}
