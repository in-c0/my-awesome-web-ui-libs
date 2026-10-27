# Changelog

## 0.2.2

- The readouts answer a tap: the Gauge's needle jogs and settles back, the Tank's level sloshes away from the knock, a read-only Track's handcar rocks and rolls back to its station, and the Gears spin up and coast. None of them takes focus or changes its value.
- Site: every preview plays itself while nobody is using it, and stops the moment a pointer, focus or key reaches it (again 3 s after it leaves). Nothing plays offscreen, in a background tab or under reduced motion.

## 0.2.1

- Every input answers a plain click, not only a drag: a click on the Knob's scale turns it to that mark, a click on the Selector's knob turns it one detent, a click on the Counter's housing counts one, a click on a Combo wheel rolls it on by one, a press on the Annunciator's lamps runs the lamp test, and a Rocker click always throws the switch (the half already down toggles it).
- The frame loop survives an environment that disappears under a pending frame.

## 0.2.0

- Published as `@in-c0/knurl` (0.1.0 was never published as `knurl-ui`), from the `in-c0/my-awesome-web-ui-libs` workspace.
- Ten new controls: Rocker (checkbox), Caliper (range slider), Joystick (2D input), Combo (one-time code), Tray (file drop zone), Selector (select), Timer (countdown), Tank (level meter), Track (step progress) and Annunciator (status panel).
- Three examples on the site: Mono synth, Release console and Intake desk.
- Core: tilted convex solids (`poly3`, `cuboid`, `prism3`, `rot`); each control declares its option keys, so the React wrapper needs no per-control code.
- Gauge and Gears put back the host's own role and ARIA attributes on destroy.

## 0.1.0

- First release: Toggle, Fader, Knob, Keycap, Presets, Counter, Gauge and Gears, for React (`@in-c0/knurl/react`) and any DOM (`@in-c0/knurl`).
- Line and solid finishes from one geometry; light and dark themes; `--knurl-*` tokens.
- shadcn registry items for every control, served from the docs site at `/r`.
