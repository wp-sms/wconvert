import { __ } from '@wordpress/i18n';
import type { GoogleFont, Template } from '@renderer/types';
import { usedGoogleFonts } from '@renderer/fonts';

/** A small local list; opening the picker does not contact Google. */
export const GOOGLE_FONTS = [
  ['Creepster', 'cursive', [400]], ['Nosifer', 'cursive', [400]], ['Eater', 'cursive', [400]],
  ['Bebas Neue', 'sans-serif', [400]], ['Archivo Black', 'sans-serif', [400]],
  ['Inter', 'sans-serif', [400, 600, 700]], ['Geist', 'sans-serif', [400, 600, 700]],
  ['DM Sans', 'sans-serif', [400, 600, 700]], ['Poppins', 'sans-serif', [400, 600, 700]],
  ['Montserrat', 'sans-serif', [400, 600, 700]], ['Open Sans', 'sans-serif', [400, 600, 700]],
  ['Roboto', 'sans-serif', [400, 600, 700]], ['Lato', 'sans-serif', [400, 700]],
  ['Playfair Display', 'serif', [400, 700]], ['Instrument Serif', 'serif', [400]],
  ['Cormorant Garamond', 'serif', [400, 600, 700]], ['Merriweather', 'serif', [400, 700]],
] as const;

export function withGoogleFont(template: Template, font?: GoogleFont): Template {
  if (!font && !template.tree.fonts?.length) return template;
  const fonts = [...(template.tree.fonts ?? []).filter(item => item.family !== font?.family), ...(font ? [font] : [])];
  const next = { ...template, tree: { ...template.tree, fonts } };
  const used = usedGoogleFonts(next);
  if (used.length > 4) throw new Error(__('A design can use up to four Google font families. Reuse one already selected, or install the additional font in WordPress.', 'wconvert'));
  if (used.length) return { ...next, tree: { ...next.tree, fonts: used } };
  const tree = { ...template.tree };
  delete tree.fonts;
  return { ...next, tree };
}
