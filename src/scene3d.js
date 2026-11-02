// Piezas 3D: el olivo que cuenta la historia, el relieve real, la llave y la
// maleta y el globo. Cada una nace la primera vez que hace
// falta y se pausa al salir, para no gastar GPU fuera de pantalla.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import Globe from 'globe.gl';
import gsap from 'gsap';
import terrainUrl from './assets/terrain.png?url';
import jerusalenUrl from './assets/models/jerusalen.glb?url';
import llaveUrl from './assets/models/llave.glb?url';
import maletaUrl from './assets/models/maleta.glb?url';
import { setScene, sfx } from './sound.js';
import T from './assets/terrain.json';
import EDADES from './assets/edades.json';
import GEO from './assets/geo.json';
import { COUNTRIES } from './widgets.js';
import { NO_RECONOCEN, OLIVO, FLY } from './data.js';

const gltf = new GLTFLoader();
const glb = (url) => gltf.loadAsync(url).then((g) => g.scene);
const envOf = (renderer) => { const p = new THREE.PMREMGenerator(renderer), t = p.fromScene(new RoomEnvironment(), 0.04).texture; p.dispose(); return t; };

const webgl = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
const noGL = (el) => el.insertAdjacentHTML('afterend', '<p class="small">Este equipo no tiene WebGL: la pieza 3D no se puede mostrar.</p>');

let seed = 7;
const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + R() * (b - a);

/* ------------------------------------------------------------------ */
/* El olivo: un solo lienzo fijo detrás de las diapositivas             */
/* ------------------------------------------------------------------ */
const olive = { ready: false };
function buildOlive() {
  const canvas = document.getElementById('olive');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const fit = () => renderer.setSize(innerWidth, innerHeight, false);
  fit(); addEventListener('resize', fit);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 100);
  camera.position.set(0, 4.6, 15);
  camera.lookAt(0, 3.8, 0);
  scene.add(new THREE.HemisphereLight('#fff2d8', '#4a3a28', 1.5));
  const sun = new THREE.DirectionalLight('#ffdca8', 2.4); sun.position.set(-6, 9, 6); scene.add(sun);

  // Ramas: tubos torcidos que se abren; las puntas reciben hojas
  const parts = [], tips = [];
  const branch = (from, dir, len, rad, depth) => {
    const pts = [from.clone()]; let p = from.clone(), d = dir.clone();
    for (let i = 0; i < 4; i++) {
      d.add(new THREE.Vector3(rr(-0.42, 0.42), rr(-0.12, 0.26), rr(-0.42, 0.42))).normalize();
      p = p.clone().addScaledVector(d, len / 4); pts.push(p);
    }
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, rad, 7, false));
    if (depth <= 0) { tips.push(p.clone()); return; }
    if (depth <= 2) tips.push(pts[2].clone());
    const n = depth > 3 ? 3 : 2 + (R() > 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) branch(p, d.clone().add(new THREE.Vector3(rr(-0.9, 0.9), rr(0, 0.55), rr(-0.9, 0.9))).normalize(), len * 0.72, rad * 0.62, depth - 1);
  };
  // Tronco ancho y retorcido, hecho de varias vetas como un olivo viejo
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    branch(new THREE.Vector3(Math.cos(a) * 0.5, -0.3, Math.sin(a) * 0.5), new THREE.Vector3(-Math.cos(a) * 0.12, 1, -Math.sin(a) * 0.12).normalize(), 3.1, 0.28, i % 2 ? 4 : 5);
  }
  const barkMat = new THREE.MeshStandardMaterial({ color: '#57432f', roughness: 1, flatShading: true });
  scene.add(new THREE.Mesh(mergeGeometries(parts), barkMat));

  // Hojas instanciadas: se apagan por umbral y el viento las mece en el shader
  const leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.05, 0.14, 0, 0, 0.32, 0, -0.05, 0.14, 0], 3));
  leafGeo.setIndex([0, 1, 2, 0, 2, 3]); leafGeo.computeVertexNormals();
  const N = 15000;
  const uni = { uTime: { value: 0 }, uLeaf: { value: 1 } };
  const rand = new Float32Array(N);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#8fa06c', side: THREE.DoubleSide, roughness: 0.75 });
  leafMat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uni);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aRand; uniform float uTime, uLeaf;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed *= step(aRand, uLeaf);
        transformed.x += sin(uTime * 1.7 + aRand * 40.) * .05;
        transformed.y += cos(uTime * 1.3 + aRand * 30.) * .03;`);
  };
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, N);
  const m = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    const t = tips[i % tips.length];
    m.position.set(t.x + rr(-0.75, 0.75), t.y + rr(-0.55, 0.65), t.z + rr(-0.75, 0.75));
    m.rotation.set(rr(0, 6.3), rr(0, 6.3), rr(0, 6.3));
    m.scale.setScalar(rr(0.8, 1.6));
    m.updateMatrix(); leaves.setMatrixAt(i, m.matrix);
    rand[i] = R();
  }
  leafGeo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 1));
  leaves.frustumCulled = false;
  scene.add(leaves);

  // Tierra bajo el árbol y hojas que caen cuando pierde follaje
  const groundMat = new THREE.MeshStandardMaterial({ color: '#3b2c1e', roughness: 1, transparent: true, opacity: 0.55 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 48), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.3; scene.add(ground);
  const fallN = 260, fp = new Float32Array(fallN * 3).map((_, i) => (i % 3 === 1 ? rr(0, 9) : rr(-6, 6)));
  const fallGeo = new THREE.BufferGeometry(); fallGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const fallMat = new THREE.PointsMaterial({ size: 0.13, color: '#a7a878', transparent: true, opacity: 0, depthWrite: false });
  scene.add(new THREE.Points(fallGeo, fallMat));

  const group = new THREE.Group();
  [...scene.children].filter((c) => c.isMesh || c.isPoints).forEach((c) => group.add(c));
  scene.add(group);

  let mx = 0;
  addEventListener('pointermove', (e) => { mx = (e.clientX / innerWidth - 0.5) * 2; });
  const clock = new THREE.Clock();
  olive.apply = (state) => {
    const s = OLIVO[state];
    canvas.classList.toggle('on', !!s);
    olive.running = !!s;
    if (!s) return;
    gsap.to(uni.uLeaf, { value: s.leaf, duration: 3, ease: 'power2.inOut' });
    gsap.to(fallMat, { opacity: s.fall, duration: 1.5 });
    gsap.to(group.position, { x: s.x, y: s.y ?? 0, duration: 2, ease: 'power2.inOut' });
    gsap.to(group.scale, { x: s.scale ?? 1, y: s.scale ?? 1, z: s.scale ?? 1, duration: 2, ease: 'power2.inOut' });
    const lc = new THREE.Color(s.color), bc = new THREE.Color(s.bark);
    gsap.to(leafMat.color, { r: lc.r, g: lc.g, b: lc.b, duration: 2.4 });
    gsap.to(barkMat.color, { r: bc.r, g: bc.g, b: bc.b, duration: 2.4 });
    gsap.to(sun, { intensity: s.sun ?? 2.4, duration: 2 });
    const gc = new THREE.Color(s.ground ?? '#3b2c1e'), dc = new THREE.Color(s.dust ?? '#a7a878');
    gsap.to(groundMat.color, { r: gc.r, g: gc.g, b: gc.b, duration: 2.4 });
    gsap.to(fallMat.color, { r: dc.r, g: dc.g, b: dc.b, duration: 2.4 });
  };
  const loop = () => {
    requestAnimationFrame(loop);
    if (!olive.running) return;
    const t = clock.getElapsedTime();
    uni.uTime.value = t;
    group.rotation.y += (mx * 0.28 + Math.sin(t * 0.13) * 0.14 - group.rotation.y) * 0.03;
    for (let i = 0; i < fallN; i++) {
      fp[i * 3 + 1] -= 0.012 + (i % 5) * 0.002; fp[i * 3] += Math.sin(t + i) * 0.006;
      if (fp[i * 3 + 1] < 0) fp[i * 3 + 1] = rr(5, 9);
    }
    fallGeo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  };
  loop();
  olive.ready = true;
}
export function setOlive(state) {
  if (!webgl) return;
  if (!olive.ready && state) buildOlive();
  olive.apply?.(state);
}

/* ------------------------------------------------------------------ */
/* Relieve real                                                         */
/* ------------------------------------------------------------------ */
let elevData;
export async function loadElevation() {
  if (elevData) return elevData;
  const img = new Image(); img.src = terrainUrl; await img.decode();
  const c = document.createElement('canvas'); c.width = T.width; c.height = T.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, T.width, T.height).data;
  const h = new Float32Array(T.width * T.height);
  for (let i = 0; i < h.length; i++) h[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
  // Dos pasadas de caja 3×3: quitan el serrucho del remuestreo sin mover el relieve
  for (let p = 0; p < 2; p++) {
    const s = h.slice(), w = T.width;
    for (let j = 1; j < T.height - 1; j++) for (let i = 1; i < w - 1; i++) {
      let sum = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) sum += s[(j + dj) * w + i + di];
      h[j * w + i] = sum / 9;
    }
  }
  return (elevData = h);
}
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
export const elevAt = (lon, lat) => {
  const u = (lon - T.W) / (T.E - T.W);
  const v = (mercY(T.N) - mercY(lat)) / (mercY(T.N) - mercY(T.S));
  const i = Math.round(u * (T.width - 1)), j = Math.round(v * (T.height - 1));
  return elevData[j * T.width + i];
};
const isSea = (lon, lat, h) => h <= 1 && (lon < 35.12 || (lat < 29.7 && lon < 35.1));

const flight = {};
const FLY_SOUND = ['mar:.26 viento:.09 pajaros:.05', 'viento:.2 pajaros:.1', 'viento:.14 mar:.04', 'viento:.32'];
async function fly(slide) {
  const canvas = slide.querySelector('#terrain');
  if (!webgl) return noGL(canvas);
  if (!flight.ready) {
    await loadElevation();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(1920, 1080, false);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#e9c58d', 420, 980);
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 1, 3000);
    const W = 540, H = (W * (mercY(T.N) - mercY(T.S))) / (((T.E - T.W) * Math.PI) / 180);
    const nx = 327, ny = 480;
    const g = new THREE.PlaneGeometry(W, H, nx, ny); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    const ramp = [[-430, '#4d6a55'], [0, '#7f8a57'], [200, '#a89b63'], [500, '#c6a768'], [900, '#b98d57'], [1400, '#8d6a45'], [2400, '#e6dccb']];
    const elevColor = (h) => {
      for (let i = 1; i < ramp.length; i++) if (h <= ramp[i][0]) return c.set(ramp[i - 1][1]).lerp(new THREE.Color(ramp[i][1]), (h - ramp[i - 1][0]) / (ramp[i][0] - ramp[i - 1][0]));
      return c.set(ramp[ramp.length - 1][1]);
    };
    const proj = (lon, lat) => [((lon - T.W) / (T.E - T.W) - 0.5) * W, -((mercY(T.N) - mercY(lat)) / (mercY(T.N) - mercY(T.S)) - 0.5) * -H * -1];
    const EX = 0.02; // exageración vertical
    const tame = (h) => (h > 1000 ? 1000 + (h - 1000) * 0.3 : h); // el Hermón no tapa todo lo demás
    for (let i = 0; i < pos.count; i++) {
      const lon = T.W + (pos.getX(i) / W + 0.5) * (T.E - T.W);
      const v = pos.getZ(i) / H + 0.5, my = mercY(T.N) - v * (mercY(T.N) - mercY(T.S));
      const lat = ((2 * Math.atan(Math.exp(my)) - Math.PI / 2) * 180) / Math.PI;
      const h = elevAt(lon, lat);
      const sea = isSea(lon, lat, h);
      const lake = !sea && (h < -395 || (lat > 32.7 && lat < 32.9 && lon > 35.5 && lon < 35.66 && h < -200));
      pos.setY(i, sea ? -2 : tame(h) * EX);
      (sea || lake ? c.set(lake ? '#3f8f9b' : '#2d6d8c') : elevColor(h)).toArray(col, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
    scene.add(new THREE.HemisphereLight('#fff3dc', '#5a4530', 1.1));
    const sun = new THREE.DirectionalLight('#ffd9a0', 3); sun.position.set(-300, 180, 200); scene.add(sun);
    const toV = (lon, lat, up = 0) => {
      const [x] = proj(lon, lat);
      const z = ((mercY(T.N) - mercY(lat)) / (mercY(T.N) - mercY(T.S)) - 0.5) * H;
      return new THREE.Vector3(x, tame(elevAt(lon, lat)) * EX + up, z);
    };
    const pins = FLY.pins.map((p) => {
      const el = document.createElement('div'); el.className = 'tpin'; el.innerHTML = `<b>${p.name}</b>${p.sub ? `<small>${p.sub}</small>` : ''}`;
      slide.querySelector('#tpins').appendChild(el);
      return { el, v: toV(p.at[0], p.at[1]) };
    });
    const look = new THREE.Vector3();
    const ctrl = new OrbitControls(camera, canvas);
    ctrl.target = look; ctrl.enablePan = false; ctrl.enableZoom = false; ctrl.maxPolarAngle = 1.42;
    ctrl.addEventListener('start', () => { flight.grabbed?.(); gsap.killTweensOf(camera.position); gsap.killTweensOf(look); });
    Object.assign(flight, { renderer, scene, camera, pins, look, toV, ctrl, ready: true });
  }
  const { renderer, scene, camera, pins, look, toV, ctrl } = flight;
  const buttons = [...slide.querySelectorAll('[data-stop]')];
  const info = slide.querySelector('#flyInfo');
  const place = (i) => {
    const s = FLY.stops[i];
    buttons.forEach((b, j) => b.classList.toggle('on', j === i));
    info.innerHTML = `<b>${s.title}</b>${s.text}`;
    setScene(FLY_SOUND[i]);
    const c = toV(s.cam[0], s.cam[1], s.cam[2]), l = toV(s.look[0], s.look[1]);
    gsap.killTweensOf(camera.position); gsap.killTweensOf(look);
    gsap.to(camera.position, { x: c.x, y: c.y, z: c.z, duration: 4.4, ease: 'power2.inOut' });
    gsap.to(look, { x: l.x, y: l.y, z: l.z, duration: 4.4, ease: 'power2.inOut' });
  };
  let i = 0, auto = true;
  const s0 = FLY.stops[0], c0 = toV(s0.cam[0], s0.cam[1], s0.cam[2] + 90);
  camera.position.copy(c0); look.copy(toV(s0.look[0], s0.look[1]));
  place(0);
  const timer = setInterval(() => { if (auto) { i = (i + 1) % FLY.stops.length; place(i); } }, 7000);
  buttons.forEach((b, j) => (b.onclick = () => { auto = false; i = j; place(j); }));
  flight.grabbed = () => (auto = false);
  active.add(() => {
    ctrl.update();
    pins.forEach(({ el, v }) => {
      const p = v.clone().project(camera);
      const vis = p.z < 1 && Math.abs(p.x) < 0.96 && Math.abs(p.y) < 0.92;
      el.style.opacity = vis ? 1 : 0;
      el.style.transform = `translate(${(p.x * 0.5 + 0.5) * 1920}px, ${(-p.y * 0.5 + 0.5) * 1080}px)`;
    });
    renderer.render(scene, camera);
  }, slide, () => clearInterval(timer));
}

/* Bucle común: solo corre lo de la diapositiva actual */
const active = {
  list: [],
  add(fn, slide, off) { this.list.push({ fn, slide, off }); },
  stop(slide) { this.list = this.list.filter((x) => { if (x.slide === slide) { x.off?.(); return false; } return true; }); },
};
(function tick() { requestAnimationFrame(tick); active.list.forEach((x) => x.fn()); })();
export const leave3D = (slide) => active.stop(slide);

/* ------------------------------------------------------------------ */
/* La llave y la maleta                                                 */
/* ------------------------------------------------------------------ */
const relic = {};
async function relics(slide) {
  const canvas = slide.querySelector('#relics');
  if (!webgl) return noGL(canvas);
  if (!relic.started) {
    relic.started = true;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(1500, 520, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.environment = envOf(renderer);
    const camera = new THREE.PerspectiveCamera(30, 1500 / 520, 0.1, 100);
    camera.position.z = 11;
    const l = new THREE.DirectionalLight('#ffffff', 2.4); l.position.set(-3, 5, 6); scene.add(l);
    const [k, m] = await Promise.all([glb(llaveUrl), glb(maletaUrl)]);
    k.rotation.x = Math.PI / 2; k.position.y = -0.42;
    const key = new THREE.Group().add(k); key.position.x = -3.4; key.scale.setScalar(0.92);
    const bag = new THREE.Group().add(m); bag.position.x = 3.2; bag.scale.setScalar(1.05);
    scene.add(key, bag);
    // Se agarran con el puntero y se giran; al soltar siguen solas
    const spin = { key: 0, bag: 0 }; let grab = null;
    canvas.addEventListener('pointerdown', (e) => { const r = canvas.getBoundingClientRect(); grab = { w: e.clientX < r.left + r.width / 2 ? 'key' : 'bag', x: e.clientX }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (!grab) return; spin[grab.w] += (e.clientX - grab.x) * 0.012; grab.x = e.clientX; });
    canvas.addEventListener('pointerup', () => (grab = null));
    Object.assign(relic, { renderer, scene, camera, key, bag, spin, held: () => grab?.w });
  }
  const clock = new THREE.Clock();
  active.add(() => {
    if (!relic.key) return;
    const dt = clock.getDelta(), { spin, held } = relic;
    if (held() !== 'key') spin.key += dt * 0.45;
    if (held() !== 'bag') spin.bag += dt * 0.3;
    relic.key.rotation.y = spin.key; relic.bag.rotation.y = spin.bag;
    relic.renderer.render(relic.scene, relic.camera);
  }, slide);
}

/* ------------------------------------------------------------------ */
/* Jerusalén: maqueta de la Ciudad Vieja hecha en Blender               */
/* ------------------------------------------------------------------ */
const JV = {
  muro: { t: [19, 1.5, 18], c: [2, 8.5, 3] },
  domo: { t: [34, 7, 4], c: [58, 20, 34] },
  sepulcro: { t: [-15, 5, -8], c: [-30, 16, 20] },
  todo: { t: [5, 0, 0], c: [-14, 74, 96] },
};
const JP = [['muro', 'Muro Occidental', [19, 5, 18]], ['domo', 'Cúpula de la Roca', [34, 15, 4]], ['sepulcro', 'Santo Sepulcro', [-17, 12, -8]]];
const JQ = [['Barrio cristiano', [-32, 7, -28]], ['Barrio musulmán', [10, 7, -32]], ['Barrio armenio', [-30, 7, 22]], ['Barrio judío', [-2, 7, 32]]];
const jv = {};
async function jerusalem3d(slide) {
  const canvas = slide.querySelector('#oldCity3d');
  if (!webgl) return noGL(canvas);
  if (!jv.started) {
    jv.started = true;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(1920, 1080, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e8cfa6');
    scene.fog = new THREE.Fog('#e8cfa6', 170, 340);
    scene.environment = envOf(renderer); scene.environmentIntensity = 0.7;
    // Sol bajo de la tarde: las sombras dibujan la ciudad
    const sun = new THREE.DirectionalLight('#ffc98a', 4.2); sun.position.set(-70, 46, 50); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -105, right: 105, top: 105, bottom: -105, far: 300 }); sun.shadow.bias = -0.0006;
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(36, 16 / 9, 1, 900);
    camera.position.set(-20, 110, 150);
    camera.setViewOffset(1920, 1080, -280, 0, 1920, 1080); // el sujeto queda a la derecha del texto
    const ctrl = new OrbitControls(camera, canvas);
    ctrl.enablePan = false; ctrl.minDistance = 28; ctrl.maxDistance = 190; ctrl.maxPolarAngle = 1.38; ctrl.enableDamping = true; ctrl.target.set(5, 0, 0);
    const go = (id) => {
      const s = JV[id];
      gsap.killTweensOf(camera.position); gsap.killTweensOf(ctrl.target);
      gsap.to(camera.position, { x: s.c[0], y: s.c[1], z: s.c[2], duration: 3.2, ease: 'power2.inOut' });
      gsap.to(ctrl.target, { x: s.t[0], y: s.t[1], z: s.t[2], duration: 3.2, ease: 'power2.inOut' });
    };
    slide.addEventListener('jeru', (e) => go(e.detail));
    ctrl.addEventListener('start', () => { gsap.killTweensOf(camera.position); gsap.killTweensOf(ctrl.target); });
    const city = await glb(jerusalenUrl);
    city.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(city);
    const holder = slide.querySelector('#jpins');
    const v3 = (p) => new THREE.Vector3(...p);
    const pins = [
      ...JP.map(([id, n, p]) => { const e = document.createElement('button'); e.className = 'jpin'; e.dataset.j = id; e.textContent = n; holder.appendChild(e); return { e, v: v3(p) }; }),
      ...JQ.map(([n, p]) => { const e = document.createElement('span'); e.className = 'jq'; e.textContent = n; holder.appendChild(e); return { e, v: v3(p) }; }),
    ];
    Object.assign(jv, { renderer, scene, camera, ctrl, pins });
  }
  active.add(() => {
    if (!jv.pins) return;
    jv.ctrl.update();
    jv.pins.forEach(({ e, v }) => {
      const p = v.clone().project(jv.camera);
      e.style.opacity = p.z < 1 && Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.92 ? 1 : 0;
      e.style.transform = `translate(${(p.x * 0.5 + 0.5) * 1920}px, ${(-p.y * 0.5 + 0.5) * 1080}px) translate(-50%, -50%)`;
    });
    jv.renderer.render(jv.scene, jv.camera);
  }, slide);
}

/* ------------------------------------------------------------------ */
/* La ciudad: cae por zonas, con las proporciones de UNOSAT (oct. 2025) */
/* ------------------------------------------------------------------ */
const gz = {}, DUR = 13; // segundos que dura la caída
function buildCity(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(1920, 1080, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog('#000', 14, 170);
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.5, 500);
  scene.add(new THREE.HemisphereLight('#c9b8a4', '#1b1712', 1.1));
  const sun = new THREE.DirectionalLight('#f2e2cc', 2.2); sun.position.set(-50, 26, 18); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: '#2b2722', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // Fachada por shader: los pisos miden lo mismo en cualquier edificio, también en los rotos
  const wallMat = new THREE.MeshStandardMaterial({ roughness: 1 });
  wallMat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vL; varying vec3 vNo;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
      vL = position * sc; vL.y = (position.y + 0.5) * sc.y; vNo = normal;`);
    sh.fragmentShader = 'varying vec3 vL; varying vec3 vNo;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      if (abs(vNo.y) < 0.5) {
        float u = abs(vNo.x) > 0.5 ? vL.z : vL.x;
        vec2 f = fract(vec2(u / 0.72, vL.y / 0.78));
        float w = step(0.24, f.x) * step(f.x, 0.74) * step(0.3, f.y) * step(f.y, 0.74);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04), w * 0.92);
      }`);
  };
  const data = [], sp = 3.3;
  for (let i = -38; i < 38; i++) for (let j = -46; j < 12; j++) {
    if (i % 6 === 0 || j % 5 === 0) continue; // las calles
    const pisos = R() < 0.06 ? Math.round(rr(8, 12)) : Math.round(rr(2, 6));
    data.push({ x: i * sp + rr(-0.25, 0.25), z: j * sp + rr(-0.25, 0.25), w: rr(2.2, 3), d: rr(2.2, 3), h: pisos * 0.78, r: rr(-0.25, 0.25) });
  }
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wallMat, data.length);
  mesh.frustumCulled = false; scene.add(mesh);
  // Escombros: se suman a medida que cae cada edificio
  const rubble = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 1, flatShading: true }), data.length * 10);
  rubble.frustumCulled = false; rubble.count = 0; scene.add(rubble);
  // Humo y fogonazos: la misma mancha, con otro color y mezcla
  const b = document.createElement('canvas'); b.width = b.height = 64;
  const bg = b.getContext('2d'), rad = bg.createRadialGradient(32, 32, 2, 32, 32, 32);
  rad.addColorStop(0, '#fff'); rad.addColorStop(1, 'rgba(255,255,255,0)'); bg.fillStyle = rad; bg.fillRect(0, 0, 64, 64);
  const blob = new THREE.CanvasTexture(b);
  const puff = (color, additive) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: blob, color, transparent: true, depthWrite: false, fog: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending })); m.visible = false; scene.add(m); return m; };
  Object.assign(gz, { ready: true, renderer, scene, camera, mesh, rubble, data, smoke: Array.from({ length: 96 }, () => puff('#6e6559')), glow: Array.from({ length: 10 }, () => puff('#ffa655', true)) });
}
/* ------------------------------------------------------------------ */
/* Globo: quién reconoce a Palestina                                    */
/* ------------------------------------------------------------------ */
let globe;
function recognition(slide) {
  const el = slide.querySelector('.globe');
  if (!webgl) return noGL(el);
  if (!globe) {
    const data = COUNTRIES.features.map((f) => ({ f, no: NO_RECONOCEN.includes(f.properties.name), pal: f.properties.name === 'Palestine' }));
    globe = new Globe(el, { animateIn: false }).width(1000).height(960).backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true).atmosphereColor('#7aa0c8').atmosphereAltitude(0.16)
      .polygonsData(data)
      .polygonGeoJsonGeometry((d) => d.f.geometry)
      .polygonCapColor((d) => (d.no ? '#31404f' : '#d98a3d'))
      .polygonSideColor(() => 'rgba(0,0,0,0)')
      .polygonStrokeColor(() => 'rgba(10,18,28,.8)')
      .polygonAltitude((d) => (d.no ? 0.004 : 0.012));
    globe.globeMaterial(new THREE.MeshPhongMaterial({ color: '#0b1520', shininess: 4 }));
    globe.controls().enableZoom = false;
    globe.controls().autoRotate = true; globe.controls().autoRotateSpeed = 0.6;
  }
  globe.pointOfView({ lat: 20, lng: -10, altitude: 2.2 }, 0);
  globe.pointOfView({ lat: 26, lng: 34, altitude: 2.1 }, 5000);
  globe.resumeAnimation();
  active.add(() => {}, slide, () => globe.pauseAnimation());
}

/* ------------------------------------------------------------------ */
/* Las mortajas: una por persona, del tamaño que tenía                 */
/* ------------------------------------------------------------------ */
const CAMPO = { israel: 1195, gaza: 74594 }, DX = 1, DZ = 2.4, fields = {};
const lerp = (a, b, t) => a + (b - a) * t;
function buildField(canvas, key) {
  const N = CAMPO[key], { n } = EDADES[key], tot = n.reduce((a, b) => a + b), cols = Math.ceil(Math.sqrt(N * DZ)), rows = Math.ceil(N / cols);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(1920, 1080, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050505');
  scene.fog = new THREE.Fog('#050505', 4, 30);
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 2000);
  scene.add(new THREE.HemisphereLight('#c4d0e4', '#1a1612', 2.2));
  const l = new THREE.DirectionalLight('#dfe6f0', 3); l.position.set(-4, 3, 2); scene.add(l);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: '#14110d', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  // Cuerpo envuelto en tela: pies, hombros, cuello, cabeza. De cerca, con las vueltas de la tela
  const silueta = [[0, 0], [0.12, 0.02], [0.17, 0.1], [0.18, 0.2], [0.2, 0.8], [0.25, 1.2], [0.26, 1.32], [0.2, 1.43], [0.135, 1.49], [0.145, 1.56], [0.15, 1.66], [0.1, 1.75], [0, 1.78]];
  const radio = (y) => { const j = silueta.findIndex((c) => c[1] >= y), [x0, y0] = silueta[Math.max(0, j - 1)], [x1, y1] = silueta[j]; return lerp(x0, x1, (y - y0) / (y1 - y0 || 1)); };
  const cuerpo = (pts, seg) => {
    const g = new THREE.LatheGeometry(pts, seg);
    g.rotateX(Math.PI / 2); g.scale(1, 0.62, 1); g.translate(0, 0.14, -0.89);
    return g;
  };
  const cerca = cuerpo(Array.from({ length: 49 }, (_, i) => { const y = (i / 48) * 1.78; return new THREE.Vector2(radio(y) * (1 + 0.035 * Math.sin(y * 38 + y * y * 9)), y); }), 14);
  const lejos = cuerpo([[0, 0], [0.17, 0.06], [0.2, 0.8], [0.26, 1.28], [0.135, 1.49], [0.15, 1.66], [0, 1.78]].map(([x, y]) => new THREE.Vector2(x, y)), 6);
  const tela = new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.95 });
  const ages = new Uint8Array(N), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3();
  const pos = (i) => [((i % cols) - (cols - 1) / 2) * DX, (Math.floor(i / cols) - (rows - 1) / 2) * DZ];
  const first = Math.min(N - 1, (rows - 1) * cols + Math.floor(cols / 2)); // la primera que se ve, de cerca, es de un chico
  // Solo las que se ven de cerca llevan la malla detallada: en Gaza son decenas de miles
  const [fx, fz] = pos(first), matrices = [];
  for (let i = 0; i < N; i++) {
    let r = R() * tot, a = 0;
    while (a < 100 && r >= n[a]) r -= n[a++];
    if (i === first) a = 3;
    ages[i] = a;
    const h = Math.min(1, 0.3 + a * 0.042), [x, z] = pos(i);
    P.set(x + rr(-0.06, 0.06), 0, z + rr(-0.12, 0.12)); q.setFromAxisAngle(up, rr(-0.05, 0.05)); S.set(0.5 + h / 2, 0.5 + h / 2, h);
    matrices.push(m.compose(P, q, S).clone());
  }
  const isNear = (i) => { const [x, z] = pos(i); return Math.hypot(x - fx, z - fz) < 34; };
  const near = matrices.filter((_, i) => isNear(i)), far = matrices.filter((_, i) => !isNear(i));
  const mesh = new THREE.InstancedMesh(cerca, tela, near.length), rest = new THREE.InstancedMesh(lejos, tela, far.length);
  near.forEach((x, i) => mesh.setMatrixAt(i, x)); far.forEach((x, i) => rest.setMatrixAt(i, x));
  rest.frustumCulled = mesh.frustumCulled = false;
  scene.add(mesh, rest);
  const halo = new THREE.Mesh(cerca, new THREE.MeshBasicMaterial({ color: '#e2533a', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  halo.matrixAutoUpdate = false; halo.visible = false; scene.add(halo);
  return { renderer, scene, camera, matrices, halo, ages, cols, rows, N, near: (rows * DZ) / 2, size: Math.max(cols * DX, rows * DZ) };
}
function mortajas(slide, key) {
  const canvas = slide.querySelector('canvas');
  if (!webgl) return noGL(canvas);
  const f = (fields[key] ??= buildField(canvas, key)), { nombres } = EDADES[key];
  const [tip, end] = ['.mj-tip', '.mj-end'].map((c) => slide.querySelector(c));
  end.classList.remove('on'); tip.textContent = ''; f.halo.visible = false;
  const t1 = 12 / (f.size * 0.62), o = { t: t1 }, look = new THREE.Vector3(); // arranca desde arriba: de cerca parecen muñecos
  const place = () => {
    const t = o.t;
    f.camera.position.set(lerp(0.35, 0, t), lerp(0.75, f.size * 0.62, t), lerp(f.near + 1.5, f.near + f.size * 0.3, t));
    look.set(0, 0, lerp(f.near - 6, 0, t)); f.camera.lookAt(look);
    f.scene.fog.near = lerp(4, f.size * 2, t); f.scene.fog.far = lerp(30, f.size * 5, t);
  };
  place();
  // Pasar el cursor: la celda bajo el puntero dice un nombre real de la lista, de esa edad
  const ray = new THREE.Raycaster(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0)), hit = new THREE.Vector3();
  let last = -1;
  canvas.onpointermove = (e) => {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2), f.camera);
    if (!ray.ray.intersectPlane(floor, hit)) return;
    const c = Math.round(hit.x / DX + (f.cols - 1) / 2), w = Math.round(hit.z / DZ + (f.rows - 1) / 2), i = w * f.cols + c;
    if (c < 0 || c >= f.cols || w < 0 || i >= f.N || i === last) return;
    last = i;
    const a = f.ages[i], list = nombres[a];
    f.halo.matrix.copy(f.matrices[i]); f.halo.visible = true;
    if (list.length) tip.textContent = `${list[i % list.length].split(' · ')[0]} · ${a ? a + (a === 1 ? ' año' : ' años') : 'menos de un año'}`;
    sfx('voto');
  };
  // Por reloj, no por cuadros: en una compu lenta tarda lo mismo
  const t0 = performance.now(), ease = gsap.parseEase('power1.in');
  active.add(() => {
    const x = (performance.now() - t0 - 2500) / 5000;
    if (x > 0) { o.t = lerp(t1, 1, ease(Math.min(x, 1))); place(); }
    if (x >= 1) end.classList.add('on');
    f.renderer.render(f.scene, f.camera);
  }, slide);
}

export const HOOKS3D = { jerusalem3d, fly, relics, recognition, mortajas };
