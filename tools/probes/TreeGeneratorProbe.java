import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;
import sun.misc.Unsafe;

// Unchanged 1.7.10 worldgen tree generators (WorldGenTrees, BigTree, Forest, Swamp,
// Taiga1/2, MegaJungle, MegaPineTree, Shrub, Savanna, Canopy), WorldGenBigMushroom and
// the BiomeGenBase tree/grass pickers. World is a block-access double over a synthetic fixture.
public class TreeGeneratorProbe {
  static String q(String s){return TerrainProbe.q(s);}
  static int mix(int x,int z){int h=x*0x2F0B3A49+z*0x6C8E9CF5;h^=h>>>15;h*=0x2C1B3C6D;h^=h>>>12;return h;}
  static final int[] SURFACE={2,2,2,2,2,2,2,3,3,3,60,110,110,12,1,2},SWAMP={2,3,3,2,12,2,3,1},OBSTACLE={17,18,161,106,6,1,31,162};
  static int top(int x,int z){return x>=2000?250:62+Math.floorMod(mix(Math.floorDiv(x,5),Math.floorDiv(z,5)),2);}
  // Fixture block id. Mirrored in src/tree-generators.test.js.
  static int cell(int x,int y,int z){
    int d=mix(x,z);
    if(x>=1000&&x<2000){// Swamp: a 59/60 floor under still (sometimes flowing) water to y 61, with dry islands at 62.
      int floor=(d>>>16&63)==0?62:(d>>>4&3)==0?59:60;
      if(y<floor-2)return 1;if(y<floor)return 3;if(y==floor)return SWAMP[d>>>8&7];
      if(y<=61)return (d>>>12&7)==0?8:9;
      return (d>>>4&63)==1&&y==62+(d>>>20&7)?OBSTACLE[d>>>24&7]:0;
    }
    int t=top(x,z);
    if(y<t-3)return 1;if(y<t)return 3;if(y==t)return x>=2000?2:SURFACE[d>>>20&15];
    return (d>>>4&63)<2&&y==t+1+(d>>>12&15)?OBSTACLE[d>>>16&7]:0;
  }
  static boolean out(int x,int y,int z){return y<0||y>=256||x< -30000000||z< -30000000||x>=30000000||z>=30000000;}
  static long key(int x,int y,int z){return ((long)x<<40)^((long)(z&0xFFFFFF)<<12)^y;}
  static class W extends TerrainProbe.W {
    Map<Long,Integer> edits=new HashMap<>();MessageDigest calls,writes;int callCount,writeCount;TreeMap<Integer,Integer> ids=new TreeMap<>();
    static void put(MessageDigest h,int... args){for(int a:args)for(int s=0;s<32;s+=8)h.update((byte)(a>>s));}
    public aji a(int x,int y,int z){callCount++;put(calls,0,x,y,z);if(out(x,y,z))return aji.e(0);Integer e=edits.get(key(x,y,z));return aji.e(e!=null?e:cell(x,y,z));}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){int id=aji.b(b);callCount++;put(calls,1,x,y,z,id,meta,flags);if(out(x,y,z))return false;
      edits.put(key(x,y,z),id);writeCount++;put(writes,x,y,z,id,meta,flags);ids.merge(id*16+meta,1,Integer::sum);return true;}
  }
  static W world()throws Exception{
    W w=(W)TerrainProbe.unsafe.allocateInstance(W.class);w.edits=new HashMap<>();w.ids=new TreeMap<>();
    w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");return w;
  }
  static Object f(Class<?> c,String n,Object o)throws Exception{Field fl=c.getDeclaredField(n);fl.setAccessible(true);return fl.get(o);}
  // Constructor arguments, in constructor order, that reproduce a generator.
  static String describe(Object g)throws Exception{
    boolean notify=(Boolean)f(arn.class,"a",g);String c=g.getClass().getName();List<Object> a=new ArrayList<>();
    if(g instanceof arp){a.add(f(arp.class,"b",g));a.add(f(arp.class,"a",g));}
    else if(g instanceof asq){a.add(notify);a.add(f(asq.class,"a",g));a.add(f(asq.class,"c",g));a.add(f(asq.class,"d",g));a.add(f(asq.class,"b",g));}
    else if(g instanceof asa){a.add(notify);a.add(f(asa.class,"e",g));}
    else if(g instanceof arz){a.add(notify);a.add(f(asb.class,"a",g));a.add(f(asb.class,"d",g));a.add(f(asb.class,"b",g));a.add(f(asb.class,"c",g));}
    else if(g instanceof are){a.add(notify);a.add(f(are.class,"a",g));}
    else if(g instanceof aru){int t=(Integer)f(aru.class,"a",g);if(t>=0)a.add(t);}
    else if(!(g instanceof aso||g instanceof asf))a.add(notify);
    StringBuilder s=new StringBuilder("[").append(q(c)).append(",[");
    for(int i=0;i<a.size();i++){if(i>0)s.append(',');s.append(a.get(i));}
    return s.append("]]").toString();
  }
  // Where a picked generator lives: "<slot>.<field>" on a registered biome, "<class>.<field>" for statics, or null for a new object.
  static String owner(Object g,ahu[] all)throws Exception{
    for(int i=0;i<all.length;i++){ahu b=all[i];if(b==null)continue;for(Class<?> c=b.getClass();c!=Object.class;c=c.getSuperclass())for(Field fl:c.getDeclaredFields()){
      if(Modifier.isStatic(fl.getModifiers())||!arn.class.isAssignableFrom(fl.getType()))continue;fl.setAccessible(true);
      if(fl.get(b)==g)return q(i+"."+fl.getName());}}
    for(ahu b:all){if(b==null)continue;for(Class<?> c=b.getClass();c!=Object.class;c=c.getSuperclass())for(Field fl:c.getDeclaredFields()){
      if(!Modifier.isStatic(fl.getModifiers())||!arn.class.isAssignableFrom(fl.getType()))continue;fl.setAccessible(true);
      if(fl.get(null)==g)return q(c.getName()+"."+fl.getName());}}
    return "null";
  }
  static Object[][] features(){return new Object[][]{
    {"asq",new asq(false,4,0,0,false)},{"asq",new asq(true,4,0,0,false)},{"asq",new asq(false,4,3,3,true)},{"asq",new asq(false,10,3,3,true)},{"asq",new asq(false,5,2,2,false)},
    {"ard",new ard(false)},{"ard",new ard(true)},
    {"are",new are(false,false)},{"are",new are(false,true)},{"are",new are(true,false)},
    {"aso",new aso()},{"asf",new asf()},{"asn",new asn(false)},{"asn",new asn(true)},
    {"arz",new arz(false,10,20,3,3)},{"arz",new arz(true,10,20,3,3)},
    {"asa",new asa(false,false)},{"asa",new asa(false,true)},{"asa",new asa(true,false)},
    {"arp",new arp(3,0)},{"arp",new arp(0,0)},{"ask",new ask(false)},{"ask",new ask(true)},{"asi",new asi(false)},{"asi",new asi(true)},
    {"aru",new aru()},{"aru",new aru(0)},{"aru",new aru(1)},
  };}
  // Origin selection is a fixture procedure, not native decorator placement.
  static int[] origin(String name,int i,int n,Random pick,int[] prev){
    int x=pick.nextInt(160)-80,z=pick.nextInt(160)-80;
    if(prev!=null){x=prev[0]+pick.nextInt(13)-6;z=prev[2]+pick.nextInt(13)-6;if(prev[0]>=1000&&prev[0]<3000)x=Math.max(x,prev[0]>=2000?2000:1000);}
    else if(name.equals("aso")?i%4!=3:i%8==5)x=1000+pick.nextInt(200);
    else if(i%12==11)x=2000+pick.nextInt(50);
    if(prev==null&&i%12==10)return new int[]{x,pick.nextInt(2),z};
    // Some swamp origins stand in two-deep water, where the swamp clearance rule rejects water above the origin.
    if(prev==null&&name.equals("aso")&&i%4==1&&x>=1000&&x<2000)for(int s=0;s<4096;s++){int px=x+Math.floorMod(s,64)-32,pz=z+s/64-32,d=mix(px,pz);
      if((d>>>16&63)!=0&&(d>>>4&3)==0){x=px;z=pz;break;}}
    if(x>=1000&&x<2000)return new int[]{x,62,z};
    int y=top(x,z)+1;if(i%6==4&&n==0)y+=pick.nextInt(3)-1;
    return new int[]{x,y,z};
  }
  public static void main(String[] args)throws Exception{
    Field uf=Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(Unsafe)uf.get(null);aji.p();
    StringBuilder opaque=new StringBuilder("[");
    for(int id=0;id<256;id++){aji b=aji.e(id);if(aji.b(b)!=id||!b.j())continue;if(opaque.length()>1)opaque.append(',');opaque.append(id);}
    ahu[] all=ahu.n();StringBuilder biomes=new StringBuilder("[");
    for(int i=0;i<all.length;i++){ahu b=all[i];if(b==null)continue;if(biomes.length()>1)biomes.append(',');int param=-1;
      if(b instanceof aif)param=(Integer)f(aif.class,"aF",b);if(b instanceof aiw)param=(Integer)f(aiw.class,"aH",b);
      if(b instanceof aik)param=(Boolean)f(aik.class,"aC",b)?1:0;if(b instanceof ain)param=((ahu)f(ain.class,"aD",b)).ay;
      biomes.append('[').append(i).append(',').append(b.ay).append(',').append(q(b.getClass().getName())).append(',').append(param).append(']');}
    biomes.append(']');
    int[] blocks={aji.b(ajn.c),aji.b(ajn.d),aji.b(ajn.ak),aji.b(ajn.bh),aji.b(ajn.j),aji.b(ajn.i),aji.b(ajn.r),aji.b(ajn.s),aji.b(ajn.t),aji.b(ajn.u),aji.b(ajn.g),aji.b(ajn.bd),aji.b(ajn.by),aji.b(ajn.aW),aji.b(ajn.H)};
    System.out.println("{\"kind\":\"config\",\"blocks\":"+Arrays.toString(blocks)+",\"opaque\":"+opaque+"],\"biomes\":"+biomes+",\"sinCos\":["+qh.a(1.0f)+","+qh.b(1.0f)+"]}");
    Object[][] fs=features();
    for(int fi=0;fi<fs.length;fi++){String name=(String)fs[fi][0];
      for(int i=0;i<24;i++){
        // A fresh generator per record; chained origins reuse it, its World and its Random, as a biome's shared instance would.
        arn gen=(arn)fresh(fi);
        Random pick=new Random(fi*7919L+i);int count=1+(i%5==2?2:i%5==4?1:0);boolean scale=!name.equals("ard")||fi==5,post=i%4!=3;
        int[][] origins=new int[count][];for(int n=0;n<count;n++)origins[n]=origin(name,i,n,pick,n==0?null:origins[0]);
        long seed=pick.nextLong();W w=world();Random r=new Random(seed);StringBuilder results=new StringBuilder("[");
        for(int n=0;n<count;n++){int[] o=origins[n];int before=w.writeCount;
          if(scale)gen.a(1.0,1.0,1.0);boolean ok=gen.a(w,r,o[0],o[1],o[2]);if(ok&&post&&gen instanceof arc)((arc)gen).b(w,r,o[0],o[1],o[2]);
          if(n>0)results.append(',');results.append('[').append(ok).append(',').append(w.writeCount-before).append(']');}
        StringBuilder pos=new StringBuilder("[");for(int n=0;n<count;n++){if(n>0)pos.append(',');pos.append(Arrays.toString(origins[n]));}
        StringBuilder ids=new StringBuilder("[");for(Map.Entry<Integer,Integer> e:w.ids.entrySet()){if(ids.length()>1)ids.append(',');ids.append('[').append(e.getKey()>>4).append(',').append(e.getKey()&15).append(',').append(e.getValue()).append(']');}
        System.out.println("{\"kind\":\"tree\",\"generator\":"+describe(gen)+",\"seed\":"+q(""+seed)+",\"origins\":"+pos+"],\"scale\":"+scale+",\"post\":"+post+",\"results\":"+results+"],\"writeCount\":"+w.writeCount+",\"writeSha1\":"+q(TerrainProbe.hex(w.writes.digest()))+",\"writeIds\":"+ids+"],\"callCount\":"+w.callCount+",\"callSha1\":"+q(TerrainProbe.hex(w.calls.digest()))+",\"nextLong\":"+q(""+r.nextLong())+"}");
      }
    }
    for(int i=0;i<all.length;i++){ahu b=all[i];if(b==null)continue;
      for(int s=0;s<4;s++){long seed=i*1009L+s;Random r=new Random(seed);StringBuilder trees=new StringBuilder("["),grass=new StringBuilder("[");
        for(int n=0;n<6;n++){arc g=b.a(r);if(n>0)trees.append(',');trees.append('[').append(owner(g,all)).append(',').append(describe(g)).append(']');}
        for(int n=0;n<3;n++){arn g=b.b(r);if(n>0)grass.append(',');grass.append('[').append(aji.b((aji)f(asp.class,"a",g))).append(',').append(f(asp.class,"b",g)).append(']');}
        System.out.println("{\"kind\":\"picker\",\"slot\":"+i+",\"seed\":"+q(""+seed)+",\"trees\":"+trees+"],\"grass\":"+grass+"],\"nextLong\":"+q(""+r.nextLong())+"}");
      }
    }
  }
  static Object fresh(int i){return features()[i][1];}
}
