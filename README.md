# Anatomie

Mobilní webová aplikace na učení latinských názvů kostí a jejich částí na 3D kostře
(kurz Anatomie, fyziologie a genetika, FF UK). Rozhraní je česky.

Živě: https://anatomie-ffuk-psy-bc.pages.dev

## Struktura

| Složka | Co v ní je |
| --- | --- |
| `app/` | Aplikace (statické soubory, Three.js z CDN). Nasazuje se celá tato složka. |
| `app/model/skeleton.glb` | 3D kostra (zjednodušená, celá najednou), postavená skriptem v `tools/`. |
| `app/model/detail/` | Každá kost zvlášť v plném rozlišení; načte se při izolaci kosti. |
| `app/data.js` | Schválený seznam struktur (latinsky, česky, nadřazená kost, zajímavost). |
| `tools/` | `build-model.mjs` – převod BodyParts3D → `skeleton.glb` + `detail/`; `manifest.mjs` – které kosti a jak se mapují. |
| `prototype/` | Schválený klikací prototyp se zástupnými tvary (jen pro srovnání). |
| `docs/PLAN.md` | Zadání, schválený seznam struktur, rozhodnutí. |
| `raw/` | Stažená zdrojová data (není v gitu). |
| `slides/` | Přednášky (autorsky chráněné, není v gitu, není v aplikaci). |

## Sestavení modelu

1. Stáhnout do `raw/bp3d/`: `BodyParts3D_3.0_obj_95.zip` a `parts_list_e.txt`
   z https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/
2. `cd tools && npm install && npm run build-model`

## Nasazení

```
npx wrangler@3 pages deploy app --project-name anatomie-ffuk-psy-bc --branch main
```

Před nasazením zvednout číslo `?v=N` u souborů v `app/`, aby prohlížeče nenechaly starou verzi v cache.

## Zdroje a licence modelu

3D model kostry je odvozené dílo a šíří se pod licencí **CC BY-SA 4.0**:

- **BodyParts3D**, © The Database Center for Life Science, licence CC BY-SA 2.1 Japan
  (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/) – všechny kosti.

Úpravy: výběr kostí, oddělení kostrče od tělesa „sacrum“ (v BodyParts3D jsou jedno těleso),
zjednodušení sítí pro celkový pohled, převod souřadnic, převod do glTF.

Ossa sesamoidea manus v modelu nejsou – žádný ověřený 3D model je neobsahuje.
