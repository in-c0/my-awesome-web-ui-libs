# Changelog

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
