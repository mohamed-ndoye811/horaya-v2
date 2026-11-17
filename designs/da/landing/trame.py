"""Photo -> demi-teinte Brume (points d'encre sur papier). Usage : python3 trame.py entree.jpg sortie.png [pas]"""
import sys, math, random
from PIL import Image, ImageDraw, ImageOps, ImageEnhance

PAPIER, ENCRE = (232, 230, 225), (26, 26, 26)

def trame(src, dst, pas=7, echelle=2):
    im = ImageOps.grayscale(Image.open(src))
    im = ImageEnhance.Contrast(im).enhance(1.25)
    w, h = im.size
    out = Image.new('RGB', (w*echelle, h*echelle), PAPIER)
    d = ImageDraw.Draw(out)
    rnd = random.Random(7)
    for y in range(0, h, pas):
        for x in range(0, w, pas):
            v = im.getpixel((min(x + pas//2, w-1), min(y + pas//2, h-1))) / 255
            r = (1 - v) ** 0.9 * pas * 0.62 * echelle          # plus c'est sombre, plus le point est gros
            if r < 0.35*echelle: continue
            cx, cy = (x + pas/2)*echelle, (y + pas/2)*echelle
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ENCRE)
    # un grain très léger, pour l'impression
    px = out.load()
    for _ in range(out.size[0]*out.size[1]//18):
        x, y = rnd.randrange(out.size[0]), rnd.randrange(out.size[1])
        c = px[x, y]; k = rnd.randint(-18, 18)
        px[x, y] = tuple(max(0, min(255, v + k)) for v in c)
    out.save(dst, optimize=True)

if __name__ == '__main__':
    trame(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 7)
