import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.*;

// Unchanged crop/food implementations, with a tiny world and captured drops.
public class CropProbe {
  static class Rnd extends Random {
    List<String> rolls=new ArrayList<>();
    Rnd(long seed){super(seed);}
    public int nextInt(int bound){int n=super.nextInt(bound);rolls.add("["+bound+","+n+"]");return n;}
    // Drop chance is always 1 here. Separate float draws from integer harvest rolls.
    public float nextFloat(){return .5f;}
  }
  public static class W extends ahb {
    aji crop; int age,light=15; boolean mixed;
    List<String> drops=new ArrayList<>();
    W(){super((azc)null,null,(aqo)null,(ahj)null,null);}
    protected apu j(){return null;} protected int p(){return 0;}
    public sa a(int id){return null;}
    public aji a(int x,int y,int z){
      if(y==39)return aji.e(60);
      if(y==40&&Math.abs(x-20)<=1&&Math.abs(z-20)<=1)return x==20&&z==20?crop:mixed?aji.e(59):crop;
      return aji.e(0);
    }
    public int e(int x,int y,int z){return y==39?7:age;}
    public int k(int x,int y,int z){return light;}
    public boolean i(int x,int y,int z){return true;}
    public boolean a(int x,int y,int z,int m,int flags){age=m;return true;}
  }
  public static class Carrot extends ajv {
    protected void a(ahb w,int x,int y,int z,add s){((W)w).drops.add("["+adb.b(s.b())+","+s.b+"]");}
  }
  public static class Potato extends amr {
    protected void a(ahb w,int x,int y,int z,add s){((W)w).drops.add("["+adb.b(s.b())+","+s.b+"]");}
  }
  static sun.misc.Unsafe unsafe()throws Exception{Field f=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");f.setAccessible(true);return(sun.misc.Unsafe)f.get(null);}
  static String list(List<String> s){return"["+String.join(",",s)+"]";}
  public static void main(String[]args)throws Exception{
    aji.p();adb.l();sun.misc.Unsafe u=unsafe();
    for(int id:new int[]{141,142}){
      akf block=id==141?new Carrot():new Potato();
      W w=(W)u.allocateInstance(W.class);w.crop=block;w.light=15;w.drops=new ArrayList<>();
      for(int age=0;age<8;age++)for(int seed=0;seed<256;seed++){
        Rnd r=new Rnd(seed*2654435761L);w.s=r;w.drops.clear();w.age=age;
        block.a(w,20,40,20,age,1f,0);
        System.out.println("{\"case\":\"drops\",\"block\":"+id+",\"age\":"+age+",\"rolls\":"+list(r.rolls)+",\"drops\":"+list(w.drops)+"}");
      }
      List<rf> icons=new ArrayList<>();
      block.a((rg)name->{rf icon=(rf)Proxy.newProxyInstance(rf.class.getClassLoader(),new Class[]{rf.class},(p,m,a)->m.getName().equals("g")?name:m.getName().equals("equals")?p==a[0]:m.getReturnType()==int.class?0:0f);icons.add(icon);return icon;});
      List<String> stages=new ArrayList<>();
      for(int age=0;age<8;age++){rf face=block.a(0,age);int index=0;while(icons.get(index)!=face)index++;stages.add(""+index);}
      System.out.println("{\"case\":\"icons\",\"block\":"+id+",\"stages\":"+list(stages)+"}");
      for(boolean mixed:new boolean[]{false,true})for(int age=0;age<8;age++)for(int seed=0;seed<16;seed++){
        w.mixed=mixed;w.age=age;w.s=new Rnd(seed);block.a(w,20,40,20,w.s);
        System.out.println("{\"case\":\"growth\",\"block\":"+id+",\"age\":"+age+",\"mixed\":"+mixed+",\"after\":"+w.age+",\"rolls\":"+list(((Rnd)w.s).rolls)+"}");
      }
      for(int age=0;age<8;age++)for(int seed=0;seed<4;seed++){
        w.age=age;w.s=new Rnd(seed);block.b(w,w.s,20,40,20);
        System.out.println("{\"case\":\"bonemeal\",\"block\":"+id+",\"age\":"+age+",\"after\":"+w.age+",\"rolls\":"+list(((Rnd)w.s).rolls)+"}");
      }
    }
    for(int id:new int[]{391,392,393,394}){
      acx food=(acx)adb.d(id);add stack=new add(food);
      System.out.println("{\"case\":\"food\",\"id\":"+id+",\"food\":"+food.g(stack)+",\"saturation\":"+food.h(stack)+",\"xp\":"+afa.a().b(stack)+"}");
    }
    wo pig=new wo(null);
    for(int id:new int[]{295,296,391,392,393})System.out.println("{\"case\":\"pig\",\"id\":"+id+",\"breeds\":"+pig.c(new add(adb.d(id)))+"}");
  }
}
