// Interactivos 2D. Cada entrada de HOOKS recibe la <section> al entrar.
// Todos arrancan solos y se pueden tocar; al salir se limpian con track().
import { geoArea, geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import gsap from 'gsap';
import countries110 from 'world-atlas/countries-110m.json';
import credits from './assets/credits.json';
import ICONS from './assets/icons.json';
import GEO from './assets/geo.json';
import { CITIES, PARTICION, SINAI, GOLAN, SEISDIAS, OSLO, PASOS, ADONDE, ASENTAMIENTOS, COLONOS, JERUSALEN, OLIVO_VOZ } from './data.js';
import MURO from './assets/muro.json';
import { sfx, setScene, cut } from './sound.js';
import { loadElevation, elevAt } from './scene3d.js';

export const COUNTRIES = feature(countries110, countries110.objects.countries);

const files = import.meta.glob('./assets/img/*.{webp,png}', { eager: true, query: '?url', import: 'default' });
export const IMG = Object.fromEntries(Object.entries(files).map(([p, u]) => [p.split('/').pop().split('.')[0], u]));

const clips = import.meta.glob('./assets/video/*.mp4', { eager: true, query: '?url', import: 'default' });
const VID = Object.fromEntries(Object.entries(clips).map(([p, u]) => [p.split('/').pop().split('.')[0], u]));

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
// Iconos de game-icons.net (CC BY 3.0), incrustados como SVG
export const icon = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 512 512" aria-hidden="true">${ICONS[n]}</svg>`;
const fmt = (n) => Math.round(n).toLocaleString('es-AR', { useGrouping: 'always' });

// Temporizadores y tweens de la diapositiva actual: se limpian al salir.
const running = new Map();
const track = (slide, ...things) => { if (!running.has(slide)) running.set(slide, []); running.get(slide).push(...things); };
const every = (slide, ms, fn) => { const id = setInterval(fn, ms); track(slide, { kill: () => clearInterval(id) }); return id; };
const later = (slide, ms, fn) => { const id = setTimeout(fn, ms); track(slide, { kill: () => clearTimeout(id) }); };
export function stopSlide(slide) { (running.get(slide) || []).forEach((t) => t.kill()); running.delete(slide); }

export function prepare() {
  document.querySelectorAll('[data-img]').forEach((img) => { img.src = IMG[img.dataset.img] || ''; });
  document.querySelectorAll('[data-vid]').forEach((v) => { v.src = VID[v.dataset.vid] || ''; });
  document.querySelectorAll('section[data-bg]').forEach((s) => {
    s.setAttribute('data-background-image', IMG[s.dataset.bg]);
    s.setAttribute('data-background-opacity', s.dataset.bgOpacity || '0.3');
  });
  // Títulos cinéticos: cada palabra sube desde su línea
  document.querySelectorAll('.k').forEach((el) => {
    let n = 0;
    const walk = (node) => [...node.childNodes].forEach((c) => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (!part.trim()) return frag.appendChild(document.createTextNode(part));
          const w = document.createElement('span'); w.className = 'w';
          const i = document.createElement('span'); i.className = 'wi'; i.style.setProperty('--w', n++);
          i.textContent = part; w.appendChild(i); frag.appendChild(w);
        });
        c.replaceWith(frag);
      } else if (c.nodeType === 1) walk(c);
    });
    walk(el);
  });
  document.querySelectorAll('[data-icon]').forEach((e) => e.insertAdjacentHTML('afterbegin', icon(e.dataset.icon)));
  document.querySelectorAll('.reveal .slides > section').forEach((s) => s.querySelectorAll('.a').forEach((a, i) => a.style.setProperty('--i', i)));
  document.addEventListener('click', (e) => {
    const f = e.target.closest('[data-flip]');
    if (f) { f.classList.toggle('flipped'); sfx('papel'); }
    const g = e.target.closest('[data-goto]');
    if (g) Reveal.slide(...Object.values(Reveal.getIndices(document.getElementById(g.dataset.goto))));
  });
  const voice = document.getElementById('whisper'); let said = 0;
  document.getElementById('oliveTouch').onclick = () => {
    const lines = OLIVO_VOZ[document.body.dataset.olive] || [];
    if (!lines.length) return;
    voice.textContent = lines[said++ % lines.length]; voice.classList.remove('on'); void voice.offsetWidth; voice.classList.add('on');
    sfx('hojas');
  };
  buildCredits();
  buildAgua();
  buildPartition();
  build1949();
  build48();
  buildSix();
  buildHands();
  buildMuro();
  buildAdonde();
  buildArchipelago();
  buildGazaScale();
}

/* ---------- Mapa base de la región ---------- */
const VIEW = { w: 620, h: 900 };
function regionMap(el, bounds = [[34.0, 29.45], [36.0, 33.4]], extra = true) {
  const { w, h } = VIEW;
  const proj = geoMercator().fitExtent([[10, 10], [w - 10, h - 10]], { type: 'MultiPoint', coordinates: bounds });
  proj.clipExtent([[0, 0], [w, h]]);
  const path = geoPath(proj);
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img' }, el);
  if (extra) ['Egypt', 'Jordan', 'Lebanon', 'Syria', 'Saudi Arabia'].forEach((n) => { const d = path(GEO[n]); if (d) svgEl('path', { d, class: 'nb' }, svg); });
  const pal = GEO.Palestine.coordinates.map((c) => ({ type: 'Polygon', coordinates: c }));
  const cis = pal.find((p) => p.coordinates[0][0][0] > 34.7), gaza = pal.find((p) => p.coordinates[0][0][0] < 34.7);
  const lands = svgEl('g', {}, svg);
  const top = svgEl('g', {}, svg);
  const water = () => {
    GEO.rivers.forEach((f) => svgEl('path', { d: path(f), class: 'river' }, top));
    GEO.lakes.forEach((f) => path(f) && svgEl('path', { d: path(f), class: 'lake' }, top));
  };
  const label = (key, opt = {}) => {
    const [name, lon, lat] = CITIES[key];
    const [x, y] = proj([lon, lat]);
    const g = svgEl('g', { class: 'city', transform: `translate(${x},${y})` }, top);
    svgEl('circle', { r: 5 }, g);
    svgEl('text', { x: opt.left ? -11 : 11, y: 8 + (opt.dy || 0), 'text-anchor': opt.left ? 'end' : 'start' }, g).textContent = name;
    return g;
  };
  return { svg, proj, path, lands, top, cis, gaza, water, label };
}

/* ---------- Contadores ---------- */
function countUp(el, to, { dur = 1.8, prefix = '', suffix = '', delay = 0.3 } = {}) {
  const o = { v: 0 };
  el.textContent = prefix + '0' + suffix;
  return gsap.to(o, { v: to, duration: dur, delay, ease: 'power3.out', onUpdate: () => (el.textContent = prefix + fmt(o.v) + suffix) });
}
function count(slide) {
  slide.querySelectorAll('[data-count]').forEach((el) => track(slide, countUp(el, +el.dataset.count, { prefix: el.dataset.prefix || '', suffix: el.dataset.suffix || '', dur: +el.dataset.dur || 1.8 })));
}

/* ---------- Línea de tiempo ---------- */
function timeline(slide) {
  const dots = [...slide.querySelectorAll('.tl-dot')];
  const panels = [...slide.querySelectorAll('.tl-panels article')];
  const bar = slide.querySelector('.tl-track');
  let i = 0, auto = true;
  const show = (k) => {
    i = k;
    dots.forEach((d, j) => d.classList.toggle('on', j === k));
    panels.forEach((p, j) => p.classList.toggle('on', j === k));
    bar.style.setProperty('--p', (k / (dots.length - 1)) * 100 + '%');
    if (panels[k].dataset.s) setScene(panels[k].dataset.s);
  };
  dots.forEach((d, j) => (d.onclick = () => { auto = false; show(j); }));
  show(0);
  every(slide, 5200, () => { if (auto && i < dots.length - 1) show(i + 1); });
}

/* ---------- Agua: mapa y Mar Muerto que baja ---------- */
function buildAgua() {
  const m = regionMap(document.getElementById('aguaMap'), [[34.5, 30.9], [36.0, 33.35]]);
  ['Israel', 'Palestine'].forEach((n) => svgEl('path', { d: m.path(GEO[n]), class: 'pale' }, m.lands));
  const [x, y] = m.proj([35.15, 32.0]);
  svgEl('ellipse', { cx: x, cy: y, rx: 62, ry: 150, class: 'aquifer' }, m.lands);
  svgEl('text', { x, y, class: 'aq-t', 'text-anchor': 'middle' }, m.top).textContent = 'Acuífero';
  m.water();
  m.top.querySelectorAll('.river').forEach((r) => r.classList.add('flow'));
}
function agua(slide) {
  const year = slide.querySelector('#seaYear'), lvl = slide.querySelector('#seaLevel'), fill = slide.querySelector('#seaFill');
  const set = (y) => {
    // −395 m en 1960, unos −439 m hoy: baja cerca de un metro por año
    const m = 395 + ((y - 1960) / 66) * 44;
    year.textContent = Math.round(y); lvl.textContent = '−' + Math.round(m) + ' m';
    fill.style.height = 100 - ((y - 1960) / 66) * 62 + '%';
  };
  const o = { y: 1960 };
  set(1960);
  track(slide, gsap.to(o, { y: 2026, duration: 9, delay: 0.9, ease: 'none', onUpdate: () => set(o.y) }));
}

/* ---------- Jerusalén: tres sonidos, un kilómetro cuadrado ---------- */
function jerusalem(slide) {
  const info = slide.querySelector('#jeruInfo');
  const scene = { muro: 'viento:.05 shofar:.7', domo: 'viento:.05 adhan:.65', sepulcro: 'viento:.05 campanas:.5', todo: 'viento:.04 adhan:.32 campanas:.2 shofar:.32' };
  const sel = (id) => {
    const p = JERUSALEN.find((x) => x.id === id);
    slide.querySelectorAll('[data-j]').forEach((t) => t.classList.toggle('on', t.dataset.j === id || (id === 'todo' && t.classList.contains('jpin'))));
    slide.dispatchEvent(new CustomEvent('jeru', { detail: id }));
    info.innerHTML = p ? `<small>${p.q}</small><b>${p.n}</b>${p.t}` : '<small>Todo a la vez</small><b>El mismo aire</b>Las tres oraciones suenan a pocos minutos a pie. La Ciudad Vieja amurallada mide menos de un kilómetro cuadrado.';
    setScene(scene[id]);
  };
  let auto = true, k = 0; const seq = ['muro', 'domo', 'sepulcro', 'todo'];
  slide.onclick = (e) => { const t = e.target.closest('[data-j]'); if (t) { auto = false; sel(t.dataset.j); } };
  slide.onpointerdown = (e) => { if (e.target.tagName === 'CANVAS') auto = false; };
  sel(seq[0]);
  every(slide, 8000, () => { if (auto && k < seq.length - 1) sel(seq[++k]); });
}

/* ---------- Tres promesas: la carta se escribe sola ---------- */
function letters(slide) {
  const cards = [...slide.querySelectorAll('.letter')];
  cards.forEach((c) => { c.classList.remove('open'); c.querySelector('.txt').textContent = ''; });
  const open = (c) => {
    if (c.classList.contains('open')) return;
    c.classList.add('open'); sfx('papel');
    const txt = c.querySelector('.txt'), full = c.dataset.text, o = { n: 0 };
    track(slide, gsap.to(o, { n: full.length, duration: full.length / 34, ease: 'none', onUpdate: () => (txt.textContent = full.slice(0, Math.round(o.n))) }));
  };
  cards.forEach((c) => (c.onclick = () => open(c)));
  cards.forEach((c, i) => later(slide, 900 + i * 4600, () => open(c)));
}

/* ---------- Población 1922 → 1947 ---------- */
function population(slide) {
  const box = slide.querySelector('.waffle');
  if (!box.children.length) {
    box.style.setProperty('--person', `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>${ICONS.person.replace(/currentColor/g, '#000')}</svg>`)}")`);
    for (let i = 0; i < 100; i++) box.appendChild(document.createElement('span'));
  }
  const kids = [...box.children];
  const tabs = [...slide.querySelectorAll('[data-pop]')];
  const lab = slide.querySelector('#popText');
  // % judío: censos de 1922 y 1931 y estimaciones británicas posteriores
  const P = [[1922, 11], [1931, 17], [1936, 28], [1939, 30], [1947, 32]];
  const TXT = {
    1922: '<b>1922.</b> Censo británico: unas 757.000 personas. 11% judíos; 89% árabes musulmanes y cristianos, y otras minorías.',
    1931: '<b>1931.</b> Segundo censo: un millón de personas. 17% judíos.',
    1936: '<b>1936.</b> Con Hitler en el poder, la inmigración judía se dispara. Empieza la revuelta árabe.',
    1939: '<b>1939.</b> Londres pone un tope a la inmigración, cuando Europa se cierra sobre los judíos.',
    1947: '<b>1947.</b> Cerca de 1,9 millones. Los judíos ya son un tercio.',
  };
  const pctOf = (y) => { const k = P.findIndex((p) => y <= p[0]); if (k <= 0) return P[0][1]; const [a, b] = [P[k - 1], P[k]]; return a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]); };
  const set = (y) => {
    const j = Math.round(pctOf(y));
    tabs.forEach((b) => b.classList.toggle('on', b.dataset.pop == Math.round(y)));
    kids.forEach((s, i) => s.classList.toggle('j', i >= 100 - j));
    slide.querySelector('#popNow').textContent = `${Math.round(y)} · ${j}%`;
    const t = TXT[[...P].reverse().find((p) => p[0] <= y)[0]];
    if (lab.dataset.t !== t) { lab.dataset.t = t; lab.innerHTML = t; }
  };
  const o = { y: 1922 };
  const tw = gsap.to(o, { y: 1947, duration: 14, delay: 1.5, ease: 'none', onUpdate: () => set(o.y) });
  track(slide, tw);
  tabs.forEach((b) => (b.onclick = () => { tw.kill(); set(+b.dataset.pop); }));
  set(1922);
}

/* ---------- Partición: votación y corte ---------- */
const VOTOS = {
  si: 'Australia, Bélgica, Bielorrusia, Bolivia, Brasil, Canadá, Checoslovaquia, Costa Rica, Dinamarca, Ecuador, EE. UU., Filipinas, Francia, Guatemala, Haití, Islandia, Liberia, Luxemburgo, Nicaragua, Noruega, Nueva Zelanda, Países Bajos, Panamá, Paraguay, Perú, Polonia, Rep. Dominicana, Sudáfrica, Suecia, Ucrania, URSS, Uruguay, Venezuela'.split(', '),
  no: 'Afganistán, Arabia Saudita, Cuba, Egipto, Grecia, India, Irak, Irán, Líbano, Pakistán, Siria, Turquía, Yemen'.split(', '),
  ab: 'Argentina, Chile, China, Colombia, El Salvador, Etiopía, Honduras, México, Reino Unido, Yugoslavia'.split(', '),
};
let cutParts;
// d3 pinta el complemento si el anillo gira al revés: se corrige según el área
const poly = (p) => {
  const ring = [...p, p[0]], g = { type: 'Polygon', coordinates: [ring] };
  return geoArea(g) > 2 * Math.PI ? { type: 'Polygon', coordinates: [ring.reverse()] } : g;
};
function buildPartition() {
  const m = regionMap(document.getElementById('partMap'));
  const mandate = svgEl('clipPath', { id: 'mandate' }, m.svg);
  ['Israel', 'Palestine'].forEach((n) => { svgEl('path', { d: m.path(GEO[n]) }, mandate); svgEl('path', { d: m.path(GEO[n]), class: 'mandate' }, m.lands); });
  const g = svgEl('g', { 'clip-path': 'url(#mandate)', class: 'parts' }, m.lands);
  PARTICION.judio.forEach((p) => svgEl('path', { d: m.path(poly(p)), class: 'jew' }, g));
  svgEl('path', { d: m.path(poly(PARTICION.arabeEnclave)), class: 'arab' }, g);
  svgEl('path', { d: m.path(poly(PARTICION.jerusalen)), class: 'corpus' }, g);
  m.water();
  ['haifa', 'telaviv'].forEach((c) => m.label(c, { left: true })); m.label('jerusalen');
  ['si', 'no', 'ab'].forEach((k) => {
    document.getElementById('v-' + k).innerHTML = VOTOS[k].map((c) => `<span class="${c === 'Argentina' ? 'ar' : ''}">${c}</span>`).join('');
  });
  cutParts = g;
}
function vote(slide) {
  const chips = [...slide.querySelectorAll('.votes span')];
  const counts = { si: 0, no: 0, ab: 0 };
  const order = chips.map((c) => [Math.random(), c]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  chips.forEach((c) => c.classList.remove('on'));
  cutParts.classList.remove('on');
  ['si', 'no', 'ab'].forEach((k) => (slide.querySelector('#n-' + k).textContent = '0'));
  order.forEach((c, i) => later(slide, 900 + i * 170, () => {
    c.classList.add('on'); sfx('voto');
    const k = c.parentElement.id.slice(2); slide.querySelector('#n-' + k).textContent = ++counts[k];
  }));
  later(slide, 900 + order.length * 170 + 700, () => { sfx('martillo'); cutParts.classList.add('on'); });
}

/* ---------- Dos memorias ---------- */

/* ---------- 1949 ---------- */
function build1949() {
  const m = regionMap(document.getElementById('map49'));
  svgEl('path', { d: m.path(GEO.Israel), class: 'isr' }, m.lands);
  svgEl('path', { d: m.path(m.cis), class: 'jor' }, m.lands);
  svgEl('path', { d: m.path(m.gaza), class: 'egy' }, m.lands);
  svgEl('path', { d: m.path(m.cis), class: 'green' }, m.lands);
  m.water();
  ['telaviv', 'haifa', 'gaza'].forEach((c) => m.label(c, { left: true }));
  m.label('jerusalen');
}
function build48() {
  const m = regionMap(document.getElementById('map48'), [[34.55, 31.3], [35.55, 32.9]]);
  ['Israel', 'Palestine'].forEach((n) => svgEl('path', { d: m.path(GEO[n]), class: 'pale' }, m.lands));
  m.water();
  addPins(m, 'm48');
  m.label('jerusalen'); m.label('telaviv', { left: true });
}
function drawGreen(slide) {
  const p = slide.querySelector('.green');
  const L = p.getTotalLength(), o = { t: 0 };
  p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
  track(slide, gsap.to(o, { t: 1, duration: 5, delay: 0.6, ease: 'power1.inOut', onUpdate: () => (p.style.strokeDashoffset = L * (1 - o.t)) }));
}

/* ---------- Seis días ---------- */
let six;
function buildSix() {
  const m = regionMap(document.getElementById('map67'), [[32.2, 27.7], [36.9, 33.5]]);
  svgEl('path', { d: m.path(GEO.Israel), class: 'isr' }, m.lands);
  const add = (geo) => svgEl('path', { d: m.path(geo), class: 'occ' }, m.lands);
  six = { sinai: [add(poly(SINAI)), add(m.gaza)], cis: [add(m.cis)], golan: [add(poly(GOLAN))] };
  m.water();
  m.label('jerusalen');
}
function sixDays(slide) {
  const tabs = [...slide.querySelectorAll('[data-day]')], info = slide.querySelector('#dayInfo');
  let i = 0, auto = true;
  const show = (k) => {
    i = k;
    tabs.forEach((t, j) => t.classList.toggle('on', j === k));
    const d = SEISDIAS[k];
    info.innerHTML = `<b>${d.d}</b>${d.t}`;
    if (k) sfx('estallido');
    const lit = new Set(SEISDIAS.slice(0, k + 1).map((x) => x.zona));
    Object.entries(six).forEach(([z, els]) => els.forEach((e) => { e.classList.toggle('on', lit.has(z)); e.classList.toggle('now', d.zona === z); }));
  };
  tabs.forEach((t, j) => (t.onclick = () => { auto = false; show(j); }));
  show(0);
  every(slide, 4400, () => { if (auto && i < 5) show(i + 1); });
}

/* ---------- Oslo: juntar las dos mitades de la foto ---------- */
function blob([lon, lat, r], seed) {
  const pts = [];
  for (let a = 0; a < 16; a++) {
    const t = (a / 16) * Math.PI * 2, k = 1 + 0.35 * Math.sin(t * 3 + seed) + 0.2 * Math.sin(t * 7 + seed * 2);
    pts.push([lon + (Math.cos(t) * r * k) / 0.85, lat + Math.sin(t) * r * k]);
  }
  return poly(pts);
}
let clipN = 0;
function osloLayers(m, parent) {
  const id = 'cl' + ++clipN;
  svgEl('path', { d: m.path(m.cis) }, svgEl('clipPath', { id }, m.svg));
  const out = {
    c: svgEl('path', { d: m.path(m.cis), class: 'zc' }, parent),
    b: svgEl('g', { 'clip-path': `url(#${id})`, class: 'layer on' }, parent),
    a: svgEl('g', { 'clip-path': `url(#${id})`, class: 'layer on' }, parent),
  };
  OSLO.b.forEach((b, i) => svgEl('path', { d: m.path(blob(b, i + 1)), class: 'zb' }, out.b));
  OSLO.a.forEach((b, i) => svgEl('path', { d: m.path(blob(b, i + 4)), class: 'za' }, out.a));
  return out;
}
function buildHands() {
  const m = regionMap(document.getElementById('mapOslo'), [[34.75, 31.3], [35.65, 32.6]], false);
  osloLayers(m, m.lands);
  ['nablus', 'ramallah', 'hebron', 'jerico'].forEach((c) => m.label(c));
}
function hands(slide) {
  const rest = slide.querySelector('#osloMap');
  rest.classList.remove('on');
  later(slide, 1500, () => { sfx('manos'); rest.classList.add('on'); });
}

/* ---------- La vela de Rabin ---------- */
function candle(slide) {
  const c = slide.querySelector('.candle'), t = slide.querySelector('#candleText');
  c.classList.remove('lit'); t.classList.remove('on');
  const light = () => {
    if (c.classList.contains('lit')) return;
    sfx('fosforo'); c.classList.add('lit'); setScene('llama:.25 grave:.22');
    later(slide, 900, () => t.classList.add('on'));
  };
  c.onclick = light;
  later(slide, 3200, light);
}

/* ---------- Pasos: botones y puntos del mapa que cuentan un hecho por vez ---------- */
const pins = {};
function addPins(m, name) {
  pins[name] = PASOS[name].map((p, i) => {
    const [x, y] = m.proj(p.at), g = svgEl('g', { class: 'pin', transform: `translate(${x},${y})`, 'data-step': i }, m.top);
    svgEl('circle', { r: 13, class: 'ring' }, g); svgEl('circle', { r: 11 }, g);
    return g;
  });
}
function steps(slide, name) {
  const list = PASOS[name], box = slide.querySelector('.stops'), panel = slide.querySelector('.panel'), marks = pins[name] || [];
  if (!box.children.length) box.innerHTML = list.map((p, i) => `<button data-step="${i}">${p.y}</button>`).join('');
  let k = -1, auto = true;
  const show = (i) => {
    k = i;
    [...box.children].forEach((b, j) => b.classList.toggle('on', j === i));
    marks.forEach((g, j) => g.classList.toggle('on', j === i));
    panel.innerHTML = `<small>${list[i].w}</small><b>${list[i].n}</b>${list[i].t}`;
    sfx(list[i].s || 'clic');
  };
  slide.onclick = (e) => { const t = e.target.closest('[data-step]'); if (t) { auto = false; show(+t.dataset.step); } };
  later(slide, 1400, () => show(0));
  every(slide, 10000, () => { if (auto && k < list.length - 1) show(k + 1); });
}

// Texto a máquina, letra por letra, con los párrafos en orden
function tipeo(slide) {
  const ps = [...slide.querySelectorAll('.tp')];
  ps.forEach((p) => { p.dataset.txt ??= p.textContent; p.textContent = ''; });
  let i = 0, j = 0;
  every(slide, 60, () => {
    const p = ps[i]; if (!p) return;
    p.textContent = p.dataset.txt.slice(0, Math.max(++j, 0));
    if (j > 0 && j % 2) sfx('tecla');
    if (j >= p.dataset.txt.length) { i++; j = -22; }
  });
}
function eas(slide) { sfx('eas'); tipeo(slide); }
// Un nombre con marcador, de a poco, sobre la piel
function pierna(slide) {
  const n = slide.querySelector('.pn-n'), b = slide.querySelector('.pn-b');
  b.classList.remove('on');
  track(slide, gsap.fromTo(n, { clipPath: 'inset(-20% 0 -20% 100%)' }, { clipPath: 'inset(-20% 0 -20% 0%)', duration: 3.6, delay: 1.5, ease: 'none' }));
  for (let i = 0; i < 12; i++) later(slide, 1500 + i * 300, () => sfx('papel'));
  later(slide, 8000, () => b.classList.add('on'));
}
// Una llamada real: se escribe, suena el disparo y se corta
function llamada(slide) {
  slide.querySelector('.ll-b').classList.remove('on');
  tipeo(slide);
  later(slide, 9000, () => { cut(); sfx('disparo'); slide.classList.add('hit'); });
  later(slide, 15000, () => { slide.classList.remove('hit'); slide.querySelector('.ll-b').classList.add('on'); });
}

// Material real: el video arranca al entrar y queda en el último cuadro
function real(slide) {
  const v = slide.querySelector('video');
  v.currentTime = 0; v.play().catch(() => {});
  track(slide, { kill: () => v.pause() });
}

/* ---------- El muro: trazado real, de norte a sur ---------- */
let muroLines;
function buildMuro() {
  const m = regionMap(document.getElementById('mapMuro'), [[34.72, 31.3], [35.65, 32.6]], false);
  svgEl('path', { d: m.path(GEO.Israel), class: 'pale' }, m.lands);
  svgEl('path', { d: m.path(m.cis), class: 'zc' }, m.lands);
  muroLines = MURO.map((c) => svgEl('path', { d: m.path({ type: 'LineString', coordinates: c }), class: 'wall' }, m.top));
  ['nablus', 'ramallah', 'hebron'].forEach((c) => m.label(c));
  m.label('jerusalen', { left: true });
  addPins(m, 'muro');
}
function wall(slide) {
  const km = slide.querySelector('#km'), o = { t: 0 }, Ls = muroLines.map((p) => p.getTotalLength()), T = Ls.reduce((a, b) => a + b);
  muroLines.forEach((p, i) => { p.style.strokeDasharray = Ls[i]; p.style.strokeDashoffset = Ls[i]; });
  track(slide, gsap.to(o, { t: 1, duration: 12, delay: 0.8, ease: 'none', onUpdate: () => {
    let left = o.t * T;
    muroLines.forEach((p, i) => { p.style.strokeDashoffset = Ls[i] - Math.min(left, Ls[i]); left = Math.max(0, left - Ls[i]); });
    km.textContent = fmt(o.t * 712);
  } }));
}

/* ---------- Cisjordania, capa por capa ---------- */
let arch;
function buildArchipelago() {
  const m = regionMap(document.getElementById('mapArch'), [[34.75, 31.3], [35.65, 32.6]], false);
  const zones = osloLayers(m, m.lands);
  const sets = svgEl('g', { class: 'layer' }, m.top);
  ASENTAMIENTOS.forEach(([, lon, lat]) => { const [x, y] = m.proj([lon, lat]); svgEl('rect', { x: x - 7, y: y - 7, width: 14, height: 14, class: 'sett' }, sets); });
  ['nablus', 'ramallah', 'hebron'].forEach((c) => m.label(c));
  arch = { ...zones, sets };
  const svg = document.getElementById('colonos');
  const W = 620, H = 250, x = (a) => 40 + ((a - 1972) / 52) * (W - 150), y = (v) => H - 34 - (v / 520000) * (H - 60);
  svgEl('polyline', { points: COLONOS.map(([a, b]) => `${x(a)},${y(b)}`).join(' '), class: 'colono' }, svg);
  COLONOS.forEach(([a, b]) => { svgEl('circle', { cx: x(a), cy: y(b), r: 5, class: 'cdot' }, svg); if (a !== 2020) svgEl('text', { x: x(a), y: H - 8, 'text-anchor': 'middle', class: 'caxis' }, svg).textContent = a; });
  svgEl('text', { x: x(2024) + 12, y: y(511100) + 8, class: 'cval' }, svg).textContent = '511.100';
}
function archipelago(slide) {
  const tabs = [...slide.querySelectorAll('[data-layer]')];
  const on = new Set(['c']);
  const sync = () => {
    arch.a.classList.toggle('on', on.has('a')); arch.b.classList.toggle('on', on.has('b')); arch.sets.classList.toggle('on', on.has('sets'));
    arch.c.classList.toggle('dim', !on.has('c'));
    tabs.forEach((t) => t.classList.toggle('on', on.has(t.dataset.layer)));
  };
  let manual = false;
  tabs.forEach((t) => (t.onclick = () => { manual = true; const k = t.dataset.layer; on.has(k) ? on.delete(k) : on.add(k); sync(); }));
  sync();
  ['a', 'b', 'sets'].forEach((k, i) => later(slide, 1500 + i * 2400, () => { if (!manual) { on.add(k); sync(); } }));
}

/* ---------- Gaza sobre Buenos Aires ---------- */
let gzScale;
function buildGazaScale() {
  const svg = document.getElementById('gazaScale');
  const W = 780, H = 820, S = 60000;
  const pa = geoMercator().center([-58.44, -34.61]).translate([W / 2, H / 2]).scale(S);
  svgEl('path', { d: geoPath(pa)(GEO.caba), class: 'mis' }, svg);
  svgEl('text', { x: W / 2, y: 790, class: 'mis-t', 'text-anchor': 'middle' }, svg).textContent = 'Ciudad de Buenos Aires · 203 km²';
  const pg = geoMercator().center([34.39, 31.41]).translate([0, 0]).scale(S);
  const gaza = GEO.Palestine.coordinates.map((c) => ({ type: 'Polygon', coordinates: c })).find((p) => p.coordinates[0][0][0] < 34.7);
  gzScale = svgEl('g', { class: 'over' }, svg);
  svgEl('path', { d: geoPath(pg)(gaza), class: 'pal solid' }, gzScale);
  gzScale.dataset.c = `${W / 2},${H / 2 - 20}`;
}
function gazaOver(slide) {
  const [cx, cy] = gzScale.dataset.c.split(',').map(Number);
  const o = { x: cx + 900 };
  track(slide, gsap.to(o, { x: cx, duration: 2.6, delay: 0.8, ease: 'power3.inOut', onUpdate: () => gzScale.setAttribute('transform', `translate(${o.x},${cy})`) }));
}

/* ---------- 7 de octubre: una línea por vez ---------- */
function oct7(slide) {
  const lines = [...slide.querySelectorAll('.line')], num = slide.querySelector('#oct7n'), o = { n: 0 };
  lines.forEach((l) => l.classList.remove('on'));
  num.textContent = '';
  setScene('pajaros:.32');
  lines.forEach((l, i) => later(slide, 1200 + i * 3000, () => l.classList.add('on')));
  // 6:29: la mañana se corta y entra la alarma
  later(slide, 4200, () => { cut(); setScene('sirena:.42'); window.dispatchEvent(new CustomEvent('tension', { detail: 0.95 })); });
  later(slide, 1200 + lines.length * 3000, () => {
    setScene('sirena:.12 ambulancia:.24 grave:.18 grito:.12 llanto:.14');
    track(slide, gsap.to(o, { n: 1195, duration: 7, ease: 'power1.in', onUpdate: () => (num.textContent = fmt(o.n)) }));
  });
}

/* ---------- Perfil del terreno: datos reales, de oeste a este ---------- */
// Línea que se mueve con el puntero (o sola) y dice la altura real en ese punto
function profileReader(slide, svg) {
  const W = 1620, x0 = 34.55, x1 = 36.05, lat = 31.74, B = 150, K = 0.14;
  const g = svg.querySelector('.reader') || svgEl('g', { class: 'reader' }, svg);
  if (!g.children.length) { svgEl('line', { y1: 46, y2: 330 }, g); svgEl('circle', { r: 8 }, g); svgEl('text', { y: 74 }, g); }
  const [, dot, txt] = g.children;
  const at = (x) => {
    const lon = x0 + ((x1 - x0) * x) / W, h = Math.round(lon < 34.7 ? Math.max(elevAt(lon, lat), 0) : elevAt(lon, lat)), km = Math.round((lon - x0) * 94.7);
    g.setAttribute('transform', `translate(${x},0)`);
    dot.setAttribute('cy', B - h * K);
    txt.textContent = `${h > 0 ? '+' : ''}${h} m · km ${km}`;
    txt.setAttribute('text-anchor', x > W - 240 ? 'end' : 'start'); txt.setAttribute('x', x > W - 240 ? -14 : 14);
  };
  const o = { x: 0 };
  const tw = gsap.to(o, { x: W, duration: 9, delay: 4.5, ease: 'none', onUpdate: () => at(o.x) });
  track(slide, tw);
  at(0);
  svg.onpointermove = (e) => { tw.kill(); at(Math.max(0, Math.min(W, new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()).x))); };
}
async function profile(slide) {
  await loadElevation();
  const svg = slide.querySelector('#profile');
  if (!svg.dataset.done) {
    svg.dataset.done = 1;
    const W = 1620, H = 330, lat = 31.74, x0 = 34.55, x1 = 36.05, B = 150, K = 0.14, N = 320;
    const pts = [];
    for (let i = 0; i <= N; i++) { const lon = x0 + ((x1 - x0) * i) / N; pts.push([(i / N) * W, B - (lon < 34.7 ? Math.max(elevAt(lon, lat), 0) : elevAt(lon, lat)) * K]); }
    svgEl('path', { d: 'M' + pts.map((p) => p.join(',')).join('L') + `L${W},${H}L0,${H}Z`, class: 'ground' }, svg);
    svgEl('line', { x1: 0, x2: W, y1: B, y2: B, class: 'sea' }, svg);
    svgEl('text', { x: 8, y: B + 28, class: 'plab' }, svg).textContent = 'nivel del mar';
    [['Costa', 34.68], ['Jerusalén', 35.2], ['Mar Muerto', 35.5], ['Jordania', 35.8]].forEach(([n, lon]) => {
      svgEl('text', { x: ((lon - x0) / (x1 - x0)) * W, y: 34, class: 'plab', 'text-anchor': 'middle' }, svg).textContent = n;
    });
  }
  profileReader(slide, svg);
  track(slide, gsap.fromTo(svg.querySelector('.ground'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 4, delay: 0.5, ease: 'none' }));
}

function buildCredits() {
  document.getElementById('credits').innerHTML = Object.values(credits).map((c) =>
    `<li><a href="${c.url}" target="_blank" rel="noopener"><b>${c.title.replace(/\.(jpe?g|png|ogg)$/i, '')}</b></a> — ${c.artist || 'Autor desconocido'} · ${c.license}</li>`).join('');
}

/* ---------- Diez segundos: qué te llevás ---------- */
function diez(slide) {
  const items = [...slide.querySelectorAll('.dz-items button')], num = slide.querySelector('.dz-t'), end = slide.querySelector('.dz-end');
  const abuela = items[items.length - 1], picked = new Set(), rest = slide.querySelector('.dz-rest');
  let n = 10;
  items.forEach((b) => { b.className = ''; });
  end.classList.remove('on'); num.textContent = n; rest.textContent = 'Agarraste: nada todavía.'; rest.style.visibility = '';
  const libres = () => items.filter((b) => b !== abuela && !picked.has(b) && !b.classList.contains('gone'));
  const azar = () => { const r = libres(); return r[Math.floor(Math.random() * r.length)]; };
  const id = every(slide, 1000, () => {
    num.textContent = --n;
    if ([8, 5, 2].includes(n)) { const b = azar(); picked.add(b); b.classList.add('pick'); sfx('sello'); rest.textContent = `Agarraste: ${[...picked].map((x) => x.textContent.toLowerCase()).join(', ')}.`; } // elige sola: no te pregunta
    else if (n > 1 && n % 2) { azar().classList.add('gone'); sfx('clic'); }
    if (n <= 0) {
      clearInterval(id); cut(); sfx('portazo'); setScene('viento:.12 grave:.2');
      items.forEach((b) => { if (!picked.has(b)) b.classList.add('gone'); });
      rest.style.visibility = 'hidden';
      end.querySelector('b').textContent = `Te llevaste: ${[...picked].map((b) => b.textContent.toLowerCase()).join(', ')}. Tu abuela se quedó.`;
      end.classList.add('on');
    }
  });
}

/* ---------- Quince segundos: de la calle al refugio ---------- */
function quince(slide) {
  const num = slide.querySelector('.qz-t'), me = slide.querySelector('.qz-me'), end = slide.querySelector('.qz-end');
  const X0 = 60, X1 = 1540;
  let x = X0, over = false;
  end.classList.remove('on'); slide.classList.remove('hit', 'told'); num.textContent = '15'; me.setAttribute('cx', x);
  every(slide, 620, () => { // corre sola y cada paso rinde menos: nunca llega
    if (over) return;
    x += (X1 - 150 - x) * 0.085;
    gsap.to(me, { attr: { cx: x }, duration: 0.5, ease: 'none' });
  });
  const finish = () => {
    over = true; cut(); end.classList.add('on');
    window.dispatchEvent(new CustomEvent('tension', { detail: 0 })); // silencio total: el disparo sale de la nada
    later(slide, 1500, () => { // el fogonazo en la cara: un solo destello blanco y todo negro
      sfx('disparo'); slide.classList.add('hit');
      document.getElementById('fogonazo').animate([{ opacity: 1 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: 320, easing: 'ease-out' });
    });
    later(slide, 1900, () => sfx('pitido'));
    later(slide, 8100, () => slide.classList.add('told'));
  };
  const o = { t: 15 };
  track(slide, gsap.to(o, { t: 0, duration: 15, delay: 0.6, ease: 'none', onUpdate: () => { if (!over) num.textContent = Math.ceil(o.t); }, onComplete: () => { if (!over) finish(); } }));
}

/* ---------- El portón: sostener, esperar, que te cierren ---------- */
function porton(slide) {
  const say = slide.querySelector('.pt-say'), end = slide.querySelector('.pt-end');
  const NO = ['6:00. Cerrado por seguridad.', '9:30. Tu permiso venció ayer.', '14:00. Volvé mañana.'];
  say.textContent = ''; end.classList.remove('on');
  NO.forEach((t, i) => later(slide, 3000 + i * 5000, () => { say.textContent = t; sfx('portazo'); }));
  later(slide, 18000, () => { setScene('reloj:.3 viento:.1'); end.classList.add('on'); });
}

/* ---------- ¿A dónde vas? Gaza, huyendo de un punto a otro ---------- */
let adonde;
function buildAdonde() {
  const m = regionMap(document.getElementById('mapAdonde'), [[34.2, 31.2], [34.6, 31.62]], false), d = m.path(m.gaza);
  svgEl('path', { d, class: 'zc' }, m.lands);
  const clip = svgEl('clipPath', { id: 'gazaClip' }, m.svg); svgEl('path', { d }, clip);
  const burn = svgEl('g', { 'clip-path': 'url(#gazaClip)' }, m.lands);
  const route = svgEl('polyline', { class: 'ad-route', fill: 'none' }, m.top);
  const home = m.proj([34.5, 31.55]);
  const pts = ADONDE.map((p, i) => {
    const [x, y] = m.proj(p.at), g = svgEl('g', { class: 'pin', transform: `translate(${x},${y})`, 'data-ad': i }, m.top);
    svgEl('circle', { r: 13, class: 'ring' }, g); svgEl('circle', { r: 11 }, g);
    svgEl('text', { x: i < 2 ? -18 : 18, y: 8, 'text-anchor': i < 2 ? 'end' : 'start', class: 'ad-n' }, g).textContent = p.n;
    return { x, y, g };
  });
  const me = svgEl('circle', { r: 9, class: 'ad-me' }, m.top);
  adonde = { burn, route, pts, me, home };
}
function adondeVas(slide) {
  const { burn, route, pts, me, home } = adonde, panel = slide.querySelector('.panel'), num = slide.querySelector('.ad-n-veces'), end = slide.querySelector('.ad-end');
  const trail = [home], first = panel.dataset.first ??= panel.innerHTML;
  const scorch = (x, y) => { const c = svgEl('circle', { cx: x, cy: y, r: 0, class: 'ad-burn' }, burn); gsap.to(c, { attr: { r: 96 }, duration: 1.1, ease: 'power2.out' }); sfx('estallido'); };
  burn.replaceChildren(); route.setAttribute('points', trail.join(' ')); gsap.set(me, { attr: { cx: home[0], cy: home[1] } });
  pts.forEach((p) => p.g.classList.remove('gone')); num.textContent = '0'; end.classList.remove('on'); panel.innerHTML = first;
  later(slide, 2200, () => scorch(home[0], home[1]));
  let moved = 0;
  every(slide, 6000, () => { // te mueven de un punto a otro hasta que no queda ninguno
    if (moved === pts.length) return;
    const i = moved, p = pts[i], a = ADONDE[i];
    p.g.classList.add('gone'); num.textContent = ++moved;
    trail.push([p.x, p.y]); route.setAttribute('points', trail.join(' '));
    panel.innerHTML = `<small>${a.w}</small><b>${a.n}</b>${a.t}`;
    gsap.to(me, { attr: { cx: p.x, cy: p.y }, duration: 1, ease: 'power1.inOut' });
    later(slide, 2600, () => { scorch(p.x, p.y); if (moved === pts.length) later(slide, 1500, () => end.classList.add('on')); });
  });
}

/* ---------- Cerrá los ojos: solo sonido ---------- */
const OSCURO = {
  kibutz: [[0, 'reloj:.12 respira:.5'], [6000, 'respira:.65 disparos:.2'], [11000, 'respira:.8 pasos:.36 disparos:.1'], [15000, '@golpes'], [18000, '@golpes'], [20500, '!'], [22000, 'puerta'], [25000, 'fin']],
  gaza: [[0, 'dron:.24 bebe:.14 llanto:.08'], [6000, '@estallido'], [7000, 'grito:.2 llanto:.24 bebe:.26 piedras:.2 dron:.12'], [15000, '@estallido'], [17000, 'sollozo:.2 llanto:.3 respira:.3'], [22500, '!'], [25000, 'fin']],
};
function oscuro(slide, k) {
  const a = slide.querySelector('.os-a'), b = slide.querySelector('.os-b'), door = slide.querySelector('.os-door'), glow = slide.querySelector('.os-glow');
  a.style.opacity = 1; b.classList.remove('on');
  if (door) door.style.opacity = 1;
  later(slide, 3000, () => (a.style.opacity = 0));
  OSCURO[k].forEach(([ms, c]) => later(slide, ms, () => {
    if (c === 'fin') { b.classList.add('on'); if (door) door.style.opacity = 0; }
    else if (c === '!') cut();
    else if (c === 'puerta') {
      const open = slide.querySelector('.os-open'); sfx('portazo'); sfx('disparo'); open.style.opacity = 1; door.style.opacity = 0;
      later(slide, 800, () => (open.style.opacity = 0));
    } else if (c[0] === '@') {
      sfx(c.slice(1));
      if (door) track(slide, gsap.fromTo(door, { x: -7 }, { x: 0, duration: 0.09, repeat: 6, yoyo: true }));
      if (glow) track(slide, gsap.fromTo(glow, { opacity: 0.8 }, { opacity: 0, duration: 4, ease: 'power2.out' }));
    } else setScene(c);
  }));
}

/* ---------- Sin señal: el aviso llega y no te deja salir ---------- */
function bloqueo(slide) {
  const msg = slide.querySelector('.bq-msg'), end = slide.querySelector('.bq-end'), st = slide.querySelector('.bq-st');
  end.classList.remove('on'); st.textContent = 'Cargando el mapa…'; msg.classList.remove('off');
  later(slide, 3000, () => (st.textContent = 'Sin señal'));
  later(slide, 10000, () => end.classList.add('on'));
}

/* ---------- El reloj: el tiempo que llevás acá ---------- */
export const clock = {};
function reloj(slide) {
  const t = slide.querySelector('.rl-t'), draw = () => { const s = Math.round((Date.now() - (clock.t0 ?? Date.now())) / 1000); t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  draw(); every(slide, 1000, draw);
  later(slide, 4500, () => slide.querySelector('.rl-a').classList.add('on'));
  later(slide, 8000, () => slide.querySelector('.rl-b').classList.add('on'));
}

/* ---------- Emboscada: en una diapositiva tranquila, sin aviso ---------- */
function ataque(slide, ms) {
  if (slide.dataset.pego) return;
  later(slide, +ms, () => {
    slide.dataset.pego = 1; cut(); sfx('estallido');
    const off = document.getElementById('apagon'); off.classList.add('on');
    later(slide, 2200, () => { off.classList.remove('on'); setScene(`grito:.1 llanto:.12 ${slide.dataset.sound}`); });
  });
}

/* ---------- Bajo los escombros ---------- */
function escombros(slide) {
  const say = slide.querySelector('.ec-say'), crack = slide.querySelector('.ec-luz'), end = slide.querySelector('.ec-end');
  const LINES = ['Te despertás. No ves nada.', 'Tenés polvo en la boca.', 'No podés mover las piernas.', 'Arriba se oyen voces.'];
  end.classList.remove('on'); say.textContent = ''; gsap.set(crack, { width: 460 });
  LINES.forEach((t, i) => later(slide, 1200 + i * 3200, () => (say.textContent = t)));
  later(slide, 14000, () => { say.textContent = 'Golpeás.'; sfx('golpes'); });
  later(slide, 16000, () => { sfx('golpes'); say.textContent = 'Te contestaron.'; });
  later(slide, 20000, () => { sfx('golpes'); say.textContent = 'Golpeás.'; });
  later(slide, 23000, () => { sfx('golpes'); say.textContent = 'Golpeás.'; });
  const leaveYou = () => {
    say.textContent = 'Las voces se alejan.'; setScene('respira:.8');
    track(slide, gsap.to(crack, { width: 0, duration: 9, ease: 'none' }));
    later(slide, 10000, () => { cut(); say.textContent = ''; });
    later(slide, 12500, () => end.classList.add('on'));
  };
  later(slide, 27000, leaveYou);
}

/* ---------- La tinta: el nombre en la piel ---------- */
function tinta(slide) {
  const ink = slide.querySelector('.tn-clip'), end = slide.querySelector('.tn-end');
  end.classList.remove('on'); gsap.set(ink, { attr: { x: 660, width: 0 } });
  later(slide, 3000, () => { sfx('papel'); track(slide, gsap.to(ink, { attr: { x: 240, width: 420 }, duration: 7, ease: 'none', onUpdate() { if (Math.random() < 0.06) sfx('papel'); } })); });
  later(slide, 11500, () => end.classList.add('on'));
}

/* ---------- La cinta: los días de Hersh ---------- */
function cinta(slide) {
  const num = slide.querySelector('.cn-n'), a = slide.querySelector('.cn-a'), b = slide.querySelector('.cn-b');
  a.classList.remove('on'); b.classList.remove('on'); num.textContent = '1';
  const o = { n: 1 };
  later(slide, 4000, () => track(slide, gsap.to(o, { n: 328, duration: 12, ease: 'power1.in', onUpdate: () => (num.textContent = Math.round(o.n)) })));
  later(slide, 17000, () => { cut(); a.classList.add('on'); });
  later(slide, 22000, () => b.classList.add('on'));
}

export const HOOKS = { real, tipeo, eas, pierna, llamada, ataque, escombros, tinta, cinta, oscuro, bloqueo, reloj, diez, quince, porton, adondeVas, count, timeline, agua, jerusalem, letters, population, vote, drawGreen, sixDays, hands, candle, wall, steps, archipelago, gazaOver, oct7, profile };
