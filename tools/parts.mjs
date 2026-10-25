// Malované části kostí (M2): každý vrchol kosti dostane nejvýš jednu část z app/data.js.
//
// Výchozí body jsou popisky (landmarky) z atlasu Z-Anatomy: anatomové je umístili přímo na danou strukturu.
// Tři způsoby malování:
//   P  „růst“  – z bodu se oblast šíří po povrchu kosti (geodeticky); kde se potkají dvě oblasti, je hranice.
//              r = největší vzdálenost po povrchu (m); dál oblast neroste a zbytek připadne větším oblastem.
//   B  blok    – bod struktury, která v seznamu není (hrbolek, jamka…): zastaví sousední oblasti, sám se nemaluje.
//   S  koule   – kloubní hlavice: vše, co leží na kouli proložené povrchem kolem popisku.
//   Band pás   – prstenec kolem kosti ve výšce popisku (podél hlavní osy kosti), např. chirurgický krček.
import fs from 'node:fs';

const B = (lm, r = 0.012) => ({ lm, r, block: true });
const P = (id, lm, r) => ({ id, lm, r });
// koule s poloměrem rMin–rMax, na které leží nejvíc povrchu do `max` od popisku; odchylka od koule < `tol`
const S = (id, lm, max, [rMin, rMax], tol = 0.002) => ({ id, lm, type: 'sphere', max, rMin, rMax, tol });
// prstenec ±half ve výšce popisku; přemaluje jen nenamalované vrcholy a části z `over`
const Band = (id, lm, half, over = []) => ({ id, lm, type: 'band', half, over });
// jamka: koule jako S, maluje se celý kužel jamky (úhel od osy) do hloubky R + depth
const Cup = (id, lm, max, [rMin, rMax], angle, depth, tol = 0.002) => ({ id, lm, type: 'cup', max, rMin, rMax, angle, depth, tol });
// hřeben: nahoru otočené vrcholy části `within` do `band` pod jejím nejvyšším bodem
const Crest = (id, within, minUp, band) => ({ id, type: 'crest', within, minUp, band });
// okraj otvoru: popisek je uprostřed otvoru; maluje se kost do `width` od okraje (paprsky do `reach`)
const Rim = (id, lm, width, reach) => ({ id, lm, type: 'rim', width, reach });

// Pánevní kost: kost kyčelní / sedací / stydká podle materiálů v Z-Anatomy (Bone-6 / Bone-7 / Bone-1).
export const HIP_MATERIALS = { 'Bone-6': 'os_ilium', 'Bone-7': 'os_ischii', 'Bone-1': 'os_pubis' };

export const BONE_PARTS = {
  clavicula: [P('ext_acromialis', 'Acromial end', 0.03), P('ext_sternalis', 'Sternal end', 0.03), B('Body of clavicle', 0.06), B('Conoid tubercle')],
  scapula: [
    P('acromion', 'Acromion', 0.05), P('proc_coracoideus', 'Coracoid process', 0.04), P('cavitas_glenoidalis', 'Glenoid fossa', 0.022),
    B('Neck of scapula'), B('Supraglenoid tubercle'), B('Infraglenoid tubercle'), B('Supraspinous fossa', 0.08), B('Infraspinous fossa', 0.1),
    B('Spinoglenoid notch'), B('Acromial angle', 0.008),
  ],
  humerus: [
    S('caput_humeri', 'Head of humerus', 0.05, [0.019, 0.028]), Band('collum_chirurgicum', 'Surgical neck of humerus', 0.008, ['corpus_humeri']),
    P('corpus_humeri', 'Body of humerus', 0.3),
    P('capitulum_humeri', 'Capitulum of humerus', 0.016), P('trochlea_humeri', 'Trochlea of humerus', 0.025),
    P('fossa_olecrani', 'Olecranon fossa', 0.02), P('fossa_coronoidea', 'Coronoid fossa', 0.012),
    P('epicondylus_medialis', 'Medial epicondyle of humerus', 0.018), P('epicondylus_lateralis', 'Lateral epicondyle of humerus', 0.014),
    B('Greater tubercle', 0.032), B('Lesser tubercle', 0.02), B('Anatomical neck of humerus', 0.008),
  ],
  radius: [
    P('caput_radii', 'Head of radius', 0.022), P('collum_radii', 'Neck of radius', 0.014), P('corpus_radii', 'Body of radius', 0.3),
    P('tuberositas_radii', 'Radial tuberosity', 0.016), P('styloideus_radii', 'Radial styloid process', 0.018), B('Dorsal radial tubercle'),
  ],
  ulna: [
    P('olecranon', 'Olecranon', 0.03), P('coronoideus_ulnae', 'Coronoid process of ulna', 0.018), P('incisura_trochlearis', 'Trochlear notch', 0.02),
    P('incisura_radialis', 'Radial notch', 0.01), P('corpus_ulnae', 'Body of ulna', 0.3), P('caput_ulnae', 'Head of ulna', 0.015),
    P('styloideus_ulnae', 'Ulnar styloid process', 0.01), B('Tuberosity of ulna'),
  ],
  femur: [
    S('caput_femoris', 'Head of femur', 0.06, [0.019, 0.028]), P('collum_femoris', 'Neck of femur', 0.035), P('trochanter_major', 'Greater trochanter', 0.045),
    P('trochanter_minor', 'Lesser trochanter', 0.02), P('condylus_med_fem', 'Medial condyle of femur', 0.06), P('condylus_lat_fem', 'Lateral condyle of femur', 0.06),
    P('facies_patellaris', 'Patellar surface of femur', 0.035),
    B('Body of femur', 0.3), B('Intertrochanteric line'), B('Intertrochanteric crest'), B('Trochanteric fossa'), B('Intercondylar fossa'),
  ],
  tibia: [
    P('condylus_med_tib', 'Medial condyle of tibia', 0.045), P('condylus_lat_tib', 'Lateral condyle of tibia', 0.045), P('malleolus_medialis', 'Medial malleolus', 0.025),
    B('Body of tibia', 0.3), B('Tibial tuberosity'), B('Intercondylar eminence'), B('Anterior intercondylar area'),
  ],
  os_coxae: [
    Cup('acetabulum', 'Acetabulum', 0.045, [0.022, 0.032], 1.45, 0.008), Crest('crista_iliaca', 'os_ilium', 0.3, 0.06),
    P('tuber_ischiadicum', 'Ischial tuberosity', 0.025), P('facies_auricularis', 'Auricular surface of ilium', 0.028),
    Rim('foramen_obturatum', 'Obturator foramen', 0.005, 0.045),
    B('Iliac tuberosity'), B('Arcuate line of ilium', 0.008),
  ],
  os_sacrum: [P('promontorium', 'Promontory', 0.014)],
  os_temporale: [
    P('pars_petrosa', 'Petrous part of temporal bone', 0.03), P('pars_petrosa', 'Apex of petrous part', 0.02),
    P('pars_petrosa', 'Anterior surface of petrous part', 0.022), P('pars_petrosa', 'Posterior surface of petrous part', 0.022),
    B('Mastoid process', 0.02), B('Styloid process of temporal bone', 0.01),
  ],
  os_occipitale: [Rim('foramen_magnum', 'Foramen magnum', 0.006, 0.04)],
  fibula: [P('caput_fibulae', 'Head of fibula', 0.025), P('malleolus_lateralis', 'Lateral malleolus', 0.035), B('Neck of fibula'), B('Body of fibula', 0.3)],
};

// ---------- souřadnice Z-Anatomy → BodyParts3D ----------
// Z-Anatomy vznikla z BodyParts3D: stejné kosti, jen zmenšené a posunuté. Měřítko a posun se dopočítají
// z obalových boxů několika kostí, které jsou v obou zdrojích (aplikační souřadnice: m, Y nahoru, obličej +Z).
export function zaTransform(pairs) {
  // pairs: [{ bp: [cx,cy,cz], za: [cx,cy,cz], bpSize: [...], zaSize: [...] }]
  const s = pairs.reduce((a, p) => a + p.bpSize.reduce((x, v, i) => x + v / p.zaSize[i], 0) / 3, 0) / pairs.length;
  const t = [0, 1, 2].map((i) => pairs.reduce((a, p) => a + p.bp[i] - s * p.za[i], 0) / pairs.length);
  return { s, t, apply: ([x, y, z]) => [s * x + t[0], s * y + t[1], s * z + t[2]] };
}

export function readLandmarks(file, toApp) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [name, ...pts] = line.split('\t');
    out[name] = pts.map((p) => toApp(p.split(' ').map(Number)));
  }
  return out;
}

// ---------- geometrie ----------
export function adjacency(idx, nVerts) {
  const adj = Array.from({ length: nVerts }, () => []);
  for (let t = 0; t < idx.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = idx[t + k], b = idx[t + (k + 1) % 3];
      adj[a].push(b);
      adj[b].push(a);
    }
  }
  return adj;
}

const d3 = (pos, a, p) => Math.hypot(pos[a * 3] - p[0], pos[a * 3 + 1] - p[1], pos[a * 3 + 2] - p[2]);

export function nearestVertex(pos, p) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < pos.length / 3; i++) {
    const d = d3(pos, i, p);
    if (d < bd) { bd = d; best = i; }
  }
  return { v: best, d: bd };
}

// Geodetický Voronoi s omezením: každý vrchol připadne nejbližšímu výchozímu bodu (po hranách sítě),
// ale oblast se nešíří dál než `caps[s]` od svého bodu.
export function geodesicVoronoi(pos, adj, seeds, caps = null) {
  const n = pos.length / 3;
  const dist = new Float64Array(n).fill(Infinity);
  const owner = new Int32Array(n).fill(-1);
  // binární halda [vzdálenost, vrchol]
  const heap = [];
  const push = (d, v) => {
    heap.push([d, v]);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  seeds.forEach((v, s) => { dist[v] = 0; owner[v] = s; push(0, v); });
  while (heap.length) {
    const [d, v] = pop();
    if (d > dist[v]) continue;
    for (const u of adj[v]) {
      const nd = d + Math.hypot(pos[u * 3] - pos[v * 3], pos[u * 3 + 1] - pos[v * 3 + 1], pos[u * 3 + 2] - pos[v * 3 + 2]);
      if (caps && nd > caps[owner[v]]) continue;
      if (nd < dist[u]) { dist[u] = nd; owner[u] = owner[v]; push(nd, u); }
    }
  }
  return { dist, owner };
}

// Koule nejmenších čtverců (algebraicky): |p|² = 2 p·c + k, R² = k + |c|².
function fitSphere(points) {
  const A = Array.from({ length: 4 }, () => new Float64Array(4));
  const b = new Float64Array(4);
  for (const [x, y, z] of points) {
    const row = [2 * x, 2 * y, 2 * z, 1];
    const rhs = x * x + y * y + z * z;
    for (let i = 0; i < 4; i++) { b[i] += row[i] * rhs; for (let j = 0; j < 4; j++) A[i][j] += row[i] * row[j]; }
  }
  // Gaussova eliminace s výběrem pivotu
  for (let i = 0; i < 4; i++) {
    let p = i;
    for (let r = i + 1; r < 4; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < 4; r++) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < 4; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Float64Array(4);
  for (let i = 3; i >= 0; i--) {
    let s = b[i];
    for (let c = i + 1; c < 4; c++) s -= A[i][c] * x[c];
    x[i] = s / A[i][i];
  }
  const c = [x[0], x[1], x[2]];
  return { c, R: Math.sqrt(x[3] + c[0] ** 2 + c[1] ** 2 + c[2] ** 2) };
}

// Hlavní osa kosti (směr největšího rozptylu vrcholů), mocninnou metodou.
function mainAxis(pos) {
  const n = pos.length / 3;
  const m = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) m[k] += pos[i * 3 + k] / n;
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) {
    const d = [0, 1, 2].map((k) => pos[i * 3 + k] - m[k]);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b];
  }
  let v = [0, 1, 0];
  for (let it = 0; it < 50; it++) {
    const w = [0, 1, 2].map((a) => C[a][0] * v[0] + C[a][1] * v[1] + C[a][2] * v[2]);
    const l = Math.hypot(...w);
    v = w.map((x) => x / l);
  }
  return v;
}

// Vrcholy se stejnou polohou (BodyParts3D má na švech zdvojené vrcholy) se spojí, ať se oblast šíří přes šev.
function weld(pos) {
  const key = new Map();
  const canon = new Int32Array(pos.length / 3);
  for (let i = 0; i < canon.length; i++) {
    const k = `${pos[i * 3].toFixed(6)},${pos[i * 3 + 1].toFixed(6)},${pos[i * 3 + 2].toFixed(6)}`;
    if (!key.has(k)) key.set(k, i);
    canon[i] = key.get(k);
  }
  return canon;
}

// Bod popisku na dané kosti. Popisky jsou v Z-Anatomy jen na jedné straně těla a čára popisku má jeden konec
// na kosti a druhý u textu (ten může ležet i za střední čárou), proto se zkusí oba konce, přímo i zrcadlově (x → −x),
// a vezme se ten, který leží nejblíž kosti.
export function seedFor(pos, points) {
  let best = null;
  for (const p of points) {
    for (const q of [p, [-p[0], p[1], p[2]]]) {
      const hit = nearestVertex(pos, q);
      if (!best || hit.d < best.d) best = hit;
    }
  }
  return best;
}

// Kost z Z-Anatomy s materiály ploch (pánevní kost: kost kyčelní / sedací / stydká jsou rozlišené materiálem).
export function readZaObj(file, toApp) {
  const pos = [];
  const mat = [];
  let g = '';
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('v ')) pos.push(toApp(line.slice(2).trim().split(' ').map(Number)));
    else if (line.startsWith('g ')) g = line.slice(2).trim();
    else if (line.startsWith('f ')) for (const t of line.slice(2).trim().split(' ')) mat[parseInt(t, 10) - 1] ??= g;
  }
  return { pos, mat };
}

// Výchozí obarvení podle materiálů kosti v Z-Anatomy (nejbližší vrchol; chrupavka se přeskočí).
export function baseFromZa(mesh, za, matToPart) {
  const parts = [...new Set(Object.values(matToPart))];
  const labels = new Uint8Array(mesh.pos.length / 3).fill(255);
  const src = za.pos.map((p, i) => ({ p, part: matToPart[za.mat[i]] })).filter((x) => x.part);
  for (let v = 0; v < labels.length; v++) {
    const q = [mesh.pos[v * 3], mesh.pos[v * 3 + 1], mesh.pos[v * 3 + 2]];
    let best = null, bd = Infinity;
    for (const s of src) {
      const d = (s.p[0] - q[0]) ** 2 + (s.p[1] - q[1]) ** 2 + (s.p[2] - q[2]) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    labels[v] = parts.indexOf(best.part);
  }
  return { parts, labels };
}

function vertexNormals(pos, idx) {
  const nrm = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const [i, j, k] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const u = [pos[j] - pos[i], pos[j + 1] - pos[i + 1], pos[j + 2] - pos[i + 2]];
    const w = [pos[k] - pos[i], pos[k + 1] - pos[i + 1], pos[k + 2] - pos[i + 2]];
    const c = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const v of [i, j, k]) for (let a = 0; a < 3; a++) nrm[v + a] += c[a];
  }
  for (let v = 0; v < nrm.length; v += 3) {
    const l = Math.hypot(nrm[v], nrm[v + 1], nrm[v + 2]) || 1;
    for (let a = 0; a < 3; a++) nrm[v + a] /= l;
  }
  return nrm;
}

// Paprsek × trojúhelník (Möller–Trumbore); vrací vzdálenost nebo Infinity.
function rayTri(o, d, a, b, c) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-12) return Infinity;
  const inv = 1 / det;
  const s = [o[0] - a[0], o[1] - a[1], o[2] - a[2]];
  const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv;
  if (u < 0 || u > 1) return Infinity;
  const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
  const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv;
  if (v < 0 || u + v > 1) return Infinity;
  const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
  return t > 1e-6 ? t : Infinity;
}

// Vlastní vektory 3×3 symetrické matice (Jacobiho metoda), seřazené od největšího vlastního čísla.
function eigen3(C) {
  const a = C.map((r) => [...r]);
  const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 30; sweep++) {
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(a[p][q]) < 1e-15) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = c * x - s * y; V[k][q] = s * x + c * y; }
    }
  }
  return [0, 1, 2].map((i) => ({ val: a[i][i], vec: [V[0][i], V[1][i], V[2][i]] })).sort((x, y) => y.val - x.val);
}

// RANSAC koule: přes 4 náhodné body s poloměrem v rozmezí; vyhraje ta, na které leží nejvíc bodů.
function ransacSphere(cand, rMin, rMax, tol) {
  const inliers = (c, R) => cand.filter((p) => Math.abs(Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - R) < tol);
  let rnd = 12345; // pevné semínko, ať je model při každém sestavení stejný
  const pick = () => cand[(rnd = (rnd * 1103515245 + 12345) % 2147483648) % cand.length];
  let best = null;
  for (let it = 0; it < 600; it++) {
    const sph = fitSphere([pick(), pick(), pick(), pick()]);
    if (!(sph.R >= rMin && sph.R <= rMax)) continue;
    const k = inliers(sph.c, sph.R).length;
    if (!best || k > best.k) best = { ...sph, k };
  }
  if (!best) return null;
  const ins = inliers(best.c, best.R);
  return { ...fitSphere(ins), inliers: ins }; // zpřesnění na všech bodech koule
}

// Obarví jednu kost podle BONE_PARTS. Vrací { parts: [id…], labels: Uint8Array (255 = žádná část) }.
// `base` = výchozí obarvení (např. tři části pánevní kosti), ostatní části se malují přes něj.
// Pořadí: růst (P, B) → koule (S) / jamka (Cup) → pás (Band) / hřeben (Crest) → okraj otvoru (Rim).
export function paintBone(mesh, spec, landmarks, warn, base = null) {
  const { pos, idx } = mesh;
  const n = pos.length / 3;
  const canon = weld(pos);
  const adj = adjacency(Uint32Array.from(idx, (v) => canon[v]), n);
  const P3 = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const seedOf = (def) => {
    const pts = landmarks[def.lm];
    if (!pts) { warn(`chybí popisek „${def.lm}“`); return null; }
    const hit = seedFor(pos, pts);
    if (hit.d > 0.012 && def.type !== 'rim') warn(`${mesh.name}: popisek „${def.lm}“ je ${(hit.d * 1000).toFixed(0)} mm od kosti`);
    return canon[hit.v];
  };
  const parts = [...new Set([...(base?.parts || []), ...spec.filter((d) => d.id).map((d) => d.id)])];
  const code = (id) => parts.indexOf(id);
  const labels = base ? Uint8Array.from(base.labels, (k) => (k === 255 ? 255 : code(base.parts[k]))) : new Uint8Array(n).fill(255);
  const of = (type) => spec.filter((d) => (d.type || 'grow') === type);

  // růst
  const grow = [...of('grow'), ...spec.filter((d) => d.block)].filter((d, i, a) => a.indexOf(d) === i).map((d) => ({ d, v: seedOf(d) })).filter((g) => g.v != null);
  const { owner } = geodesicVoronoi(pos, adj, grow.map((g) => g.v), grow.map((g) => g.d.r));
  const blocked = new Uint8Array(n); // patří struktuře mimo seznam (hrbolek…) – další kroky ji nepřemalují
  for (let v = 0; v < n; v++) {
    const o = owner[canon[v]];
    if (o < 0) continue;
    if (grow[o].d.block) blocked[v] = 1;
    else labels[v] = code(grow[o].d.id);
  }

  // koule (kloubní hlavice) a jamka (acetabulum)
  for (const d of [...of('sphere'), ...of('cup')]) {
    const s = seedOf(d);
    if (s == null) continue;
    const { dist } = geodesicVoronoi(pos, adj, [s]);
    const cand = [];
    for (let v = 0; v < n; v++) if (canon[v] === v && dist[v] < d.max) cand.push(P3(v));
    const sph = ransacSphere(cand, d.rMin, d.rMax, d.tol);
    if (!sph) { warn(`${mesh.name}: ${d.id} – nenašla se koule`); continue; }
    const { c, R } = sph;
    if (process.env.DEBUG_PARTS) console.log(`  ${mesh.name} ${d.id}: koule R = ${(R * 1000).toFixed(1)} mm, ${sph.inliers.length} z ${cand.length} bodů`);
    // osa jamky = průměrný směr ze středu ke stěně jamky
    const ax = [0, 0, 0];
    for (const p of sph.inliers) { const l = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]); for (let a = 0; a < 3; a++) ax[a] += (p[a] - c[a]) / l; }
    const al = Math.hypot(...ax);
    for (let v = 0; v < n; v++) {
      if (blocked[v] || dist[canon[v]] >= d.max) continue;
      const p = P3(v);
      const r = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
      const ok = d.type === 'sphere'
        ? Math.abs(r - R) < d.tol
        // jamka: vše uvnitř kužele jamky (i hlubší fossa acetabuli), ne vnější plochy kosti za okrajem
        : r < R + d.depth && ((p[0] - c[0]) * ax[0] + (p[1] - c[1]) * ax[1] + (p[2] - c[2]) * ax[2]) / (r * al) > Math.cos(d.angle);
      if (ok) labels[v] = code(d.id);
    }
  }

  // pás
  const axis = mainAxis(pos);
  const along = (v) => pos[v * 3] * axis[0] + pos[v * 3 + 1] * axis[1] + pos[v * 3 + 2] * axis[2];
  for (const d of of('band')) {
    const s = seedOf(d);
    if (s == null) continue;
    const t0 = along(s);
    const over = new Set([255, ...d.over.map(code)]);
    for (let v = 0; v < n; v++) if (!blocked[v] && Math.abs(along(v) - t0) < d.half && over.has(labels[v])) labels[v] = code(d.id);
  }

  // hřeben: horní, nahoru otočený okraj části `within` (crista iliaca)
  const nrm = vertexNormals(pos, Uint32Array.from(idx, (v) => canon[v]));
  for (const d of of('crest')) {
    const inside = code(d.within);
    let top = -Infinity;
    for (let v = 0; v < n; v++) if (labels[v] === inside) top = Math.max(top, pos[v * 3 + 1]);
    for (let v = 0; v < n; v++) {
      const c = canon[v];
      if (labels[v] === inside && !blocked[v] && nrm[c * 3 + 1] > d.minUp && pos[v * 3 + 1] > top - d.band) labels[v] = code(d.id);
    }
  }

  // okraj otvoru: ze středu otvoru paprsky do všech stran v jeho rovině; kost kolem prvních zásahů je okraj
  for (const d of of('rim')) {
    const pts = landmarks[d.lm];
    if (!pts) { warn(`chybí popisek „${d.lm}“`); continue; }
    let center = null, cd = Infinity;
    for (const p of pts) {
      for (const q of [p, [-p[0], p[1], p[2]]]) {
        const hit = nearestVertex(pos, q);
        if (hit.d < cd) { cd = hit.d; center = q; }
      }
    }
    // rovina otvoru = rovina kosti kolem něj (nejmenší rozptyl = normála)
    const near = [];
    for (let v = 0; v < n; v++) if (Math.hypot(...P3(v).map((x, a) => x - center[a])) < d.reach) near.push(P3(v));
    const m = [0, 1, 2].map((a) => near.reduce((s, p) => s + p[a], 0) / near.length);
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const p of near) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += (p[a] - m[a]) * (p[b] - m[b]);
    const [e1, e2] = eigen3(C).map((e) => e.vec);
    const hits = [];
    for (let k = 0; k < 120; k++) {
      const th = (k / 120) * Math.PI * 2;
      const dir = [0, 1, 2].map((a) => Math.cos(th) * e1[a] + Math.sin(th) * e2[a]);
      let t = Infinity;
      for (let i = 0; i < idx.length; i += 3) t = Math.min(t, rayTri(center, dir, P3(idx[i]), P3(idx[i + 1]), P3(idx[i + 2])));
      if (t < d.reach) hits.push(center.map((x, a) => x + t * dir[a]));
    }
    if (process.env.DEBUG_PARTS) console.log(`  ${mesh.name} ${d.id}: ${hits.length}/120 paprsků zasáhlo okraj`);
    for (let v = 0; v < n; v++) {
      const p = P3(v);
      if (hits.some((h) => Math.hypot(h[0] - p[0], h[1] - p[1], h[2] - p[2]) < d.width)) labels[v] = code(d.id);
    }
  }
  return { parts, labels };
}

// ---------- obratle a žebra: části jsou na každém, popisky v Z-Anatomy jen na jednom ----------
// Výchozí body se proto hledají z tvaru každé kosti (aplikační souřadnice: Y nahoru, obličej +Z, x do stran).
function prep(mesh) {
  const { pos, idx } = mesh;
  const n = pos.length / 3;
  const canon = weld(pos);
  const adj = adjacency(Uint32Array.from(idx, (v) => canon[v]), n);
  const P3 = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const bb = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let v = 0; v < n; v++) for (let a = 0; a < 3; a++) { bb.min[a] = Math.min(bb.min[a], pos[v * 3 + a]); bb.max[a] = Math.max(bb.max[a], pos[v * 3 + a]); }
  const argBest = (score, filter = () => true) => {
    let best = -1, bs = -Infinity;
    for (let v = 0; v < n; v++) if (canon[v] === v && filter(v)) { const s = score(v); if (s > bs) { bs = s; best = v; } }
    return best;
  };
  return { pos, n, canon, adj, P3, bb, argBest };
}

// Obratel: tělo vpředu, trnový výběžek vzadu, příčné výběžky do stran; atlas tělo ani trn nemá, čepovec má navíc zub.
export function paintVertebra(mesh, kind) {
  const { pos, n, canon, adj, P3, bb, argBest } = prep(mesh);
  const cx = (bb.min[0] + bb.max[0]) / 2;
  const w = bb.max[0] - bb.min[0];
  const depth = bb.max[2] - bb.min[2];
  const cy = (bb.min[1] + bb.max[1]) / 2;
  const mid = (v) => Math.abs(pos[v * 3] - cx) < 0.12 * w;
  const parts = kind === 'atlas' ? ['proc_transversus'] : ['corpus_vertebrae', 'proc_spinosus', 'proc_transversus', ...(kind === 'axis' ? ['dens_axis'] : [])];
  const seeds = [];
  const add = (v, id, r) => { if (v >= 0) seeds.push({ v, id, r }); };
  if (kind !== 'atlas') {
    // u čepovce menší, jinak by tělo přerostlo na kloubní plochy po stranách
    add(argBest((v) => pos[v * 3 + 2], (v) => mid(v) && Math.abs(pos[v * 3 + 1] - cy) < 0.3 * (bb.max[1] - bb.min[1])), 'corpus_vertebrae', (kind === 'axis' ? 0.4 : 0.7) * depth);
    add(argBest((v) => -pos[v * 3 + 2], mid), 'proc_spinosus', 0.4 * depth);
  }
  add(argBest((v) => pos[v * 3] - cx), 'proc_transversus', 0.22 * w);
  add(argBest((v) => cx - pos[v * 3]), 'proc_transversus', 0.22 * w);
  // bloky: kloubní výběžky (nahoře a dole vzadu po stranách) a oblouk mezi trnem a tělem
  const side = (v) => Math.abs(pos[v * 3] - cx) > 0.15 * w && Math.abs(pos[v * 3] - cx) < 0.35 * w && pos[v * 3 + 2] < bb.min[2] + 0.6 * depth;
  for (const sgn of [1, -1]) {
    add(argBest((v) => pos[v * 3 + 1], (v) => side(v) && Math.sign(pos[v * 3] - cx) === sgn), null, 0.12 * depth);
    add(argBest((v) => -pos[v * 3 + 1], (v) => side(v) && Math.sign(pos[v * 3] - cx) === sgn), null, 0.12 * depth);
    // pedikl: mezi tělem a příčným výběžkem
    add(argBest((v) => -Math.abs(pos[v * 3 + 2] - (bb.min[2] + 0.55 * depth)) - Math.abs(Math.abs(pos[v * 3] - cx) - 0.25 * w), (v) => Math.sign(pos[v * 3] - cx) === sgn), null, 0.1 * depth);
  }
  if (kind !== 'atlas') add(argBest((v) => -Math.abs(pos[v * 3 + 2] - (bb.min[2] + 0.35 * depth)) + pos[v * 3 + 1] * 0, mid), null, 0.12 * depth);
  const { owner } = geodesicVoronoi(pos, adj, seeds.map((s) => s.v), seeds.map((s) => s.r));
  const labels = new Uint8Array(n).fill(255);
  for (let v = 0; v < n; v++) {
    const o = owner[canon[v]];
    if (o >= 0 && seeds[o].id) labels[v] = parts.indexOf(seeds[o].id);
  }
  // zub čepovce: vše nad horními kloubními plochami blízko střední roviny
  if (kind === 'axis') {
    let facet = -Infinity;
    for (let v = 0; v < n; v++) if (Math.abs(pos[v * 3] - cx) > 0.2 * w) facet = Math.max(facet, pos[v * 3 + 1]);
    for (let v = 0; v < n; v++) if (pos[v * 3 + 1] > facet && Math.abs(pos[v * 3] - cx) < 0.2 * w) labels[v] = parts.indexOf('dens_axis');
  }
  return { parts, labels };
}

// Žebro: vzdálenost po žebru od jeho obratlového konce – hlavice, krček, hrbolek (na zadní ploše), tělo.
export function paintRib(mesh, number) {
  const { pos, n, canon, adj } = prep(mesh);
  // oba konce žebra = nejvzdálenější dvojice; obratlový konec je ten zadní
  const far = (from) => { const { dist } = geodesicVoronoi(pos, adj, [from]); let b = from; for (let v = 0; v < n; v++) if (dist[v] < Infinity && dist[v] > dist[b]) b = v; return b; };
  const a = far(far(canon[0]));
  const b = far(a);
  const head = pos[a * 3 + 2] < pos[b * 3 + 2] ? a : b;
  const { dist } = geodesicVoronoi(pos, adj, [head]);
  const nrm = vertexNormals(pos, Uint32Array.from(mesh.idx, (v) => canon[v]));
  // první žebro je krátké a široké, 11. a 12. nemají krček ani hrbolek zřetelný
  const s = number === 1 ? 0.6 : 1;
  const parts = ['caput_costae', 'collum_costae', 'tuberculum_costae', 'corpus_costae'];
  const labels = new Uint8Array(n).fill(255);
  for (let v = 0; v < n; v++) {
    const d = dist[canon[v]];
    const c = canon[v];
    let id = 'corpus_costae';
    if (d < 0.011 * s) id = 'caput_costae';
    else if (number <= 10 && d < 0.026 * s) id = 'collum_costae';
    else if (number <= 10 && d < 0.04 * s && nrm[c * 3 + 2] < -0.35) id = 'tuberculum_costae';
    else if (number > 10 && d < 0.022) id = 'collum_costae';
    labels[v] = parts.indexOf(id);
  }
  return { parts, labels };
}

// ---------- jámy lebeční (fossae cranii): leží přes několik kostí spodiny lebky ----------
// Vnitřní plocha spodiny = vrcholy otočené nahoru, nad kterými je klenba (svislý paprsek nahoru narazí do kosti mozkovny).
// Rozdělení: přední = kost čelní, čichová a malá křídla kosti klínové (před tuberculum sellae);
// zadní = kost týlní, kost spánková za hřebenem skalní kosti a klivus za dorsum sellae; střední = zbytek.
// Jámy se malují jen tam, kde ještě žádná jiná část není (pars petrosa a okraj foramen magnum zůstanou).
export function paintCranialFossae(bones, landmarks, warn) {
  // bones: { frontale, ethmoidale, sphenoidale, occipitale, temporale: [R, L], parietale: [R, L] } – mesh objekty z build-model
  const IDS = ['fossa_cranii_anterior', 'fossa_cranii_media', 'fossa_cranii_posterior'];
  const vault = [bones.frontale, bones.occipitale, ...bones.parietale, ...bones.temporale, bones.sphenoidale];
  // mřížka trojúhelníků klenby v rovině xz (paprsky jsou svislé)
  const cell = 0.004;
  const grid = new Map();
  const tris = [];
  for (const m of vault) {
    for (let t = 0; t < m.idx.length; t += 3) {
      const p = [0, 1, 2].map((k) => [m.pos[m.idx[t + k] * 3], m.pos[m.idx[t + k] * 3 + 1], m.pos[m.idx[t + k] * 3 + 2]]);
      const ti = tris.push(p) - 1;
      const x0 = Math.floor(Math.min(p[0][0], p[1][0], p[2][0]) / cell), x1 = Math.floor(Math.max(p[0][0], p[1][0], p[2][0]) / cell);
      const z0 = Math.floor(Math.min(p[0][2], p[1][2], p[2][2]) / cell), z1 = Math.floor(Math.max(p[0][2], p[1][2], p[2][2]) / cell);
      for (let i = x0; i <= x1; i++) for (let k = z0; k <= z1; k++) { const key = i * 100000 + k; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(ti); }
    }
  }
  const up = [0, 1, 0];
  const roofAbove = (p) => {
    const list = grid.get(Math.floor(p[0] / cell) * 100000 + Math.floor(p[2] / cell)) || [];
    for (const ti of list) { const [a, b, c] = tris[ti]; const t = rayTri([p[0], p[1] + 0.003, p[2]], up, a, b, c); if (t < 0.2) return true; }
    return false;
  };
  const P3 = (m, v) => [m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]];
  const lm = (name, m) => {
    const pts = landmarks[name];
    if (!pts) { warn(`chybí popisek „${name}“`); return [0, 0, 0]; }
    return P3(m, seedFor(m.pos, pts).v); // konec čáry popisku blíž dané kosti
  };
  const tsP = lm('Tuberculum sellae', bones.sphenoidale), dsP = lm('Dorsum sellae', bones.sphenoidale);
  // výškové hranice: zadní jáma končí u protuberantia occipitalis interna, přední a střední kousek nad tuberculum sellae
  const iop = lm('Internal occipital protuberance', bones.occipitale);
  const maxY = [tsP[1] + 0.025, tsP[1] + 0.025, iop[1] + 0.004];
  // hřeben skalní kosti: nejvyšší body pars petrosa po proužcích v ose x → z hřebene pro dané x
  const ridge = [];
  for (const m of bones.temporale) {
    const pp = m.parts?.indexOf('pars_petrosa');
    const bins = new Map();
    for (let v = 0; v < m.labels.length; v++) {
      if (m.labels[v] !== pp) continue;
      const b = Math.round(m.pos[v * 3] / 0.003);
      if (!bins.has(b) || bins.get(b)[1] < m.pos[v * 3 + 1]) bins.set(b, [m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]]);
    }
    ridge.push(...bins.values());
  }
  ridge.sort((a, b) => a[0] - b[0]);
  const ridgeZ = (x) => {
    let best = null, bd = Infinity;
    for (const r of ridge) { const d = Math.abs(r[0] - x); if (d < bd) { bd = d; best = r; } }
    return bd < 0.01 ? best[2] : null;
  };
  const counts = [0, 0, 0];
  const paint = (m, classify) => {
    const nrm = vertexNormals(m.pos, m.idx);
    m.parts = m.parts || [];
    for (const id of IDS) if (!m.parts.includes(id)) m.parts.push(id);
    m.labels = m.labels || new Uint8Array(m.pos.length / 3).fill(255);
    for (let v = 0; v < m.labels.length; v++) {
      if (m.labels[v] !== 255 || nrm[v * 3 + 1] < 0.3) continue;
      const p = P3(m, v);
      if (!roofAbove(p)) continue;
      const k = classify(p);
      if (k == null || p[1] > maxY[k]) continue;
      m.labels[v] = m.parts.indexOf(IDS[k]);
      counts[k]++;
    }
  };
  paint(bones.frontale, () => 0);
  paint(bones.ethmoidale, () => 0);
  paint(bones.occipitale, () => 2);
  paint(bones.sphenoidale, (p) => (p[2] > tsP[2] && p[1] > tsP[1] - 0.004 ? 0 : p[2] < dsP[2] - 0.002 ? 2 : 1));
  for (const m of bones.temporale) paint(m, (p) => { const rz = ridgeZ(p[0]); return rz != null && p[2] < rz ? 2 : 1; });
  return counts;
}
