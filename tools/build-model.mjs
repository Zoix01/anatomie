// Postaví app/model/skeleton.glb (celá kostra, zjednodušená) a app/model/detail/<FMA>.glb (každá kost v plném rozlišení)
// z BodyParts3D 3.0 (obj_95 = nejpodrobnější zveřejněná verze).
//   node build-model.mjs            (vyžaduje raw/bp3d/BodyParts3D_3.0_obj_95.zip)
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
const DETAIL_DIR = path.join(ROOT, 'app', 'model', 'detail');
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

// ---------- kostrč: v BodyParts3D je součástí tělesa „sacrum“ ----------
// Kost křížová z BodyParts3D je ~145 mm vysoká; dolních ~33 mm jsou srostlé obratle kostrče.
// Rozřízneme ji v nejužším místě (art. sacrococcygea) a díry po řezu zavřeme.
function sliceByY(m, cutY) {
  // Trojúhelníky přes rovinu řezu rozdělíme přesně na ní, takže okraj řezu je rovinný a víčko je hladké.
  const pos = [...m.pos];
  const n0 = m.pos.length / 3;
  const above = (v) => pos[v * 3 + 1] >= cutY;
  const cutVert = new Map(); // hrana → nový vrchol na rovině
  const onPlane = (a, b) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (!cutVert.has(key)) {
      const t = (cutY - pos[a * 3 + 1]) / (pos[b * 3 + 1] - pos[a * 3 + 1]);
      cutVert.set(key, pos.length / 3);
      for (let k = 0; k < 3; k++) pos.push(pos[a * 3 + k] + t * (pos[b * 3 + k] - pos[a * 3 + k]));
    }
    return cutVert.get(key);
  };
  const up = [];
  const down = [];
  for (let t = 0; t < m.idx.length; t += 3) {
    const tri = [m.idx[t], m.idx[t + 1], m.idx[t + 2]];
    const flags = tri.map(above);
    const nUp = flags.filter(Boolean).length;
    if (nUp === 3) { up.push(...tri); continue; }
    if (nUp === 0) { down.push(...tri); continue; }
    // osamělý vrchol L a zbylé P, Q v pořadí trojúhelníku (zachová orientaci)
    const lone = nUp === 1 ? flags.indexOf(true) : flags.indexOf(false);
    const [L, P, Q] = [tri[lone], tri[(lone + 1) % 3], tri[(lone + 2) % 3]];
    const i1 = onPlane(L, P);
    const i2 = onPlane(L, Q);
    const [loneSide, pairSide] = nUp === 1 ? [up, down] : [down, up];
    loneSide.push(L, i1, i2);
    pairSide.push(i1, P, Q, i1, Q, i2);
  }
  const edgeKey = (a, b) => a * 4194304 + b;
  const origEdges = new Set();
  for (let t = 0; t < m.idx.length; t += 3) for (let k = 0; k < 3; k++) origEdges.add(edgeKey(m.idx[t + k], m.idx[t + (k + 1) % 3]));
  const piece = (tris) => {
    // nové okraje = hrany bez protějšku, které nebyly okrajem už v původní síti
    const own = new Set();
    for (let t = 0; t < tris.length; t += 3) for (let k = 0; k < 3; k++) own.add(edgeKey(tris[t + k], tris[t + (k + 1) % 3]));
    const next = new Map();
    for (let t = 0; t < tris.length; t += 3) {
      for (let k = 0; k < 3; k++) {
        const a = tris[t + k], b = tris[t + (k + 1) % 3];
        const wasBorder = a < n0 && b < n0 && !origEdges.has(edgeKey(b, a));
        if (!own.has(edgeKey(b, a)) && !wasBorder) next.set(a, b);
      }
    }
    const out = [...pos];
    const capped = [...tris];
    const seen = new Set();
    for (const start of next.keys()) {
      if (seen.has(start)) continue;
      const loop = [];
      for (let v = start; v !== undefined && !seen.has(v); v = next.get(v)) { seen.add(v); loop.push(v); }
      const c = [0, 0, 0];
      for (const v of loop) for (let k = 0; k < 3; k++) c[k] += pos[v * 3 + k] / loop.length;
      const ci = out.length / 3;
      out.push(...c);
      for (let k = 0; k < loop.length; k++) capped.push(loop[(k + 1) % loop.length], loop[k], ci);
    }
    // jen použité vrcholy
    const remap = new Map();
    const p2 = [];
    const i2 = capped.map((v) => {
      if (!remap.has(v)) { remap.set(v, p2.length / 3); p2.push(out[v * 3], out[v * 3 + 1], out[v * 3 + 2]); }
      return remap.get(v);
    });
    return { pos: new Float32Array(p2), idx: new Uint32Array(i2) };
  };
  return [piece(up), piece(down)];
}
const sacrum = meshes.find((m) => m.spec.item === 'os_sacrum');
{
  const bb = bbox(sacrum.pos);
  // nejužší vodorovný řez 25–42 mm nad apexem kostrče (mezi S5 a Co1)
  let cutY = 0, best = Infinity;
  for (let y = bb.min[1] + 0.025; y < bb.min[1] + 0.042; y += 0.0005) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < sacrum.pos.length; i += 3) {
      if (Math.abs(sacrum.pos[i + 1] - y) < 0.0005) { lo = Math.min(lo, sacrum.pos[i]); hi = Math.max(hi, sacrum.pos[i]); }
    }
    if (hi - lo < best) { best = hi - lo; cutY = y; }
  }
  const [upper, lower] = sliceByY(sacrum, cutY);
  console.log(`Kostrč odříznuta ${((cutY - bb.min[1]) * 1000).toFixed(1)} mm nad apexem (šířka řezu ${(best * 1000).toFixed(1)} mm)`);
  Object.assign(sacrum, upper);
  meshes.push({ id: `${sacrum.id}-coccyx`, name: 'coccyx (part of BodyParts3D sacrum)', spec: { item: 'os_coccygis', side: null }, ...lower });
}

// ---------- žeberní chrupavky patří ke svému žebru ----------
for (const m of meshes.filter((x) => x.spec.decor === 'cartilage')) {
  const ord = m.name.match(/(first|second|third|fourth|fifth|sixth|seventh) costal cartilage/);
  if (ord) {
    const rib = meshes.find((r) => r.spec.rib && r.spec.side === m.spec.side && splitSide(r.name).bare === `${ord[1]} rib`);
    m.spec.ribOf = rib.id;
  } else {
    m.spec.ribGroup = 'costae_spuriae'; // společná chrupavka 8.–10. žebra (oblouk žeberní)
  }
}

// ---------- nohy na nule ----------
let minY = Infinity;
for (const m of meshes) minY = Math.min(minY, bbox(m.pos).min[1]);
for (const m of meshes) for (let i = 1; i < m.pos.length; i += 3) m.pos[i] -= minY;

// ---------- glTF ----------
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const totalTris = meshes.reduce((n, m) => n + m.idx.length / 3, 0);
console.log(`Trojúhelníků v BodyParts3D: ${totalTris.toLocaleString('cs')}, cíl ${TRI_BUDGET.toLocaleString('cs')}`);
// plné rozlišení si schováme pro detailní soubory (izolovaná kost)
for (const m of meshes) m.full = { pos: m.pos, idx: m.idx };

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

const CREDITS = 'BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 JP. Upraveno (výběr, rozdělení kosti křížové a kostrče, zjednodušení).';
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

async function writeGlb(list, out, geo) {
  const doc = new Document();
  doc.createBuffer();
  const scene = doc.createScene('skeleton');
  const material = doc.createMaterial('bone').setBaseColorFactor([0.92, 0.89, 0.8, 1]).setRoughnessFactor(0.8);
  for (const m of list) {
    const { pos, idx } = geo(m);
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(vertexNormals(pos, idx)))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx))
      .setMaterial(material);
    const mesh = doc.createMesh(m.name).addPrimitive(prim);
    const extras = { item: m.spec.item ?? null, side: m.spec.side ?? null, groups: m.spec.groups ?? [], fma: m.id };
    for (const k of ['decor', 'part', 'vertebra', 'rib', 'extra', 'ribOf', 'ribGroup']) if (m.spec[k]) extras[k] = m.spec[k];
    scene.addChild(doc.createNode(`${m.spec.item || m.spec.decor}_${m.spec.side || 'M'}_${m.id}`).setMesh(mesh).setExtras(extras));
  }
  await doc.transform(dedup(), prune(), reorder({ encoder: MeshoptEncoder }), quantize({ quantizePosition: 14, quantizeNormal: 10 }));
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  doc.getRoot().getAsset().extras = { credits: CREDITS };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await io.write(out, doc);
  return doc.getRoot().listMeshes().reduce((n, me) => n + me.listPrimitives().reduce((k, p) => k + p.getIndices().getCount() / 3, 0), 0);
}

const outTris = await writeGlb(meshes, OUT, (m) => m);
console.log(`Po zjednodušení: ${outTris.toLocaleString('cs')} trojúhelníků v ${meshes.length} tělesech`);
console.log(`Hotovo: ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB)`);

// Každá kost zvlášť v plném rozlišení (zuby a chrupavky se neizolují).
fs.rmSync(DETAIL_DIR, { recursive: true, force: true });
let detailBytes = 0;
for (const m of meshes.filter((x) => !x.spec.decor)) {
  const out = path.join(DETAIL_DIR, `${m.id}.glb`);
  await writeGlb([m], out, (x) => x.full);
  detailBytes += fs.statSync(out).size;
}
console.log(`Detaily: ${path.relative(ROOT, DETAIL_DIR)} (${meshes.filter((x) => !x.spec.decor).length} souborů, celkem ${(detailBytes / 1e6).toFixed(1)} MB)`);
