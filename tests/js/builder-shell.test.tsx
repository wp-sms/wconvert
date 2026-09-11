import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ruleTypes } from './support/rule-types';
import type { TemplateEntry, TemplateIndex, TemplateIndexEntry } from '../../resources/admin/src/templates/api';

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

const templates = vi.hoisted(() => ({ listTemplates: vi.fn(), getTemplateTrees: vi.fn(), prepareTemplate: vi.fn() }));
const publishing = vi.hoisted(() => ({ publishOptin: vi.fn() }));
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
vi.mock('../../resources/admin/src/destinations/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/destinations/api')>()), ...destinations,
}));
vi.mock('../../resources/admin/src/optins/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/optins/api')>()), ...publishing,
}));
vi.mock('../../resources/admin/src/goals/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/goals/api')>()),
  ...goals,
}));

const { OptinBuilder } = await import('../../resources/admin/src/builder/OptinBuilder');

const ENTRY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8'),
) as TemplateEntry;
const ALTERNATE = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/split-hero.json'), 'utf8'),
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
const CARD: TemplateIndexEntry = {
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
    asks_consent: false,
  },
};
const INDEX: TemplateIndex = {
  templates: [CARD],
  labels: LABELS,
  facets: { shape: ['stack', 'row', 'split'], captures: ['email', 'name', 'phone'], has_image: ['true'] },
};

/**
 * The [[Goal]] registry entry this Optin's `goal` points at.
 *
 * `headline_label` travels with it, which is the addition: the readiness panel
 * says what a DRAFT will be judged on, and a draft has no dashboard card to
 * read that word off.
 *
 * **`converting_act` does not, and that is ADR 0059 in one field.** A Goal
 * declared the act as well as the design did, and the builder read it to grey
 * out five of seven design cards. `needs_a_capture` is the smaller thing left:
 * whether the Goal's own number is unreachable on a design that asks the
 * visitor for nothing.
 */
const GOAL = {
  id: 'grow_email_list',
  label: 'Grow my email list',
  description: 'Capture email addresses and count every submission.',
  needs_a_capture: false,
  grows_a_list: true,
  headline_kind: 'conversion',
  headline_label: 'Conversions',
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
    has_unpublished_changes: false,
    deleted_at: null,
    suspended: null,
    config: { template_id: 'centred-card', template: { tree: ENTRY.tree, tokens: ENTRY.tokens } },
    sibling_act: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  builder.getOptin.mockResolvedValue(optin());
  builder.getRules.mockResolvedValue(vocabulary);
  publishing.publishOptin.mockResolvedValue({ published_at: '2026-09-10 12:00:00', has_unpublished_changes: false, deleted_at: null, suspended: null });
  builder.saveOptin.mockImplementation(
    (_id: string, _name: string, config: Record<string, unknown>, goal?: string) =>
      Promise.resolve({ ...optin(), name: _name, config: structuredClone(config), ...(goal === undefined ? {} : { goal }) }),
  );
  templates.prepareTemplate.mockImplementation((_id, template) => Promise.resolve(template));
  templates.listTemplates.mockResolvedValue(INDEX);
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
  /**
   * ========================================================================
   * THREE, AND THE ONE THAT WENT IS *Design* RATHER THAN *Content*.
   * ========================================================================
   * The tab called Design held the token controls for the whole Optin. Since
   * ADR 0062 a token has a SCOPE — the design's own, or one box's — and *which
   * box* is a selection, which is the question the inspector already answers.
   * So the controls moved into it as a second half, choosing a design became a
   * row above the panes, and the tab that held both had nothing left in it. The
   * name survives on the tab that does the designing.
   *
   * Read off the top-level tablist by name, because the inspector has a second
   * one nested inside this tab's own panel and `getAllByRole('tab')` cannot
   * tell them apart.
   */
  it('offers three tabs, with the three rule surfaces under one of them', async () => {
    open();

    const strip = await screen.findByRole('tablist', { name: 'What you are editing' });

    expect(within(strip).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Design',
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

    await userEvent.click(await screen.findByRole('button', { name: 'Layers' }));

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

    await userEvent.click(await screen.findByRole('button', { name: 'Layers' }));

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

    await userEvent.click(await screen.findByRole('button', { name: 'Layers' }));
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

    await userEvent.click(await screen.findByRole('button', { name: 'Layers' }));

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
  it('opens with design settings and keeps Layers optional', async () => {
    open();
    await screen.findByRole('button', { name: 'Change template' });
    expect(screen.queryByRole('treegrid')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Design', level: 4 })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Headline' })).toBeNull();
  });

  /**
   * **The selection survives a walk to the look and back.** The look is the
   * inspector's second half now, and a merchant who went to change a colour and
   * came back should find the block they were on still open — the outline in
   * the preview must not blink off and on for no reason they could name.
   */
  it('keeps the selected block while the merchant goes to the look and back', async () => {
    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Layers' }));
    await userEvent.click(labelOf(/Body text/));

    const halves = screen.getByRole('tablist', { name: /settings$/ });

    await userEvent.click(within(halves).getByRole('tab', { name: 'Style' }));
    await userEvent.click(within(halves).getByRole('tab', { name: 'Content' }));

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

    await userEvent.click(await screen.findByRole('button', { name: 'Layers' }));
    await userEvent.click(labelOf(/Body text/));

    const strip = screen.getByRole('tablist', { name: 'What you are editing' });

    await userEvent.click(within(strip).getByRole('tab', { name: 'Display rules' }));
    await userEvent.click(within(strip).getByRole('tab', { name: 'Design' }));

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
    expect(screen.getByRole('button', { name: 'Change template' })).toBeInTheDocument();
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
  it('previews current content and puts replacement consequences beside Apply', async () => {
    open();

    await userEvent.click(await screen.findByRole('tab', { name: 'Design' }));
    await userEvent.click(screen.getByRole('button', { name: 'Change template' }));

    const picker = within(await screen.findByRole('dialog'));

    expect(picker.getByText('Browse designs')).toBeInTheDocument();
    expect(picker.queryByRole('button', { name: 'Use this design' })).not.toBeInTheDocument();
    await userEvent.click(picker.getByRole('button', { name: 'Preview design' }));
    expect(picker.getByText('Preview with your content')).toBeInTheDocument();
    const current = picker.getByRole('button', { name: 'Current design' });
    expect(current).toHaveAttribute('aria-disabled', 'true');
    expect(current).toHaveAccessibleDescription(/Replaces your draft’s layout.*Undo restores your previous draft/);
    expect(templates.prepareTemplate).toHaveBeenCalledWith(ENTRY.id, { tree: ENTRY.tree, tokens: ENTRY.tokens }, ENTRY.id);
    expect(builder.saveOptin).not.toHaveBeenCalled();
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

    for (const question of ['Pages', 'Audience', 'When it appears', 'Schedule & frequency']) {
      expect(await screen.findByRole('button', { name: new RegExp(`^${question}`) })).toBeInTheDocument();
    }
  });

  /**
   * **The preview follows every tab.** Inside the settings panel it was on one
   * of them, which is the same as saying a merchant tightening a Trigger could
   * not see what they were tightening.
   *
   * **Re-queried rather than held, because it MOVES.** On *Design* it is the
   * middle of three panes and on the other two it is the column beside them
   * (ADR 0062) — one node, two positions, one mounted at a time, which is what
   * keeps ADR 0040's "exactly one render of the tree" literal. Holding the
   * element from before the tab change asserted that the same DOM node
   * survived, which was never the guarantee; the guarantee is that a preview is
   * on screen and is the same preview, which its width control still being on
   * whatever the merchant chose is the sharper test of.
   */
  it('keeps the preview on screen while the rules are being edited', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Mobile preview' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Display rules' }));
    const canvas = screen.getByRole('region', { name: 'Design canvas' });
    expect(canvas).toHaveAttribute('data-width', 'narrow');
  });

  /**
   * **It is a WIDTH and it was called a device.** The narrow bag is measured
   * against the design's own container (ADR 0064), so an `inline` Optin in a
   * 280px sidebar is narrow on a desktop and a control labelled *Mobile* says
   * the opposite. The switch also decides which of a box's two bags the
   * inspector edits, which it did not before.
   */
  it('constrains the preview when the merchant asks for the narrow width', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Mobile preview' }));
    expect(screen.getByRole('region', { name: 'Design canvas' })).toHaveAttribute('data-width', 'narrow');
  });

  /**
   * **A draft has been shown to nobody**, and a row of dashes over the editor
   * reads as a broken panel rather than as "not yet".
   */
  it('says nothing about numbers for an Optin that was never published', async () => {
    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Layers' }));

    expect(screen.queryByText('Impressions')).toBeNull();
    expect(stats.readDashboard).not.toHaveBeenCalled();
  });

  /**
   * **Named by its DESIGN, which is where the precise word survives**
   * (ADR 0059). The dashboard card says *"Conversions"*, because one Goal's
   * card can hold an Optin that submits beside one that links away; here there
   * is one design, so the exact word is available and is always right.
   */
  it('shows this Optin’s own numbers once it is live, named by its design', async () => {
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
    await userEvent.click(await screen.findByRole('button', { name: 'Optin details' }));

    expect(await screen.findByText('Submissions')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('4.2%')).toBeInTheDocument();
  });

  /**
   * **A card where three numbers all shout has no headline at all** — `Stat`'s
   * own docblock, naming the failure this strip had. There is at most one
   * emphasised number per row, and it is the one the Goal is judged on.
   */
  it('spends the emphasis on the Goal’s own number and nowhere else', async () => {
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
    await userEvent.click(await screen.findByRole('button', { name: 'Optin details' }));

    const headline = await screen.findByText('42');

    expect(headline).toHaveClass('text-figure');
    expect(screen.getByText('1,000')).not.toHaveClass('text-figure');
    expect(screen.getByText('4.2%')).not.toHaveClass('text-figure');
  });

  /**
   * **42 submissions over what?** The Analytics screen dates every card; this
   * showed three undated numbers from the server's own default window. The
   * count comes back in the payload rather than being spelled here, because
   * `StatRange::DEFAULT_DAYS` is the only place it lives.
   */
  it('says which window the numbers cover, in the words Analytics uses', async () => {
    builder.getOptin.mockResolvedValue(optin({ published_at: '2026-08-01 09:00:00' }));
    stats.readDashboard.mockResolvedValue({
      from: '',
      to: '',
      days: 7,
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
    await userEvent.click(await screen.findByRole('button', { name: 'Optin details' }));

    expect(await screen.findByText('The last 7 days')).toBeInTheDocument();
  });

  /**
   * **ADR 0039: a region that fetches owes a loading state.** Without one the
   * numbers pop in after the dashboard read and push the tab strip down — and
   * the emphasised figure makes that jump taller than it was.
   */
  it('reserves the row while the numbers are still out', async () => {
    builder.getOptin.mockResolvedValue(optin({ published_at: '2026-08-01 09:00:00' }));
    stats.readDashboard.mockReturnValue(new Promise(() => undefined));

    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Optin details' }));

    // Past the whole-builder skeleton first, whose own "Loading…" is a
    // different state and would otherwise be what this matched.


    expect(screen.getByText('Loading…')).toBeInTheDocument();
    // Three stats' worth of placeholders — a label and a figure each — plus the
    // caption line under them, which is where the 72px shift used to come from.
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(7);
  });

  /**
   * And it stops reserving once the read comes back with nothing for this
   * Optin — a skeleton keyed off the numbers alone would pulse forever.
   */
  it('reserves nothing once the read answers with no row for this Optin', async () => {
    builder.getOptin.mockResolvedValue(optin({ published_at: '2026-08-01 09:00:00' }));
    stats.readDashboard.mockResolvedValue({ from: '', to: '', days: 30, goals: [] });

    open();

    await userEvent.click(await screen.findByRole('button', { name: 'Layers' }));

    /*
     * **Waited for rather than asserted outright, and the tab is why it had to
     * be.** `getOptin` and `readDashboard` are two independent promise chains:
     * the tab appears when the first resolves, which says nothing at all about
     * whether the second's `setStats` has flushed. Asserted directly this
     * passed on a fast machine and failed on CI — `<div class="sr-only">
     * Loading…</div>` was still in the tree — which is a race in the test and
     * not a skeleton that pulses forever.
     *
     * The claim is unchanged: what this names is that the row STOPS being
     * reserved once the read comes back empty.
     */
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).toBeNull();
    });

    expect(screen.queryByText('Impressions')).toBeNull();
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
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

    expect(await screen.findByRole('button', { name: 'Save draft' })).toBeInTheDocument();
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
/**
 * ============================================================================
 * A CONTROL IN THIS BAND MUST NOT ASK FOR A HEIGHT THE BAND OVERRULES.
 * ============================================================================
 * `index.css` states that a page-header action is the taller of the two
 * heights (ADR 0039) and forces `--control-height` back on with `!important`.
 * The Summary trigger passed `size="sm"` into it anyway — so the source said
 * 32px, the screen drew 36, and there was no way to notice: the assertion a
 * reader makes is that the prop does something.
 *
 * This is the one of the three type/size guards that cannot be a source-text
 * assertion, because the contradiction is not visible in either file on its
 * own — it needs the button and the band in the same tree, which is what this
 * suite already puts there.
 *
 * **`icon-sm` is deliberately not caught.** `size-8` is BOTH dimensions and
 * the band overrides neither inline size, so Undo and Redo pass it for the
 * width and take the band's height on purpose. `sm` is the one whose only
 * effect here is a height that never lands.
 */
describe('the page-header band', () => {
  it('keeps draft actions together in the editor header', async () => {
    open();
    const save = await screen.findByRole('button', { name: 'Save draft' });
    const header = document.querySelector('.wconvert-workspace__header');
    expect(header).toContainElement(save);
    expect(header).toContainElement(screen.getByRole('button', { name: 'Undo draft edit' }));
    expect(header).toContainElement(screen.getByRole('button', { name: 'Preview' }));
  });
});

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

    await userEvent.click(await screen.findByRole('button', { name: 'Layers' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back to Optins' }));

    expect(closed).toHaveBeenCalled();
  });

  it('asks before discarding an edit, and keeps the merchant here if they say no', async () => {
    const closed = vi.fn();

    render(<OptinBuilder id={ID} onClose={closed} />);

    await userEvent.type(await screen.findByLabelText('Name'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Back to Optins' }));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(closed).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));

    expect(closed).not.toHaveBeenCalled();
  });

  it('leaves when the merchant says to discard', async () => {
    const closed = vi.fn();

    render(<OptinBuilder id={ID} onClose={closed} />);

    await userEvent.type(await screen.findByLabelText('Name'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Back to Optins' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard changes' }));

    expect(closed).toHaveBeenCalled();
  });

  /**
   * **An ordinary Save sends no [[Goal]]**, which is the regression that would
   * otherwise re-goal an Optin on every keystroke's worth of work.
   *
   * `saveDraft()` writes what it is handed, so a `goal` on every PATCH would
   * make *"correcting a Goal"* indistinguishable from *"saving"* in anything
   * that later watches the column. The Goal travels only from the control that
   * changes one (`builder-change-goal.test.tsx`), and never without the config
   * beside it — the pair is what the server checks (ADR 0059).
   */
  it('sends no goal on an ordinary save', async () => {
    render(<OptinBuilder id={ID} onClose={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText('Name'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText(/^Draft saved$/);

    expect(builder.saveOptin).toHaveBeenCalledTimes(1);
    expect(builder.saveOptin.mock.calls[0][3]).toBeUndefined();
  });

  /** A saved edit is not unsaved work, so the door stops asking. */
  it('stops asking once the work is saved', async () => {
    const closed = vi.fn();

    render(<OptinBuilder id={ID} onClose={closed} />);

    await userEvent.type(await screen.findByLabelText('Name'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText(/^Draft saved$/);
    await userEvent.click(screen.getByRole('button', { name: 'Back to Optins' }));

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
 * The [[Playbook]] is read-only on purpose: it is provenance, and the two never
 * speak again. **The Goal is not, any more** — it sits in the band with a
 * *Change goal* control beside it (ADR 0059), and
 * `tests/js/builder-change-goal.test.tsx` holds that half. What was wrong here
 * was that both were invisible.
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
    screen.getByRole('button', { name }).closest('dt')?.nextElementSibling;

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
    userEvent.click(await screen.findByRole('button', { name: 'Review & publish' }));

  /**
   * **The eight facts still cost one button; the [[Goal]] no longer does.**
   * It moved out in front into the page-header band (ADR 0059), because it was
   * the one fact in here a merchant needed on arrival every time — and the
   * thing five of seven greyed-out design cards kept referring to without
   * naming.
   */
  it('costs the screen one button until it is asked for', async () => {
    open();

    expect(await screen.findByRole('button', { name: 'Review & publish' })).toBeInTheDocument();
    expect(screen.queryByText('On every page')).toBeNull();
    expect(screen.queryByText('Started from')).toBeNull();
  });

  /**
   * **The Goal is the SUBJECT of the dialog, not a row in it.** Every fact in
   * the list is a property of an Optin serving it, and the state is a fact
   * about the whole thing — so both are in the header, which is what a dialog
   * header is for. As two rows among eight they read as two more properties.
   */
  it('says what the Optin is for, and what it will be judged on', async () => {
    open();
    await summary();

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('Grow my email list · counts Conversions')).toBeInTheDocument();
    expect(within(dialog).queryByText('Goal', { selector: 'dt' })).toBeNull();
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
    expect(screen.getByText('Started from:', { exact: false })).toHaveTextContent('Welcome discount');
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
    expect(screen.getByText('Started from:', { exact: false })).toHaveTextContent('welcome-discount');
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

    expect(await within(screen.getByRole('dialog')).findByText('Draft')).toBeInTheDocument();
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
    expect(await screen.findByRole('button', { name: 'Save draft' })).toBeInTheDocument();

    await summary();

    expect(await within(screen.getByRole('dialog')).findByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('On every page')).toBeInTheDocument();
    expect(screen.queryByText(/counts Submissions/)).toBeNull();
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
    expect(fact('Pages')?.textContent).toBe('On every page');
    expect(fact('When it appears')?.textContent).toContain('8');
    expect(fact('Audience')?.textContent).toBe('Anyone who reaches it');
    expect(fact('Schedule & frequency')?.textContent).toContain('until they close it');
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
      await screen.findByText(/works well with a destination like WP SMS/),
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
          target: null,
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

    expect(await screen.findByText('WP SMS contacts', { selector: 'p' })).toBeInTheDocument();

    // Out of the modal before touching the screen behind it.
    await userEvent.keyboard('{Escape}');
    await userEvent.click(await screen.findByRole('tab', { name: 'Destinations' }));

    expect(await screen.findByRole('checkbox', { name: /WP SMS contacts/ })).toBeChecked();
    expect(screen.queryByText(/The playbook this started from/)).toBeNull();
  });
});


describe('saving qualification choices without losing unfinished work', () => {
  const withChoices = (options: unknown) => optin({ config: { ...optin().config,
    template: { tokens: ENTRY.tokens, tree: { steps: [
      { type: 'stack', children: [
        { type: 'field', name: 'email', required: true },
        { type: 'field', name: 'interest', label: 'Service needed', options },
        { type: 'button', action: 'submit', label: 'Send' },
      ] },
      { type: 'stack', children: [{ type: 'heading', text: 'Thanks' }] },
    ] } },
  } });

  it('refuses a save that would drop a duplicate answer, retaining its label and draft history', async () => {
    builder.getOptin.mockResolvedValue(withChoices([
      { value: 'repair', label: 'Repair' }, { value: 'installation', label: 'Installation' },
    ]));
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Layers' }));
    await userEvent.click(within(screen.getByRole('row', { name: /Service needed/ })).getAllByRole('button')[0]);
    await userEvent.click(screen.getByText('Sent as: installation'));
    const value = screen.getByRole('textbox', { name: 'Value sent for choice 2' });
    await userEvent.clear(value);
    await userEvent.type(value, 'repair');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText(/Fix the interest choices before saving/)).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Choice 2' })).toHaveValue('Installation');
    expect(value).toHaveValue('repair');
    expect(builder.saveOptin).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Undo draft edit' })).toBeEnabled();
    await userEvent.clear(value);
    await userEvent.type(value, 'installation');
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' revised');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    expect(builder.saveOptin).toHaveBeenCalledTimes(1);
    expect(builder.saveOptin.mock.calls[0][2].template.tree.steps[0].children[1].options).toEqual([
      { value: 'repair', label: 'Repair' }, { value: 'installation', label: 'Installation' },
    ]);
  });

  it('saves an intentionally empty choice list while publication remains blocked', async () => {
    builder.getOptin.mockResolvedValue(withChoices([]));
    open();
    await userEvent.type(await screen.findByRole('textbox', { name: 'Name' }), ' unfinished');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    expect(builder.saveOptin).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Review & publish' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(/Set up the interest choices/)).toBeVisible();
    expect(dialog.getByRole('button', { name: 'Publish Optin' })).toBeDisabled();
  });
});

describe('whole-draft Undo and Redo', () => {
  it('walks back through destination selections, rules and name, then redoes and saves the same draft', async () => {
    destinations.readDestinations.mockResolvedValue({ destinations: [{
      id: 'd1', type: 'wsms', label: 'Selected contacts', connection: null, settings: {}, target: null,
      availability: 'ready', health: { last_success_at: null, last_error: null, last_error_at: null,
        consecutive_failures: 0, skipped_captures: 0, last_skipped_at: null },
    }], types: [] });
    builder.getOptin.mockResolvedValue(optin({ config: { ...optin().config, destinations: ['d1'] } }));
    open();
    await userEvent.type(await screen.findByRole('textbox', { name: 'Name' }), ' revised');
    await userEvent.click(screen.getByRole('tab', { name: 'Display rules' }));
    await userEvent.click(screen.getByText('Schedule & frequency').closest('button') as HTMLElement);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Stop after they submit the form' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Destinations' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: /Selected contacts/ }));
    expect(screen.getByRole('checkbox', { name: /Selected contacts/ })).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Undo draft edit' }));
    expect(screen.getByRole('checkbox', { name: /Selected contacts/ })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Undo draft edit' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Display rules' }));
    await userEvent.click(screen.getByText('Schedule & frequency').closest('button') as HTMLElement);
    expect(screen.getByRole('checkbox', { name: 'Stop after they submit the form' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Undo draft edit' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Welcome discount');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Undo draft edit' })).toBeDisabled();
    for (let index = 0; index < 3; index++) await userEvent.click(screen.getByRole('button', { name: 'Redo draft edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    expect(builder.saveOptin).toHaveBeenCalledExactlyOnceWith(ID, 'Welcome discount revised', {
      ...optin().config, frequency: { stopAfterConversion: false }, destinations: [],
    }, undefined, 'centred-card');
  });

  it('changes only the working draft when Undo follows publication', async () => {
    open();
    await userEvent.type(await screen.findByRole('textbox', { name: 'Name' }), ' revised');
    await userEvent.click(screen.getByRole('button', { name: 'Review & publish' }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Save & publish' }));
    await userEvent.click(await dialog.findByRole('button', { name: 'Done' }));
    await userEvent.click(screen.getByRole('button', { name: 'Undo draft edit' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Welcome discount');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    expect(builder.saveOptin).toHaveBeenCalledTimes(1);
    expect(publishing.publishOptin).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Optin details' }));
    expect(await screen.findByText(/They do not change the published version or shared destination settings/)).toBeVisible();
  });
});

describe('changing templates in the draft', () => {
  const loadAlternate = () => {
    templates.listTemplates.mockResolvedValue({
      ...INDEX,
      templates: [CARD, { ...CARD, id: ALTERNATE.id, name: ALTERNATE.name,
        facets: { ...CARD.facets, shape: 'split', has_image: true } }],
    } satisfies TemplateIndex);
    templates.getTemplateTrees.mockImplementation((ids: string[]) => Promise.resolve({ templates: [
      { id: ENTRY.id, tree: ENTRY.tree, tokens: ENTRY.tokens },
      { id: ALTERNATE.id, tree: ALTERNATE.tree, tokens: ALTERNATE.tokens },
    ].filter((each) => ids.includes(each.id)) }));
  };

  it('does not add an Undo action just because the server returns a fresh object on Save', async () => {
    open();
    await userEvent.type(await screen.findByRole('textbox', { name: 'Name' }), ' renamed');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    expect(screen.getByRole('button', { name: 'Undo draft edit' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Undo draft edit' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Welcome discount');
    expect(screen.getByRole('button', { name: 'Undo draft edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    expect(builder.saveOptin).toHaveBeenCalledTimes(1);
  });

  it('is undoable before Save and includes later edits when saved', async () => {
    const prepared = { tree: ALTERNATE.tree, tokens: ALTERNATE.tokens };
    loadAlternate();
    templates.prepareTemplate.mockResolvedValue(prepared);
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Change template' }));
    const picker = within(await screen.findByRole('dialog'));
    const alternateCard = picker.getByText(ALTERNATE.name).closest('li') as HTMLElement;
    await userEvent.click(within(alternateCard).getByRole('button', { name: 'Preview design' }));
    expect(picker.getByRole('heading', { name: ALTERNATE.name })).toHaveFocus();
    await userEvent.click(picker.getByRole('button', { name: 'Mobile' }));
    await userEvent.click(picker.getByRole('button', { name: 'Success screen' }));
    expect(templates.prepareTemplate).toHaveBeenCalledExactlyOnceWith(ALTERNATE.id, { tree: ENTRY.tree, tokens: ENTRY.tokens }, ENTRY.id);
    expect(builder.saveOptin).not.toHaveBeenCalled();
    await userEvent.click(picker.getByRole('button', { name: 'Use this design' }));
    await waitFor(() => expect(templates.prepareTemplate).toHaveBeenCalledWith(ALTERNATE.id, { tree: ENTRY.tree, tokens: ENTRY.tokens }, ENTRY.id));
    expect(builder.saveOptin).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Undo draft edit' })).toBeEnabled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change template' })).toHaveFocus());
    expect(screen.getByText(ALTERNATE.name)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo draft edit' }));
    expect(screen.getByText(ENTRY.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Redo draft edit' }));
    expect(screen.getByText(ALTERNATE.name)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Choose a colour for Background/ }));
    await userEvent.clear(screen.getByLabelText('Background value'));
    await userEvent.type(screen.getByLabelText('Background value'), '#123456');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(builder.saveOptin).toHaveBeenCalledWith(ID, 'Welcome discount', expect.objectContaining({
      template_id: ALTERNATE.id, template: { tree: ALTERNATE.tree, tokens: { ...ALTERNATE.tokens, bg: '#123456' } },
    }), undefined, ALTERNATE.id);
  });

  it('normalizes sample content using the selected design identity before applying it', async () => {
    loadAlternate();
    templates.prepareTemplate.mockImplementation((_id, tree) => Promise.resolve(tree));
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Change template' }));
    const picker = within(await screen.findByRole('dialog'));
    await userEvent.click(within(picker.getByText(ALTERNATE.name).closest('li') as HTMLElement)
      .getByRole('button', { name: 'Preview design' }));
    await userEvent.click(picker.getByRole('radio', { name: /Use this design's sample content/ }));
    await waitFor(() => expect(picker.getByRole('button', { name: 'Use this design' })).toHaveAttribute('aria-disabled', 'false'));
    expect(templates.prepareTemplate).toHaveBeenLastCalledWith(ALTERNATE.id,
      { tree: ALTERNATE.tree, tokens: ALTERNATE.tokens }, ALTERNATE.id);
    await userEvent.click(picker.getByRole('button', { name: 'Use this design' }));
    expect(templates.prepareTemplate).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(builder.saveOptin).toHaveBeenCalledWith(ID, 'Welcome discount', {
      template_id: ALTERNATE.id, template: { tree: ALTERNATE.tree, tokens: ALTERNATE.tokens },
    }, undefined, ALTERNATE.id);
  });

  it('keeps the original draft while preparation fails and lets the merchant return to browsing', async () => {
    loadAlternate();
    templates.prepareTemplate.mockRejectedValue(new Error('The design could not be prepared. Try again.'));
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Change template' }));
    const picker = within(await screen.findByRole('dialog'));
    const alternateCard = picker.getByText(ALTERNATE.name).closest('li') as HTMLElement;
    await userEvent.click(within(alternateCard).getByRole('button', { name: 'Preview design' }));
    expect(await picker.findByText('The design could not be prepared. Try again.')).toBeVisible();
    expect(picker.getByRole('button', { name: 'Use this design' })).toHaveAttribute('aria-disabled', 'true');
    expect(picker.getByRole('button', { name: 'Retry preview' })).toBeEnabled();
    await userEvent.click(picker.getByRole('button', { name: 'Back to designs' }));
    await waitFor(() => expect(within(alternateCard).getByRole('button', { name: 'Preview design' })).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change template' })).toHaveFocus());
    expect(screen.getByText(ENTRY.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo draft edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(builder.saveOptin).not.toHaveBeenCalled();
  });
});

describe('publishing from the editor', () => {
  const review = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Review & publish' }));
    return within(await screen.findByRole('dialog'));
  };

  it('keeps saved draft updates separate until the merchant publishes them', async () => {
    builder.getOptin.mockResolvedValue(optin({ published_at: '2026-09-01 00:00:00', has_unpublished_changes: true }));
    open();
    expect(await screen.findByText('Unpublished changes')).toBeInTheDocument();
    const dialog = await review();
    expect(publishing.publishOptin).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole('button', { name: 'Publish changes' }));
    await dialog.findByRole('button', { name: 'Done' });
    expect(publishing.publishOptin).toHaveBeenCalledWith(ID);
    expect(builder.saveOptin).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect((await review()).getByRole('button', { name: 'Publish changes' })).toBeDisabled();
  });

  it('waits for the latest edits to save before promoting the saved snapshot', async () => {
    let accept!: (value: ReturnType<typeof optin>) => void;
    builder.saveOptin.mockImplementation(() => new Promise((resolve) => { accept = resolve; }));
    open();
    await userEvent.type(await screen.findByLabelText('Name'), ' updated');
    const dialog = await review();
    await userEvent.click(dialog.getByRole('button', { name: 'Save & publish' }));
    expect(builder.saveOptin).toHaveBeenCalledTimes(1);
    expect(publishing.publishOptin).not.toHaveBeenCalled();
    expect(dialog.getByRole('button', { name: 'Publishing…' })).toBeDisabled();
    accept(optin({ name: 'Welcome discount updated' }));
    await dialog.findByRole('button', { name: 'Done' });
    expect(publishing.publishOptin).toHaveBeenCalledTimes(1);
  });

  it('never publishes an older saved draft after the latest save is refused', async () => {
    builder.saveOptin.mockRejectedValue(new Error('This field is invalid.'));
    open();
    await userEvent.type(await screen.findByLabelText('Name'), ' updated');
    const dialog = await review();
    await userEvent.click(dialog.getByRole('button', { name: 'Save & publish' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('This field is invalid.');
    expect(publishing.publishOptin).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Welcome discount updated');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('keeps a successfully saved draft after publication fails and retries only publication', async () => {
    publishing.publishOptin.mockRejectedValueOnce(new Error('Could not publish.'));
    open();
    await userEvent.type(await screen.findByLabelText('Name'), ' updated');
    const dialog = await review();
    await userEvent.click(dialog.getByRole('button', { name: 'Save & publish' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Could not publish.');
    expect(dialog.queryByRole('button', { name: 'Save & publish' })).toBeNull();
    await userEvent.click(dialog.getByRole('button', { name: 'Publish Optin' }));
    await dialog.findByRole('button', { name: 'Done' });
    expect(builder.saveOptin).toHaveBeenCalledTimes(1);
    expect(publishing.publishOptin).toHaveBeenCalledTimes(2);
  });
});

it('prevents opening a second save path while a draft save is pending', async () => {
  let accept!: (value: ReturnType<typeof optin>) => void;
  builder.saveOptin.mockImplementation(() => new Promise((resolve) => { accept = resolve; }));
  open();
  await userEvent.type(await screen.findByLabelText('Name'), ' updated');
  await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(screen.getByRole('button', { name: 'Optin details' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Back to Optins' })).toBeDisabled();
  accept(optin({ name: 'Welcome discount updated' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Optin details' })).toBeEnabled());
});
