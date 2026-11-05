import java.lang.reflect.*;
import java.util.*;
import sun.misc.Unsafe;

// Minecraft Java 1.7.10 pumpkin/melon stems and the cake from the unchanged original classes: BlockStem (anu, ids 104 and 105),
// BlockCake (aju, id 92) and ItemReed (abi, item 354). The world is a map-backed ahb double that records block writes; java.util.Random
// subclasses record every nextInt roll so the browser port can replay them. Players are Unsafe-allocated EntityPlayerMP doubles with a
// real FoodStats. Output: one JSON object per line.
public final class StemCakeProbe {
  static Unsafe U;
  static Field field(Class<?> type,String name)throws Exception{for(Class<?> c=type;c!=null;c=c.getSuperclass())try{Field f=c.getDeclaredField(name);f.setAccessible(true);return f;}catch(NoSuchFieldException ignored){}throw new NoSuchFieldException(name);}
  static Unsafe unsafe()throws Exception{Field f=Unsafe.class.getDeclaredField("theUnsafe");f.setAccessible(true);return (Unsafe)f.get(null);}
  static class Rnd extends Random {
    List<String> rolls=new ArrayList<>();
    Rnd(long seed){super(seed);}
    public int nextInt(int bound){int n=super.nextInt(bound);rolls.add("["+bound+","+n+"]");return n;}
    public float nextFloat(){return .5f;}
  }
  // Stems whose seed drops are captured instead of spawned as entities.
  static class Stem extends anu {
    Stem(aji fruit){super(fruit);}
    protected void a(ahb w,int x,int y,int z,add s){((W)w).drops.add("["+adb.b(s.b())+","+s.b+"]");}
  }
  static class W extends ahb {
    Map<String,int[]> cells=new HashMap<>(); Map<Integer,aji> over=new HashMap<>(); List<String> writes=new ArrayList<>(); List<String> sounds=new ArrayList<>(); List<String> drops=new ArrayList<>();
    int light=15;
    W(){super((azc)null,null,(aqo)null,(ahj)null,null);}
    protected apu j(){return null;} protected int p(){return 0;}
    public sa a(int id){return null;}
    static String key(int x,int y,int z){return x+","+y+","+z;}
    int[] cell(int x,int y,int z){int[] c=cells.get(key(x,y,z));return c==null?new int[]{0,0}:c;}
    void put(int x,int y,int z,int id,int meta){cells.put(key(x,y,z),new int[]{id,meta});}
    public aji a(int x,int y,int z){int id=cell(x,y,z)[0];aji o=over.get(id);return o!=null?o:aji.e(id);}
    public int e(int x,int y,int z){return cell(x,y,z)[1];}
    public int k(int x,int y,int z){return light;}
    public boolean i(int x,int y,int z){return true;}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){
      aji old=a(x,y,z);int om=e(x,y,z);
      if(old==b&&om==meta)return false;
      writes.add(key(x,y,z)+","+aji.b(b)+","+meta);
      if(old!=b)old.a(this,x,y,z,old,om);
      put(x,y,z,aji.b(b),meta);
      if(old!=b)b.b(this,x,y,z);
      return true;
    }
    public boolean b(int x,int y,int z,aji b){return d(x,y,z,b,0,3);}
    public boolean f(int x,int y,int z){return d(x,y,z,aji.e(0),0,3);}
    public boolean a(int x,int y,int z,int meta,int flags){
      int[] c=cell(x,y,z);if(c[1]==meta)return false;
      writes.add(key(x,y,z)+","+c[0]+","+meta);
      put(x,y,z,c[0],meta);return true;
    }
    public boolean b(azt box){return true;}
    public boolean a(azt box,sa e){return true;}
    public List a(sa e,azt box){return new ArrayList();}
    public List b(sa e,azt box){return new ArrayList();}
    public List a(Class c,azt box){return new ArrayList();}
    public List a(sa e,azt box,sj s){return new ArrayList();}
    public void g(int x,int y,int z){}
    public void c(int x,int y,int z,aji b){}
    public void d(int x,int y,int z,aji b){}
    public void e(int x,int y,int z,aji b){}
    public void a(int x,int y,int z,aji b,int delay){}
    public void c(int t,int x,int y,int z,int d){}
    public void a(yz p,int t,int x,int y,int z,int d){}
    public boolean b(int a,int b,int c,int d,int e,int f){return true;}
    public void a(double x,double y,double z,String s,float v,float p){sounds.add(s);}
    public void a(double x,double y,double z,String s,float v,float p,boolean d){sounds.add(s);}
    public agy O(){return new agy();}
    public boolean d(sa e){return true;}
  }
  static W world(Rnd r)throws Exception{W w=(W)U.allocateInstance(W.class);w.cells=new HashMap<>();w.over=new HashMap<>();w.writes=new ArrayList<>();w.sounds=new ArrayList<>();w.drops=new ArrayList<>();w.light=15;
    field(ahb.class,"t").set(w,(aqo)U.allocateInstance(aqq.class));field(ahb.class,"s").set(w,r);return w;}
  static mw player(boolean creative,int food,float saturation)throws Exception{
    mw p=(mw)U.allocateInstance(mw.class);yw caps=new yw();caps.a=creative;caps.d=creative;caps.e=true;p.bE=caps;p.bm=new yx(p);
    zr stats=new zr();stats.a(food);stats.b(saturation);field(yz.class,"bp").set(p,stats);return p;}
  static String list(List<String> s){return"["+String.join(",",s)+"]";}
  static void emit(String json){System.out.println(json);}

  static final int FARM=60;
  static String bounds(aji b)throws Exception{StringBuilder s=new StringBuilder("[");String[] n={"B","C","D","E","F","G"};for(int i=0;i<6;i++){if(i>0)s.append(",");s.append(field(aji.class,n[i]).getDouble(b));}return s.append("]").toString();}
  static String box(azt a){return a==null?"null":"["+a.a+","+a.b+","+a.c+","+a.d+","+a.e+","+a.f+"]";}

  public static void main(String[] args)throws Exception{
    U=unsafe();aji.p();adb.l();
    int[] fruit={86,103};
    // Growth: the age, the growth-rate neighbourhood, the light and the fruit placement.
    String[] layouts={"alone","row","rowcol","diag"};
    for(int si=0;si<2;si++){
      int id=104+si;
      for(String layout:layouts)for(boolean wet:new boolean[]{false,true})for(int light:new int[]{15,8})for(int age=0;age<8;age++)for(int seed=0;seed<8;seed++){
        Rnd r=new Rnd(seed*7919L+3);W w=world(r);Stem stem=new Stem(aji.e(fruit[si]));w.over.put(id,stem);w.light=light;
        for(int dx=-2;dx<=2;dx++)for(int dz=-2;dz<=2;dz++)w.put(20+dx,39,20+dz,FARM,wet?7:0);
        w.put(20,40,20,id,age);
        if(layout.equals("row")||layout.equals("rowcol"))w.put(19,40,20,id,0);
        if(layout.equals("rowcol"))w.put(20,40,21,id,0);
        if(layout.equals("diag"))w.put(19,40,19,id,0);
        stem.a(w,20,40,20,r);
        emit("{\"case\":\"tick\",\"block\":"+id+",\"layout\":\""+layout+"\",\"wet\":"+wet+",\"light\":"+light+",\"age\":"+age+",\"seed\":"+(seed*7919L+3)+",\"rolls\":"+list(r.rolls)+",\"writes\":"+list(w.writes)+"}");
      }
      // Fruit placement: every ground block under the four target cells, a blocked cell, or an existing fruit.
      int[] grounds={FARM,3,2,1,12,0};
      String[] occupied={"none","west","fruit-east","west-and-north"};
      for(int ground:grounds)for(String occ:occupied)for(int seed=0;seed<16;seed++){
        Rnd r=new Rnd(seed);W w=world(r);Stem stem=new Stem(aji.e(fruit[si]));w.over.put(id,stem);
        for(int dx=-1;dx<=1;dx++)for(int dz=-1;dz<=1;dz++)w.put(20+dx,39,20+dz,dx==0&&dz==0?FARM:ground,7);
        w.put(20,40,20,id,7);
        if(occ.equals("west")||occ.equals("west-and-north"))w.put(19,40,20,1,0);
        if(occ.equals("west-and-north"))w.put(20,40,19,1,0);
        if(occ.equals("fruit-east"))w.put(21,40,20,fruit[si],0);
        stem.a(w,20,40,20,r);
        emit("{\"case\":\"fruit\",\"block\":"+id+",\"ground\":"+ground+",\"occupied\":\""+occ+"\",\"seed\":"+seed+",\"rolls\":"+list(r.rolls)+",\"writes\":"+list(w.writes)+"}");
      }
      // Bone meal: canFertilize, then the metadata after func_149853_b.
      for(int age=0;age<8;age++){
        W w0=world(new Rnd(0));Stem s0=new Stem(aji.e(fruit[si]));w0.over.put(id,s0);w0.put(20,40,20,id,age);
        boolean can=s0.a(w0,20,40,20,false);
        for(int seed=0;seed<16;seed++){
          Rnd r=new Rnd(seed);W w=world(r);Stem stem=new Stem(aji.e(fruit[si]));w.over.put(id,stem);w.put(20,40,20,id,age);
          stem.b(w,r,20,40,20);
          emit("{\"case\":\"bonemeal\",\"block\":"+id+",\"age\":"+age+",\"can\":"+can+",\"seed\":"+seed+",\"rolls\":"+list(r.rolls)+",\"writes\":"+list(w.writes)+"}");
        }
      }
      // Seed drops on break.
      for(int age=0;age<8;age++)for(int seed=0;seed<32;seed++){
        Rnd r=new Rnd(seed);W w=world(r);Stem stem=new Stem(aji.e(fruit[si]));w.over.put(id,stem);w.put(20,40,20,id,age);
        stem.a(w,20,40,20,age,1f,0);
        emit("{\"case\":\"drops\",\"block\":"+id+",\"age\":"+age+",\"seed\":"+seed+",\"rolls\":"+list(r.rolls)+",\"drops\":"+list(w.drops)+"}");
      }
      // Bounds, colour and the connected direction of the renderer (func_149873_e).
      String[] dirs={"none","west","east","north","south"};int[][] dd={{0,0},{-1,0},{1,0},{0,-1},{0,1}};
      for(int age=0;age<8;age++)for(int d=0;d<5;d++){
        W w=world(new Rnd(0));Stem stem=new Stem(aji.e(fruit[si]));w.over.put(id,stem);w.put(20,40,20,id,age);
        if(d>0)w.put(20+dd[d][0],40,20+dd[d][1],fruit[si],0);
        stem.a((ahl)w,20,40,20);
        emit("{\"case\":\"stem\",\"block\":"+id+",\"age\":"+age+",\"fruit\":\""+dirs[d]+"\",\"bounds\":"+bounds(stem)+",\"color\":"+stem.d((ahl)w,20,40,20)+",\"direction\":"+stem.e((ahl)w,20,40,20)+",\"collision\":"+box(stem.a(w,20,40,20))+"}");
      }
      // Neighbour change with the farmland gone or intact (BlockBush): pops and drops seeds by age.
      int[] belows={FARM,3,0};
      for(int below:belows)for(int age=0;age<8;age+=3)for(int seed=0;seed<4;seed++){
        Rnd r=new Rnd(seed);W w=world(r);Stem stem=new Stem(aji.e(fruit[si]));w.over.put(id,stem);w.put(20,39,20,below,0);w.put(20,40,20,id,age);
        stem.a(w,20,40,20,aji.e(0));
        emit("{\"case\":\"pop\",\"block\":"+id+",\"below\":"+below+",\"age\":"+age+",\"seed\":"+seed+",\"rolls\":"+list(r.rolls)+",\"writes\":"+list(w.writes)+",\"drops\":"+list(w.drops)+"}");
      }
    }
    // Cake: bounds per bite.
    aju cake=(aju)aji.e(92);
    for(int meta=0;meta<7;meta++){
      W w=world(new Rnd(0));w.put(0,64,0,92,meta);
      cake.a((ahl)w,0,64,0);
      emit("{\"case\":\"cake-bounds\",\"meta\":"+meta+",\"bounds\":"+bounds(cake)+",\"collision\":"+box(cake.a(w,0,64,0))+",\"selected\":"+box(cake.g(w,0,64,0))+"}");
    }
    // Eating: every food level, a few saturations, each bite, with and without Creative.
    for(boolean creative:new boolean[]{false,true})for(int food=0;food<=20;food++)for(float sat:new float[]{0f,1.5f,5f,20f})for(int meta=0;meta<7;meta++){
      W w=world(new Rnd(0));w.put(0,64,0,92,meta);mw p=player(creative,food,sat);
      boolean used=cake.a(w,0,64,0,p,1,0.5f,0.5f,0.5f);
      zr st=p.bQ();
      emit("{\"case\":\"eat\",\"creative\":"+creative+",\"food\":"+food+",\"saturation\":"+sat+",\"meta\":"+meta+",\"used\":"+used+",\"foodAfter\":"+st.a()+",\"saturationAfter\":"+st.e()+",\"writes\":"+list(w.writes)+"}");
    }
    // Support: the Material.isSolid of every block id, canBlockStay and canPlaceBlockAt of the cake above it.
    for(int id=0;id<=175;id++){
      aji b=aji.e(id);if(b==null||(id!=0&&b==aji.e(0)))continue;
      W w=world(new Rnd(0));w.put(0,63,0,id,0);w.put(0,64,0,92,0);
      boolean solid=b.o().b();
      emit("{\"case\":\"support\",\"id\":"+id+",\"solid\":"+solid+",\"stay\":"+cake.j(w,0,64,0)+"}");
      W w2=world(new Rnd(0));w2.put(0,63,0,id,0);
      emit("{\"case\":\"canplace\",\"id\":"+id+",\"can\":"+cake.c(w2,0,64,0)+"}");
    }
    // Neighbour change: the cake pops (no drop) when its support is gone.
    for(int below:new int[]{1,0,12,8,20,50,44}){
      W w=world(new Rnd(0));w.put(0,63,0,below,0);w.put(0,64,0,92,2);
      cake.a(w,0,64,0,aji.e(0));
      emit("{\"case\":\"cake-pop\",\"below\":"+below+",\"writes\":"+list(w.writes)+"}");
    }
    emit("{\"case\":\"cake-drop\",\"quantity\":"+cake.a(new Random(0))+",\"item\":"+(cake.a(0,new Random(0),0)==null?"null":"1")+"}");
    // ItemReed (item 354): onto the top of several blocks, in Survival and Creative.
    for(int ground:new int[]{1,3,2,12,20,8,50,44,78,0})for(boolean creative:new boolean[]{false,true}){
      W w=world(new Rnd(0));w.put(0,64,0,ground,0);mw p=player(creative,20,5f);
      add stack=new add(adb.d(354),1,0);
      boolean ok=stack.b().a(stack,p,w,0,64,0,1,0.5f,0.5f,0.5f);
      emit("{\"case\":\"place\",\"ground\":"+ground+",\"creative\":"+creative+",\"used\":"+ok+",\"count\":"+stack.b+",\"writes\":"+list(w.writes)+",\"sounds\":"+w.sounds.size()+"}");
    }
    emit("{\"case\":\"items\",\"cakeStack\":"+adb.d(354).d()+",\"cakeIsReed\":"+(adb.d(354) instanceof abi)+",\"milkContainer\":"+adb.b(adb.d(335).t())+"}");
  }
}
