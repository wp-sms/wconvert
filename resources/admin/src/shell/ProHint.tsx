import { __, sprintf } from '@wordpress/i18n';
import { ArrowUpRight } from 'lucide-react';
import { OptionItem } from '../components/ui/option-menu';
import { tierProductName } from '../goals/availability';
import { interpolate } from '../lib/interpolate';
import { adminSettings } from '../settings';
import { PLUGINS_URL, proUrl, type ProMedium } from './HeaderTools';

/**
 * **Free names what Pro adds, where it would sit** (ADR 0147): one muted line
 * at the end of a list, from the approved prototype
 * (claude.ai/artifact/8QaXatDqmDbHk3AkWVfEqh, shape B).
 *
 * Text, never a control: no icon, no lock, no badge, nothing selectable. It
 * draws only where the server said so (`proHints`: a free install, a user who
 * can install plugins, the filter on), and names features from the data the
 * caller already has — so a feature that becomes free drops out of the line
 * without a copy edit.
 *
 * With Pro installed but inactive it says so and leads to Plugins instead.
 */
export function ProHint({ medium, features, className }: { medium: ProMedium; features: readonly string[]; className?: string }) {
  if (!proHintsShown() || features.length === 0) return null;
  const product = tierProductName('pro');
  const list = listOf(features);
  if (adminSettings()?.proInstalledInactive) {
    return <p className={classes(className)}>
      {interpolate(/* translators: 1: the product, e.g. “WConvert Pro”. 2: features, e.g. “Floating bar, Slide-in, Fullscreen”. 3: “Activate it”, a link to Plugins. */
        __('Also in %1$s, which is installed: %2$s. %3$s', 'wconvert'), [product, list,
          <a key="activate" href={PLUGINS_URL}>{__('Activate it', 'wconvert')}</a>])}
    </p>;
  }
  return <p className={classes(className)}>
    {interpolate(/* translators: 1: the product, linked, e.g. “WConvert Pro”. 2: features, e.g. “Floating bar, Slide-in, Fullscreen”. */
      __('Also in %1$s: %2$s.', 'wconvert'), [<ProLink key="pro" medium={medium}>{product}</ProLink>, list])}
  </p>;
}

/**
 * The hint as the last row of a ⋯ menu (ADR 0139's menu mode), where a line
 * that is not an item cannot be reached by keyboard. No feature icon, so it
 * cannot pass for the action it names.
 */
export function ProHintItem({ medium, features }: { medium: ProMedium; features: readonly string[] }) {
  if (!proHintsShown() || features.length === 0) return null;
  const inactive = adminSettings()?.proInstalledInactive === true;
  const name = inactive
    ? sprintf(/* translators: 1: the product. 2: features. */ __('Also in %1$s, which is installed: %2$s. Activate it', 'wconvert'), tierProductName('pro'), listOf(features))
    : sprintf(/* translators: 1: the product. 2: features, e.g. “A/B testing”. */ __('Also in %1$s: %2$s.', 'wconvert'), tierProductName('pro'), listOf(features));
  return <OptionItem className="wconvert-pro-hint-item" name={name} href={inactive ? PLUGINS_URL : proUrl(medium)} newTab={!inactive}
    trail={inactive ? undefined : <ArrowUpRight aria-hidden="true" className="rtl:-scale-x-100" />} />;
}

/** Whether this install and this user get the hints at all. Absent boot data reads as no. */
export const proHintsShown = (): boolean => adminSettings()?.proHints === true;

function ProLink({ medium, children }: { medium: ProMedium; children: string }) {
  return <a href={proUrl(medium)} target="_blank" rel="noopener noreferrer">
    {children}<ArrowUpRight aria-hidden="true" className="wconvert-pro-hint__arrow rtl:-scale-x-100" />
    <span className="sr-only">{__('(opens in a new tab)', 'wconvert')}</span>
  </a>;
}

const classes = (extra?: string) => extra ? `wconvert-pro-hint ${extra}` : 'wconvert-pro-hint';

/** Feature names joined the admin's way, comma-separated as the prototype shows. */
export function listOf(features: readonly string[]): string {
  try {
    return new Intl.ListFormat(document.documentElement.lang || undefined, { style: 'long', type: 'unit' }).format(features);
  } catch {
    return features.join(', ');
  }
}
