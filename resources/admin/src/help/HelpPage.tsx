import { useEffect } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
  ArrowUpRight, ChartColumn, ExternalLink, Info, LifeBuoy, ListChecks, Palette, Rocket, Search, Send, ShieldCheck, ShoppingCart,
  SlidersHorizontal, Users, type LucideIcon,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { HELP_URLS } from '../shell/HeaderTools';
import { GUIDES, docsSearchUrl, docsUrl } from '../shell/docs';
import { markSubmenuCurrent } from '../shell/menuHighlight';
import { tierName } from '../goals/availability';
import { adminSettings } from '../settings';
import { interpolate } from '../lib/interpolate';
import './help.css';


interface Topic { readonly id: string; readonly icon: LucideIcon; readonly title: string; readonly text: string }

/** The docs' own categories, linked to their headings on the docs home. */
function topics(): readonly Topic[] {
  return [
    { id: 'build-campaigns', icon: Palette, title: __('Build and manage campaigns', 'wconvert'), text: __('Edit your content, preview it and publish with confidence.', 'wconvert') },
    { id: 'display-rules', icon: SlidersHorizontal, title: __('Placement and display rules', 'wconvert'), text: __('Choose where, when and how often campaigns appear.', 'wconvert') },
    { id: 'forms', icon: ListChecks, title: __('Forms and quizzes', 'wconvert'), text: __('Build forms, guide quiz answers and match visitors to useful results.', 'wconvert') },
    { id: 'connections', icon: Send, title: __('Connections and delivery', 'wconvert'), text: __('Save locally, connect MailPoet or send a useful resource.', 'wconvert') },
    { id: 'leads', icon: Users, title: __('Leads and privacy', 'wconvert'), text: __('Find, export and manage the information visitors submit.', 'wconvert') },
    { id: 'spam-protection', icon: ShieldCheck, title: __('Spam protection', 'wconvert'), text: __('Understand built-in checks, filter emails and investigate blocked requests.', 'wconvert') },
    { id: 'analytics', icon: ChartColumn, title: __('Analytics and testing', 'wconvert'), text: __('Read campaign results and compare report periods.', 'wconvert') },
    { id: 'woocommerce', icon: ShoppingCart, title: __('WooCommerce', 'wconvert'), text: __('Recommend products, target baskets and understand product activity.', 'wconvert') },
  ];
}

/** The docs' troubleshooting guides, in the site's order. The Pro one only where Pro is installed (ADR 0116). */
function fixes(paid: boolean): readonly { readonly href: string; readonly title: string }[] {
  return [
    { href: docsUrl(GUIDES.popupNotShowing), title: __('My popup does not appear', 'wconvert') },
    { href: docsUrl(GUIDES.emailNotReceived), title: __('A signup was saved but the email never arrived', 'wconvert') },
    { href: docsUrl(GUIDES.publishBlocked), title: __('My form is blocked, rejected or cannot be published', 'wconvert') },
    { href: docsUrl(GUIDES.missingSubmissions), title: __('I cannot find a submission or the numbers look different', 'wconvert') },
    { href: docsUrl(GUIDES.inlineMissing), title: __('My inline campaign or locked content is missing', 'wconvert') },
    { href: docsUrl(GUIDES.changesNotVisible), title: __('My changes are not visible or the campaign conflicts with my site', 'wconvert') },
    ...(paid ? [{ href: docsUrl(GUIDES.proUnavailable), title: __('Pro features or license updates are unavailable', 'wconvert') }] : []),
  ];
}

const NewTab = () => <span className="sr-only">{__('(opens in a new tab)', 'wconvert')}</span>;

/**
 * WConvert → Help (ADR 0144), from the approved prototype v5
 * (claude.ai/artifact/EnhKuiKMx37rYDJDLcffgE): a search that opens the docs,
 * the first-campaign guide, topics, quick fixes and the way to support.
 *
 * Every link leaves for wconvert.io in a new tab and nothing is fetched, so
 * the page works the same offline and tells wconvert.io nothing until it is
 * clicked. Site details for a support message are WordPress's own Site
 * Health report, which carries a WConvert section (`SiteHealthInfo`).
 */
export function HelpPage() {
  useEffect(() => markSubmenuCurrent('help'), []);
  const settings = adminSettings();
  const tier = settings?.installedTier ?? 'free';
  const paid = tier !== 'free';
  const popular = [
    __('Publish a campaign', 'wconvert'),
    __('MailPoet', 'wconvert'),
    __('Exit intent', 'wconvert'),
    __('Export leads', 'wconvert'),
  ];

  return (
    <div className="wconvert-help">
      {/* A plain GET form: the docs' search runs on wconvert.io (`docsSearchUrl`), so this needs no script and sends nothing until submitted. */}
      <form className="wconvert-help-search" role="search" action={HELP_URLS.guides} method="get" target="_blank" rel="noreferrer">
        <label htmlFor="wconvert-help-q" className="sr-only">{__('Search the guides on wconvert.io', 'wconvert')}</label>
        <div className="wconvert-help-search__field">
          <Search aria-hidden="true" />
          <input id="wconvert-help-q" name="q" type="search" autoComplete="off" placeholder={__('Search the guides', 'wconvert')} />
          <Button type="submit">{__('Search', 'wconvert')}<NewTab /></Button>
        </div>
        <p className="wconvert-help-search__popular">
          <span>{__('Popular:', 'wconvert')}</span>
          {popular.map((query) => (
            <a key={query} href={docsSearchUrl(query)} target="_blank" rel="noreferrer">{query}<NewTab /></a>
          ))}
        </p>
      </form>

      <a className="wconvert-help-start" href={HELP_URLS.start} target="_blank" rel="noreferrer">
        <span className="wconvert-help-start__tile" aria-hidden="true"><Rocket /></span>
        <span className="wconvert-help-start__copy">
          <span className="wconvert-help-eyebrow">{__('New to WConvert?', 'wconvert')}</span>
          <strong>{__('Create your first campaign', 'wconvert')}</strong>
          <span>{__('From a ready-made setup to your first saved lead.', 'wconvert')}</span>
        </span>
        <Button asChild variant="outline"><span>{__('Open the guide', 'wconvert')}<ExternalLink aria-hidden="true" /></span></Button>
        <NewTab />
      </a>

      <div className="wconvert-help-pair">
        <section className="wconvert-help-card" aria-labelledby="wconvert-help-topics">
          <div className="wconvert-help-card__head">
            <h2 id="wconvert-help-topics">{__('Browse by topic', 'wconvert')}</h2>
            <a href={HELP_URLS.guides} target="_blank" rel="noreferrer">{__('All guides', 'wconvert')}<NewTab /></a>
          </div>
          <ul className="wconvert-help-topics">
            {topics().map(({ id, icon: Icon, title, text }) => (
              <li key={id}>
                <a href={`${HELP_URLS.guides}#${id}`} target="_blank" rel="noreferrer">
                  <span className="wconvert-help-topics__icon" aria-hidden="true"><Icon /></span>
                  <strong>{title}</strong>
                  <span>{text}</span>
                  <NewTab />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="wconvert-help-card" aria-labelledby="wconvert-help-fixes">
          <div className="wconvert-help-card__head">
            <h2 id="wconvert-help-fixes">{__('Quick fixes', 'wconvert')}</h2>
            <a href={`${HELP_URLS.guides}#troubleshooting`} target="_blank" rel="noreferrer">{__('All', 'wconvert')}<span className="sr-only"> {__('troubleshooting guides (opens in a new tab)', 'wconvert')}</span></a>
          </div>
          <ul className="wconvert-help-fixes">
            {fixes(paid).map(({ href, title }) => (
              <li key={href}><a href={href} target="_blank" rel="noreferrer"><span>{title}</span><ArrowUpRight aria-hidden="true" /><NewTab /></a></li>
            ))}
          </ul>
        </section>
      </div>

      <section className="wconvert-help-support" aria-labelledby="wconvert-help-stuck">
        <span className="wconvert-help-support__icon" aria-hidden="true"><LifeBuoy /></span>
        <div>
          <h2 id="wconvert-help-stuck">{__('Still stuck?', 'wconvert')}</h2>
          <p>{__('Tell us what you expected and what happened instead. We’ll help you find the next step.', 'wconvert')}</p>
          <p className="wconvert-help-support__tip">
            <Info aria-hidden="true" />
            <span>
              {interpolate(
                /* translators: 1: a link to Tools → Site Health → Info, 2: the label of WordPress's own button there. */
                __('To save a round trip, attach your site info: %1$s, then %2$s.', 'wconvert'),
                [
                  <a key="info" href="site-health.php?tab=debug">{__('Tools → Site Health → Info', 'wconvert')}</a>,
                  <b key="copy">{__('Copy site info to clipboard', 'wconvert')}</b>,
                ],
              )}
            </span>
          </p>
        </div>
        <Button asChild size="lg">
          <a href={HELP_URLS.support} target="_blank" rel="noreferrer">
            {/* translators: %s: the installed plan's name, e.g. Pro. */}
            {paid ? sprintf(__('Contact %s support', 'wconvert'), tierName(tier)) : __('Contact support', 'wconvert')}
            <ExternalLink aria-hidden="true" /><NewTab />
          </a>
        </Button>
      </section>

      {settings?.version && (
        <p className="wconvert-help-version">
          {/* translators: %s: the plugin's version, e.g. 1.0.0. */}
          {sprintf(__('WConvert %s', 'wconvert'), settings.version)}
          {' · '}
          <a href={HELP_URLS.changes} target="_blank" rel="noreferrer">{__('What’s new', 'wconvert')}<NewTab /></a>
        </p>
      )}
    </div>
  );
}
