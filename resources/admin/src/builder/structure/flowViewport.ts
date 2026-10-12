import type { Rect } from './flowLayout';

/** The Flow map's camera (ADR 0142): Fit, zoom about a point, and keeping the selection in view. */

export const MIN_FIT = 0.7;
export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 1.5;

/** The whole map at up to 100%; below 70% the map scrolls instead of shrinking further. */
export function fitZoom(view: { width: number; height: number }, content: { width: number; height: number }): number {
  if (view.width <= 0 || view.height <= 0 || content.width <= 0 || content.height <= 0) return 1;
  return Math.max(MIN_FIT, Math.min(1, Math.floor(Math.min(view.width / content.width, view.height / content.height) * 100) / 100));
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 100) / 100));
}

/** − and + move in tenths, landing on one. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const tenths = direction > 0 ? Math.floor(zoom * 10 + 1e-6) + 1 : Math.ceil(zoom * 10 - 1e-6) - 1;
  return clampZoom(tenths / 10);
}

/** The scroll that keeps the map point under `anchor` (a point in the viewport) still while zooming. */
export function zoomAt(scroll: { left: number; top: number }, anchor: { x: number; y: number }, from: number, to: number): { left: number; top: number } {
  const ratio = to / from;
  return { left: (scroll.left + anchor.x) * ratio - anchor.x, top: (scroll.top + anchor.y) * ratio - anchor.y };
}

/**
 * The least scroll that shows the selected card, and the screen after it too
 * when both fit (the rule `mapCamera` had). `null` when it is in view already.
 */
export function revealScroll(view: { left: number; top: number; width: number; height: number }, zoom: number, [selected, next]: readonly Rect[], margin = 24): { left: number; top: number } | null {
  if (!selected) return null;
  const scaled = (rect: Rect) => ({ left: rect.x * zoom, top: rect.y * zoom, right: (rect.x + rect.width) * zoom, bottom: (rect.y + rect.height) * zoom });
  const one = scaled(selected);
  const both = next ? scaled(next) : undefined;
  const union = both ? { left: Math.min(one.left, both.left), top: Math.min(one.top, both.top), right: Math.max(one.right, both.right), bottom: Math.max(one.bottom, both.bottom) } : one;
  const fits = union.right - union.left + 2 * margin <= view.width && union.bottom - union.top + 2 * margin <= view.height;
  const target = fits ? union : one;
  const axis = (start: number, end: number, from: number, size: number) =>
    start - margin < from ? Math.max(0, start - margin) : end + margin > from + size ? end + margin - size : from;
  const left = axis(target.left, target.right, view.left, view.width);
  const top = axis(target.top, target.bottom, view.top, view.height);
  return left === view.left && top === view.top ? null : { left, top };
}
