"""Loader du sablier (noir = sable, clair = vide). Usage : python3 loader.py <dossier_images>
Écoulement : l'air du haut descend, le tas du bas monte (les biseaux se referment par dessous),
un espace reste en bas ; demi-tour ; l'espace remonte en fente ; on repasse par le logo."""
import math, os, sys
from sable import Glass, TOP0, TOP1, rect
from fillet import fillet

G = Glass(30.5)
K = (G.X1 - G.X0)/55
XO = G.X0 + 1*K                       # paroi extérieure des biseaux
CL, CR = G.X0 + 22*K, G.X1 - 22*K     # bords du filet (col)
SLOPE = (63.0 - 56.8)/((34.5 - 13.5)*K)   # pente du tas, celle des biseaux du logo
FLOOR, WALL_HI, WALL_LO = 82 - TOP0, 46.6, 55.2   # fond du bas ; paroi du haut du bas (col / extérieur)

def clip(poly, a, b, c):
    """Garde la partie de poly où a·x + b·y <= c."""
    out = []
    for i, p in enumerate(poly):
        q = poly[(i+1) % len(poly)]
        fp, fq = a*p[0] + b*p[1] - c, a*q[0] + b*q[1] - c
        if fp <= 0: out.append(p)
        if (fp < 0) != (fq < 0) and fp != fq:
            t = fp/(fp - fq); out.append((p[0] + (q[0]-p[0])*t, p[1] + (q[1]-p[1])*t))
    out = [p for i, p in enumerate(out) if math.dist(p, out[i-1]) > 1e-3]   # pas de points en double
    return out if len(out) >= 3 else None

def mirror_x(poly): return [(80 - x, y) for x, y in reversed(poly)]

def top_air(ys):
    """L'air du haut : l'intérieur de l'ampoule au-dessus de la surface du sable (y <= ys)."""
    inside = [(G.X1, TOP0), (G.X0, TOP0), (G.X0, 82 - WALL_LO), (CL, 82 - WALL_HI), (CR, 82 - WALL_HI), (G.X1, 82 - WALL_LO)]
    return clip(inside, 0, 1, ys)

def bottom_air(yo, slope, stream=True):
    """L'air du bas : au-dessus du tas, dont le sommet est au centre (pente vers chaque paroi)."""
    whole = [(XO, WALL_LO), (CL, WALL_HI), (CR, WALL_HI), (80 - XO, WALL_LO), (80 - XO, FLOOR), (XO, FLOOR)]
    if not stream:                    # fin : le sable s'est aplani, il ne reste qu'un espace en haut du bas
        air = clip(whole, 0, 1, yo)
        return [air] if air else []
    l = clip(clip(whole, 1, 0, CL) or [], slope, 1, yo + slope*XO)   # moitié gauche, sous sa pente
    return [p for p in (l, l and mirror_x(l)) if p]

def area(poly): return abs(sum(p[0]*q[1] - q[0]*p[1] for p, q in zip(poly, poly[1:] + poly[:1])))/2

# Calage : t = 0 juste après le retournement, t = T_LOGO le logo exact, t = 1 tout est passé.
YF = 57.5                                                    # le sable du bas, aplani, laisse un espace au-dessus
END_AIR = bottom_air(YF, 0.0, stream=False)[0]
YS0 = TOP0 + area(END_AIR)/(G.X1 - G.X0)                     # le même vide, remonté en fente après le demi-tour
YS_LOGO, YS1 = TOP1, 82 - WALL_HI
YO0, YO_LOGO = FLOOR + SLOPE*(40 - XO) + 0.5, 63.0           # pas encore de tas -> le tas du logo
T_LOGO = (YS_LOGO - YS0)/(YS1 - YS0)
smooth = lambda x: 0 if x <= 0 else 1 if x >= 1 else x*x*(3 - 2*x)

def flow(t):
    ys = YS0 + (YS1 - YS0)*t
    if t <= T_LOGO: yo, sl = YO0 + (YO_LOGO - YO0)*t/T_LOGO, SLOPE
    else:
        u = (t - T_LOGO)/(1 - T_LOGO)
        yo, sl = YO_LOGO + (YF - YO_LOGO)*u, SLOPE*(1 - smooth((u - 0.4)/0.6))   # le tas s'aplanit à la fin
    shapes = [top_air(ys)] + bottom_air(yo, sl, stream=t < 0.97)
    return [s_ for s_ in shapes if s_]

def resample(poly, n=64):
    pts = poly + [poly[0]]; L = [math.dist(pts[i], pts[i+1]) for i in range(len(poly))]; tot = sum(L)
    out, acc, i = [], 0.0, 0
    for k in range(n):
        d = tot*k/n
        while acc + L[i] < d: acc += L[i]; i += 1
        u = (d - acc)/L[i]; out.append((pts[i][0] + (pts[i+1][0]-pts[i][0])*u, pts[i][1] + (pts[i+1][1]-pts[i][1])*u))
    s = min(range(n), key=lambda j: (out[j][1], out[j][0]))  # même point de départ (le plus haut à gauche)
    return out[s:] + out[:s]

def morph(a, b, u):
    A, B = resample(a), resample(b)
    return [(p[0] + (q[0]-p[0])*u, p[1] + (q[1]-p[1])*u) for p, q in zip(A, B)]

def rot180(poly): return [(80 - x, 82 - y) for x, y in poly]

def path(shapes, r=1.6):
    return fillet(G.outer, 2.6) + ''.join(fillet(s, r) if len(s) < 12 else 'M' + 'L'.join('%.2f %.2f' % p for p in s) + 'Z' for s in shapes)

def cycle(fps=30):
    """Images (d, angle) d'un cycle complet."""
    ease = lambda x: 0.5 - 0.5*math.cos(math.pi*x)
    frames = []
    for i in range(int(1.6*fps)): frames.append((path(flow(i/(1.6*fps - 1))), 0))       # écoulement
    end = flow(1.0)
    for i in range(1, int(0.5*fps) + 1): frames.append((path(end), 180*ease(i/(0.5*fps))))  # demi-tour
    band = rot180(END_AIR); start = flow(0.0)                                               # l'espace remonte
    for i in range(1, int(0.35*fps) + 1):
        u = ease(i/(0.35*fps))
        frames.append((path([morph(band, start[0], u), rot180(end[0])] if u < 1 else start), 0))
    return frames

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    # self-check : au calage du logo, l'image est le logo (mêmes formes, à 0,2 près)
    import re
    pts = lambda d: sorted((round(float(a), 1), round(float(b), 1)) for a, b in re.findall(r'([-\d.]+) ([-\d.]+)(?=[AL]|Z)', d))
    got, want = pts(path(flow(T_LOGO))), pts(open('a-a85.d').read())
    assert len(got) == len(want) and all(abs(p[0]-q[0]) < 0.3 and abs(p[1]-q[1]) < 0.3 for p, q in zip(got, want)), 'le logo doit être une image du cycle'
    for n, (d, a) in enumerate(cycle()):
        open(f'{out}/f{n:03d}.svg', 'w').write(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -9 100 100"><rect x="-10" y="-9" width="100" height="100" fill="#E8E6E1"/>'
            f'<g transform="rotate({a:.2f} 40 41)"><path fill-rule="evenodd" d="{d}" fill="#1A1A1A"/></g></svg>')
    for k, t in [('lb0', 0), ('lb1', T_LOGO), ('lb2', 0.7), ('lb3', 1)]:
        open(f'{k}.d', 'w').write(path(flow(t)))
    print('ok', T_LOGO)
