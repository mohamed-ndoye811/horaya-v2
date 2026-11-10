import math, sys
ORIG = "M13.22 55.42L34.52 46.55L34.61 56.71L13.81 62.97L13.22 55.42ZM75.21 4.88L3.02 4.88L3.39 32.78L24.63 40.52L3.22 49.38L5.46 77.24L70.39 77.24L71.16 47.36L50.75 39.9L69.62 32.04L75.21 4.88ZM61.52 53.78L61.35 60.84L40.95 56.66L40.95 46.42L61.52 53.78ZM62.04 23.02L12.77 24.9L12.64 14.25L63.93 14.38L62.04 23.02Z"

def polys(d):
    out = []
    for sub in d.split('Z'):
        if not sub.strip(): continue
        pts = [tuple(map(float, p.strip().split())) for p in sub.replace('M', '').split('L')]
        if pts[0] == pts[-1]: pts = pts[:-1]
        out.append(pts)
    return out

def fillet(pts, r):
    """Replace every corner by a circular arc of radius r (capped at 45 % of the shorter edge)."""
    n = len(pts); segs = []
    for i in range(n):
        p0, p, p1 = pts[i-1], pts[i], pts[(i+1) % n]
        a = (p0[0]-p[0], p0[1]-p[1]); b = (p1[0]-p[0], p1[1]-p[1])
        la, lb = math.hypot(*a), math.hypot(*b)
        ua, ub = (a[0]/la, a[1]/la), (b[0]/lb, b[1]/lb)
        theta = math.acos(max(-1, min(1, ua[0]*ub[0] + ua[1]*ub[1])))
        t = r / math.tan(theta/2)
        t = min(t, 0.45*la, 0.45*lb)
        rr = t * math.tan(theta/2)
        s = (p[0]+ua[0]*t, p[1]+ua[1]*t); e = (p[0]+ub[0]*t, p[1]+ub[1]*t)
        cross = (p[0]-p0[0])*(p1[1]-p[1]) - (p[1]-p0[1])*(p1[0]-p[0])
        segs.append((s, e, rr, 1 if cross > 0 else 0))
    d = "M%.2f %.2f" % segs[0][0]
    for i, (s, e, rr, sw) in enumerate(segs):
        if i: d += "L%.2f %.2f" % s
        d += "A%.2f %.2f 0 0 %d %.2f %.2f" % (rr, rr, sw, e[0], e[1])
    return d + "Z"

def rounded(r): return ''.join(fillet(p, r) for p in polys(ORIG))

if __name__ == '__main__':
    # usage : python3 fillet.py (écrit les SVG dans le dossier courant)
    NS = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"'
    levels = {'0-original': None, '1-leger': 1.2, '2-moyen': 2.6, '3-marque': 4.5}
    for name, r in levels.items():
        d = ORIG if r is None else rounded(r)
        for cn, c in [('encre', '#1A1A1A'), ('papier', '#E8E6E1')]:
            open(f'{name}-{cn}.svg', 'w').write(f'<svg {NS}><path d="{d}" fill="{c}"/></svg>')
        if r:  # overlay: rounded shape + original outline, to judge what moved
            open(f'{name}-superposition.svg', 'w').write(
                f'<svg {NS}><path d="{d}" fill="#1A1A1A"/><path d="{ORIG}" fill="none" stroke="#974C42" stroke-width="0.35"/></svg>')
    print('ok')
