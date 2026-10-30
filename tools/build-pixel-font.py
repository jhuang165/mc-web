"""Trace the original 1.7.10 font bitmap into a pixel-aligned TrueType font.
Requires Pillow and fonttools. Original glyph artwork © Mojang / Microsoft.
"""
from pathlib import Path
from PIL import Image
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
root=Path(__file__).resolve().parents[1]
im=Image.open(root/'public/media/1.7.10/font/ascii.png').convert('RGBA')
fb=FontBuilder(800,isTTF=True)
order=['.notdef']+[f'char{i}' for i in range(32,127)]
fb.setupGlyphOrder(order);fb.setupCharacterMap({i:f'char{i}' for i in range(32,127)})
glyphs={};metrics={}
for code,name in [(0,'.notdef')]+[(i,f'char{i}') for i in range(32,127)]:
 pen=TTGlyphPen(None);width=0
 if code!=32:
  for y in range(8):
   for x in range(8):
    if im.getpixel(((code%16)*8+x,(code//16)*8+y))[3]>128:
     width=max(width,x+1);a,b=x*100,(6-y)*100
     pen.moveTo((a,b));pen.lineTo((a,b+100));pen.lineTo((a+100,b+100));pen.lineTo((a+100,b));pen.closePath()
 glyphs[name]=pen.glyph();metrics[name]=((width+1)*100 if code!=32 else 400,0)
fb.setupGlyf(glyphs);fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=800,descent=-200)
fb.setupNameTable({'familyName':'Minecraft 1.7.10 Bitmap','styleName':'Regular','uniqueFontIdentifier':'Minecraft1710Bitmap','fullName':'Minecraft 1.7.10 Bitmap','psName':'Minecraft1710Bitmap','copyright':'Original glyph artwork © Mojang / Microsoft. Traced from Minecraft Java 1.7.10 ascii.png.'})
fb.setupOS2(sTypoAscender=800,sTypoDescender=-200,usWinAscent=800,usWinDescent=200);fb.setupPost();fb.setupMaxp()
(root/'public/fonts').mkdir(exist_ok=True);fb.save(root/'public/fonts/minecraft-1710.ttf')
print(im.size,'saved pixel font')
