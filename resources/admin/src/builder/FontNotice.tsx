import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { firstFamily, usedGoogleFonts } from '@renderer/fonts';
import type { Template } from '@renderer/types';
import { getThemeTokens } from './api';
import { PanelHint } from './PanelSection';

export function FontNotice({ template }: { template: Template }) {
  const [site, setSite] = useState<Awaited<ReturnType<typeof getThemeTokens>> | null>(null);
  const required = usedGoogleFonts(template).map(font => font.family).join(', ');
  useEffect(() => {
    if (!required) return;
    let active = true;
    getThemeTokens().then(value => { if (active) setSite(value); }).catch(() => {});
    return () => { active = false; };
  }, [required]);
  if (!required || !site || site.google_fonts_enabled) return null;
  const installed = (site.fonts ?? []).map(font => firstFamily(font.stack));
  const missing = usedGoogleFonts(template).filter(font => !installed.includes(font.family.toLowerCase()));
  if (!missing.length) return null;
  return <PanelHint>
    {sprintf(
      /* translators: %s: comma-separated font family names, e.g. "DM Sans, Archivo Black". */
      _n('This design uses %s. A substitute font is shown until you install it or enable Google Fonts.', 'This design uses %s. Substitute fonts are shown until you install them or enable Google Fonts.', missing.length, 'wconvert'),
      missing.map(font => font.family).join(', '),
    )}{' '}
    <a href={site.font_library_url ?? 'https://wordpress.org/documentation/article/the-font-library/'} target="_blank" rel="noreferrer">{__('Install fonts', 'wconvert')}</a>{' · '}
    <a href="#settings?group=data">{__('Google Fonts settings', 'wconvert')}</a>
  </PanelHint>;
}
