/**
 * Knurl — UI controls machined as isometric instruments.
 * Each export mounts a control on an element: `toggle(el, { checked: true })`.
 */
export { toggle, type ToggleOptions } from "./controls/toggle";
export { rocker, type RockerOptions } from "./controls/rocker";
export { fader, type FaderOptions } from "./controls/fader";
export { caliper, type CaliperOptions } from "./controls/caliper";
export { knob, type KnobOptions } from "./controls/knob";
export { joystick, type JoystickOptions } from "./controls/joystick";
export { keycap, type KeycapOptions } from "./controls/keycap";
export { counter, type CounterOptions } from "./controls/counter";
export { combo, type ComboOptions } from "./controls/combo";
export { tray, type TrayOptions } from "./controls/tray";
export { presets, type PresetsOptions } from "./controls/presets";
export { selector, type SelectorOptions } from "./controls/selector";
export { gauge, type GaugeOptions } from "./controls/gauge";
export { tank, type TankOptions } from "./controls/tank";
export { track, type TrackOptions } from "./controls/track";
export { timer, type TimerOptions } from "./controls/timer";
export { annunciator, type AnnunciatorOptions } from "./controls/annunciator";
export { gears, type GearsOptions } from "./controls/gears";
export type { BaseOptions, Control, Finish, Mount, Theme } from "./core/control";
export type { RangeOptions } from "./core/range";
