# Modelos 3D propios, generados con Blender a partir de fotos de referencia:
#   blender -b -P scripts/blender-models.py
# Salen a src/assets/models/: jerusalen.glb, llave.glb, maleta.glb
import bpy, bmesh, math, os, random
import numpy as np

random.seed(7)
np.random.seed(7)
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src', 'assets', 'models')
os.makedirs(OUT, exist_ok=True)
TAU = math.tau


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb(hexa):
    return tuple(int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5))


def lin(c):
    return tuple(x / 12.92 if x < .04045 else ((x + .055) / 1.055) ** 2.4 for x in c)


# ---------------------------------------------------------------- Texturas
def to_image(name, px):
    h, w, _ = px.shape
    im = bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.dstack([np.clip(px, 0, 1), np.ones((h, w))])
    im.pixels.foreach_set(rgba.ravel().astype(np.float32))
    im.pack()
    return im


def mottle(size, cells, amp):
    n = np.random.rand(cells + 1, cells + 1)
    n[-1], n[:, -1] = n[0], n[:, 0]
    t = np.linspace(0, cells, size, endpoint=False)
    i, f = t.astype(int), t % 1
    f = f * f * (3 - 2 * f)
    row = n[i][:, i] * (1 - f)[None] + n[i][:, i + 1] * f[None]
    row2 = n[i + 1][:, i] * (1 - f)[None] + n[i + 1][:, i + 1] * f[None]
    n = row * (1 - f)[:, None] + row2 * f[:, None]
    return 1 + (n - .5) * amp


def stone(name, base, size=768, rows=10, cols=5, var=.09, joint=.72):
    """Sillares: hiladas decaladas, cada bloque con su tono."""
    b = np.array(srgb(base))
    px = np.zeros((size, size, 3))
    rh = size / rows
    for r in range(rows):
        xs = [0]
        while xs[-1] < size:
            xs.append(xs[-1] + int(size / cols * random.uniform(.6, 1.4)))
        xs[-1] = size
        for x0, x1 in zip(xs, xs[1:]):
            t = 1 + random.uniform(-var, var)
            warm = random.uniform(-.018, .018)
            y0, y1 = round(r * rh), round((r + 1) * rh)
            px[y0:y1, x0:x1] = b * t + (warm, 0, -warm)
            px[y0:y1, x0:x0 + 2] *= joint
        px[round(r * rh):round(r * rh) + 2] *= joint
    px *= mottle(size, 64, .12)[..., None] * mottle(size, 6, .16)[..., None]
    px *= (1 + (np.random.rand(size, size) - .5) * .09)[..., None]
    return to_image(name, px)


def tiles(name):
    """Azulejo de la Cúpula: azul y turquesa con rombos y estrellas blancas."""
    s = 512
    y, x = np.mgrid[0:s, 0:s] / s
    u, v = (x * 6) % 1 - .5, (y * 6) % 1 - .5
    px = np.ones((s, s, 3)) * srgb('#1d5f94')
    px[np.abs(u) + np.abs(v) < .46] = srgb('#2f9dbb')
    px[np.abs(u) + np.abs(v) < .3] = srgb('#123f73')
    px[np.abs(u) + np.abs(v) < .13] = srgb('#e9e4d2')
    px[(np.abs(u) > .47) | (np.abs(v) > .47)] = srgb('#d9d2bb')
    px *= (1 + (np.random.rand(s, s) - .5) * .08)[..., None]
    return to_image(name, px)


def roofing(name):
    s = 256
    px = np.ones((s, s, 3)) * srgb('#a9502f')
    for r in range(10):
        y0 = r * s // 10
        px[y0:y0 + s // 10] *= random.uniform(.84, 1.1)
        px[y0:y0 + 3] *= .55
        for c in range(0, s, s // 10):
            px[y0:y0 + s // 10, (c + r * 13) % s:((c + r * 13) % s) + 2] *= .7
    return to_image(name, px)


def leather(name):
    s = 512
    px = np.ones((s, s, 3)) * srgb('#6e4a2c')
    px *= mottle(s, 5, .5)[..., None] * mottle(s, 40, .16)[..., None]
    for _ in range(26):  # rayones y roces del viaje
        x, y, a, L = random.randrange(s), random.randrange(s), random.uniform(0, TAU), random.randrange(20, 170)
        for k in range(L):
            i, j = int(y + k * math.sin(a)) % s, int(x + k * math.cos(a)) % s
            px[i, j:j + 1] = px[i, j:j + 1] * .8 + np.array(srgb('#c9a982')) * .2
    return to_image(name, px)


def textured(name, image, rough=.9, metal=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n = m.node_tree
    p = n.nodes['Principled BSDF']
    t = n.nodes.new('ShaderNodeTexImage')
    t.image = image
    n.links.new(t.outputs['Color'], p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    return m


def flat(name, color, rough=.85, metal=0.):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*lin(srgb(color)), 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    return m


# ---------------------------------------------------------------- Geometría
class Scene:
    """Junta toda la geometría por material: rápido y un objeto por material."""

    def __init__(self):
        self.parts = {}

    def bm(self, m):
        return self.parts.setdefault(m, bmesh.new())

    def poly(self, m, rings, close=True, smooth=False, cap=True):
        bm = self.bm(m)
        vs = [[bm.verts.new(p) for p in r] for r in rings]
        out = []
        for a, b in zip(vs, vs[1:]):
            n = len(a)
            for j in range(n if close else n - 1):
                out.append(bm.faces.new((a[j], a[(j + 1) % n], b[(j + 1) % n], b[j])))
        if cap:
            out.append(bm.faces.new(vs[-1]))
        for f in out:
            f.smooth = smooth

    def box(self, m, x, y, z, sx, sy, sz, rot=0, taper=1.):
        c, s = math.cos(rot), math.sin(rot)
        q = [(-1, -1), (1, -1), (1, 1), (-1, 1)]

        def ring(zz, k):
            return [(x + (u * sx * c - v * sy * s) * k / 2, y + (u * sx * s + v * sy * c) * k / 2, zz) for u, v in q]
        self.poly(m, [ring(z, 1), ring(z + sz, taper)])

    def prism(self, m, x, y, z, r0, r1, h, n=16, rot=0, smooth=False):
        ring = lambda rr, zz: [(x + rr * math.cos(rot + j / n * TAU), y + rr * math.sin(rot + j / n * TAU), zz) for j in range(n)]
        if r1 <= 0:
            r1 = .001
        self.poly(m, [ring(r0, z), ring(r1, z + h)], smooth=smooth)

    def lathe(self, m, x, y, z, prof, n=32, rib=0., smooth=True):
        rings = []
        for pr, pz in prof:
            rings.append([(x + pr * (1 + rib * (j % 2)) * math.cos(j / n * TAU), y + pr * (1 + rib * (j % 2)) * math.sin(j / n * TAU), z + pz) for j in range(n)])
        self.poly(m, rings, smooth=smooth)

    def dome(self, m, x, y, z, r, squash=1., pointed=0., n=32, steps=10, rib=0., smooth=True):
        prof = []
        for i in range(steps + 1):
            t = i / steps * math.pi / 2
            pr, pz = r * math.cos(t), r * squash * math.sin(t)
            if pointed:  # apenas apuntada, con el vientre algo más ancho
                pr *= 1 + pointed * .6 * math.sin(t * 2)
                pz *= 1 + pointed * (i / steps) ** 3
            prof.append((max(pr, r * .015), pz))
        self.lathe(m, x, y, z, prof, n, rib, smooth)

    def arch(self, m, x, y, z, w, h, a, d=.08):
        """Vano de arco sobre una pared cuya normal apunta al ángulo a."""
        nx, ny, ux, uy = math.cos(a), math.sin(a), -math.sin(a), math.cos(a)
        out = [(-w / 2, 0), (w / 2, 0)]
        for i in range(9):
            t = i / 8 * math.pi
            out.append((w / 2 * math.cos(t), h - w / 2 + w / 2 * math.sin(t)))
        self.poly(m, [[(x + nx * s + ux * u, y + ny * s + uy * u, z + v) for u, v in out] for s in (-d, d)])

    def slab(self, m, pts, z0, z1):
        self.poly(m, [[(x, y, z0) for x, y in pts], [(x, y, z1) for x, y in pts]])

    def ramp(self, m, a, b, w, t):
        (x0, y0, z0), (x1, y1, z1) = a, b
        L = math.hypot(x1 - x0, y1 - y0)
        px, py = -(y1 - y0) / L * w / 2, (x1 - x0) / L * w / 2
        q = lambda dz: [(x0 + px, y0 + py, z0 + dz), (x1 + px, y1 + py, z1 + dz), (x1 - px, y1 - py, z1 + dz), (x0 - px, y0 - py, z0 + dz)]
        self.poly(m, [q(-t), q(0)])

    def finish(self, uv):
        for m, bm in self.parts.items():
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            if m in uv:
                s = uv[m]
                layer = bm.loops.layers.uv.new('UVMap')
                for f in bm.faces:
                    n = f.normal
                    for l in f.loops:
                        p = l.vert.co
                        if abs(n.z) > .7:
                            l[layer].uv = (p.x / s, p.y / s)
                        elif abs(n.x) > abs(n.y):
                            l[layer].uv = (p.y / s, p.z / s)
                        else:
                            l[layer].uv = (p.x / s, p.z / s)
            me = bpy.data.meshes.new(m.name)
            bm.to_mesh(me)
            bm.free()
            me.materials.append(m)
            bpy.context.collection.objects.link(bpy.data.objects.new(m.name, me))


def export(name):
    path = os.path.join(OUT, name)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True, export_cameras=False, export_lights=False, export_image_format='JPEG', export_jpeg_quality=78)
    print('EXPORT', name, os.path.getsize(path) >> 10, 'KB')


# ----------------------------------------------------------------- Jerusalén
# Maqueta de la Ciudad Vieja. Unidades ≈ 10 m, norte = +Y. Los monumentos van
# agrandados para que se lean: la planta es fiel, la escala no.
WALL = [(-48, 26), (-20, 48), (32, 50), (52, 44), (52, -38), (20, -39), (10, -46), (-18, -40), (-48, -34)]
HARAM = [(20, -38), (51, -37), (51, 14), (18, 16)]
PLAZA = (6, 19.2, -27, -6)  # plaza del Muro
D = (34, -4)  # Cúpula de la Roca
A = (33, -30)  # Al-Aqsa
S = (-16, 8)  # Santo Sepulcro


def inside(poly, x, y):
    c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def terrain(x, y):
    """Valle del Cedrón al este y Monte de los Olivos subiendo detrás."""
    if inside(WALL, x, y):
        return -.8  # intramuros, plano: el terreno no asoma por las plazas
    return -.8 - 7 * math.exp(-((x - 67) / 10) ** 2) + max(0, x - 78) * .3 - max(0, -40 - y) * .12 + .5 * math.sin(x * .09) * math.cos(y * .07)


def tree(g, leaf, cyp, x, y, z, kind):
    if kind:  # ciprés
        g.prism(cyp, x, y, z, .36, 0, random.uniform(2.6, 3.8), 7)
    else:  # pino u olivo
        for _ in range(3):
            g.dome(leaf, x + random.uniform(-.5, .5), y + random.uniform(-.5, .5), z + random.uniform(.8, 1.5), random.uniform(.9, 1.4), .8, n=7, steps=3, smooth=False)


def minaret(g, st, lead, x, y, h, round_=False):
    n = 16 if round_ else 4
    rot = 0 if round_ else math.pi / 4
    g.prism(st, x, y, 3, .85, .8, h, n, rot)
    g.prism(st, x, y, 3 + h, 1.15, 1.15, .2, n, rot)
    g.prism(st, x, y, 3.2 + h, .5, .46, 1.1, 12)
    g.dome(lead, x, y, 4.3 + h, .5, 1.1, n=12, steps=5)


def jerusalem():
    clear()
    img = {k: stone(*v) for k, v in {
        'casa_a': ('casa_a', '#e6dcc6', 512, 8, 5, .05),
        'casa_b': ('casa_b', '#d6c5a2', 512, 8, 5, .06),
        'casa_c': ('casa_c', '#c9bda6', 512, 8, 5, .06),
        'muralla': ('muralla', '#c2b08c', 768, 14, 7, .07),
        'muro': ('muro', '#b4a688', 1024, 12, 3.4, .1, .6),
        'pavim': ('pavim', '#d6c9ae', 768, 8, 5, .05, .9),
        'sepul': ('sepul', '#b39a76', 768, 14, 7, .1),
    }.items()}
    casa = [textured(f'casa{i}', img[k]) for i, k in enumerate(('casa_a', 'casa_b', 'casa_c'))]
    wallm = textured('muralla_t', img['muralla'])
    muro = textured('muro_t', img['muro'])
    pav = textured('pavim_t', img['pavim'])
    sep = textured('sepul_t', img['sepul'])
    tile = textured('azulejo', tiles('azulejo_i'), .35)
    roof = textured('tejas', roofing('tejas_i'))
    ground = flat('suelo', '#a68f68')
    grass = flat('hierba', '#7f7a4b')
    gold = flat('oro', '#f0bd2c', .24, 1.)
    lead = flat('plomo', '#5b656e', .62, 0.)
    lead2 = flat('plomo_claro', '#9aa2a2', .7, 0.)
    grey = flat('panel', '#c9c4b8', .5)
    people = flat('gente', '#2b2a2c')
    dark = flat('vano', '#23221f', .9)
    blue = flat('vano_azul', '#0e2f55', .5)
    marble = flat('marmol', '#efe9dc', .4)
    wood = flat('madera', '#7b4a26')
    leaf = flat('copa', '#5c6e3a')
    cyp = flat('cipres', '#2c4128')
    g = Scene()

    # Terreno
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=90, y_subdivisions=90, size=520)
    t = bpy.context.object
    for v in t.data.vertices:
        v.co.z = terrain(v.co.x, v.co.y)
    t.data.materials.append(ground)
    t.name = 'terreno'

    # Muralla otomana: almenas, torres cada tanto
    n = len(WALL)
    for i in range(n):
        (x1, y1), (x2, y2) = WALL[i], WALL[(i + 1) % n]
        L, a = math.hypot(x2 - x1, y2 - y1), math.atan2(y2 - y1, x2 - x1)
        g.box(wallm, (x1 + x2) / 2, (y1 + y2) / 2, -4, L + 1, 1.3, 7.8, a)
        for k in range(int(L / 1.5)):
            f = (k + .5) / int(L / 1.5)
            g.box(wallm, x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, 3.8, .7, 1.3, .7, a)
        g.box(wallm, x1, y1, -4, 3, 3, 9)
        for f in (.33, .66):
            g.box(wallm, x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, -4, 2.1, 2.1, 8.5, a)

    # Puertas: Damasco, Jaffa con la Ciudadela, Dorada
    g.box(wallm, -3, 49, -.8, 7, 3.2, 6.8)
    g.arch(dark, -3, 47.4, -.8, 2, 3.4, -math.pi / 2)
    g.arch(dark, -3, 50.6, -.8, 2, 3.4, math.pi / 2)
    g.box(wallm, -45, -3, -.8, 9, 10, 6)
    g.prism(wallm, -44, 0, 5.2, 2.3, 2.3, 2.6, 18)
    g.prism(wallm, -47, -7, 0, 1.2, 1.1, 8.5, 16)
    g.prism(wallm, -47, -7, 8.5, 1.5, 1.5, .25, 16)
    g.dome(lead2, -47, -7, 8.75, .8, 1.1, n=12, steps=5)
    g.box(wallm, 52, -2, -.8, 3, 7, 6.2)
    for dy in (-1.5, 1.5):
        g.arch(dark, 53.5, -2 + dy, -.2, 2, 3.2, 0)

    # Explanada: gran plataforma trapezoidal, paredes altas al sur y al este
    g.slab(muro, HARAM, -6, 3)
    g.slab(pav, [(x + (.12 if x < 30 else -.12), y + (.12 if y < 0 else -.12)) for x, y in HARAM], 3, 3.08)
    # Jardines del norte y del este, con árboles como en la foto aérea
    for b in ([(21, 7), (50, 6), (50, 13.5), (20, 15)], [(44, -24), (50, -24), (50, 6), (44, 6)]):
        g.slab(grass, b, 3.05, 3.13)
    for _ in range(46):
        x, y = random.uniform(21, 50), random.uniform(8, 14.5)
        tree(g, leaf, cyp, x, y, 3.1, random.random() < .55)
    for _ in range(38):
        x, y = random.uniform(44.5, 50), random.uniform(-23, 7)
        tree(g, leaf, cyp, x, y, 3.1, random.random() < .4)
    for x, y in [(25, -17), (27, -19), (39, -19), (41, -17), (40, -21), (24, -21), (43, -16)]:
        tree(g, leaf, cyp, x, y, 3.1, True)

    # Plataforma alta con arquerías en las escaleras
    Dx, Dy = D
    g.box(pav, Dx, Dy, 3, 17, 15, .9)
    Z = 3.9
    for bx, by, rot in ((Dx - 3.5, Dy + 7.5, 0), (Dx + 3.5, Dy - 7.5, 0), (Dx + 8.5, Dy, math.pi / 2), (Dx - 8.5, Dy + 2, math.pi / 2), (Dx - 3.5, Dy - 7.5, 0)):
        g.box(marble, bx, by, Z, 3.8, .3, 1.7, rot)
        for k in (-1, 0, 1):
            ox, oy = k * math.cos(rot) * 1.15, k * math.sin(rot) * 1.15
            g.arch(dark, bx + ox, by + oy, Z, .8, 1.35, rot + math.pi / 2, .2)
    # Cúpula de la Roca: mármol abajo, azulejo arriba, tambor y oro
    R = 5.4
    ap = R * math.cos(math.pi / 8)
    g.prism(marble, Dx, Dy, Z, R, R, 2, 8, math.pi / 8)
    g.prism(tile, Dx, Dy, Z + 2, R, R, 1.9, 8, math.pi / 8)
    g.prism(marble, Dx, Dy, Z + 3.9, R + .03, R + .03, .16, 8, math.pi / 8)
    g.prism(lead, Dx, Dy, Z + 4.06, R - .15, 2.9, .55, 32)  # techo bajo entre muro y tambor
    g.prism(tile, Dx, Dy, Z + 4.6, 2.85, 2.85, 2, 32)
    g.prism(marble, Dx, Dy, Z + 6.6, 2.92, 2.92, .1, 32)
    g.dome(gold, Dx, Dy, Z + 6.7, 2.8, 1.02, .07, 48, 14)
    g.prism(gold, Dx, Dy, Z + 9.5, .09, .04, .8, 8)
    for k in range(8):
        a = k * math.pi / 4
        fx, fy = math.cos(a), math.sin(a)
        for j in range(-2, 3):  # ventanas arqueadas en el azulejo
            wx, wy = Dx + ap * fx - fy * j * .75, Dy + ap * fy + fx * j * .75
            g.arch(blue, wx, wy, Z + 2.3, .5, 1.25, a)
        for j in range(-3, 4):  # paneles de mármol
            g.box(grey, Dx + (ap + .02) * fx - fy * j * .56, Dy + (ap + .02) * fy + fx * j * .56, Z + .3, .44 if fy == 0 else .06, .06 if fy == 0 else .44, 1.4, 0)
        if k % 2 == 0:  # portales en los cuatro puntos cardinales
            g.box(marble, Dx + (ap + .4) * fx, Dy + (ap + .4) * fy, Z, 1.8 if fy == 0 else 1.2, 1.2 if fy == 0 else 1.8, 1.5, 0)
            g.arch(dark, Dx + (ap + 1) * fx, Dy + (ap + 1) * fy, Z, .8, 1.25, a)
    for k in range(16):
        a = k / 16 * TAU
        g.arch(blue, Dx + 2.85 * math.cos(a), Dy + 2.85 * math.sin(a), Z + 4.95, .42, 1.15, a)
    # Cúpula de la Cadena, a su lado
    g.prism(marble, Dx + 8, Dy - 1, Z, 1.1, 1.1, 1.1, 8)
    g.dome(lead, Dx + 8, Dy - 1, Z + 1.1, 1, .9, n=16, steps=6)

    # Al-Aqsa: nave de techo gris y cúpula de plomo al sur
    Ax, Ay = A
    g.box(sep, Ax, Ay, 3, 8.5, 13, 2.7)
    g.box(lead2, Ax, Ay + 1, 5.7, 7, 10, .9, 0, .55)
    g.box(lead2, Ax - 3.6, Ay + .5, 5.7, 1.4, 11, .2)
    g.box(lead2, Ax + 3.6, Ay + .5, 5.7, 1.4, 11, .2)
    g.box(sep, Ax, Ay + 7, 3, 9, 1.4, 2)
    for k in range(-3, 4):
        g.arch(dark, Ax + k * 1.15, Ay + 7.7, 3, .8, 1.5, math.pi / 2)
    g.prism(sep, Ax, Ay - 4.2, 5.7, 2.1, 2.1, 1, 16)
    g.dome(lead, Ax, Ay - 4.2, 6.7, 2.2, .95, n=36, steps=8, rib=.02)

    # Minaretes de la Explanada
    minaret(g, sep, lead, 18.8, -9, 7.5)
    minaret(g, sep, lead, 18.6, 16, 7)
    minaret(g, sep, lead, 19.8, -37, 6.2)
    minaret(g, sep, lead, 40, 14.6, 6.5, True)

    # Plaza y Muro Occidental: sillares enormes, tramo de oración y rampa de Mughrabi
    x0, x1, y0, y1 = PLAZA
    g.box(muro, 19.5, -18, -1, .9, 19, 4.2)
    g.box(sep, 19.7, -18, 3.2, 1.2, 19, .25)
    g.slab(pav, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], -1, -.5)
    g.box(pav, 8.2, (y0 + y1) / 2, -.5, 4.4, y1 - y0, .4)  # plaza superior
    g.box(wood, 15.2, -18, -.5, .12, 11, .26)  # valla del sector de oración
    g.box(wood, 17.2, -18, -.5, 4, .12, .3)  # división
    for _ in range(120):  # la gente da la escala del Muro
        px_, py = random.uniform(10.8, 18.6), random.uniform(-25.5, -9.5)
        g.box(people, px_, py, -.5, .08, .08, .26)
    g.ramp(wood, (9, -25.6, -.1), (19, -24.8, 3.1), 1.3, .3)
    g.ramp(lead2, (9, -25.6, .7), (19, -24.8, 4), 1.5, .12)
    for dy in (.72, -.72):
        g.ramp(wood, (9, -25.6 + dy, .1), (19, -24.8 + dy, 3.5), .1, .75)
    # Casas altas al oeste de la plaza, con arcos sobre el nivel del suelo
    g.box(casa[1], 3.5, -18, -.8, 5, 19, 4)
    for k in range(5):
        g.arch(dark, 6, -25 + k * 3.5, -.8, 1.3, 1.9, 0, .1)
    for gx, gy in [(4, -24), (4.5, -18), (3.5, -12)]:
        g.box(casa[0], gx, gy, 3.2, 3.4, 3.6, 1.4)

    # Santo Sepulcro: rotonda al oeste, catolicón al este, campanario, fachada sur y patio
    Sx, Sy = S
    g.box(sep, Sx + 2.5, Sy, -.8, 12, 8.5, 5.8)
    g.box(sep, Sx - 3.2, Sy + .4, -.8, 7.8, 7.8, 6.6)
    g.box(sep, Sx + 3.5, Sy, 5, 7.5, 6, 1.2)
    # Rotonda: gran cúpula gris acanalada, con linterna
    g.prism(sep, Sx - 3.2, Sy + .4, 5.8, 3.7, 3.7, .7, 32)
    g.dome(lead, Sx - 3.2, Sy + .4, 6.5, 3.7, .84, n=72, steps=16, rib=.014, smooth=False)
    g.prism(lead2, Sx - 3.2, Sy + .4, 9.5, .62, .5, .5, 16)
    g.prism(gold, Sx - 3.2, Sy + .4, 10, .05, .05, .75, 6)
    g.box(gold, Sx - 3.2, Sy + .4, 10.45, .34, .06, .07)
    # Catolicón: tambor de piedra con ventanas y cúpula gris
    Cx, Cy = Sx + 3.4, Sy + .2
    g.prism(sep, Cx, Cy, 6.2, 2.3, 2.3, 1.8, 24)
    g.prism(sep, Cx, Cy, 8, 2.42, 2.42, .12, 24)
    for k in range(10):
        a = k / 10 * TAU
        g.arch(dark, Cx + 2.3 * math.cos(a), Cy + 2.3 * math.sin(a), 6.5, .4, 1.1, a)
    g.dome(lead, Cx, Cy, 8.1, 2.35, .92, n=56, steps=14, rib=.014, smooth=False)
    g.prism(gold, Cx, Cy, 10.2, .06, .06, 1.1, 6)
    g.box(gold, Cx, Cy, 10.9, .5, .08, .09)
    # Ábside redondo al este y cúpula clara de la capilla
    g.prism(sep, Sx + 9.2, Sy, -.8, 3, 3, 5.4, 24)
    g.prism(pav, Sx + 9.2, Sy, 4.6, 3.05, 2.2, .35, 24)
    g.prism(sep, Sx + 5, Sy - 5, 4, 1.25, 1.25, .9, 12)
    g.dome(marble, Sx + 5, Sy - 5, 4.9, 1.3, .92, n=20, steps=7)
    # Fachada sur: dos arcos dobles, dos pisos
    Fy = Sy - 4.26
    for dx in (-.3, 2.6):
        g.arch(dark, Sx + dx, Fy, -.8, 2.2, 2.9, -math.pi / 2)
        g.arch(dark, Sx + dx, Fy, 2.3, 1.4, 2.2, -math.pi / 2)
    # Campanario con techo de tejas
    Bx, By = Sx - 2.8, Sy - 5.1
    g.box(sep, Bx, By, -.8, 3, 3, 8)
    g.box(roof, Bx, By, 7.2, 3.5, 3.5, 1, 0, .22)
    for side, a in ((-1, -math.pi / 2), (1, math.pi / 2)):
        for dx in (-.68, .68):
            g.arch(dark, Bx + dx, By + side * 1.5, 4.6, .95, 1.9, a)
            g.arch(dark, Bx + dx, By + side * 1.5, 1.4, 1, 2, a)
    for dy in (-.68, .68):
        g.arch(dark, Bx - 1.5, By + dy, 4.6, .95, 1.9, math.pi)
    g.box(pav, Sx + 3, Sy - 7.2, -.8, 11, 5.4, .18)  # patio

    # Hurva, cúpula blanca del barrio judío, y torre del Redentor
    g.prism(casa[0], 2, -28, 0, 2.2, 2.2, 4.5, 16)
    g.dome(marble, 2, -28, 4.5, 2.3, 1, n=28, steps=8)
    g.box(sep, -8, 21, -.8, 2, 2, 9.5)
    g.box(lead2, -8, 21, 8.7, 2.3, 2.3, 1.5, 0, .1)

    # Tejido urbano: callejones, patios, terrazas, cúpulas chicas y techos de teja
    reserved = [(x0 - 3, x1, y0 - 2, y1 + 1), (Sx - 8, Sx + 13, Sy - 10, Sy + 6), (-52, -39, -13, 7), (-.5, 4.6, -30.5, -25.5), (-9.5, -6.5, 19.5, 22.5), (-7.5, 1.5, 45, 54)]
    STEP = 2.15
    for gx in np.arange(-50, 56, STEP):
        for gy in np.arange(-48, 54, STEP):
            x, y = gx + random.uniform(-.35, .35), gy + random.uniform(-.35, .35)
            if not inside(WALL, x, y) or inside(HARAM, x, y):
                continue
            if any(a <= x <= b and c <= y <= d for a, b, c, d in reserved):
                continue
            # Ejes: Cardo norte-sur, calle David este-oeste, Vía Dolorosa
            if abs(x + 3) < .95 or abs(y + 3) < .85 or (abs(y - 19) < .7 and x > -3) or (abs(x + 26) < .6 and y > -3):
                continue
            armenio = x < -6 and y < -3
            cristiano = x < -3 and y >= -3
            if random.random() < (.32 if armenio else .13):
                if armenio and random.random() < .7:
                    tree(g, leaf, cyp, x, y, -.8, random.random() < .5)
                continue
            w, l = random.uniform(1.5, 2.25), random.uniform(1.5, 2.25)
            h = random.choice((1.1, 1.4, 1.4, 1.7, 1.7, 2.1, 2.5, 3)) + random.uniform(-.15, .15)
            m = casa[random.randrange(3)]
            g.box(m, x, y, -.8, w, l, h + .8)
            k = random.random()
            if k < (.3 if cristiano else .07):  # techo de tejas rojas
                g.box(roof, x, y, h, w + .1, l + .1, .65, 0, .3)
            else:
                if k < .55:  # cuartito en la terraza
                    g.box(m, x + random.uniform(-.3, .3), y + random.uniform(-.3, .3), h, w * .5, l * .5, .7)
                elif k < .78:  # cúpula baja de cal
                    g.dome(casa[0], x, y, h, min(w, l) * .34, .7, n=9, steps=3)
                g.box(m, x, y - l / 2 + .05, h, w, .1, .2)  # parapeto

    # Afuera: Monte Sion, ciudad nueva al oeste y olivos al este
    for _ in range(300):
        x, y = random.uniform(-180, 22), random.uniform(-90, 180)
        if inside(WALL, x, y) or math.hypot(x + 15, y + 60) < 18 or -60 < x < 25 and -60 < y < 60 and y < 54 and x > -54:
            continue
        w, h = random.uniform(2.5, 5), random.uniform(2.2, 4.6)
        g.box(casa[random.randrange(3)], x, y, -1.2, w, random.uniform(2.5, 6), h)
    for _ in range(300):
        x, y = random.uniform(58, 120), random.uniform(-110, 110)
        tree(g, leaf, cyp, x, y, terrain(x, y) - .2, random.random() < .22)
    g.finish({casa[0]: 2, casa[1]: 2, casa[2]: 2, wallm: 6, muro: 6.5, pav: 5, sep: 5.5, tile: 2.2, roof: 1.4})
    export('jerusalen.glb')


# ---------------------------------------------------------------- Llave
def key():
    clear()
    iron = flat('hierro', '#6d645a', .45, .9)
    g = Scene()

    def ring(cy, R, r):
        # Aro en el mismo plano que el paletón (XY)
        M, N = 48, 12
        rings = []
        for i in range(M + 1):
            a = i / M * TAU
            c = (R * math.cos(a), cy + R * math.sin(a))
            rings.append([(c[0] + r * math.cos(b) * math.cos(a), c[1] + r * math.cos(b) * math.sin(a), r * math.sin(b)) for b in [j / N * TAU for j in range(N)]])
        g.poly(iron, rings, smooth=True, cap=False)

    ring(2.25, .62, .13)

    def bar(y0, y1, r, n=16):
        rings = [[(r * math.cos(j / n * TAU), y, r * math.sin(j / n * TAU)) for j in range(n)] for y in (y0, y1)]
        g.poly(iron, rings, smooth=True)
    bar(-1.65, 1.68, .12)
    for y, r in ((1.55, .19), (1.4, .16), (-1.65, .16)):
        bar(y - .04, y + .04, r)
    for y, w in ((-1.5, .62), (-1.25, .46), (-1.0, .56)):  # paletón con dientes
        g.box(iron, w / 2, y, -.06, w, .17, .12)
    g.box(iron, .06, -1.25, -.06, .12, .62, .12)
    g.finish({})
    export('llave.glb')


# --------------------------------------------------------------- Maleta
def suitcase():
    clear()
    skin = textured('cuero', leather('cuero_i'), .68)
    strap = flat('correa', '#3a2616', .6)
    brass = flat('laton', '#7f6431', .55, .8)
    g = Scene()
    bpy.ops.mesh.primitive_cube_add(size=1)
    b = bpy.context.object
    b.scale = (3.2, 1.2, 2.2)
    bpy.ops.object.transform_apply(scale=True)
    bev = b.modifiers.new('b', 'BEVEL')
    bev.width = .13
    bev.segments = 4
    b.data.materials.append(skin)
    bm = bmesh.new()
    bm.from_object(b, bpy.context.evaluated_depsgraph_get())
    bpy.data.objects.remove(b)
    layer = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        n = f.normal
        for l in f.loops:
            p = l.vert.co
            l[layer].uv = (p.x / 3, p.y / 3) if abs(n.z) > .7 else ((p.y / 3, p.z / 3) if abs(n.x) > abs(n.y) else (p.x / 3, p.z / 3))
    me = bpy.data.meshes.new('cuero')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(skin)
    bpy.context.collection.objects.link(bpy.data.objects.new('maleta', me))
    g.box(strap, 0, 0, -.025, 3.24, 1.24, .05)
    for x in (-.9, .9):
        g.box(strap, x, 0, -1.13, .24, 1.26, 2.26)
        g.box(brass, x, -.63, .55, .3, .04, .36)
    for sx in (-1, 1):
        for sz in (-1, 1):
            for sy in (-1, 1):
                g.box(brass, sx * 1.48, sy * .49, sz * .98 - .14, .3, .28, .28)
    M, N = 32, 10
    rings = []
    for i in range(M // 2 + 1):  # asa
        a = i / M * TAU
        c = (.42 * math.cos(a), 1.1 + .42 * math.sin(a))
        rings.append([(c[0] + .06 * math.cos(q) * math.cos(a), .06 * math.sin(q), c[1] + .06 * math.cos(q) * math.sin(a)) for q in [j / N * TAU for j in range(N)]])
    g.poly(strap, rings, smooth=True, cap=False)
    g.finish({})
    export('maleta.glb')


jerusalem()
key()
suitcase()
