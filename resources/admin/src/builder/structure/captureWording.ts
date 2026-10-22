import { __ } from '@wordpress/i18n';
import { adminSettings } from '../../settings';

export type ContactChannel = 'email' | 'phone';

/**
 * The default words for a contact field and its consent, one place for every
 * way a signup is added: the form switch (ADR 0163) and an optional second
 * signup. Merchant edits are never regenerated from here; only new nodes are.
 */
export function contactWording(channel: ContactChannel) {
  return channel === 'email' ? {
    label: __('Email address', 'wconvert'),
    placeholder: __('you@example.com', 'wconvert'),
    consent: __('Email me offers and news. Unsubscribe any time. %s', 'wconvert'),
    optionalConsent: __('Send me email updates. %s', 'wconvert'),
  } : {
    label: __('Phone number', 'wconvert'),
    placeholder: __('+44 7700 900000', 'wconvert'),
    consent: __('Text me offers and news. Reply STOP to opt out. %s', 'wconvert'),
    optionalConsent: __('Send me text updates. %s', 'wconvert'),
  };
}

/** The privacy link a consent sentence carries; the renderer resolves its address (ADR 0032). */
export const privacyLink = () => ({ label: __('Privacy Policy', 'wconvert') });

/** The "Shop now" button a form leaves behind for an offer: the shop page, or the home page without WooCommerce. */
export function shopNowLink(): { readonly label: string; readonly href: string } | undefined {
  const link = adminSettings()?.offerLink;
  return link ? { label: __('Shop now', 'wconvert'), href: link.href } : undefined;
}
