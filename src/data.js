// Datos del deck. Los trazados históricos dibujados a mano son aproximados y
// la diapositiva lo dice; los contornos actuales vienen de Natural Earth.

// Cómo está el olivo en cada momento de la historia
export const OLIVO = {
  portada: { leaf: 1, fall: 0.5, x: 3.6, color: '#8fa06c', bark: '#57432f', sun: 2.8 },
  relato: { leaf: 1, fall: 0.8, x: -4.6, color: '#93a56f', bark: '#57432f', sun: 2.8 },
  polvo: { leaf: 0.82, fall: 0.5, x: 4.2, color: '#a39a6f', bark: '#5a4a38', sun: 2.2 },
  ceniza: { leaf: 0.55, fall: 0.9, x: 4.2, color: '#8e8e8e', bark: '#3a3a3a', sun: 1.6, ground: '#2b2b2b', dust: '#9c9c9c' },
  destenido: { leaf: 0.5, fall: 0.5, x: 4.2, color: '#8f9a6a', bark: '#4f4032', sun: 2 },
  herido: { leaf: 0.22, fall: 1, x: 4.2, color: '#6d7157', bark: '#2f2b26', sun: 1.2, ground: '#181818', dust: '#8a8a8a' },
  brote: { leaf: 0.1, fall: 0, x: 4.4, color: '#9cc25a', bark: '#4b3a2a', sun: 3 },
};

// Lo que dice el olivo si lo tocan
export const OLIVO_VOZ = {
  portada: ['Tocame: cada rama guarda algo.', 'Hay olivos en estas colinas con más de mil años.'],
  relato: ['La aceituna se cosecha a mano, entre octubre y noviembre.', 'Me nombran la Biblia y el Corán.', 'Para judíos y palestinos, soy símbolo de esta tierra.'],
  polvo: ['En 1882 llegaron los primeros colonos sionistas.', 'En 1900 acá vivían unas 600.000 personas.', 'Los otomanos gobernaron esta tierra 400 años.'],
  ceniza: ['Donde hubo aldeas, quedan cactus y olivos.', 'Yo no me fui. Muchos de los que me cuidaban, sí.', 'Vi lo que hicieron unos y otros. No me pregunten quién empezó.'],
  herido: ['Esa noche habían cantado por la paz.', 'Rabin llevaba en el bolsillo la letra de esa canción.'],
  brote: ['Un olivo talado puede rebrotar desde la raíz.', 'Tardo años en dar fruto. Sé esperar.'],
};

// Vuelo sobre el relieve: [lon, lat, altura] de la cámara y punto al que mira
export const FLY = {
  stops: [
    { label: 'El mar', cam: [34.1, 31.5, 34], look: [34.85, 32.0], title: 'Una franja verde junto al mar', text: 'Costa llana del Mediterráneo: acá viven la mayoría de los israelíes. Tel Aviv, Haifa y, al sur, Gaza.' },
    { label: 'Las colinas', cam: [34.72, 31.62, 26], look: [35.2, 31.78], title: 'La columna de piedra', text: 'A menos de una hora de la playa, el suelo sube a 800 metros. En esas colinas están Jerusalén, Ramallah, Nablus y Hebrón.' },
    { label: 'Mar Muerto', cam: [35.0, 31.2, 16], look: [35.47, 31.5], title: '−430 metros', text: 'Después el terreno se desploma: la orilla del Mar Muerto es el punto más bajo de la tierra firme.' },
    { label: 'El Néguev', cam: [34.3, 29.7, 58], look: [34.9, 30.7], title: 'El desierto', text: 'El sur es desierto: el Néguev ocupa cerca de la mitad de Israel y llega hasta el golfo de Aqaba.' },
  ],
  pins: [
    { name: 'Tel Aviv', at: [34.78, 32.08] }, { name: 'Haifa', at: [34.99, 32.79] }, { name: 'Gaza', at: [34.46, 31.5] },
    { name: 'Jerusalén', sub: '≈ 800 m', at: [35.22, 31.78] }, { name: 'Mar Muerto', sub: '−430 m', at: [35.47, 31.5] },
    { name: 'Mar de Galilea', sub: '−210 m', at: [35.59, 32.82] }, { name: 'Eilat', at: [34.95, 29.56] },
  ],
};

export const CITIES = {
  jerusalen: ['Jerusalén', 35.22, 31.78], telaviv: ['Tel Aviv', 34.78, 32.08], haifa: ['Haifa', 34.99, 32.79],
  gaza: ['Gaza', 34.46, 31.51], ramallah: ['Ramallah', 35.2, 31.9], nablus: ['Nablus', 35.26, 32.22],
  hebron: ['Hebrón', 35.1, 31.53], belen: ['Belén', 35.2, 31.7], jerico: ['Jericó', 35.46, 31.85],
  beersheba: ['Beerseba', 34.79, 31.25], eilat: ['Eilat', 34.95, 29.56], jenin: ['Yenín', 35.3, 32.46],
};

// Plan de partición de 1947: el Estado judío, se recorta contra el Mandato.
export const PARTICION = {
  judio: [
    [[35.75, 33.4], [35.68, 32.95], [35.68, 32.7], [35.6, 32.42], [35.3, 32.5], [35.08, 32.55], [35.0, 32.42], [34.97, 32.1], [34.86, 31.92], [34.6, 31.86], [34.3, 32.1], [34.7, 33.0], [35.05, 32.87], [35.32, 32.86], [35.42, 33.02], [35.5, 33.12], [35.5, 33.4]],
    [[34.42, 31.72], [34.86, 31.82], [34.85, 31.42], [35.15, 31.33], [35.46, 31.48], [35.6, 31.3], [35.4, 30.9], [35.1, 29.9], [34.96, 29.45], [34.8, 29.45], [34.28, 30.85], [34.5, 31.12], [34.62, 31.42]],
  ],
  arabeEnclave: [[34.74, 32.07], [34.8, 32.05], [34.78, 32.0], [34.72, 32.0]],
  jerusalen: [[35.13, 31.87], [35.28, 31.87], [35.31, 31.7], [35.15, 31.68]],
};
export const SINAI = [[32.3, 31.25], [34.22, 31.33], [34.9, 29.49], [34.25, 27.75], [33.2, 28.5], [32.55, 29.95]];
export const GOLAN = [[35.62, 33.24], [35.85, 33.33], [35.96, 32.9], [35.85, 32.72], [35.65, 32.7]];

// Seis días, paso a paso
export const SEISDIAS = [
  { d: '5 de junio', zona: 'sinai', t: 'Israel ataca primero, por aire, y destruye la aviación egipcia en tierra. Sus tanques entran en Gaza y el Sinaí.' },
  { d: '6 de junio', zona: 'cis', t: 'Jordania entra en la guerra. Se combate en Jerusalén y en Cisjordania.' },
  { d: '7 de junio', zona: 'cis', t: 'Israel toma la Ciudad Vieja de Jerusalén. Soldados llegan al Muro: era inaccesible para los judíos desde 1948.' },
  { d: '8 de junio', zona: 'sinai', t: 'Las tropas israelíes alcanzan el canal de Suez. Egipto acepta el alto el fuego.' },
  { d: '9 de junio', zona: 'golan', t: 'Israel ataca los Altos del Golán, en Siria.' },
  { d: '10 de junio', zona: 'todo', t: 'Fin de la guerra. Israel controla un territorio más de tres veces mayor. Cerca de 300.000 palestinos más se desplazan.' },
];

// Cisjordania según Oslo: esquema de manchas alrededor de las ciudades
export const OSLO = {
  a: [[35.3, 32.46, 0.045], [35.03, 32.31, 0.03], [34.98, 32.19, 0.02], [35.26, 32.22, 0.055], [35.2, 31.9, 0.045], [35.2, 31.7, 0.03], [35.1, 31.53, 0.05], [35.46, 31.85, 0.05], [35.03, 31.42, 0.035]],
  b: [[35.2, 32.38, 0.09], [35.15, 32.14, 0.08], [35.33, 32.1, 0.08], [35.12, 31.97, 0.07], [35.28, 31.98, 0.06], [35.12, 31.62, 0.08], [35.0, 31.5, 0.06], [35.2, 31.48, 0.07]],
};
export const ASENTAMIENTOS = [
  ['Ariel', 35.17, 32.1], ["Ma'ale Adumim", 35.3, 31.78], ['Modiín Illit', 35.04, 31.93], ['Beitar Illit', 35.12, 31.7],
  ['Gush Etzion', 35.13, 31.65], ['Kiryat Arba', 35.12, 31.53], ['Karnei Shomron', 35.09, 32.17], ['Efrat', 35.15, 31.66], ["Giv'at Ze'ev", 35.17, 31.86],
  ['Oranit', 34.99, 32.13], ['Emmanuel', 35.13, 32.16], ['Kedumim', 35.15, 32.21], ['Shilo', 35.3, 32.05], ['Beit El', 35.22, 31.94], ['Ofra', 35.26, 31.96], ['Elkana', 35.03, 32.11], ['Alfei Menashe', 35.0, 32.17], ['Tekoa', 35.22, 31.63],
];
// Colonos en Cisjordania sin Jerusalén Este (Oficina de Estadísticas de Israel, vía Peace Now)
export const COLONOS = [[1972, 1500], [1980, 12500], [1990, 81900], [2000, 198300], [2010, 311100], [2020, 451700], [2024, 511100]];

export const NO_RECONOCEN = ['United States of America', 'Germany', 'Italy', 'Japan', 'South Korea', 'New Zealand', 'Israel', 'Netherlands', 'Belgium', 'Denmark', 'Finland', 'Austria', 'Switzerland', 'Greece', 'Croatia', 'Estonia', 'Latvia', 'Lithuania', 'Moldova', 'North Macedonia', 'Macedonia', 'Panama', 'Cameroon', 'Eritrea', 'Myanmar', 'Fiji', 'Solomon Is.'];

export const JERUSALEN = [
  { id: 'muro', n: 'El Muro Occidental', q: 'Judaísmo', t: 'Es lo que queda del Segundo Templo, destruido por Roma en el año 70. El lugar de oración más sagrado para los judíos.' },
  { id: 'domo', n: 'La Explanada', q: 'Islam', t: 'Al-Aqsa y la Cúpula de la Roca: el tercer lugar más sagrado del islam. Sobre el mismo monte estuvo el Templo: por eso es el punto más delicado del conflicto.' },
  { id: 'sepulcro', n: 'Santo Sepulcro', q: 'Cristianismo', t: 'Para los cristianos, el lugar de la crucifixión y la tumba de Jesús. Lo comparten seis confesiones cristianas.' },
];

// Diapositivas que se recorren tocando: y = botón, at = [lon, lat] si va en el mapa
export const PASOS = {
  m48: [
    { y: 'Deir Yassin', at: [35.18, 31.79], w: '9 de abril de 1948', n: 'Una aldea árabe', t: 'Milicias sionistas Irgun y Lehi matan a más de 100 aldeanos, mujeres y chicos incluidos. La noticia dispara la huida de miles.' },
    { y: 'Hadassah', at: [35.24, 31.8], w: '13 de abril de 1948', n: 'Un convoy médico', t: 'Cuatro días después, fuerzas árabes emboscan un convoy al hospital de Jerusalén. Mueren 78 judíos, sobre todo médicos y enfermeras.' },
    { y: 'Haifa', at: [34.99, 32.79], w: 'Abril de 1948', n: 'Una ciudad se vacía', t: 'Cae Haifa. Unos 60.000 árabes dejan la ciudad en días, por mar y por tierra.' },
    { y: 'Kfar Etzion', at: [35.12, 31.65], w: '13 de mayo de 1948', n: 'Después de rendirse', t: 'Un día antes de la independencia, cerca de 130 defensores judíos mueren en el asalto, la mayoría tras rendirse.' },
    { y: 'Lod y Ramla', at: [34.89, 31.95], w: 'Julio de 1948', n: 'La marcha', t: 'El ejército israelí toma las dos ciudades y expulsa a unos 50.000 árabes. Caminan al este en pleno verano. Muchos mueren de sed y cansancio.' },
    { y: 'Dawayima', at: [34.91, 31.53], w: 'Octubre de 1948', n: 'Otra aldea', t: 'Soldados israelíes matan a unos 100 civiles. Más de 400 aldeas árabes quedarán vacías, y muchas, borradas.' },
  ],
  espiral: [
    { y: '1972', w: 'Múnich', n: '11 israelíes', t: 'Septiembre Negro, grupo palestino, entra a la villa olímpica y toma al equipo de Israel. Mueren 11 atletas y entrenadores, frente a la televisión de todo el mundo.' },
    { y: '1973', w: 'Yom Kipur', n: 'Miles de soldados', s: 'estallido', t: 'Egipto y Siria atacan en el día más sagrado del judaísmo. Mueren unos 2.600 israelíes y más de 8.000 árabes. Los árabes cortan el petróleo: el barril se multiplica por cuatro.' },
    { y: '1974', w: "Ma'alot", n: '22 chicos', t: 'Un comando palestino toma una escuela israelí. En el rescate y la masacre mueren 25 rehenes, 22 de ellos chicos.' },
    { y: '1978', w: 'Ruta de la costa · Camp David', n: 'Masacre y tratado', t: 'Un comando secuestra un colectivo: 38 civiles israelíes muertos, 13 chicos. Israel invade el sur de Líbano. Ese mismo año, Sadat y Begin negocian: en 1979, Egipto es el primer país árabe en reconocer a Israel. Para los palestinos, nada cambia.', s: 'campana' },
    { y: '1982', w: 'Sabra y Chatila', n: 'Hasta 3.500 muertos', s: 'estallido', t: 'Israel invade Líbano para echar a la OLP. En dos campos de refugiados palestinos, milicias cristianas libanesas matan durante tres días, con el ejército israelí alrededor. Una comisión de Israel halla responsable a Sharon, que renuncia.' },
  ],
  muro: [
    { y: 'Tel Aviv', at: [34.77, 32.08], w: 'Junio de 2001', n: 'Delfinario', t: 'Un suicida se hace explotar en la fila de una discoteca. 21 muertos, casi todos adolescentes.' },
    { y: 'Netanya', at: [34.86, 32.33], w: 'Marzo de 2002', n: 'Hotel Park', t: 'Otro suicida entra a la cena de Pascua judía. 30 muertos, muchos de ellos ancianos.' },
    { y: 'Yenín', at: [35.3, 32.46], w: 'Abril de 2002', n: 'El campo de refugiados', t: 'Israel entra con tanques y topadoras. 52 palestinos muertos, cerca de la mitad civiles, y 23 soldados israelíes. Barrios enteros, demolidos.' },
    { y: 'Qalqilya', at: [34.97, 32.19], w: 'Desde 2003', n: 'Una ciudad rodeada', t: 'Más de 40.000 personas con el muro casi todo alrededor. Sus campos quedan del otro lado: se llega por un portón, con permiso.' },
    { y: "Bil'in", at: [35.07, 31.93], w: 'Desde 2005', n: 'Cada viernes', t: 'El muro separa a la aldea de sus olivares. Protestan todas las semanas. En 2009 una granada de gas mata a Bassem Abu Rahmah. La Corte de Israel ordena mover el trazado.' },
    { y: 'Abu Dis', at: [35.26, 31.76], w: 'Hoy', n: 'Ocho metros', t: 'Hormigón en medio de la calle. Vecinos, escuelas y hospitales quedan del otro lado, a veces a metros.' },
  ],
};

// ¿A dónde vas? Cada lugar al que huís, en orden libre. Fechas y hechos reales
export const ADONDE = [
  { n: 'Ciudad de Gaza', at: [34.46, 31.51], w: 'Noviembre de 2023', t: 'Te refugiás cerca de Al-Shifa, el hospital más grande. El ejército lo toma dos veces: dice que Hamás lo usaba. Queda en ruinas.' },
  { n: 'Deir al-Balah', at: [34.35, 31.42], w: 'Agosto de 2024', t: 'Te dijeron que acá estabas a salvo. Llegan órdenes de evacuar también acá. Las carpas se apilan contra el mar.' },
  { n: 'Khan Yunis', at: [34.3, 31.35], w: 'Diciembre de 2023', t: 'Era el refugio del sur. El ejército entra. La ciudad queda arrasada.' },
  { n: 'Rafah', at: [34.25, 31.29], w: 'Mayo de 2024', t: 'Última ciudad, contra Egipto. Más de un millón de personas. El ejército entra y todos se vuelven a ir.' },
  { n: 'Al-Mawasi', at: [34.29, 31.372], w: 'Julio de 2024', t: 'La "zona humanitaria" que marcó el propio Israel. Un ataque contra un jefe de Hamás mata a más de 90 personas entre las carpas.' },
];
