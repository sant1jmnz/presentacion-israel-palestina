# Genera src/assets/muro.json y src/assets/edades.json a partir de lo bajado en node_modules/.cache/data:
#   b3.json: Overpass, relación OSM 1410327 (Israeli West Bank barrier)
#   gz.json: lista nominal del Ministerio de Salud de Gaza (data.techforpalestine.org)
#   il.txt:  gov.il "Swords of Iron: Civilian Casualties" en JSON de Firecrawl (campo markdown)
# Solo se guardan nombre, edad y lugar: nunca documento ni fecha de nacimiento.
import json, math, random, re, sys

D = 'node_modules/.cache/data/'
OUT = 'src/assets/'
random.seed(7)


def dp(p, tol):  # Douglas-Peucker
    if len(p) < 3: return p
    (x0, y0), (x1, y1) = p[0], p[-1]
    dx, dy = x1 - x0, y1 - y0
    n = math.hypot(dx, dy) or 1e-9
    dist = [abs(dy * (x - x0) - dx * (y - y0)) / n for x, y in p]
    i = max(range(len(p)), key=dist.__getitem__)
    if dist[i] < tol: return [p[0], p[-1]]
    return dp(p[:i + 1], tol)[:-1] + dp(p[i:], tol)


def km(p): return sum(math.hypot((a[0] - b[0]) * 94.5, (a[1] - b[1]) * 111) for a, b in zip(p, p[1:]))


rel = next(e for e in json.load(open(D + 'b3.json', encoding='utf8'))['elements'] if e['type'] == 'relation')
ways = [[(g['lon'], g['lat']) for g in m['geometry']] for m in rel['members'] if m['type'] == 'way' and 'geometry' in m]
# Encadena de norte a sur por el extremo más cercano, para dibujarlo en orden
at = max((p for w in ways for p in (w[0], w[-1])), key=lambda p: p[1])
chain = []
while ways:
    w = min(ways, key=lambda w: min(math.dist(at, w[0]), math.dist(at, w[-1])))
    ways.remove(w)
    if math.dist(at, w[-1]) < math.dist(at, w[0]): w = w[::-1]
    if chain and math.dist(chain[-1][-1], w[0]) < 0.0015: chain[-1] += w[1:]
    else: chain.append(list(w))
    at = w[-1]
tot = sum(km(c) for c in chain)
muro = [[[round(x, 4), round(y, 4)] for x, y in dp(c, 0.0009)] for c in chain]
json.dump(muro, open(OUT + 'muro.json', 'w'), separators=(',', ':'))
print('muro', len(chain), 'tramos', round(tot), 'km', sum(map(len, muro)), 'puntos')


def resumen(filas, muestra=44):
    # filas: (edad, nombre)
    n, nombres = {}, {}
    for e, s in filas:
        n[e] = n.get(e, 0) + 1
        nombres.setdefault(e, []).append(s)
    return {'n': [n.get(e, 0) for e in range(101)],
            'nombres': [random.sample(nombres.get(e, []), min(muestra, len(nombres.get(e, [])))) for e in range(101)]}


gz = json.load(open(D + 'gz.json', encoding='utf8'))
gaza = resumen([(r['age'], re.sub(r'\s+', ' ', r['en_name']).strip()) for r in gz if isinstance(r.get('age'), int) and 0 <= r['age'] <= 100 and r.get('en_name')])

md = json.load(open(D + 'il.txt', encoding='utf8'))['markdown']
filas, vistos = [], set()
for it in re.split(r'<br>|\|', md):
    it = it.strip(' -\n\xa0')
    it = re.sub(r'\[([^\]]+)\]\([^)]*\)', lambda x: x[1], it)
    m = re.match(r"((?:Prof\. |Dr\. )?[A-Z][^,.\[\]()–]*(?:\([^)]*\)[^,.\[\]()–]*)*?)\s*[,.–]\s*(\d{1,3})(?:[ -]months?(?:-old)?)?(?!\d)", it)
    if not m or len(m[1].split()) > 6 or m[1].strip() in vistos: continue
    edad = 0 if 'month' in it[:len(m[0])] else int(m[2])
    if edad > 100: continue  # hay erratas en la fuente ("448")
    vistos.add(m[1].strip())
    lug = re.search(r"(?:of|,) (Kibbutz [A-Z][\w’' -]+?|Moshav [A-Z][\w’' -]+?|[A-Z][a-z’']+(?: [A-Z][a-z’']+)?)(?:,| -| –|\.)", it[len(m[1]) + 3:])
    filas.append((edad, m[1].strip() + (' · ' + lug[1] if lug else '')))
israel = resumen(filas)

json.dump({'gaza': gaza, 'israel': israel}, open(OUT + 'edades.json', 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
for k, v in (('gaza', gaza), ('israel', israel)):
    print(k, sum(v['n']), 'menores', sum(v['n'][:18]), '16 años', v['n'][16], v['nombres'][16][:2])
assert sum(israel['n']) > 800 and sum(gaza['n']) > 70000
