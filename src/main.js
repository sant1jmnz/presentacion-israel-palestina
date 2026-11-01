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
import './styles.css';

import Reveal from 'reveal.js';
import Notes from 'reveal.js/plugin/notes';
import { prepare, HOOKS, stopSlide, clock } from './widgets.js';
import { HOOKS3D, leave3D, setOlive } from './scene3d.js';
import { initSound, setScene, setTension, cut, sfx } from './sound.js';

document.body.insertAdjacentHTML('beforeend', '<div id="unease"></div><svg id="sombra" viewBox="0 0 400 200"><path d="M200 20 215 85 400 95V105L215 110 208 170 240 185V192L200 184 160 192V185L192 170 185 110 0 105V95L185 85Z"/></svg><svg id="figura" viewBox="0 0 200 600"><circle cx="100" cy="62" r="52"/><path d="M0 600V210Q6 132 72 122H128Q194 132 200 210V600Z"/></svg><div id="flash"></div><div id="apagon"></div><div id="cinta"><canvas width="320" height="180"></canvas><i></i><b class="ct-a"></b><b class="ct-b"></b></div>');
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
function tension(t) {
  level = +t;
  document.documentElement.style.setProperty('--u', level.toFixed(3));
  setTension(level);
}
window.addEventListener('tension', (e) => tension(e.detail));
// La película empieza normal: el contexto es tranquilo y todo se pudre desde la guerra de 1948
const CALMA = ['tierra', 'mandato'];
function enter(slide) {
  const era = slide.dataset.era || 'tierra', calma = CALMA.includes(era), roto = document.body.classList.contains('calma') && !calma;
  document.body.classList.toggle('calma', calma);
  tension(calma ? slide.dataset.t ?? 0 : slide.dataset.t ?? 0.35 + 0.5 * Reveal.getIndices(slide).h / (Reveal.getTotalSlides() - 1));
  if (roto) statics(900); // acá se rompe la cinta
  if (document.body.dataset.era !== era && (era === 'ceniza' || era === 'silencio')) cut(); // se corta en seco, no se funde
  document.body.dataset.era = era;
  setScene(slide.dataset.sound || '');
  setOlive(slide.dataset.olive);
  document.body.dataset.olive = slide.dataset.olive || '';
  document.getElementById('whisper').classList.remove('on');
  cinta.querySelector('.ct-a').textContent = `PLAY  CINTA ${pad(Reveal.getIndices(slide).h + 1)}`;
  (slide.dataset.enter || '').split(/\s+/).filter(Boolean).forEach((spec) => {
    const [name, arg] = spec.split(':');
    (HOOKS[name] || HOOKS3D[name])?.(slide, arg);
  });
}
// Una sombra al borde de la vista, y cada tanto una frase que casi no se llega a leer. Nada repetido ni rápido en serie: sin riesgo de fotosensibilidad
const FRASES = ['¿Y si fueras vos?', 'Te estás acostumbrando.', 'No mires para otro lado.', '¿De qué lado estás?', 'Ya elegiste.', 'Seguro algo habrán hecho.', 'El número ya no te impresiona.', 'Ya pensaste en otra cosa.'];
const shade = document.getElementById('sombra'), figure = document.getElementById('figura'), flash = document.getElementById('flash');
const rnd = (a, b) => a + Math.random() * (b - a);
function haunt() {
  setTimeout(() => {
    if (level > 0.5 && Math.random() < 0.4) statics(320); // se pierde la señal
    else if (level > 0.4) {
      if (Math.random() < 0.5) {
        // Alguien enorme, más alto que la pantalla, al borde de la vista
        figure.style.cssText = Math.random() < 0.5 ? `left:${rnd(-14, -4)}vw` : `right:${rnd(-14, -4)}vw`;
        figure.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 0.85, offset: 0.3 }, { opacity: 0.85, offset: 0.7 }, { opacity: 0, transform: 'scale(1.1)' }], { duration: 3600 });
      } else {
      // La sombra de un dron cruza la pantalla, a una altura y en un sentido distintos cada vez
      const dir = Math.random() < 0.5 ? 1 : -1, y = rnd(-20, 40);
      shade.getAnimations().forEach((x) => x.cancel());
      shade.animate([{ transform: `translate(${-130 * dir}vw, ${y}vh) rotate(${90 * dir}deg)` }, { transform: `translate(${130 * dir}vw, ${y + 15}vh) rotate(${90 * dir}deg)` }], { duration: 4200, easing: 'linear' });
      sfx('dron');
      }
    }
    haunt();
  }, rnd(9000, 20000));
}
function whisperText() {
  setTimeout(() => {
    if (level > 0.5) { flash.textContent = FRASES[Math.floor(Math.random() * FRASES.length)]; flash.classList.add('on'); setTimeout(() => flash.classList.remove('on'), 170); }
    whisperText();
  }, rnd(18000, 35000));
}
haunt(); whisperText();

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
