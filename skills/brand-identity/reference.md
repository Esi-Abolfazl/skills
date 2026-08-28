# Logo Design — Reference

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

| Direction | Fits attributes like |
|---|---|
| geometric minimal | precise, technical, modern |
| humanist / organic | warm, approachable, human |
| editorial serif | established, premium, credible |
| monospace / technical | engineering, developer, exact |
| bold condensed | loud, confident, sport |
| monoline rounded | friendly, consumer, playful |
| heritage / emblem | tradition, craft, provenance |

## Industry cliché map

Use one of these only with a **named twist**, stated in the rationale — and check the landscape scan first: a twisted cliché a competitor already twisted is still a cliché.

- coffee: bean, cup, steam curl, sun-over-cup
- law / finance: scales, gavel, pillars, shield, upward arrow
- tech / SaaS: circuit traces, gear, grid-of-rounded-squares, swoosh, hexagon
- AI: brain, neural mesh, sparkle
- robotics / hardware: robot head, cog, chevron-in-box
- health: cross, heart, caduceus, leaf-in-hand
- eco / sustainability: leaf, globe, water drop
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

**Geometry hygiene:** tight viewBox with small round numbers; one `fill` value per colorway file (mono/reverse are fill-swaps of identical geometry); strokes converted or width-checked at 16 px (a 1-unit stroke in a 100-unit viewBox ≈ 0.16 px at favicon size — it vanishes).

**Optical, not mathematical:** round shapes overshoot flat ones slightly; center marks by eye at final size, not by bounding box.

**Rasterizing** (first available wins):

```bash
rsvg-convert -w 512 in.svg > out.png
```

```bash
python3 -m pip install cairosvg && python3 -c "import cairosvg; cairosvg.svg2png(url='in.svg', write_to='out.png', output_width=512)"
```

Fallback: headless Chrome `--screenshot` on an HTML wrapper. Favicon/app set: 16, 32, 48, 180 (apple-touch), 192, 512. `.ico` via Pillow only if asked.

**Validation = viewing the rendered PNGs**, not the export command succeeding. Read/open each size; fix; re-render.

## Presentation board — section order

One self-contained HTML file:

1. Brief + marked assumptions
2. Positioning sentence
3. Landscape: industry defaults, clichés, conform/differentiate call
4. All concepts — sketch + name + idea line each
5. Recommendation + rationale (cites positioning), runner-up notes
6. Variants grid: lockups × colorways, reverse shown on a dark tile
7. Validation strip: 16/32/48 px renders embedded at actual size
8. Spec (below)
9. File manifest

## Spec skeleton

- Positioning sentence
- Colors: name, HEX, job (one line each)
- Type: font, license, fallback stack
- Clearspace: as a fraction of mark height (e.g. "x = cap height, keep x on all sides")
- Minimum sizes: px (screen) and mm (print)
- 3 don'ts (specific to this mark)

## Name collision

Two-minute search: exact name + industry. If a same-space company, live domain, or app already wears it, flag it in the delivery and recommend trademark clearance before the client invests — a flag, not legal advice.
