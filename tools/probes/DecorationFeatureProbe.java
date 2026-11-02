import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;
import sun.misc.Unsafe;

// Unchanged 1.7.10 BiomeDecorator configuration and its simple feature generators
// (clay/sand/gravel discs, flowers and mushrooms, tall grass, dead bush, lily pad,
// reeds, pumpkin, cactus). World is a block-access double over a synthetic fixture.
public class DecorationFeatureProbe {
  static String q(String s){return TerrainProbe.q(s);}
  static int mix(int x,int z){int h=x*0x2F0B3A49+z*0x6C8E9CF5;h^=h>>>15;h*=0x2C1B3C6D;h^=h>>>12;return h;}
  static int top(int x,int z){return x>=3000&&x<4000?63:x>=2000?254:62+Math.floorMod(mix(Math.floorDiv(x,3),Math.floorDiv(z,3)),3);}
  static int kind(int x,int z){return Math.floorMod(mix(x,z)>>4,16);}
  static final int[] SURFACE={2,2,2,3,12,3,110,172,159,60,1,13,9,9,8,79};
  // Fixture block [id, meta]. Mirrored in src/decoration-features.test.js.
  static int[] cell(int x,int y,int z){
    if(x>=1000&&x<2000)return new int[]{0,0};
    if(x>=3000&&x<4000){int d=mix(x,z);// Desert: sand over sandstone, sparse still water and cactus.
      if(y<59)return new int[]{1,0};if(y<63)return new int[]{24,0};
      if(y==63)return new int[]{(d&63)==0?9:12,0};
      return new int[]{y==64&&(d>>8&15)==0&&(d&63)!=0?81:0,0};}
    int h=mix(x,z),t=top(x,z),k=Math.floorMod(h>>4,16),v=Math.floorMod(h>>8,16);
    if(y<t-3)return new int[]{1,0};
    if(k>=12&&k<=14){
      if(y>=t-1&&y<=t)return new int[]{k==14?8:9,k==13?1+(v&3):0};
      if(y==t-2)return new int[]{new int[]{3,82,12,2}[v&3],0};
      if(y<t)return new int[]{3,0};
      return new int[]{0,0};
    }
    if(y<t)return new int[]{3,k==5?2:0};
    if(y==t)return new int[]{SURFACE[k],k==8?v:k==5?2:0};
    if(y==t+1){
      if(k==2)return new int[]{31,1};
      if(k==4&&(v&1)==1)return new int[]{81,0};
      if(k==3&&(v&1)==1)return new int[]{83,0};
      if(k==10)return new int[]{78,v&7};
      if(k==11&&(v&1)==1)return new int[]{20,0};
      if(k==0&&(v&3)==0)return new int[]{37,0};
    }
    if((y==t+3||y==t+4)&&k==1)return new int[]{18,v&3};
    if(y==t+3&&k==6)return new int[]{161,0};
    return new int[]{0,0};
  }
  static boolean out(int x,int y,int z){return y<0||y>=256||x< -30000000||z< -30000000||x>=30000000||z>=30000000;}
  static long key(int x,int y,int z){return ((long)x<<40)^((long)(z&0xFFFFFF)<<12)^y;}
  static class W extends TerrainProbe.W {
    Map<Long,int[]> edits=new HashMap<>();MessageDigest calls;int callCount;StringBuilder writes=new StringBuilder("[");aji probe;int probeMeta;
    void call(int... args){callCount++;for(int a:args)for(int s=0;s<32;s+=8)calls.update((byte)(a>>s));}
    int[] at(int x,int y,int z){int[] e=edits.get(key(x,y,z));return e!=null?e:cell(x,y,z);}
    public aji a(int x,int y,int z){if(probe!=null)return probe;call(0,x,y,z);return out(x,y,z)?aji.e(0):aji.e(at(x,y,z)[0]);}
    public int e(int x,int y,int z){if(probe!=null)return probeMeta;call(2,x,y,z);return out(x,y,z)?0:at(x,y,z)[1];}
    public int j(int x,int y,int z){call(3,x,y,z);return Math.floorMod(x*5+y*11+z*3,16);}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){call(1,x,y,z,aji.b(b),meta,flags);if(out(x,y,z))return false;
      edits.put(key(x,y,z),new int[]{aji.b(b),meta});if(writes.length()>1)writes.append(',');
      writes.append('[').append(x).append(',').append(y).append(',').append(z).append(',').append(aji.b(b)).append(',').append(meta).append(',').append(flags).append(']');return true;}
  }
  static W world(boolean noSky)throws Exception{
    W w=(W)TerrainProbe.unsafe.allocateInstance(W.class);w.edits=new HashMap<>();w.writes=new StringBuilder("[");w.calls=MessageDigest.getInstance("SHA-1");
    aqo provider=(aqo)TerrainProbe.unsafe.allocateInstance(aqq.class);TerrainProbe.field(aqo.class,"g").setBoolean(provider,noSky);
    TerrainProbe.field(ahb.class,"t").set(w,provider);return w;
  }
  static Object[][] features(){return new Object[][]{
    {"clay",new arj(4),null},{"sand",new asj(ajn.m,7),null},{"gravel",new asj(ajn.n,6),null},
    {"flower",new aro(ajn.N),new int[][]{{37,0},{38,0},{38,3},{38,8}}},{"brownMushroom",new aro(ajn.P),null},{"redMushroom",new aro(ajn.Q),null},
    {"grass",new asp(ajn.H,1),null},{"fern",new asp(ajn.H,2),null},{"deadBush",new ark(ajn.I),null},
    {"waterlily",new aiz(),null},{"reed",new ash(),null},{"pumpkin",new asg(),null},{"cactus",new arh(),null},
  };}
  static boolean pond(int x,int z){int k=kind(x,z);return x<1000&&k>=12&&k<=14;}
  static boolean nearPond(int x,int z){return !pond(x,z)&&(pond(x-1,z)||pond(x+1,z)||pond(x,z-1)||pond(x,z+1))&&top(x-1,z)==top(x,z);}
  // Origin selection is a fixture procedure, not native decorator placement.
  static int[] origin(String name,int i,Random pick){
    int x=pick.nextInt(48)-24,z=pick.nextInt(48)-24;
    if(i==0)return new int[]{1000+pick.nextInt(50),pick.nextInt(6),z,0};
    if(i==1)return new int[]{2000+pick.nextInt(50),255,z,0};
    if(i==2)return new int[]{2000+pick.nextInt(50),254,z,1};
    boolean disc=name.equals("clay")||name.equals("sand")||name.equals("gravel"),water=name.equals("waterlily")||name.equals("reed"),cactus=name.equals("cactus");
    if((cactus&&i%3!=2)||(name.equals("deadBush")&&i%4==1))return new int[]{3000+pick.nextInt(50),64+pick.nextInt(cactus?3:20)-1,z,0};
    if((disc&&i%4!=3)||(water&&i%3!=2))for(int n=0;n<4096;n++){int px=x+Math.floorMod(n,64)-32,pz=z+n/64-32;if(name.equals("reed")?nearPond(px,pz):pond(px,pz)){x=px;z=pz;break;}}
    int t=top(x,z),y=disc?t-(i%4==3?pick.nextInt(3)-1:0):name.equals("grass")||name.equals("fern")||name.equals("deadBush")?t+1+pick.nextInt(i%2==0?3:40):t+1+pick.nextInt(3)-1;
    if(name.equals("waterlily")&&i%3!=2)y=t+1+pick.nextInt(5)-2;
    return new int[]{x,y,z,i%10==9?1:0};
  }
  static int topMask(aji b)throws Exception{W w=world(false);w.probe=b;int mask=0;for(int m=0;m<16;m++){w.probeMeta=m;if(ahb.a((ahl)w,0,64,0))mask|=1<<m;}return mask;}
  public static void main(String[] args)throws Exception{
    Field uf=Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(Unsafe)uf.get(null);aji.p();
    StringBuilder props=new StringBuilder("[");
    for(int id=0;id<256;id++){aji b=aji.e(id);if(aji.b(b)!=id)continue;awt m=b.o();if(props.length()>1)props.append(',');
      props.append('[').append(id).append(',').append(m==awt.a).append(',').append(m==awt.h).append(',').append(m==awt.j).append(',').append(m.a()).append(',').append(m.j()).append(',').append(b.j()).append(',').append(topMask(b)).append(']');}
    props.append(']');
    String[] fields={"F","G","E","x","H","y","z","A","w","B","C","D","I"};StringBuilder biomes=new StringBuilder("[");
    ahu[] all=ahu.n();for(int i=0;i<all.length;i++){if(all[i]==null)continue;aia d=all[i].ar;if(biomes.length()>1)biomes.append(',');
      biomes.append('[').append(i).append(',').append(all[i].ay).append(',').append(q(all[i].getClass().getName())).append(',').append(q(d.getClass().getName())).append(",[");
      for(int f=0;f<fields.length;f++){if(f>0)biomes.append(',');Object v=TerrainProbe.field(aia.class,fields[f]).get(d);biomes.append(v instanceof Boolean?((Boolean)v?1:0):v);}
      biomes.append("]]");}
    biomes.append(']');
    int[] ids={aji.b(ajn.c),aji.b(ajn.d),aji.b(ajn.m),aji.b(ajn.n),aji.b(ajn.j),aji.b(ajn.ak),aji.b(ajn.aF),aji.b(ajn.aG),aji.b(ajn.aH),aji.b(ajn.aK),aji.b(ajn.bh),aji.b(ajn.bi),aji.b(ajn.ce),aji.b(ajn.ch),aji.b(ajn.N),aji.b(ajn.O),aji.b(ajn.P),aji.b(ajn.Q),aji.b(ajn.H),aji.b(ajn.I)};
    System.out.println("{\"kind\":\"config\",\"blocks\":"+Arrays.toString(ids)+",\"fields\":[\"sand\",\"clay\",\"gravel\",\"trees\",\"bigMushrooms\",\"flowers\",\"grass\",\"deadBush\",\"waterlily\",\"mushrooms\",\"reeds\",\"cacti\",\"liquids\"],\"decorators\":"+biomes+",\"properties\":"+props+"}");
    Object[][] fs=features();
    for(int f=0;f<fs.length;f++){String name=(String)fs[f][0];arn gen=(arn)fs[f][1];int[][] variants=(int[][])fs[f][2];
      for(int i=0;i<48;i++){Random pick=new Random(f*7919L+i);int[] o=origin(name,i,pick);long seed=pick.nextLong();
        int[] variant=null;if(variants!=null){variant=variants[i%variants.length];((aro)gen).a(aji.e(variant[0]),variant[1]);}
        W w=world(o[3]==1);Random r=new Random(seed);boolean ok=gen.a(w,r,o[0],o[1],o[2]);
        System.out.println("{\"kind\":\"feature\",\"feature\":"+q(name)+(variant==null?"":",\"variant\":"+Arrays.toString(variant))+",\"seed\":"+q(""+seed)+",\"pos\":["+o[0]+","+o[1]+","+o[2]+"],\"noSky\":"+(o[3]==1)+",\"result\":"+ok+",\"writes\":"+w.writes+"],\"callCount\":"+w.callCount+",\"callSha1\":"+q(TerrainProbe.hex(w.calls.digest()))+",\"nextLong\":"+q(""+r.nextLong())+"}");
      }
    }
  }
}
