// Shoda pro „Těžkou“: bez ohledu na velikost písmen, diakritiku, mezery a běžné zkratky.
// Překlepy se neodpouštějí – na ty je tlačítko „Měl/a jsem pravdu“.
const ABBREV = [
  [/\bproc\b\.?/g, 'processus'],
  [/\bfor\b\.?/g, 'foramen'],
  [/\binc\b\.?/g, 'incisura'],
];

export function normalize(s) {
  let t = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const [re, full] of ABBREV) t = t.replace(re, full);
  return t.replace(/[.,;:()]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isMatch(answer, item) {
  const a = normalize(answer);
  return [item.la, ...(item.variants || [])].some((v) => normalize(v) === a);
}
