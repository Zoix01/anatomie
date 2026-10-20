# 3D skeleton study app for my anatomy class: Latin osteology terms

## Who and why
- I'm a 1st-year psychology student at FF UK Prague, in the course "Anatomie, fyziologie a genetika".
- I want a web app that helps me and my classmates learn the **Latin names of bones and bone parts** on an interactive 3D skeleton.
- Classmates use it mostly on phones, and many aren't technical.
- **The UI must be in Czech.**
- I'm not a programmer. Work autonomously, but follow the process below exactly.

## Content scope: strict
- Source: the lecture slides in `slides/` (PDFs).
  - They are copyrighted: never commit them to git and never ship them in the app.
  - Use the osteology slides. `03 Svaly.pdf` is about muscles and is out of scope for now. Check `Opěrná soustava.pdf` and tell me what it covers.
- Include **only bones and bone parts that are actually labelled on the slides**, i.e. on the pictures, with label lines.
  - Add nothing from textbooks.
  - Leave out joints, ligaments, menisci, planes, directions and tissue types.
- Extract the list from the slides. For each item give:
  - the Latin name in Terminologia Anatomica spelling (accept the slide typos as variants)
  - the genitive where useful
  - the Czech name
  - the parent bone, for parts
  - the body region
  - the slide number
  - a short fun fact
- **Show me this list for approval before building anything.**
- Check every name and every 3D mapping as an expert anatomist would:
  - Is it the correct structure and side?
  - Are the Latin and Czech names correct?
  - Is it unambiguous on the model?

## The app has two modes only

### 1. Explore
- A full 3D skeleton that you can rotate, zoom and pan. It must run smoothly on mid-range phones.
- **Hovering or focusing highlights** the bone under the pointer or finger.
- **Clicking or tapping opens a pop-up** with:
  - the Latin name (+ genitive)
  - the Czech name
  - the parent bone, for parts
  - one short fun fact
- **Bone parts are coloured regions painted on the bone surface**, textbook-style. They become tappable when you zoom in or isolate a bone.
- Anything beyond this, including isolating a bone, is your proposal for me to approve. Don't add it on your own.

### 2. Test
- Before starting, the student chooses:
  - **Difficulty**: *Lehká* = choose from 4 answers; *Těžká* = type the Latin name. Typing must tolerate case, diacritics, abbreviations and small typos, and there must be a "Měl/a jsem pravdu" (I was right) button.
  - **The number of questions and an optional timer**, e.g. 10 / 20 / 40 questions, plus a 25-minute exam-style option.
- Question types:
  - "Ťukni na …": tap the named bone or part on the model.
  - "Co je zvýrazněno?": a structure lights up and the student names it.
- **Results screen**: the score and a list of structures to review.
- Simple progress stored on the device, with no accounts:
  - tests favour the structures the student got wrong before
  - a score is shown per body region

## Constraints
- €0 running cost.
- One share link: no login, no install, nothing to configure.
- Mobile-first, with large tap targets.
- Keep everything else minimal (look, colours, extra features). **Ask me rather than invent.**
- I've deployed to Cloudflare before, and wrangler is logged in on this PC.

## Process (important: last time the features were never defined precisely)
1. Research the 3D model options and compare them on:
   - licence
   - whether the bones are separate meshes
   - level of detail: fine enough to tell neighbouring parts apart, e.g. capitulum vs trochlea humeri
   - file size and performance on phones

   Then recommend one.
2. Ask me all your questions in one round.
3. Write a **screen-by-screen spec**: every screen, every element, what each tap does, and all texts in Czech.
4. Build a **rough clickable prototype** (placeholder data is fine) and give me a link. **I approve or correct the spec and the prototype before the real build starts.**
5. Build in small milestones, deploying each one with a link. After each milestone, tell me exactly what changed and what I should test.
6. Never add a feature that isn't in the approved spec. Propose it instead.

## Notes from a previous attempt (facts, not requirements)
- **BodyParts3D**: free, per-bone meshes with FMA names.
  - Version 3.0 "obj_95" (522 MB download, in https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/) is detailed enough for bone parts. The 4.0 "obj_99" meshes are too coarse.
  - The older files are licensed CC BY-SA 2.1 JP; the current licence page says CC BY 4.0.
  - It has no coccyx, no costal cartilages 8–10 and no ligaments.
- **Open3DModel (AnatomyTOOL, anatomytool.org)**: CC BY-SA 4.0, Draco-compressed GLBs per body region, right side only, includes ligaments.
- A bones-only model of about 270k triangles compresses to roughly 1.2 MB with meshopt (gltf-transform).
