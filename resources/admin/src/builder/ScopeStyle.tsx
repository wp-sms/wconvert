import { __, sprintf } from '@wordpress/i18n';
import { AA_NORMAL, READABLE_PAIRS, contrastOf } from './contrast';
import { TokenField, groupName } from './Tokens';
import {
  TOKENS,
  groupsOf,
  scopeChainOf,
  sourceOfToken,
  withScopeToken,
  type Path,
  type Scope,
  type TokenSource,
} from './panel';
import { Description } from '../shell/Description';
import { nameOf, type TemplateLabels } from '../templates/api';
import type { Template } from '@renderer/types';

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
}) {
  const chain = path === null ? [] : scopeChainOf(template.tree, path);
  const here = chain.length > 0 && path !== null && chain[chain.length - 1]?.path.length === path.length
    ? chain[chain.length - 1]
    : undefined;

  if (path === null || here === undefined) {
    return <NoScope chain={chain} labels={labels} onSelect={onSelect} />;
  }

  const write = (name: string) => (value: string) =>
    onChange({ ...template, tree: withScopeToken(template.tree, here.path, name, value) });

  const source = (name: string): TokenSource => sourceOfToken(chain, template.tokens, name);

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

      <ScopeContrast chain={chain} template={template} labels={labels} />

      {groupsOf(TOKENS).map((group) => (
        <section key={group.id} className="wconvert-group" aria-label={groupName(group.id)}>
          <h5 className="wconvert-group__name">{groupName(group.id)}</h5>

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
                  fallback={from.from === 'here' ? inherited(chain, template, token.name) : from.value}
                  standard={token.fallback}
                  /*
                    Empty, and that is what makes the reset mean *clear*.
                    {@see Reset} draws itself while the stored value differs
                    from this and writes this on press — so at a scope it writes
                    `''`, which {@see withScopeToken} turns into an absent key
                    and therefore into inheritance.
                  */
                  design=""
                  value={here.tokens[token.name] ?? ''}
                  open={openToken === token.name}
                  onOpenChange={(open) => onOpenToken(open ? token.name : null)}
                  onChange={write(token.name)}
                  resetSaid={sprintf(
                    /* translators: %s: what the setting is for, e.g. “Background”. */
                    __('Let %s be inherited again', 'wconvert'),
                    label,
                  )}
                />
                <SourceNote from={from} labels={labels} onSelect={onSelect} />
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/** What this token resolves to with this box's own value taken out of the way. */
function inherited(chain: readonly Scope[], template: Template, name: string): string {
  return sourceOfToken(chain.slice(0, -1), template.tokens, name).value;
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
  labels,
  onSelect,
}: {
  from: TokenSource;
  labels: TemplateLabels;
  onSelect: (path: Path) => void;
}) {
  if (from.from !== 'scope' || from.scope === undefined) {
    return null;
  }

  const scope = from.scope;

  return (
    <p className="wconvert-scope__from">
      <button type="button" className="wconvert-linkish" onClick={() => onSelect(scope.path)}>
        {sprintf(
          /* translators: %s: what the enclosing block is called, e.g. “Coloured box”. */
          __('From %s', 'wconvert'),
          nameOf(labels.layouts, scope.type),
        )}
      </button>
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
}: {
  chain: readonly Scope[];
  template: Template;
  labels: TemplateLabels;
}) {
  const value = (name: string) => sourceOfToken(chain, template.tokens, name).value;

  const wrong = READABLE_PAIRS.flatMap(([fg, bg]) => {
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
