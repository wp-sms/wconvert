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
    cta_label: 'Button label',
    consent_text: 'Consent wording',
    success_headline: 'Headline after they submit',
    success_body: 'Body text after they submit',
  },
  nodes: {
    heading: 'Heading',
    text: 'Text',
    image: 'Image',
    field: 'Field',
    button: 'Button',
    consent: 'Consent checkbox',
  },
  layouts: { stack: 'Column', row: 'Row', split: 'Side by side', grid: 'Grid' },
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
    expect(refused).toHaveTextContent('reporting nothing');
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

    for (const kind of ['Heading', 'Text', 'Image', 'Field', 'Button', 'Consent checkbox', 'Column', 'Row', 'Grid']) {
      expect(await screen.findByRole('menuitem', { name: new RegExp(kind) })).toBeInTheDocument();
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
   * **Role exhaustion is said out loud.** A block with no free Slot Role still
   * edits — the Content tab heads it by its kind — but it has no `SlotKey`, so
   * clicking it in the preview reaches nothing. A merchant not told reads that
   * as a bug.
   */
  it('says when a new block could not be given a name of its own', async () => {
    await structure();

    await userEvent.click(
      within(row('Headline')).getByRole('button', { name: 'Add, copy or delete Headline' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add a block after this' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Heading' }));

    expect(screen.getByRole('status')).toHaveTextContent('not linked to the preview');
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
   * So a sound design says nothing, and the band it used to say it in is not
   * drawn at all. What the verdict still owes is asserted below, unchanged: it
   * counts what is wrong, lists it, and takes the merchant to the block.
   */
  it('draws no band at all when nothing is wrong with the design', async () => {
    await structure();

    expect(within(panel()).queryByText('This will work')).toBeNull();
    expect(within(panel()).queryByText(/thing to fix|things to fix/)).toBeNull();
  });

  /**
   * ==========================================================================
   * IT REPORTS COLOURS CHOSEN ON DESIGN, AND WAS ONLY READABLE FROM CONTENT.
   * ==========================================================================
   * `problemsIn` counts a contrast failure between two tokens, and the tokens
   * are edited on the **Design** tab — so the one surface that can produce that
   * problem was the one surface that could not show it. ADR 0039's own test is
   * that a control's SCOPE decides its placement, and this one's scope is the
   * whole design.
   */
  it('is on the Design tab too, where the colours that fail it are chosen', async () => {
    render(<OptinBuilder id={ID} onClose={vi.fn()} />);

    await screen.findByRole('tab', { name: 'Design' });

    // Made unreadable from the tab that CHOOSES the colours, which is the whole
    // argument above: the one surface that can produce a contrast failure has
    // to be a surface that can report one.
    // The stub names no tokens, so `nameOf` falls back to the raw key — which
    // is what a build whose vocabulary is ahead of its translations shows too.
    await userEvent.click(screen.getByRole('button', { name: /Choose a colour for muted/ }));
    await userEvent.clear(screen.getByLabelText('muted value'));
    await userEvent.type(screen.getByLabelText('muted value'), '#f4f4f5');

    expect(await within(panel()).findByText(/thing to fix|things to fix/)).toBeInTheDocument();
  });

  /**
   * Deleting the only button is refused, so the way to a design with no
   * converting act is to delete what HOLDS it — which the guards allow only
   * once nothing else depends on it. The row is the whole form here, so the
   * refusal stands and the verdict is asked of a different failure: a colour
   * pair a visitor cannot read, which nothing refuses.
   */
  it('counts what is wrong and lists it, with a way to the block', async () => {
    await structure();
    await menu('Fine print');
    await userEvent.click(screen.getByRole('menuitem', { name: /Duplicate/ }));

    // The copy has no Slot Role, so its words are lost at the next design
    // switch — a problem that saves happily and that nothing else mentions.
    await userEvent.click(screen.getByRole('button', { name: '1 thing to fix' }));

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
describe('the design toolbar', () => {
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
