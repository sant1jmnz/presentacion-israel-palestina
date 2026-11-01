// Grabaciones reales de Wikimedia Commons → src/assets/audio/<clave>.ogg
// loop: bucle sin corte · gap: suceso con silencio después (se repite espaciado) · shot: una vez
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const OUT = 'src/assets', TMP = 'node_modules/.cache/audio';
const UA = { 'User-Agent': 'IsraelPalestinaSchoolDeck/1.0 (student geography presentation)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(TMP, { recursive: true });

const A = {
  viento: ['Howling wind.ogg', 'loop', 20, 36],
  mar: ['Sea waves.wav', 'loop', 0, 18],
  pajaros: ['Birds singing in Fribourg 01.ogg', 'loop', 0, 30],
  campanas: ['Bells-ProtestantTempleOfVersoix06022022.ogg', 'loop', 8, 34],
  maquina: ['WWS Typewriter.ogg', 'loop', 0, 23],
  telegrafo: ['Psalm 23 1 Morse Code.wav', 'loop', 0, 27],
  reloj: ['Clock ticking.ogg', 'loop', 0, 15],
  multitud: ['Group discussion 3.ogg', 'loop', 0, 40],
  barco: ['WWS IcebreakerKunashipssiren.ogg', 'gap', 0, 21, 34],
  piedras: ['Assorted gravel rock and stones.ogg', 'loop', 4, 40],
  disparos: ['Gunshots 8.ogg', 'gap', 0, 6, 13], // tiro.ogg sale de acá: un disparo (4,5 s) a 0,82 de velocidad y saturado con ffmpeg
  explosiones: ['Explosions-LS100155.ogg', 'gap', 0, 10, 21],
  aviones: ['428086 inspectorj airplane-boeing-flyby-right-to-left-a.wav', 'loop', 4, 40],
  sirena: ['Civil-defense-siren-waver.ogg', 'loop', 4, 40],
  helicoptero: ['Helicopter flying overhead.wav', 'loop', 0, 9],
  topadora: ['Berg zand verplaatsen door een bulldozer - SoundCloud - Beeld en Geluid.ogg', 'loop', 60, 36],
  latido: ["Laura's heartbeat after exercise 3.wav", 'loop', 1, 11],
  fuego: ['Campfire sound ambience.ogg', 'loop', 5, 30],
  aplauso: ['277021 sandermotions applause-2.wav', 'shot', 0, 6],
  paso: ['Footstep on Gravel (Gravity Sound).mp3', 'shot', 0, 1],
  estallido: ['Explosion-LS100155.ogg', 'shot', 0, 2],
  declaracion: ['Israeli Declaration of Independence.ogg', 'gap', 0, 45, 70],
  kolnidre: ['The National Library of Israel - Kol Nidre - 1785177 ENGEL.ogg', 'loop', 0, 60],
  ambulancia: ['Het aankomen en stoppen van twee ambulances met sirenes - SoundCloud - Beeld en Geluid.ogg', 'gap', 0, 25, 45],
  llanto: ['Woman crying.ogg', 'loop', 0, 40],
  sollozo: ['Man Crying .ogg', 'loop', 10, 40],
  bebe: ['Crying newborn baby.ogg', 'loop', 0, 20],
  bebe2: ['Babys disappointed crying.oga', 'loop', 0, 30],
  grito: ['Cry of woman.ogg', 'loop', 0, 24],
  respira: ['Heavy breathing 3.ogg', 'loop', 5, 40],
  susurro: ['Whispering-example.ogg', 'shot', 0, 3],
};

const strip = (h = '') => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const creditsFile = `${OUT}/credits.json`;
const credits = JSON.parse(fs.readFileSync(creditsFile, 'utf8'));
async function info(title) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent('File:' + title)}&prop=imageinfo&iiprop=url|extmetadata&iiextmetadatafilter=LicenseShortName|Artist`;
  for (let i = 0; i < 6; i++) {
    const t = await fetch(api, { headers: UA }).then((r) => r.text());
    try { return Object.values(JSON.parse(t).query.pages)[0].imageinfo[0]; } catch { await sleep(10000); }
  }
}
const FX = 'loudnorm=I=-18:TP=-1.5:LRA=11,aresample=32000';
const CF = 2;
function encode(src, dest, [, mode, start, len, pad]) {
  const enc = ['-ac', '1', '-c:a', 'libvorbis', '-q:a', '1.5', '-y', dest];
  const io = ['-hide_banner', '-loglevel', 'error', '-ss', start, '-t', len + CF, '-i', src].map(String);
  if (mode === 'loop') {
    const f = `[0]asplit[a][b];[a]atrim=0:${len},asetpts=N/SR/TB,afade=in:d=${CF}[h];[b]atrim=${len}:${len + CF},asetpts=N/SR/TB,afade=out:d=${CF}[t];[h][t]amix=2:normalize=0:duration=longest,${FX}`;
    execFileSync('ffmpeg', [...io, '-filter_complex', f, ...enc]);
  } else {
    execFileSync('ffmpeg', [...io, '-af', `${FX},afade=out:st=${len - 0.15}:d=0.15${mode === 'gap' ? `,apad=whole_dur=${pad}` : ''}`, ...enc]);
  }
}

for (const [key, spec] of Object.entries(A)) {
  const dest = `${OUT}/audio/${key}.ogg`;
  if (fs.existsSync(dest) && credits[key]) continue;
  const i = await info(spec[0]);
  if (!i) { console.warn('SIN INFO', key); continue; }
  // Si ya se bajó a mano, va en audio-crudo/ con el nombre original
  let src = `audio-crudo/${spec[0]}`;
  if (!fs.existsSync(src)) {
    await sleep(60000);
    let res = await fetch(i.url, { headers: UA });
    for (let t = 0; res.status === 429 && t < 4; t++) {
      await sleep((+res.headers.get('retry-after') || 600) * 1000 + 10000);
      res = await fetch(i.url, { headers: UA });
    }
    if (!res.ok) { console.warn(key, res.status); continue; }
    src = `${TMP}/${key}.src`;
    fs.writeFileSync(src, Buffer.from(await res.arrayBuffer()));
  }
  encode(src, dest, spec);
  credits[key] = { title: spec[0], artist: strip(i.extmetadata?.Artist?.value), license: i.extmetadata?.LicenseShortName?.value || '', url: i.descriptionurl };
  fs.writeFileSync(creditsFile, JSON.stringify(credits, null, 1));
  console.log('ok', key, fs.statSync(dest).size >> 10, 'KB', credits[key].license);
}
