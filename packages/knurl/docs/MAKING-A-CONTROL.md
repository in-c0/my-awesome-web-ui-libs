# Making a control

How every Knurl control is built. Read one finished control first — `src/controls/toggle.ts` is the shortest, `fader.ts` the reference for a value control, `presets.ts` for a group of native inputs.

## The one idea

The object is the explanation (Anatomy). Pick a real, recognisable machine whose working *is* the control's job: a switch is a bat-handle toggle, a progress bar is a dial gauge. Then build it from many small, true parts: a panel on screws, a bushing and nut, a ruler of the actual steps, a lamp. Detail comes from parts that belong to the mechanism, never from texture or noise. Every line ends on something.

Too abstract (labelled boxes, floating slabs) or too bland (one plain slab with a few lines) are the two ways it fails.

## The file

One file, `src/controls/<id>.ts`, exporting `<id>` (the mount function from `define`) and `<Name>Options`.

```ts
export const thing = define<ThingOptions>({
  id: "thing", label: "English default name",
  vw: 200, vh: 150,          // viewBox; the control keeps this aspect ratio
  width: 140,                // default CSS width when the host has none
  keys: [...],               // every option name beyond BaseOptions (callbacks too)
  controlKey: "value",       // the prop that makes it controlled in React, if any
  mount(ctx, o) { … return { update(next, prev) {…}, destroy: bag.dispose }; },
});
```

## Rules

- **Semantics are native.** Put a visually hidden native element under the drawing (`nativeInput(ctx, …)`, a `<button>`, radios in a `role="radiogroup"` div) or set an ARIA role on the host. Keyboard, screen readers and forms then work as the platform's own. Give everything an accessible name from `opts.label`.
- **Controlled pattern.** Keep the value in the engine. When the user asks for a change: if `opts.controlled`, reset the native element to the current value and only `emit(onChange, next)`; otherwise set it, redraw, then emit. `update(next)` applies a new `value` from outside.
- **Pointer.** Listen on the host. Hit-test in world units (`unproj`, or the projected shape of a part), never in pixels. Use `setPointerCapture` for drags and focus the native element on press (`el.focus({ preventScroll: true })`). The wrapper already stops a press from moving focus to `<body>`.
- **Motion.** All motion goes through the one loop: `const B = register(host, (dt, now) => { …; return stillMoving; })`; `B.wake()` after input. Use `spring()` / `stepS()` for anything that follows a target (a snap is k≈400 c≈16; a calm follow k≈200 c≈26; a damped needle k≈90 c≈7.5) and tweens for discrete changes. Declare every piece of state the tick reads *before* `register` (it ticks once immediately). Under reduced motion springs land in one step on their own.
- **Drawing.** Build static parts once; rebuild only what moves. Paint back to front: base, things on the base, then parts nearer the viewer. Use the core solids:
  - `slab`, `cyl`, `loft` (tapered), `rrect`/`circle` rings, `flat` (a ring as a path on a plane);
  - `poly3` with `cuboid` / `prism3` and `rot`/`compose` for anything tilted or turned (a rocker paddle, a lever);
  - `bar` for round rods between two points;
  - `radialTicks`, `rulerX`, `seg`, `planeMatrix` (text or marks on any plane).
  Put each solid in the DOM with `solid(parent).put(paths)`; `.lit(true)` marks the one lit part.
- **Two finishes, one geometry.** Never branch on `finish` in code: `line` and `solid` differ only by CSS. Check both.
- **Colour.** Only the theme tokens, through classes: `k-line` + `hi | edge | mid | lo | accent`, `k-slot` (a cut or recess), `k-face` (a flat face like a dial), `k-led` (+`.on`), `k-glow` (+`.on`), `k-dot`, `k-text` (+`hi`). The accent is the one lit thing (a lamp, a lit index, a red zone), never decoration.
- **Text.** At most short engraved legends (a digit, I/O, a 2–3 letter label) via `<text class="k-text">` placed with `planeMatrix`. Everything else belongs in the page, not the drawing.
- **Clean up.** `destroy` removes everything the control added (native elements, attributes it set on the host, svg children) so the host is left as it was.

## Verify

Render it large in all four themes and finishes and read the PNG:

```sh
W=420 node bench/shot.mjs thing shots/thing.png 1.5 '{"thing":[{},{"value":70}]}'
ROWS='[["light","line"]]' W=700 node bench/shot.mjs thing shots/thing-big.png 1
```

Look at it as a critic would at 4×: is it instantly a real object? Does every line end on a part? Are parts drawn in the right depth order in every state it moves through? Is there a bare face or empty corner? Then drive it in a browser (pointer and keyboard) and run `pnpm test`.
