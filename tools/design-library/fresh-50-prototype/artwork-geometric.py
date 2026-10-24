from PIL import Image, ImageDraw
from pathlib import Path
p=Path(__file__).resolve().parent/'assets'
im=Image.new('RGB',(1000,1000),'#ef694c');d=ImageDraw.Draw(im);d.ellipse((90,90,910,910),fill='#252923')
for r in range(140,400,18):d.ellipse((500-r,500-r,500+r,500+r),outline='#46443b',width=2)
d.ellipse((370,370,630,630),fill='#f4dec1');d.ellipse((485,485,515,515),fill='#ef694c');im.save(p/'vinyl.png')
im=Image.new('RGB',(1000,1000),'#f4eccf');d=ImageDraw.Draw(im);d.arc((370,300,670,1000),180,300,fill='#285844',width=24);d.ellipse((250,380,550,570),fill='#5b7b37');d.ellipse((470,230,780,440),fill='#285844');d.rectangle((80,830,920,845),fill='#b69e62');im.save(p/'seedling.png')
im=Image.new('RGB',(1000,1000),'#dce77f');d=ImageDraw.Draw(im);d.rectangle((65,65,935,935),outline='#466344',width=6);d.line((500,65,500,935),fill='#466344',width=6);d.line((65,500,935,500),fill='#466344',width=6);d.ellipse((280,280,720,720),fill='#e9f491',outline='#466344',width=5);d.arc((140,300,540,700),270,90,fill='#466344',width=10);d.arc((460,300,860,700),90,270,fill='#466344',width=10);im.save(p/'tennis.png')
im=Image.new('RGB',(1200,800),'#ecddbc');d=ImageDraw.Draw(im);d.ellipse((410,120,790,500),fill='#d96b42');d.ellipse((-220,410,850,1250),fill='#62755a');d.ellipse((500,450,1500,1200),fill='#344e41');im.save(p/'sun.png')
im=Image.new('RGB',(1000,1000),'#c7b9dd');d=ImageDraw.Draw(im);d.ellipse((280,230,750,700),fill='#344a9a');d.arc((100,330,900,630),0,180,fill='#fff2c4',width=24);d.arc((100,330,900,630),180,360,fill='#fff2c4',width=24);d.ellipse((710,290,800,380),fill='#f37751');im.save(p/'orbit.png')
