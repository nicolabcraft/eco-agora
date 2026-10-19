# Fabrique le logo et la galerie mod.io a partir de captures du panel.
# Usage : python fabriquer-visuels.py <dossier-des-captures> <sortie> <logo-source.png>
import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
CAP=sys.argv[1]; OUT=sys.argv[2]; LOGO=sys.argv[3]
W,H=1920,1080
ORANGE=(255,107,13)
def font(n,s): return ImageFont.truetype("C:/Windows/Fonts/"+n,s)
def fond():
    im=Image.new('RGB',(W,H)); d=ImageDraw.Draw(im)
    for y in range(H):
        t=y/H; d.line([(0,y),(W,y)],fill=(int(22+12*t),int(20+16*t),int(28+22*t)))
    # halo orange
    halo=Image.new('RGBA',(W,H),(0,0,0,0)); hd=ImageDraw.Draw(halo)
    hd.ellipse([-300,-400,900,500],fill=(255,107,13,70))
    halo=halo.filter(ImageFilter.GaussianBlur(160))
    im.paste(halo,(0,0),halo)
    return im
def arrondi(im,r):
    m=Image.new('L',im.size,0); ImageDraw.Draw(m).rounded_rectangle([0,0,im.size[0]-1,im.size[1]-1],radius=r,fill=255)
    out=im.convert('RGBA'); out.putalpha(m); return out
def entete(im,titre,sous,anglais):
    d=ImageDraw.Draw(im)
    logo=Image.open(LOGO).convert('RGBA').resize((64,64))
    im.paste(logo,(90,62),logo)
    d.text((172,66),"ECO AGORA",font=font("segoeuib.ttf",30),fill=(255,255,255))
    d.text((172,102),"Panel web pour serveur Eco",font=font("segoeui.ttf",20),fill=(190,190,200))
    d.text((90,170),titre,font=font("segoeuib.ttf",64),fill=(255,255,255))
    d.text((92,252),sous,font=font("segoeui.ttf",30),fill=(225,225,232))
    d.text((92,296),anglais,font=font("segoeuii.ttf",24),fill=(255,150,90))
def capture(im,f,box,decalage=0):
    x,y,w,h=box
    c=Image.open(os.path.join(CAP,f)).convert('RGB')
    c=c.resize((w,int(c.size[1]*w/c.size[0])))
    d0=int(decalage*w/1600)
    c=c.crop((0,d0,w,min(d0+h,c.size[1])))
    ombre=Image.new('RGBA',(c.size[0]+80,c.size[1]+80),(0,0,0,0))
    ImageDraw.Draw(ombre).rounded_rectangle([40,48,c.size[0]+40,c.size[1]+40],radius=18,fill=(0,0,0,170))
    ombre=ombre.filter(ImageFilter.GaussianBlur(22))
    im.paste(ombre,(x-40,y-40),ombre)
    r=arrondi(c,16); im.paste(r,(x,y),r)
    ImageDraw.Draw(im).rounded_rectangle([x,y,x+c.size[0]-1,y+c.size[1]-1],radius=16,outline=(78,78,92),width=2)

VISUELS=[
 ("01-tableau-de-bord.png","Tableau de bord","Astéroïde, population, climat : l’état du monde d’un coup d’œil.","Dashboard: meteor countdown, population, climate at a glance."),
 ("02-carte.png","Carte du monde en 3D","Calques, historique animé, districts et propriétés.","3D world map with layers, animated history, districts and plots."),
 ("03-statistiques.png","Statistiques","Plus de 200 séries du serveur, superposables et exportables.","200+ server statistics, overlay up to 6 series, CSV/PNG export."),
 ("04-ecologie.png","Écologie et climat","CO₂, température, pollutions : la santé de la planète.","Ecology: CO₂, temperature and pollution tracking."),
 ("05-reglement.png","Votre règlement","Rédigé depuis le panel, section par section.","Write your server rules right from the panel."),
 ("06-personnalisation.png","Personnalisation","Nom, couleur, logo, liens, rideau d’ouverture, sans rien recompiler.","Customise name, colour, logo, links and opening countdown, no rebuild needed."),
 ("07-sante.png","Administration","Santé, joueurs, console, chat, annonces, journal d’activité.","Admin area: health, players, console, chat, announcements, activity log."),
]
DECALAGES={"02-carte.png":230,"05-reglement.png":0,"06-personnalisation.png":0}
for i,(f,t,s,e) in enumerate(VISUELS,1):
    im=fond(); entete(im,t,s,e)
    capture(im,f,(90,370,1740,670),DECALAGES.get(f,0))
    im.convert('RGB').save(os.path.join(OUT,f"galerie-{i:02d}.png"),optimize=True)
    print('galerie',i)

# logo mod.io 16:9
im=fond(); d=ImageDraw.Draw(im)
logo=Image.open(LOGO).convert('RGBA').resize((300,300))
im.paste(logo,(170,390),logo)
d.text((520,350),"Eco Agora",font=font("segoeuib.ttf",150),fill=(255,255,255))
d.text((528,585),"Le panel web complet pour votre serveur Eco",font=font("segoeui.ttf",46),fill=(230,230,236))
d.text((530,655),"The complete web panel for your Eco server",font=font("segoeuii.ttf",34),fill=(255,150,90))
# planete : la sphere de la carte 3D, decoupee au plus pres et rendue parfaitement ronde
D=400
sph=Image.open(os.path.join(CAP,"02-carte.png")).convert('RGB').crop((680,331,1162,849)).resize((D,D),Image.LANCZOS)
# masque rond net (sur-echantillonne), legerement en retrait pour couper les franges grises
masque=Image.new('L',(D*4,D*4),0); ImageDraw.Draw(masque).ellipse([24,24,D*4-24,D*4-24],fill=255)
masque=masque.resize((D,D),Image.LANCZOS)
cx,cy=1440,90
halo=Image.new('RGBA',(W,H),(0,0,0,0)); ImageDraw.Draw(halo).ellipse([cx-30,cy-30,cx+D+30,cy+D+30],fill=(90,150,255,80))
halo=halo.filter(ImageFilter.GaussianBlur(36)); im.paste(halo,(0,0),halo)
im.paste(sph,(cx,cy),masque)
# eclairage : clair en haut a gauche, nuit en bas a droite (degrade radial)
nuit=Image.new('L',(D,D),170); nd=ImageDraw.Draw(nuit)
lx,ly=D*0.32,D*0.30
for i in range(170,-1,-2):
    r=D*0.12+(D*1.1)*(i/170)
    nd.ellipse([lx-r,ly-r,lx+r,ly+r],fill=int(i*0.85))
nuit=nuit.filter(ImageFilter.GaussianBlur(10))
nuit=Image.composite(nuit,Image.new('L',(D,D),0),masque)
im.paste(Image.new('RGB',(D,D),(6,8,18)),(cx,cy),nuit)
im.convert('RGB').save(os.path.join(OUT,"logo.png"),optimize=True)
print('logo')
