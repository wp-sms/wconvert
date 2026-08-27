import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Join class names, letting the later one win where two set the same property.
 *
 * Vendored from shadcn along with the components that import it (ADR 0036).
 * `clsx` flattens the conditionals; `tailwind-merge` is what makes a variant's
 * `px-4` beatable by a caller's `px-2` — without it the two both land and the
 * cascade decides by source order, which is whatever the bundler chose.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
