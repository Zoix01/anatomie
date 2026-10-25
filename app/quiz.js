// Špatné možnosti pro „Lehkou“: vždy tři, co nejbližší (stejný druh a oblast), ale nikdy taková,
// která by byla také správně (nadřazená skupina, člen zvýrazněné skupiny, kost zvýrazněné části).

// Oblast u částí podle kosti; obecné části patří k oblasti svého druhu kostí.
const GENERIC_REGION = { vertebra: 'pater', costa: 'hrudnik', basis_cranii: 'lebka' };
export function regionOf(item, byId) {
  if (item.region) return item.region;
  return GENERIC_REGION[item.parent] || byId[item.parent]?.region;
}

// id všech položek, které zvýrazněná struktura také „je“ nebo obsahuje
export function relatedIds(item, items, byId) {
  const ids = new Set([item.id]);
  for (let g = item.groupOf; g; g = byId[g]?.groupOf) ids.add(g);
  if (item.parent) ids.add(item.parent);
  const inside = (x) => { for (let g = x.groupOf; g; g = byId[g]?.groupOf) if (g === item.id) return true; return false; };
  for (const x of items) if (inside(x) || x.parent === item.id) ids.add(x.id);
  return ids;
}

export function pickDistractors(item, { items, byId, isAvailable, shuffle }) {
  const bad = relatedIds(item, items, byId);
  const ok = items.filter((x) => !bad.has(x.id) && isAvailable(x));
  const region = regionOf(item, byId);
  const tiers = [
    ok.filter((x) => x.kind === item.kind && (item.kind === 'part' ? x.parent === item.parent : regionOf(x, byId) === region)),
    ok.filter((x) => regionOf(x, byId) === region),
    ok,
  ];
  const picked = [];
  for (const tier of tiers) {
    for (const x of shuffle([...tier])) if (picked.length < 3 && !picked.includes(x)) picked.push(x);
  }
  return picked;
}
