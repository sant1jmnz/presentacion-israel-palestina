// Paisaje sonoro por capas. Cada <section data-sound="viento:.1 disparos:.5">
// declara qué suena y a qué nivel. setScene ordena la mezcla: el sonido más fuerte que no es
// ambiente es el protagonista y sube; los demás acompañan; el ambiente va abajo, en su propio bus.
// Casi todo son grabaciones reales (scripts/fetch-audio.mjs); radio, dron y los pads son síntesis.
const REC = Object.fromEntries(Object.entries(import.meta.glob('./assets/audio/*.ogg', { eager: true, query: '?url', import: 'default' })).map(([p, u]) => [p.split('/').pop().split('.')[0], u]));
const BOOST = 2; // las grabaciones vienen normalizadas a -18 LUFS

let tape, ctx, master, amb, noise, deafen, detune, impact, room, war, enabled = true;
// Mezcla con jerarquía: en cada momento hay un protagonista, apoyos y un lecho de ambiente.
// El ambiente va por su propio bus, más bajo, y se aparta cuando pasa algo.
const AMBIENTE = new Set(['viento', 'mar', 'pajaros', 'campanas', 'radio', 'dron', 'helicoptero', 'topadora', 'grave', 'pad', 'llama']);
const NIVEL = { protagonista: 1.15, apoyo: 0.75, ambiente: 0.5 };
const AMB = 0.8; // nivel de reposo del bus de ambiente
// Lo que pasa de golpe empuja el ambiente hacia atrás un momento; los sonidos chicos no
const APARTA = { estallido: 0.15, disparo: 0.1, portazo: 0.4, golpes: 0.4, eas: 0.3, dron: 0.45, pitido: 0.5, martillo: 0.5, sello: 0.6, fosforo: 0.6, manos: 0.5 };
function aparta(hasta, dura = 1.6) {
  if (!amb) return;
  const n = ctx.currentTime, g = amb.gain;
  g.cancelScheduledValues(n); g.setTargetAtTime(AMB * hasta, n, 0.04); g.setTargetAtTime(AMB, n + 0.25, dura / 3);
}
const voices = {};
const FADE = 1.8;

function noiseBuffer(sec = 4) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
const loopNoise = (out, type, freq, q = 0.7) => {
  const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  s.connect(f).connect(out); s.start();
  return f;
};
const lfo = (param, rate, depth) => {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = rate; g.gain.value = depth;
  o.connect(g).connect(param); o.start();
};
// Golpe de ruido filtrado: base de disparos, explosiones, teclas, piedras
function burst(out, { t = ctx.currentTime, dur = 0.1, type = 'lowpass', freq = 1000, gain = 1, q = 1, sweep }) {
  const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 3); s.stop(t + dur + 0.05);
}
function tone(out, { t = ctx.currentTime, dur = 1, freq = 220, gain = 0.3, type = 'sine', attack = 0.01 }) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
}
// Repite un sonido a intervalos irregulares mientras la capa esté audible
const CAJITA = [659, 659, 784, 659, 659, 784, 659, 784, 1047, 988, 880, 880, 784];
let cajitaN = 0;
const scatter = (min, max, fn) => (out, v) => {
  const go = () => {
    if (v.level > 0.001) fn(out);
    v.timer = setTimeout(go, min + Math.random() * (max - min));
  };
  v.timer = setTimeout(go, 200 + Math.random() * min);
};
const buffers = {};
const load = (n) => (buffers[n] ??= fetch(REC[n]).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)));
// Bucle que arranca en un punto al azar: nunca suena dos veces igual
async function sample(n, out, boost = BOOST) {
  const buf = await load(n), g = ctx.createGain(), s = ctx.createBufferSource();
  g.gain.value = boost; s.buffer = buf; s.loop = true; s.connect(g).connect(out);
  detune.connect(s.detune); // toda grabación se desafina con la tensión
  s.start(0, Math.random() * buf.duration);
}
async function shot(n, out, gain = 1, rate = 1) {
  const g = ctx.createGain(), s = ctx.createBufferSource();
  s.buffer = await load(n); s.playbackRate.value = rate; g.gain.value = gain;
  s.connect(g).connect(out); s.start();
}
// Da vueltas de un parlante al otro: no se sabe de dónde viene
const around = (n, rate) => (o) => {
  const p = ctx.createStereoPanner(), w = ctx.createWaveShaper();
  w.curve = Float32Array.from({ length: 512 }, (_, i) => Math.tanh(((i / 255.5) - 1) * 5)); // voz quebrada: el sonido áspero de quien está desesperado
  lfo(p.pan, rate, 0.9); w.connect(p).connect(o); sample(n, w);
};
const far = (n, gain) => { const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 1.8 - 0.9; p.connect(master); shot(n, p, gain, 0.9 + Math.random() * 0.15); };
// Onda expansiva: cae de tono como el golpe en el pecho
function boom(out, { from = 110, to = 30, dur = 2.2, gain = 1.4 }) {
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
}
// Todo lo demás se aparta un instante: por contraste el golpe suena más grande que el máximo del parlante
const duck = () => { const n = ctx.currentTime, g = master.gain; g.cancelScheduledValues(n); g.setValueAtTime(0.1, n); g.setTargetAtTime(0.9, n + 0.3, 0.6); };
// Un susurro que pasa de un parlante al otro por detrás de la gente
function cruza() {
  const n = ctx.currentTime, p = ctx.createStereoPanner(), d = Math.random() < 0.5 ? 1 : -1;
  p.pan.setValueAtTime(d, n); p.pan.linearRampToValueAtTime(-d, n + 7); p.connect(master); shot('susurro', p, tension * 1.4);
}
const bell = (out, f0, g = 0.28) => [1, 2, 2.4, 3, 4.2].forEach((m, i) => tone(out, { freq: f0 * m, dur: 5 - i * 0.7, gain: g / (i + 1), attack: 0.005 }));

const MAKE = {
  ...Object.fromEntries(['viento', 'mar', 'pajaros', 'campanas', 'maquina', 'telegrafo', 'reloj', 'multitud', 'barco', 'piedras', 'aviones', 'sirena', 'helicoptero', 'topadora', 'latido', 'fuego'].map((n) => [n, (o) => sample(n, o)])),
  cajita: scatter(620, 1000, (o) => tone(o, { freq: CAJITA[cajitaN++ % CAJITA.length] * (1 + (Math.random() - 0.5) * 0.025), dur: 2, gain: 0.2, attack: 0.004 })), // nana desafinada: cada nota llega un poco tarde
  llanto: around('llanto', 0.07), sollozo: around('sollozo', 0.05), bebe: around('bebe', 0.11), bebe2: around('bebe2', 0.09), grito: around('grito', 0.13), respira: (o) => sample('respira', o),
  adhan: (o) => sample('adhan', o, 1),
  declaracion: (o) => sample('declaracion', o, 1),
  kolnidre: (o) => sample('kolnidre', o, 1),
  ambulancia: (o) => sample('ambulancia', o, 1),
  shofar: (o) => sample('shofar', o, 1),
  // La tierra
  // Papel y despachos
  radio: (o) => { const f = loopNoise(o, 'bandpass', 1900, 1.4); lfo(f.frequency, 0.31, 700); },
  // Masas
  pasos: scatter(560, 720, (o) => shot('paso', o, 1.6, 0.9 + Math.random() * 0.2)),
  // Guerra
  disparos: (o) => sample('disparos', o, 6),
  explosiones: (o) => sample('explosiones', o, 6),
  dron: (o) => { const g = ctx.createGain(); g.gain.value = 0.14; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 620; f.Q.value = 3; g.connect(f).connect(o); [168, 171, 336].forEach((h) => { const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = h; s.connect(g); s.start(); }); },
  // Duelo
  grave: (o) => { [55, 82.4].forEach((h, i) => { const s = ctx.createOscillator(); s.frequency.value = h; const g = ctx.createGain(); g.gain.value = 0.26 / (i + 1); s.connect(g).connect(o); s.start(); }); },
  llama: scatter(200, 1100, (o) => burst(o, { dur: 0.05, type: 'highpass', freq: 3200, gain: 0.25 })),
  // Esperanza
  pad: (o) => { [220, 277.2, 329.6].forEach((h) => { const s = ctx.createOscillator(); s.frequency.value = h; const g = ctx.createGain(); g.gain.value = 0.07; s.connect(g).connect(o); s.start(); }); },
};

// Sonidos únicos, disparados por una interacción
export const SFX = {
  sello: () => burst(master, { dur: 0.16, freq: 420, sweep: 90, gain: 1 }),
  papel: () => burst(master, { dur: 0.3, type: 'highpass', freq: 3600, gain: 0.16 }),
  voto: () => tone(master, { freq: 640, dur: 0.14, gain: 0.14, type: 'triangle' }),
  martillo: () => { burst(master, { dur: 0.13, type: 'bandpass', freq: 620, gain: 1, q: 2 }); tone(master, { freq: 120, dur: 0.4, gain: 0.5 }); },
  fosforo: () => burst(master, { dur: 0.5, type: 'highpass', freq: 2200, gain: 0.36, sweep: 5200 }),
  manos: () => shot('aplauso', master, 0.9),
  estallido: () => { window.dispatchEvent(new Event('impacto')); duck(); shot('estallido', impact, 2, 0.8 + Math.random() * 0.3); shot('estallido', impact, 1.6, 0.45); shot('estallido', room, 1, 0.7); boom(impact, {}); const n = ctx.currentTime, f = deafen.frequency; f.cancelScheduledValues(n); f.setValueAtTime(260, n + 0.35); f.exponentialRampToValueAtTime(18000, n + 7); SFX.zumbido(); }, // después de la explosión no se oye bien
  golpes: () => [0, 0.27, 0.55].forEach((d) => { const t = ctx.currentTime + d; burst(master, { t, dur: 0.1, type: 'bandpass', freq: 190, gain: 1, q: 1.5 }); tone(master, { t, freq: 72, dur: 0.25, gain: 0.5 }); }),
  hojas: () => burst(master, { dur: 0.7, type: 'bandpass', freq: 3400, sweep: 1800, gain: 0.1, q: 0.6 }),
  campana: () => bell(master, 330, 0.2),
  disparo: () => { duck(); shot('tiro', impact, 2.2); shot('tiro', impact, 1.2, 0.55); shot('tiro', room, 1); boom(impact, { from: 160, to: 45, dur: 0.5, gain: 1.2 }); }, // grabación real saturada, sin pasar por el compresor, con eco de la calle
  estatica: () => burst(master, { dur: 0.14, type: 'highpass', freq: 2600, gain: 0.16 }),
  eas: () => [853, 960].forEach((freq) => tone(impact, { freq, dur: 6, gain: 0.13, type: 'square', attack: 0.005 })), // el tono real de las alertas de emergencia
  tecla: () => burst(master, { dur: 0.02, freq: 2400, gain: 0.1 }),
  clic: () => burst(master, { dur: 0.035, freq: 1800, sweep: 600, gain: 0.3 }),
  zumbido: () => tone(master, { freq: 7600, dur: 5, gain: 0.05, attack: 0.05 }), // el oído después de la explosión
  dron: () => { burst(master, { dur: 4, freq: 900, sweep: 160, gain: 0.3, q: 2 }); tone(master, { freq: 62, dur: 4, gain: 0.3, attack: 1.8 }); }, // pasa por arriba
  pitido: () => tone(master, { freq: 3900, dur: 7, gain: 0.13, attack: 0.02 }),
  portazo: () => { burst(master, { dur: 0.22, freq: 300, gain: 1 }); tone(master, { freq: 70, dur: 0.6, gain: 0.6 }); },
};
export const sfx = (n) => { if (ctx && enabled) { if (APARTA[n]) aparta(APARTA[n], n === 'estallido' ? 4 : 1.6); SFX[n]?.(); } };

function voice(name) {
  if (voices[name]) return voices[name];
  const out = ctx.createGain(); out.gain.value = 0;
  out.connect(name === 'disparos' || name === 'explosiones' ? war : AMBIENTE.has(name) ? amb : master);
  const v = (voices[name] = { out, level: 0 });
  MAKE[name]?.(out, v);
  return v;
}
let current = '';
export function setScene(spec = '') {
  current = spec;
  if (!ctx) return;
  const want = Object.fromEntries(spec.split(/\s+/).filter(Boolean).map((s) => { const [n, l] = s.split(':'); return [n, +l || 0.3]; }));
  // El protagonista: lo más fuerte que no sea ambiente (si todo es ambiente, lo más fuerte del ambiente)
  const orden = Object.keys(want).sort((a, b) => want[b] - want[a]), lead = orden.find((n) => !AMBIENTE.has(n)) ?? orden[0];
  for (const n in want) want[n] *= n === lead ? NIVEL.protagonista : AMBIENTE.has(n) ? NIVEL.ambiente : NIVEL.apoyo;
  const t = ctx.currentTime;
  Object.keys(want).forEach(voice);
  Object.entries(voices).forEach(([n, v]) => {
    v.level = want[n] || 0;
    v.out.gain.cancelScheduledValues(t);
    v.out.gain.setValueAtTime(v.off ? 0 : v.out.gain.value, t); v.off = false; // .value todavía no refleja un cut() recién hecho
    v.out.gain.linearRampToValueAtTime(v.level, t + FADE);
  });
}
// Tensión 0-1, marcada por diapositiva. Debajo de todo: batidos graves, escala infinita, un pitido al borde del oído y un corazón
let tension = 0, low, high, beat, climb, wobble, rough, clash;
const applyTension = (ya) => {
  if (!low) return;
  const n = ctx.currentTime, set = (p, v) => p.setTargetAtTime(v, n, ya ? 0.01 : 1.5), t = tension;
  set(low.gain, 0.26 * t ** 1.5); set(high.gain, 0.025 * t ** 2); set(beat.gain, 0.1 * t ** 2); set(climb.gain, 0.08 * t ** 2); set(rough.gain, 0.075 * t ** 2);
  set(detune.offset, -140 * t); set(wobble.gain, 35 * t);
};
export function setTension(t, ya) { tension = t; applyTension(ya); tape?.gain.setTargetAtTime(t, ctx.currentTime, ya ? 0.01 : 1.5); }
// Algo que se acerca (Bach, 2008: lo que sube de volumen activa la amígdala más que lo que se aleja). La mitad de las veces no pasa nada: no saber estresa más
function looming(hit) {
  const n = ctx.currentTime, b = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  b.buffer = noise; b.loop = true;
  f.type = 'lowpass'; f.frequency.setValueAtTime(180, n); f.frequency.exponentialRampToValueAtTime(2800, n + 5);
  g.gain.setValueAtTime(0.0008, n); g.gain.exponentialRampToValueAtTime(0.4, n + 5); g.gain.setValueAtTime(0, n + 5);
  b.connect(f).connect(g).connect(master); b.start(n); b.stop(n + 5.1);
  if (hit) setTimeout(() => enabled && SFX.estallido(), 5000);
}
const osc = (f, out, type = 'sine') => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(out); o.start(); return o; };
function startTension() {
  [low, high, beat, climb, wobble, rough] = [0, 0, 0, 0, 0, 0].map(() => ctx.createGain());
  [low, high, beat, climb, rough].forEach((g) => { g.gain.value = 0; g.connect(amb); }); // la tensión es lecho: va con el ambiente
  [55, 57.7, 110.9].forEach((f) => osc(f, low, 'triangle'));
  osc(7350, high);
  clash = [233, 247, 329.6, 349.2].map((f) => osc(f, beat)); // segundas menores: chocan entre sí
  // Aspereza: volumen que vibra a 73 Hz, dentro de la franja de 30-150 Hz de gritos y alarmas (Arnal, 2015)
  const am = ctx.createGain(), lp = ctx.createBiquadFilter(); am.gain.value = 0; lp.frequency.value = 1500;
  osc(73, am.gain); [196, 207.7].forEach((f) => osc(f, am, 'sawtooth')); am.connect(lp).connect(rough);
  wobble.connect(detune.offset); osc(0.17, wobble);
  // Escala de Shepard: parece subir siempre y nunca llega
  const N = 7, voicesUp = Array.from({ length: N }, () => { const g = ctx.createGain(); g.gain.value = 0; g.connect(climb); return { g, o: osc(30, g) }; });
  let ph = 0;
  setInterval(() => {
    ph = (ph + 0.0025) % 1;
    voicesUp.forEach(({ g, o }, i) => { const x = (i + ph) / N; o.frequency.value = 30 * 2 ** (x * N); g.gain.value = Math.exp(-(((x - 0.5) / 0.18) ** 2)); });
  }, 50);
  const heart = () => {
    if (tension > 0.15 && enabled) { const n = ctx.currentTime; tone(master, { t: n, freq: 52, dur: 0.22, gain: 0.7 * tension }); tone(master, { t: n + 0.2, freq: 44, dur: 0.28, gain: 0.45 * tension }); }
    setTimeout(heart, 1100 - 600 * tension);
  };
  heart();
  // Lo que parece que pasó: un susurro, un golpe, un paso, o el sonido que se va un segundo
  const phantom = () => setTimeout(() => {
    const r = Math.random();
    if (tension > 0.3 && enabled) {
      if (r < 0.3) cruza();
      else if (r < 0.42) far('paso', 1);
      else if (r < 0.54) SFX.golpes();
      else if (r < 0.68) tone(master, { freq: 31, dur: 14, gain: 0.7, attack: 6 }); // casi no se oye: se siente
      else if (r < 0.82) looming(tension > 0.6 && Math.random() < 0.5);
      else { const n = ctx.currentTime, h = 3 + Math.random() * 2; [master, war].forEach((m) => { m.gain.setTargetAtTime(0.02, n, 0.05); m.gain.setTargetAtTime(m === war ? 1 : 0.9, n + h, 0.05); }); }
    }
    clash.forEach((o) => o.detune.setValueAtTime(Math.random() * 90 - 45, ctx.currentTime)); // salto brusco de afinación
    phantom();
  }, 7000 + Math.random() * 11000);
  phantom();
  applyTension();
}
export function cut() { // silencio seco: corta todo de golpe
  if (!ctx) return;
  const t = ctx.currentTime;
  Object.values(voices).forEach((v) => { v.level = 0; v.off = true; v.out.gain.cancelScheduledValues(t); v.out.gain.setValueAtTime(0, t); });
}
function start() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  noise = noiseBuffer();
  master = ctx.createGain(); master.gain.value = enabled ? 0.9 : 0;
  amb = ctx.createGain(); amb.gain.value = AMB; amb.connect(master);
  const comp = ctx.createDynamicsCompressor();
  deafen = ctx.createBiquadFilter(); deafen.frequency.value = 18000;
  detune = ctx.createConstantSource(); detune.offset.value = 0; detune.start();
  const limit = ctx.createDynamicsCompressor(); limit.threshold.value = -1.5; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = 0.001; limit.release.value = 0.1;
  master.connect(comp).connect(deafen).connect(limit).connect(ctx.destination);
  // Golpes y tiroteos esquivan el compresor, que los aplasta. El saturador los deja en el máximo sin distorsión digital
  const trim = ctx.createGain(), clip = ctx.createWaveShaper(), low = ctx.createBiquadFilter(); trim.gain.value = 0.45;
  clip.curve = Float32Array.from({ length: 1024 }, (_, i) => Math.tanh(((i / 511.5) - 1) * 3));
  impact = ctx.createGain(); impact.connect(trim).connect(clip).connect(deafen);
  low.type = 'lowshelf'; low.frequency.value = 130; low.gain.value = 9;
  war = ctx.createGain(); war.gain.value = enabled ? 1 : 0; war.connect(low).connect(impact);
  room = ctx.createConvolver(); room.connect(impact);
  const ir = ctx.createBuffer(1, ctx.sampleRate * 2.4, ctx.sampleRate), d = ir.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.45));
  room.buffer = ir;
  ['aplauso', 'estallido', 'paso', 'susurro', 'tiro'].forEach(load);
  startTension();
  // Siseo de cinta y zumbido de línea: crecen con la tensión
  tape = ctx.createGain(); tape.gain.value = 0; tape.connect(amb);
  { const h = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); h.buffer = noise; h.loop = true; f.type = 'highpass'; f.frequency.value = 3200; g.gain.value = 0.03; h.connect(f).connect(g).connect(tape); h.start(); }
  tone(tape, { freq: 50, dur: 86400, gain: 0.035, type: 'sawtooth', attack: 2 });
  setScene(current);
}
// El navegador solo deja sonar después de un gesto: el primer clic o tecla lo enciende.
export function initSound(button) {
  ['pointerdown', 'keydown'].forEach((e) => window.addEventListener(e, start, { once: false, passive: true }));
  button.onclick = (e) => {
    e.stopPropagation();
    enabled = !enabled;
    button.classList.toggle('off', !enabled);
    if (master) { master.gain.setTargetAtTime(enabled ? 0.9 : 0, ctx.currentTime, 0.15); war.gain.value = enabled ? 1 : 0; }
  };
}
