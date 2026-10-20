# Anatomie: step 1 (structure list, 3D model, decisions)

## Context
Mobile-first Czech web app for learning Latin osteology on a 3D skeleton, for FF UK students of "Anatomie, fyziologie a genetika". The brief is NEW_CHAT_PROMPT.md, and its process is:
list approval → model → questions → screen spec → clickable prototype → milestones.

Your answers to round 1 are below (section D). This file now holds:
- the updated structure list for final approval
- the model decision
- the next steps

No app code is written until you approve the spec and the prototype.

**Source:** `L02_uvod_kosti_klouby.pdf` only. `Opěrná soustava.pdf` is your own OneNote notes (13. 10. 2023) on the same lecture. It reuses the slide pictures and adds no new labelled structures, so it is used only to confirm Czech names and for a few fun facts from the lecture.

---

## B. Structure list (rule: a bone or bone part that appears on a slide picture)
Notation:
- **B** = whole bone, a separate mesh.
- **P** = a part, painted as a region on its parent bone.
- **G** = a group of bones: tapping any member counts.
- *Slide variant* = a slide form or typo that the test also accepts.

Fun fact sources:
- **[sN]** = from slide N.
- **[pozn.]** = from your notes.
- **[uč.]** = a standard textbook fact I'm certain of.
- **—** = no fun fact.

### Horní končetina
| | Latin (TA) | gen. | Czech | parent | slide | fun fact |
|---|---|---|---|---|---|---|
|B|clavicula|claviculae|klíční kost|—|21,22,25|[uč.] První kost v těle, která v embryu začíná kostnatět.|
|P|extremitas acromialis claviculae *(„akromiální konec“)*|extremitatis acromialis|akromiální konec|clavicula|22|[s25] Kloubí se s acromionem – art. acromioclavicularis.|
|P|extremitas sternalis claviculae *(„sternální konec“)*|extremitatis sternalis|sternální konec|clavicula|22|[s25] Art. sternoclavicularis je jediný kloub, kterým je horní končetina spojena s trupem.|
|B|scapula|scapulae|lopatka|—|21,23,25|[s90] Zlomenina lopatky u malého dítěte patří mezi známky týrání.|
|P|acromion|acromii|nadpažek|scapula|23,25|[s26] S lig. coracoacromiale tvoří fornix humeri – „střechu“ ramenního kloubu.|
|P|processus coracoideus|processus coracoidei|zobcovitý (krkavčí) výběžek|scapula|23,26|[uč.] Jméno podle krkavčího zobáku (řec. korax = krkavec).|
|P|cavitas glenoidalis|cavitatis glenoidalis|kloubní jamka lopatky|scapula|23,27|[s27] Prohlubuje ji chrupavčitý lem labrum glenoidale.|
|B|humerus|humeri|kost pažní|—|21,24|[s15] Učebnicový příklad dlouhé kosti.|
|P|caput humeri|capitis humeri|hlavice kosti pažní|humerus|24|[pozn.] S cavitas glenoidalis tvoří ramenní kloub – nejpohyblivější kloub v těle.|
|P|collum chirurgicum humeri|colli chirurgici humeri|chirurgický krček|humerus|24|[pozn.] Místo, kde se humerus nejčastěji láme.|
|P|corpus humeri|corporis humeri|tělo kosti pažní|humerus|24|[uč.] Po jeho zadní straně se spirálovitě vine n. radialis.|
|P|capitulum humeri *(s31: „Capitulum“)*|capituli humeri|hlavička kosti pažní|humerus|24,31|[s32] S hlavičkou radia tvoří art. humeroradialis (kulový kloub).|
|P|trochlea humeri *(s31: „Trochlea“)*|trochleae humeri|kladka kosti pažní|humerus|24,31|[s32] S ulnou tvoří art. humeroulnaris (kladkový kloub).|
|P|fossa olecrani|fossae olecrani|jamka pro okovec|humerus|24,33|[uč.] Při natažení lokte do ní zapadá olecranon.|
|P|fossa coronoidea *(s31: „Coronoid fossa“)*|fossae coronoideae|jamka pro korunový výběžek|humerus|31|[uč.] Při ohnutí lokte do ní zapadá processus coronoideus ulnae.|
|P|epicondylus medialis humeri *(s31: „medial epicondyle“)*|epicondyli medialis|vnitřní epikondyl|humerus|31|[uč.] Za ním běží n. ulnaris – proto při nárazu loktem „brní“ malíček.|
|P|epicondylus lateralis humeri *(s31: „lateral epicondyle“)*|epicondyli lateralis|zevní epikondyl|humerus|31|[uč.] Začínají na něm natahovače zápěstí; jeho přetížení je „tenisový loket“.|
|B|radius|radii|kost vřetenní|—|21,28,29|[s28] Leží laterálně – na palcové straně předloktí.|
|P|caput radii *(s31: „Radial head“)*|capitis radii|hlavička kosti vřetenní|radius|29,31|[s33] Obepíná ji prstenec lig. anulare radii.|
|P|collum radii|colli radii|krček kosti vřetenní|radius|29|[pozn.] U malých dětí může hlavička z prstence vyklouznout po tahu za ruku – netahat děti za předloktí.|
|P|corpus radii|corporis radii|tělo kosti vřetenní|radius|29|—|
|P|tuberositas radii *(s29: „úpon m. biceps brachii“; s31: „radial tuberosity“)*|tuberositatis radii|drsnatina kosti vřetenní|radius|29,31|[s29] Upíná se na ni m. biceps brachii.|
|P|processus styloideus radii|processus styloidei radii|bodcovitý výběžek kosti vřetenní|radius|29|[uč.] Sahá níž než bodcovitý výběžek ulny.|
|B|ulna *(„Ulna“)*|ulnae|kost loketní|—|21,28,30|[s28] Leží mediálně – na malíkové straně předloktí.|
|P|olecranon|olecrani|okovec|ulna|30,33|[pozn.] Ten „loket“, o který se opíráš o stůl.|
|P|processus coronoideus ulnae *(s31: „Coronoid process“)*|processus coronoidei ulnae|korunový výběžek|ulna|30,31|—|
|P|incisura trochlearis *(s31: „Trochlear notch“)*|incisurae trochlearis|zářez pro kladku|ulna|31|[pozn.] Sem zapadá trochlea humeri.|
|P|incisura radialis ulnae *(s31: „Radial notch“)*|incisurae radialis|zářez pro radius|ulna|31|[s32] S hlavičkou radia tvoří art. radioulnaris proximalis.|
|P|corpus ulnae|corporis ulnae|tělo kosti loketní|ulna|30|—|
|P|caput ulnae|capitis ulnae|hlavice kosti loketní|ulna|30|[uč.] Pozor: hlavice ulny je distálně, hlavička radia proximálně.|
|P|processus styloideus ulnae|processus styloidei ulnae|bodcovitý výběžek kosti loketní|ulna|30|—|
|G|ossa carpi *(„karpy“, „zápěstí (8 kostí)“)*|ossium carpi|zápěstní kosti|—|21,34|[s34] 8 kůstek ve dvou řadách po čtyřech.|
|G|proximální řada zápěstních kostí *(„proximální řada (4)“)*|—|proximální řada|ossa carpi|34|[s34] 4 kosti.|
|G|distální řada zápěstních kostí *(„karpy distální řada (4)“)*|—|distální řada|ossa carpi|34|[s34] 4 kosti.|
|B|os pisiforme|ossis pisiformis|kost hrášková|ossa carpi|34|[s34] Je to sezamská kost.|
|G|ossa metacarpi *(„metakarpy“, „záprstí“)*|ossium metacarpi|záprstní kosti|—|21,34|[s34] 5 kostí.|
|G|phalanges manus *(„články prstů – phalanges“)*|phalangum|články prstů ruky|—|21,34|[s21] Palec má 2 články, ostatní prsty 3.|
|G|pollex *(slide: „pollux“)*|pollicis|palec ruky|—|34|[s34] Genitiv pollicis – např. m. flexor pollicis longus.|
|G|ossa sesamoidea manus|ossium sesamoideorum|sezamské kosti ruky|—|34|[pozn.] Vznikají kostnatěním ve šlaše.|

### Dolní končetina
| | Latin (TA) | gen. | Czech | parent | slide | fun fact |
|---|---|---|---|---|---|---|
|B|os coxae|ossis coxae|kost pánevní|—|39,40|[s40] Vzniká srůstem tří kostí mezi 15. a 18. rokem.|
|P|os ilium|ossis ilii|kost kyčelní|os coxae|40|[s43] U žen jsou lopaty kyčelních kostí více odkloněné.|
|P|os ischii|ossis ischii|kost sedací|os coxae|40|—|
|P|os pubis|ossis pubis|kost stydká|os coxae|40|[s16] Obě se spojují v symphysis pubica (chrupavkou).|
|P|foramen obturatum|foraminis obturati|ucpaný otvor|os coxae|40|[s43] U žen je nižší a spíše trojhranný.|
|P|acetabulum|acetabuli|jamka kyčelního kloubu|os coxae|41|[uč.] Latinsky „miska na ocet“; setkávají se v ní všechny tři pánevní kosti.|
|P|crista iliaca|cristae iliacae|hřeben kosti kyčelní|os coxae|41|[s45] Vzdálenost obou hřebenů (distantia bicristalis) je asi 29 cm.|
|P|tuber ischiadicum|tuberis ischiadici|sedací hrbol|os coxae|41|[uč.] Při sezení nese váhu těla.|
|P|facies auricularis ossis ilii *(„kloubní plocha (kloub tuhý)“)*|faciei auricularis|ušní plocha|os coxae|40|[s42] S kostí křížovou tvoří art. sacroiliaca – „kloub tuhý“.|
|B|femur|femoris|kost stehenní|—|47|[uč.] Nejdelší kost lidského těla.|
|P|caput femoris|capitis femoris|hlavice kosti stehenní|femur|47|[s49] Při totální endoprotéze kyčle se nahrazuje umělou.|
|P|collum femoris|colli femoris|krček kosti stehenní|femur|47|[uč.] Zlomenina krčku je typický úraz seniorů.|
|P|trochanter major|trochanteris majoris|velký chocholík|femur|47|[s45] Vzdálenost obou (distantia bitrochanterica) je asi 31 cm.|
|P|trochanter minor|trochanteris minoris|malý chocholík|femur|47|[uč.] Upíná se na něj m. iliopsoas.|
|P|condylus medialis femoris *(„condylus medialis“)*|condyli medialis femoris|vnitřní kondyl kosti stehenní|femur|47|—|
|P|condylus lateralis femoris *(„condylus lateralis“)*|condyli lateralis femoris|zevní kondyl kosti stehenní|femur|47|—|
|P|facies patellaris|faciei patellaris|plocha pro čéšku|femur|47|[pozn.] Kloubní plocha, po které klouže čéška.|
|B|patella|patellae|čéška|—|51|[uč.] Největší sezamská kost v těle.|
|B|tibia|tibiae|kost holenní|—|50|[pozn.] Leží mediálně; s femurem a patellou tvoří kolenní kloub [s51].|
|P|condylus medialis tibiae|condyli medialis tibiae|vnitřní kondyl kosti holenní|tibia|50|[s52] Leží na něm meniscus medialis.|
|P|condylus lateralis tibiae|condyli lateralis tibiae|zevní kondyl kosti holenní|tibia|50|[s52] Leží na něm meniscus lateralis.|
|P|malleolus medialis|malleoli medialis|vnitřní kotník|tibia|50|—|
|B|fibula|fibulae|kost lýtková|—|50|[pozn.] Femuru se vůbec nedotýká; odebírají se z ní kostní štěpy.|
|P|caput fibulae|capitis fibulae|hlavička kosti lýtkové|fibula|50|[s51] Kloubí se s tibií – art. tibiofibularis.|
|P|malleolus lateralis|malleoli lateralis|zevní kotník|fibula|50,56|[uč.] Sahá níž než vnitřní kotník.|
|B|talus|tali|kost hlezenní|ossa tarsi|55,56,57|[uč.] Neupíná se na ni žádný sval.|
|B|calcaneus|calcanei|kost patní|ossa tarsi|55,56,57|[s57] Upíná se na ni Achillova šlacha.|
|G|ossa tarsi *(„tarsy – 7 kostí“)*|ossium tarsi|zánártní kosti|—|55|[s55] 7 kostí.|
|G|ossa metatarsi *(„metatarsy“)*|ossium metatarsi|nártní kosti|—|55|[uč.] 5 kostí.|
|G|phalanges pedis *(„články prstců“)*|phalangum|články prstců nohy|—|55|[uč.] Palec nohy má 2 články, ostatní prstce 3.|
|G|hallux *(„hallux (hallucis)“)*|hallucis|palec nohy|—|55|[s55] Genitiv hallucis – např. m. flexor hallucis longus.|
|G|ossa sesamoidea pedis|ossium sesamoideorum|sezamské kosti nohy|—|55|[uč.] Obvykle dvě, pod hlavicí 1. nártní kosti.|

### Lebka
| | Latin (TA) | gen. | Czech | parent | slide | fun fact |
|---|---|---|---|---|---|---|
|G|neurocranium|neurocranii|mozkovna|—|64|[s71] U novorozence je velké oproti obličejové části.|
|G|splanchnocranium (viscerocranium)|splanchnocranii|obličejová část lebky|—|64|[s71] U novorozence je malé.|
|B|os frontale|ossis frontalis|kost čelní|—|64,65|[s15] Pneumatizovaná kost – obsahuje sinus frontalis.|
|B|os parietale|ossis parietalis|kost temenní|—|64,65|—|
|B|os temporale|ossis temporalis|kost spánková|—|64,67,68|[s67] S mandibulou tvoří čelistní kloub.|
|P|pars petrosa ossis temporalis *(„pars petrosa“)*|partis petrosae|skalní kost (pyramida)|os temporale|68|[uč.] Ukrývá střední a vnitřní ucho.|
|P|canalis caroticus|canalis carotici|karotický kanál|os temporale|68|[s70] Prochází jím a. carotis interna.|
|B|os occipitale|ossis occipitalis|kost týlní|—|64|[uč.] Svými kondyly nasedá na atlas.|
|P|foramen magnum|foraminis magni|velký týlní otvor|os occipitale|68|[uč.] Prochází jím prodloužená mícha.|
|B|os sphenoidale *(s15: „sphenoidalis“)*|ossis sphenoidalis|kost klínová|—|68|[s15] Pneumatizovaná kost – sinus sphenoidalis.|
|B|os ethmoidale|ossis ethmoidalis|kost čichová|—|68|[s15] Pneumatizovaná kost – sinus ethmoidales.|
|B|os nasale|ossis nasalis|kost nosní|—|64,65|—|
|B|os lacrimale|ossis lacrimalis|kost slzní|—|64,65|[uč.] Nejmenší kost obličeje.|
|B|os zygomaticum|ossis zygomatici|kost lícní|—|64,65|—|
|B|maxilla|maxillae|horní čelist|—|64,65|[s15] Obsahuje sinus maxillaris.|
|B|mandibula|mandibulae|dolní čelist|—|64,65,67|[pozn.] Jediná pohyblivá kost lebky.|
|B|os hyoideum *(„jazylka“)*|ossis hyoidei|jazylka|—|66|[s66] Je na ní zavěšen hrtan; nekloubí se s žádnou kostí [uč.].|
|G|septum nasi osseum *(„nosní přepážka“)* = vomer + lamina perpendicularis ossis ethmoidalis|septi nasi ossei|kostěná nosní přepážka|—|65|[uč.] Vomer znamená latinsky „radlice“.|
|G|conchae nasales *(„skořepy nosní“)*|concharum nasalium|nosní skořepy|—|65|[uč.] Víří a ohřívají vdechovaný vzduch.|
|P|fossa cranii anterior|fossae cranii anterioris|přední jáma lebeční|basis cranii|68|[uč.] Leží v ní čelní laloky mozku.|
|P|fossa cranii media|fossae cranii mediae|střední jáma lebeční|basis cranii|68|[uč.] Leží v ní spánkové laloky.|
|P|fossa cranii posterior|fossae cranii posterioris|zadní jáma lebeční|basis cranii|68|[uč.] Leží v ní mozeček.|

### Páteř
| | Latin (TA) | gen. | Czech | parent | slide | fun fact |
|---|---|---|---|---|---|---|
|G|vertebrae cervicales (C1–C7)|vertebrarum cervicalium|krční obratle|—|73,74|[uč.] I žirafa má jen 7 krčních obratlů.|
|G|vertebrae thoracicae (Th1–Th12)|vertebrarum thoracicarum|hrudní obratle|—|73,74|[s87] Kloubí se se žebry.|
|G|vertebrae lumbales (L1–L5)|vertebrarum lumbalium|bederní obratle|—|73,74|[uč.] Mají největší těla.|
|B|atlas (C1)|atlantis|nosič|vert. cervicales|75|[uč.] Nemá tělo obratle.|
|B|axis (C2)|axis|čepovec|vert. cervicales|75|[pozn.] Atlas na něm nasedá a otáčí se kolem jeho zubu.|
|P|dens axis *(„dens“)*|dentis axis|zub čepovce|axis|75|[s83] Drží ho na místě lig. transversum atlantis.|
|P|corpus vertebrae|corporis vertebrae|tělo obratle|every vertebra|74|[s78] Mezi těly leží meziobratlové ploténky.|
|P|processus spinosus *(„processus spinosus vertebrae“)*|processus spinosi|trnový výběžek|every vertebra|74|[s90] Zlomenina trnového výběžku u dítěte patří mezi známky týrání.|
|P|processus transversus|processus transversi|příčný výběžek|every vertebra|74|[s87] U hrudních obratlů se k němu kloubí hrbolek žebra.|
|B|os sacrum|ossis sacri|kost křížová|—|41,74,76|[s73] Vzniká srůstem 5 křížových obratlů; u žen je širší a kratší [s43].|
|P|promontorium|promontorii|předhoří|os sacrum|41,42|[s43] U žen méně vyčnívá do vchodu pánevního.|
|B|os coccygis *(s73: „cocgygeae“)*|ossis coccygis|kostrč|—|41,73,76|[s73] Srůst 3–5 obratlů; u žen je kratší a pohyblivější [s43].|

### Hrudník
| | Latin (TA) | gen. | Czech | parent | slide | fun fact |
|---|---|---|---|---|---|---|
|B|sternum|sterni|kost hrudní|—|25,84,85|[s15] Příklad ploché kosti.|
|P|manubrium sterni|manubrii sterni|rukojeť kosti hrudní|sternum|85|[s25] Kloubí se s klíčními kostmi.|
|P|corpus sterni|corporis sterni|tělo kosti hrudní|sternum|85|—|
|P|processus xiphoideus *(„processus xiphoideus sterni“)*|processus xiphoidei|mečovitý výběžek|sternum|85|[uč.] Řecky xiphos = meč.|
|G|costae verae (1–7)|costarum verarum|pravá žebra|—|84|[s84] 7 párů.|
|G|costae spuriae (8–10)|costarum spuriarum|nepravá žebra|—|84|[s84] 3 páry.|
|G|costae fluctuantes (11–12) *(„costae liberae“)*|costarum fluctuantium|volná (bludná) žebra|—|84|[s84] 2 páry.|
|B|costa prima *(„1. žebro“)*|costae primae|první žebro|costae verae|25,86|—|
|B|costa secunda *(„2. žebro“)*|costae secundae|druhé žebro|costae verae|86|—|
|P|caput costae|capitis costae|hlavice žebra|every rib|86|[s87] Kloubí se s těly obratlů.|
|P|collum costae|colli costae|krček žebra|every rib|86|—|
|P|tuberculum costae|tuberculi costae|hrbolek žebra|every rib|86|[s87] Kloubí se s příčným výběžkem obratle.|
|P|corpus costae|corporis costae|tělo žebra|every rib|86|[s89] Zlomeniny žeber u kojenců jsou typickou známkou týrání.|

**Still excluded (not a bone or bone part):**
- **joints and ligaments:** joints, ligaments, membrana interossea, discus, labrum, menisci, retinaculum, canalis carpi
- **soft tissue:** tendons, muscles, larynx
- **not bone:** fontanelles and sutures, tissue types
- **spaces and measurements:** pelvic apertures and measurements
- **sinuses:** cavities inside the bones, not visible on the surface
- **view captions:** "facies anterior / posterior" under the pictures name the view direction, not a structure

### Anatomist's check: notes the app will handle
- **Sides:** both sides can be tapped, and either side counts.
- **Condyles:** names always say femoris / tibiae, and slide forms are accepted.
- **Holes** (foramen obturatum, foramen magnum, canalis caroticus): painted as the bone rim around the opening.
- **Small parts** (canalis caroticus, incisurae) are tappable only in isolate view.
- **Repeated parts:** vertebra and rib parts are painted on every vertebra or rib; any one counts.
- **Overlapping groups:** a group lights up as a whole, so it can't be confused with one bone.
- **Fossae cranii:** they lie inside the skull, so they need a view of the skull base from above with the vault hidden. **Proposal for the spec:** isolating os sphenoidale / os occipitale / os frontale shows "basis cranii interna" with the three fossae painted.

---

## C. 3D model: BodyParts3D 3.0 "obj_95" (CC BY-SA 2.1 JP)
- Separate mesh per bone, both sides, fine enough detail. Alternatives:
  - Open3DModel: right side only
  - Z-Anatomy: derived from BodyParts3D, Blender-only
- **Gaps must be filled, because everything has to be in 3D:**
  - os coccygis, and any missing sesamoid or nasal concha meshes: I'll take them from **Z-Anatomy** (CC BY-SA 4.0; upgrading from BY-SA 2.1 is allowed).
  - If Z-Anatomy lacks one, I'll use another CC BY / BY-SA model, or as a last resort model the bone myself from the BodyParts3D neighbours.
  - I'll report which source each filled bone came from.
- **Pipeline (offline Node scripts + gltf-transform):**
  1. pick the meshes by FMA ID
  2. decimate each bone
  3. write a per-vertex part ID for the painted regions
  4. meshopt-compress into one GLB of about 1.5–2.5 MB
  - Every painted region gets a rendered screenshot that I check against its slide.
- **Licence note:** you said attribution isn't needed, but CC BY-SA requires credit for the model. **Minimal solution:** no visible UI element; the credit lives in the HTML `<meta>`, the GLB metadata and the repo README. Tell me if you want even that changed.

## D. Your decisions (round 1)
1. List approved, with item 3 applied → expanded above.
2. Fun facts only from the slides or 100% certain; otherwise none → applied (source tags will not be shown in the app).
3. Every bone or bone part on a slide picture is included → added: slide 31 elbow structures, tuberositas radii, facies auricularis, septum and conchae, atlas, axis, costa secunda, neuro/splanchnocranium, fossae cranii, pollex, hallux, carpal rows.
4. Either side counts; no "levý/pravý" in questions.
5. The coccyx must be in 3D (see C).
6. "Izolovat kost": the bone alone, freely rotatable through 360° by dragging, with parts tappable; "Zpět na kostru" returns to the skeleton.
7. No region filter; the test pool is all bones, parts and groups.
8. No attribution UI (see the licence note in C).
9. **Těžká:**
   - input field → "Odeslat"
   - **match** (after ignoring case, diacritics, and known abbreviations such as proc./lig.): marked correct and moves on automatically
   - **otherwise:** shows the correct answer + "Další" + "Měl/a jsem pravdu" (for a 1-letter typo); that button counts the answer as correct
10. I choose the palette: neutral UI with one accent, off-white/grey bones, clearly distinct highlight and part colours. It will be shown in the prototype.
11. **No timer and no question count:** "Začít test" starts an endless session, and "Ukončit" shows the results at any time (score + list to review). Difficulty is still chosen before starting.
12. **Progress clarification (see the end of this file).**
13. URL **anatomie-ffuk-psy-bc.pages.dev**, title **„Anatomie“**.
14. GitHub repo already exists: I commit, you push. I need the repo URL or folder (this folder isn't a git repo yet).

## E. Next steps (each needs your OK)
1. **Screen-by-screen spec (Czech):** every screen, element, tap and text → published as a private page.
2. **Rough clickable prototype:** placeholder bones, full UI flow, palette → deployed to anatomie-ffuk-psy-bc.pages.dev.
3. **Milestones,** each deployed with a "what changed / what to test" note:
   - M1 model pipeline + Explore (bones)
   - M2 painted parts + isolate
   - M3 Test, Lehká
   - M4 Test, Těžká

**No saved progress (decision 2026-10-20).** This drops these points from the original brief: no on-device history, no favouring of wrong answers, no score per region and no reset button. Results exist only for the current session: the score plus the list to review.

## Verification
- Phone-sized viewport in Chrome devtools, plus your real-phone check per milestone.
- Screenshots of every painted part compared with its slide.
- Unit tests for the typed-answer matcher (case, diacritics, abbreviations).
- Lighthouse / frame-rate check on a throttled mobile profile.

## Open
- **Git:** remote https://github.com/Zoix01/anatomie.git.
  - I'll `git init` this folder and add that remote.
  - `.gitignore` will exclude `slides/` and the raw downloaded model data.
  - I commit; you push.
- **Licence credit:** handled invisibly (HTML meta, GLB metadata, README). There is nothing for you to do.
