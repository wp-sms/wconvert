import { treeFixture } from './support/journey';
import { CAPTURE_OUTCOME } from './support/outcomes';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadinessDialog, type ReadinessDialogProps } from '../../resources/admin/src/builder/ReadinessDialog';
import { campaignIssues } from '../../resources/admin/src/builder/readiness/campaignIssues';
import { ready } from '../../resources/admin/src/shell/loadable';
import type { GoalEntry } from '../../resources/admin/src/goals/api';
import type { Template } from '@renderer/types';
import { ruleTypes } from './support/rule-types';
import graphFixture from '../fixtures/journey-graph-enquiry.json';
import coffee from '../fixtures/journey-graph-coffee.json';

const design = (id: string): Template => JSON.parse(readFileSync(
  resolve(import.meta.dirname, `../../resources/templates/library/${id}.json`), 'utf8',
));
const FORM = design('centred-card');
const LINK = design('offer-panel');
const GOAL: GoalEntry = {
  id: 'collect-subscribers', label: 'Collect subscribers', description: '',
  outcome: CAPTURE_OUTCOME, headline_kind: 'conversion', headline_label: 'Conversions', rate_label: 'Conversion rate',
  tier: 'free', availability: 'ready',
};
const NOTICE_GOAL: GoalEntry = {
  ...GOAL,
  id: 'collect-enquiries',
  label: 'Collect enquiries',
  outcome: { ...CAPTURE_OUTCOME, audience_channel: null },
};

type ReviewProps = Omit<ReadinessDialogProps, 'issues'> & { readonly issues?: ReadinessDialogProps['issues']; readonly policyUrl?: string };

/** The list the builder hands the review, computed from the same inputs (ADR 0133). */
const issuesFor = (p: ReviewProps) => campaignIssues({ template: p.template, rules: p.rules, vocabulary: p.vocabulary, displayType: p.displayType,
  contentLock: p.contentLock, inlinePlacement: p.inlinePlacement, outcome: p.goal.status === 'ready' ? p.goal.data?.outcome : undefined,
  bound: p.bound, destinations: p.destinations, captureMode: p.captureMode ?? 'local', privacyGuidance: p.privacyGuidance, policyUrl: p.policyUrl });

function Review({ policyUrl: _policyUrl, ...p }: ReviewProps) {
  return <ReadinessDialog {...p} issues={p.issues ?? issuesFor({ ...p, policyUrl: _policyUrl })} />;
}

/** The fix beside one blocker, named for where it goes (ADR 0138). */
const fixFor = (said: RegExp | string) => within(screen.getByText(said).closest('li')!).getAllByRole('button')[0];
/** One answer in How it runs. */
const fact = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;

function props(overrides: Partial<ReviewProps> = {}): ReviewProps {
  return {
    optinId: '01JQ00000000000000000000AA',
    optin: { published_at: null, deleted_at: null, suspended: null, has_unpublished_changes: false },
    dirty: false, busy: false, goal: ready(GOAL), goalId: GOAL.id,
    playbook: ready(null), playbookId: '',
    rules: { display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'immediate' } }, targeting: {}, frequency: {}, schedule: {}, priority: 0 },
    vocabulary: ruleTypes(), displayType: 'popup', bound: [], template: FORM,
    destinations: [], captureMode: 'local', fieldLabels: { email: 'Email address', phone: 'Phone number' },
    privacyGuidance: false,
    onGoTo: vi.fn(), onGoToSchedule: vi.fn(), onGoToRules: vi.fn(), onGoToDestinations: vi.fn(),
    onGoToDesign: vi.fn(), onEditDesign: vi.fn(), onPreview: vi.fn(), onPublish: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function open(overrides: Partial<ReviewProps> = {}) {
  const supplied = props(overrides);
  const view = render(<Review {...supplied} />);
  await userEvent.click(screen.getByRole('button', { name: 'Review & publish' }));
  return { ...view, supplied };
}

afterEach(() => { delete window.wconvertAdmin; });

describe('reviewing before publishing', () => {
  it('opens the exact unfinished graph path from the publish review', async () => {
    const onEditJourney = vi.fn();
    const tree = graphFixture as unknown as Template['tree'];
    const template: Template = { ...FORM, tree: { ...tree, graph: { ...tree.graph!, edges: [...tree.graph!.edges,
      { id: 'unfinished', from: 'interests', to: 'balcony', kind: 'answer',
        when: { match: 'all', clauses: [{ question: 'n1', operator: 'includes_any', values: [] }] } },
    ] } } };
    await open({ template, onEditJourney });
    expect(screen.getByRole('button', { name: 'Publish campaign' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(fixFor(/Choose an answer for the path from “Interests” to “Balcony details”/));
    await waitFor(() => expect(onEditJourney).toHaveBeenCalledExactlyOnceWith({ screenId: 'interests', section: 'paths', edgeId: 'unfinished' }));
  });

  /** A refused Publish keeps focus and says why (§9); pressing it publishes nothing. */
  it('names the campaign in the title and says why Publish is refused', async () => {
    const { supplied } = await open({ name: 'Spring sale', template: { ...FORM, tree: { ...FORM.tree, steps: [] } } });
    expect(screen.getByRole('dialog', { name: 'Spring sale' })).toBeInTheDocument();
    const publish = screen.getByRole('button', { name: 'Publish campaign' });
    expect(publish).not.toBeDisabled();
    expect(publish).toHaveAccessibleDescription('Fix the item above first.');
    await userEvent.click(publish);
    expect(supplied.onPublish).not.toHaveBeenCalled();
  });

  it('links the inline placement recap to its placement settings', async () => {
    const placement = vi.fn();
    const { supplied } = await open({ displayType: 'inline', inlinePlacement: { position: 'after_content' }, onGoToPlacement: placement });
    await userEvent.click(screen.getByRole('button', { name: 'Automatically after content' }));
    expect(placement).toHaveBeenCalledOnce();
    expect(supplied.onGoToDesign).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('puts required fixes first, then what counts as success, never folded away', async () => {
    const { supplied } = await open({ captureMode: 'connected' });
    const required = screen.getByRole('heading', { name: '1 thing to fix before publishing' });
    const runs = screen.getByRole('heading', { name: 'How it runs' });
    expect(required.compareDocumentPosition(runs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Counts as success')).toBeVisible();
    expect(screen.getByText(GOAL.headline_label)).toBeVisible();
    expect(screen.getByText(GOAL.outcome.measurement)).toBeVisible();
    expect(screen.queryByText('Measurement & setup details')).toBeNull();
    for (const gone of ['Design', 'Placement & timing', 'Where leads go', 'Privacy']) expect(screen.queryByRole('heading', { name: gone })).toBeNull();
    expect(supplied.onPublish).not.toHaveBeenCalled();
  });

  it('blocks a list campaign until a service is ready or collect-only is explicitly chosen', async () => {
    const { rerender, supplied } = await open({ captureMode: 'connected' });
    expect(screen.getByRole('button', { name: 'Publish campaign' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/Before you can publish, connect a service/)).toBeVisible();
    rerender(<Review {...supplied} captureMode="local" />);
    expect(screen.getByRole('button', { name: 'Publish campaign' })).not.toHaveAttribute('aria-disabled');
    expect(fact('Leads go to')).toHaveTextContent('Kept in WConvert only');
  });

  it('answers the service blocker in place, without leaving the review', async () => {
    const onKeepLocal = vi.fn();
    const onGoToDestinations = vi.fn();
    await open({ captureMode: 'connected', onKeepLocal, onGoToDestinations });
    await userEvent.click(screen.getByRole('button', { name: 'Keep in WConvert only' }));
    expect(onKeepLocal).toHaveBeenCalledOnce();
    expect(onGoToDestinations).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('says how much blocks publishing, where, and keeps the way back in reach', async () => {
    const supplied = props({ captureMode: 'connected', template: undefined });
    render(<Review {...supplied} />);
    const trigger = screen.getByRole('button', { name: 'Review & publish' });
    expect(trigger).toHaveTextContent('2 to fix');
    expect(trigger).toHaveAccessibleDescription('2 items block publishing');
    expect(new Set(issuesFor(supplied).filter(issue => issue.blocks).map(issue => issue.tab))).toEqual(new Set(['edit', 'destinations']));
    await userEvent.click(trigger);
    await userEvent.click(fixFor('Choose a design before publishing.'));
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: 'Back to review · 2 left' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps the same trigger for a sound design and one needing attention', () => {
    const supplied = props();
    const { rerender } = render(<Review {...supplied} />);
    expect(screen.getByRole('button', { name: 'Review & publish' })).toBeEnabled();
    rerender(<Review {...supplied} template={undefined} />);
    expect(screen.getByRole('button', { name: 'Review & publish' })).toBeEnabled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([undefined, { tree: treeFixture({ steps: [] }), tokens: {} } as Template])('blocks a missing or empty design and routes to choosing one', async (template) => {
    const { supplied } = await open({ template });
    expect(screen.getByRole('button', { name: 'Publish campaign' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Choose a design before publishing.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose design' }));
    expect(supplied.onGoToDesign).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(supplied.onPublish).not.toHaveBeenCalled();
  });

  it('blocks a design with no conversion action', async () => {
    const template: Template = { tokens: FORM.tokens, tree: treeFixture({ steps: [
      { type: 'stack', children: [{ type: 'heading', role: 'headline', text: 'Hello' }] },
    ] }) };
    const { supplied } = await open({ template });
    expect(screen.getByText(/Nothing on this design counts as a conversion/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish campaign' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Publish campaign' }));
    expect(supplied.onPublish).not.toHaveBeenCalled();
    await userEvent.click(fixFor(/Nothing on this design counts as a conversion/));
    expect(supplied.onEditDesign).toHaveBeenCalledOnce();
    expect(supplied.onGoToDesign).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(['goal', 'destination'])('requires captured fields when the %s needs a lead', async (requirement) => {
    await open({ template: LINK,
      ...(requirement === 'goal' ? { goal: ready({ ...GOAL, outcome: CAPTURE_OUTCOME }) } : { bound: ['forwarding-route'] }),
    });
    expect(screen.getByText(requirement === 'goal' ? CAPTURE_OUTCOME.requirement : /This campaign needs a form field to collect leads/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish campaign' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('blocks an unfinished interest choice and opens the exact field for correction', async () => {
    const template: Template = { tokens: FORM.tokens, tree: treeFixture({ steps: [{ type: 'stack', children: [
      { type: 'field', name: 'email', required: true },
      { type: 'field', name: 'interest', options: [] },
      { type: 'button', action: 'submit', label: 'Send' },
    ] }] }) };
    const { supplied } = await open({ template });
    expect(screen.getByRole('button', { name: 'Publish campaign' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(fixFor(/Set up the interest choices/));
    expect(supplied.onGoTo).toHaveBeenCalledExactlyOnceWith([0, 'children', 1]);
    expect(supplied.onEditDesign).not.toHaveBeenCalled();
    expect(supplied.onPublish).not.toHaveBeenCalled();
  });

  it('blocks a submitting form without an identifier and opens the design editor', async () => {
    const template: Template = { tokens: FORM.tokens, tree: treeFixture({ steps: [{ type: 'stack', children: [
      { type: 'field', name: 'name' }, { type: 'button', action: 'submit', label: 'Send' },
    ] }] }) };
    const { supplied } = await open({ template });
    expect(screen.getByRole('button', { name: 'Publish campaign' })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(fixFor(/Add an email or phone field/));
    expect(supplied.onEditDesign).toHaveBeenCalledOnce();
    expect(supplied.onPublish).not.toHaveBeenCalled();
  });

  it('blocks publishing a click-only design under a capture Goal', async () => {
    await open({ template: LINK });
    expect(screen.getByText(CAPTURE_OUTCOME.requirement)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1 thing to fix before publishing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish campaign' })).toHaveAttribute('aria-disabled', 'true');
  });

  /** The fix is in the design itself, never the library of other designs. */
  it('keeps a contrast warning advisory and routes its correction to the design in place', async () => {
    const { supplied } = await open({ template: { ...FORM, tokens: { ...FORM.tokens, muted: '#ffffff' } } });
    expect(screen.getByRole('button', { name: 'Publish campaign' })).not.toHaveAttribute('aria-disabled');
    await userEvent.click(screen.getByRole('button', { name: /hard to read on the background/ }));
    await waitFor(() => expect(supplied.onEditDesign).toHaveBeenCalledOnce());
    expect(supplied.onGoToDesign).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('describes an unfinished service choice without suggesting local collection was chosen', async () => {
    await open({ captureMode: 'connected' });
    expect(fact('Leads go to')).toHaveTextContent('Saved in LeadsNo service chosen yet');
    expect(fact('Leads go to').parentElement).toHaveAttribute('data-tone', 'warning');
    expect(screen.queryByText(/You can export captured leads/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish campaign' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('allows saving leads locally with no forwarding route', async () => {
    const { supplied } = await open();
    expect(fact('Collects')).toHaveTextContent('Email address');
    expect(fact('Leads go to')).toHaveTextContent(/^Kept in WConvert only$/);
    await userEvent.click(screen.getByRole('button', { name: 'Publish campaign' }));
    await waitFor(() => expect(supplied.onPublish).toHaveBeenCalledOnce());
  });

  it('names destination data that could not be checked without inventing a delivery result', async () => {
    await open({ bound: ['forwarding-route'], destinations: null });
    expect(fact('Leads go to')).toHaveTextContent(/Destination details could not be checked/);
    expect(screen.getByText(/Publishing does not test delivery/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish campaign' })).not.toHaveAttribute('aria-disabled');
  });

  it('says privacy as one Consent line, with nothing to review when the notice links', async () => {
    const template: Template = { tokens: FORM.tokens, tree: treeFixture({ steps: [{ type: 'stack', children: [
      { type: 'field', name: 'email', required: true },
      { type: 'button', action: 'submit', label: 'Send' },
      { type: 'text', role: 'fine_print', text: 'We use your email to reply. %s', link: { label: 'Privacy Policy' } },
    ] }, { type: 'stack', children: [] }] }) };
    await open({ template, goal: ready(NOTICE_GOAL), privacyGuidance: true, policyUrl: 'https://example.test/privacy/' });
    expect(screen.queryByRole('heading', { name: 'Privacy' })).toBeNull();
    expect(fact('Consent')).toHaveTextContent('Not asked on this form');
    expect(screen.queryByText(/Privacy Policy/)).toBeNull();
  });

  it('lists an unresolved notice for review, with a way to set the policy page', async () => {
    const template: Template = { tokens: FORM.tokens, tree: treeFixture({ steps: [{ type: 'stack', children: [
      { type: 'field', name: 'email', required: true },
      { type: 'button', action: 'submit', label: 'Send' },
      { type: 'text', role: 'fine_print', text: 'We use your email to reply. %s', link: { label: 'Privacy Policy' } },
    ] }, { type: 'stack', children: [] }] }) };
    await open({ template, goal: ready(NOTICE_GOAL), privacyGuidance: true });
    const review = screen.getByRole('heading', { name: '2 things to review' }).closest('section')!;
    expect(review).toHaveTextContent(/WordPress has no Privacy Policy page selected/);
    expect(within(review).getByRole('link', { name: 'Set the Privacy Policy page' })).toHaveAttribute('href', 'options-privacy.php');
  });

  it('flags missing consent for an ongoing marketing list and opens that exact control', async () => {
    const template: Template = { tokens: FORM.tokens, tree: treeFixture({ steps: [{ type: 'stack', children: [
      { type: 'field', name: 'email', required: true },
      { type: 'consent', role: 'consent_text', hidden: true, text: 'Send me weekly updates. %s', link: { label: 'Privacy Policy' } },
      { type: 'button', action: 'submit', label: 'Join' },
      { type: 'text', role: 'fine_print', text: 'Weekly emails. %s', link: { label: 'Privacy Policy' } },
    ] }, { type: 'stack', children: [] }] }) };
    const { supplied } = await open({ template, privacyGuidance: true, policyUrl: 'https://example.test/privacy/' });

    expect(fact('Consent')).toHaveTextContent('Not shown');
    expect(fact('Consent').parentElement).toHaveAttribute('data-tone', 'warning');
    expect(screen.getByRole('button', { name: 'Publish campaign' })).not.toHaveAttribute('aria-disabled');
    await userEvent.click(screen.getByRole('button', { name: 'No consent checkbox is shown for this mailing list.' }));
    expect(supplied.onGoTo).toHaveBeenCalledExactlyOnceWith([0, 'children', 1]);
  });

  it('confirms visible consent for an ongoing marketing list', async () => {
    const template: Template = { tokens: FORM.tokens, tree: treeFixture({ steps: [{ type: 'stack', children: [
      { type: 'field', name: 'email', required: true },
      { type: 'consent', role: 'consent_text', hidden: false, text: 'Send me weekly updates. %s', link: { label: 'Privacy Policy' } },
      { type: 'button', action: 'submit', label: 'Join' },
      { type: 'text', role: 'fine_print', text: 'Weekly emails. %s', link: { label: 'Privacy Policy' } },
    ] }, { type: 'stack', children: [] }] }) };
    await open({ template, privacyGuidance: true, policyUrl: 'https://example.test/privacy/' });

    expect(fact('Consent')).toHaveTextContent(/^Shown$/);
    expect(screen.queryByText('No consent checkbox is shown for this mailing list.')).toBeNull();
  });

  it('keeps privacy guidance advisory and hides it when the site preference is off', async () => {
    const { rerender, supplied } = await open({ privacyGuidance: true });

    expect(screen.getByText('No Privacy Policy notice is shown on this form.')).toBeInTheDocument();
    expect(screen.getByText(/WordPress has no Privacy Policy page selected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish campaign' })).not.toHaveAttribute('aria-disabled');

    rerender(<Review {...supplied} privacyGuidance={false} />);
    expect(screen.queryByText('Consent', { selector: 'dt' })).toBeNull();
    expect(screen.queryByText('No Privacy Policy notice is shown on this form.')).toBeNull();
  });
});

describe('publication progress and recovery', () => {
  it('keeps the dialog open with the actual server error and offers a retry', async () => {
    const onPublish = vi.fn().mockRejectedValueOnce({ message: 'Could not save your latest changes.' }).mockResolvedValue(undefined);
    await open({ onPublish, dirty: true });
    await userEvent.click(screen.getByRole('button', { name: 'Save & publish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your latest changes.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('It’s live.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save & publish' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save & publish' }));
    expect(await screen.findByText('It’s live.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onPublish).toHaveBeenCalledTimes(2);
  });

  it('prevents duplicate publication and dismissal until the request finishes', async () => {
    let finish: () => void = () => undefined;
    const onPublish = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { supplied } = await open({ onPublish });
    await userEvent.click(screen.getByRole('button', { name: 'Publish campaign' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Publishing…' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Preview' })).toBeDisabled();
    expect(within(dialog).queryByRole('button', { name: 'Close' })).toBeNull();
    await userEvent.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    // The native inert region prevents interaction in the browser; the event
    // guard also protects against a queued action while publication is pending.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Display rules' }));
    expect(supplied.onGoToRules).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
    expect(onPublish).toHaveBeenCalledOnce();
    await act(async () => { finish(); });
    expect(screen.getByText('It’s live.')).toBeInTheDocument();
  });

  it('offers inline placement after success and returns focus when Done closes the review', async () => {
    window.wconvertAdmin = { exportUrl: '', homeUrl: 'https://example.org/blog/', inspectParam: 'wconvert-inspect' };
    await open({ displayType: 'inline' });
    await userEvent.click(screen.getByRole('button', { name: 'Publish campaign' }));
    expect(await screen.findByText('It’s live.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Shortcode for other editors' })).toHaveValue('[wconvert_optin id="01JQ00000000000000000000AA"]');
    expect(screen.queryByText(/Publish this campaign first/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Check your homepage' })).toHaveAttribute('href', 'https://example.org/blog/?wconvert-inspect=1');
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review & publish' })).toHaveFocus());
  });

  it('does not republish an unchanged live version, but still explains inline placement', async () => {
    await open({ displayType: 'inline', optin: { published_at: '2026-09-10T12:00:00Z', deleted_at: null, suspended: null, has_unpublished_changes: false } });
    expect(screen.getByText('Your saved draft matches the published version.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish changes' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('heading', { name: 'Place this campaign on a page' })).toBeInTheDocument();
  });
});

describe('review actions return to the place that can resolve them', () => {
  it.each([
    ['Where', 'where'], ['Opens', 'when'], ['Who', 'who'], ['How often', 'how-often'], ['Runs', 'dates'],
  ])('opens the rules from the %s answer and closes review', async (label, section) => {
    const { supplied } = await open();
    await userEvent.click(within(fact(label)).getByRole('button'));
    expect(supplied.onGoToRules).toHaveBeenCalledWith(section);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens destinations from a delivery note and closes review', async () => {
    const { supplied } = await open({ bound: ['forwarding-route'], destinations: null });
    await userEvent.click(screen.getByRole('button', { name: 'Send a test first' }));
    expect(supplied.onGoToDestinations).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the actual schedule control for a countdown warning', async () => {
    const { supplied } = await open({ template: design('deadline-panel') });
    await userEvent.click(screen.getByRole('button', { name: /nothing says when this campaign stops running/ }));
    expect(supplied.onGoToSchedule).toHaveBeenCalledOnce();
    expect(supplied.onGoTo).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not pull focus back to the review trigger after opening the preview', async () => {
    const onPreview = vi.fn(() => { screen.getByRole('button', { name: 'Preview canvas' }).focus(); });
    render(<><button>Preview canvas</button><Review {...props({ onPreview })} /></>);
    await userEvent.click(screen.getByRole('button', { name: 'Review & publish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(onPreview).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview canvas' })).toHaveFocus());
  });
});


it('offers a focused repair after the server refuses the live-product requirement', async () => {
  const onEditJourney = vi.fn();
  const original = coffee.template as Template;
  const template: Template = { ...original, tree: { ...original.tree, steps: original.tree.steps.map(step => step.kind === 'result'
    ? { ...step, products_required: true } : step) } };
  const goal = { ...GOAL, id: 'find_match', outcome: { ...GOAL.outcome, action: 'match' as const, audience_channel: null, capture_any_of: [] } };
  await open({ template, goal: ready(goal), goalId: goal.id, onEditJourney,
    onPublish: vi.fn().mockRejectedValue({ code: 'wconvert_optin_form_incomplete', message: 'WooCommerce is required.', data: { issue: 'products' } }) });
  await userEvent.click(screen.getByRole('button', { name: 'Publish campaign' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('WooCommerce is required.');
  await userEvent.click(screen.getByRole('button', { name: 'Review product requirements' }));
  expect(onEditJourney).toHaveBeenCalledWith({ screenId: 'result', section: 'content', focus: 'products-required' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('opens the exact unassigned consent block and blocks publication until it is repaired', async () => {
  const original = coffee.template as Template;
  const template: Template = { ...original, tree: { ...original.tree, submissions: original.tree.submissions.map(save => ({ ...save, consents: [] })) } };
  const goal = { ...GOAL, id: 'find_match', outcome: { ...GOAL.outcome, action: 'match' as const, audience_channel: 'email', capture_any_of: [] } };
  const { supplied } = await open({ template, goal: ready(goal), goalId: goal.id });
  expect(screen.getByRole('button', { name: 'Publish campaign' })).toHaveAttribute('aria-disabled', 'true');
  await userEvent.click(fixFor('Assign the consent checkbox to “Optional email signup” under Saved by.'));
  const at = original.tree.steps.findIndex(step => step.id === 'email');
  expect(supplied.onGoTo).toHaveBeenCalledWith([at, 'children', 3]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('says what a quiz counts and how it runs, in the list’s words', async () => {
  const template = coffee.template as Template;
  const goal = { ...GOAL, id: 'find_match', headline_label: 'Quiz completions', outcome: { ...GOAL.outcome, action: 'match' as const, audience_channel: null, capture_any_of: [],
    measurement: 'Counts quiz results shown. Product clicks and purchases are separate.' } };
  await open({ template, goal: ready(goal), goalId: goal.id });
  expect(screen.getByText('Counts as success')).toBeVisible();
  expect(screen.getByText('Counts quiz results shown. Product clicks and purchases are separate.')).toBeVisible();
  expect(fact('Visitor action')).toHaveTextContent('Shows a matching resultCounts Quiz completions');
  expect(fact('Visitor action').parentElement).not.toHaveAttribute('data-tone');
  expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument();
});
