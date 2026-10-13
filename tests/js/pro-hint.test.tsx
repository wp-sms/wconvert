import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProHint, ProHintItem } from '../../resources/admin/src/shell/ProHint';
import { HeaderTools, proUrl } from '../../resources/admin/src/shell/HeaderTools';
import { MoreWithPro } from '../../resources/admin/src/settings-page/MoreWithPro';
import { AddRule } from '../../resources/admin/src/builder/rules/AddRule';
import { DropdownMenu, DropdownMenuTrigger } from '../../resources/admin/src/components/ui/dropdown-menu';
import { OptionMenuContent } from '../../resources/admin/src/components/ui/option-menu';
import { proDisplayTypeLabels } from '../../resources/admin/src/displayTypes';
import { ruleTypes } from './support/rule-types';
import { ProviderTiles, proDestinationNames, proDestinationSummary } from '../../resources/admin/src/destinations/ProviderTiles';
import type { DestinationType } from '../../resources/admin/src/destinations/api';

vi.mock('@wordpress/api-fetch', () => ({ default: vi.fn(() => Promise.resolve([])) }));

/** Free names what Pro adds, where it would sit (ADR 0147). */
const PRO = { pro: { name: 'Pro', product_name: 'WConvert Pro' } };
const free = (extra: Record<string, unknown> = {}) => { window.wconvertAdmin = { exportUrl: '', installedTier: 'free', proHints: true, tiers: PRO, ...extra }; };

afterEach(() => { cleanup(); delete window.wconvertAdmin; });

describe('the hint line', () => {
  it('names the features and links WConvert Pro in a new tab, tagged with where it was', () => {
    free();
    render(<ProHint medium="format-picker" features={['Floating bar', 'Slide-in', 'Fullscreen']} />);

    expect(screen.getByText(/^Also in/)).toHaveTextContent('Also in WConvert Pro(opens in a new tab): Floating bar, Slide-in, Fullscreen.');
    const link = screen.getByRole('link', { name: 'WConvert Pro (opens in a new tab)' });
    expect(link).toHaveAttribute('href', 'https://wconvert.io/pro/?utm_source=wconvert-free&utm_medium=format-picker&utm_campaign=explore-pro');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('draws nothing unless the server said so, and nothing with nothing to name', () => {
    window.wconvertAdmin = { exportUrl: '', installedTier: 'pro', proHints: false, tiers: PRO };
    const { container, rerender } = render(<ProHint medium="rule-menu" features={['About to leave']} />);
    expect(container).toBeEmptyDOMElement();

    window.wconvertAdmin = { exportUrl: '' };
    rerender(<ProHint medium="rule-menu" features={['About to leave']} />);
    expect(container).toBeEmptyDOMElement();

    free();
    rerender(<ProHint medium="rule-menu" features={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says "Activate it" and leads to Plugins when Pro is installed but inactive', () => {
    free({ proInstalledInactive: true });
    render(<ProHint medium="rule-menu" features={['About to leave']} />);

    expect(screen.getByText(/which is installed/)).toHaveTextContent('Also in WConvert Pro, which is installed: About to leave. Activate it');
    expect(screen.getByRole('link', { name: 'Activate it' })).toHaveAttribute('href', 'plugins.php');
    expect(screen.queryByRole('link', { name: /WConvert Pro/ })).toBeNull();
  });

  it('carries only fixed values in its link', () => {
    for (const medium of ['header', 'settings-list', 'format-picker', 'rule-menu', 'flow-map', 'destinations', 'campaign-menu'] as const) {
      const url = new URL(proUrl(medium));
      expect([...url.searchParams.keys()]).toEqual(['utm_source', 'utm_medium', 'utm_campaign']);
      expect(url.searchParams.get('utm_medium')).toBe(medium);
    }
  });
});

describe('where its names come from', () => {
  it('lists the locked rules the menu was given, so a rule that turns free drops out', async () => {
    free();
    const types = ruleTypes({ pro: 'locked' }).triggers;
    const locked = types.filter(type => type.availability === 'locked');
    expect(locked.length).toBeGreaterThan(0);
    const { unmount } = render(<AddRule axis={types} label="Add" onAdd={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    const footer = screen.getByText(/^Also in/);
    for (const type of locked) expect(footer).toHaveTextContent(type.label);
    // In the footer, outside the list the arrow keys walk.
    expect(footer.closest('.wconvert-option-menu__list')).toBeNull();
    expect(footer.closest('.wconvert-option-menu__body')).not.toBeNull();
    unmount();

    const [first] = locked;
    render(<AddRule axis={types.map(type => type === first ? { ...type, availability: 'ready' as const } : type)} label="Add" onAdd={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText(/^Also in/)).not.toHaveTextContent(first.label);
  });

  it('names Pro’s destination services from tiers.json, minus any this site has', () => {
    free({ tiers: { pro: { ...PRO.pro, destinations: ['Mailchimp', 'Brevo', 'Mailtrap'] } } });
    const type = (label: string, availability: DestinationType['availability']) => ({ id: label.toLowerCase(), label, availability }) as DestinationType;
    expect(proDestinationNames([type('MailPoet', 'unavailable')])).toEqual(['Mailchimp', 'Brevo', 'Mailtrap']);
    expect(proDestinationNames([type('Brevo', 'ready')])).toEqual(['Mailchimp', 'Mailtrap']);
  });

  it('sums Pro’s services up as one phrase: two examples, then webhooks where Pro has them', () => {
    expect(proDestinationSummary(['Mailchimp', 'Brevo', 'Mailtrap', 'Webhook'])).toBe('more integrations, like Mailchimp, Brevo and webhooks');
    expect(proDestinationSummary(['Mailchimp', 'Mailtrap'])).toBe('more integrations, like Mailchimp and Mailtrap');
    expect(proDestinationSummary(['Webhook'])).toBe('more integrations, like webhooks');
    expect(proDestinationSummary([])).toBeNull();
  });

  it('frames the phrase in the Add dialog, installed-but-inactive included', () => {
    const tiers = { pro: { ...PRO.pro, destinations: ['Mailchimp', 'Brevo', 'Mailtrap', 'Webhook'] } };
    const mailpoet = { id: 'mailpoet', label: 'MailPoet', icon: 'mail-plus', availability: 'ready' } as DestinationType;
    free({ tiers });
    const { unmount } = render(<ProviderTiles types={[mailpoet]} rule={null} suggested={[]} onChoose={vi.fn()} />);
    expect(screen.getByText(/^Also in/)).toHaveTextContent(/^Also in WConvert Pro\(opens in a new tab\): more integrations, like Mailchimp, Brevo and webhooks\.$/);
    unmount();

    free({ tiers, proInstalledInactive: true });
    render(<ProviderTiles types={[mailpoet]} rule={null} suggested={[]} onChoose={vi.fn()} />);
    expect(screen.getByText(/^Also in/)).toHaveTextContent(/^Also in WConvert Pro, which is installed: more integrations, like Mailchimp, Brevo and webhooks\. Activate it$/);
  });

  it('names the formats a free install lacks', () => {
    expect(proDisplayTypeLabels()).toEqual(['Floating bar', 'Slide-in', 'Fullscreen']);
  });
});

it('is a reachable link row, last in a ⋯ menu, with no feature icon', async () => {
  free();
  render(<DropdownMenu><DropdownMenuTrigger>More</DropdownMenuTrigger><OptionMenuContent aria-label="More">
    <ProHintItem medium="campaign-menu" features={['A/B testing']} />
  </OptionMenuContent></DropdownMenu>);
  await userEvent.click(screen.getByRole('button', { name: 'More' }));
  const item = screen.getByRole('menuitem', { name: 'Also in WConvert Pro: A/B testing.' });
  expect(item).toHaveAttribute('href', proUrl('campaign-menu'));
  expect(item).toHaveAttribute('target', '_blank');
  expect(item).toHaveTextContent('(opens in a new tab)');
});

describe('the header and More with Pro, with Pro installed but inactive', () => {
  it('lead to Plugins instead of the sales page', () => {
    free({ proInstalledInactive: true });
    const { unmount } = render(<HeaderTools />);
    expect(screen.getByRole('link', { name: 'WConvert Pro is installed. Activate it' })).toHaveAttribute('href', 'plugins.php');
    expect(screen.queryByRole('link', { name: /Explore/ })).toBeNull();
    unmount();

    render(<MoreWithPro />);
    expect(screen.getByRole('link', { name: 'Activate it' })).toHaveAttribute('href', 'plugins.php');
  });

  it('tag the Explore links with their medium otherwise', () => {
    free();
    const { unmount } = render(<HeaderTools />);
    expect(screen.getByRole('link', { name: /Explore/ })).toHaveAttribute('href', proUrl('header'));
    unmount();
    render(<MoreWithPro />);
    expect(screen.getByRole('link', { name: /Explore/ })).toHaveAttribute('href', proUrl('settings-list'));
  });
});
