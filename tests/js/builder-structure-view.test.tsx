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
 * WHAT THE STRUCTURE TAB DOES TO THE DESIGN, THROUGH THE WHOLE SCREEN.
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
  keys: { text: 'Text', label: 'Label', placeholder: 'Placeholder', link: 'Link' },
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

/** Open the builder and land on the Structure tab. */
async function structure() {
  render(<OptinBuilder id={ID} onClose={vi.fn()} />);

  await userEvent.click(await screen.findByRole('tab', { name: 'Structure' }));
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

/** What the last Save sent, as a tree. */
const savedTree = (): TemplateTree =>
  (builder.saveOptin.mock.calls.at(-1)?.[2] as { template: { tree: TemplateTree } }).template.tree;

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
