# Brand Identity Design — Reference

## The 9 brief questions

1. Brand name (exact spelling/casing)
2. Tagline, if any
3. Major goal the brand is trying to achieve
4. 3–5 keywords/attributes (e.g. precise, approachable, technical)
5. Products/services
6. Target market — who buys/uses
7. Competitors — named
8. Desired reputation ("how do you want to be known?")
9. Color preferences or constraints (existing brand colors count)

Anything the brief doesn't answer: assume plausibly and mark `(assumed: …)` in the delivery.

## Direction vocabulary

Pick 2–3, each tied to brand attributes:

| Direction | Fits attributes like | Display + text pairing (all OFL/Google) |
|---|---|---|
| geometric minimal | precise, technical, modern | Space Grotesk + Inter |
| humanist / organic | warm, approachable, human | Nunito Sans + Source Sans 3 |
| editorial serif | established, premium, credible | Cormorant Garamond or Fraunces + Karla |
| monospace / technical | engineering, developer, exact | JetBrains Mono (accents) + Inter |
| bold condensed | loud, confident, sport | Archivo Expanded/Black + Archivo |
| monoline rounded | friendly, consumer, playful | Quicksand + Nunito |
| heritage / emblem | tradition, craft, provenance | Playfair Display + Lora |

**Shape and type read before words do:** round forms read warm/community, angular forms read energy/precision; serifs read competence/establishment, scripts read ceremony — pick the read that matches the positioning, then verify it against the landscape scan.

## Industry cliché map

Use one of these only with a **named twist**, stated in the rationale — and check the landscape scan first: a twisted cliché a competitor already twisted is still a cliché.

- coffee: bean, cup, steam curl, sun-over-cup
- law / finance: scales, gavel, pillars, shield, upward arrow
- tech / SaaS: circuit traces, gear, grid-of-rounded-squares, swoosh, hexagon
- AI: brain, neural mesh, sparkle
- robotics / hardware: robot head, cog, chevron-in-box
- health: cross, heart, caduceus, leaf-in-hand
- eco / sustainability: leaf, globe, water drop
- food / dining: fork-and-knife, chef's hat, wave for anything coastal
- real estate / construction: roofline, skyline
- education: book, graduation cap, owl
- logistics / delivery: box, arrow, wing

## SVG production

**Masters are paths only.** No `<text>`, no `font-family`, no external refs, no raster embeds. Check before delivering:

```bash
grep -l 'font-family\|<text' svg/*.svg   # must return nothing
```

**Outlining real font text** (kerned via HarfBuzz; tested working):

```python
# pip install fonttools uharfbuzz
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

def text_to_path(text, font_path, size=100, tracking=0):
    """One SVG path `d` for `text`. Baseline at y=0, glyphs extend into negative y."""
    blob = hb.Blob.from_file_path(font_path)
    face = hb.Face(blob)
    font = hb.Font(face)
    scale = size / face.upem
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf)
    tt = TTFont(font_path)
    glyph_set = tt.getGlyphSet()
    order = tt.getGlyphOrder()
    x, parts = 0.0, []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        pen = SVGPathPen(glyph_set)
        tpen = TransformPen(pen, (scale, 0, 0, -scale,
                                  (x + pos.x_offset) * scale, -pos.y_offset * scale))
        glyph_set[order[info.codepoint]].draw(tpen)
        cmds = pen.getCommands()
        if cmds:
            parts.append(cmds)
        x += pos.x_advance + tracking / scale
    return " ".join(parts), x * scale  # (d attribute, advance width in svg units)
```

Set `viewBox` minY ≈ −capHeight so the outlined text is inside it. Fonts: Google Fonts TTFs are freely licensed (note the license, usually OFL); macOS `/System/Library/Fonts/Supplemental/` works for drafts but ships with license unknowns — prefer OFL for the final. Short all-caps wordmarks may instead be drawn directly as geometric paths.

**Geometry hygiene:** tight viewBox with small round numbers; square canvas for favicon/avatar masters; one `fill` value per colorway file (mono/reverse are fill-swaps of identical geometry); strokes converted or width-checked at 16 px (a 1-unit stroke in a 100-unit viewBox ≈ 0.16 px at favicon size — it vanishes). If the mark thins at ≤48 px, produce a bolder **small cut** as its own master.

**Optical, not mathematical:** round shapes overshoot flat ones slightly; center marks by eye at final size, not by bounding box.

**Rasterizing** (first available wins):

```bash
rsvg-convert -w 512 in.svg > out.png
```

```bash
python3 -m pip install cairosvg && python3 -c "import cairosvg; cairosvg.svg2png(url='in.svg', write_to='out.png', output_width=512)"
```

Fallback: headless Chrome `--screenshot` on an HTML wrapper. Favicon/app set: 16, 32, 48, 180 (apple-touch), 192, 512 (≤48 from the small cut when one exists). `.ico` via Pillow only if asked.

**Validation = viewing the rendered PNGs**, not the export command succeeding. Read/open each size; fix; re-render.

## Color system

Roles — max 6 colors total:

| Role | Count | Job examples |
|---|---|---|
| primary | 1 | the brand color; mark, key actions |
| secondary | 1–2 | support surfaces, illustration |
| neutrals | 2 | text ink + background |
| accent | 1 | highlights, states — never body text unless it passes |

Every color: name, HEX, one-line job (+ RGB/CMYK when print is in scope; flag CMYK values as uncalibrated conversions unless proofed).

**Contrast — compute, don't eyeball** (tested; #000/#fff → 21.0, #767676/#fff → 4.54):

```python
def lum(h):
    h = h.lstrip('#'); r, g, b = (int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)

def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)
```

Targets: body text ≥ 4.5:1, large headlines ≥ 3:1. Name the failing pairs in the spec with their allowed use ("accent: large text only, 4.1:1") — never omit them.

## Imagery direction (identity scope)

Three adjectives + one do/don't line, e.g.: "Coastal, unstaged, daylight. Do: real ingredients on real surfaces. Don't: stock smiles, studio white sweeps." Derive it from the positioning and the audience questions: what do they value, how should they feel.

## Refresh — equity inventory

Before redesigning anything, table the existing identity:

| Element | What it is today | Recognized by customers? | Verdict + reason |
|---|---|---|---|
| mark silhouette / motif | | | keep / evolve / replace |
| color palette | | | |
| type style | | | |
| name treatment (casing, lockup) | | | |

Rules: change no more than the brief justifies; "dated" alone justifies *evolve*, not *replace*; the board shows old vs new side by side; minimum sizes and applications get re-validated after the change.

## Presentation board — section order

One self-contained HTML file:

1. Brief + marked assumptions
2. Positioning sentence
3. Landscape: industry defaults, clichés, conform/differentiate call (labeled researched vs knowledge-based)
4. *(refresh only)* Equity inventory + old vs new side by side
5. All concepts — sketch + name + idea line each
6. Recommendation + rationale (cites positioning), runner-up notes
7. Variants grid: lockups × colorways, reverse shown on a dark tile
8. Validation strip: 16/32/48 px renders embedded at actual size
9. *(identity scope)* Identity system: palette with ratios, type specimen, imagery direction
10. *(identity scope)* Applications: the ≥3 mockups
11. Spec (below)
12. File manifest

Logo-only scope skips 4, 9, 10.

## Spec skeleton

- Positioning sentence
- Colors: name, HEX, job (one line each; + RGB/CMYK when print is in scope); failing contrast pairs named with allowed use
- Type: fonts, licenses, fallback stacks, size scale
- Variant use-case table: horizontal / stacked / mark-only / small cut / each colorway → when to use it
- Fixed vs flexible: which elements never change (mark geometry, palette, type) vs where teams have room (imagery per campaign, layouts)
- Clearspace: as a fraction of mark height (e.g. "x = cap height, keep x on all sides")
- Minimum sizes: px (screen) and mm (print), per colorway if they differ
- Imagery direction (identity scope)
- 3 don'ts (specific to this identity)

## Name collision

Two-minute search: exact name + industry. If a same-space company, live domain, or app already wears it, flag it in the delivery and recommend trademark clearance before the client invests — a flag, not legal advice.
