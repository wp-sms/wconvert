import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * **The fourteen type roles, taught to `tailwind-merge`.**
 *
 * `twMerge` decides whether `text-…` is a SIZE or a COLOUR from a list of
 * Tailwind's own scale names, and anything it does not recognise it assumes is
 * a colour. So `cn('text-note', 'text-muted-foreground')` dropped the size —
 * two "colours", later wins — and every {@see Description} in the admin
 * silently rendered at body size again. Found by a test asserting the class,
 * which is the only thing in this suite that can see it: Vitest runs jsdom with
 * `css: false` and computes no font size at all.
 *
 * Naming them here rather than reaching for `!` or reordering the arguments,
 * because the scale is a real font-size scale and this is where the merge is
 * told what the scale is. A seventh role added to `index.css` is added here in
 * the same commit or it is a class that quietly stops applying. It had six of
 * fourteen until ADR 0131, so `cn('text-label', 'text-muted-foreground')` kept
 * the colour and dropped the size on every builder caption that went through it.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'note', 'body', 'heading', 'section', 'metric', 'title', 'display', 'brand', 'item', 'result', 'figure', 'label', 'meta'] }],
    },
  },
});

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
