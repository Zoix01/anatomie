// Postaví app/model/skeleton.glb z BodyParts3D 3.0 (obj_95) + kostrč ze Z-Anatomy + vygenerované sezamské kosti ruky.
//   node build-model.mjs            (vyžaduje raw/bp3d/BodyParts3D_3.0_obj_95.zip a raw/zanatomy/*.obj)
// Souřadnice: BodyParts3D = mm, Z nahoru, levá strana x > 0, záda y > 0.
//             Aplikace     = m,  Y nahoru, obličej k +Z, nohy na y = 0.  (x, y, z) → (x, z, −y) / 1000
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { reorder, quantize, dedup, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { classify, splitSide } from './manifest.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, 'raw');
const ZIP = path.join(RAW, 'bp3d', 'BodyParts3D_3.0_obj_95.zip');
// Rozbalené OBJ mimo projekt – složka projektu je v OneDrive a zbytečně by se synchronizovaly.
const OBJ_DIR = process.env.BP3D_OBJ_DIR || path.join(os.tmpdir(), 'anatomie-bp3d-obj');
const OUT = path.join(ROOT, 'app', 'model', 'skeleton.glb');
const TRI_BUDGET = Number(process.env.TRI_BUDGET || 300_000); // celý model; telefony zvládnou ~300k trojúhelníků

// ---------- výběr těles ----------
const rows = fs.readFileSync(path.join(RAW, 'bp3d', 'parts_list_e.txt'), 'utf8').trim().split(/\r?\n/).slice(1)
  .map((l) => l.split('\t').map((x) => x.replace(/"/g, '')));
const hits = rows.map(([id, name]) => ({ id, name, spec: classify(name) })).filter((r) => r.spec);
const sidedNames = new Set(hits.filter((h) => h.spec.side).map((h) => splitSide(h.name).bare));
// U párových kostí bereme jen „left …“/„right …“, ne souhrnné těleso bez strany.
const selected = hits.filter((h) => h.spec.side || !sidedNames.has(splitSide(h.name).bare));

// ---------- rozbalení potřebných OBJ ----------
const toExtract = selected.filter((h) => !fs.existsSync(path.join(OBJ_DIR, `${h.id}.obj`))).map((h) => h.id);
const notInZip = new Set(toExtract.length
  ? execFileSync('python', [path.join(import.meta.dirname, 'extract_obj.py'), ZIP, OBJ_DIR, ...toExtract]).toString().split(/\r?\n/).filter(Boolean)
  : []);
const missing = selected.filter((h) => notInZip.has(h.id));
if (missing.length) console.warn(`⚠ chybí v archivu (${missing.length}):\n  ${missing.map((h) => `${h.id} ${h.name}`).join('\n  ')}`);
const parts = selected.filter((h) => !notInZip.has(h.id)).map((h) => ({ ...h, file: path.join(OBJ_DIR, `${h.id}.obj`) }));

// ---------- čtení OBJ ----------
function readObj(file, convert) {
  const pos = [];
  const tris = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.trim().split(/\s+/).map(Number);
      pos.push(...convert(x, y, z));
    } else if (line.startsWith('f ')) {
      const idx = line.trim().split(/\s+/).slice(1).map((t) => parseInt(t, 10) - 1);
      for (let k = 1; k < idx.length - 1; k++) tris.push(idx[0], idx[k], idx[k + 1]);
    }
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(tris) };
}
const fromBP3D = (x, y, z) => [x / 1000, z / 1000, -y / 1000];

function bbox(pos) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], pos[i + a]); max[a] = Math.max(max[a], pos[i + a]); }
  }
  return { min, max, size: max.map((v, a) => v - min[a]), center: max.map((v, a) => (v + min[a]) / 2) };
}

const meshes = parts.map((h) => ({ ...h, ...readObj(h.file, fromBP3D) }));

// ---------- kostrč ze Z-Anatomy, zarovnaná podle kosti křížové ----------
// Z-Anatomy vychází z BodyParts3D, ale je v metrech, posunutá a jinak natočená (Z nahoru, záda = +y).
const fromZA = (x, y, z) => [x, z, -y];
const zaSacrum = readObj(path.join(RAW, 'zanatomy', 'sacrum.obj'), fromZA);
const bpSacrum = meshes.find((m) => m.spec.item === 'os_sacrum');
const a = bbox(zaSacrum.pos);
const b = bbox(bpSacrum.pos);
const scale = b.size.map((s, i) => s / a.size[i]);
console.log('Kost křížová Z-Anatomy → BodyParts3D, poměr velikostí x/y/z:', scale.map((s) => s.toFixed(3)).join(' / '));
// Na výšku se kosti křížové liší (jiný tvar horního okraje), proto měřítko z šířky a hloubky
// a svisle zarovnáme dolní konec (apex), kam kostrč nasedá.
const s = (scale[0] + scale[2]) / 2;
const zaToBp = (x, y, z) => {
  const [X, Y, Z] = fromZA(x, y, z);
  return [(X - a.center[0]) * s + b.center[0], (Y - a.min[1]) * s + b.min[1], (Z - a.center[2]) * s + b.center[2]];
};
const coccyx = readObj(path.join(RAW, 'zanatomy', 'coccyx.obj'), zaToBp);
// Po převodu zůstává mezi kostrčí a apexem ~5 mm a kostrč vypadá odtržená. Rohy kostrče (cornua) ve skutečnosti
// sahají vzhůru k rohům kosti křížové, proto ji zvedneme tak, aby se obalové boxy mírně překrývaly.
const JOINT_GAP = -0.0025;
const lift = b.min[1] - JOINT_GAP - bbox(coccyx.pos).max[1];
for (let i = 1; i < coccyx.pos.length; i += 3) coccyx.pos[i] += lift;
console.log(`Kostrč posunuta nahoru o ${(lift * 1000).toFixed(1)} mm`);
meshes.push({ id: 'ZA-coccyx', name: 'coccyx (Z-Anatomy)', spec: { item: 'os_coccygis', side: null, source: 'Z-Anatomy' }, ...coccyx });

// ---------- sezamské kosti ruky (v BodyParts3D ani Z-Anatomy nejsou) ----------
// Dvě malá zploštělá „hrášková“ tělíska na dlaňové straně hlavice 1. záprstní kosti.
function ellipsoid(center, radii, seg = 10) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const th = (i / seg) * Math.PI;
    for (let j = 0; j <= seg; j++) {
      const ph = (j / seg) * Math.PI * 2;
      pos.push(center[0] + radii[0] * Math.sin(th) * Math.cos(ph), center[1] + radii[1] * Math.cos(th), center[2] + radii[2] * Math.sin(th) * Math.sin(ph));
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < seg; j++) {
      const p = i * (seg + 1) + j;
      idx.push(p, p + 1, p + seg + 1, p + 1, p + seg + 2, p + seg + 1);
    }
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
for (const side of ['R', 'L']) {
  const mc1 = meshes.find((m) => m.spec.side === side && /first metacarpal/.test(m.name));
  if (!mc1) continue;
  const bb = bbox(mc1.pos);
  // hlavice = distální (dolní) konec; dlaň = přední strana (+z) u visící ruky
  const head = [bb.center[0], bb.min[1] + 0.006, bb.max[2]];
  for (const dx of [-0.004, 0.004]) {
    meshes.push({ id: `GEN-sesamoid-${side}`, name: 'hand sesamoid (generated)', spec: { item: 'sesamoidea_manus', side, source: 'generated' },
      ...ellipsoid([head[0] + dx, head[1], head[2] - 0.001], [0.0028, 0.0035, 0.0022]) });
  }
}

// ---------- nohy na nule ----------
let minY = Infinity;
for (const m of meshes) minY = Math.min(minY, bbox(m.pos).min[1]);
for (const m of meshes) for (let i = 1; i < m.pos.length; i += 3) m.pos[i] -= minY;

// ---------- glTF ----------
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const doc = new Document();
doc.createBuffer();
const scene = doc.createScene('skeleton');
const material = doc.createMaterial('bone').setBaseColorFactor([0.92, 0.89, 0.8, 1]).setRoughnessFactor(0.8);
const totalTris = meshes.reduce((n, m) => n + m.idx.length / 3, 0);
console.log(`Trojúhelníků v BodyParts3D: ${totalTris.toLocaleString('cs')}, cíl ${TRI_BUDGET.toLocaleString('cs')}`);

// Rozpočet po kostech: stejný poměr pro všechny, ale aspoň MIN_TRIS, aby malé kůstky nepřišly o tvar.
const MIN_TRIS = 600;
const targetFor = (m, r) => Math.min(m.idx.length / 3, Math.max(MIN_TRIS, Math.round((m.idx.length / 3) * r)));
let lo = 0, hi = 1;
for (let k = 0; k < 40; k++) {
  const mid = (lo + hi) / 2;
  const sum = meshes.reduce((n, m) => n + targetFor(m, mid), 0);
  if (sum > TRI_BUDGET) hi = mid; else lo = mid;
}
for (const m of meshes) {
  const target = targetFor(m, lo);
  if (target * 3 >= m.idx.length) continue;
  const [idx] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, target * 3, 0.02, []);
  // jen použité vrcholy
  const remap = new Int32Array(m.pos.length / 3).fill(-1);
  const pos = [];
  for (const v of idx) if (remap[v] < 0) { remap[v] = pos.length / 3; pos.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]); }
  m.idx = Uint32Array.from(idx, (v) => remap[v]);
  m.pos = new Float32Array(pos);
}

// Hladké normály vážené plochou trojúhelníků.
function vertexNormals(pos, idx) {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const [i, j, k] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const ux = pos[j] - pos[i], uy = pos[j + 1] - pos[i + 1], uz = pos[j + 2] - pos[i + 2];
    const vx = pos[k] - pos[i], vy = pos[k + 1] - pos[i + 1], vz = pos[k + 2] - pos[i + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    for (const v of [i, j, k]) { n[v] += cx; n[v + 1] += cy; n[v + 2] += cz; }
  }
  for (let v = 0; v < n.length; v += 3) {
    const l = Math.hypot(n[v], n[v + 1], n[v + 2]) || 1;
    n[v] /= l; n[v + 1] /= l; n[v + 2] /= l;
  }
  return n;
}

for (const m of meshes) {
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(m.pos))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(vertexNormals(m.pos, m.idx)))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(m.idx))
    .setMaterial(material);
  const mesh = doc.createMesh(m.name).addPrimitive(prim);
  const extras = { item: m.spec.item ?? null, side: m.spec.side ?? null, groups: m.spec.groups ?? [], fma: m.id };
  if (m.spec.decor) extras.decor = m.spec.decor;
  if (m.spec.part) extras.part = m.spec.part;
  if (m.spec.vertebra) extras.vertebra = true;
  if (m.spec.rib) extras.rib = true;
  if (m.spec.source) extras.source = m.spec.source;
  const node = doc.createNode(`${m.spec.item || m.spec.decor}_${m.spec.side || 'M'}_${m.id}`).setMesh(mesh).setExtras(extras);
  scene.addChild(node);
}

await doc.transform(
  dedup(),
  prune(),
  reorder({ encoder: MeshoptEncoder }),
  quantize({ quantizePosition: 14, quantizeNormal: 10 }),
);
const outTris = doc.getRoot().listMeshes().reduce((n, me) => n + me.listPrimitives().reduce((k, p) => k + p.getIndices().getCount() / 3, 0), 0);
console.log(`Po zjednodušení: ${outTris.toLocaleString('cs')} trojúhelníků v ${meshes.length} tělesech`);

doc.createExtension(KHRMeshQuantization).setRequired(true);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
doc.getRoot().getAsset().extras = {
  credits: 'BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 JP; os coccygis: Z-Anatomy, CC BY-SA 4.0; ossa sesamoidea manus: vlastní model. Upraveno (výběr, zjednodušení).',
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await io.write(OUT, doc);
console.log(`Hotovo: ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB)`);
