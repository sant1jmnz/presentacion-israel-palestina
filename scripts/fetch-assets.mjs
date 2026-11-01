// Descarga única: relieve real (Terrarium/AWS), geografía (Natural Earth),
// fotos y audio de Wikimedia Commons. Deja todo en src/assets/.
import fs from 'node:fs';
import sharp from 'sharp';
import { feature } from 'topojson-client';
import c10 from 'world-atlas/countries-10m.json' with { type: 'json' };

const OUT = 'src/assets';
const UA = { 'User-Agent': 'IsraelPalestinaSchoolDeck/1.0 (student geography presentation)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const IMAGES = {
  balfour: 'Balfour declaration unmarked.jpg',
  ambulante: 'Jaffa orange picking Ayanot Zoltan Kluger 1937 a.jpg',
  domo: "Mosque of Omar. Omar Moschee. Mosquée d'Omar - American Colony, Jerusalem. LCCN2007675855.jpg",
  exodus: 'Exodus 1947 after British takeover.jpg',
  bengurion: 'Declaration of State of Israel 1948.jpg',
  refugiados: 'Palestinian refugees 1948.jpg',
  campdavid: 'Sadat and Begin clean3.jpg',
  oslo: 'Oslo-Accordsmaxresdefault-1.jpg',
  muro: 'Israeli West Bank barrier, Abu Dis 1.jpg',
  olivoraiz: 'Roots of an ancient olive tree west of Ramallah.jpg',
  olivogetsemani: 'Ancient Olives Trees, Garden Gethsemane, Near Jerusalem, Palestine (29491109826).jpg',
  gazasat: 'Gaza Strip S2A 432 crop 10 (31739883732).jpg',
  sinai: 'ISS035-E-007148 Nile - Sinai - Dead Sea - Wide Angle View.jpg',
};
const AUDIO = { adhan: 'Adhan.ogg', shofar: '4 sjofar tonen.ogg' };

const strip = (h = '') => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const creditsFile = `${OUT}/credits.json`;
const credits = fs.existsSync(creditsFile) ? JSON.parse(fs.readFileSync(creditsFile, 'utf8')) : {};
async function info(title) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent('File:' + title)}&prop=imageinfo&iiprop=url|extmetadata&iiextmetadatafilter=LicenseShortName|Artist`;
  for (let i = 0; i < 5; i++) {
    const t = await fetch(api, { headers: UA }).then((r) => r.text());
    try { return Object.values(JSON.parse(t).query.pages)[0].imageinfo[0]; } catch { await sleep(8000); }
  }
}
const remember = (key, title, i) => {
  credits[key] = { title, artist: strip(i.extmetadata?.Artist?.value), license: i.extmetadata?.LicenseShortName?.value || '', url: i.descriptionurl };
  fs.writeFileSync(creditsFile, JSON.stringify(credits, null, 1));
};
async function images() {
  for (const [key, title] of Object.entries(IMAGES)) {
    const dest = `${OUT}/img/${key}.webp`;
    if (fs.existsSync(dest) && credits[key]) continue;
    const i = await info(title);
    if (!i) { console.warn('SIN INFO', key); continue; }
    const orig = i.url.split('?')[0], name = orig.split('/').pop();
    for (const src of [orig.replace('/commons/', '/commons/thumb/') + `/960px-${name}`, orig]) {
      await sleep(14000);
      const res = await fetch(src, { headers: UA });
      if (!res.ok) { console.warn(key, res.status); continue; }
      await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 60 }).toFile(dest);
      remember(key, title, i); console.log('ok', key, credits[key].license); break;
    }
  }
}
async function audio() {
  for (const [key, title] of Object.entries(AUDIO)) {
    const dest = `${OUT}/audio/${key}.ogg`;
    if (fs.existsSync(dest)) continue;
    const i = await info(title);
    await sleep(14000);
    const res = await fetch(i.url.split('?')[0], { headers: UA });
    if (!res.ok) { console.warn(key, res.status); continue; }
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    remember(key, title, i); console.log('audio', key);
  }
}

// Relieve: mosaico Terrarium zoom 9, codifica metros en RGB (Mapzen, datos abiertos)
async function terrain() {
  const dest = `${OUT}/terrain.png`;
  if (fs.existsSync(dest)) return;
  const [W, E, S, N] = [33.4, 37.0, 29.3, 33.8];
  const Z = 9, n = 2 ** Z;
  const fx = (lon) => ((lon + 180) / 360) * n;
  const fy = (lat) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n; };
  const [x0, x1, y0, y1] = [Math.floor(fx(W)), Math.floor(fx(E)), Math.floor(fy(N)), Math.floor(fy(S))];
  const comp = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const b = Buffer.from(await (await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`)).arrayBuffer());
    comp.push({ input: b, left: (x - x0) * 256, top: (y - y0) * 256 });
  }
  const m = sharp({ create: { width: (x1 - x0 + 1) * 256, height: (y1 - y0 + 1) * 256, channels: 3, background: '#000' } }).composite(comp);
  const full = await m.png().toBuffer();
  const left = Math.round((fx(W) - x0) * 256), top = Math.round((fy(N) - y0) * 256);
  const width = Math.round((fx(E) - fx(W)) * 256), height = Math.round((fy(S) - fy(N)) * 256);
  await sharp(full).extract({ left, top, width, height }).removeAlpha().png().toFile(dest);
  fs.writeFileSync(`${OUT}/terrain.json`, JSON.stringify({ W, E, S, N, width, height }));
  console.log('terreno', width, height);
}

// Geografía: países de Natural Earth 10m + lagos, río y comparación argentina
async function geo() {
  const dest = `${OUT}/geo.json`;
  if (fs.existsSync(dest)) return;
  const all = feature(c10, c10.objects.countries).features;
  const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
  const pick = {};
  for (const name of ['Israel', 'Palestine', 'Egypt', 'Jordan', 'Lebanon', 'Syria', 'Saudi Arabia']) pick[name] = all.find((f) => f.properties.name === name).geometry;
  const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
  const box = (f) => { const m = JSON.stringify(f.geometry?.coordinates || []).match(/-?\d+(\.\d+)?/g); if (!m) return false; const [a, b] = m.map(Number); return a > 34 && a < 37 && b > 29 && b < 34; };
  const lakes = (await (await fetch(`${NE}/ne_10m_lakes.geojson`)).json()).features.filter(box).map((f) => ({ type: 'Feature', properties: { name: f.properties.name }, geometry: f.geometry }));
  const rivers = (await (await fetch(`${NE}/ne_10m_rivers_lake_centerlines.geojson`)).json()).features.filter(box).map((f) => ({ type: 'Feature', properties: { name: f.properties.name }, geometry: f.geometry }));
  const adm = (await (await fetch(`${NE}/ne_10m_admin_1_states_provinces.geojson`)).json()).features;
  const ar = (n) => adm.find((f) => f.properties.adm0_a3 === 'ARG' && f.properties.name?.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().includes(n)).geometry;
  const out = { ...pick, lakes, rivers, caba: ar('ciudad'), misiones: ar('misiones') };
  fs.writeFileSync(dest, JSON.stringify(round(out)));
  console.log('geo', lakes.map((l) => l.properties.name), rivers.map((l) => l.properties.name));
}

await terrain();
await geo();
await images();
await audio();
