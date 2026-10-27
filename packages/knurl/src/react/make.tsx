"use client";
import {
  forwardRef, useCallback, useEffect, useLayoutEffect, useRef,
  type ComponentPropsWithoutRef, type CSSProperties, type ForwardRefExoticComponent, type RefAttributes,
} from "react";
import type { Control, Mount } from "../core/control";

/**
 * Knurl — the one React wrapper every control shares.
 *
 * A component renders one `<div>` and mounts its control in a layout effect,
 * so on the server the box is there (at its aspect ratio) and the drawing is
 * not. It mounts once; changed props reach the running control as `update`,
 * and function props are read through refs, so an inline callback never
 * remounts it. The control's own `keys` say which props are options; every
 * other prop is an attribute of the `<div>`. Pass `value`/`checked` to
 * control it, or `defaultValue`/`defaultChecked`.
 */

export type KnurlDivProps = Omit<ComponentPropsWithoutRef<"div">, "children" | "defaultValue" | "onChange" | "role">;

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function make<O extends object>(name: string, mount: Mount<O>) {
  type Props = O & KnurlDivProps;
  const known = new Set(mount.keys);
  const C = forwardRef<HTMLDivElement, Props>(function Knurl(props, ref) {
    const all = props as Record<string, unknown>;
    const opts: Record<string, unknown> = {}, attrs: Record<string, unknown> = {};
    for (const k in all) (known.has(k) ? opts : attrs)[k] = all[k];

    // function props go through a ref: the running control always calls the latest one
    const fns = useRef<Record<string, unknown>>({});
    useIso(() => { for (const k in opts) if (typeof opts[k] === "function") fns.current[k] = opts[k]; });
    const data: Record<string, unknown> = {};
    for (const k in opts) data[k] = typeof opts[k] === "function" ? (...a: unknown[]) => (fns.current[k] as (...a: unknown[]) => unknown)?.(...a) : opts[k];
    if (mount.controlKey) data.controlled = opts[mount.controlKey] !== undefined;

    const el = useRef<HTMLDivElement | null>(null);
    const ctl = useRef<Control<O> | null>(null);
    const setRef = useCallback((node: HTMLDivElement | null) => {
      el.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    }, [ref]);

    useIso(() => {
      const c = mount(el.current!, data as O);
      ctl.current = c;
      return () => { c.destroy(); ctl.current = null; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // re-sent when a non-function option changes; a key that disappeared is sent as undefined so it resets
    const key = JSON.stringify(mount.keys.map((k) => (typeof opts[k] === "function" ? "ƒ" : opts[k] ?? null)));
    useIso(() => {
      const next: Record<string, unknown> = {};
      for (const k of mount.keys) next[k] = data[k];
      ctl.current?.update(next as O);
    }, [key]);

    const style = attrs.style as CSSProperties | undefined;
    return <div {...(attrs as KnurlDivProps)} ref={setRef} style={{ aspectRatio: mount.ratio, ...style }} />;
  });
  C.displayName = name;
  return C as unknown as ForwardRefExoticComponent<Props & RefAttributes<HTMLDivElement>>;
}
