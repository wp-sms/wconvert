import { treeFixture } from './support/journey';
import LABELS_FIXTURE from '../fixtures/template-labels.json';
import { CLICK_OUTCOME } from './support/outcomes';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ruleTypes } from './support/rule-types';
import type { TemplateEntry } from '../../resources/admin/src/templates/api';
import type { Template, TemplateTree } from '@renderer/types';

/**
 * ============================================================================
 * THE LOOK OF ONE BOX, THROUGH THE WHOLE SCREEN.
 * ============================================================================
 * `panel.ts`'s scope walk is tested as a pure function in
 * `builder-panel.test.ts`, and the vocabulary that lets a bag exist at all is
 * held in PHP and in `renderer-manifest-parity`. This file asks the one
 * question only the assembled editor can answer: **does selecting a box and
 * pressing a colour reach that box's own bag, and does what comes back get
 * sent to the server?**
 *
 * It also holds the three things a scope makes newly necessary and a global
 * token set never did — what a value resolves to here, where it came from, and
 * what clearing means (ADR 0062).
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
const { ScopeStyle } = await import('../../resources/admin/src/builder/ScopeStyle');

const ENTRY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8'),
) as TemplateEntry;

const ID = '01JQ00000000000000000000AA';

/**
 * A design with a box inside a box, which is the shape a scope chain needs to
 * be interesting at all: the panel sets a ground, the stack inside it sets
 * nothing, and the heading in that stack is drawn with the panel's.
 */
const NESTED: TemplateTree = treeFixture({
  steps: [
    {
      type: 'stack',
      children: [
        {
          type: 'panel',
          tokens: { bg: '#fff4df', fg: '#331e17' },
          children: [
            {
              type: 'stack',
              children: [{ type: 'heading', role: 'headline', text: 'Get 10% off', id: 'n1' }],
            },
          ],
        },
        { type: 'button', role: 'cta_label', label: 'Join', action: 'submit', id: 'n2' },
      ],
    },
    { type: 'stack', children: [{ type: 'heading', role: 'success_headline', text: 'Done', id: 'n3' }] },
  ],
}) as unknown as TemplateTree;

const LABELS = {
  roles: { headline: 'Headline', cta_label: 'Button label', success_headline: 'Headline after they submit' },
  nodes: { heading: 'Heading', button: 'Button' },
  layouts: {
    stack: 'Column',
    row: 'Row',
    split: 'Side by side',
    grid: 'Equal columns',
    panel: 'Colored box',
    media: LABELS_FIXTURE.layouts.media,
  },
  layoutNotes: {
    stack: 'Blocks stacked top to bottom.',
    row: 'Blocks along one line.',
    split: 'Two panes, each holding its own blocks.',
    grid: 'Three across, one per line on a phone.',
    panel: 'A box with its own colors, holding other blocks.',
  },
  layoutParams: {},
  layoutParamValues: {},
  nodeParams: {},
  nodeParamValues: {},
  fields: {},
  keys: { text: 'Text', label: 'Label' },
  placeholders: {},
  params: { submit: 'Sends the form', link: 'Goes somewhere else' },
  tokenValues: {},
  // The words a merchant sees are `TemplateLabels::all()`'s, never a second spelling.
  tokens: { bg: LABELS_FIXTURE.tokens.bg, fg: LABELS_FIXTURE.tokens.fg, muted: LABELS_FIXTURE.tokens.muted, accent: LABELS_FIXTURE.tokens.accent },
};

const GOALS = [
  {
    id: 'grow_email_list',
    label: 'Grow my email list',
    description: '',
    needs_a_capture: false,
    grows_a_list: false, outcome: CLICK_OUTCOME,
    headline_kind: 'conversion',
    tier: 'free',
    availability: { available: true },
  },
];

function optin(tree: TemplateTree, tokens: Record<string, string>) {
  return {
    can_change_goal: true,
    id: ID,
    name: 'Welcome discount',
    goal: 'grow_email_list',
    published_at: null,
    config: { template_id: 'centred-card', template: { tree, tokens } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // The Full width toggle remembers itself per browser, and a test that turned
  // it on would otherwise open the next one already folded.
  window.localStorage.clear();
  builder.getOptin.mockResolvedValue(optin(NESTED, { bg: '#ffffff', fg: '#111827' }));
  builder.getRules.mockResolvedValue(ruleTypes());
  builder.saveOptin.mockImplementation((_id: string, _name: string, config: Record<string, unknown>) =>
    Promise.resolve({ ...optin(NESTED, {}), config }),
  );
  templates.listTemplates.mockResolvedValue({ templates: [ENTRY], labels: LABELS });
  stats.readDashboard.mockResolvedValue({ from: '', to: '', days: 30, goals: [] });
  destinations.readDestinations.mockResolvedValue({ destinations: [], types: [] });
  goals.listGoals.mockResolvedValue(GOALS);
});

/**
 * Open the builder, select one row in the tree, and open the inspector's Style
 * half.
 *
 * Scoped to the treegrid, because a block's name is on screen twice by design:
 * once as the row and once as the inspector's own heading.
 */
async function style(row: RegExp) {
  render(<OptinBuilder id={ID} onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole('tab', { name: 'Edit' }));
  const tree = await screen.findByRole('treegrid', { name: /^Blocks/ });

  /*
    The row's own accessible name is every cell's text run together — the kind,
    the words it shows, and three controls all named after it — so the row is
    found loosely and the SELECT button inside it is the first one, exactly as
    the shell suite does it.
  */
  await userEvent.click(within(within(tree).getByRole('row', { name: row })).getAllByRole('button')[0]!);

  const halves = screen.queryByRole('tablist', { name: /settings$/ });
  if (halves) await userEvent.click(within(halves).getByRole('tab', { name: 'Style' }));
}

/** The design as the last save sent it. */
function saved(): Template {
  const calls = builder.saveOptin.mock.calls;
  const config = calls[calls.length - 1]?.[2] as { template: Template };

  return config.template;
}

/**
 * A colour drag writes on every pointer move. Each write names the element,
 * width and token it came from, so the draft's history keeps the drag as one
 * Undo step rather than fifty that push every earlier edit out.
 */
describe('a drag on one element’s colour', () => {
  it('names the element, width and token on every change it makes', async () => {
    const onChange = vi.fn();
    function Harness() {
      const [open, setOpen] = useState<string | null>(null);
      return <ScopeStyle template={{ tree: NESTED, tokens: { bg: '#ffffff', fg: '#111827' } }} labels={LABELS} path={[0, 'children', 0]}
        openToken={open} onOpenToken={setOpen} onSelect={vi.fn()} onChange={onChange} copied={null} onCopy={vi.fn()} width="tokens" />;
    }
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: /Choose a color for Background/ }));
    const alpha = await screen.findByRole('slider', { name: 'Alpha' });
    fireEvent.keyDown(alpha, { keyCode: 37 });
    fireEvent.keyDown(alpha, { keyCode: 37 });

    expect(onChange.mock.calls.length).toBeGreaterThan(0);
    expect(onChange.mock.calls.map(([, key]) => key as unknown)).toEqual(onChange.mock.calls.map(() => 'style:0.children.0:tokens:bg'));
  });
});

describe('the Style half of the inspector', () => {
  /**
   * **A leaf has no inside, so it has no bag.** The vocabulary drops `tokens`
   * on one, and a merchant who selects a headline and meets an empty panel has
   * learned nothing — so the panel says which box decides for it and hands over
   * the way there (ADR 0042 rule 4).
   */
  it('offers a headline its own appearance without unrelated controls', async () => {
    await style(/Get 10% off/);
    expect(screen.getByRole('group', { name: 'Headline' })).toHaveTextContent('Appearance for Heading.');
    expect(screen.getByRole('button', { name: /Choose a color for Text/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Choose a color for Background/ })).toBeNull();
  });

  /**
   * **A step root is "the design" and never its layout's name.** Selecting it
   * opens the design's own tokens — the outermost scope, which is what the
   * Design tab always edited — so calling it *Column* would send a merchant
   * looking for the design's colours to something named after a flex direction.
   */
  /** One way back (D2), named for where it goes: the screen the element is on. */
  it('offers one way back, and no crumb for a top-level element', async () => {
    await style(/Button label/);
    expect(screen.getByRole('button', { name: 'Screen 1' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Inside' })).toBeNull();
  });

  /**
   * The design's own tokens are one press from any leaf, which is the whole of
   * what replaced a tab.
   */
  it('reaches the designs own token controls through that door', async () => {
    await style(/Button label/);
    // The design's own tokens are the Look's, one row away in the Edit tree (ADR 0134).
    await userEvent.click(screen.getByRole('button', { name: /^Look/ }));
    expect(screen.getByRole('button', { name: /Choose a color for Background/ })).toBeInTheDocument();
  });

  /**
   * ==========================================================================
   * A COLOUR TYPED ON A BOX LANDS IN THAT BOX'S BAG AND NOWHERE ELSE.
   * ==========================================================================
   * The whole claim of ADR 0062, asserted through the screen: the design's own
   * tokens are untouched, and the tree carries the value on the node that was
   * selected.
   */
  it('writes a color into the selected boxs own bag, leaving the design alone', async () => {
    await style(/Colored box/);

    // The typed hex lives inside the picker's popover, so it has to be opened
    // first — the swatch is the control, and the box is the escape hatch under
    // it (ADR 0042).
    await userEvent.click(screen.getByRole('button', { name: /Choose a color for Background/ }));
    await userEvent.clear(screen.getByLabelText('Background value'));
    await userEvent.type(screen.getByLabelText('Background value'), '#123456');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    const design = saved();
    const panel = (design.tree.steps[0].content as unknown as {
      children: { tokens?: Record<string, string> }[];
    }).children[0];

    expect(panel?.tokens?.bg).toBe('#123456');
    expect(design.tokens.bg).toBe('#ffffff');
  });

  /**
   * **Clearing means inherit, not "back to the manifest".** At the design a
   * reset writes the design's own value back; at a scope there is no such value
   * — the box either declares one or takes what it sits inside. So the control
   * clears the key, and an emptied bag leaves none at all, which is what makes
   * undoing every scoped edit produce the tree the merchant started with.
   */
  it('clears the key rather than writing a default, and drops an emptied bag', async () => {
    await style(/Colored box/);

    for (const token of ['Background', 'Text']) {
      await userEvent.click(
        screen.getByRole('button', { name: new RegExp(`Let ${token} be inherited again`) }),
      );
    }

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    const panel = (saved().tree.steps[0].content as unknown as { children: Record<string, unknown>[] })
      .children[0];

    expect(panel).not.toHaveProperty('tokens');
  });

  /**
   * **The surprising source is the one that speaks.** A value inherited from
   * another BOX is invisible in the panel and is the whole reason a colour
   * changed on the design did nothing — so it is named, with the way to that
   * box. *From the design* and *the default* say nothing, because they are what
   * a merchant already assumes (ADR 0042 rule 2).
   */
  it('names the box a value was inherited from, and says nothing where it is the designs', async () => {
    await style(/Column/);

    // Two of them: the panel sets `bg` and `fg`, and both reach this box by
    // inheritance. Everything else falls through to the design and says nothing.
    expect(screen.getAllByRole('button', { name: 'From Colored box' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^From Column/ })).toBeNull();
  });

  /**
   * ==========================================================================
   * COPY A LOOK ONTO THE NEXT BOX, BECAUSE THREE CREAM PANELS IS THE ORDINARY
   * CASE.
   * ==========================================================================
   * The alternative is setting six tokens three times and getting one of the
   * eighteen wrong. It replaces rather than merges: a merge leaves whatever the
   * target already set and produces a box that is neither what was copied nor
   * what was there, and undo pays for the bluntness.
   */
  it('copies one boxs look and pastes it onto another, replacing what was there', async () => {
    await style(/Colored box/);
    await userEvent.click(screen.getByRole('button', { name: 'Copy this look' }));

    // The inner Column, which sets nothing of its own.
    const tree = screen.getByRole('treegrid', { name: /^Blocks/ });

    await userEvent.click(within(within(tree).getByRole('row', { name: /Column/ })).getAllByRole('button')[0]!);
    await userEvent.click(screen.getByRole('button', { name: /^Paste 2 setting/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    const inner = (saved().tree.steps[0].content as unknown as {
      children: { children: { tokens?: Record<string, string> }[] }[];
    }).children[0]?.children[0];

    expect(inner?.tokens).toEqual({ bg: '#fff4df', fg: '#331e17' });
  });

  /** Nothing to copy is nothing to offer, so the control refuses rather than lies. */
  it('will not copy a box that sets nothing of its own', async () => {
    await style(/Column/);

    expect(screen.getByRole('button', { name: 'Copy this look' })).toBeDisabled();
  });

  /** And following it selects that box, so the next press changes the value. */
  it('opens the box a value came from', async () => {
    await style(/Column/);
    await userEvent.click(screen.getAllByRole('button', { name: 'From Colored box' })[0]!);

    expect(screen.getByRole('group', { name: 'Colored box' })).toBeInTheDocument();
  });
});

/**
 * ============================================================================
 * THE WIDTH SWITCH USED TO MOVE THE PREVIEW AND CHANGE NOTHING ABOUT WHAT WAS
 * EDITED.
 * ============================================================================
 * A box carries its tokens twice now (ADR 0064), and the same twenty-four
 * controls edit either bag — so the switch that decides which width is on
 * screen also decides which one they write to. That is what makes it a mode
 * rather than a second panel: the merchant sets the narrow values while looking
 * at the narrow render.
 */
describe('the narrow bag, through the width switch', () => {
  /** Put the preview — and therefore the inspector — on the narrow width. */
  async function narrow() {
    await userEvent.click(screen.getByRole('radio', { name: 'Mobile' }));
  }

  it('says which width it is setting, because the controls are identical', async () => {
    await style(/Colored box/);

    const inspector = within(screen.getByRole('group', { name: 'Colored box' }));
    expect(inspector.queryByText(/Editing mobile appearance/)).toBeNull();

    await narrow();

    expect(inspector.getByText('Editing mobile appearance. Unchanged values follow desktop.')).toBeInTheDocument();
  });

  it('writes into the narrow bag and leaves the full-width one alone', async () => {
    await style(/Colored box/);
    await narrow();

    await userEvent.click(screen.getByRole('button', { name: /Choose a color for Background/ }));
    await userEvent.clear(screen.getByLabelText('Background value'));
    await userEvent.type(screen.getByLabelText('Background value'), '#123456');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    const panel = (saved().tree.steps[0].content as unknown as {
      children: { tokens?: Record<string, string>; narrow?: Record<string, string> }[];
    }).children[0];

    expect(panel?.narrow?.bg).toBe('#123456');
    // The fixture's own full-width value, untouched — which is the whole point
    // of the second bag rather than a second set of controls.
    expect(panel?.tokens?.bg).toBe('#fff4df');
  });

  /**
   * **A value set on the box's own WIDE bag is still *set here* at narrow**,
   * and the two sentences are what a reset button alone could not tell apart:
   * it appears whenever a value is set at either width, so a merchant editing
   * at narrow could not see which of the two they were looking at.
   */
  it('tells set-here and set-for-narrow apart', async () => {
    builder.getOptin.mockResolvedValue(
      optin(
        treeFixture({
          steps: [
            {
              type: 'stack',
              children: [
                {
                  type: 'panel',
                  tokens: { bg: '#fff4df' },
                  narrow: { pad: '1rem' },
                  children: [{ type: 'button', role: 'cta_label', label: 'Go', action: 'submit' }],
                },
              ],
            },
            { type: 'stack', children: [{ type: 'text', role: 'success_body', text: 'Done' }] },
          ],
        }) as unknown as TemplateTree,
        { bg: '#ffffff' },
      ),
    );

    await style(/Colored box/);

    expect(document.querySelector('.wconvert-scope__from [data-set="here"]')).toBeNull();

    await narrow();

    // `pad` is the one the narrow bag names; `bg` is inherited from the box's
    // own wide bag, which is a different sentence.
    expect(within(screen.getByRole('tabpanel', { name: 'Edit' })).getByText('Mobile override')).toBeInTheDocument();
    expect(document.querySelector('.wconvert-scope__from [data-set="here"]')).toBeNull();
  });
});

/**
 * ============================================================================
 * A HEX SURVIVES EVERY THEME THE MERCHANT TRIES, AND THAT IS THE PROBLEM.
 * ============================================================================
 * A theme moves the design's colours; a scoped bag that spelled one does not
 * move with it — so the deeper a design is styled, the less a theme does
 * (ADR 0063). A value that NAMES a colour token follows it.
 */
describe('a scoped color that follows the palette', () => {
  it('offers the conversion where the value is a literal the merchant set', async () => {
    await style(/Colored box/);

    await userEvent.click(screen.getByRole('button', { name: /Choose a color for Background/ }));
    await userEvent.clear(screen.getByLabelText('Background value'));
    await userEvent.type(screen.getByLabelText('Background value'), '#123456');
    await userEvent.keyboard('{Escape}');

    /*
      Named for the token it will FOLLOW rather than for the one being set, in
      the label stub's own words — `bg` follows `accent`, which the stub calls
      *Button*. The identity is the one mapping that cannot be written:
      `--wc-bg: var(--wc-bg)` is a cycle CSS discards.
    */
    await userEvent.click(screen.getByRole('button', { name: /→ Button/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    const panel = (saved().tree.steps[0].content as unknown as {
      children: { tokens?: Record<string, string> }[];
    }).children[0];

    expect(panel?.tokens?.bg).toBe('accent');
  });

  /**
   * **A control that changes nothing is the one thing ADR 0054 rule 3
   * forbids.** A press on `→ Highlight` where the value already reads `accent`
   * would rewrite it to itself.
   */
  it('stops offering it once the value already names a token', async () => {
    builder.getOptin.mockResolvedValue(
      optin(
        treeFixture({
          steps: [
            {
              type: 'stack',
              children: [
                {
                  type: 'panel',
                  tokens: { bg: 'accent' },
                  children: [{ type: 'button', role: 'cta_label', label: 'Go', action: 'submit' }],
                },
              ],
            },
            { type: 'stack', children: [{ type: 'text', role: 'success_body', text: 'Done' }] },
          ],
        }) as unknown as TemplateTree,
        { bg: '#ffffff', accent: '#263f2c' },
      ),
    );

    await style(/Colored box/);

    expect(screen.queryByRole('button', { name: /→ / })).toBeNull();
  });
});

/**
 * ============================================================================
 * A WARNING ABOUT A COLOUR THE BOX DOES NOT DRAW IS THE ONE THAT TEACHES A
 * MERCHANT TO READ PAST THE REST.
 * ============================================================================
 * At the design every pair is somewhere in the tree. At a scope it is
 * different: `fieldwork`'s photo pane holds two headings and nothing else, and
 * measuring all four pairs on it reported *"Quiet text on Background is 1.1 to
 * 1"* about a colour with no text in that box to draw it — beside a second
 * warning about a field ground with no field (ADR 0042 rule 2).
 */
describe('the readability readout at a scope', () => {
  /** A box with a failing `muted` and nothing in it that reads `muted`. */
  const HEADINGS_ONLY = treeFixture({
    steps: [
      {
        type: 'stack',
        children: [
          {
            type: 'panel',
            tokens: { bg: '#546c49', fg: '#ffffff', muted: '#56634e' },
            children: [{ type: 'heading', role: 'headline', text: 'Room to grow.' }],
          },
          { type: 'button', role: 'cta_label', label: 'Go', action: 'submit' },
        ],
      },
      { type: 'stack', children: [{ type: 'text', role: 'success_body', text: 'Done' }] },
    ],
  }) as unknown as TemplateTree;

  it('says nothing about a pair no leaf in the box reads', async () => {
    builder.getOptin.mockResolvedValue(optin(HEADINGS_ONLY, { bg: '#ffffff', fg: '#111827' }));

    await style(/Colored box/);

    // `muted` on this box's ground is 1.1:1 and would have been reported.
    expect(screen.queryByText(/Lighter text on Background/)).toBeNull();
  });

  it('still says it where the box holds something that reads it', async () => {
    builder.getOptin.mockResolvedValue(
      optin(
        treeFixture({
          steps: [
            {
              type: 'stack',
              children: [
                {
                  type: 'panel',
                  tokens: { bg: '#546c49', fg: '#ffffff', muted: '#56634e' },
                  children: [
                    { type: 'heading', role: 'headline', text: 'Room to grow.' },
                    { type: 'text', role: 'fine_print', size: 's', text: 'Terms apply.' },
                  ],
                },
                { type: 'button', role: 'cta_label', label: 'Go', action: 'submit' },
              ],
            },
            { type: 'stack', children: [{ type: 'text', role: 'success_body', text: 'Done' }] },
          ],
        }) as unknown as TemplateTree,
        { bg: '#ffffff', fg: '#111827' },
      ),
    );

    await style(/Colored box/);

    expect(within(screen.getByRole('tabpanel', { name: 'Edit' })).getByText(/Lighter text on Background/)).toBeInTheDocument();
  });
});

/**
 * ============================================================================
 * A RESTYLED BOX LOOKED EXACTLY LIKE AN UNTOUCHED ONE IN A LIST OF ROWS.
 * ============================================================================
 * A bag applies to a box and everything inside it, and nothing about the row
 * said which boxes carried one — so after restyling a design box by box the
 * only way to find the nine tokens set on the second panel was to select every
 * panel in turn and read the reset buttons.
 */
describe('the tree’s override count', () => {
  it('counts what a box sets, and says nothing for one that sets nothing', async () => {
    builder.getOptin.mockResolvedValue(
      optin(
        treeFixture({
          steps: [
            {
              type: 'stack',
              children: [
                {
                  type: 'panel',
                  tokens: { bg: '#fff4df', pad: '2rem' },
                  narrow: { pad: '1rem' },
                  children: [{ type: 'button', role: 'cta_label', label: 'Go', action: 'submit' }],
                },
                { type: 'panel', children: [{ type: 'text', role: 'body', text: 'Plain' }] },
              ],
            },
            { type: 'stack', children: [{ type: 'text', role: 'success_body', text: 'Done' }] },
          ],
        }) as unknown as TemplateTree,
        { bg: '#ffffff' },
      ),
    );

    render(<OptinBuilder id={ID} onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole('tab', { name: 'Edit' }));
  const tree = await screen.findByRole('treegrid', { name: /^Blocks/ });
    const boxes = within(tree).getAllByRole('row', { name: /Colored box/ });

    // Two at full width and one more at narrow, which is also the payload's
    // shape.
    expect(boxes[0]).toHaveTextContent('2+1');
    expect(
      within(boxes[0] as HTMLElement).getByTitle(/sets 2 thing/),
      'the count carries its own sentence, because a bare number is a number',
    ).toBeInTheDocument();
    // And a box that sets nothing draws no chip at all, rather than a zero.
    expect(within(boxes[1] as HTMLElement).queryByTitle(/sets \d/)).toBeNull();
  });
});

describe('full width', () => {
  /**
   * **Default off, and it costs the merchant their navigation.** Gutenberg
   * shipped fullscreen on by default and *"where did the WordPress menu go"*
   * became the most searched-for thing about the block editor.
   */
  it('starts folded, and hides wp-admins chrome only when asked', async () => {
    render(<OptinBuilder id={ID} onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole('tab', { name: 'Edit' }));

    const toggle = await screen.findByRole('button', { name: 'Full width' });

    expect(document.body).not.toHaveClass('wconvert-fullscreen');

    await userEvent.click(toggle);

    expect(document.body).toHaveClass('wconvert-fullscreen');
    expect(screen.getByRole('button', { name: 'Show the menu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  /** A mode with no keyboard way out is a trap. */
  it('leaves on Escape', async () => {
    render(<OptinBuilder id={ID} onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole('tab', { name: 'Edit' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Full width' }));
    await userEvent.keyboard('{Escape}');

    expect(document.body).not.toHaveClass('wconvert-fullscreen');
  });

  /**
   * **`localStorage` rather than an endpoint**, because it is a per-browser
   * convenience about how one screen is arranged rather than a fact about the
   * site.
   */
  it('remembers the choice across a visit', async () => {
    render(<OptinBuilder id={ID} onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole('tab', { name: 'Edit' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Full width' }));

    expect(window.localStorage.getItem('wconvert:fullscreen')).toBe('on');
  });

  /**
   * **The class is the BODY's and outlives this screen.** Leaving the builder
   * with it set would hide the admin menu on the Optins list, which has no
   * toggle on it at all.
   */
  it('puts the chrome back when the builder unmounts', async () => {
    const { unmount } = render(<OptinBuilder id={ID} onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole('tab', { name: 'Edit' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Full width' }));

    unmount();

    expect(document.body).not.toHaveClass('wconvert-fullscreen');
  });
});
