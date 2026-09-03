import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ruleTypes } from './support/rule-types';
import type { TemplateEntry } from '../../resources/admin/src/templates/api';
import type { TemplateNode, TemplateTree } from '@renderer/types';

/**
 * ============================================================================
 * WHAT THE CONTENT TAB DOES TO THE DESIGN, THROUGH THE WHOLE SCREEN.
 * ============================================================================
 * The tree walking, the guards and the history are tested as pure functions in
 * `builder-structure.test.ts`, which is where the logic lives and where jsdom's
 * limits do not apply. This file asks the smaller question that only the
 * assembled screen can answer: **does pressing the button reach them, and does
 * what comes back get sent to the server?**
 *
 * It deliberately does NOT test the keyboard model. jsdom models neither focus
 * nor roving tabindex nor the top layer (`tests/js/setup.ts`), so an assertion
 * about ← → here would be an assertion about jsdom. That gap is recorded rather
 * than papered over: Vitest 4's Browser Mode is what closes it, in a pull
 * request of its own.
 */

const builder = vi.hoisted(() => ({
  getOptin: vi.fn(),
  getRules: vi.fn(),
  saveOptin: vi.fn(),
  getThemeTokens: vi.fn(),
}));

const templates = vi.hoisted(() => ({ listTemplates: vi.fn() }));
const stats = vi.hoisted(() => ({ readDashboard: vi.fn() }));
const destinations = vi.hoisted(() => ({ readDestinations: vi.fn() }));
const goals = vi.hoisted(() => ({ listGoals: vi.fn() }));

vi.mock('../../resources/admin/src/builder/api', () => builder);
vi.mock('../../resources/admin/src/templates/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../resources/admin/src/templates/api')>()),
  ...templates,
}));
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

const LABELS = {
  roles: {
    headline: 'Headline',
    body: 'Body text',
    fine_print: 'Fine print',
    eyebrow: 'Line above the heading',
    badge: 'Badge wording',
    rating_text: 'Words beside the stars',
    cta_label: 'Button label',
    consent_text: 'Consent wording',
    success_headline: 'Headline after they submit',
    success_body: 'Body text after they submit',
  },
  nodes: {
    heading: 'Heading',
    eyebrow: 'Overline',
    text: 'Text',
    badge: 'Badge',
    rating: 'Star rating',
    image: 'Image',
    icon: 'Icon',
    divider: 'Divider',
    countdown: 'Countdown',
    field: 'Field',
    button: 'Button',
    consent: 'Consent checkbox',
  },
  layouts: { stack: 'Column', row: 'Row', split: 'Side by side', grid: 'Equal columns' },
  // The menu shows what a layout DOES, because *Row* and *Side by side* are two
  // words a merchant cannot tell apart from their names alone.
  layoutNotes: {
    stack: 'Blocks stacked top to bottom.',
    row: 'Blocks along one line.',
    split: 'Two panes, each holding its own blocks.',
    grid: 'Three across, one per line on a phone.',
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
    'rating.value': 'How many stars',
    'icon.name': 'Which picture',
  },
  nodeParamValues: {
    'heading.level.1': 'Main heading',
    'heading.level.2': 'Sub-heading',
    'image.fit.cover': 'Fill the space, cropping',
    'image.fit.contain': 'Fit the whole picture in',
    'field.required.true': 'Required',
    'field.required.false': 'Optional',
    'rating.value.3': 'Three of five',
    'rating.value.4': 'Four of five',
    'rating.value.5': 'Five of five',
    'icon.name.check': 'Tick',
    'icon.name.star': 'Star',
    'icon.name.bolt': 'Lightning',
    'icon.name.gift': 'Gift',
    'icon.name.clock': 'Clock',
    'icon.name.truck': 'Delivery van',
  },
  fields: { email: 'Email address', name: 'Name', phone: 'Phone number' },
  keys: {
    text: 'Text',
    label: 'Label',
    placeholder: 'Placeholder',
    link: 'Link',
    src: 'Image address',
    alt: 'Alt text',
    href: 'Where the button goes',
  },
  placeholders: { email: 'you@example.com', name: 'Your name', phone: '+44 7700 900000' },
  params: { submit: 'Sends the form', link: 'Goes somewhere else' },
  tokenValues: {},
  tokens: { bg: 'Background' },
};

const GOALS = [
  { id: 'grow_email_list', label: 'Grow my email list', description: '', converting_act: 'submit', headline_kind: 'conversion', tier: 'free', availability: { available: true } },
  { id: 'promote_offer', label: 'Promote a sale', description: '', converting_act: 'click', headline_kind: 'conversion', tier: 'free', availability: { available: true } },
];

function optin(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    name: 'Welcome discount',
    goal: 'grow_email_list',
    published_at: null,
    config: { template_id: 'centred-card', template: { tree: ENTRY.tree, tokens: ENTRY.tokens } },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  builder.getOptin.mockResolvedValue(optin());
  builder.getRules.mockResolvedValue(ruleTypes());
  builder.saveOptin.mockImplementation((_id: string, _name: string, config: Record<string, unknown>) =>
    Promise.resolve({ ...optin(), config }),
  );
  templates.listTemplates.mockResolvedValue({ templates: [ENTRY], labels: LABELS });
  stats.readDashboard.mockResolvedValue({ from: '', to: '', days: 30, goals: [] });
  destinations.readDestinations.mockResolvedValue({ destinations: [], types: [] });
  goals.listGoals.mockResolvedValue(GOALS);
});

/**
 * Open the builder and land on the editing tab.
 *
 * **Called `structure()` still, and the tab is called Content.** That is the
 * merge: the tree, the row controls and the inspector are one screen, and it
 * kept the word merchants already had.
 */
async function structure() {
  render(<OptinBuilder id={ID} onClose={vi.fn()} />);

  await userEvent.click(await screen.findByRole('tab', { name: 'Content' }));
}

/**
 * What each row calls its block, in tree order.
 *
 * Read off the name span rather than off the row's accessible name, which is
 * every cell's text run together — the block's kind, the words it is showing,
 * and the three controls that are all named after it. That is correct for a
 * treegrid and useless as an identifier.
 */
const rowNames = () =>
  screen
    .getAllByRole('row')
    .map((row) => row.querySelector('.wconvert-block__kind')?.textContent ?? '');

/**
 * One row, by exactly what it calls its block.
 *
 * `getByRole('row', { name: /Headline/ })` matches *Headline* and *Headline
 * after they submit* both, which is a fair reading of a substring and the wrong
 * row half the time.
 */
function row(name: string): HTMLElement {
  const found = screen
    .getAllByRole('row')
    .filter((each) => each.querySelector('.wconvert-block__kind')?.textContent === name);

  expect(found, `expected exactly one row named “${name}”`).toHaveLength(1);

  return found[0];
}

/**
 * The tab the merchant is actually looking at.
 *
 * **Both design-editing tabs stay mounted**, so the toolbar's three controls
 * are in the document twice — once behind an `<Activity mode="hidden">`, which
 * takes its CONTENTS out of the accessibility tree but leaves the panel itself
 * in it. So a role query for a button inside finds one and a query for the
 * panel finds two, and `data-state` is what tells them apart.
 */
function panel(): HTMLElement {
  const open = screen
    .getAllByRole('tabpanel')
    .filter((each) => each.dataset.state === 'active');

  expect(open, 'expected exactly one open tab panel').toHaveLength(1);

  return open[0];
}

/** What the last Save sent, as a tree. */
const savedTree = (): TemplateTree =>
  (builder.saveOptin.mock.calls.at(-1)?.[2] as { template: { tree: TemplateTree } }).template.tree;

/** What the last Save sent, as the design's token map. */
const savedTokens = (): Record<string, string> =>
  (builder.saveOptin.mock.calls.at(-1)?.[2] as { template: { tokens: Record<string, string> } })
    .template.tokens;

const typesIn = (nodes: readonly TemplateNode[] | undefined): string[] =>
  (nodes ?? []).map((node) => node.type);

const formChildren = (tree: TemplateTree): readonly TemplateNode[] =>
  (tree.steps[0] as unknown as { children: readonly TemplateNode[] }).children;

describe('moving a block', () => {
  /**
   * **The ↑↓ buttons are the mechanism, not a fallback.** WCAG 2.2 SC 2.5.7
   * requires a single-pointer alternative to any drag, and W3C states plainly
   * that keyboard equivalence does not satisfy it *"unless that equivalent
   * keyboard operation also provides controls that can be clicked or tapped"* —
   * its own example being adjacent up/down controls on a sortable list.
   */
  it('offers a clickable up and down on every block', async () => {
    await structure();

    expect(within(row('Headline')).getByRole('button', { name: 'Move Headline down' })).toBeInTheDocument();
    expect(within(row('Headline')).getByRole('button', { name: 'Move Headline up' })).toBeInTheDocument();
  });

  it('swaps the block with the sibling in the direction pressed', async () => {
    await structure();

    await userEvent.click(within(row('Headline')).getByRole('button', { name: 'Move Headline down' }));

    expect(rowNames().slice(0, 4)).toEqual(['The form', 'Body text', 'Headline', 'Row']);
  });

  /**
   * **Announced, and named by what the block says.** *"Item 3 moved"* tells a
   * screen-reader user nothing about which block moved, on a list where three
   * rows are `text`.
   */
  it('says what moved, which way, and where it landed', async () => {
    await structure();

    await userEvent.click(within(row('Headline')).getByRole('button', { name: 'Move Headline down' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Headline, “Get 10% off your first order”, moved down, 2 of 5',
    );
  });

  /**
   * `aria-disabled` and not `disabled`: the tree is a roving tabindex and ← →
   * walk between a row's controls, so a control removed from the focus order
   * would be stepped over on some rows and not others.
   */
  it('marks the end of the list without taking the button out of the focus order', async () => {
    await structure();

    const up = within(row('Headline')).getByRole('button', { name: 'Move Headline up' });

    expect(up).toHaveAttribute('aria-disabled', 'true');
    expect(up).not.toBeDisabled();

    await userEvent.click(up);

    expect(rowNames().slice(0, 3)).toEqual(['The form', 'Headline', 'Body text']);
  });

  /**
   * **Pressing ↓ three times moves a block three places.** The row moves out
   * from under the pointer on every press, so landing focus back on the
   * block's NAME would cost a keyboard merchant two arrow presses per move and
   * everyone else a re-aim — which would make the buttons a technicality that
   * satisfies SC 2.5.7 rather than the mechanism.
   */
  it('leaves focus on the button that was pressed, so it can be pressed again', async () => {
    await structure();

    const down = () =>
      within(row('Headline')).getByRole('button', { name: 'Move Headline down' });

    await userEvent.click(down());
    await userEvent.click(down());

    // Past the `row`, whose own two children sit between them in the list —
    // the block moved two places among its SIBLINGS, which is what ↓ means.
    expect(rowNames().slice(0, 6)).toEqual([
      'The form',
      'Body text',
      'Row',
      'Email address',
      'Button label',
      'Headline',
    ]);
    expect(down()).toHaveFocus();
  });

  /** Whatever is moved is still what the Save sends. */
  it('sends the rearranged design when the merchant saves', async () => {
    await structure();

    await userEvent.click(within(row('Headline')).getByRole('button', { name: 'Move Headline down' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(typesIn(formChildren(savedTree())).slice(0, 2)).toEqual(['text', 'heading']);
  });
});

/**
 * ============================================================================
 * THE ROW: VERSION C'S LOOK, WITH VERSION A'S GUARANTEES.
 * ============================================================================
 * The prototype's version C replaced the ↑↓ buttons with a drag handle, and
 * that is the one thing this cannot copy: **WCAG 2.2 SC 2.5.7 requires a
 * single-pointer alternative to any dragging movement**, and W3C is explicit
 * that keyboard equivalence does not satisfy it *"unless that equivalent
 * keyboard operation also provides controls that can be clicked or tapped"* —
 * its own cited example being adjacent up/down controls on a sortable list.
 *
 * So the grip is added and the buttons stay. They are quiet until wanted, which
 * is the prototype's own rule, and the criterion is satisfied three pointer ways
 * over: the buttons on hover or selection, the menu with no hover at all, and
 * the drag itself.
 */
describe('the row', () => {
  const select = async (name: string) => {
    await userEvent.click(within(row(name)).getAllByRole('button')[0]);
  };

  /**
   * **`opacity: 0`, never `display: none`.** The treegrid has a roving
   * tabindex, so every row must have the same number of cells and every one
   * must stay focusable — a control taken out of the layout would be stepped
   * over by → on some rows and not others.
   *
   * Vitest runs with `css: false`, so the reveal itself is a browser question.
   * What is provable here is the half that would break the keyboard: that the
   * controls are in the DOM and reachable at rest.
   */
  it('keeps the move buttons in the DOM and focusable when nothing is hovering them', async () => {
    await structure();

    const up = within(row('Body text')).getByRole('button', { name: 'Move Body text up' });

    expect(up).not.toBeDisabled();

    up.focus();

    expect(up).toHaveFocus();
  });

  /**
   * The path a touch user reaches after tapping the row, and the one that needs
   * no hover at all.
   */
  it('offers Move up and Move down in the menu, above everything else', async () => {
    await structure();

    await userEvent.click(
      within(row('Body text')).getByRole('button', { name: 'Add, copy or delete Body text' }),
    );

    expect(screen.getAllByRole('menuitem').slice(0, 2).map((item) => item.textContent)).toEqual([
      'Move up',
      'Move down',
    ]);
  });

  it('moves the block from the menu, and marks the end of the list', async () => {
    await structure();

    await userEvent.click(
      within(row('Headline')).getByRole('button', { name: 'Add, copy or delete Headline' }),
    );

    expect(screen.getByRole('menuitem', { name: 'Move up' })).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(screen.getByRole('menuitem', { name: 'Move down' }));

    expect(rowNames().slice(0, 3)).toEqual(['The form', 'Body text', 'Headline']);
  });

  /** A third pointer-free path, for repeat moves without hunting for a button. */
  it('moves the block with Alt and an arrow key, from wherever focus is on the row', async () => {
    await structure();
    await select('Headline');

    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');

    expect(rowNames().slice(0, 3)).toEqual(['The form', 'Body text', 'Headline']);

    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');

    expect(rowNames().slice(0, 4)).toEqual(['The form', 'Body text', 'Row', 'Email address']);
  });

  /**
   * **A step gets no grip rather than an inert one.** Steps are not draggable —
   * how many a design has follows from its metric (ADR 0025) — so a grip drawn
   * on one would be an affordance that lies.
   */
  it('gives a block a drag grip and a step none', async () => {
    await structure();

    expect(row('Headline').querySelector('.wconvert-block__grip')).not.toBeNull();
    expect(row('The form').querySelector('.wconvert-block__grip')).toBeNull();
  });

  /**
   * **The name selects and nothing else.** It used to be the drag handle too —
   * one control with two meanings, wearing `cursor: grab` while its click did
   * something different.
   */
  it('keeps the grip out of the tab order and out of the accessibility tree', async () => {
    await structure();

    const grip = row('Headline').querySelector('.wconvert-block__grip');

    expect(grip).toHaveAttribute('aria-hidden', 'true');
    expect(within(row('Headline')).queryByRole('button', { name: /drag|grip|move .* by/i })).toBeNull();
  });

  /**
   * ==========================================================================
   * **counted** IS THE MOST CONSEQUENTIAL FACT ABOUT ANY BLOCK IN THE DESIGN.
   * ==========================================================================
   * Delete it and the Optin renders, publishes and reports zero forever
   * (ADR 0020). It was said once in the status line and then forgotten.
   */
  it('marks the block conversions are counted on, and only that one', async () => {
    await structure();

    expect(within(row('Button label')).getByText('counted')).toBeInTheDocument();
    expect(screen.getAllByText('counted')).toHaveLength(1);
  });

  /**
   * ==========================================================================
   * THE WARNING SAYS WHAT IT ACTUALLY COSTS.
   * ==========================================================================
   * Slot Roles are a closed list of thirteen, unique across the tree — so there
   * is exactly one fillable body slot, and a block that got none has no seam
   * for its words to travel on. Type a second paragraph, switch design, and
   * those words are gone. The old sentence said it was *"not linked to the
   * preview"*, which is true and trivial beside that.
   */
  it('warns on a block whose words a design switch would throw away', async () => {
    await structure();

    expect(within(row('Fine print')).queryByText('words will be lost')).toBeNull();

    await userEvent.click(
      within(row('Fine print')).getByRole('button', { name: 'Add, copy or delete Fine print' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: /Duplicate/ }));

    // The copy comes back with no Role — Roles are unique tree-wide — so it is
    // exactly the block the warning is about.
    expect(within(row('Text')).getByText('words will be lost')).toBeInTheDocument();
  });

  /**
   * **An image is not at risk and must not be marked as one.** It declares no
   * Roles because it holds no words, and `MerchantsOwn` carries its `src` and
   * `alt` across a switch precisely because no Role does.
   */
  it('does not warn a kind that declares no Slot Roles at all', async () => {
    await structure();

    await userEvent.click(
      within(row('Headline')).getByRole('button', { name: 'Add, copy or delete Headline' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add a block after this' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Image' }));

    expect(within(row('Image')).queryByText('words will be lost')).toBeNull();
  });

  /** What a row says under its name: the words, or how much is inside it. */
  it('summarises a button by what it says and what it does', async () => {
    await structure();

    expect(within(row('Button label')).getByText('Send my code · Sends the form')).toBeInTheDocument();
  });

  it('summarises a layout by how much it holds', async () => {
    await structure();

    expect(within(row('Row')).getByText('2 blocks inside')).toBeInTheDocument();
  });
});

describe('deleting a block', () => {
  const menu = async (name: string) => {
    await userEvent.click(
      within(row(name)).getByRole('button', { name: `Add, copy or delete ${name}` }),
    );
  };

  /**
   * ==========================================================================
   * NO CONFIRM, AND UNDO IS WHAT PAYS FOR THAT.
   * ==========================================================================
   * ADR 0039 requires a confirm on every destructive action. A dialog per
   * block-delete is one a merchant rearranging a design learns to dismiss
   * without reading, which is strictly worse than none.
   */
  it('removes the block at once, and says undo brings it back', async () => {
    await structure();
    await menu('Fine print');

    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));

    expect(rowNames()).not.toContain('Fine print');
    expect(screen.getByRole('status')).toHaveTextContent('Undo brings it back');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('takes the blocks inside it, and says so before it is pressed', async () => {
    await structure();
    await menu('Row');

    expect(screen.getByRole('menuitem', { name: /Delete, and the 2 inside it/ })).toBeInTheDocument();
  });

  /**
   * ==========================================================================
   * THE SAFETY NET, FROM THE MERCHANT'S SIDE.
   * ==========================================================================
   * `TemplateLibrary::refuse()` enforces one converting act at registration and
   * has never applied to an Optin's config. Deleting the only button leaves an
   * Optin that renders, publishes and reports zero forever.
   */
  it('refuses to delete the only converting act, with the reason in the menu', async () => {
    await structure();
    await menu('Button label');

    const refused = screen.getByRole('menuitem', { name: /Delete/ });

    expect(refused).toHaveAttribute('aria-disabled', 'true');
    expect(refused).toHaveTextContent('counts as a conversion');
  });

  /** And the same refusal reaches a layout that HOLDS the only button. */
  it('refuses to delete a row that holds the only converting act', async () => {
    await structure();
    await menu('Row');

    expect(screen.getByRole('menuitem', { name: /Delete/ })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('duplicating a block', () => {
  /**
   * **The copy comes back nameless whatever the editor does.** Slot Roles are
   * unique across the whole tree, so `TemplateVocabulary::normalize()` keeps
   * the first node claiming one and drops it from every later one. Stripping it
   * here is what makes the editor honest at the moment of the act.
   */
  it('copies the block without its Slot Role, and says what that costs', async () => {
    await structure();

    await userEvent.click(
      within(row('Fine print')).getByRole('button', { name: 'Add, copy or delete Fine print' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: /Duplicate/ }));

    expect(screen.getByRole('status')).toHaveTextContent('no name of its own');
    // The original still fills `fine_print`; the copy has no Role, so it is
    // listed by its kind — which is exactly what the sentence above warned.
    expect(rowNames().filter((name) => name === 'Fine print')).toHaveLength(1);
    expect(rowNames().filter((name) => name === 'Text')).toHaveLength(1);
  });

  it('refuses to copy the button or a field', async () => {
    await structure();

    await userEvent.click(
      within(row('Email address')).getByRole('button', { name: 'Add, copy or delete Email address' }),
    );

    expect(screen.getByRole('menuitem', { name: /Duplicate/ })).toHaveTextContent('collide');
  });
});

describe('adding a block', () => {
  /**
   * The list is the manifest's, so a node type added to
   * `resources/templates/manifest.json` appears here with nothing edited.
   */
  it('offers every kind the vocabulary declares, layouts included', async () => {
    await structure();

    await userEvent.click(
      within(row('Headline')).getByRole('button', { name: 'Add, copy or delete Headline' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add a block after this' }));

    /*
      Exact names, because the notes under them now contain each other's words —
      "Row" appears inside *"In one line — a field, then its button"* only by
      accident today, but a loose regex over a menu that explains itself is a
      test that passes for the wrong reason.
    */
    for (const kind of [
      'Heading',
      'Overline',
      'Text',
      'Badge',
      'Star rating',
      'Image',
      'Icon',
      'Divider',
      'Countdown',
      'Field',
      'Button',
      'Consent checkbox',
      'Column',
      'Row',
      'Side by side',
      'Equal columns',
    ]) {
      expect(
        await screen.findByRole('menuitem', { name: new RegExp(`^${kind}\\b`) }),
      ).toBeInTheDocument();
    }
  });

  /** One Optin has exactly one converting act (CONTEXT.md, Conversion). */
  it('refuses a second button, with the reason where the pointer is', async () => {
    await structure();

    await userEvent.click(
      within(row('Headline')).getByRole('button', { name: 'Add, copy or delete Headline' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add a block after this' }));

    expect(await screen.findByRole('menuitem', { name: /Button/ })).toHaveTextContent('exactly one');
  });

  it('puts the new block where it was asked for, and announces it', async () => {
    await structure();

    await userEvent.click(
      within(row('Headline')).getByRole('button', { name: 'Add, copy or delete Headline' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add a block after this' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Image' }));

    expect(rowNames().slice(0, 3)).toEqual(['The form', 'Headline', 'Image']);
    expect(screen.getByRole('status')).toHaveTextContent('Image added.');
  });

  /**
   * ==========================================================================
   * A SECOND HEADING IS JUST A HEADING NOW, AND THE WARNING IS GONE WITH IT.
   * ==========================================================================
   * This asserted the opposite until ADR 0051: [[Slot Role]]s were unique
   * across a tree, so a second Heading arrived with no Role, no `SlotKey` and
   * no seam for its words to survive a design switch — and the announcement
   * had to say so. Roles repeat, so it binds like the first one and the second
   * sentence would be telling a merchant that the block they just added is the
   * block they just added (ADR 0042 rule 2).
   */
  it('announces a repeated block plainly, with nothing to warn about', async () => {
    await structure();

    await userEvent.click(
      within(row('Headline')).getByRole('button', { name: 'Add, copy or delete Headline' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add a block after this' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Heading' }));

    expect(screen.getByRole('status')).toHaveTextContent('Heading added.');
    expect(screen.getByRole('status')).not.toHaveTextContent('not linked to the preview');
  });

  /**
   * `render.ts` makes the step holding the submit button the `<form>`, so a
   * field on the success step draws, takes typing, and is read by nothing.
   */
  it('refuses a field on the step that is not the form', async () => {
    await structure();

    await userEvent.click(
      within(row('Headline after they submit')).getByRole('button', {
        name: 'Add, copy or delete Headline after they submit',
      }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add a block after this' }));

    expect(await screen.findByRole('menuitem', { name: /Field/ })).toHaveTextContent('submit button');
  });
});

/**
 * ============================================================================
 * A BLOCK IS EDITED WHERE IT IS SELECTED.
 * ============================================================================
 * The tree shipped without this: selecting a row highlighted it in the preview
 * and stopped, so changing a headline meant switching tabs, finding that block
 * among all of them, typing, and switching back. Two places to look for one act.
 */
describe('the inspector', () => {
  /** The row's own name button, which is the control that selects. */
  const select = async (name: string) => {
    await userEvent.click(within(row(name)).getAllByRole('button')[0]);
  };

  /**
   * The inspector, by the block it is showing.
   *
   * Scoped rather than queried off the screen: the Content tab is still
   * mounted beside this one, so a bare `getByLabelText('Text')` finds its
   * column of slots too.
   */
  const inspector = (name: string) => within(screen.getByRole('group', { name }));

  it('puts the selected block\u2019s own controls under the tree', async () => {
    await structure();
    await select('Fine print');

    expect(inspector('Fine print').getByLabelText('Text')).toHaveValue(
      'No spam, and you can unsubscribe at any time.',
    );
  });

  /**
   * **A layout has no slot, so it must not draw an empty box.** `slotsOf`
   * walks leaves; a panel that drew controls for a `row` anyway would be
   * promising an edit it cannot make.
   */
  it('names a layout and says it holds blocks rather than words', async () => {
    await structure();
    await select('Row');

    expect(inspector('Row').getByText(/holds blocks rather than words/)).toBeInTheDocument();
  });

  it('says what a step is rather than offering it a text box', async () => {
    await structure();
    await select('The form');

    expect(inspector('The form').getByText(/A step is what the blocks are in/)).toBeInTheDocument();
  });

  it('writes what is typed into the tree, and the Save sends it', async () => {
    await structure();
    await select('Headline');

    const text = inspector('Headline').getByLabelText('Text');

    await userEvent.clear(text);
    await userEvent.type(text, 'Half price today');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect((formChildren(savedTree())[0] as unknown as { text: string }).text).toBe('Half price today');
  });

  /**
   * **One Undo removes the word, not the letter.** Every keystroke is a new
   * tree identity, so without coalescing a sentence would exhaust the fifty
   * entry cap and undo would be a backspace.
   */
  it('takes back a burst of typing in one step', async () => {
    await structure();
    await select('Headline');

    const text = inspector('Headline').getByLabelText('Text');

    await userEvent.clear(text);
    await userEvent.type(text, 'Half price');
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(inspector('Headline').getByLabelText('Text')).toHaveValue('Get 10% off your first order');
  });

  /**
   * **A body paragraph is not a headline.** A single-line box for a sentence
   * that wraps is a control hiding most of what it holds; a heading is one line
   * by construction and keeps the box it had.
   */
  it('gives a wrapping sentence room and a headline a single line', async () => {
    await structure();
    await select('Body text');

    expect(inspector('Body text').getByLabelText('Text').tagName).toBe('TEXTAREA');

    await select('Headline');

    expect(inspector('Headline').getByLabelText('Text')).toHaveAttribute('type', 'text');
  });

  /**
   * **An address is not a sentence.** `type="url"` is a keyboard on a phone and
   * a validity hint on a desktop, and it costs nothing where it is neither. The
   * media picker is WordPress's own and is absent here, which is exactly the
   * degradation the control is written for: the address is still typeable.
   */
  it('asks for an address as an address, and still takes one typed by hand', async () => {
    await structure();

    await userEvent.click(
      within(row('Headline')).getByRole('button', { name: 'Add, copy or delete Headline' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add a block after this' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Image' }));

    expect(inspector('Image').getByLabelText('Image address')).toHaveAttribute('type', 'url');
    expect(inspector('Image').getByLabelText('Alt text')).toHaveAttribute('type', 'text');
  });

  /** A hidden block is still edited here, which is the only route to switching it on. */
  it('edits a block that is switched off, because that is the way to switch it on', async () => {
    await structure();
    await select('Consent wording');

    const shown = inspector('Consent wording').getByRole('checkbox', { name: 'Show this' });

    expect(shown).not.toBeChecked();

    await userEvent.click(shown);

    expect(inspector('Consent wording').getByRole('checkbox', { name: 'Show this' })).toBeChecked();
  });

  /**
   * ==========================================================================
   * ⇄ IS THE ONLY WAY TO CHANGE WHAT A BLOCK IS.
   * ==========================================================================
   * A `field`'s capture kind and a `button`'s action are params, so no control
   * anywhere in the plugin has ever offered either — an email field could never
   * become a phone field except by deleting it, which loses the wording.
   */
  it('changes what a field captures, and keeps what the merchant wrote', async () => {
    await structure();
    await select('Email address');

    const label = inspector('Email address').getByLabelText('Label');

    await userEvent.clear(label);
    await userEvent.type(label, 'Where do we send it?');

    await userEvent.click(screen.getByRole('button', { name: 'Capture something else' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Phone number/ }));

    expect(screen.getByRole('status')).toHaveTextContent('Changed to Phone number');
    // The Slot Roles derived from the kind moved with it, so the row renamed
    // itself — and the merchant's own label came along.
    expect(inspector('Phone number').getByLabelText('Label')).toHaveValue('Where do we send it?');
    // The placeholder was the design's, so it became the new kind's.
    expect(inspector('Phone number').getByLabelText('Placeholder')).toHaveValue('+44 7700 900000');
  });

  /**
   * **The refusals are the save's, met early.** A `link` button on a
   * submit-metered Optin fails the WHOLE save through
   * `refuseAMetricItCannotReport`, which is the error this editor exists to
   * prevent a merchant ever meeting.
   */
  it('refuses to make the button a link, with the reason where the pointer is', async () => {
    await structure();
    await select('Button label');

    await userEvent.click(screen.getByRole('button', { name: 'Change what this button does' }));

    const refused = await screen.findByRole('menuitem', { name: /Goes somewhere else/ });

    expect(refused).toHaveAttribute('aria-disabled', 'true');
    expect(refused).toHaveTextContent('counts form submissions');
  });

  /** A block with no such question is not offered one. */
  it('offers nothing to change on a heading or a layout', async () => {
    await structure();
    await select('Headline');

    expect(screen.queryByRole('button', { name: /Capture something else|Change what/ })).toBeNull();

    await select('Row');

    expect(screen.queryByRole('button', { name: /Capture something else|Change what/ })).toBeNull();
  });

  it('sends the swapped field when the merchant saves', async () => {
    await structure();
    await select('Email address');

    await userEvent.click(screen.getByRole('button', { name: 'Capture something else' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Phone number/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const row = (formChildren(savedTree())[2] as unknown as { children: TemplateNode[] }).children[0];

    expect(row).toMatchObject({ type: 'field', name: 'phone', label: 'Phone number' });
  });

  /**
   * ==========================================================================
   * SELECTING A ROW MUST NOT PULL FOCUS INTO THE INSPECTOR.
   * ==========================================================================
   * Focus belongs on the row the merchant is on — that is what keeps ↑↓ walking
   * the list after a click — so `Tab` is the documented way down, and the DOM
   * order is what makes it land there.
   */
  it('leaves focus on the row, and Tab from it reaches the controls below', async () => {
    await structure();
    await select('Headline');

    expect(within(row('Headline')).getAllByRole('button')[0]).toHaveFocus();

    await userEvent.tab();

    /*
     * Into the inspector rather than onto a particular control in it: which
     * comes first is the SLOT's shape — a hideable one leads with its
     * visibility checkbox — and the guarantee is that one Tab leaves the grid
     * and arrives here, which is what the roving tabindex is for.
     */
    expect(screen.getByRole('group', { name: 'Headline' })).toContainElement(
      document.activeElement as HTMLElement,
    );
  });

  /**
   * **Selecting a block puts the preview on the step it lives in.** A block on
   * step 2 selected while the preview showed step 1 outlined nothing anyone
   * could see, which reads as a broken highlight rather than as a step nobody
   * switched to.
   */
  it('takes the preview to the step the selected block lives on', async () => {
    await structure();
    await select('Headline after they submit');

    const preview = screen.getByRole('complementary', { name: 'Preview' });

    expect(within(preview).getByRole('button', { name: 'After they submit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  /**
   * **The selection follows the block, not the position it used to hold.** A
   * `SlotKey` survived a move for free; a path does not.
   */
  it('follows the block through a move', async () => {
    await structure();
    await select('Headline');

    await userEvent.click(within(row('Headline')).getByRole('button', { name: 'Move Headline down' }));

    expect(screen.getByRole('group', { name: 'Headline' })).toBeInTheDocument();
  });

  /** And never blanks when what it was showing is deleted. */
  it('follows a delete to whatever took focus', async () => {
    await structure();
    await select('Fine print');

    await userEvent.click(
      within(row('Fine print')).getByRole('button', { name: 'Add, copy or delete Fine print' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));

    expect(screen.queryByRole('group', { name: 'Fine print' })).toBeNull();
    // Whatever took focus. The fine print is the last block in its list, so
    // there is no next sibling and what was holding it takes focus — here the
    // step itself, which the inspector names rather than blanking.
    expect(screen.getByRole('group', { name: 'The form' })).toBeInTheDocument();
  });
});

/**
 * ============================================================================
 * THE VERDICT: WHETHER THIS DESIGN WILL ACTUALLY WORK.
 * ============================================================================
 * The save already knows, and it tells the merchant as a red bar over an editor
 * that had let them get there. This is the same knowledge, said while it is
 * still cheap to act on — plus two things nothing else will ever mention.
 */
describe('the verdict', () => {
  const menu = async (name: string) => {
    await userEvent.click(
      within(row(name)).getByRole('button', { name: `Add, copy or delete ${name}` }),
    );
  };

  /**
   * ==========================================================================
   * A STRIP THAT SAYS "THIS WILL WORK" IS A STRIP THAT SAYS NOTHING.
   * ==========================================================================
   * This asserted the opposite — a green tick reading *"This will work"* on
   * every visit, at the top of both design tabs, above the gallery a merchant
   * came for. It is not news: it is the state they already assume, and there is
   * no action to take about it. `Shell`'s own subtitle argument names that cost
   * exactly — a permanent line that taxes every visit and informs one — and it
   * applies to a status chip as squarely as to a sentence.
   *
   * That still holds where the verdict now lives. The readiness panel is
   * permanent; its **To fix** block is not, and a sound design draws none of it.
   */
  it('says nothing at all when nothing is wrong with the design', async () => {
    await structure();

    expect(screen.queryByText('This will work')).toBeNull();
    expect(screen.queryByText(/thing to fix|things to fix/)).toBeNull();
  });

  /**
   * ==========================================================================
   * IT REPORTS COLOURS CHOSEN ON DESIGN, AND WAS ONLY READABLE FROM CONTENT.
   * ==========================================================================
   * `problemsIn` counts a contrast failure between two tokens, and the tokens
   * are edited on the **Design** tab — so the one surface that could produce
   * that problem was, at first, the one surface that could not show it. It was
   * then drawn on both design tabs and on neither of the other two.
   *
   * Above the tab strip it is readable from all four, which is the scope test
   * followed all the way: *"a visitor may not be able to read this"* is a fact
   * about the Optin rather than about the tab that caused it.
   */
  it('is readable from every tab, including the ones that cannot cause it', async () => {
    render(<OptinBuilder id={ID} onClose={vi.fn()} />);

    await screen.findByRole('tab', { name: 'Design' });

    // The stub names no tokens, so `nameOf` falls back to the raw key — which
    // is what a build whose vocabulary is ahead of its translations shows too.
    await userEvent.click(screen.getByRole('button', { name: /Choose a colour for muted/ }));
    await userEvent.clear(screen.getByLabelText('muted value'));
    await userEvent.type(screen.getByLabelText('muted value'), '#f4f4f5');

    /*
      **On the collapsed row**, which is what a merchant sees on every visit:
      the panel opens closed, so the count is the part that has to reach them
      without a press. The sentence itself is one click away, and readable from
      whichever tab they are on rather than from the two that edit the design.
    */
    expect(await screen.findByText('1 thing to fix')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Display rules' }));

    expect(screen.getByText('1 thing to fix')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /thing to fix/ }));

    expect(screen.getByText(/too close to the background/)).toBeInTheDocument();
  });

  /**
   * **Read out rather than behind a press.** It was a popover, which is right
   * for a chip in a toolbar and wrong for a panel with room: a merchant should
   * not have to press anything to find out what is stopping their Optin
   * working.
   *
   * Deleting the only button is refused, so the way to a design with a problem
   * is to duplicate a block that carries a [[Slot Role]] — the copy has none,
   * so its words are lost at the next design switch. That saves happily and
   * nothing else in the product would ever mention it.
   */
  it('lists what is wrong, with a way to the block', async () => {
    await structure();
    await menu('Fine print');
    await userEvent.click(screen.getByRole('menuitem', { name: /Duplicate/ }));
    await userEvent.click(screen.getByRole('button', { name: /thing to fix/ }));

    const problem = screen.getByRole('button', { name: /no name of its own/ });

    expect(problem).toBeInTheDocument();

    await userEvent.click(problem);

    expect(screen.getByRole('group', { name: 'Text' })).toBeInTheDocument();
  });
});

describe('undo and redo', () => {
  it('has nothing to undo before anything has changed', async () => {
    await structure();

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('takes a delete back, and then puts it forward again', async () => {
    await structure();

    await userEvent.click(
      within(row('Fine print')).getByRole('button', { name: 'Add, copy or delete Fine print' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));

    expect(rowNames()).not.toContain('Fine print');

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(rowNames()).toContain('Fine print');

    await userEvent.click(screen.getByRole('button', { name: 'Redo' }));

    expect(rowNames()).not.toContain('Fine print');
  });

  /**
   * **Undoing across a save is allowed, and re-marks the screen dirty.**
   * `config` is the draft and `published_config` is what the site serves, so a
   * save is not a commit. A history that refused to cross one would read as
   * "your last save is permanent", which is what a separate draft column exists
   * to make untrue.
   */
  it('crosses a save, and the screen is unsaved work again afterwards', async () => {
    await structure();

    await userEvent.click(within(row('Headline')).getByRole('button', { name: 'Move Headline down' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/Saved\./)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(rowNames().slice(0, 3)).toEqual(['The form', 'Headline', 'Body text']);
    expect(screen.queryByText(/Saved\./)).toBeNull();
  });
});

/**
 * ============================================================================
 * THE TOOLBAR'S SCOPE IS THE DESIGN, SO IT IS ON BOTH TABS THAT EDIT ONE.
 * ============================================================================
 * Undo, Redo and the verdict were rendered by the Content tab, and none of them
 * is scoped to it: the screen's history watches `template`, so a token changed
 * on **Design** is a full undo entry and so is picking a design. A merchant who
 * applied a preset and wanted it back had no Undo, because Undo was on the
 * other tab — which is ADR 0039's own scope test failing on the screen the ADR
 * was written for.
 */
describe('undo and redo, where they act on the whole draft', () => {
  /** The builder as it opens, which is on the Design tab. */
  async function design() {
    render(<OptinBuilder id={ID} onClose={vi.fn()} />);

    await screen.findByRole('tab', { name: 'Design' });
  }

  /**
   * ==========================================================================
   * HISTORY SITS WITH THE THING IT ACTS ON, WHICH IS NOT A REGION.
   * ==========================================================================
   * This asserted Undo and Redo were inside the tab's own panel. They are not
   * region-scoped: they move the whole draft, which is exactly the scope `Save
   * changes` has — so a region toolbar was paying a full-width bordered strip
   * at the top of two tabs for two controls a merchant reaches for
   * occasionally, and putting them there was what made that band exist.
   *
   * In the page-header band they are reachable from every tab, which is also
   * truthful: the history is the draft's, not the tab's.
   */
  it('puts Undo and Redo in the page header, beside the action with the same scope', async () => {
    await design();

    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeInTheDocument();
    expect(within(panel()).queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  /**
   * **The case the placement was wrong for.** A preset is a bundle of token
   * values written straight into the draft, so it is one entry in exactly the
   * same history a block move is — and taking it back had to be done from a tab
   * the merchant would have to leave the gallery to reach.
   */
  it('takes a preset back, from the tab the preset was applied on', async () => {
    await design();

    await userEvent.click(screen.getByRole('button', { name: /Midnight/ }));

    expect(screen.getByRole('button', { name: /Midnight/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(savedTokens()).toEqual(ENTRY.tokens);
  });
});

/**
 * ============================================================================
 * ⌘Z, WHICH `history.ts` WAS WRITTEN FOR AND WAS NEVER WIRED TO.
 * ============================================================================
 * `undo` returns its input by identity on a no-op, and its own comment says
 * that is *"what lets a caller wire a keyboard shortcut without asking `canUndo`
 * first"*. There was no such caller.
 */
describe('⌘Z', () => {
  const deleteFinePrint = async () => {
    await userEvent.click(
      within(row('Fine print')).getByRole('button', { name: 'Add, copy or delete Fine print' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
  };

  it('steps the history back, and ⇧⌘Z steps it forward', async () => {
    await structure();
    await deleteFinePrint();

    expect(rowNames()).not.toContain('Fine print');

    await userEvent.keyboard('{Meta>}z{/Meta}');

    expect(rowNames()).toContain('Fine print');

    await userEvent.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');

    expect(rowNames()).not.toContain('Fine print');
  });

  /**
   * **A box you type into keeps its own ⌘Z.** Stepping the design instead of
   * the sentence being typed is a shortcut that takes back the wrong thing, and
   * the merchant has no way to tell which one they are about to get.
   */
  it('stands aside where the focus is a text box', async () => {
    await structure();
    await deleteFinePrint();

    await userEvent.click(screen.getByLabelText('Name'));
    await userEvent.keyboard('{Meta>}z{/Meta}');

    expect(rowNames()).not.toContain('Fine print');
  });
});

/**
 * ============================================================================
 * A NEW FIELD ARRIVES WORDED, AND A HIDDEN BLOCK SAYS SO IN THE LIST.
 * ============================================================================
 * Two states the tree was not showing, both found by using the screen rather
 * than by reading it.
 */
describe('what a row shows about itself', () => {
  it('gives a new field the vocabulary’s own label and example', async () => {
    await structure();

    await userEvent.click(
      within(row('Fine print')).getByRole('button', { name: /Add, copy or delete Fine print/ }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add a block after this' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Field' }));

    /*
      `freeCapture` hands out the first kind nothing has claimed, in the
      manifest's own order — the design already captures an email, so this is
      the name. Its label and example are the pair `TemplateLabels` already
      ships, which is the same pair the ⇄ control writes when a field CHANGES
      kind. Neither is empty, which is the whole point.
    */
    expect((screen.getByRole('textbox', { name: 'Label' }) as HTMLInputElement).value).toBe('Name');
    expect((screen.getByRole('textbox', { name: 'Placeholder' }) as HTMLInputElement).value).toBe(
      'Your name',
    );
  });

  /**
   * *Show this* is a per-block switch whose only trace was the inspector for
   * the one block selected — so a merchant who hid the fine print and clicked
   * away had no way to find it again except by opening every row, and the
   * preview cannot help because the block is not in it.
   */
  it('marks a block the merchant switched off, in the list and to a screen reader', async () => {
    await structure();

    // The row's own label button, which is what selects — not the ⋯ menu
    // beside it, which also carries the block's name.
    await userEvent.click(within(row('Fine print')).getAllByRole('button')[0]);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show this' }));

    expect(row('Fine print')).toHaveAttribute('data-hidden', 'true');
    expect(within(row('Fine print')).getByText('Hidden')).toBeInTheDocument();
  });

  /**
   * **`counted` alone is a word with no referent.** It is the only chip in the
   * admin naming a concept the merchant has not met, so the sentence travels
   * with it rather than living in a docblock.
   */
  it('says what “counted” means, rather than only that a row is counted', async () => {
    await structure();

    const chip = within(row('Button label')).getByText('counted');

    expect(chip).toHaveAttribute('title', expect.stringContaining('conversions are counted'));
  });
});

/**
 * ============================================================================
 * A NAME IS NOT AN EXPLANATION, AND FOUR OF THE ADD MENU'S WERE ONLY NAMES.
 * ============================================================================
 * *Column*, *Row*, *Side by side* and *Grid* arrived as four bare words, and
 * two of them are genuinely hard to tell apart from their names — a Row lays
 * blocks along one line, a Side by side gives each pane its own stack. The way
 * to find out which was which was to add one, look at the preview, and delete
 * it again.
 */
describe('the Add menu', () => {
  it('says what a layout does, and leaves a leaf to name itself', async () => {
    await structure();

    await userEvent.click(
      within(row('Fine print')).getByRole('button', { name: /Add, copy or delete Fine print/ }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add a block after this' }));

    // A layout carries its one short line…
    expect(
      screen.getByRole('menuitem', { name: /Side by side/ }),
    ).toHaveTextContent('Two panes, each holding its own blocks.');

    // …and a leaf does not, because printing one under "Heading" would be the
    // wall of text this menu exists not to be.
    expect(screen.getByRole('menuitem', { name: 'Heading' })).toHaveTextContent(/^Heading$/);
  });
});

/**
 * ============================================================================
 * A LAYOUT HAS SETTINGS, AND THE EDITOR OFFERED NONE OF THEM.
 * ============================================================================
 * `split` declares `ratio` in the manifest and the renderer reads it — and no
 * control in this admin reached it, so a Side by side was a fixed 50/50 forever
 * and the manifest described a capability nobody had. (`grid`'s `columns` was
 * the same, and is one of the reasons that layout is gone rather than fixed.)
 *
 * *"Holds blocks rather than words"* was true, and was being used as a reason to
 * draw nothing.
 */
describe('a layout’s own settings', () => {
  async function withSplit() {
    await structure();

    await userEvent.click(
      within(row('Fine print')).getByRole('button', { name: /Add, copy or delete Fine print/ }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add a block after this' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /^Side by side/ }));
  }

  it('offers Side by side the split it always declared', async () => {
    await withSplit();

    const group = screen.getByRole('group', { name: 'How the space is divided' });

    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    /*
     * **The declared default is checked on a fresh one**, and this assertion is
     * the inverse of what it used to be. A fresh `split` carries no `ratio`, and
     * the panel claimed nothing — on the argument that the vocabulary does not
     * validate a param's value, which is an argument about an OFF-LIST value
     * being applied to an ABSENT one. `.wc-pane` reads `var(--wc-ratio,.5)`, so
     * the merchant is looking at an even split and the control now says so.
     */
    expect(within(group).getByRole('radio', { name: 'Even' })).toBeChecked();
  });

  /**
   * And a value the manifest does not offer still checks nothing. That is the
   * case the old assertion was really written for: the renderer takes any
   * fraction, so a design shipping `0.4` keeps it, and ticking the nearest chip
   * would be the screen telling a merchant their design is something it is not.
   */
  it('checks nothing on a split the manifest does not offer', async () => {
    builder.getOptin.mockResolvedValue(
      optin({
        config: {
          template_id: 'centred-card',
          template: {
            tokens: ENTRY.tokens,
            /*
              Nested rather than at the top of the step: a step's root layout is
              the step's own row ("The form"), so a `split` there has no row of
              its own to select.
            */
            tree: {
              steps: [
                {
                  type: 'stack',
                  children: [{ type: 'split', ratio: 0.4, start: [], end: [] }],
                },
              ],
            },
          },
        },
      }),
    );

    await structure();
    await userEvent.click(within(row('Side by side')).getAllByRole('button')[0]);

    const group = screen.getByRole('group', { name: 'How the space is divided' });

    expect(within(group).queryAllByRole('radio', { checked: true })).toHaveLength(0);
  });

  it('writes the chosen split as the number the renderer reads', async () => {
    await withSplit();

    await userEvent.click(screen.getByRole('radio', { name: 'Narrow left' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const split = formChildren(savedTree()).find((node) => node.type === 'split') as
      | { ratio?: unknown }
      | undefined;

    // A number and not the manifest's string — `render.ts` checks `typeof
    // node.ratio === 'number'` and ignores anything else.
    expect(split?.ratio).toBe(0.35);
  });

  /** A Row declares no params, so it draws no settings rather than an empty box. */
  it('draws nothing for a layout that declares none', async () => {
    await structure();

    await userEvent.click(within(row('Row')).getAllByRole('button')[0]);

    expect(screen.queryByRole('group', { name: 'How the space is divided' })).toBeNull();
  });
});

/**
 * ============================================================================
 * A LEAF HAS SETTINGS TOO, AND THREE OF THEM REACHED NO CONTROL EITHER.
 * ============================================================================
 * `heading.level`, `image.fit` and `field.required` are declared in the
 * manifest and honoured at both ends — `required` by the CAPTURE endpoint,
 * which refuses a submission that left one empty — and the only way to set any
 * of them was to author a [[Template]] by hand. Exactly the hole `split.ratio`
 * was in one level of the vocabulary up.
 *
 * Each test asserts what is SAVED as well as what is drawn, because the failure
 * these controls could ship with is a value of the wrong type: the manifest
 * spells every choice as a string, and the renderer tests `level === 2` and
 * `required === true`. A control writing `"2"` and `"true"` draws correctly,
 * saves cleanly, normalises cleanly and does nothing at all.
 */
describe('a leaf’s own settings', () => {
  /** The block a slot's settings belong to, opened in the inspector. */
  async function selecting(name: string) {
    await structure();
    await userEvent.click(within(row(name)).getAllByRole('button')[0]);
  }

  /** The leaf at the top of the form step, whatever the test put there. */
  const firstLeaf = (): Record<string, unknown> =>
    formChildren(savedTree())[0] as unknown as Record<string, unknown>;

  const save = () => userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  it('offers a heading the rank the renderer has always read', async () => {
    await selecting('Headline');

    const group = screen.getByRole('group', { name: 'Heading rank' });

    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    /*
      **The declared default is checked.** No shipped design carries a `level`
      at all — `"level"` appears zero times in the twelve library templates — so
      claiming nothing would have left every heading in the library drawing two
      chips with neither ticked, while `render.ts` drew an unambiguous `h2`.
      `tests/js/renderer-manifest-parity.test.ts` is what holds the manifest's
      declared default to what the renderer actually does with an absent key.
    */
    expect(within(group).getByRole('radio', { name: 'Main heading' })).toBeChecked();
  });

  it('writes a heading rank as the number the renderer compares', async () => {
    await selecting('Headline');

    await userEvent.click(screen.getByRole('radio', { name: 'Sub-heading' }));
    await save();

    // `render.ts` reads `node.level === 2`; the string "2" is not that.
    expect(firstLeaf().level).toBe(2);
  });

  /**
   * **The one that is not cosmetic.** `CaptureForm` reads
   * `$node['required'] === true` and refuses the submission that left it empty,
   * so a control writing the string `"true"` would silently make every field on
   * the site optional.
   */
  it('writes a field’s requiredness as the boolean the capture endpoint reads', async () => {
    await selecting('Email address');

    const group = screen.getByRole('group', { name: 'Must they fill this in?' });

    // `centred-card` ships `required: true`, so the panel starts on it.
    expect(within(group).getByRole('radio', { name: 'Required' })).toBeChecked();

    await userEvent.click(within(group).getByRole('radio', { name: 'Optional' }));
    await save();

    const field = formChildren(savedTree()).find((node) => node.type === 'row') as unknown as {
      children: Record<string, unknown>[];
    };

    expect(field.children[0].required).toBe(false);
  });

  /**
   * A picture, on a design that has one. `centred-card` does not, which is the
   * point of overriding the config rather than adding a block: a stored `fit`
   * is what proves the control reads the tree rather than only writing to it.
   */
  it('reads a picture’s fit off the design and writes the other one back', async () => {
    builder.getOptin.mockResolvedValue(
      optin({
        config: {
          template_id: 'centred-card',
          template: {
            tokens: ENTRY.tokens,
            tree: {
              steps: [
                {
                  type: 'stack',
                  children: [{ type: 'image', id: 'n1', src: '/x.png', alt: '', fit: 'cover' }],
                },
              ],
            },
          },
        },
      }),
    );

    await selecting('Image');

    const group = screen.getByRole('group', { name: 'How the picture fills its space' });

    expect(within(group).getByRole('radio', { name: 'Fill the space, cropping' })).toBeChecked();

    await userEvent.click(within(group).getByRole('radio', { name: 'Fit the whole picture in' }));
    await save();

    expect(firstLeaf().fit).toBe('contain');
  });

  /**
   * **A leaf that declares no choices draws no settings**, which is what keeps
   * `hidden`, `name` and `action` out of here: each is already drawn by a
   * control with words of its own, and a second one would be two ways to ask
   * one question.
   */
  it('draws nothing for a leaf that offers none', async () => {
    await selecting('Body text');

    expect(screen.queryByRole('group', { name: 'Heading rank' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Must they fill this in?' })).toBeNull();
  });

  /**
   * **A setting is its own undo entry, not the tail of a sentence.** The
   * inspector's text boxes coalesce a burst of typing into one entry; a radio
   * press sharing that key would make a single ⌘Z take back both the words and
   * the choice.
   */
  it('is a separate step from the typing before it', async () => {
    await selecting('Headline');

    await userEvent.type(screen.getByRole('textbox', { name: 'Text' }), '!');
    await userEvent.click(screen.getByRole('radio', { name: 'Sub-heading' }));
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await save();

    const heading = firstLeaf();

    expect(heading.level).toBeUndefined();
    expect(heading.text).toBe('Get 10% off your first order!');
  });
});
