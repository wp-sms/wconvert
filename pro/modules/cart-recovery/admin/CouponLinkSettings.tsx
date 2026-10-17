import { useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
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

/** What the store says about a code against the campaign's end (#287). */
export interface CouponExpiry {
  verdict: 'ok' | 'outlives' | 'no_expiry' | 'unknown';
  /** The coupon's expiry date, in the site's date format, or null. */
  expires: string | null;
  /** The campaign's end, in the site's date and time format, or null. */
  ends: string | null;
}

/** The sentence for a code that keeps working after the campaign, or null. */
export function expiryWarning(code: string, expiry: CouponExpiry | null): string | null {
  if (!expiry || !expiry.ends) return null;
  if (expiry.verdict === 'outlives' && expiry.expires) {
    /* translators: 1: a coupon code, 2: the date it expires, 3: the date and time the campaign ends. */
    return sprintf(__('%1$s stays valid until %2$s, after this campaign ends on %3$s.', 'wconvert'), code, expiry.expires, expiry.ends);
  }
  if (expiry.verdict === 'no_expiry') {
    /* translators: 1: a coupon code, 2: the date and time the campaign ends. */
    return sprintf(__('%1$s never expires, so it keeps working after this campaign ends on %2$s.', 'wconvert'), code, expiry.ends);
  }
  return null;
}

/** Ask the store, after a pause in typing, and only while the campaign has an end. */
function useCouponExpiry(code: string, endsAt: string | undefined): CouponExpiry | null {
  const [expiry, setExpiry] = useState<CouponExpiry | null>(null);
  useEffect(() => {
    setExpiry(null);
    if (code === '' || !endsAt) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({ code, ends_at: endsAt });
      apiFetch<CouponExpiry>({ path: `/wconvert/v1/coupon-expiry?${query}`, signal: controller.signal })
        .then(setExpiry)
        // A warning that cannot be checked is not shown; the panel still works.
        .catch(() => undefined);
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [code, endsAt]);
  return expiry;
}

export default function CouponLinkSettings({ code, href, endsAt, onChange }: CodeLinkProps) {
  if (!commerceSupported()) return null;
  return <CouponLinkControls code={code} href={href} endsAt={endsAt} onChange={onChange} />;
}

function CouponLinkControls({ code, href, endsAt, onChange }: CodeLinkProps) {
  const warning = expiryWarning(code.trim(), useCouponExpiry(code.trim(), endsAt));
  const applies = couponOf(href);
  const stale = applies !== null && applies.toLowerCase() !== code.trim().toLowerCase();
  return <>
    <Button type="button" variant="outline" className="justify-self-start" disabled={code.trim() === '' || href === couponHref(code)} onClick={() => onChange(couponHref(code))}>
      {__('Apply in WooCommerce', 'wconvert')}
    </Button>
    {warning && <PanelHint>{warning}</PanelHint>}
    {stale && <PanelHint>{sprintf(/* translators: 1: the coupon code the link applies, 2: the code the block shows. */ __('This link applies %1$s, but the block shows %2$s. Press Apply in WooCommerce to match them.', 'wconvert'), applies, code.trim())}</PanelHint>}
  </>;
}
