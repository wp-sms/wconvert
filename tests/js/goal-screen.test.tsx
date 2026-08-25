import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DOCUMENT_STYLE_ID } from '@renderer/mount';

/**
 * The goal-first creation flow, and the decisions in it that are not layout.
 *
 * **The goal screen is the front door**, so it *hides* what a settings list
 * would explain (ADR 0026), and it never advertises Pro for something Pro
 * would not supply. **The gallery filters on Goal only** — Display Type is
 * prefilled by the chosen [[Playbook]] and is never the first question
 * (CONTEXT.md, Display Type). **"Start from scratch" skips the Playbook, never
 * the Goal.** And **nothing is created until the last step**: prefill is a
 * read.
 */
const goals = vi.hoisted(() => ({ listGoals: vi.fn(), listPlaybooks: vi.fn(), prefill: vi.fn() }));
const optins = vi.hoisted(() => ({ createOptin: vi.fn() }));

vi.mock('../../resources/admin/src/goals/api', () => goals);
vi.mock('../../resources/admin/src/optins/api', () => optins);

const { GoalScreen } = await import('../../resources/admin/src/goals/GoalScreen');

/**
 * Three Goals in the three states, as the server resolves them for one
 * install. `recover_cart` is `unavailable` here because the site has no store
 * — which is `unavailable` beating `locked`, already decided in PHP.
 */
const GOALS = [
  {
    id: 'grow_email_list',
    label: 'Grow my email list',
    description: 'Capture email addresses.',
    converting_act: 'submit',
    headline_kind: 'conversion',
    tier: 'free',
    availability: 'ready' as const,
  },
  {
    id: 'promote_offer',
    label: 'Promote a sale or offer',
    description: 'Send visitors to an offer.',
    converting_act: 'click',
    headline_kind: 'conversion',
    tier: 'pro',
    availability: 'locked' as const,
  },
  {
    id: 'recover_cart',
    label: 'Bring shoppers back to their cart',
    description: 'Show shoppers the way back.',
    converting_act: 'click',
    headline_kind: 'conversion',
    tier: 'pro',
    availability: 'unavailable' as const,
  },
];

const PLAYBOOK = {
  id: 'welcome-discount',
  name: 'Welcome discount',
  goal: 'grow_email_list',
  template_id: 'centred-card',
  display_type: 'popup',
  copy: {},
  rules: [],
  targeting: {},
  destination_hint: {},
  notes: 'A first-order discount is the highest-converting trade there is.',
};

const DRAFT = {
  name: 'Welcome discount',
  goal: 'grow_email_list',
  config: {
    playbook_id: 'welcome-discount',
    template_id: 'centred-card',
    template: {
      tokens: { bg: '#ffffff' },
      tree: {
        steps: [
          {
            type: 'stack',
            children: [{ type: 'heading', role: 'headline', text: 'Ten percent off your first order' }],
          },
        ],
      },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  document.getElementById(DOCUMENT_STYLE_ID)?.remove();
  goals.listGoals.mockResolvedValue(GOALS);
  goals.listPlaybooks.mockResolvedValue([PLAYBOOK]);
  goals.prefill.mockResolvedValue(DRAFT);
  optins.createOptin.mockResolvedValue({ id: '01JQZK8N3M4P5Q6R7S8T9V0W1X' });
});

describe('the goal screen', () => {
  /**
   * Absent, not greyed out and not explained. A food blogger with no store
   * reading "requires WooCommerce" learns nothing they can act on (ADR 0026).
   */
  it('hides a Goal this site cannot serve', async () => {
    render(<GoalScreen onCreated={() => undefined} />);

    await screen.findByText('Grow my email list');

    expect(screen.queryByText('Bring shoppers back to their cart')).toBeNull();
  });

  /**
   * **The precedence, on screen.** The cart Goal is `tier: pro` too, so a
   * screen that read `tier` rather than the resolved state would sell Pro to a
   * merchant Pro cannot help. The upsell that IS shown belongs to the Goal
   * whose only missing piece is buyable from us.
   */
  it('offers a locked Goal as an upsell and offers no upsell for an unavailable one', async () => {
    render(<GoalScreen onCreated={() => undefined} />);

    await screen.findByText('Promote a sale or offer');

    expect(screen.getAllByText('Available with WConvert Pro.')).toHaveLength(1);
    expect(screen.queryByText('Bring shoppers back to their cart')).toBeNull();
  });

  it('cannot be chosen while it is an upsell', async () => {
    render(<GoalScreen onCreated={() => undefined} />);

    await screen.findByText('Promote a sale or offer');

    // One Goal is choosable, and it is the ready one.
    expect(screen.getAllByRole('button', { name: 'Choose' })).toHaveLength(1);
  });

  /**
   * The gallery is asked for one thing: the Goal. There is no Display Type
   * argument to pass, because there is no Display Type control to pass it
   * from.
   */
  it('asks the gallery for the chosen Goal and nothing else', async () => {
    render(<GoalScreen onCreated={() => undefined} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Choose' }));

    await waitFor(() => expect(goals.listPlaybooks).toHaveBeenCalledWith('grow_email_list'));
    expect(goals.listPlaybooks).toHaveBeenCalledTimes(1);
  });

  it('shows the Playbooks under it, with the notes that say why they work', async () => {
    render(<GoalScreen onCreated={() => undefined} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Choose' }));

    expect(await screen.findByText('Welcome discount')).toBeInTheDocument();
    expect(screen.getByText(PLAYBOOK.notes)).toBeInTheDocument();
  });

  /**
   * A Goal with no Playbook under it is a real state rather than a broken one:
   * the cart Goal is reachable on a Pro install with a store and ships none,
   * because its Playbooks need the [[Condition]]s that define it. An empty
   * list with nothing said reads as a load that failed.
   */
  it('says so when a Goal has nothing to start from yet', async () => {
    goals.listPlaybooks.mockResolvedValue([]);

    render(<GoalScreen onCreated={() => undefined} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Choose' }));

    expect(await screen.findByText(/No ready-to-run starts for this Goal yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start from scratch' })).toBeInTheDocument();
  });

  /**
   * **"Start from scratch" skips the Playbook, never the Goal.** The Goal
   * still travels; only the Playbook is absent.
   */
  it('starts from scratch under the Goal already chosen', async () => {
    goals.prefill.mockResolvedValue({ name: 'Grow my email list', goal: 'grow_email_list', config: { rules: [] } });

    render(<GoalScreen onCreated={() => undefined} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Choose' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Start from scratch' }));

    expect(goals.prefill).toHaveBeenCalledWith('grow_email_list', undefined);
  });

  /**
   * **Prefill persists nothing until the merchant saves.** Walking the whole
   * flow and stopping at the preview writes nothing.
   */
  it('creates nothing until the merchant says so', async () => {
    render(<GoalScreen onCreated={() => undefined} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Choose' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Use this Playbook' }));

    await screen.findByRole('button', { name: 'Create this Optin' });

    expect(goals.prefill).toHaveBeenCalledWith('grow_email_list', 'welcome-discount');
    expect(optins.createOptin).not.toHaveBeenCalled();
  });

  /**
   * The preview is the REAL design with the REAL words, drawn by the same
   * dependency-free renderer the loader imports — so what the merchant
   * approves is what a visitor sees, and there is no static thumbnail to
   * produce or to let go stale (ADR 0010).
   *
   * Asserted by the document-level `<style>` the renderer installs, because
   * the rendered tree lives inside a **closed** shadow root and this test is
   * not the thing that mounted it. That closure is the point of it
   * (ADR 0009), so reaching in to check would be asserting it was open. What
   * the copy renders AS is proven where it can be — `tests/js/playbook-copy.test.ts`.
   */
  it('previews the prefilled Optin through the renderer the loader uses', async () => {
    render(<GoalScreen onCreated={() => undefined} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Choose' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Use this Playbook' }));

    await screen.findByRole('button', { name: 'Create this Optin' });

    await waitFor(() => expect(document.getElementById(DOCUMENT_STYLE_ID)).not.toBeNull());
  });

  /**
   * A draft with no Template — "start from scratch" — has nothing to preview,
   * and says so rather than showing an empty frame that reads as a render
   * that failed.
   */
  it('says so when there is no design to preview yet', async () => {
    goals.prefill.mockResolvedValue({ name: 'Grow my email list', goal: 'grow_email_list', config: { rules: [] } });

    render(<GoalScreen onCreated={() => undefined} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Choose' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Start from scratch' }));

    expect(await screen.findByText(/Choose a Template in the builder/)).toBeInTheDocument();
  });

  it('saves the draft exactly as prefill handed it over', async () => {
    render(<GoalScreen onCreated={() => undefined} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Choose' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Use this Playbook' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Create this Optin' }));

    await waitFor(() =>
      expect(optins.createOptin).toHaveBeenCalledWith(DRAFT.name, DRAFT.goal, DRAFT.config),
    );
  });

  /**
   * **And it lands in the builder**, which is where this flow has always said
   * it ends: pick a [[Goal]], pick a [[Playbook]] under it, land in an editor
   * holding a prefilled Optin. The created Optin is addressed by id, so the
   * create has to hand one back rather than discard the response.
   */
  it('hands the created Optin to the builder', async () => {
    const created = vi.fn();

    render(<GoalScreen onCreated={created} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Choose' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Use this Playbook' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Create this Optin' }));

    await waitFor(() => expect(created).toHaveBeenCalledWith('01JQZK8N3M4P5Q6R7S8T9V0W1X'));
  });
});
