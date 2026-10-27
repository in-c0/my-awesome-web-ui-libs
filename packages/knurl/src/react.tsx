import { make } from "./react/make";
import {
  toggle, rocker, fader, caliper, knob, joystick, keycap, counter, combo, tray, presets, selector, gauge, tank, track, timer, annunciator, gears,
  type ToggleOptions, type RockerOptions, type FaderOptions, type CaliperOptions, type KnobOptions, type JoystickOptions, type KeycapOptions, type CounterOptions, type ComboOptions, type TrayOptions, type PresetsOptions, type SelectorOptions, type GaugeOptions, type TankOptions, type TrackOptions, type TimerOptions, type AnnunciatorOptions, type GearsOptions,
} from "./index";

/** knurl-ui/react — the controls as React components. */
export type { KnurlDivProps } from "./react/make";

/** A switch, built as a bat-handle toggle on a panel, with a lamp that lights when it is on. */
export const Toggle = make<ToggleOptions>("Toggle", toggle);
/** A checkbox, built as a panel-mount rocker switch with a lit window and a centre-off position for mixed. */
export const Rocker = make<RockerOptions>("Rocker", rocker);
/** A slider, built as a mixing-desk fader whose cap rides a lit slot over a ruler of its steps. */
export const Fader = make<FaderOptions>("Fader", fader);
/** A range slider, built as a vernier caliper whose two jaws mark the ends of the range. */
export const Caliper = make<CaliperOptions>("Caliper", caliper);
/** A rotary value, built as a knurled knob over a 270° scale. Drag up or down, scroll, or use the arrow keys. */
export const Knob = make<KnobOptions>("Knob", knob);
/** A 2D input, built as an arcade joystick that springs back to centre. */
export const Joystick = make<JoystickOptions>("Joystick", joystick);
/** A button, built as one mechanical key in a plate. It travels down when pressed and fires on release. */
export const Keycap = make<KeycapOptions>("Keycap", keycap);
/** A number field, built as a tally counter whose drums roll like an odometer. */
export const Counter = make<CounterOptions>("Counter", counter);
/** A one-time-code input, built as a combination padlock that opens on the right digits. */
export const Combo = make<ComboOptions>("Combo", combo);
/** A file drop zone, built as a desk letter tray that stacks a sheet for every file. */
export const Tray = make<TrayOptions>("Tray", tray);
/** A radio group, built as a bank of latching preset keys: pressing one throws the last one back up. */
export const Presets = make<PresetsOptions>("Presets", presets);
/** A select, built as a rotary selector switch with a chicken-head knob and engraved positions. */
export const Selector = make<SelectorOptions>("Selector", selector);
/** A progress bar or meter, built as a dial gauge with a damped needle and a tell-tale hand. */
export const Gauge = make<GaugeOptions>("Gauge", gauge);
/** A level meter, built as a storage tank whose sight glass shows the level. */
export const Tank = make<TankOptions>("Tank", tank);
/** A step progress indicator, built as a rail line where a handcar rolls from station to station. */
export const Track = make<TrackOptions>("Track", track);
/** A countdown, built as a wind-up kitchen timer whose bell shakes when time runs out. */
export const Timer = make<TimerOptions>("Timer", timer);
/** A status panel, built as an annunciator of labelled lamps that light, warn and blink. */
export const Annunciator = make<AnnunciatorOptions>("Annunciator", annunciator);
/** A loading indicator, built as a gear train that turns at its true ratios. */
export const Gears = make<GearsOptions>("Gears", gears);

export type {
  ToggleOptions, RockerOptions, FaderOptions, CaliperOptions, KnobOptions, JoystickOptions, KeycapOptions, CounterOptions, ComboOptions, TrayOptions, PresetsOptions, SelectorOptions, GaugeOptions, TankOptions, TrackOptions, TimerOptions, AnnunciatorOptions, GearsOptions,
};
