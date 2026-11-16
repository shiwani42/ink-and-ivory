# Spatial UI and text that never clips or overlaps

Author UIKitML panels with the `iwsdk-ui` skill; this file covers placement, numbers, poke and text layout. "Text cut off on all sides" and "text overlapping" were the most-reported defects after visuals.

## Numbers (Meta `hz-immersive-designer`)
- Glyph height **≥1.0°**, aim for **1.5°** at the viewing distance (≈1.7 cm at 1 m, ≈2.6 cm at 1.5 m).
- Primary UI within **30° of gaze**, **10–20° below** eye level, **≥0.5 m** away.
- Contrast **≥4.5:1**; clear sans-serif for body text, decorative faces for titles only; no thin fonts.
- Hand targets **43–64 mm**; button hit height ≥2.2 cm.
- Captions for all speech, at most about 32 chars × 2 lines per page.

## Code-owned UIKit panels
```ts
// public/ui/menu.uikitml registered in src/assets.ts as AssetType.UIKitML 'menu-panel'
const panel = await this.world.assets.instantiate<UIKitMLAsset>('menu-panel');
panel.scale.setScalar(0.062);          // UIKit units are CENTIMETRES: 330 units * 0.062 = 20 cm wide
const e = this.world.createTransformEntity(panel, { parent: deskEntity, persistent: true });
e.addComponent(RayInteractable); e.addComponent(PokeInteractable);
panel.getElementById<UIKit.Text>('streak')?.setProperties({ text: 'Practised today' });
panel.getElementById('cap-actions')?.setProperties({ display: 'none' });
```
- Panels face +Z. Parent them to the object they control and angle them toward the user. **Never head-lock panels.**
- Text inside `<ButtonLabel><span id=…>` accepts `setProperties({ text })`.
- The default MSDF fonts (Inter, Merriweather) cover Latin-1 only: no CJK glyphs, no Indic shaping, and no `·`. Draw such text with Canvas2D textures or geometry.
- Horizon `<Button>` gives about 2.6 cm hit height at scale 0.06–0.07.
- Size bubbles and tiles by label length, not for one letter ("D#" is two).

## Fingertip poke for UIKit buttons (the built-in touch pointer didn't click in the emulator)
```ts
interface PokeButton { id: string; el: Object3D; panel: Object3D; fn: () => void; depth: [number, number] }
// per frame, for each tracked hand (slot 0/1) and each visible button:
const e = b.el.matrixWorld.elements;            // maps the unit square onto the element's rectangle
const pe = b.panel.matrixWorld.elements;        // the panel's +Z is the press normal
this.n.set(pe[8], pe[9], pe[10]).normalize();
this.d.set(tip.x - e[12], tip.y - e[13], tip.z - e[14]);
const depth = this.d.dot(this.n);
this.axis.set(e[0], e[1], e[2]); const lx = this.d.dot(this.axis) / Math.max(1e-8, this.axis.lengthSq());
this.axis.set(e[4], e[5], e[6]); const ly = this.d.dot(this.axis) / Math.max(1e-8, this.axis.lengthSq());
const over = Math.abs(lx) <= 0.55 && Math.abs(ly) <= 0.6;   // a little margin around the rectangle
if (over && b.depth[slot] > 0.004 && depth <= 0.004 && depth > -0.03) this.trigger(b.id, b.fn);
b.depth[slot] = depth;
// trigger(): debounce per id (600 ms), click sound, run fn. Ray, mouse and poke all go through it.
```

## Canvas text: fit to the card
When drawing text on a canvas, **shrink the font until the wrapped block fits both width and height** inside the padding. Wrapping only guarantees width. Size cards for two lines (aspect ≈ 2.5–3). Reference module: `quest-mr-game/reference/runtime/text.ts` (Label, fit-to-card) and `ui.ts` (Subtitles, Hint).

## One region per kind of text
- **Dialogue / narration:** a fixed world spot just below the speaker (or above the far edge of the play area), facing the viewer, with a speaker tag. Distinct styles per voice.
- **Instructions:** a card floating 8–12 cm above the object they refer to, gently bobbing; never over the dialogue spot.
- **Object labels:** exactly one per object; no duplicate hints on top.
- **Title:** only before any dialogue starts.
- **Numbers** (scores, dice totals): a display face directly over the object; don't repeat them as captions.
- Per-frame status spam is removed, not restyled.

**Subtitles:** at a table, anchor dialogue in the world near the speaker (gaze-following text slides over hints when the user looks down). In open scenes a head-stabilised lazy-follow bar is fine; compute forward as `(0,0,-1)` rotated by the head's world quaternion.

## Onboarding as a choreographed sequence
Never overlapping timers: title (≈0.3–3.4 s) → greeting → rules in one or two lines → first instruction anchored on the object → one-time hints when each secret or advanced mechanic first becomes possible. A pinch skips ahead.

**Copy:** imperative, one action per line, ≤ ~40 characters ("Pinch a glowing piece"). Explain each mechanic exactly once, when it becomes possible. One title line plus one sentence per caption.

## Fonts
Load with `<link>` plus `document.fonts.load()` and a 2.5 s timeout; fall back gracefully. Canvas2D shapes Indic and CJK scripts (uikit/troika don't). Use a readable sans (e.g. Mukta 600–700 for Devanagari) for body text and a display face for titles.

## Verify
Capture the view at each onboarding moment and inspect at full resolution: clipped edges, overlaps between any two text elements, text over a face or the work, legibility at the real distance.
