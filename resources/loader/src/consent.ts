import type { ConsentCategory, LoaderModule } from './types';

/**
 * Storage Consent, read through the WP Consent API.
 *
 * Its five categories are adopted VERBATIM rather than mapped onto names of
 * our own, because a mapping table is a second hand-maintained list and this
 * design has refused one four times (CONTEXT.md, Storage Consent).
 *
 * **The plugin is never bundled or required, and its absence fails open.**
 * `wp_has_consent` is then undefined, and a site that has made no consent
 * determination has none for WConvert to honour — so the install behaves
 * exactly as it did before.
 *
 * **Dismissal storage is not asked about here.** It is `functional` and never
 * withheld: it records a choice the visitor made by clicking the close button,
 * and withholding it means the popup reappears after they closed it. The
 * prototype's single gate covered all storage including dismissal, which is
 * exactly that bug, and issue #11 overturned it.
 */

declare global {
  interface Window {
    wp_has_consent?: (category: string) => boolean;
  }
}

/**
 * Has the visitor consented to storage in this category?
 *
 * Fails open in both directions that matter: no consent plugin, and a plugin
 * that throws.
 */
export function hasConsent(category: ConsentCategory): boolean {
  try {
    return typeof window.wp_has_consent !== 'function' || window.wp_has_consent(category) !== false;
  } catch {
    return true;
  }
}

/**
 * Rule types this visitor has withheld the storage consent for.
 *
 * An Optin holding one is not evaluated rather than evaluated-as-false, so it
 * can still fire later in the same page view when consent arrives (issue #11)
 * — which is what {@link listenForConsentChange} is for.
 */
export function withheldTypes(modules: readonly LoaderModule[]): ReadonlySet<string> {
  const withheld = new Set<string>();

  for (const module of modules) {
    if (module.consentCategory !== null && !hasConsent(module.consentCategory)) {
      withheld.add(module.id);
    }
  }

  return withheld;
}

/**
 * Re-ask when the visitor answers the banner.
 *
 * The WP Consent API dispatches `wp_listen_for_consent_change` on the document.
 * Listening unconditionally: the event simply never fires where no plugin
 * dispatches it, and testing for the API first would be a second thing to keep
 * in step with it.
 */
export function onConsentChange(changed: () => void): () => void {
  document.addEventListener('wp_listen_for_consent_change', changed);

  return () => document.removeEventListener('wp_listen_for_consent_change', changed);
}
