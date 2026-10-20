// Zástupná kostra z jednoduchých tvarů. Skutečný model (BodyParts3D) ji nahradí v M1.
// Každá kost = jeden mesh; části kostí = atribut `part` na vrcholech (index do PART_IDS, -1 = žádná).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ITEMS } from './data.js';

export const PART_IDS = ITEMS.filter((it) => it.kind === 'part').map((it) => it.id);
const PART_CODE = Object.fromEntries(PART_IDS.map((id, i) => [id, i]));

// shape: { g: geometry, part?: id | null, fn?: (x, y, z) => id | null }
function buildGeometry(shapes) {
  const geoms = shapes.map(({ g, part = null, fn = null }) => {
    const geo = g.index ? g.toNonIndexed() : g;
    const pos = geo.attributes.position;
    const codes = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const id = fn ? fn(pos.getX(i), pos.getY(i), pos.getZ(i)) : part;
      codes[i] = id == null ? -1 : PART_CODE[id];
    }
    geo.setAttribute('part', new THREE.BufferAttribute(codes, 1));
    geo.deleteAttribute('uv');
    return geo;
  });
  const merged = mergeGeometries(geoms);
  merged.computeVertexNormals();
  merged.setAttribute('color', new THREE.BufferAttribute(new Float32Array(merged.attributes.position.count * 3), 3));
  return merged;
}

const at = (g, x, y, z) => g.translate(x, y, z);
const box = (w, h, d, x = 0, y = 0, z = 0, seg = 1) => at(new THREE.BoxGeometry(w, h, d, seg, seg, seg), x, y, z);
const sphere = (r, x = 0, y = 0, z = 0) => at(new THREE.SphereGeometry(r, 16, 12), x, y, z);
const capsule = (r, len, x = 0, y = 0, z = 0) => at(new THREE.CapsuleGeometry(r, len, 4, 12), x, y, z);
const cyl = (r, h, x = 0, y = 0, z = 0) => at(new THREE.CylinderGeometry(r, r, h, 14), x, y, z);

// Kosti jedné strany; x > 0 = laterálně, pro levou stranu se zrcadlí.
function limbBones() {
  const bones = [];
  const add = (item, shapes, pos, extra = {}) => bones.push({ item, shapes, pos, ...extra });

  add('clavicula', [{ g: capsule(0.009, 0.14).rotateZ(Math.PI / 2), fn: (x) => (x < -0.06 ? 'ext_sternalis' : x > 0.06 ? 'ext_acromialis' : null) }], [0.09, 1.345, 0.09]);
  add('scapula', [
    { g: box(0.1, 0.13, 0.012, 0, 0, 0, 4) },
    { g: box(0.04, 0.012, 0.03, 0.04, 0.075, 0.02), part: 'acromion' },
    { g: box(0.012, 0.012, 0.035, 0.0, 0.06, 0.03), part: 'proc_coracoideus' },
    { g: box(0.012, 0.03, 0.025, 0.055, 0.045, 0.01), part: 'cavitas_glenoidalis' },
  ], [0.14, 1.22, -0.1]);
  add('humerus', [
    { g: capsule(0.018, 0.28), fn: (x, y) => (y > 0.09 && y < 0.13 ? 'collum_chirurgicum' : y >= 0.13 ? null : 'corpus_humeri') },
    { g: sphere(0.026, -0.008, 0.155, 0), part: 'caput_humeri' },
    { g: box(0.07, 0.03, 0.026, 0, -0.15, 0, 6), fn: (x, y, z) => (x > 0.025 ? 'epicondylus_lateralis' : x < -0.025 ? 'epicondylus_medialis' : z < -0.008 ? 'fossa_olecrani' : z > 0.008 ? 'fossa_coronoidea' : x > 0 ? 'capitulum_humeri' : 'trochlea_humeri') },
  ], [0.2, 1.15, 0]);
  add('radius', [
    { g: capsule(0.011, 0.22), fn: (x, y, z) => (y > 0.085 ? 'collum_radii' : y > 0.05 && y < 0.075 && z > 0.004 ? 'tuberositas_radii' : y < -0.1 ? null : 'corpus_radii') },
    { g: cyl(0.016, 0.015, 0, 0.115, 0), part: 'caput_radii' },
    { g: at(new THREE.ConeGeometry(0.006, 0.02, 8).rotateX(Math.PI), 0.012, -0.125, 0), part: 'styloideus_radii' },
  ], [0.235, 0.86, 0]);
  add('ulna', [
    { g: capsule(0.011, 0.22), fn: (x, y) => (y < -0.1 ? 'caput_ulnae' : y > 0.085 ? null : 'corpus_ulnae') },
    { g: box(0.025, 0.04, 0.02, 0, 0.13, -0.012), part: 'olecranon' },
    { g: box(0.02, 0.015, 0.012, 0, 0.112, 0.004), part: 'incisura_trochlearis' },
    { g: box(0.022, 0.012, 0.022, 0, 0.093, 0.012), part: 'coronoideus_ulnae' },
    { g: box(0.008, 0.012, 0.012, 0.013, 0.095, 0), part: 'incisura_radialis' },
    { g: at(new THREE.ConeGeometry(0.006, 0.02, 8).rotateX(Math.PI), -0.008, -0.125, 0), part: 'styloideus_ulnae' },
  ], [0.18, 0.86, 0]);

  // Ruka: zápěstí (2 řady po 4), záprstí, články prstů (palec = laterálně = index 4).
  [-0.024, -0.008, 0.008, 0.024].forEach((dx, i) => {
    add(i === 0 ? 'os_pisiforme' : 'carpi_prox', [{ g: box(0.013, 0.013, 0.013) }], [0.21 + dx, 0.728, 0], { groups: i === 0 ? ['carpi_prox', 'ossa_carpi'] : ['ossa_carpi'] });
    add('carpi_dist', [{ g: box(0.013, 0.013, 0.013) }], [0.21 + dx, 0.711, 0], { groups: ['ossa_carpi'] });
  });
  [-0.024, -0.012, 0, 0.012, 0.028].forEach((dx, i) => {
    add('ossa_metacarpi', [{ g: capsule(0.005, 0.045) }], [0.21 + dx, 0.672, 0]);
    const n = i === 4 ? 2 : 3;
    for (let k = 0; k < n; k++) {
      add(i === 4 ? 'pollex' : 'phalanges_manus', [{ g: capsule(0.0045, 0.018) }], [0.21 + dx + (i === 4 ? 0.006 : 0), 0.632 - k * 0.03, 0], { groups: i === 4 ? ['phalanges_manus'] : [] });
    }
  });

  add('os_coxae', [{
    g: box(0.12, 0.2, 0.05, 0.02, 0, 0, 12),
    fn: (x, y, z) => {
      if (y > 0.09) return 'crista_iliaca';
      if (x < -0.035 && y > 0 && y < 0.07 && z < 0) return 'facies_auricularis';
      if (x > 0.075 && Math.abs(y + 0.03) < 0.03 && Math.abs(z) < 0.02) return 'acetabulum';
      if (y > 0) return 'os_ilium';
      if (z > 0.02 && x > 0 && x < 0.05 && y > -0.09 && y < -0.05) return 'foramen_obturatum';
      if (y < -0.085 && z < 0) return 'tuber_ischiadicum';
      return z < 0 ? 'os_ischii' : 'os_pubis';
    },
  }], [0.08, 0.9, 0]);
  add('femur', [
    { g: capsule(0.016, 0.36) },
    { g: sphere(0.022, -0.045, 0.2, 0), part: 'caput_femoris' },
    { g: cyl(0.011, 0.045, -0.024, 0.185, 0).rotateZ(0), part: 'collum_femoris' },
    { g: box(0.022, 0.03, 0.022, 0.014, 0.205, 0), part: 'trochanter_major' },
    { g: sphere(0.008, -0.013, 0.14, -0.008), part: 'trochanter_minor' },
    { g: box(0.06, 0.04, 0.04, 0, -0.2, 0, 6), fn: (x, y, z) => (z > 0.012 && Math.abs(x) < 0.013 ? 'facies_patellaris' : x < 0 ? 'condylus_med_fem' : 'condylus_lat_fem') },
  ], [0.1, 0.6, 0]);
  add('patella', [{ g: sphere(0.02).scale(1, 1.2, 0.5) }], [0.1, 0.37, 0.035]);
  add('tibia', [
    { g: capsule(0.016, 0.3) },
    { g: box(0.06, 0.03, 0.04, 0, 0.17, 0, 6), fn: (x) => (x < 0 ? 'condylus_med_tib' : 'condylus_lat_tib') },
    { g: box(0.012, 0.03, 0.02, -0.016, -0.18, 0), part: 'malleolus_medialis' },
  ], [0.095, 0.18, 0]);
  add('fibula', [
    { g: capsule(0.008, 0.32) },
    { g: sphere(0.013, 0, 0.155, 0), part: 'caput_fibulae' },
    { g: sphere(0.012, 0, -0.18, 0), part: 'malleolus_lateralis' },
  ], [0.135, 0.18, -0.01]);

  // Noha: talus, calcaneus + 5 dalších zánártních, nártní, články prstců (palec = mediálně = index 0).
  add('talus', [{ g: box(0.035, 0.025, 0.045) }], [0.1, 0.035, 0], { groups: ['ossa_tarsi'] });
  add('calcaneus', [{ g: box(0.035, 0.035, 0.06) }], [0.1, 0.012, -0.045], { groups: ['ossa_tarsi'] });
  [-0.02, 0, 0.02].forEach((dx) => add('ossa_tarsi', [{ g: box(0.016, 0.018, 0.02) }], [0.1 + dx, 0.018, 0.045]));
  [-0.012, 0.012].forEach((dx) => add('ossa_tarsi', [{ g: box(0.018, 0.018, 0.018) }], [0.1 + dx, 0.022, 0.025]));
  [-0.028, -0.014, 0, 0.014, 0.028].forEach((dx, i) => {
    add('ossa_metatarsi', [{ g: capsule(0.006, 0.05).rotateX(Math.PI / 2) }], [0.1 + dx, 0.012, 0.09]);
    const n = i === 0 ? 2 : 3;
    for (let k = 0; k < n; k++) {
      add(i === 0 ? 'hallux' : 'phalanges_pedis', [{ g: capsule(0.005, 0.012).rotateX(Math.PI / 2) }], [0.1 + dx, 0.008, 0.135 + k * 0.022], { groups: i === 0 ? ['phalanges_pedis'] : [] });
    }
  });

  // Žebra: oblouk od páteře (vzadu) k hrudní kosti (vpředu), části podle úhlu.
  const radii = [0.07, 0.09, 0.105, 0.115, 0.12, 0.125, 0.125, 0.125, 0.12, 0.115, 0.1, 0.085];
  radii.forEach((R, i) => {
    const arc = i >= 10 ? Math.PI * 0.6 : Math.PI;
    const g = new THREE.TorusGeometry(R, 0.006, 5, 24, arc).rotateZ(-Math.PI / 2).rotateX(Math.PI / 2);
    const fn = (x, y, z) => {
      const t = Math.atan2(x, -z);
      return t < 0.15 ? 'caput_costae' : t < 0.3 ? 'collum_costae' : t < 0.42 ? 'tuberculum_costae' : 'corpus_costae';
    };
    const item = i === 0 ? 'costa_prima' : i === 1 ? 'costa_secunda' : i < 7 ? 'costae_verae' : i < 10 ? 'costae_spuriae' : 'costae_fluctuantes';
    add(item, [{ g, fn }], [0, 1.3 - i * 0.034, 0.03], { groups: i < 2 ? ['costae_verae'] : [], isRib: true });
  });
  return bones;
}

function axialBones() {
  const bones = [];
  const add = (item, shapes, pos, extra = {}) => bones.push({ item, shapes, pos, ...extra });
  add('os_frontale', [{ g: sphere(0.1).scale(0.85, 1, 1.05) }], [0, 1.62, 0]);
  add('mandibula', [{ g: box(0.09, 0.03, 0.07) }], [0, 1.515, 0.035]);

  const vertebra = (r, h, dens = false) => {
    const shapes = [
      { g: cyl(r, h), part: 'corpus_vertebrae' },
      { g: box(0.006, 0.008, 0.03, 0, -0.004, -r - 0.018), part: 'proc_spinosus' },
      { g: box(0.022, 0.006, 0.006, r + 0.011, 0, -0.01), part: 'proc_transversus' },
      { g: box(0.022, 0.006, 0.006, -r - 0.011, 0, -0.01), part: 'proc_transversus' },
    ];
    if (dens) shapes.push({ g: cyl(0.006, 0.02, 0, h / 2 + 0.01, 0), part: 'dens_axis' });
    return shapes;
  };
  for (let i = 0; i < 7; i++) {
    const item = i === 0 ? 'atlas' : i === 1 ? 'axis' : 'vert_cervicales';
    add(item, vertebra(0.02, 0.014, i === 1), [0, 1.47 - i * 0.022, -0.06], { groups: i < 2 ? ['vert_cervicales'] : [], isVertebra: true });
  }
  for (let i = 0; i < 12; i++) add('vert_thoracicae', vertebra(0.024, 0.02), [0, 1.31 - i * 0.027, -0.075], { isVertebra: true });
  for (let i = 0; i < 5; i++) add('vert_lumbales', vertebra(0.03, 0.028), [0, 0.98 - i * 0.036, -0.06], { isVertebra: true });
  add('os_sacrum', [{ g: box(0.09, 0.1, 0.04, 0, 0, 0, 8), fn: (x, y, z) => (y > 0.04 && z > 0.01 && Math.abs(x) < 0.03 ? 'promontorium' : null) }], [0, 0.85, -0.05]);
  add('os_coccygis', [{ g: new THREE.ConeGeometry(0.014, 0.04, 10).rotateX(Math.PI) }], [0, 0.785, -0.055]);
  add('sternum', [{ g: box(0.04, 0.2, 0.015, 0, 0, 0, 10), fn: (x, y) => (y > 0.04 ? 'manubrium_sterni' : y < -0.075 ? 'proc_xiphoideus' : 'corpus_sterni') }], [0, 1.2, 0.15]);
  return bones;
}

// Zrcadlení podle x převrací pořadí vrcholů trojúhelníků; vrátíme ho, aby přední strany zůstaly přední.
function mirrorX(geo) {
  geo.scale(-1, 1, 1);
  for (const attr of Object.values(geo.attributes)) {
    const a = attr.array;
    const n = attr.itemSize;
    for (let t = 0; t < attr.count; t += 3) {
      for (let k = 0; k < n; k++) {
        const i1 = (t + 1) * n + k;
        const i2 = (t + 2) * n + k;
        [a[i1], a[i2]] = [a[i2], a[i1]];
      }
    }
  }
}

export function buildSkeleton(scene) {
  const meshes = [];
  const make = (def, side) => {
    const geo = buildGeometry(def.shapes.map((s) => ({ ...s, g: s.g.clone() })));
    if (side === 'L') mirrorX(geo);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.FrontSide });
    const mesh = new THREE.Mesh(geo, mat);
    const [x, y, z] = def.pos;
    mesh.position.set(side === 'L' ? -x : x, y, z);
    mesh.userData = {
      item: def.item,
      groups: def.groups || [],
      side,
      isRib: !!def.isRib,
      isVertebra: !!def.isVertebra,
      hasParts: Array.from(geo.attributes.part.array).some((c) => c >= 0),
    };
    geo.computeBoundingSphere();
    scene.add(mesh);
    meshes.push(mesh);
  };
  // Shapes are built once and cloned per side, so mutate-on-translate helpers stay safe.
  for (const def of limbBones()) { make(def, 'R'); make(def, 'L'); }
  for (const def of axialBones()) make(def, null);
  return meshes;
}
