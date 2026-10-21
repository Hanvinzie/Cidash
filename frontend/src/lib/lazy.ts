import { createElement, lazy } from 'react';
import type { ComponentProps, ComponentType } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;

export type PreloadableComponent<T extends AnyComponent> = ComponentType<ComponentProps<T>> & {
  preload: () => Promise<unknown>;
};

/**
 * Seperti React.lazy, plus `preload()`. Setelah chunk ter-preload, komponen asli dirender
 * langsung (sinkron) — React.lazy biasa tetap "suspend" sekali walau modulnya sudah ada,
 * yang membuat fallback loading berkedip saat pindah tab.
 */
export function lazyWithPreload<T extends AnyComponent>(load: () => Promise<{ default: T }>): PreloadableComponent<T> {
  let loaded: T | null = null;
  let promise: Promise<{ default: T }> | null = null;
  const once = () =>
    (promise ??= load().then((m) => {
      loaded = m.default;
      return m;
    }));
  const Lazy = lazy(once);

  const Component = ((props: ComponentProps<T>) =>
    createElement(loaded ?? Lazy, props)) as PreloadableComponent<T>;
  Component.preload = once;
  return Component;
}

/** Jalankan tugas ringan saat browser idle (fallback setTimeout untuk Safari). */
export function whenIdle(task: () => void, timeout = 1500) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(task, { timeout });
  else setTimeout(task, 300);
}
