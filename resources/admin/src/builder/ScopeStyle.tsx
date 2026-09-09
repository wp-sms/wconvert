import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { ClipboardCopy, ClipboardPaste } from 'lucide-react';
import { AA_NORMAL, PAIR_READERS, READABLE_PAIRS, contrastOf, pairKey } from './contrast';
import { nodesOf } from './structure/tree';
import { TokenField, groupName } from './Tokens';
import {
  TOKENS,
  groupsOf,
  scopeChainOf,
  sourceOfToken,
  withScopeBag,
  withScopeToken,
  type Path,
  type Scope,
  type TokenSource,
  type WidthBag,
} from './panel';
import { A_NARROW_DESIGN } from '@renderer/css';
import { REFERABLE } from '@renderer/render';
import { isColour } from './themes';
import { Description } from '../shell/Description';
import { nameOf, type TemplateLabels } from '../templates/api';
import type { Template, Tokens } from '@renderer/types';

/**
 * The look of ONE BOX — the same token controls the design panel draws, bound
 * to the selected block's own bag.
 *
 * ============================================================================
 * THE ONE GENUINELY NEW COMPONENT, AND IT ADDS NO CONTROL.
 * ============================================================================
 * Every control here is {@see TokenField}, unchanged, drawing the same token
 * the Design panel drew. What is new is the three things a scope makes
 * necessary and a global token set never did:
 *
 * 1. **What it resolves to.** A leaf inside a cream box is drawn with the cream
 *    box's `bg`, not the design's — custom properties inherit, so the value a
 *    visitor sees is the nearest bag above the block that names the token
 *    (ADR 0062). A panel showing the design's value here would be a control
 *    naming a colour nobody sees.
 * 2. **Where that came from.** *Set here*, *from the design*, or from a named
 *    box further out. The middle one is the case a merchant cannot see, and it
 *    is the one that explains why changing the design's background did nothing.
 * 3. **What clearing means.** At the design it means *back to the design's
 *    own*; here it means *back to whatever this box sits inside*, which may be
 *    two boxes out. Same control, different sentence, so the sentence is a
 *    prop.
 *
 * ============================================================================
 * ONLY A LAYOUT HAS ONE, AND SAYING SO IS THE PANEL'S JOB.
 * ============================================================================
 * A bag applies to a box and everything INSIDE it, so a leaf has nothing to
 * apply to and the vocabulary drops `tokens` on one. A merchant who selects a
 * headline and finds an empty Style tab learns nothing; one who is told the
 * headline takes its colours from the box it is in, and handed the way to
 * select that box, has been answered (ADR 0042 rule 4 — never stop one click
 * short).
 */
export function ScopeStyle({
  template,
  labels,
  path,
  openToken,
  onOpenToken,
  onSelect,
  onChange,
  copied,
  onCopy,
  width,
}: {
  template: Template;
  labels: TemplateLabels;
  /** The selected block, or null where nothing is selected. */
  path: Path | null;
  openToken: string | null;
  onOpenToken: (token: string | null) => void;
  /** Select another block — how the leaf case hands over the box that decides. */
  onSelect: (path: Path) => void;
  onChange: (template: Template) => void;
  /**
   * A bag the merchant has copied off another box, or null.
   *
   * ==========================================================================
   * THE STATE IS THE SCREEN'S, BECAUSE THE ACT SPANS TWO SELECTIONS.
   * ==========================================================================
   * Copy on one box and paste on another: this component is rebuilt between
   * those two presses, so it cannot be the thing holding it. It is not the
   * system clipboard either — a token bag is not text a merchant would paste
   * anywhere else, and reading the real clipboard means a permission prompt for
   * an act that never leaves this screen.
   */
  copied: Tokens | null;
  onCopy: (tokens: Tokens | null) => void;
  /**
   * Which of the box's two bags these controls edit.
   *
   * The preview's own width switch decides it, which is what makes the mode
   * legible rather than modal: the merchant is looking at the narrow render
   * while they set the narrow values (ADR 0064).
   */
  width: WidthBag;
}) {
  const chain = path === null ? [] : scopeChainOf(template.tree, path);
  const here = chain.length > 0 && path !== null && chain[chain.length - 1]?.path.length === path.length
    ? chain[chain.length - 1]
    : undefined;

  if (path === null || here === undefined) {
    return <NoScope chain={chain} labels={labels} onSelect={onSelect} />;
  }

  const write = (name: string) => (value: string) =>
    onChange({ ...template, tree: withScopeToken(template.tree, here.path, name, value, width) });

  const source = (name: string): TokenSource =>
    sourceOfToken(chain, template.tokens, name, width);

  return (
    <div className="wconvert-scope">
      <Description>
        {sprintf(
          /* translators: %s: what the selected block is called, e.g. “Coloured box”. */
          __(
            'What you set here applies to %s and to everything inside it. Anything you leave alone is inherited.',
            'wconvert',
          ),
          nameOf(labels.layouts, here.type),
        )}
      </Description>

      {/*
        ==================================================================
        THE MODE IS SAID OUT LOUD, BECAUSE IT IS THE SAME TWENTY-FOUR
        CONTROLS.
        ==================================================================
        The controls below are identical at both widths and write to different
        places, which is exactly the state a screen has to name — a merchant
        who set a colour at narrow and cannot find it at full width has met a
        mode they were not told about (ADR 0042 rule 2). It also says what it
        COSTS, because this is the one bag that doubles what a design stores.
      */}
      {width === 'narrow' && (
        <p className="wconvert-scope__narrow">
          {sprintf(
            /* translators: %s: a CSS width, e.g. “24rem”. */
            __(
              'You are setting the narrow look — what a visitor sees below %s. Everything you leave alone keeps its full-width value, and every value you set here is stored twice.',
              'wconvert',
            ),
            A_NARROW_DESIGN,
          )}
        </p>
      )}

      {/*
        **Copy a look, and paste it onto the next box.** Three boxes tinted the
        same way is the ordinary case in a reference-class design — a cream
        panel above a cream panel — and the alternative is setting six tokens
        three times and getting one of the eighteen wrong.

        **Paste REPLACES rather than merges.** A merge would leave whatever the
        target already set and produce a box that is neither what was copied nor
        what was there, which is a state nothing on screen could explain; undo
        is what pays for the bluntness, the same bargain block delete makes.
      */}
      <div className="wconvert-scope__clipboard">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={Object.keys(bagOf(here, width)).length === 0}
          onClick={() => onCopy(bagOf(here, width))}
        >
          <ClipboardCopy aria-hidden="true" />
          {__('Copy this look', 'wconvert')}
        </Button>

        {copied !== null && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() =>
              onChange({
                ...template,
                tree: withScopeBag(template.tree, here.path, copied, width),
              })
            }
          >
            <ClipboardPaste aria-hidden="true" />
            {sprintf(
              /* translators: %d: how many settings were copied off another block. */
              __('Paste %d setting(s)', 'wconvert'),
              Object.keys(copied).length,
            )}
          </Button>
        )}
      </div>

      <ScopeContrast chain={chain} template={template} labels={labels} width={width} />

      {groupsOf(TOKENS).map((group) => (
        <section key={group.id} className="wconvert-group" aria-label={groupName(group.id)}>
          <h5 className="wconvert-group__name">{groupName(group.id)}</h5>

          {/*
            ==============================================================
            THE COLOURS ARE A GRID HERE FOR THE REASON THEY ARE ONE ON THE
            DESIGN PANEL: THEY ARE COMPARED RATHER THAN READ DOWN.
            ==============================================================
            This panel drew all twenty-four one per row, so a photo pane's
            Style tab was ~1,600px of column — measured in a browser — while
            the design's own panel, with the same twenty-four, fitted in
            two-thirds of that. Seven full-width rows for a seven-character
            value is a column of settings, which is the right shape for seven
            different questions and the wrong one for seven answers to one.
            `index.css` says exactly this about `.wconvert-palette`, and this is
            that rule applied at the second scope rather than a second rule.

            **The source note goes with each cell** rather than under the grid,
            because *from Coloured box* is about one token and a line under
            seven of them would be about none of them.
          */}
          <div className={group.id === 'colour' ? 'wconvert-palette' : undefined}>
          {group.tokens.map((token) => {
            const from = source(token.name);
            const label = nameOf(labels.tokens, token.name);

            return (
              <div key={token.name} className="wconvert-scope__token">
                <TokenField
                  token={token.name}
                  label={label}
                  labels={labels}
                  /*
                    **What it resolves to HERE**, which is the inherited value
                    and not the design's. `sourceOfToken` walks the chain from
                    the inside out, so this is the same answer the browser
                    reaches by inheriting the property.
                  */
                  fallback={
                    from.from === 'here' || from.from === 'narrow'
                      ? inherited(chain, template, token.name, width)
                      : from.value
                  }
                  standard={token.fallback}
                  /*
                    Empty, and that is what makes the reset mean *clear*.
                    {@see Reset} draws itself while the stored value differs
                    from this and writes this on press — so at a scope it writes
                    `''`, which {@see withScopeToken} turns into an absent key
                    and therefore into inheritance.
                  */
                  design=""
                  value={bagOf(here, width)[token.name] ?? ''}
                  open={openToken === token.name}
                  onOpenChange={(open) => onOpenToken(open ? token.name : null)}
                  onChange={write(token.name)}
                  resetSaid={sprintf(
                    /* translators: %s: what the setting is for, e.g. “Background”. */
                    __('Let %s be inherited again', 'wconvert'),
                    label,
                  )}
                />
                <SourceNote
                  from={from}
                  token={token.name}
                  labels={labels}
                  onSelect={onSelect}
                  onRefer={() => write(token.name)(follows(token.name) ?? '')}
                />
              </div>
            );
          })}
          </div>
        </section>
      ))}

    </div>
  );
}

/** Which of a box's two bags a width is looking at. */
const bagOf = (scope: Scope, width: WidthBag): Tokens =>
  width === 'narrow' ? scope.narrow : scope.tokens;

/** What this token resolves to with this box's own value taken out of the way. */
function inherited(
  chain: readonly Scope[],
  template: Template,
  name: string,
  width: WidthBag,
): string {
  return sourceOfToken(chain.slice(0, -1), template.tokens, name, width).value;
}

/**
 * Which colour token a name would follow, or null where it names none.
 *
 * ============================================================================
 * A VALUE THAT NAMES A TOKEN IS HOW A SCOPE SURVIVES A THEME (ADR 0063).
 * ============================================================================
 * The obvious mapping is the identity — `bg` follows `bg` — and it is the one
 * thing that cannot be written: `--wc-bg: var(--wc-bg)` is a cycle CSS
 * discards, and the renderer writes such a value verbatim for exactly that
 * reason. So a token follows the one a palette would pair it with, which is
 * also what a merchant means by the press: *make this box the accent colour.*
 */
function follows(name: string): string | null {
  const pairs: Readonly<Record<string, string>> = {
    bg: 'accent',
    fg: 'accent-fg',
    'input-bg': 'bg',
    'accent-fg': 'bg',
    accent: 'fg',
    border: 'muted',
    muted: 'fg',
  };

  return pairs[name] ?? null;
}

/**
 * Where a value came from, said only where a merchant could not have known.
 *
 * **Three of the four sources say nothing here, and that is deliberate.** *Set
 * here* is already on screen — the reset control appears exactly when a token is
 * set on this box — and *from the design* and *the default* are what a merchant
 * assumes. The one surprising answer is **another box**, which is invisible in
 * the panel and is the whole reason a colour they changed on the Design tab did
 * nothing. So that is the one that speaks, and it speaks with the way to reach
 * that box (ADR 0042 rules 2 and 4).
 */
function SourceNote({
  from,
  token,
  labels,
  onSelect,
  onRefer,
}: {
  from: TokenSource;
  token: string;
  labels: TemplateLabels;
  onSelect: (path: Path) => void;
  /** Replace a literal colour with the name of the token it should follow. */
  onRefer: () => void;
}) {
  const scope = from.scope;

  /*
    **A value that names a token follows the theme; a hex does not** (ADR 0063).
    Offered only where it would change something: the value is a literal colour
    the merchant set on THIS box, and the token has one it can sensibly follow.
    A press on `→ accent` where the value already reads `accent` would be a
    control that does nothing, which is the one thing ADR 0054 rule 3 forbids.
  */
  const literal =
    (from.from === 'here' || from.from === 'narrow')
    && isColour(from.value)
    && !REFERABLE.includes(from.value)
    && REFERABLE.includes(token)
    && follows(token) !== null;

  if (from.from === 'design' || from.from === 'default') {
    return null;
  }

  return (
    <p className="wconvert-scope__from">
      {from.from === 'scope' && scope !== undefined ? (
        <button type="button" className="wconvert-linkish" onClick={() => onSelect(scope.path)}>
          {sprintf(
            /* translators: %s: what the enclosing block is called, e.g. “Coloured box”. */
            __('From %s', 'wconvert'),
            nameOf(labels.layouts, scope.type),
          )}
        </button>
      ) : (
        /*
          **Two sentences that a reset button alone could not tell apart.** The
          reset appears whenever a value is set on this box, at either width —
          so *set here* and *set for narrow only* looked identical, and a
          merchant editing at narrow could not see which of the two they were
          looking at.
        */
        <span data-set={from.from}>
          {from.from === 'narrow'
            ? __('Set for narrow only', 'wconvert')
            : __('Set on this box', 'wconvert')}
        </span>
      )}

      {literal && (
        <button
          type="button"
          className="wconvert-linkish"
          onClick={onRefer}
          title={__(
            'Follow the palette instead of this exact colour, so a ready-made look moves it.',
            'wconvert',
          )}
        >
          {sprintf(
            /* translators: %s: a colour setting's name, e.g. “Highlight”. */
            __('→ %s', 'wconvert'),
            nameOf(labels.tokens, follows(token) ?? ''),
          )}
        </button>
      )}
    </p>
  );
}

/**
 * The selected block has no bag, and the answer is which box decides for it.
 *
 * The nearest box in the chain is the one whose Style tab would change this
 * block, so it is offered as a press rather than described — a sentence saying
 * *"select the box it is in"* leaves the merchant to find it in a tree they
 * have to read backwards.
 */
function NoScope({
  chain,
  labels,
  onSelect,
}: {
  chain: readonly Scope[];
  labels: TemplateLabels;
  onSelect: (path: Path) => void;
}) {
  const box = chain[chain.length - 1];

  if (box === undefined) {
    return <Description>{__('Select a block to change how it looks.', 'wconvert')}</Description>;
  }

  /*
    **A step root is "the design" and is not called by its layout's name.**
    Selecting it opens the design's own tokens — the outermost scope, which is
    what the Design tab always edited — so calling it *Column* here would send a
    merchant looking for the design's colours to something named after a flex
    direction. It is also the commonest case by a distance: most leaves sit
    directly in their step.
  */
  const design = box.path.length === 1;

  return (
    <Description>
      {design
        ? __('This block takes its look from the design.', 'wconvert')
        : sprintf(
            /* translators: %s: what the enclosing block is called, e.g. “Coloured box”. */
            __('This block takes its look from %s.', 'wconvert'),
            nameOf(labels.layouts, box.type),
          )}{' '}
      <button type="button" className="wconvert-linkish" onClick={() => onSelect(box.path)}>
        {design ? __('Open the design’s look', 'wconvert') : __('Open that box', 'wconvert')}
      </button>
    </Description>
  );
}

/**
 * The pairs a visitor has to be able to read, measured AT THIS SCOPE.
 *
 * ============================================================================
 * SARAH'S SAFETY NET, AND IT HAS TO BE HERE RATHER THAN ONLY ON THE DESIGN.
 * ============================================================================
 * The Design panel's readout measures the design's own tokens, which is the
 * right answer for the design and the wrong one for a box that repaints its
 * ground: white text on a navy design is legible, and the same white text in a
 * cream box the merchant just made is not. A scope is the first thing in this
 * product that can fail AA for somebody else in one click WITHOUT the design
 * panel's numbers moving at all.
 *
 * Silent while everything passes, for the reason the design panel's readout is:
 * a passing ratio is a fact nobody acts on, and three of them printed
 * permanently is a line a merchant reads once and reads past forever.
 */
function ScopeContrast({
  chain,
  template,
  labels,
  width,
}: {
  chain: readonly Scope[];
  template: Template;
  labels: TemplateLabels;
  width: WidthBag;
}) {
  const value = (name: string) => sourceOfToken(chain, template.tokens, name, width).value;

  /*
    **What this box actually holds**, which is what decides which pairs are
    worth measuring on it: a photo pane holding two headings has no fine print
    and no field, so `muted` and `input-bg` there are colours nothing in the
    box draws ({@see PAIR_READERS}).

    The subtree is found by prefix rather than walked again — `nodesOf` is the
    one walk this editor has, and every block under this box has this box's
    path as its own prefix by construction.
  */
  const here = chain[chain.length - 1]?.path ?? [];
  const inside = nodesOf(template.tree)
    .filter((block) => block.path.length >= here.length && here.every((step, at) => block.path[at] === step))
    .map((block) => block.type);

  const wrong = READABLE_PAIRS.flatMap(([fg, bg]) => {
    const readers = PAIR_READERS[pairKey(fg, bg)] ?? [];

    if (readers.length > 0 && !readers.some((type) => inside.includes(type))) {
      return [];
    }

    const ratio = contrastOf(value(fg), value(bg));

    return ratio === null || ratio >= AA_NORMAL ? [] : [{ fg, bg, ratio }];
  });

  if (wrong.length === 0) {
    return null;
  }

  return (
    <ul className="wconvert-scope__contrast" aria-label={__('Readability in this box', 'wconvert')}>
      {wrong.map(({ fg, bg, ratio }) => (
        <li key={`${fg}/${bg}`}>
          {sprintf(
            /* translators: 1: the text colour's name, e.g. “Text”. 2: the surface's, e.g. “Background”. 3: the contrast ratio, e.g. “1.4”. */
            __('%1$s on %2$s is %3$s to 1 in this box — too close to read.', 'wconvert'),
            nameOf(labels.tokens, fg),
            nameOf(labels.tokens, bg),
            ratio.toFixed(1),
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * What is actually STORED for this box, as the design carries it.
 *
 * ============================================================================
 * IT IS THE CARD'S BOTTOM BAND AND NOT THE PANEL'S LAST ITEM (ADR 0066).
 * ============================================================================
 * It was the twenty-fifth thing in this panel, under twenty-four controls about
 * the box's parts, reachable on a 22rem column only by scrolling past all of
 * them. A readout about the WHOLE box does not belong at the end of the list of
 * its parts, and the editor's card has a foot for exactly this: it spans the
 * three panes, so a bag of twenty-four tokens is read across the measure rather
 * than down a gutter. {@see StructureView} draws it and computes the scope with
 * `scopeChainOf`; this exports the readout because everything it knows about a
 * bag is here.
 *
 * ============================================================================
 * THE ONE PLACE A SCOPE IS LEGIBLE AS DATA, AND IT IS NOT A DEBUG PANEL.
 * ============================================================================
 * Every control above answers *what does this token resolve to here*, which is
 * the question a merchant has. The question an AUTHOR has is the other one:
 * what did I set, and what am I paying for it — because a scope is repeatable,
 * it nests, and twenty-four controls showing inherited values look exactly like
 * twenty-four controls showing set ones until you read the reset buttons.
 *
 * So this prints the keys and nothing else: the params the box declares and its
 * two bags. Not the children — a box's own record is what it is about, and a
 * subtree would be the whole design again at every level.
 *
 * **It is on for everybody rather than behind `dev`**, unlike
 * {@see DevExport}. That one hands over the whole tree and takes one back,
 * which is an editing surface; this is a readout of one node, and the merchant
 * it is for is the one who set nine tokens on a box and wants to know which
 * nine. `<details>`, closed, so it costs a line until it is asked for.
 */
export function ScopeJson({
  scope,
  name,
  width,
}: {
  scope: Scope;
  /**
   * What the box is called, because the band is not under its panel any more.
   *
   * *"What is stored here"* was honest at the foot of one box's controls and is
   * not at the foot of a card holding three panes — *here* would be the card.
   */
  name: string;
  width: WidthBag;
}) {
  const stored = {
    ...(Object.keys(scope.tokens).length === 0 ? {} : { tokens: scope.tokens }),
    ...(Object.keys(scope.narrow).length === 0 ? {} : { narrow: scope.narrow }),
  };
  const count = Object.keys(width === 'narrow' ? scope.narrow : scope.tokens).length;

  return (
    <details className="wconvert-scope__json">
      <summary>
        {sprintf(
          /* translators: 1: what the box is called, e.g. “Coloured box”. 2: how many settings it carries at the width being edited. */
          __('What is stored on %1$s (%2$d)', 'wconvert'),
          name,
          count,
        )}
      </summary>
      <pre>{JSON.stringify(stored, null, 2)}</pre>
    </details>
  );
}
