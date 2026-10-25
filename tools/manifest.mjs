// Která BodyParts3D tělesa jdou do modelu a jak se mapují na položky aplikace (app/data.js).
// Pravidla se porovnávají s anglickým názvem bez strany („left humerus“ → „humerus“).
// item = nejmenší položka, kterou mesh znamená; groups = nadřazené skupiny (od menší k větší).
// decor = jen vizuální (zuby, žeberní chrupavky) – nejsou v testu; chrupavka při ťuknutí vybere své žebro.
// extra = kost, která není na slidech: jde na ni ťuknout (název), ale v testu není.

const NEURO = ['neurocranium'];
const SPLANCH = ['splanchnocranium'];

export const RULES = [
  // Horní končetina
  [/^clavicle$/, { item: 'clavicula' }],
  [/^scapula$/, { item: 'scapula' }],
  [/^humerus$/, { item: 'humerus' }],
  [/^radius$/, { item: 'radius' }],
  [/^ulna$/, { item: 'ulna' }],
  [/^(scaphoid|lunate|triquetral)$/, { item: 'carpi_prox', groups: ['ossa_carpi'] }],
  [/^pisiform$/, { item: 'os_pisiforme', groups: ['carpi_prox', 'ossa_carpi'] }],
  [/^(trapezium|trapezoid|capitate|hamate)$/, { item: 'carpi_dist', groups: ['ossa_carpi'] }],
  [/metacarpal bone$/, { item: 'ossa_metacarpi' }],
  [/phalanx of thumb$/, { item: 'pollex', groups: ['phalanges_manus'] }],
  [/phalanx of (index|middle|ring|little) finger$/, { item: 'phalanges_manus' }],

  // Dolní končetina
  [/^hip bone$/, { item: 'os_coxae' }],
  [/^femur$/, { item: 'femur' }],
  [/^patella$/, { item: 'patella' }],
  [/^tibia$/, { item: 'tibia' }],
  [/^fibula$/, { item: 'fibula' }],
  [/^talus$/, { item: 'talus', groups: ['ossa_tarsi'] }],
  [/^calcaneus$/, { item: 'calcaneus', groups: ['ossa_tarsi'] }],
  [/^(navicular bone of foot|cuboid bone|(medial|intermediate|lateral) cuneiform bone)$/, { item: 'ossa_tarsi' }],
  [/metatarsal bone$/, { item: 'ossa_metatarsi' }],
  [/phalanx of big toe$/, { item: 'hallux', groups: ['phalanges_pedis'] }],
  [/phalanx of (second|third|fourth|little) toe$/, { item: 'phalanges_pedis' }],
  [/^sesamoid bone of foot$/, { item: 'sesamoidea_pedis' }],

  // Lebka
  [/^frontal bone$/, { item: 'os_frontale', groups: NEURO }],
  [/^parietal bone$/, { item: 'os_parietale', groups: NEURO }],
  [/^temporal bone$/, { item: 'os_temporale', groups: NEURO }],
  [/^occipital bone$/, { item: 'os_occipitale', groups: NEURO }],
  [/^sphenoid bone$/, { item: 'os_sphenoidale', groups: NEURO }],
  [/^ethmoid$/, { item: 'os_ethmoidale', groups: NEURO }],
  [/^nasal bone$/, { item: 'os_nasale', groups: SPLANCH }],
  [/^lacrimal bone$/, { item: 'os_lacrimale', groups: SPLANCH }],
  [/^zygomatic bone$/, { item: 'os_zygomaticum', groups: SPLANCH }],
  [/^maxilla$/, { item: 'maxilla', groups: SPLANCH }],
  [/^mandible$/, { item: 'mandibula', groups: SPLANCH }],
  [/^vomer$/, { item: 'septum_nasi', groups: SPLANCH }],
  [/^inferior nasal concha$/, { item: 'conchae_nasales', groups: SPLANCH }],
  [/^palatine bone$/, { item: 'os_palatinum', groups: SPLANCH, extra: true }],
  [/^hyoid bone$/, { item: 'os_hyoideum' }],
  [/(upper|lower) .*secondary .*tooth$/, { decor: 'teeth' }],

  // Páteř
  [/^atlas$/, { item: 'atlas', groups: ['vert_cervicales'], vertebra: true }],
  [/^axis$/, { item: 'axis', groups: ['vert_cervicales'], vertebra: true }],
  [/^(third|fourth|fifth|sixth|seventh) cervical vertebra$/, { item: 'vert_cervicales', vertebra: true }],
  [/^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) thoracic vertebra$/, { item: 'vert_thoracicae', vertebra: true }],
  [/^(first|second|third|fourth|fifth) lumbar vertebra$/, { item: 'vert_lumbales', vertebra: true }],
  [/^sacrum$/, { item: 'os_sacrum' }],

  // Hrudník (kost hrudní je v BodyParts3D ze tří těles – rovnou to jsou její části)
  [/^manubrium$/, { item: 'sternum', part: 'manubrium_sterni' }],
  [/^body of sternum$/, { item: 'sternum', part: 'corpus_sterni' }],
  [/^xiphoid process$/, { item: 'sternum', part: 'proc_xiphoideus' }],
  [/^first rib$/, { item: 'costa_prima', groups: ['costae_verae'], rib: true }],
  [/^second rib$/, { item: 'costa_secunda', groups: ['costae_verae'], rib: true }],
  [/^(third|fourth|fifth|sixth|seventh) rib$/, { item: 'costae_verae', rib: true }],
  [/^(eighth|ninth|tenth) rib$/, { item: 'costae_spuriae', rib: true }],
  [/^(eleventh|twelfth) rib$/, { item: 'costae_fluctuantes', rib: true }],
  [/costal cartilage$/, { decor: 'cartilage' }],
];

// Strana z názvu: „left …“, „… of left foot“, „… of left big toe“ apod.
export function splitSide(name) {
  const m = name.match(/\b(left|right)\b/);
  const side = m ? (m[1] === 'left' ? 'L' : 'R') : null;
  const bare = name.replace(/\b(left|right) /, '').trim();
  return { side, bare };
}

export function classify(name) {
  const { side, bare } = splitSide(name);
  for (const [re, spec] of RULES) if (re.test(bare)) return { side, ...spec };
  return null;
}
