import { emit, nativeInput, num, snap, type BaseOptions, type EngineContext } from "./control";

/** Options every value control takes (Fader, Knob, Counter). */
export type RangeOptions = BaseOptions & {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  /** Called with the new value on every change, by pointer, wheel or keyboard. */
  onValueChange?: (value: number) => void;
  /** Called once when a drag or key press settles. */
  onValueCommit?: (value: number) => void;
  /** Formats `aria-valuetext`, e.g. (v) => `${v} dB`. */
  format?: (value: number) => string;
  /** Set by the React wrapper when `value` is controlled. */
  controlled?: boolean;
};

export const RANGE_KEYS = ["value", "defaultValue", "min", "max", "step", "onValueChange", "onValueCommit", "format", "controlled"] as const;

export type Range = {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** 0…1 position of the value. */
  readonly t: number;
  input: HTMLInputElement;
  /** A request from the pointer or wheel; snapped, clamped, emitted. */
  ask(v: number): void;
  commit(): void;
  /** Applies new options; returns whether the value moved. */
  update(o: RangeOptions): boolean;
  destroy(): void;
};

/**
 * The value side of a range control, on a visually hidden native input of
 * `type` ("range" or "number"), so arrows, Page Up/Down, Home/End, screen
 * readers and form submission are the platform's own.
 */
export function range(ctx: EngineContext, o: RangeOptions, type: "range" | "number", label: string, onMove: () => void): Range {
  let opts = o;
  const lim = () => {
    const min = num(opts.min, 0), max = num(opts.max, 100);
    return { min: Math.min(min, max), max: Math.max(min, max), step: num(opts.step, 1) };
  };
  let { min, max, step } = lim();
  let value = snap(num(opts.value ?? opts.defaultValue, min), min, max, step);
  const input = nativeInput(ctx, { type });

  const sync = () => {
    input.min = String(min); input.max = String(max); input.step = String(step || "any");
    input.value = String(value);
    input.disabled = !!opts.disabled;
    input.setAttribute("aria-label", opts.label ?? label);
    if (opts.format) input.setAttribute("aria-valuetext", opts.format(value)); else input.removeAttribute("aria-valuetext");
    if (opts.name) input.name = opts.name; else input.removeAttribute("name");
  };
  sync();

  const ask = (v: number) => {
    const next = snap(v, min, max, step);
    if (next === value) { input.value = String(value); return; }
    if (opts.controlled) { input.value = String(value); emit(opts.onValueChange, next); return; }
    value = next; sync(); onMove(); emit(opts.onValueChange, next);
  };
  const onInput = () => ask(Number(input.value));
  const onChange = () => emit(opts.onValueCommit, value);
  input.addEventListener("input", onInput);
  input.addEventListener("change", onChange);

  return {
    get value() { return value; },
    get min() { return min; },
    get max() { return max; },
    get step() { return step; },
    get t() { return max > min ? (value - min) / (max - min) : 0; },
    input,
    ask,
    commit: onChange,
    update(next) {
      opts = next;
      ({ min, max, step } = lim());
      const want = snap(num(next.value, value), min, max, step);
      const moved = want !== value;
      value = want;
      sync();
      return moved;
    },
    destroy() {
      input.removeEventListener("input", onInput);
      input.removeEventListener("change", onChange);
      input.remove();
    },
  };
}
