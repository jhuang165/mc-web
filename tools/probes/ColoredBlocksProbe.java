import java.lang.reflect.*;
import java.util.*;
import sun.misc.Unsafe;

// Executes the unchanged 1.7.10 BlockStainedGlass (anq), BlockStainedGlassPane (anr), BlockCarpet (aop),
// BlockHay (alm), BlockCompressed (alz), BlockSponge (anp), BlockPumpkin (amw), ItemCloth (aek)/ItemBlock (abh),
// CraftingManager (afe), the TileEntityFurnace fuel table (apg) and the BlockFire tables (alb) against a
// map-backed World double (no constructor runs) and an Unsafe-allocated EntityPlayerMP double.
public final class ColoredBlocksProbe {
  static Unsafe U;
  static Field field(Class<?> type,String name)throws Exception{for(Class<?> c=type;c!=null;c=c.getSuperclass())try{Field f=c.getDeclaredField(name);f.setAccessible(true);return f;}catch(NoSuchFieldException ignored){}throw new NoSuchFieldException(name);}
  static Unsafe unsafe()throws Exception{Field f=Unsafe.class.getDeclaredField("theUnsafe");f.setAccessible(true);return (Unsafe)f.get(null);}

  static class W extends ahb {
    Map<String,int[]> cells=new HashMap<>(); List<String> writes=new ArrayList<>(); List<String> sounds=new ArrayList<>(); List<add> spawned=new ArrayList<>();
    W(){super((azc)null,null,(aqo)null,(ahj)null,null);}
    protected apu j(){return null;} protected int p(){return 0;}
    public sa a(int id){return null;}
    static String key(int x,int y,int z){return x+","+y+","+z;}
    int[] cell(int x,int y,int z){int[] c=cells.get(key(x,y,z));return c==null?new int[]{0,0}:c;}
    void put(int x,int y,int z,int id,int meta){cells.put(key(x,y,z),new int[]{id,meta});}
    public aji a(int x,int y,int z){return aji.e(cell(x,y,z)[0]);}
    public int e(int x,int y,int z){return cell(x,y,z)[1];}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){put(x,y,z,aji.b(b),meta);writes.add(key(x,y,z)+","+aji.b(b)+","+meta);return true;}
    public boolean f(int x,int y,int z){return d(x,y,z,aji.e(0),0,3);}
    public boolean a(int x,int y,int z,int meta,int flags){put(x,y,z,cell(x,y,z)[0],meta);writes.add(key(x,y,z)+","+cell(x,y,z)[0]+","+meta);return true;}
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
    public boolean b(int a,int b,int c,int d,int e,int f){return true;}
    public void a(double x,double y,double z,String s,float v,float p){sounds.add(s);}
    public void a(double x,double y,double z,String s,float v,float p,boolean d){sounds.add(s);}
    public agy O(){return new agy();}
    public boolean d(sa e){if(e instanceof xk)spawned.add(((xk)e).f());return true;}
  }
  static W world()throws Exception{W w=(W)U.allocateInstance(W.class);w.cells=new HashMap<>();w.writes=new ArrayList<>();w.sounds=new ArrayList<>();w.spawned=new ArrayList<>();field(ahb.class,"t").set(w,(aqo)U.allocateInstance(aqq.class));field(ahb.class,"s").set(w,new Random(7));return w;}
  static mw player(float yaw,boolean creative)throws Exception{
    mw p=(mw)U.allocateInstance(mw.class);yw caps=new yw();caps.d=creative;p.bE=caps;p.bm=new yx(p);field(sa.class,"y").setFloat(p,yaw);return p;}
  static adb item(int id){return adb.d(id);}
  static String stackJson(add s){return s==null?"null":"["+adb.b(s.b())+","+s.b+","+s.k()+"]";}
  static String q(String s){return "\""+s+"\"";}
  static String list(List<String> l){StringBuilder b=new StringBuilder("[");for(int i=0;i<l.size();i++){if(i>0)b.append(',');b.append(q(l.get(i)));}return b.append(']').toString();}
  static String num(double d){return d==Math.rint(d)&&Math.abs(d)<1e9?Long.toString((long)d):Double.toString(d);}
  static String box(azt b){return b==null?"null":"["+num(b.a)+","+num(b.b)+","+num(b.c)+","+num(b.d)+","+num(b.e)+","+num(b.f)+"]";}
  static String bounds(aji b)throws Exception{
    return "["+num(field(aji.class,"B").getDouble(b))+","+num(field(aji.class,"C").getDouble(b))+","+num(field(aji.class,"D").getDouble(b))+","+num(field(aji.class,"E").getDouble(b))+","+num(field(aji.class,"F").getDouble(b))+","+num(field(aji.class,"G").getDouble(b))+"]";}
  static aji block(int id){return aji.e(id);}
  static final int[] IDS={95,160,171,170,173,22,133,19,91,86};
  static final Set<Integer> MINE=new HashSet<>(Arrays.asList(95,160,171,170,173,22,133,19,91));

  static String blockProps(int id)throws Exception{
    aji b=block(id);W w=world();
    awt m=b.o();
    boolean silk=false;
    try{Method e=null;for(Class<?> c=b.getClass();c!=null&&e==null;c=c.getSuperclass())try{e=c.getDeclaredMethod("E");}catch(NoSuchMethodException ignored){}e.setAccessible(true);silk=(Boolean)e.invoke(b);}catch(Throwable t){}
    return "{\"kind\":\"block\",\"id\":"+id+",\"class\":"+q(b.getClass().getName())+",\"super\":"+q(b.getClass().getSuperclass().getName())+",\"renderType\":"+b.b()+",\"renderLayer\":"+b.w()+",\"opaque\":"+b.c()+",\"renderNormal\":"+b.d()
      +",\"hardness\":"+num(b.f(w,0,0,0))+",\"resistanceField\":"+num(field(aji.class,"w").getFloat(b))+",\"explosionResistance\":"+num(b.a((sa)null))
      +",\"lightOpacity\":"+field(aji.class,"r").getInt(b)+",\"lightValue\":"+field(aji.class,"t").getInt(b)+",\"silkHarvest\":"+silk
      +",\"stepSound\":"+q(b.H.b())+",\"stepVolume\":"+num(b.H.c())+",\"stepPitch\":"+num(b.H.d())
      +",\"material\":{\"solid\":"+m.a()+",\"liquid\":"+m.d()+",\"opaque\":"+m.c()+",\"requiresTool\":"+m.l()+",\"replaceable\":"+m.j()+",\"flammable\":"+m.h()+",\"mobility\":"+m.m()+"}}";
  }
  static String metaRow(int id,int meta)throws Exception{
    aji b=block(id);W w=world();w.put(0,0,0,id,meta);Random r=new Random(1);
    b.a((ahl)w,0,0,0);
    String bnd=bounds(b);
    List<azt> boxes=new ArrayList<>();azt mask=azt.a(-8,-8,-8,8,8,8);b.a(w,0,0,0,mask,boxes,(sa)null);
    StringBuilder col=new StringBuilder("[");for(int i=0;i<boxes.size();i++){if(i>0)col.append(',');col.append(box(boxes.get(i)));}col.append(']');
    azt sel=b.g(w,0,0,0);
    adb dropped=b.a(meta,r,0);
    return "{\"kind\":\"meta\",\"id\":"+id+",\"meta\":"+meta+",\"bounds\":"+bnd+",\"collision\":"+col+",\"selection\":"+box(sel)
      +",\"damageDropped\":"+b.a(meta)+",\"quantity\":"+b.a(r)+",\"item\":"+(dropped==null?-1:adb.b(dropped))+",\"pick\":"+stackJson(b.d(w,0,0,0)!=null?new add(b.d(w,0,0,0),1,b.k(w,0,0,0)):null)+"}";
  }
  static void fillFloor(W w){for(int x=-4;x<=4;x++)for(int z=-4;z<=4;z++)w.put(x,63,z,1,0);}
  static String useItem(W w,add stack,mw p,int x,int y,int z,int side,float hx,float hy,float hz)throws Exception{
    w.writes.clear();w.sounds.clear();
    boolean ok=stack.b().a(stack,p,w,x,y,z,side,hx,hy,hz);
    return ok+","+stack.b+","+list(w.writes)+","+w.sounds.size();
  }
  static void harvestRows(List<String> out)throws Exception{
    int[] tools={-1,269,270,271,272,274,257,278,359,268};
    for(int id:IDS)for(int t:tools){
      aji b=block(id);add st=t<0?null:new add(item(t),1,0);
      float str=t<0?1.0F:item(t).a(st,b);
      boolean can=t<0?false:item(t).b(b);
      out.add("{\"kind\":\"harvest\",\"id\":"+id+",\"tool\":"+t+",\"strength\":"+num(str)+",\"toolCanHarvest\":"+can+"}");
    }
  }
  static void placeRows(List<String> out)throws Exception{
    int[] one={0};
    for(int id:IDS){
      adb it=adb.a(block(id));
      boolean damaged=id==95||id==160||id==171;
      for(int dmg=0;dmg<(damaged?16:1);dmg++)for(int side=0;side<6;side++){
        W w=world();fillFloor(w);w.put(0,64,0,1,0);w.put(0,62,0,1,0);mw p=player(0,false);add st=new add(it,1,dmg);
        int[] pos=side==0?new int[]{0,64,0}:new int[]{0,64,0};
        // click the stone block at (0,64,0) from each side; the placement cell is adjacent to it.
        String res=useItem(w,st,p,0,64,0,side,0.5F,0.5F,0.5F);
        out.add("{\"kind\":\"placed\",\"id\":"+id+",\"damage\":"+dmg+",\"itemId\":"+adb.b(it)+",\"side\":"+side+",\"result\":["+res+"]}");
      }
    }
    // Yaw sweep (pumpkin, jack o'lantern) and hay side sweep with and without support.
    for(int id:new int[]{86,91})for(int yaw=-720;yaw<=720;yaw+=15){
      W w=world();fillFloor(w);mw p=player(yaw,false);add st=new add(adb.a(block(id)),1,0);
      out.add("{\"kind\":\"yawPlaced\",\"id\":"+id+",\"yaw\":"+yaw+",\"result\":["+useItem(w,st,p,0,63,0,1,0.5F,0.5F,0.5F)+"],\"meta\":"+w.e(0,64,0)+"}");
    }
    // Carpet and glass pane placed beside a wall with air below (carpet needs a non-air block below).
    for(int id:new int[]{171,95,160}){
      for(int below:new int[]{0,1,20,8,78,50,31,171}){
        W w=world();w.put(0,64,0,1,0);if(below!=0)w.put(0,63,-1,below,0);mw p=player(0,false);add st=new add(adb.a(block(id)),1,3);boolean can=block(id).c(w,0,64,-1);
        out.add("{\"kind\":\"supportPlaced\",\"id\":"+id+",\"below\":"+below+",\"result\":["+useItem(w,st,p,0,64,0,2,0.5F,0.5F,0.5F)+"],\"canPlace\":"+can+"}");
      }
    }
    // BlockCarpet neighbor update: stays or pops off (func_150090_e).
    for(int below:new int[]{0,1,20,8,78,50,31,171,9}){
      W w=world();w.put(0,64,0,171,5);if(below!=0)w.put(0,63,0,below,0);
      block(171).a(w,0,64,0,block(1));
      out.add("{\"kind\":\"carpetNeighbor\",\"below\":"+below+",\"writes\":"+list(w.writes)+",\"spawned\":"+w.spawned.size()+",\"cell\":"+stackJson(null)+",\"stays\":"+(w.cell(0,64,0)[0]==171)+"}");
    }
    // Direct onBlockPlaced meta (hay axis from side, others identity).
    for(int id:new int[]{170,171,95,160,91,86,173,22,133,19})for(int meta:new int[]{0,1,2,3,7,15})for(int side=0;side<6;side++){
      W w=world();
      out.add("{\"kind\":\"onPlaced\",\"id\":"+id+",\"meta\":"+meta+",\"side\":"+side+",\"result\":"+block(id).a(w,0,64,0,side,0.5F,0.5F,0.5F,meta)+"}");
    }
  }
  static void dropRows(List<String> out)throws Exception{
    for(int id:IDS){
      boolean damaged=id==95||id==160||id==171||id==170;
      for(int meta=0;meta<(damaged?16:1);meta++)for(int fortune=0;fortune<4;fortune++){
        W w=world();field(ahb.class,"s").set(w,new Random(11));
        block(id).a(w,0,64,0,meta,1.0F,fortune);
        List<String> d=new ArrayList<>();for(add s:w.spawned)d.add(stackJson(s));
        out.add("{\"kind\":\"drops\",\"id\":"+id+",\"meta\":"+meta+",\"fortune\":"+fortune+",\"drops\":"+list(d)+"}");
      }
    }
  }
  static String spec(int id,int dmg){return id+":"+dmg;}
  static void craft(List<String> out,String label,String[] slots)throws Exception{
    aae grid=new aae(new zs(){public boolean a(yz p){return true;}},3,3);
    for(int i=0;i<9;i++){
      if(slots[i]==null)continue;String[] p=slots[i].split(":");
      grid.a(i,new add(item(Integer.parseInt(p[0])),1,Integer.parseInt(p[1])));
    }
    add r=afe.a().a(grid,null);
    out.add("{\"kind\":\"craft\",\"label\":"+q(label)+",\"grid\":"+list(Arrays.asList(Arrays.stream(slots).map(s->s==null?"":s).toArray(String[]::new)))+",\"result\":"+stackJson(r)+"}");
  }
  static void craftRows(List<String> out)throws Exception{
    for(int d=0;d<16;d++){
      String[] g=new String[9];Arrays.fill(g,"20:0");g[4]="351:"+d;craft(out,"glass+dye"+d,g);
      String[] p=new String[9];for(int i=0;i<6;i++)p[i]="95:"+d;craft(out,"pane"+d,p);
      String[] c=new String[9];c[0]="35:"+d;c[1]="35:"+d;craft(out,"carpet"+d,c);
    }
    String[] mixed=new String[9];for(int i=0;i<6;i++)mixed[i]=i==2?"95:3":"95:1";craft(out,"mixedPane",mixed);
    String[] glass7=new String[9];Arrays.fill(glass7,"20:0");glass7[4]="351:1";glass7[0]=null;craft(out,"glass7",glass7);
    String[] hay=new String[9];Arrays.fill(hay,"296:0");craft(out,"hayPack",hay);
    String[] unhay=new String[9];unhay[0]="170:0";craft(out,"hayUnpack",unhay);
    String[] cb=new String[9];Arrays.fill(cb,"263:0");craft(out,"coalPack",cb);
    String[] charcoal=new String[9];Arrays.fill(charcoal,"263:1");craft(out,"charcoalPack",charcoal);
    String[] lb=new String[9];Arrays.fill(lb,"351:4");craft(out,"lapisPack",lb);
    String[] eb=new String[9];Arrays.fill(eb,"388:0");craft(out,"emeraldPack",eb);
    for(int id:new int[]{173,22,133}){String[] u=new String[9];u[0]=id+":0";craft(out,"unpack"+id,u);}
    String[] jack=new String[9];jack[0]="86:0";jack[3]="50:0";craft(out,"jackPumpkinTorch",jack);
    String[] jack2=new String[9];jack2[0]="86:0";jack2[1]="50:0";craft(out,"jackSideBySide",jack2);
    String[] sponge=new String[9];sponge[0]="19:0";craft(out,"spongeAlone",sponge);
  }
  static void recipeRows(List<String> out)throws Exception{
    Set<Integer> results=new HashSet<>(MINE);results.addAll(Arrays.asList(296,263,351,388));
    List<afg> recipes=afe.a().b();
    for(int index=0;index<recipes.size();index++){
      afg r=recipes.get(index);add result=r.b();if(result==null)continue;
      List<add> ing=new ArrayList<>();String type="special",dims="";
      if(r instanceof afh){afh s=(afh)r;type="shaped";dims=",\"width\":"+field(afh.class,"a").getInt(s)+",\"height\":"+field(afh.class,"b").getInt(s);for(add a:(add[])field(afh.class,"c").get(s))ing.add(a);}
      else if(r instanceof afi){type="shapeless";for(Object a:(List)field(afi.class,"b").get(r))ing.add((add)a);}
      boolean hit=results.contains(adb.b(result.b()));
      for(add a:ing)if(a!=null&&MINE.contains(adb.b(a.b())))hit=true;
      if(!hit)continue;
      List<String> l=new ArrayList<>();for(add a:ing)l.add(stackJson(a));
      out.add("{\"kind\":\"recipe\",\"index\":"+index+",\"type\":"+q(type)+dims+",\"ingredients\":"+list(l)+",\"result\":"+stackJson(result)+"}");
    }
  }
  static void fuelRows(List<String> out)throws Exception{
    int[][] s={{173,0},{263,0},{263,1},{170,0},{171,0},{171,5},{35,0},{95,0},{5,0},{17,0},{22,0},{133,0},{19,0},{91,0},{86,0},{369,0}};
    for(int[] x:s){add st=new add(item(x[0]),1,x[1]);out.add("{\"kind\":\"fuel\",\"id\":"+x[0]+",\"damage\":"+x[1]+",\"burn\":"+apg.a(st)+"}");}
  }
  static void fireRows(List<String> out)throws Exception{
    alb.e();alb fire=(alb)aji.e(51);
    int[] enc=(int[])field(alb.class,"a").get(fire),flam=(int[])field(alb.class,"b").get(fire);
    for(int id:IDS)out.add("{\"kind\":\"fire\",\"id\":"+id+",\"encourage\":"+enc[id]+",\"flammability\":"+flam[id]+"}");
  }
  public static void main(String[] args)throws Exception{
    U=unsafe();aji.p();adb.l();
    List<String> out=new ArrayList<>();
    for(int id:IDS)out.add(blockProps(id));
    for(int id:IDS){boolean damaged=id==95||id==160||id==171||id==170;for(int m=0;m<(damaged?16:1);m++)out.add(metaRow(id,m));}
    harvestRows(out);placeRows(out);dropRows(out);craftRows(out);recipeRows(out);fuelRows(out);fireRows(out);
    StringBuilder items=new StringBuilder("{\"kind\":\"items\"");
    for(int id:IDS)items.append(",\"b").append(id).append("\":").append(adb.b(adb.a(block(id))));
    out.add(items.append("}").toString());
    for(String s:out)System.out.println(s);
  }
}
