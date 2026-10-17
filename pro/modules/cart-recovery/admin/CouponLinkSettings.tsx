import { __, sprintf } from '@wordpress/i18n';
import type { CodeLinkProps } from '@/codeLinkControls';
import { Button } from '@/components/ui/button';
import { PanelHint } from '@/builder/PanelSection';
import { commerceSupported } from '@/settings';

/**
 * The code's link that applies it in WooCommerce (ADR 0152).
 *
 * `?coupon=<code>` is relative, so it applies the coupon on the page the
 * visitor is on and lands them back there without the parameter. It replaces
 * that page's own query string, which ADR 0152 records. The server
 * applies only a code a published campaign shows, which is what makes this
 * address safe to share.
 */
export const couponHref = (code: string): string => `?coupon=${encodeURIComponent(code.trim())}`;

/** The code a `?coupon=` address applies, or null where it is not one. */
export function couponOf(href: string): string | null {
  try {
    const url = new URL(href, 'https://x.invalid/');
    return url.searchParams.get('coupon');
  } catch {
    return null;
  }
}

export default function CouponLinkSettings({ code, href, onChange }: CodeLinkProps) {
  if (!commerceSupported()) return null;
  const applies = couponOf(href);
  const stale = applies !== null && applies.toLowerCase() !== code.trim().toLowerCase();
  return <>
    <Button type="button" variant="outline" className="justify-self-start" disabled={code.trim() === '' || href === couponHref(code)} onClick={() => onChange(couponHref(code))}>
      {__('Apply in WooCommerce', 'wconvert')}
    </Button>
    {stale && <PanelHint>{sprintf(/* translators: 1: the coupon code the link applies, 2: the code the block shows. */ __('This link applies %1$s, but the block shows %2$s. Press Apply in WooCommerce to match them.', 'wconvert'), applies, code.trim())}</PanelHint>}
  </>;
}
