import type { GoogleFont, Template } from './types';

export const firstFamily = (stack: string): string => stack.split(',')[0].trim().replace(/^['"]|['"]$/g, '').toLowerCase();

/** Explicit requirements only. A manually typed font stack never authorizes a Google request. */
export function usedGoogleFonts(template: Template): readonly GoogleFont[] {
  const used = new Set<string>();
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'font' || key === 'heading-font') && typeof child === 'string') used.add(firstFamily(child));
      else if (key !== 'fonts') walk(child);
    }
  };
  walk(template);
  return (template.tree.fonts ?? []).filter(font => used.has(font.family.toLowerCase()));
}

/** Document-level faces work inside shadow roots; render() itself never fetches. */
export function loadGoogleFonts(template: Template, allowed: boolean, siteFamilies: readonly string[] = []): void {
  loadFontFaces(usedGoogleFonts(template), allowed, siteFamilies);
}

export function loadFontFaces(fonts: readonly GoogleFont[], allowed: boolean, siteFamilies: readonly string[] = []): void {
  if (!allowed) return;
  for (const font of fonts.slice(0, 4)) {
    if (!/^[A-Za-z][A-Za-z0-9 ]{0,79}$/.test(font.family) || siteFamilies.includes(font.family.toLowerCase())) continue;
    const faces = [...new Set(font.faces.slice(0, 12)
      .filter(v => Number.isInteger(v.weight) && v.weight >= 100 && v.weight <= 900)
      .map(v => `${v.italic === true ? 1 : 0},${v.weight}`))].sort();
    if (!faces.length) continue;
    const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family)}:ital,wght@${faces.join(';')}&display=swap`;
    if ([...document.querySelectorAll<HTMLLinkElement>('link[data-wc-font]')].some(link => link.href === href)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; link.dataset.wcFont = font.family;
    // Failed fonts keep the authored fallback. A later appearance can retry.
    link.addEventListener('error', () => link.remove(), { once: true });
    document.head.append(link);
  }
}
