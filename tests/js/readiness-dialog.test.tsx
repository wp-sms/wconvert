import { CAPTURE_OUTCOME } from './support/outcomes';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadinessDialog, type ReadinessDialogProps } from '../../resources/admin/src/builder/ReadinessDialog';
import { ready } from '../../resources/admin/src/shell/loadable';
import type { GoalEntry } from '../../resources/admin/src/goals/api';
import type { Template } from '@renderer/types';
import { ruleTypes } from './support/rule-types';

const design = (id: string): Template => JSON.parse(readFileSync(
  resolve(import.meta.dirname, `../../resources/templates/library/${id}.json`), 'utf8',
));
const FORM = design('centred-card');
const LINK = design('offer-panel');
const GOAL: GoalEntry = {
  id: 'collect-subscribers', label: 'Collect subscribers', description: '',
  outcome: CAPTURE_OUTCOME, headline_kind: 'conversion', headline_label: 'Conversions',
  tier: 'free', availability: 'ready',
};

function props(overrides: Partial<ReadinessDialogProps> = {}): ReadinessDialogProps {
  return {
    optinId: '01JQ00000000000000000000AA',
    optin: { published_at: null, deleted_at: null, suspended: null, has_unpublished_changes: false },
    dirty: false, busy: false, goal: ready(GOAL), goalId: GOAL.id,
    playbook: ready(null), playbookId: '',
    rules: { rules: [], targeting: {}, frequency: {}, schedule: {}, priority: 0 },
    vocabulary: ruleTypes(), displayType: 'popup', bound: [], template: FORM,
    destinations: [], fieldLabels: { email: 'Email address', phone: 'Phone number' },
    onGoTo: vi.fn(), onGoToSchedule: vi.fn(), onGoToRules: vi.fn(), onGoToDestinations: vi.fn(),
    onGoToDesign: vi.fn(), onEditDesign: vi.fn(), onPreview: vi.fn(), onPublish: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function open(overrides: Partial<ReadinessDialogProps> = {}) {
  const supplied = props(overrides);
  const view = render(<ReadinessDialog {...supplied} />);
  await userEvent.click(screen.getByRole('button', { name: 'Review & publish' }));
  return { ...view, supplied };
}

afterEach(() => { delete window.wconvertAdmin; });

describe('reviewing before publishing', () => {
  it('keeps the same trigger for a sound design and one needing attention', () => {
    const supplied = props();
    const { rerender } = render(<ReadinessDialog {...supplied} />);
    expect(screen.getByRole('button', { name: 'Review & publish' })).toBeEnabled();
    rerender(<ReadinessDialog {...supplied} template={undefined} />);
    expect(screen.getByRole('button', { name: 'Review & publish' })).toBeEnabled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([undefined, { tree: { steps: [] }, tokens: {} } as Template])('blocks a missing or empty design and routes to choosing one', async (template) => {
    const { supplied } = await open({ template });
    expect(screen.getByRole('button', { name: 'Publish Optin' })).toBeDisabled();
    expect(screen.getByText('Choose a design before publishing.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose design' }));
    expect(supplied.onGoToDesign).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(supplied.onPublish).not.toHaveBeenCalled();
  });

  it('blocks a design with no conversion action', async () => {
    const template: Template = { tokens: FORM.tokens, tree: { steps: [
      { type: 'stack', children: [{ type: 'heading', role: 'headline', text: 'Hello' }] },
    ] } };
    const { supplied } = await open({ template });
    expect(screen.getByText(/Nothing on this design counts as a conversion/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish Optin' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Publish Optin' }));
    expect(supplied.onPublish).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Nothing on this design counts as a conversion/ }));
    expect(supplied.onEditDesign).toHaveBeenCalledOnce();
    expect(supplied.onGoToDesign).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(['goal', 'destination'])('requires captured fields when the %s needs a lead', async (requirement) => {
    await open({ template: LINK,
      ...(requirement === 'goal' ? { goal: ready({ ...GOAL, outcome: CAPTURE_OUTCOME }) } : { bound: ['forwarding-route'] }),
    });
    expect(screen.getByText(requirement === 'goal' ? CAPTURE_OUTCOME.requirement : /This Optin needs a form field to collect leads/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish Optin' })).toBeDisabled();
  });

  it('blocks an unfinished interest choice and opens the exact field for correction', async () => {
    const template: Template = { tokens: FORM.tokens, tree: { steps: [{ type: 'stack', children: [
      { type: 'field', name: 'email', required: true },
      { type: 'field', name: 'interest', options: [] },
      { type: 'button', action: 'submit', label: 'Send' },
    ] }] } };
    const { supplied } = await open({ template });
    expect(screen.getByRole('button', { name: 'Publish Optin' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Set up the interest choices/ }));
    expect(supplied.onGoTo).toHaveBeenCalledExactlyOnceWith([0, 'children', 1]);
    expect(supplied.onEditDesign).not.toHaveBeenCalled();
    expect(supplied.onPublish).not.toHaveBeenCalled();
  });

  it('blocks a submitting form without an identifier and opens the design editor', async () => {
    const template: Template = { tokens: FORM.tokens, tree: { steps: [{ type: 'stack', children: [
      { type: 'field', name: 'name' }, { type: 'button', action: 'submit', label: 'Send' },
    ] }] } };
    const { supplied } = await open({ template });
    expect(screen.getByRole('button', { name: 'Publish Optin' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Add an email or phone field/ }));
    expect(supplied.onEditDesign).toHaveBeenCalledOnce();
    expect(supplied.onPublish).not.toHaveBeenCalled();
  });

  it('blocks publishing a click-only design under a capture Goal', async () => {
    await open({ template: LINK });
    expect(screen.getByText(CAPTURE_OUTCOME.requirement)).toBeInTheDocument();
    expect(screen.getByText('Before you can publish')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish Optin' })).toBeDisabled();
  });

  it('keeps a contrast warning advisory and routes its correction to design', async () => {
    const { supplied } = await open({ template: { ...FORM, tokens: { ...FORM.tokens, muted: '#ffffff' } } });
    expect(screen.getByRole('button', { name: 'Publish Optin' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /too close to the background/ }));
    expect(supplied.onGoToDesign).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('allows saving leads locally with no forwarding route', async () => {
    const { supplied } = await open();
    expect(screen.getByText('New leads are saved in WConvert.')).toBeInTheDocument();
    expect(screen.getByText('No forwarding selected. You can export captured leads from Leads.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Publish Optin' }));
    await waitFor(() => expect(supplied.onPublish).toHaveBeenCalledOnce());
  });

  it('names destination data that could not be checked without inventing a delivery result', async () => {
    await open({ bound: ['forwarding-route'], destinations: null });
    expect(screen.getByText(/Destination details could not be checked/)).toBeInTheDocument();
    expect(screen.getByText(/Publishing does not test delivery/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish Optin' })).toBeEnabled();
  });
});

describe('publication progress and recovery', () => {
  it('keeps the dialog open with the actual server error and offers a retry', async () => {
    const onPublish = vi.fn().mockRejectedValueOnce({ message: 'Could not save your latest changes.' }).mockResolvedValue(undefined);
    await open({ onPublish, dirty: true });
    await userEvent.click(screen.getByRole('button', { name: 'Save & publish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your latest changes.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Published version updated' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save & publish' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save & publish' }));
    expect(await screen.findByRole('heading', { name: 'Published version updated' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onPublish).toHaveBeenCalledTimes(2);
  });

  it('prevents duplicate publication and dismissal until the request finishes', async () => {
    let finish: () => void = () => undefined;
    const onPublish = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { supplied } = await open({ onPublish });
    await userEvent.click(screen.getByRole('button', { name: 'Publish Optin' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Publishing…' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toBeDisabled();
    expect(within(dialog).queryByRole('button', { name: 'Close' })).toBeNull();
    await userEvent.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    // The native inert region prevents interaction in the browser; the event
    // guard also protects against a queued action while publication is pending.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Preview design' }));
    expect(supplied.onPreview).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
    expect(onPublish).toHaveBeenCalledOnce();
    await act(async () => { finish(); });
    expect(screen.getByRole('heading', { name: 'Published version updated' })).toBeInTheDocument();
  });

  it('offers inline placement after success and returns focus when Done closes the review', async () => {
    window.wconvertAdmin = { exportUrl: '', homeUrl: 'https://example.org/blog/', inspectParam: 'wconvert-inspect' };
    await open({ displayType: 'inline' });
    await userEvent.click(screen.getByRole('button', { name: 'Publish Optin' }));
    expect(await screen.findByRole('heading', { name: 'Published version updated' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Shortcode for other editors' })).toHaveValue('[wconvert_optin id="01JQ00000000000000000000AA"]');
    expect(screen.queryByText(/Publish this Optin first/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Check your homepage' })).toHaveAttribute('href', 'https://example.org/blog/?wconvert-inspect=1');
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review & publish' })).toHaveFocus());
  });

  it('does not republish an unchanged live version, but still explains inline placement', async () => {
    await open({ displayType: 'inline', optin: { published_at: '2026-09-10T12:00:00Z', deleted_at: null, suspended: null, has_unpublished_changes: false } });
    expect(screen.getByText('Your saved draft matches the published version.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish changes' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Place this Optin on a page' })).toBeInTheDocument();
  });
});

describe('review actions return to the place that can resolve them', () => {
  it.each([
    ['Pages', 'where'], ['When it appears', 'when'], ['Audience', 'who'], ['Schedule & frequency', 'how-often'],
  ])('opens the %s rules and closes review', async (label, section) => {
    const { supplied } = await open();
    await userEvent.click(screen.getByRole('button', { name: label }));
    expect(supplied.onGoToRules).toHaveBeenCalledWith(section);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens destinations and closes review', async () => {
    const { supplied } = await open();
    await userEvent.click(screen.getByRole('button', { name: 'Edit destinations' }));
    expect(supplied.onGoToDestinations).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the actual schedule control for a countdown warning', async () => {
    const { supplied } = await open({ template: design('deadline-panel') });
    await userEvent.click(screen.getByRole('button', { name: /nothing says when this Optin stops running/ }));
    expect(supplied.onGoToSchedule).toHaveBeenCalledOnce();
    expect(supplied.onGoTo).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not pull focus back to the review trigger after opening the preview', async () => {
    const onPreview = vi.fn(() => { screen.getByRole('button', { name: 'Preview canvas' }).focus(); });
    render(<><button>Preview canvas</button><ReadinessDialog {...props({ onPreview })} /></>);
    await userEvent.click(screen.getByRole('button', { name: 'Review & publish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Preview design' }));
    expect(onPreview).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview canvas' })).toHaveFocus());
  });
});
