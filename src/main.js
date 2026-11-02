import 'reveal.js/reset.css';
import 'reveal.js/reveal.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import '@fontsource/old-standard-tt/400.css';
import '@fontsource/old-standard-tt/400-italic.css';
import '@fontsource/old-standard-tt/700.css';
import '@fontsource/special-elite/400.css';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/600.css';
import '@fontsource/ibm-plex-sans/300.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/nosifer/400.css';
import './styles.css';

import Reveal from 'reveal.js';
import Notes from 'reveal.js/plugin/notes';
import { prepare, HOOKS, stopSlide, clock } from './widgets.js';
import { HOOKS3D, leave3D, setOlive } from './scene3d.js';
import gsap from 'gsap';
import { initSound, setScene, setTension, cut, sfx } from './sound.js';

document.body.insertAdjacentHTML('beforeend', '<div id="linterna"><i></i></div><div id="mancha"></div><div id="unease"></div><svg id="sombra" viewBox="0 0 400 200"><path d="M200 20 215 85 400 95V105L215 110 208 170 240 185V192L200 184 160 192V185L192 170 185 110 0 105V95L185 85Z"/></svg><svg id="figura" viewBox="0 0 200 600"><circle cx="100" cy="62" r="52"/><path d="M0 600V210Q6 132 72 122H128Q194 132 200 210V600Z"/></svg><div id="flash"></div><div id="apagon"></div><div id="fogonazo"></div><div id="cinta"><canvas width="320" height="180"></canvas><i></i><b class="ct-a"></b><b class="ct-b"></b><b class="ct-c"></b></div>');
prepare();
document.querySelectorAll('.slides > section').forEach((s) => { if (['tierra', 'mandato'].includes(s.dataset.era)) { s.dataset.transition = 'fade'; s.dataset.backgroundTransition = 'fade'; } });
initSound(document.getElementById('soundBtn'));

// Toda la presentación es una cinta vieja: grano, contador y cortes con estática
const cinta = document.getElementById('cinta'), grainCtx = cinta.querySelector('canvas').getContext('2d');
const grain = Array.from({ length: 6 }, () => {
  const f = grainCtx.createImageData(320, 180);
  for (let i = 0; i < f.data.length; i += 4) { f.data[i] = f.data[i + 1] = f.data[i + 2] = Math.random() * 255; f.data[i + 3] = 255; }
  return f;
});
const pad = (n) => String(n).padStart(2, '0');
let tick = 0;
setInterval(() => {
  grainCtx.putImageData(grain[tick++ % grain.length], 0, 0);
  const s = clock.t0 ? Math.floor((Date.now() - clock.t0) / 1000) : 0; // el mismo reloj que la diapositiva del tiempo
  cinta.querySelector('.ct-b').textContent = `SP ${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}, 80);
function statics(ms = 130) {
  cinta.classList.add('st'); setTimeout(() => cinta.classList.remove('st'), ms);
  sfx('estatica');
}

// data-enter="map:norte count" → HOOKS.map(slide, 'norte'), …
let level = 0;
function tension(t, ya) {
  level = +t;
  document.documentElement.style.setProperty('--u', level.toFixed(3));
  setTension(level, ya);
}
window.addEventListener('tension', (e) => tension(e.detail));
// La película empieza normal: el contexto es tranquilo y todo se pudre desde la guerra de 1948
const CALMA = ['tierra', 'mandato'];
const muertos = { n: 0 }; // sube diapositiva a diapositiva y nunca baja
function enter(slide) {
  turno++;
  const era = slide.dataset.era || 'tierra', calma = CALMA.includes(era), roto = document.body.classList.contains('calma') && !calma;
  document.body.classList.toggle('calma', calma);
  [figure, mancha].forEach((x) => x.getAnimations().forEach((a) => a.cancel()));
  const tiniebla = !calma && !slide.matches(`${INTOCABLES}, .cn, .ec, .bq, .diez, .adonde, .porton, .oct7, .oscuro`);
  document.body.classList.toggle('tiniebla', tiniebla);
  if (tiniebla) linterna.firstChild.animate([{ opacity: 1 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: 2600 }); // cada imagen sale del negro
  if ('corte' in slide.dataset) cut(); // final: se acabó la cinta, de golpe
  tension(calma ? slide.dataset.t ?? 0 : slide.dataset.t ?? 0.35 + 0.5 * Reveal.getIndices(slide).h / (Reveal.getTotalSlides() - 1), 'corte' in slide.dataset);
  if (roto) statics(900); // acá se rompe la cinta
  if (document.body.dataset.era !== era && (era === 'ceniza' || era === 'silencio')) cut(); // se corta en seco, no se funde
  document.body.dataset.era = era;
  setScene(slide.dataset.sound || '');
  setOlive(slide.dataset.olive);
  document.body.dataset.olive = slide.dataset.olive || '';
  document.getElementById('whisper').classList.remove('on');
  cinta.querySelector('.ct-a').textContent = `PLAY  CINTA ${pad(Reveal.getIndices(slide).h + 1)}`;
  let s = slide; while (s && !s.dataset.m) s = s.previousElementSibling;
  gsap.to(muertos, { n: +(s?.dataset.m ?? 0), duration: 7, ease: 'none', onUpdate: () => { cinta.querySelector('.ct-c').textContent = muertos.n ? `${Math.round(muertos.n).toLocaleString('es-AR')} muertos desde 1948` : ''; } });
  (slide.dataset.enter || '').split(/\s+/).filter(Boolean).forEach((spec) => {
    const [name, arg] = spec.split(':');
    (HOOKS[name] || HOOKS3D[name])?.(slide, arg);
  });
}
// Una sombra al borde de la vista, y cada tanto una frase que casi no se llega a leer. Nada repetido ni rápido en serie: sin riesgo de fotosensibilidad
const FRASES = ['¿Y si fueras vos?', 'Te estás acostumbrando.', 'No mires para otro lado.', '¿De qué lado estás?', 'Ya elegiste.', 'Seguro algo habrán hecho.', 'El número ya no te impresiona.', 'Ya pensaste en otra cosa.'];
const shade = document.getElementById('sombra'), figure = document.getElementById('figura'), flash = document.getElementById('flash'), mancha = document.getElementById('mancha'), linterna = document.getElementById('linterna');
const rnd = (a, b) => a + Math.random() * (b - a);
const figura = () => {
  // Alguien enorme, más alto que la pantalla, al borde de la vista
  figure.style.cssText = Math.random() < 0.5 ? `left:${rnd(-14, -4)}vw` : `right:${rnd(-14, -4)}vw`;
  figure.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 0.85, offset: 0.3 }, { opacity: 0.85, offset: 0.7 }, { opacity: 0, transform: 'scale(1.1)' }], { duration: 3600 });
};
// Lo que cambia sin aviso. Sin sonido: nadie sabe si estaba desde antes
const silueta = () => {
  figure.style.cssText = `left:${rnd(12, 82)}vw;height:30vh;bottom:-1vh;filter:blur(4px)`;
  figure.animate([{ opacity: 0 }, { opacity: 0.75, offset: 0.35 }, { opacity: 0.75, offset: 0.9 }, { opacity: 0 }], { duration: 15000 });
};
const crece = () => {
  mancha.style.cssText = `left:${rnd(-10, 70)}vw;top:${rnd(-10, 60)}vh`;
  mancha.animate([{ opacity: 0, transform: 'scale(.2)' }, { opacity: 0.92, transform: 'scale(1)' }], { duration: 16000, fill: 'forwards', easing: 'ease-in' });
};
const tiembla = () => cinta.querySelector('.ct-c').animate(Array.from({ length: 16 }, (_, i) => ({ transform: `translate(${rnd(-5, 5)}px, ${rnd(-3, 3)}px)`, color: i % 2 ? '#c8102e' : '#fff' })).concat({ transform: 'none' }), { duration: 2200 });
const dron = () => {
  // La sombra de un dron cruza la pantalla, a una altura y en un sentido distintos cada vez
  const dir = Math.random() < 0.5 ? 1 : -1, y = rnd(-20, 40);
  shade.getAnimations().forEach((x) => x.cancel());
  shade.animate([{ transform: `translate(${-130 * dir}vw, ${y}vh) rotate(${90 * dir}deg)` }, { transform: `translate(${130 * dir}vw, ${y + 15}vh) rotate(${90 * dir}deg)` }], { duration: 4200, easing: 'linear' });
  sfx('dron');
};
const frase = () => { flash.textContent = FRASES[Math.floor(Math.random() * FRASES.length)]; flash.classList.add('on'); setTimeout(() => flash.classList.remove('on'), 170); };
// Lo que pasa a destiempo se cancela al cambiar de diapositiva: enter() ya deja todo como corresponde
let turno = 0;
const luego = (ms, f) => { const t = turno; setTimeout(() => { if (t === turno) f(); }, ms); };
const volver = (l) => {
  const s = Reveal.getCurrentSlide();
  document.body.classList.toggle('calma', CALMA.includes(s.dataset.era));
  tension(l, true); setScene(s.dataset.sound || '');
};
const remate = () => { const r = Math.random(); if (r < 0.45) sfx('estallido'); else if (r < 0.7) sfx('portazo'); }; // a veces no pasa nada: no saber asusta más
const GOLPES = {
  senal: () => statics(320), figura, dron, frase, silueta, crece, tiembla,
  vacio: () => { const l = level; cut(); tension(0, true); luego(rnd(4000, 9000), () => { volver(l); remate(); }); }, // silencio total, sin aviso
  paz: () => { const l = level; cut(); tension(0, true); document.body.classList.add('calma'); setScene('pajaros:.16 viento:.08'); luego(rnd(6000, 10000), () => { statics(500); volver(l); remate(); }); }, // de golpe todo está bien
  amago: () => { sfx('golpes'); luego(rnd(1500, 4000), golpe); }, // algo que no es nada, y recién ahí lo real
};
// Nunca a intervalos fijos: cuanto más tarda en pasar algo, más probable es (Grupe y Nitschke, 2013; Hitchcock, la espera y no el golpe). Nunca dos veces lo mismo
const INTOCABLES = '.quince, .tipo, .rl, .mortajas';
let ultimo, quieto = 0;
function golpe() {
  const k = Object.keys(GOLPES).filter((x) => x !== ultimo);
  ultimo = k[Math.floor(Math.random() * k.length)]; quieto = 0;
  GOLPES[ultimo]();
}
setInterval(() => {
  quieto++;
  if (level <= 0.4 || Reveal.getCurrentSlide()?.matches(INTOCABLES)) return;
  if (Math.random() < (quieto - 20) / (600 * (1.2 - level))) golpe();
}, 1000);

// Lo que pega sacude la pantalla
window.addEventListener('impacto', () => {
  document.querySelector('.reveal').animate(Array.from({ length: 12 }, (_, i) => ({ transform: `translate(${rnd(-30, 30) * (1 - i / 12)}px, ${rnd(-30, 30) * (1 - i / 12)}px)` })).concat({ transform: 'none' }), { duration: 750 });
});

function leave(slide) {
  if (!slide) return;
  stopSlide(slide);
  leave3D(slide);
}

Reveal.initialize({
  width: 1920, height: 1080, margin: 0, minScale: 0.1, maxScale: 4,
  center: false, hash: true, controlsTutorial: false,
  transition: 'none', backgroundTransition: 'none',
  slideNumber: 'c/t', plugins: [Notes],
}).then(() => enter(Reveal.getCurrentSlide()));

Reveal.on('slidechanged', (e) => {
  clock.t0 ??= Date.now();
  if (level > 0.3 && !CALMA.includes(e.currentSlide.dataset.era)) statics();
  leave(e.previousSlide); enter(e.currentSlide);
});

// Tras tocar un control, devolver el foco para que las flechas sigan pasando diapositivas.
document.addEventListener('pointerup', () => setTimeout(() => document.activeElement?.blur?.(), 0));
