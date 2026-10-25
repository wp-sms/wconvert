import { displayPlan } from './support/display-entry';
import { treeFixture } from './support/journey';
import { CLICK_OUTCOME } from './support/outcomes';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DOCUMENT_STYLE_ID } from '@renderer/mount';
import { ruleTypes } from './support/rule-types';
import type { GoalGallery, OnlineSetup, PlaybookEntry } from '../../resources/admin/src/goals/api';

/**
 * The goal-first creation flow, and the decisions in it that are not layout.
 *
 * **The goal screen is the front door**, so it *hides* what a settings list
 * would explain (ADR 0026). **The server query filters on Goal only**; step 2
 * is the one template gallery (ADR 0171), refined by Format, Asks for, Plan and
 * a collection without making any of them the first question. **"Choose a
 * design myself" skips the Playbook, never the Goal.** Browsing reads only;
 * Use template creates a draft and opens the editor, installing an online
 * template first.
 */
const goals = vi.hoisted(() => ({ listGoals: vi.fn(), readGoalGallery: vi.fn(), prefill: vi.fn(), previewPlaybooks: vi.fn() }));
const catalog = vi.hoisted(() => ({ catalogStatus: vi.fn(), refreshCatalog: vi.fn(), setCatalogConsent: vi.fn(), installSetup: vi.fn(), installDesign: vi.fn(), previewDesign: vi.fn() }));
vi.mock('../../resources/admin/src/templates/catalog', () => catalog);
const picker = vi.hoisted(() => ({ pickerData: vi.fn(), savePreferences: vi.fn(), saveOccasions: vi.fn() }));
vi.mock('../../resources/admin/src/discovery/api', () => picker);
const optins = vi.hoisted(() => ({ createOptin: vi.fn() }));
const rules = vi.hoisted(() => ({ getRules: vi.fn() }));

const destinationsApi = vi.hoisted(() => ({ readDestinations: vi.fn() }));
vi.mock('../../resources/admin/src/destinations/api', () => destinationsApi);
vi.mock('../../resources/admin/src/goals/api', () => goals);
vi.mock('../../resources/admin/src/optins/api', () => optins);
vi.mock('../../resources/admin/src/builder/api', async (original) => ({ ...(await original<typeof import('../../resources/admin/src/builder/api')>()), ...rules }));

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
    needs_a_capture: false,
    grows_a_list: false, outcome: CLICK_OUTCOME,
    headline_kind: 'conversion',
    tier: 'free',
    availability: 'ready' as const,
  },
  {
    id: 'promote_offer',
    label: 'Promote a sale or offer',
    description: 'Send visitors to an offer.',
    needs_a_capture: false,
    grows_a_list: false, outcome: CLICK_OUTCOME,
    headline_kind: 'conversion',
    tier: 'pro',
    availability: 'locked' as const,
  },
  {
    id: 'recover_cart',
    label: 'Bring shoppers back to their cart',
    description: 'Show shoppers the way back.',
    needs_a_capture: false,
    grows_a_list: false, outcome: CLICK_OUTCOME,
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
  setup: { display_type: 'popup', display_rules: displayPlan([{ type: 'time_on_page', seconds: 8 }]), targeting: {} },
  notes: 'A first-order discount is the highest-converting trade there is.',
  facets: { act: 'submit' as const, captures: ['email'], shape: 'stack', has_image: false, asks_consent: false },
  /**
   * **The design this Playbook would prefill, with its words already in it.**
   *
   * Composed by `Prefill` on the server, which is the whole reason it travels:
   * binding `copy` to [[Slot Role]]s is the one thing that must not have two
   * implementations, so the chooser draws exactly what creating the draft would store.
   */
  template: {
    tokens: { bg: '#ffffff' },
    tree: treeFixture({
      steps: [
        {
          type: 'stack',
          children: [
            { type: 'heading', role: 'headline', text: 'Ten percent off your first order' },
            { type: 'field', name: 'email', label: 'Email address' },
            { type: 'button', role: 'cta_label', label: 'Send my code', action: 'submit' },
          ],
        },
        { type: 'stack', children: [{ type: 'heading', role: 'success_headline', text: 'Done' }] },
      ],
    }),
  },
};

const DRAFT = {
  name: 'Welcome discount',
  goal: 'grow_email_list',
  config: {
    playbook_id: 'welcome-discount',
    template_id: 'centred-card',
    template: {
      tokens: { bg: '#ffffff' },
      tree: treeFixture({
        steps: [
          {
            type: 'stack',
            children: [{ type: 'heading', role: 'headline', text: 'Ten percent off your first order' }],
          },
        ],
      }),
    },
  },
};

const NO_LIBRARY = { configured: false, consent: 'unanswered' } as const;
function galleryOf(setups: unknown[], online: OnlineSetup[] = [], library: GoalGallery['library'] = NO_LIBRARY): GoalGallery {
  return { setups: setups as PlaybookEntry[], online, library };
}
const FACETS = { act: 'submit' as const, captures: ['email'], shape: 'stack', has_image: false, asks_consent: false };
const onlineSetup = (id: string, more: Partial<OnlineSetup> = {}): OnlineSetup => ({
  id, revision: 1, sha256: 'a'.repeat(64), name: `Online ${id}`, goal: 'grow_email_list', tier: 'free', state: 'install', installed_playbook_id: null,
  business_types: [], design: { id: `${id}-design`, name: `Online ${id}`, tier: 'free' }, display_type: 'popup', facets: FACETS,
  thumbnail: { '1x': `https://templates.example/${id}.webp`, '2x': `https://templates.example/${id}@2x.webp` }, tags: [], preview_url: `https://wconvert.io/templates/${id}/`, ...more,
});

beforeEach(() => {
  vi.clearAllMocks();
  destinationsApi.readDestinations.mockRejectedValue(new Error('Not needed by this test'));
  picker.pickerData.mockResolvedValue({ schema: 1, today: '2026-11-06', timezone: 'Asia/Muscat', collections: [], preferences: { schema: 1, revision: 0, saved: [], hidden: [] }, occasions: { schema: 1, revision: 0, items: [] } });
  picker.savePreferences.mockImplementation(value => Promise.resolve({ ...value, revision: value.revision + 1 }));
  goals.previewPlaybooks.mockResolvedValue({ entries: [] });
  document.getElementById(DOCUMENT_STYLE_ID)?.remove();
  goals.listGoals.mockResolvedValue(GOALS);
  goals.readGoalGallery.mockResolvedValue(galleryOf([PLAYBOOK]));
  goals.prefill.mockResolvedValue(DRAFT);
  rules.getRules.mockResolvedValue(ruleTypes());
  optins.createOptin.mockResolvedValue({ id: '01JQZK8N3M4P5Q6R7S8T9V0W1X' });
});


const pickGoal = async () => userEvent.click(await screen.findByRole('button', { name: /^Choose/ }));
const cardOf = async (name: string) => (await screen.findByRole('heading', { name, level: 3 })).closest('li')!;
const useTemplate = async (name = PLAYBOOK.name) => userEvent.click(within(await cardOf(name)).getByRole('button', { name: 'Use template' }));
const unloadPrevented = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};
const withAdmin = (settings: Record<string, unknown>) => {
  window.wconvertAdmin = { exportUrl: '', ...settings } as typeof window.wconvertAdmin;
  onTestFinished(() => { delete window.wconvertAdmin; });
};
const moreFilters = async () => userEvent.click(screen.getByRole('button', { name: /More filters/ }));

describe('step 1: a goal', () => {
  it('preserves ready, locked and unavailable Goal semantics on a paid install', async () => {
    // A paid install meeting a Goal it does not have (ADR 0116).
    withAdmin({ installedTier: 'pro' });
    render(<GoalScreen onCreated={vi.fn()} />);
    await screen.findByText('Grow my email list');
    expect(screen.getByText('Promote a sale or offer')).toBeInTheDocument();
    expect(screen.getByText(/Available with/)).toBeInTheDocument();
    expect(screen.queryByText('Bring shoppers back to their cart')).not.toBeInTheDocument();
    expect(screen.getByText('Choice 1 of 2')).toBeInTheDocument();
  });

  /** A free install is sold no Goal: the locked card is not drawn at all (ADR 0116). */
  it('hides a locked Goal on a free install', async () => {
    render(<GoalScreen onCreated={vi.fn()} />);
    await screen.findByText('Grow my email list');
    expect(screen.queryByText('Promote a sale or offer')).not.toBeInTheDocument();
    expect(screen.queryByText(/Available with/)).not.toBeInTheDocument();
  });

  it('keeps loading separate from an empty Goal registry and offers retry on failure', async () => {
    goals.listGoals.mockRejectedValueOnce(new Error('Goals unavailable.'));
    render(<GoalScreen onCreated={vi.fn()} />);
    await screen.findByText('Goals unavailable.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Grow my email list')).toBeInTheDocument();
  });

  it('explains a successfully read empty Goal registry', async () => {
    goals.listGoals.mockResolvedValue([]);
    render(<GoalScreen onCreated={vi.fn()} />);
    expect(await screen.findByText('No goals available')).toBeInTheDocument();
  });
});

describe('step 2: one template gallery', () => {
  it('reads the chosen goal’s gallery and writes nothing while browsing', async () => {
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    const card = await cardOf('Welcome discount');
    expect(goals.readGoalGallery).toHaveBeenCalledWith(GOALS[0].id);
    expect(screen.getByText('Choice 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose a template', level: 2 })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Goal: Grow my email list' })).toBeVisible();
    // One row of what the template is: format and what it asks for.
    expect(within(card).getByText('Popup')).toBeVisible();
    expect(within(card).getByText('Email')).toBeVisible();
    expect(screen.getByText('1 of 1')).toHaveAttribute('role', 'status');
    expect(optins.createOptin).not.toHaveBeenCalled();
    expect(goals.prefill).not.toHaveBeenCalled();
  });

  it('draws each local template live on the stage', async () => {
    const { container } = render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await cardOf('Welcome discount');
    await waitFor(() => expect(container.querySelectorAll('.wconvert-template-card .wconvert-stage[data-display-type="popup"] .wconvert-preview')).toHaveLength(1));
  });

  it('filters by format, offering only the formats it has', async () => {
    const inline = { ...PLAYBOOK, id: 'inline-signup', name: 'Inline signup', display_type: 'inline' };
    goals.readGoalGallery.mockResolvedValue(galleryOf([PLAYBOOK, inline]));
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await cardOf('Welcome discount');
    const format = screen.getByRole('combobox', { name: 'Format' });
    expect(within(format).getAllByRole('option').map(option => option.textContent)).toEqual(['All formats', 'Popup', 'Inline form']);
    await userEvent.selectOptions(format, 'inline');
    expect(screen.queryByRole('heading', { name: 'Welcome discount' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Inline signup' })).toBeVisible();
    expect(goals.readGoalGallery).toHaveBeenCalledTimes(1);
  });

  it('finds the phone templates under More filters, and says the filter as a chip that removes it', async () => {
    const sms = { ...PLAYBOOK, id: 'sms', name: 'Text signup', facets: { ...FACETS, captures: ['phone'] } };
    goals.readGoalGallery.mockResolvedValue(galleryOf([{ ...PLAYBOOK, facets: FACETS }, sms]));
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await cardOf('Text signup');
    await moreFilters();
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Asks for' }), 'phone');
    expect(screen.queryByRole('heading', { name: 'Welcome discount' })).toBeNull();
    expect(within(await cardOf('Text signup')).getByText('Phone')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter: Asks for phone' }));
    expect(screen.getByRole('heading', { name: 'Welcome discount' })).toBeVisible();
  });

  it('says No templates match and clears every filter at once', async () => {
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await cardOf('Welcome discount');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'nothing like this');
    expect(screen.getByText('No templates match')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await cardOf('Welcome discount')).toBeVisible();
  });

  it('shows the server recommendation as a chip, first', async () => {
    goals.readGoalGallery.mockResolvedValue(galleryOf([{ ...PLAYBOOK, id: 'other', name: 'Other' }, { ...PLAYBOOK, recommendation: 'Recommended for stores' }]));
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await cardOf('Other');
    expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(['Welcome discount', 'Other']);
    expect(within(await cardOf('Welcome discount')).getByText('Recommended')).toBeVisible();
  });

  it('hides a setup whose design is missing from this site', async () => {
    goals.readGoalGallery.mockResolvedValue(galleryOf([PLAYBOOK, { ...PLAYBOOK, id: 'gone', name: 'Gone', availability: 'unavailable' }]));
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await cardOf('Welcome discount');
    expect(screen.queryByRole('heading', { name: 'Gone' })).toBeNull();
  });

  it('switches goal from the header without leaving step 2', async () => {
    const second = { ...GOALS[0], id: 'collect_enquiries', label: 'Collect enquiries' };
    goals.listGoals.mockResolvedValue([GOALS[0], second]);
    render(<GoalScreen onCreated={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Choose: Grow my email list' }));
    await cardOf('Welcome discount');
    await userEvent.click(screen.getByRole('button', { name: 'Goal: Grow my email list' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: /^Collect enquiries/ }));
    expect(await screen.findByRole('button', { name: 'Goal: Collect enquiries' })).toBeVisible();
    expect(goals.readGoalGallery).toHaveBeenLastCalledWith('collect_enquiries');
  });

  it('discards an abandoned goal’s late templates', async () => {
    const second = { ...GOALS[0], id: 'collect_enquiries', label: 'Collect enquiries' };
    goals.listGoals.mockResolvedValue([GOALS[0], second]);
    let old!: (gallery: GoalGallery) => void;
    goals.readGoalGallery.mockReturnValueOnce(new Promise(resolve => { old = resolve; }));
    render(<GoalScreen onCreated={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Choose: Grow my email list' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Goal: Grow my email list' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: /^Collect enquiries/ }));
    await cardOf('Welcome discount');
    await act(async () => old(galleryOf([{ ...PLAYBOOK, name: 'Abandoned result' }])));
    expect(screen.queryByRole('heading', { name: 'Abandoned result' })).toBeNull();
  });

  it('retries a failed gallery read on the same goal', async () => {
    goals.readGoalGallery.mockRejectedValueOnce(new Error('Templates unavailable.'));
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await screen.findByText('Templates unavailable.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await cardOf('Welcome discount');
    expect(goals.readGoalGallery).toHaveBeenLastCalledWith(GOALS[0].id);
  });

  it('saves a design through personal preferences and filters by Saved', async () => {
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await userEvent.click(within(await cardOf('Welcome discount')).getByRole('button', { name: 'Save Welcome discount' }));
    await waitFor(() => expect(picker.savePreferences).toHaveBeenCalledWith(expect.objectContaining({ saved: ['registered:centred-card'], revision: 0 })));
    await moreFilters();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Saved only' }));
    expect(screen.getByRole('button', { name: /More filters/ })).toHaveTextContent('1');
    expect(screen.getByRole('heading', { name: 'Welcome discount' })).toBeVisible();
    expect(optins.createOptin).not.toHaveBeenCalled();
  });

  it('opens a template larger, with its gist, and returns focus to the card', async () => {
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    const open = within(await cardOf('Welcome discount')).getByRole('button', { name: 'Preview Welcome discount' });
    await userEvent.click(open);
    const dialog = await screen.findByRole('dialog', { name: 'Welcome discount' });
    expect(within(dialog).getByText('A first-order discount is the highest-converting trade there is.')).toBeVisible();
    expect(within(dialog).getByRole('radio', { name: 'Actual size' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Use template' })).toBeEnabled();
    expect(optins.createOptin).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(open).toHaveFocus());
  });

  it('requests only the prepared trees on the first page of 500, 24 per batch', async () => {
    const metadata = Array.from({ length: 500 }, (_, at) => ({ ...PLAYBOOK, id: `start-${at}`, name: `Start ${at}`, template_id: `card-${at}`, design_key: `registered:card-${at}`, revision: `revision-${at}`, template: undefined }));
    goals.readGoalGallery.mockResolvedValue(galleryOf(metadata));
    goals.previewPlaybooks.mockImplementation((_goal, ids: string[]) => Promise.resolve({ entries: metadata.filter(entry => ids.includes(entry.id)).map(entry => ({ ...entry, template: PLAYBOOK.template })) }));
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await screen.findByText('Page 1 of 21');
    expect(screen.getAllByRole('button', { name: /^Preview Start/ })).toHaveLength(24);
    await waitFor(() => expect(goals.previewPlaybooks).toHaveBeenCalled());
    expect(goals.previewPlaybooks.mock.calls.flatMap(call => call[1])).toHaveLength(24);
  });
});

describe('Pro hints on a free install', () => {
  const locked = onlineSetup('night-sale', { state: 'locked', tier: 'pro', display_type: 'slide_in', design: { id: 'night', name: 'Night sale', tier: 'pro' } });

  it('mixes a locked template in where it falls, with its plan and a link instead of a control', async () => {
    withAdmin({ installedTier: 'free', proHints: true });
    goals.readGoalGallery.mockResolvedValue(galleryOf([PLAYBOOK], [locked], { configured: true, consent: 'yes' }));
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    const card = await cardOf('Online night-sale');
    expect(within(card).getByText('Pro')).toBeVisible();
    expect(within(card).getByRole('link', { name: 'See this design' })).toHaveAttribute('href', 'https://wconvert.io/templates/night-sale/');
    expect(within(card).queryByRole('button', { name: 'Use template' })).toBeNull();
    // A format only Pro has says so in the Format select, and Plan separates the locked cards.
    expect(within(screen.getByRole('combobox', { name: 'Format' })).getByRole('option', { name: 'Slide-in · Pro' })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('group', { name: 'Plan' })).getByRole('radio', { name: 'Free' }));
    expect(screen.queryByRole('heading', { name: 'Online night-sale' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Welcome discount' })).toBeVisible();
  });

  it('offers no Plan and no locked card where hints are off', async () => {
    withAdmin({ installedTier: 'free', proHints: false });
    goals.readGoalGallery.mockResolvedValue(galleryOf([PLAYBOOK], [locked], { configured: true, consent: 'yes' }));
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await cardOf('Welcome discount');
    expect(screen.queryByRole('heading', { name: 'Online night-sale' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Plan' })).toBeNull();
  });
});

describe('the online library', () => {
  it('asks once, at the end of the grid, and reads the gallery again when answered', async () => {
    goals.readGoalGallery.mockResolvedValue(galleryOf([PLAYBOOK], [], { configured: true, consent: 'unanswered' }));
    catalog.setCatalogConsent.mockResolvedValue({});
    catalog.refreshCatalog.mockResolvedValue({});
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    expect(await screen.findByRole('heading', { name: 'See more templates from the WConvert library?' })).toBeVisible();
    expect(catalog.refreshCatalog).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Show online templates' }));
    expect(catalog.setCatalogConsent).toHaveBeenCalledWith(true);
    await waitFor(() => expect(goals.readGoalGallery).toHaveBeenCalledTimes(2));
  });

  it('keeps the grid when reading it again fails, and says so', async () => {
    goals.readGoalGallery.mockResolvedValueOnce(galleryOf([PLAYBOOK], [], { configured: true, consent: 'unanswered' }))
      .mockRejectedValueOnce(new Error('The library could not be reached.'));
    catalog.setCatalogConsent.mockResolvedValue({});
    catalog.refreshCatalog.mockResolvedValue({});
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await userEvent.click(await screen.findByRole('button', { name: 'Show online templates' }));
    expect(await screen.findByText('The library could not be reached.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Welcome discount' })).toBeVisible();
  });

  it('installs an online template silently, then creates the draft from what it became', async () => {
    goals.readGoalGallery.mockResolvedValue(galleryOf([PLAYBOOK], [onlineSetup('welcome-online')], { configured: true, consent: 'yes' }));
    catalog.installSetup.mockResolvedValue({ playbook_id: 'setup-1-welcome-online', template_id: 'design-1-welcome-online-design', status: {} });
    const created = vi.fn();
    render(<GoalScreen onCreated={created} />);
    await pickGoal();
    await useTemplate('Online welcome-online');
    await waitFor(() => expect(created).toHaveBeenCalledOnce());
    expect(catalog.installSetup).toHaveBeenCalledExactlyOnceWith('welcome-online', 'a'.repeat(64));
    expect(goals.prefill).toHaveBeenCalledWith(GOALS[0].id, 'setup-1-welcome-online');
  });

  it('keeps saying Adding… from the install until the draft is created', async () => {
    goals.readGoalGallery.mockResolvedValue(galleryOf([], [onlineSetup('welcome-online')], { configured: true, consent: 'yes' }));
    catalog.installSetup.mockResolvedValue({ playbook_id: 'setup-1-welcome-online', template_id: 'x', status: {} });
    goals.prefill.mockReturnValue(new Promise(() => undefined));
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await useTemplate('Online welcome-online');
    await waitFor(() => expect(goals.prefill).toHaveBeenCalled());
    expect(within(await cardOf('Online welcome-online')).getByRole('button', { name: 'Adding…' })).toBeDisabled();
  });

  it('says on the card when adding fails, and tries again from there', async () => {
    goals.readGoalGallery.mockResolvedValue(galleryOf([], [onlineSetup('welcome-online')], { configured: true, consent: 'yes' }));
    catalog.installSetup.mockRejectedValueOnce(new Error('The library could not be reached.')).mockResolvedValue({ playbook_id: 'setup-1-welcome-online', template_id: 'x', status: {} });
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await useTemplate('Online welcome-online');
    const card = await cardOf('Online welcome-online');
    expect(await within(card).findByRole('alert')).toHaveTextContent('Couldn’t add this template.');
    expect(goals.prefill).not.toHaveBeenCalled();
    await userEvent.click(within(card).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(goals.prefill).toHaveBeenCalledWith(GOALS[0].id, 'setup-1-welcome-online'));
  });
});

describe('collections', () => {
  const collection = { id: 'sale', revision: 'r', name: 'Sale planning', description: 'Before, during and after', business_types: [], priority: 1, cover: 'sale',
    event: { family: 'black-friday', start: '2026-11-27', end_exclusive: '2026-12-01', feature_start: '2026-10-16', feature_end_exclusive: '2026-12-01' },
    items: [{ setup_id: PLAYBOOK.id, stage: 'before' }, { setup_id: 'bar', stage: 'during' }] };
  const bar = { ...PLAYBOOK, id: 'bar', name: 'Countdown bar', display_type: 'floating_bar' };
  const other = { ...PLAYBOOK, id: 'other', name: 'Other' };

  it('filters the grid to a collection from the shelf, with When for the stages it has', async () => {
    const data = await picker.pickerData();
    picker.pickerData.mockResolvedValue({ ...data, collections: [collection] });
    goals.readGoalGallery.mockResolvedValue(galleryOf([PLAYBOOK, bar, other]));
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await userEvent.click(await screen.findByRole('button', { name: 'Sale planning, 2 templates' }));
    expect(screen.queryByRole('heading', { name: 'Other' })).toBeNull();
    const when = screen.getByRole('group', { name: 'When' });
    await userEvent.click(within(when).getByRole('radio', { name: 'During' }));
    expect(screen.queryByRole('heading', { name: 'Welcome discount' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Countdown bar' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Show all templates' }));
    expect(await cardOf('Other')).toBeVisible();
  });

  it('opens a seasonal collection whose event overlaps the occasion even when it started first', async () => {
    const data = await picker.pickerData();
    picker.pickerData.mockResolvedValue({ ...data, collections: [collection],
      occasions: { schema: 1, revision: 3, items: [{ id: 'late-sale', name: 'Late sale', start: '2026-11-29', end: '2026-12-03' }] } });
    goals.readGoalGallery.mockResolvedValue(galleryOf([PLAYBOOK, bar, other]));
    render(<GoalScreen occasion="late-sale" onCreated={vi.fn()} />);
    await pickGoal();
    expect(await screen.findByText('Before, during and after')).toBeVisible();
  });

  /** ADR 0149 §3, ADR 0171: a campaign made inside an occasion starts in its collection, with its dates. */
  it('opens the occasion’s seasonal collection and creates into the occasion with its dates', async () => {
    const data = await picker.pickerData();
    picker.pickerData.mockResolvedValue({ ...data, collections: [collection],
      occasions: { schema: 1, revision: 3, items: [{ id: 'black-friday-2026', name: 'Black Friday 2026', start: '2026-11-20', end: '2026-12-01' }] } });
    goals.readGoalGallery.mockResolvedValue(galleryOf([PLAYBOOK, bar, other]));
    const draft = { name: GOALS[0].label, goal: GOALS[0].id, config: { rules: [] } };
    goals.prefill.mockResolvedValue(draft);
    const created = vi.fn();
    render(<GoalScreen occasion="black-friday-2026" onCreated={created} />);
    await pickGoal();
    expect(await screen.findByText('Before, during and after')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Other' })).toBeNull();
    await useTemplate();
    await waitFor(() => expect(created).toHaveBeenCalled());
    expect(optins.createOptin).toHaveBeenCalledWith(draft.name, draft.goal, {
      rules: [], occasion: 'black-friday-2026', starts_at: '2026-11-20 00:00', ends_at: '2026-12-02 00:00',
    });
  });
});

describe('creating the draft', () => {
  it('creates exactly the prefilled draft and hands it straight to the editor', async () => {
    const created = vi.fn();
    render(<GoalScreen onCreated={created} />);
    await pickGoal();
    await useTemplate();
    await waitFor(() => expect(created).toHaveBeenCalledWith('01JQZK8N3M4P5Q6R7S8T9V0W1X'));
    expect(goals.prefill).toHaveBeenCalledWith(GOALS[0].id, PLAYBOOK.id);
    expect(optins.createOptin).toHaveBeenCalledExactlyOnceWith(DRAFT.name, DRAFT.goal, DRAFT.config);
  });

  it('creates the exact reviewed revision of a prepared template', async () => {
    const metadata = { ...PLAYBOOK, revision: 'reviewed-revision', design_key: 'registered:card', template: undefined, availability: 'ready' };
    goals.readGoalGallery.mockResolvedValue(galleryOf([metadata]));
    goals.previewPlaybooks.mockResolvedValue({ entries: [{ ...metadata, template: PLAYBOOK.template, prepared_revision: 'prepared' }] });
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await waitFor(() => expect(goals.previewPlaybooks).toHaveBeenCalledWith(GOALS[0].id, [PLAYBOOK.id]));
    await useTemplate();
    await waitFor(() => expect(goals.prefill).toHaveBeenCalledWith(GOALS[0].id, PLAYBOOK.id, 'reviewed-revision', 'prepared'));
  });

  it('creates a blank draft under the goal already chosen', async () => {
    const draft = { name: GOALS[0].label, goal: GOALS[0].id, config: { rules: [] } };
    goals.prefill.mockResolvedValue(draft);
    const created = vi.fn();
    render(<GoalScreen onCreated={created} />);
    await pickGoal();
    await cardOf('Welcome discount');
    await userEvent.click(screen.getByRole('button', { name: 'Choose a design myself' }));
    await waitFor(() => expect(created).toHaveBeenCalled());
    expect(goals.prefill).toHaveBeenCalledWith(GOALS[0].id, undefined);
  });

  it('offers a blank draft when this goal has no templates yet', async () => {
    goals.readGoalGallery.mockResolvedValue(galleryOf([]));
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    expect(await screen.findByText('No templates for this goal yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a design myself' })).toBeEnabled();
  });

  it('guards every way out throughout prefill and POST', async () => {
    let finishPrefill!: (draft: unknown) => void, finishCreate!: (draft: unknown) => void;
    goals.prefill.mockReturnValue(new Promise(resolve => { finishPrefill = resolve; }));
    optins.createOptin.mockReturnValue(new Promise(resolve => { finishCreate = resolve; }));
    const busy = vi.fn();
    render(<GoalScreen onCreated={vi.fn()} onBusyChange={busy} />);
    expect(unloadPrevented()).toBe(false);
    await pickGoal();
    await useTemplate();
    expect(within(await cardOf('Welcome discount')).getByRole('button', { name: 'Adding…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Choose a design myself' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Goal: Grow my email list' })).toBeDisabled();
    expect(busy).toHaveBeenLastCalledWith(true);
    expect(unloadPrevented()).toBe(true);
    await act(async () => finishPrefill(DRAFT));
    expect(unloadPrevented()).toBe(true);
    await act(async () => finishCreate({ id: 'created' }));
    expect(busy).toHaveBeenLastCalledWith(false);
    expect(unloadPrevented()).toBe(false);
  });

  it('suppresses duplicate same-tick start events', async () => {
    goals.prefill.mockReturnValue(new Promise(() => undefined));
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    const button = within(await cardOf('Welcome discount')).getByRole('button', { name: 'Use template' });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(goals.prefill).toHaveBeenCalledTimes(1);
  });

  it('retries a failed prefill without claiming a campaign was created', async () => {
    goals.prefill.mockRejectedValueOnce(new Error('Campaign setup unavailable.'));
    render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await useTemplate();
    await screen.findByText('Campaign setup unavailable.');
    expect(optins.createOptin).not.toHaveBeenCalled();
    expect(screen.queryByText(/Draft creation could not be confirmed/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(optins.createOptin).toHaveBeenCalledTimes(1));
  });

  it('does not automatically retry a possibly committed POST', async () => {
    optins.createOptin.mockRejectedValueOnce(new Error('Network interrupted.'));
    const created = vi.fn(), check = vi.fn();
    render(<GoalScreen onCreated={created} onCheckOptins={check} />);
    await pickGoal();
    await useTemplate();
    await screen.findByText(/Draft creation could not be confirmed/);
    expect(within(await cardOf('Welcome discount')).getByRole('button', { name: 'Use template' })).toBeDisabled();
    expect(unloadPrevented()).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Check campaigns' }));
    expect(check).toHaveBeenCalledOnce();
    expect(optins.createOptin).toHaveBeenCalledTimes(1);
    expect(created).not.toHaveBeenCalled();
  });

  it('discards a prefill after the flow closes, before issuing any POST', async () => {
    let finish!: (draft: unknown) => void;
    goals.prefill.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { unmount } = render(<GoalScreen onCreated={vi.fn()} />);
    await pickGoal();
    await useTemplate();
    unmount();
    expect(unloadPrevented()).toBe(false);
    await act(async () => finish(DRAFT));
    expect(optins.createOptin).not.toHaveBeenCalled();
  });

  it('does not reopen the editor after the creation flow has unmounted', async () => {
    let finish!: (draft: unknown) => void;
    optins.createOptin.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const created = vi.fn(), { unmount } = render(<GoalScreen onCreated={created} />);
    await pickGoal();
    await useTemplate();
    await waitFor(() => expect(optins.createOptin).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => finish({ id: 'created' }));
    expect(created).not.toHaveBeenCalled();
  });
});
