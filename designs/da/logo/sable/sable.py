"""Le sable dans le sablier S2 : variantes, largeurs, images du loader. Usage : python3 sable.py"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'icone-adoucie')); sys.path.insert(0, os.path.join(HERE, '..', 'symetrique'))
from fillet import fillet

Y0, Y1, WALL = 5, 77, 8.5           # hauteur du sablier (= celle des lettres), épaisseur des parois
TOP0, TOP1, BOT1 = 14.5, 24.5, 67.5 # sable du haut plein ; fond de l'ampoule du bas (miroir autour de y = 41)
H = TOP1 - TOP0

def rect(x0, y0, x1, y1): return [(x1, y1), (x0, y1), (x0, y0), (x1, y0)]

class Glass:
    """Un sablier de demi-largeur hw (36 = la v0.3, carrée)."""
    def __init__(self, hw=36):
        self.x0, self.x1 = 40 - hw, 40 + hw
        self.X0, self.X1 = self.x0 + WALL, self.x1 - WALL
        n = 20 * hw / 36                 # profondeur des encoches, proportionnelle
        self.outer = [(self.x1, Y0), (self.x0, Y0), (self.x0, 33), (self.x0 + n, 41), (self.x0, 49),
                      (self.x0, Y1), (self.x1, Y1), (self.x1, 49), (self.x1 - n, 41), (self.x1, 33)]

    def top_sand(self, f):
        return rect(self.X0, TOP1 - H*f, self.X1, TOP1) if f > 0.02 else None

    def dune(self, f, slope=0.62):
        """Tas de sable à pente fixe, qui s'élargit jusqu'aux parois puis devient le rectangle plein."""
        if f <= 0.02: return None
        X0, X1 = self.X0, self.X1
        if f >= 0.999: return rect(X0, BOT1 - H, X1, BOT1)
        area, c, half = f*(X1 - X0)*H, (X0 + X1)/2, (X1 - X0)/2
        h = (area*slope)**0.5
        if h/slope <= half: return [(c + h/slope, BOT1), (c - h/slope, BOT1), (c, BOT1 - h)]
        lo, hi = 0.0, 40.0
        for _ in range(60):
            h = (lo + hi)/2; hw = h - half*slope
            lo, hi = (h, hi) if 2*half*hw + half*(h - hw) < area else (lo, h)
        hw = h - half*slope
        return [(X1, BOT1), (X0, BOT1), (X0, BOT1 - hw), (c, BOT1 - h), (X1, BOT1 - hw)]

    def grains(self, f_bottom, n=4):
        d = self.dune(f_bottom); top = TOP1 + 2.5; bottom = min(y for _, y in d) if d else BOT1
        step = (bottom - 2.5 - top)/(n - 1)
        return [rect(39, top + i*step - 1, 41, top + i*step + 1) for i in range(n)]

    def slit(self):
        return rect(self.X0, TOP0, self.X1, TOP1)

    def wedges(self, scale=1.0):
        """Les deux biseaux de la v0.3, recalés dans l'intérieur de ce sablier."""
        k = (self.X1 - self.X0)/55
        L = [(self.X0 + (x - 12.5)*k, y) for x, y in [(13.5, 55.2), (34.5, 46.6), (34.5, 56.8), (13.5, 63.0)]]
        cx = sum(p[0] for p in L)/4; cy = sum(p[1] for p in L)/4
        L = [(cx + (x-cx)*scale, cy + (y-cy)*scale) for x, y in L]
        return [L, [(80-x, y) for x, y in reversed(L)]]

    def d(self, shapes, r_outer=2.6, r_sand=1.6):
        return fillet(self.outer, r_outer) + ''.join(fillet(s, r_sand) for s in shapes if s)

def logotype(glass, icon_d):
    """Le mot avec le sablier à la place du « o » ; les lettres suivantes se décalent selon sa largeur."""
    from sym import letters_shifted
    s = 89.6/(Y1 - Y0); w = (glass.x1 - glass.x0)*s; delta = w - 89.6
    tx = 99.75 - glass.x0*s; ty = 89.8 - Y1*s
    W = 558.848 + delta
    return W, (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.2f} 89.8">{letters_shifted(3.0, delta)}'
               f'<path transform="translate({tx:.2f} {ty:.2f}) scale({s:.4f})" fill-rule="evenodd" d="{icon_d}" fill="#1A1A1A"/></svg>')



# --- Loader du sablier A : la fente du haut se creuse en entonnoir et finit en deux biseaux retournés,
# les biseaux du bas se remplissent jusqu'à faire la fente. Retourné de 180°, l'état final = le logo.
def lerp(a, b, t): return [(ax + (bx-ax)*t, ay + (by-ay)*t) for (ax, ay), (bx, by) in zip(a, b)]
def flip_y(poly): return [(x, 82 - y) for x, y in poly]

def mirror_x(poly): return [(80 - x, y) for x, y in reversed(poly)]

def loader_frame(g, f):
    """f = avancement de l'écoulement (0 = le logo, 1 = le logo retourné)."""
    c = (g.X0 + g.X1)/2
    wl, _ = g.wedges()                       # biseau gauche : haut-ext, haut-int, bas-int, bas-ext
    top_l = [(g.X0, TOP1), (c, TOP1), (c, TOP0), (g.X0, TOP0)]           # bas-ext, bas-int, haut-int, haut-ext
    bot_l = [(g.X0, 82 - TOP1), (c, 82 - TOP1), (c, 82 - TOP0), (g.X0, 82 - TOP0)]
    left = []
    left.append(None if f <= 0.001 else lerp(top_l, flip_y(wl), f))
    left.append(None if f >= 0.999 else lerp(wl, bot_l, f))
    shapes = [s_ for s_ in left if s_] + [mirror_x(s_) for s_ in left if s_]
    if f <= 0.001: shapes.append(g.slit())
    if f >= 0.999: shapes.append(rect(g.X0, 82 - TOP1, g.X1, 82 - TOP0))
    return g.d(shapes)


NS = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"'

def save(name, d):
    open(f'{name}.d', 'w').write(d)
    open(f'{name}.svg', 'w').write(f'<svg {NS}><path fill-rule="evenodd" d="{d}" fill="#1A1A1A"/></svg>')

if __name__ == '__main__':
    g = Glass(36)
    save('a-actuel', g.d([rect(12.5, TOP0, 67.5, TOP1)] + g.wedges(1.0)))
    save('b-reduit', g.d([rect(17, 16.5, 63, 23)] + g.wedges(0.78)))
    save('c-dune-grains', g.d([g.top_sand(0.55), *g.grains(0.45), g.dune(0.45)]))
    save('d-dune', g.d([g.top_sand(0.55), g.dune(0.45)]))
    for hw, tag in [(36, 'a100'), (30.5, 'a85'), (26, 'a72')]:
        gw = Glass(hw); d = gw.d([gw.slit()] + gw.wedges()); save(f'a-{tag}', d)
        W, svg = logotype(gw, d); open(f'logo-a-{tag}.svg', 'w').write(svg); open(f'logo-a-{tag}.w', 'w').write(f'{W:.2f}')
    for hw, tag in [(36, 'l100'), (30.5, 'l85'), (26, 'l72')]:
        gw = Glass(hw); d = gw.d([gw.top_sand(0.55), gw.dune(0.45)]); save(f'd-dune-{tag}', d)
        W, svg = logotype(gw, d); open(f'logo-d-dune-{tag}.svg', 'w').write(svg); open(f'logo-d-dune-{tag}.w', 'w').write(f'{W:.2f}')
    for k, f in [('l0', 0), ('l1', 0.34), ('l2', 0.67), ('l3', 1)]:
        save(k, g.d([g.top_sand(1 - f), *(g.grains(f) if 0 < f < 1 else []), g.dune(f)]))
    # self-check : le bas plein, retourné de 180°, redonne exactement le haut plein (boucle sans saut)
    fb = g.dune(1.0); assert sorted((round(80-x, 2), round(82-y, 2)) for x, y in fb) == sorted((round(x, 2), round(y, 2)) for x, y in g.top_sand(1.0))
    g = Glass(30.5)
    for k, f in [('la0', 0), ('la1', 0.33), ('la2', 0.66), ('la3', 1)]:
        save(k, loader_frame(g, f))
    # self-check : l'état final retourné de 180° autour de (40, 41) est le logo de départ
    import re
    pts = lambda d: sorted((round(float(a), 1), round(float(b), 1)) for a, b in re.findall(r'([-\d.]+) ([-\d.]+)(?=[AL]|Z)', d))
    rot = lambda d: sorted((round(80 - x, 1), round(82 - y, 1)) for x, y in pts(d))
    assert all(abs(p[0]-q[0]) < 0.15 and abs(p[1]-q[1]) < 0.15 for p, q in zip(rot(open('la3.d').read()), pts(open('a-a85.d').read()))), 'boucle'
    print('loader ok')
