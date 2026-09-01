import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ruleTypes } from './support/rule-types';
import type { TemplateEntry } from '../../resources/admin/src/templates/api';

/**
 * The builder shell, against the four decisions #69 and #71 make about it that
 * are not layout.
 *
 * #29 drew the line — *"Not a TDD seam: React component structure, panel
 * layout, gallery chrome"* — and none of these is on the far side of it:
 *
 * - **~~Four~~ five tabs.** Triggers, Conditions and page targeting are three
 *   answers to one question, and a merchant arrives expecting them together —
 *   that merge is unchanged. What is new beside it is **Structure**, which is
 *   the other view of the document Content already edits. Whether these editors
 *   reach the same screen is a fact about the product.
 * - **The preview is beside every tab.** It lived inside the settings panel, so
 *   editing a Trigger showed no preview at all — the exact failure the pinned
 *   column exists to end.
 * - **This Optin's numbers are here.** *Is this change worth making?* is asked
 *   in the editor and was answerable two screens away, and the read is
 *   swallowed on failure, so an analytics outage must not cost anyone a Save.
 * - **Leaving with unsaved work asks first.** This admin does not save as you
 *   type, deliberately; the price of that is a question at the one door out.
 */

const builder = vi.hoisted(() => ({
  getOptin: vi.fn(),
  getRules: vi.fn(),
  saveOptin: vi.fn(),
  getThemeTokens: vi.fn(),
}));

const templates = vi.hoisted(() => ({ listTemplates: vi.fn(), getTemplateTrees: vi.fn() }));
const stats = vi.hoisted(() => ({ readDashboard: vi.fn() }));
const destinations = vi.hoisted(() => ({ readDestinations: vi.fn() }));
const goals = vi.hoisted(() => ({ listGoals: vi.fn(), listPlaybooks: vi.fn() }));

/*
 * Spread over the real module, like the three below it. `DEGRADED_FROM` is a
 * VALUE this module exports and `presets.ts` reads it while building a rule's
 * sentence — replacing the module wholesale left it undefined, which the
 * readiness panel is the first thing on this screen to walk into.
 */
vi.mock('../../resources/admin/src/builder/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/builder/api')>()),
  ...builder,
}));
vi.mock('../../resources/admin/src/templates/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/templates/api')>()),
  ...templates,
}));
/*
 * Spread over the real module rather than replacing it, exactly as
 * `templates/api` is above. `readDashboard` is the fetch and belongs stubbed;
 * `numbersByOptin` beside it is a pure walk over the payload this file already
 * writes by hand, and stubbing the module wholesale replaced it with
 * `undefined` — a builder that silently showed no numbers at all.
 */
vi.mock('../../resources/admin/src/stats/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/stats/api')>()),
  ...stats,
}));
vi.mock('../../resources/admin/src/destinations/api', () => destinations);
vi.mock('../../resources/admin/src/goals/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/goals/api')>()),
  ...goals,
}));

const { OptinBuilder } = await import('../../resources/admin/src/builder/OptinBuilder');

const ENTRY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8'),
) as TemplateEntry;

const ID = '01JQ00000000000000000000AA';

const vocabulary = ruleTypes();

const LABELS = {
  roles: { headline: 'Headline', body: 'Body text', fine_print: 'Fine print' },
  nodes: { heading: 'Heading', text: 'Text', button: 'Button', consent: 'Consent checkbox' },
  layouts: { stack: 'Column', row: 'Row', split: 'Side by side', grid: 'Grid' },
  // The menu shows what a layout DOES, because *Row* and *Side by side* are two
  // words a merchant cannot tell apart from their names alone.
  layoutNotes: {
    stack: 'Blocks stacked top to bottom.',
    row: 'Blocks along one line.',
    split: 'Two panes, each holding its own blocks.',
  },
  layoutParams: { 'split.ratio': 'How the space is divided' },
  layoutParamValues: {
    'split.ratio.0.35': 'Narrow left',
    'split.ratio.0.5': 'Even',
    'split.ratio.0.65': 'Narrow right',
  },
  nodeParams: {
    'heading.level': 'Heading rank',
    'image.fit': 'How the picture fills its space',
    'field.required': 'Must they fill this in?',
  },
  nodeParamValues: {
    'heading.level.1': 'Main heading',
    'heading.level.2': 'Sub-heading',
    'image.fit.cover': 'Fill the space, cropping',
    'image.fit.contain': 'Fit the whole picture in',
    'field.required.true': 'Required',
    'field.required.false': 'Optional',
  },
  fields: { email: 'Email address' },
  keys: { text: 'Text', label: 'Label', placeholder: 'Placeholder', link: 'Link' },
  placeholders: { email: 'you@example.com', name: 'Your name', phone: '+44 7700 900000' },
  params: { submit: 'Sends the form', link: 'Goes somewhere else' },
  tokenValues: {},
  tokens: { bg: 'Background' },
  facets: { shape: 'Shape', captures: 'Asks for', has_image: 'Picture' },
  facetValues: {
    'shape.stack': 'Column',
    'shape.row': 'Row',
    'shape.split': 'Side by side',
    'captures.email': 'Email address',
    'captures.name': 'Name',
    'captures.phone': 'Phone number',
    'has_image.true': 'With a picture',
  },
};

/**
 * The gallery route serves an INDEX — a card is a name, a Display Type, a tier
 * and five derived facets, and **no tree** (ADR 0043). The designs arrive
 * per-card from `/templates/trees` as the grid brings them near the viewport,
 * which is what these two fixtures are.
 */
const CARD = {
  id: ENTRY.id,
  name: ENTRY.name,
  display_type: ENTRY.display_type,
  tier: 'free',
  availability: 'ready' as const,
  facets: {
    act: 'submit' as const,
    captures: ['email'],
    shape: 'stack',
    has_image: false,
    asks_consent: true,
  },
};

/**
 * The [[Goal]] registry entry this Optin's `goal` points at.
 *
 * `headline_label` travels with it, which is the addition: the readiness panel
 * says what a DRAFT will be judged on, and a draft has no dashboard card to
 * read that word off.
 */
const GOAL = {
  id: 'grow_email_list',
  label: 'Grow my email list',
  description: 'Capture email addresses and count every submission.',
  converting_act: 'submit',
  headline_kind: 'conversion',
  headline_label: 'Submissions',
  tier: 'free',
  availability: 'ready' as const,
};

/** The [[Playbook]] `playbook_id` is provenance of. */
const PLAYBOOK = {
  id: 'welcome-discount',
  name: 'Welcome discount',
  goal: 'grow_email_list',
  template_id: 'centred-card',
  display_type: 'popup',
  copy: {},
  rules: [],
  targeting: {},
  destination_hint: { types: ['wsms', 'email_service_provider'], fields: ['email'] },
  notes: '',
};

function optin(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    name: 'Welcome discount',
    goal: 'grow_email_list',
    published_at: null,
    deleted_at: null,
    suspended: null,
    config: { template_id: 'centred-card', template: { tree: ENTRY.tree, tokens: ENTRY.tokens } },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  builder.getOptin.mockResolvedValue(optin());
  builder.getRules.mockResolvedValue(vocabulary);
  builder.saveOptin.mockImplementation((_id: string, _name: string, config: Record<string, unknown>) =>
    Promise.resolve({ ...optin(), config }),
  );
  templates.listTemplates.mockResolvedValue({
    templates: [CARD],
    labels: LABELS,
    facets: { shape: ['stack', 'row', 'split'], captures: ['email', 'name', 'phone'], has_image: ['true'] },
  });
  templates.getTemplateTrees.mockResolvedValue({
    templates: [{ id: ENTRY.id, tree: ENTRY.tree, tokens: ENTRY.tokens }],
  });
  stats.readDashboard.mockResolvedValue({ from: '', to: '', days: 30, goals: [] });
  destinations.readDestinations.mockResolvedValue({ destinations: [], types: [] });
  goals.listGoals.mockResolvedValue([GOAL]);
  goals.listPlaybooks.mockResolvedValue([PLAYBOOK]);
});

const open = () => render(<OptinBuilder id={ID} onClose={vi.fn()} />);

/**
 * A block row's own name button, as opposed to the three controls beside it
 * that are also named after the block.
 *
 * The move and menu buttons carry the block's name deliberately — fifteen
 * buttons reading "Move up" are fifteen buttons a screen-reader user cannot
 * tell apart — so "the button called Headline" is genuinely ambiguous, and this
 * asks the row for the one that selects.
 */
const labelOf = (name: string | RegExp) =>
  within(screen.getByRole('row', { name })).getAllByRole('button')[0];

describe('the builder shell', () => {
  /**
   * **~~Four~~ ~~five~~ four, and the count has now moved three times.**
   *
   * *Display rules* is still the merged one — "when does this fire", "who is
   * eligible" and "which pages" were three tabs' worth of one question — and
   * that is untouched. What went is **Structure**: with an inspector under the
   * tree it and *Content* were one screen drawn twice, and a merchant changing
   * a headline had to pick which copy of it to open.
   *
   * This assertion is edited rather than deleted each time, because a test
   * breaking here is behaviour moving and ADR 0039 asks that it be recorded in
   * the commit that moves it rather than quietly rewritten. The ADR's own tab
   * count is struck through again in the same commit.
   */
  it('offers four tabs, with the three rule surfaces under one of them', async () => {
    open();

    expect(await screen.findByRole('tab', { name: 'Design' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Design',
      'Content',
      'Display rules',
      'Destinations',
    ]);
  });

  /**
   * ========================================================================
   * THE TREE IS THE DESIGN'S OWN BLOCKS, LAYOUTS INCLUDED.
   * ========================================================================
   * `slotsOf` walks leaves and flattens them, which is right for a column of
   * words. A merchant MOVING the email field is moving it within the `row`, so
   * the row has to be a row.
   */
  it('lists every block of the design, layouts included, as a treegrid', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Content' }));

    const tree = screen.getByRole('treegrid', { name: 'Blocks in this design' });

    expect(within(tree).getByRole('row', { name: /The form/ })).toBeInTheDocument();
    expect(within(tree).getByRole('row', { name: /Headline/ })).toBeInTheDocument();
    expect(within(tree).getByRole('row', { name: /Email address/ })).toBeInTheDocument();
  });

  /**
   * **Named by what it says, never "item 3 of 5".** Position is announced by
   * `aria-level`, `aria-posinset` and `aria-setsize` — after the name, rather
   * than instead of it.
   */
  it('names a row by the words the block is showing, and states its place separately', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Content' }));

    const headline = screen.getByRole('row', { name: /Headline/ });

    expect(headline).toHaveAccessibleName(expect.stringContaining('Get 10% off your first order'));
    expect(headline).toHaveAttribute('aria-level', '2');
    expect(headline).toHaveAttribute('aria-posinset', '1');
  });

  /**
   * **Selection is the one string ADR 0040 built, on a third surface.** It
   * carries no way to REACH a slot, so nothing that receives one gains the
   * ability to write — which is why the tree can share it with the preview.
   */
  it('marks a block selected when its row is clicked', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Content' }));
    await userEvent.click(labelOf(/Headline/));

    expect(screen.getByRole('row', { name: /Headline/ })).toHaveAttribute('aria-selected', 'true');
  });

  /**
   * **Exactly one tab stop for the whole grid.** A `tabindex="0"` per control
   * would put sixty stops between the tab strip and the Save button on a
   * fifteen-block design.
   */
  it('keeps one tab stop across the whole tree', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Content' }));

    const tree = screen.getByRole('treegrid', { name: 'Blocks in this design' });
    const tabbable = within(tree).getAllByRole('button').filter((button) => button.tabIndex === 0);

    expect(tabbable).toHaveLength(1);
  });

  /**
   * ========================================================================
   * THE EDITOR IS NEVER A LIST WITH AN INSTRUCTION UNDER IT.
   * ========================================================================
   * A merchant opening the tab is already editing the first block. Not the
   * first ROW — that is a step, and a step is not a block a merchant arranges
   * (ADR 0025) — but the first thing inside it, which is what someone reading
   * the design top to bottom would have clicked.
   */
  it('has the first block selected on arrival, so the inspector is never empty', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Content' }));

    expect(screen.getByRole('row', { name: /Headline/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('group', { name: 'Headline' })).toBeInTheDocument();
  });

  /**
   * **The selection survives a walk to the look and back.** Design holds the
   * tokens now, and a merchant who went to change a colour and came back should
   * find the block they were on still open — the outline in the preview must
   * not blink off and on for no reason they could name.
   */
  it('keeps the selected block while the merchant goes to the design and back', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Content' }));
    await userEvent.click(labelOf(/Body text/));
    await userEvent.click(screen.getByRole('tab', { name: 'Design' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Content' }));

    expect(screen.getByRole('row', { name: /Body text/ })).toHaveAttribute('aria-selected', 'true');
  });

  /**
   * ========================================================================
   * THE OUTLINE GOES; THE SELECTION DOES NOT.
   * ========================================================================
   * They used to be one thing. The outline says *this is the block you are
   * working on*, and left up over the rules tab it is a highlight with nothing
   * on screen explaining it — so the selection was cleared on the way out.
   *
   * That answer stopped working when the selection also decided what the
   * inspector was showing: a merchant coming back from the rules would find an
   * editor with no block open, which is the empty panel the arrival selection
   * exists to prevent. So the tab decides what the PREVIEW is handed, and the
   * selection survives the walk.
   *
   * What the preview does with a null is inside a closed shadow root and is not
   * observable from here — it is on the browser pass with the rest of the CSS.
   */
  it('keeps the block open while the merchant is away editing the rules', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Content' }));
    await userEvent.click(labelOf(/Body text/));
    await userEvent.click(screen.getByRole('tab', { name: 'Display rules' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Content' }));

    expect(screen.getByRole('row', { name: /Body text/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('group', { name: 'Body text' })).toBeInTheDocument();
  });

  /**
   * ==========================================================================
   * THE DESIGN TAB HELD TWO CONCERNS, AND A REGION HOLDS ONE (ADR 0039).
   * ==========================================================================
   * *Choose a design* and *adjust the look* are two questions. At three cards
   * that was invisible; at forty the gallery swamps the token controls the tab
   * is named for, and a merchant who came to change one colour scrolls past the
   * whole library to reach it.
   *
   * So the tab keeps the look, names the design in use, and the gallery is
   * behind one button on a surface of its own (ADR 0043).
   */
  it('names the design in use and puts the gallery behind one button', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Design' }));

    expect(await screen.findByText('Centred card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse designs' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Use this design/ })).toBeNull();
  });

  /**
   * **A modal is for something that owns the screen until it is answered**
   * (ADR 0042 rule 7), and the sentence it opens with is the sharp edge: the
   * merchant's words come across by [[Slot Role]], and blocks they added, moved
   * or deleted do not. That is destructive, and undo is what buys it the
   * exception ADR 0039 otherwise refuses — so the affordance STATES what it
   * takes rather than asking a second question in front of the first.
   */
  it('opens the picker, and says what picking a design will take', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Design' }));
    await userEvent.click(screen.getByRole('button', { name: 'Browse designs' }));

    const picker = within(await screen.findByRole('dialog'));

    expect(picker.getByText('Browse designs')).toBeInTheDocument();
    expect(picker.getByText(/Blocks you added, moved or deleted do not/)).toBeInTheDocument();
    expect(picker.getByRole('button', { name: /In use/ })).toBeInTheDocument();
  });

  /**
   * **Authoring is the editor plus a DEV-ONLY export** (ADR 0010), and a
   * merchant has no use for the library entry behind their popup.
   */
  it('keeps the library entry off the design tab unless WP_DEBUG is on', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Design' }));

    expect(screen.queryByText(/Library entry/)).toBeNull();
  });

  /**
   * The merge is a TAB and not a model: all four questions are still over the
   * two client axes, the server one and the allowance (ADR 0005).
   *
   * The three `<h3>`s became four disclosures whose LABEL is the question and
   * whose body is the form, so this reads the buttons rather than the
   * headings — and the fourth, How often, is the section that had no author
   * anywhere before the rules panel was split into four.
   */
  it('puts where, when, who and how often on that one tab', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Display rules' }));

    for (const question of ['Where', 'When', 'Who', 'How often']) {
      expect(await screen.findByRole('button', { name: new RegExp(`^${question}`) })).toBeInTheDocument();
    }
  });

  /**
   * **The preview follows every tab.** Inside the settings panel it was on one
   * of them, which is the same as saying a merchant tightening a Trigger could
   * not see what they were tightening.
   */
  it('keeps the preview on screen while the rules are being edited', async () => {
    open();

    const preview = await screen.findByRole('complementary', { name: 'Preview' });

    await userEvent.click(screen.getByRole('tab', { name: 'Display rules' }));

    expect(preview).toBeInTheDocument();
    expect(within(preview).getByRole('button', { name: 'Mobile' })).toBeInTheDocument();
  });

  /** Mobile is a WIDTH, because reflow is the question a phone preview answers. */
  it('constrains the preview when the merchant asks for a phone', async () => {
    open();

    const preview = await screen.findByRole('complementary', { name: 'Preview' });

    await userEvent.click(within(preview).getByRole('button', { name: 'Mobile' }));

    expect(preview.querySelector('[data-device]')).toHaveAttribute('data-device', 'mobile');
  });

  /**
   * **A draft has been shown to nobody**, and a row of dashes over the editor
   * reads as a broken panel rather than as "not yet".
   */
  it('says nothing about numbers for an Optin that was never published', async () => {
    open();

    await screen.findByRole('tab', { name: 'Design' });

    expect(screen.queryByText('Impressions')).toBeNull();
    expect(stats.readDashboard).not.toHaveBeenCalled();
  });

  it('shows this Optin’s own numbers once it is live, named by its Goal', async () => {
    builder.getOptin.mockResolvedValue(optin({ published_at: '2026-08-01 09:00:00' }));
    stats.readDashboard.mockResolvedValue({
      from: '',
      to: '',
      days: 30,
      goals: [
        {
          goal: 'grow_email_list',
          label: 'Grow my email list',
          headline_label: 'Submissions',
          optins: [{ id: ID, name: 'Welcome discount', headline: 42, impressions: 1000, conversion_rate: 0.042 }],
        },
      ],
    });

    open();

    expect(await screen.findByText('Submissions')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('4.2%')).toBeInTheDocument();
  });

  /**
   * **Swallowed, exactly as the Goal registry's is on the Optin list.** Numbers
   * are a nicety on an editing screen; an analytics outage must not put an
   * error banner over a builder that is working, and must not cost the Save.
   */
  it('still edits and still saves when the numbers cannot be read', async () => {
    builder.getOptin.mockResolvedValue(optin({ published_at: '2026-08-01 09:00:00' }));
    stats.readDashboard.mockRejectedValue(new Error('nope'));

    open();

    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.queryByText('nope')).toBeNull();
  });
});

/**
 * ============================================================================
 * LEAVING WITH UNSAVED WORK ASKS FIRST.
 * ============================================================================
 * Explicit Save stays — `config` is the working draft and `published_config` is
 * what the site serves, and editing is deliberately not publishing. The price
 * of an explicit Save is that the one door out has to ask.
 */
describe('the way out of the builder', () => {
  /**
   * **Waits for the builder before leaving it, and that is not ceremony.** The
   * skeleton draws its own way out — it has to, since a merchant on a slow
   * connection must be able to turn back before the Optin arrives (#73) — so
   * this clicked the placeholder's button on the frame before the real one
   * existed. React replaces the whole subtree when the skeleton gives way, so
   * the node it had was detached by the time it was clicked, and the assertion
   * was about a control nobody could still see.
   */
  it('leaves at once when there is nothing to lose', async () => {
    const closed = vi.fn();

    render(<OptinBuilder id={ID} onClose={closed} />);

    await screen.findByRole('tab', { name: 'Design' });
    await userEvent.click(screen.getByRole('button', { name: 'All Optins' }));

    expect(closed).toHaveBeenCalled();
  });

  it('asks before discarding an edit, and keeps the merchant here if they say no', async () => {
    const closed = vi.fn();

    render(<OptinBuilder id={ID} onClose={closed} />);

    await userEvent.type(await screen.findByLabelText('Name'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'All Optins' }));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(closed).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));

    expect(closed).not.toHaveBeenCalled();
  });

  it('leaves when the merchant says to discard', async () => {
    const closed = vi.fn();

    render(<OptinBuilder id={ID} onClose={closed} />);

    await userEvent.type(await screen.findByLabelText('Name'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'All Optins' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard changes' }));

    expect(closed).toHaveBeenCalled();
  });

  /** A saved edit is not unsaved work, so the door stops asking. */
  it('stops asking once the work is saved', async () => {
    const closed = vi.fn();

    render(<OptinBuilder id={ID} onClose={closed} />);

    await userEvent.type(await screen.findByLabelText('Name'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText(/Saved\./);
    await userEvent.click(screen.getByRole('button', { name: 'All Optins' }));

    expect(closed).toHaveBeenCalled();
  });
});

/**
 * ============================================================================
 * WHAT THIS OPTIN IS FOR, AND WHETHER IT IS LIVE.
 * ============================================================================
 * Three facts the editor could not state. [[Goal]] and [[Playbook]] are chosen
 * in a three-step creation wizard that cannot be re-entered, and publishing
 * lives on the Optin list — so a merchant editing a campaign could see its
 * design, its words, its rules and its Destinations, and nowhere at all what it
 * exists to produce, what number it will be judged on, or whether the site was
 * serving it.
 *
 * They are read-only here on purpose. A `playbook_id` is provenance and the two
 * never speak again; the Goal is corrected from creation. What was wrong was
 * that they were invisible, not that they were fixed.
 */
describe('the summary', () => {
  /**
   * The one fact under a given name, as the dialog's definition list holds it.
   *
   * By the `<dt>`'s text rather than by role and accessible name: a `dt` has
   * role `term` and no accessible name computed from its contents, so a role
   * query for one named *"When"* matches nothing at all.
   */
  const fact = (name: string) =>
    screen.getByText(name, { selector: 'dt' }).nextElementSibling;

  /**
   * Press the trigger in the page-header band.
   *
   * **It costs the screen a button and nothing else.** This shipped twice as a
   * permanent panel above the tab strip — a card, then a disclosure whose
   * collapsed row was 46px — and both times the room was the objection: it
   * answers a question a merchant asks on arrival rather than on every
   * keystroke, and the editor's own floor is 782px (ADR 0038).
   */
  const summary = async () =>
    userEvent.click(await screen.findByRole('button', { name: /Summary|thing to fix/ }));

  it('costs the screen one button until it is asked for', async () => {
    open();

    expect(await screen.findByRole('button', { name: 'Summary' })).toBeInTheDocument();
    expect(screen.queryByText('On every page')).toBeNull();
    expect(screen.queryByText('Grow my email list')).toBeNull();
  });

  it('says what the Optin is for, and what it will be judged on', async () => {
    open();
    await summary();

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(fact('Goal')?.textContent).toBe('Grow my email list');
    expect(fact('Counts')?.textContent).toBe('Submissions');
  });

  it('names the playbook it was started from', async () => {
    builder.getOptin.mockResolvedValue(
      optin({
        config: {
          template_id: 'centred-card',
          playbook_id: 'welcome-discount',
          template: { tree: ENTRY.tree, tokens: ENTRY.tokens },
        },
      }),
    );

    open();
    await summary();

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(fact('Started from')?.textContent).toBe('Welcome discount');
  });

  /**
   * **A [[Playbook]] this build cannot name still reaches the merchant.** The
   * row follows the stored id and only the NAME waits for the lookup — an entry
   * this install no longer ships, or one filed under a [[Goal]] since
   * corrected, still started this Optin, and *"read-only is fine, invisible is
   * not"* has to survive a lookup that answers nothing.
   */
  it('shows the stored id where the playbook registry cannot name it', async () => {
    goals.listPlaybooks.mockResolvedValue([]);
    builder.getOptin.mockResolvedValue(
      optin({
        config: {
          template_id: 'centred-card',
          playbook_id: 'welcome-discount',
          template: { tree: ENTRY.tree, tokens: ENTRY.tokens },
        },
      }),
    );

    open();
    await summary();

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(fact('Started from')?.textContent).toBe('welcome-discount');
  });

  /**
   * **`published_at` cannot answer "is the site serving this".** A
   * [[Suspended]] Optin *is* published and is on no page at all, so a summary
   * reading the column alone would print *"Published"* over an Optin the site
   * is holding back — and it is always shown with its cause, because it is not
   * a state the merchant chose (ADR 0027).
   */
  it('reads the state off the same two facts the Optin list does', async () => {
    builder.getOptin.mockResolvedValue(
      optin({
        published_at: '2026-01-01 00:00:00',
        suspended: 'Suspended — WConvert Pro is not active.',
      }),
    );

    open();
    await summary();

    expect(await screen.findByText('Suspended')).toBeInTheDocument();
    expect(screen.getByText('Suspended — WConvert Pro is not active.')).toBeInTheDocument();
  });

  it('says Draft on an Optin that has never been published', async () => {
    open();
    await summary();

    expect(await screen.findByText('Draft')).toBeInTheDocument();
  });

  /**
   * **A registry outage costs the summary two rows and nothing else.** The same
   * deliberate degradation {@see OptinList} takes for the same read: labels are
   * a nicety on an editing screen, and they must not cost the merchant their
   * Save button.
   */
  it('keeps the rest of the summary when the goal registry does not answer', async () => {
    goals.listGoals.mockRejectedValue(new Error('nope'));

    open();

    // Asserted before the dialog opens: it is modal, so everything outside it
    // is `aria-hidden` and a role query would find no Save button by design.
    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeInTheDocument();

    await summary();

    expect(await screen.findByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('On every page')).toBeInTheDocument();
    expect(screen.queryByText('Counts', { selector: 'dt' })).toBeNull();
  });

  /**
   * The same four sentences the Display rules tab draws as its disclosure
   * labels, from the same `summarise()` — so the two cannot come to word one
   * axis differently, and a merchant can read the whole answer without opening
   * the tab.
   */
  it('reads out the four rule sentences without opening the rules tab', async () => {
    builder.getOptin.mockResolvedValue(
      optin({
        config: {
          template_id: 'centred-card',
          template: { tree: ENTRY.tree, tokens: ENTRY.tokens },
          rules: [{ type: 'time_on_page', seconds: 8 }],
        },
      }),
    );

    open();
    await summary();

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(fact('Where')?.textContent).toBe('On every page');
    expect(fact('When')?.textContent).toContain('8');
    expect(fact('Who')?.textContent).toBe('Anyone who reaches it');
    expect(fact('How often')?.textContent).toContain('until they close it');
  });

  /**
   * ==========================================================================
   * THE [[PLAYBOOK]]'S DESTINATION HINT, WHICH NOTHING HAS EVER READ.
   * ==========================================================================
   * `Prefill::fromPlaybook()` has written it into every Playbook-started Optin
   * since prefill shipped and no screen has ever opened it.
   *
   * **On the Destinations tab and not in the readiness panel**, which is
   * ADR 0042 rule 2 read strictly: it is an instruction about a choice, and the
   * control that makes that choice is on that tab. A copy above the tabs would
   * be the same instruction permanently, on the surface that cannot act on it.
   */
  it('says what the playbook expected while no destination is bound', async () => {
    destinations.readDestinations.mockResolvedValue({
      destinations: [],
      types: [
        {
          id: 'wsms',
          label: 'WP SMS',
          icon: 'send',
          tier: 'free',
          requires: null,
          requires_label: null,
          availability: 'ready',
          needs_connection: false,
          settings_schema: {},
        },
      ],
    });
    builder.getOptin.mockResolvedValue(
      optin({
        config: {
          template_id: 'centred-card',
          playbook_id: 'welcome-discount',
          destination_hint: { types: ['wsms', 'email_service_provider'], fields: ['email'] },
          template: { tree: ENTRY.tree, tokens: ENTRY.tokens },
        },
      }),
    );

    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Destinations' }));

    // Named where the install has the type; `email_service_provider` is the id
    // of no registered type on any install, and an unresolved key is our own
    // vocabulary rather than a merchant's word.
    expect(
      await screen.findByText(/expects a destination like WP SMS/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/email_service_provider/)).toBeNull();
  });

  /**
   * And it stops the moment the merchant has chosen. The hint is an
   * instruction; once it has been followed it is a permanent line that changes
   * nothing about what they do next.
   */
  it('says nothing about the playbook once a destination is bound', async () => {
    destinations.readDestinations.mockResolvedValue({
      destinations: [
        {
          id: 'd1',
          type: 'wsms',
          label: 'WP SMS contacts',
          connection: null,
          settings: {},
          availability: 'ready',
          health: {
            last_success_at: null,
            last_error: null,
            last_error_at: null,
            consecutive_failures: 0,
            skipped_captures: 0,
            last_skipped_at: null,
          },
        },
      ],
      types: [],
    });
    builder.getOptin.mockResolvedValue(
      optin({
        config: {
          template_id: 'centred-card',
          destinations: ['d1'],
          destination_hint: { types: ['wsms'], fields: ['email'] },
          template: { tree: ENTRY.tree, tokens: ENTRY.tokens },
        },
      }),
    );

    open();

    await summary();

    expect(await screen.findByText('WP SMS contacts', { selector: 'dd' })).toBeInTheDocument();

    // Out of the modal before touching the screen behind it.
    await userEvent.keyboard('{Escape}');
    await userEvent.click(await screen.findByRole('tab', { name: 'Destinations' }));

    expect(await screen.findByRole('checkbox', { name: /WP SMS contacts/ })).toBeChecked();
    expect(screen.queryByText(/The playbook this started from/)).toBeNull();
  });
});
