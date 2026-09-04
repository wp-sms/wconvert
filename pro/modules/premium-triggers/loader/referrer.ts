import type { LoaderModule } from '@loader/types';

/**
 * `referrer` — where the visit came from, as the merchant thinks of it.
 *
 * The Condition beside `query_param`, answering the question that one cannot.
 * `query_param` reads a UTM tag the merchant put there themselves, so it only
 * ever describes traffic they already tagged; this covers everything they did
 * not — organic search, an unexpected link, a forum post — which is most of it.
 *
 * =============================================================================
 * THIS SEES ONE HOP. IT IS NOT A SOURCE, AND IT IS NOT A SESSION.
 * =============================================================================
 * `document.referrer` is the page the browser was on immediately before this
 * one. It is absent on a direct visit, absent where a referrer policy strips
 * it, and it is never a history. The obvious next feature — a FIRST-TOUCH
 * source, *"they originally arrived from Google"* — is not built here and is
 * not built later either: holding the first referrer across page views is a
 * per-visitor fact with a lifetime, which is the shape ADR 0017 refuses, and
 * it would need a Storage Consent category this rule declares none of.
 *
 * So nothing is stored. The referrer is read at the instant a Trigger fires
 * and dropped, which is what `consentCategory: null` claims and what
 * `pro/tests/js/pro-modules.test.ts` asserts on the WRITE rather than on the
 * declaration — a later change that starts caching a source fails there rather
 * than shipping a rule whose declaration has quietly become a lie.
 *
 * The merchant is told the same thing on the screen where the rule is written
 * (`resources/admin/src/builder/controls.tsx`), because one who reads it as
 * "arrived from Google originally" will mis-target and blame the plugin.
 *
 * =============================================================================
 * ONE SET, HOLDING THE THREE CHANNELS AND ANY SITE THE MERCHANT NAMES.
 * =============================================================================
 * `in` is set-valued, which is how the real OR cases are expressed without any
 * boolean structure at all — ADR 0005 names *"from Google or Bing"* as this
 * exact case and records the nesting ceiling as permanent. Its members are the
 * three closed channels and hostnames, in one array: `direct` covers a visit
 * with no referring page, `search` and `social` cover the known hosts below,
 * and anything else is a domain the merchant typed.
 *
 * **The three channel names are reserved words, and that costs nothing**: none
 * of them is a hostname. A merchant who wants google.com specifically names it
 * outright and still matches, because the wanted list is asked member by member
 * rather than resolved to one classification first.
 *
 * **An empty set holds for nobody**, not for everybody — the direction that
 * makes a half-configured rule visible rather than one that quietly shows the
 * Optin to every visitor. The section summary already says the row needs a
 * value.
 */

/**
 * The known hosts, by their own name rather than by domain.
 *
 * =============================================================================
 * SMALL, OBVIOUS AND EDITABLE. THE GOAL IS A CONTROL A MERCHANT UNDERSTANDS.
 * =============================================================================
 * Not exhaustive classification, and deliberately not a regular expression: a
 * merchant picking *"Search"* means the handful of engines their visitors
 * actually use, and a list they can read is worth more than a taxonomy they
 * cannot. Anything not here is simply unclassified, which is honest — it is
 * still matchable by name, which is what the third choice is for.
 *
 * They are BRAND labels rather than hostnames because search engines run one
 * domain per country: listing `google.com` would silently fail every merchant
 * outside the United States, and listing all ~190 of Google's country domains
 * is the maintenance burden this shape avoids. See {@link brandOf}.
 */
const SEARCH = ['google', 'bing', 'duckduckgo', 'yahoo', 'ecosia', 'baidu', 'yandex', 'startpage'];

const SOCIAL = [
  'facebook',
  'instagram',
  'threads',
  'x',
  // t.co, X's link shortener, which is what an X referrer usually is.
  't',
  'twitter',
  'linkedin',
  'pinterest',
  'reddit',
  'youtube',
  'tiktok',
  'tumblr',
  'telegram',
  'whatsapp',
];

/**
 * A hostname reduced to what two of them are compared BY.
 *
 * Spelled once and used on both sides of every comparison, because the two
 * sides arrive from different places — one from a browser, one typed by a
 * merchant — and a rule normalised on one side only is a rule that silently
 * stops matching. `Example.COM` and `www.example.com` are `example.com`.
 */
const bareHost = (host: string): string => host.toLowerCase().replace(/^www\./, '');

/**
 * A URL's host, compared-by — or `''` where there is none.
 *
 * **A string that is not a URL is `''`, which reads as direct.** A referrer
 * this cannot parse is one we know nothing about, and the only two readings
 * are "no referring page" and "a referring page we will never match". The
 * first is the one a merchant means, and it is also the one that cannot make
 * an Optin claim something false: `direct` says the visitor arrived without a
 * previous page, which is exactly what we can see.
 */
function hostOf(url: string): string {
  try {
    return bareHost(new URL(url).hostname);
  } catch {
    return '';
  }
}

/**
 * A host's own name: the label before its public suffix, near enough.
 *
 * `www.google.com`, `news.google.com` and `google.co.uk` are all `google`,
 * which is what lets {@link SEARCH} and {@link SOCIAL} hold eight words rather
 * than several hundred domains.
 *
 * **"Near enough" is the whole design.** A real answer needs the Public Suffix
 * List, which is a megabyte of data inside a loader with a 12KB budget. This
 * reads the last label and the one before it: a two-letter TLD under a short
 * second level (`co.uk`, `com.au`, `co.jp`) takes the third label from the end,
 * everything else takes the second. It is wrong for the rare host that is not
 * shaped like either, and being wrong there means a visit is unclassified
 * rather than misclassified — the safe direction, since the merchant can still
 * name the site outright.
 */
function brandOf(host: string): string {
  const labels = host.split('.');
  const last = labels[labels.length - 1] ?? '';
  const under = labels[labels.length - 2] ?? '';
  const twoPart = last.length === 2 && ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'].includes(under);

  return labels[labels.length - (twoPart ? 3 : 2)] ?? '';
}

export const referrer: LoaderModule = {
  id: 'referrer',
  kind: 'condition',
  consentCategory: null,
  create: () => ({
    holds: (rule) => {
      const wanted = (Array.isArray(rule.in) ? rule.in : []).filter(
        (value): value is string => typeof value === 'string' && value !== '',
      );

      // Read live rather than at instantiation, the posture every Condition
      // takes: the answer that matters is the one at the instant a Trigger
      // fires, which may be a timer's worth of page view later.
      const host = hostOf(document.referrer);

      // **The site's own pages are not a traffic source.** A visitor moving
      // from the home page to this one arrived with a referrer and did not
      // arrive FROM anywhere, so reading it as a referring domain would let a
      // merchant target "came from example.com" and hit their own readers.
      if (host === '' || host === hostOf(window.location.href)) {
        return wanted.includes('direct');
      }

      const brand = brandOf(host);

      // Member by member rather than one classification compared to a list, so
      // a host that IS a known channel is still matched by a merchant who
      // named it outright.
      return wanted.some((each) => {
        if (each === 'search' || each === 'social') {
          return (each === 'search' ? SEARCH : SOCIAL).includes(brand);
        }

        if (each === 'direct') {
          return false;
        }

        const domain = bareHost(each);

        // A subdomain of a named site is that site — a merchant naming
        // `example.com` means the whole of it, and `blog.example.com` is where
        // half their referrals come from.
        return host === domain || host.endsWith(`.${domain}`);
      });
    },
  }),
};
