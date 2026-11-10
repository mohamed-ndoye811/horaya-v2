"""Versions symétriques de l'icône Horaya et logotypes. Usage : python3 sym.py (écrit les SVG ici)."""
import re, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'icone-adoucie'))
from fillet import fillet, polys, ORIG

def mirror_left(axis):
    """Keep the left half of the original drawing and mirror it around x = axis."""
    m = lambda p: (round(2*axis - p[0], 2), p[1])
    sandL, outer, sandR, slit = polys(ORIG)
    tl, l1, notch, l2, bl = outer[1], outer[2], outer[3], outer[4], outer[5]
    outer2 = [m(tl), tl, l1, notch, l2, bl, m(bl), m(l2), m(notch), m(l1)]
    slit2 = [(round(2*axis-12.7, 2), 24.6), (12.7, 24.6), (12.7, 14.3), (round(2*axis-12.7, 2), 14.3)]
    sandR2 = [m(p) for p in reversed(sandL)]
    return [sandL, outer2, sandR2, slit2]

def straight():
    """Redrawn on a clean grid: vertical sides, horizontal slit, notches at mid-height."""
    return [[(13.5, 55.2), (34.5, 46.6), (34.5, 56.8), (13.5, 63.0)],
            [(76, 5), (4, 5), (4, 33), (24, 41), (4, 49), (4, 77), (76, 77), (76, 49), (56, 41), (76, 33)],
            [(66.5, 55.2), (66.5, 63.0), (45.5, 56.8), (45.5, 46.6)],
            [(67.5, 24.5), (12.5, 24.5), (12.5, 14.5), (67.5, 14.5)]]

def d_of(ps, r=None):
    if r: return ''.join(fillet(p, r) for p in ps)
    return ''.join('M' + 'L'.join('%.2f %.2f' % q for q in p) + 'Z' for p in ps)

# --- letters of the current wordmark (logo.tsx), flattened so they can be filleted
src = open(os.path.join(os.path.dirname(__file__), '../../../../apps/web/src/components/app/logo.tsx')).read()
L = {n: re.search(r'const %s =\s*"([^"]+)"' % n, src).group(1) for n in 'HRAY'}

def flatten(d, steps=5):
    toks = re.findall(r'[MLHVQZ]|-?\d*\.?\d+', d); out = []; cur = None; i = 0; cmd = None; x = y = 0
    while i < len(toks):
        t = toks[i]
        if t in 'MLHVQZ': cmd = t; i += 1
        if cmd == 'Z':
            out.append(cur); cur = None; cmd = None; continue
        if cmd == 'M':
            x, y = float(toks[i]), float(toks[i+1]); i += 2; cur = [(x, y)]; cmd = 'L'
        elif cmd == 'L': x, y = float(toks[i]), float(toks[i+1]); i += 2; cur.append((x, y))
        elif cmd == 'H': x = float(toks[i]); i += 1; cur.append((x, y))
        elif cmd == 'V': y = float(toks[i]); i += 1; cur.append((x, y))
        elif cmd == 'Q':
            cx, cy, ex, ey = map(float, toks[i:i+4]); i += 4
            for k in range(1, steps+1):
                t_ = k/steps
                cur.append(((1-t_)**2*x + 2*(1-t_)*t_*cx + t_**2*ex, (1-t_)**2*y + 2*(1-t_)*t_*cy + t_**2*ey))
            x, y = ex, ey
    return [[p for j, p in enumerate(poly) if j == 0 or p != poly[j-1]] for poly in out]

def letters(r=None):
    g = ''
    for t, n in [(0, 'H'), (191.74, 'R'), (283.65, 'A'), (368.77, 'Y'), (446.21, 'A')]:
        ps = flatten(L[n]); d = d_of(ps, r) if r else L[n]
        g += '<path transform="translate(%s 0.2)" d="%s" fill="#1A1A1A"/>' % (t, d)
    return g

def logotype(icon_d, r_letters=None, box=(3.0, 4.88, 77.0, 77.24)):
    x0, y0, x1, y1 = box; s = min(89.6/(y1-y0), 89.68/(x1-x0)); w = (x1-x0)*s
    tx = 99.75 + (89.68 - w)/2 - x0*s; ty = 89.8 - y1*s
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 558.848 89.8">%s<path transform="translate(%.2f %.2f) scale(%.4f)" d="%s" fill="#1A1A1A"/></svg>'
            % (letters(r_letters), tx, ty, s, icon_d))

if __name__ == '__main__':
    NS = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"'
    variants = {'s1-miroir': mirror_left(37.8), 's2-droit': straight()}
    # the mirrored drawing is centred on 37.8: shift it to the middle of the 80 box
    shift = {'s1-miroir': 2.2, 's2-droit': 0}
    for k, ps in variants.items():
        ps = [[(x + shift[k], y) for x, y in p] for p in ps]
        for lvl, r in [('vif', None), ('adouci', 2.6)]:
            d = d_of(ps, r)
            open(f'{k}-{lvl}.svg', 'w').write(f'<svg {NS}><path d="{d}" fill="#1A1A1A"/></svg>')
            open(f'{k}-{lvl}.d', 'w').write(d)
            xs = [x for p in ps for x, _ in p]; ys = [y for p in ps for _, y in p]
            open(f'logo-{k}-{lvl}.svg', 'w').write(logotype(d, None, (min(xs), min(ys), max(xs), max(ys))))
            if lvl == 'adouci':
                open(f'logo-{k}-{lvl}-lettres-adoucies.svg', 'w').write(logotype(d, 3.0, (min(xs), min(ys), max(xs), max(ys))))
    # self-check: both variants are mirror-symmetric
    for k, ps in variants.items():
        pts = sorted((round(x + shift[k], 1), y) for p in ps for x, y in p)
        mir = sorted((round(80 - x, 1), y) for x, y in pts)
        assert pts == mir, k
    print('ok')

def letters_shifted(r, delta):
    """Lettres adoucies, R A Y A décalées de delta (pour un sablier plus étroit ou plus large)."""
    g = ''
    for t, n in [(0, 'H'), (191.74 + delta, 'R'), (283.65 + delta, 'A'), (368.77 + delta, 'Y'), (446.21 + delta, 'A')]:
        g += '<path transform="translate(%.2f 0.2)" d="%s" fill="#1A1A1A"/>' % (t, d_of(flatten(L[n]), r))
    return g
