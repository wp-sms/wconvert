import { __, _n, sprintf } from '@wordpress/i18n';
import { Disclosure } from '../shell/Disclosure';
import { Button } from '../components/ui/button';
import { ClipboardCopy, ClipboardPaste, RotateCcw } from 'lucide-react';
import { PAIR_READERS, READABLE_PAIRS, pairKey, readability, readableFix } from './contrast';
import { useAdvanced } from './advanced';
import { nodesOf } from './structure/tree';
import { TokenField, groupName } from './Tokens';
import {
  scopeChainOf,
  sourceOfToken,
  withScopeBag,
  withScopeToken,
  type Path,
  type Scope,
  type TokenSource,
  type WidthBag,
} from './panel';
import { styleGroups, inheritedStyle } from './styleTokens';
import { LEAVES } from './panel';
import { REFERABLE } from '@renderer/render';
import { isColor } from './themes';
import { Description } from '../shell/Description';
import { nameOf, type TemplateLabels } from '../templates/api';
import type { Template, Tokens } from '@renderer/types';

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

  path: Path | null;
  openToken: string | null;
  onOpenToken: (token: string | null) => void;

  onSelect: (path: Path) => void;
  /** `coalesce` names the element, width and token a drag or slider belongs to, so it is one Undo step. */
  onChange: (template: Template, coalesce?: string) => void;

  copied: Tokens | null;
  onCopy: (tokens: Tokens | null) => void;

  width: WidthBag;
}) {
  const advanced = useAdvanced();
  const chain = path === null ? [] : scopeChainOf(template.tree, path);
  const here =
    chain.length > 0 && path !== null && chain[chain.length - 1]?.path.length === path.length
      ? chain[chain.length - 1]
      : undefined;

  if (path === null || here === undefined) {
    return <NoScope chain={chain} labels={labels} onSelect={onSelect} />;
  }

  const write = (name: string, coalesce?: string) => (value: string) =>
    onChange({ ...template, tree: withScopeToken(template.tree, here.path, name, value, width) }, coalesce);

  const mobileOverrides = Object.keys(here.narrow);
  const source = (name: string): TokenSource => sourceOfToken(chain, template.tokens, name, width);
  const own = bagOf(here, width);

  return (
    <div className="wconvert-scope">
      <Disclosure variant="inline" className="wconvert-style-context"
        title={width === 'narrow' ? __('Editing mobile appearance. Unchanged values follow desktop.', 'wconvert') : __('Editing desktop', 'wconvert')}
        summary={mobileOverrides.length > 0 ? sprintf(_n('%d mobile setting', '%d mobile settings', mobileOverrides.length, 'wconvert'), mobileOverrides.length) : undefined}>
        <Description>
          {sprintf(
            __('Appearance for %s. Unchanged values follow the surrounding design.', 'wconvert'),
            nameOf(LEAVES[here.type] ? labels.nodes : labels.layouts, here.type),
          )}
        </Description>
        <p className="m-0 mt-1">{mobileOverrides.length === 0
          ? __('No mobile overrides on this element. It follows the surrounding design.', 'wconvert')
          : sprintf(__('Mobile settings: %s', 'wconvert'), mobileOverrides.map(token => nameOf(labels.tokens, token)).join(', '))}</p>
      </Disclosure>

      <ScopeContrast chain={chain} template={template} labels={labels} width={width} onFix={(name, value) => write(name)(value)} />

      {styleGroups(template, path, width).map((group) => ({ ...group, tokens: group.tokens.filter((token) => advanced || !ADVANCED_ONLY.includes(token.name)) })).filter((group) => group.tokens.length > 0).map((group) => (
          <section key={group.id} className="wconvert-group" aria-label={groupName(group.id)}>
            <h5 className="wconvert-group__name">{groupName(group.id)}</h5>

            <div className={group.id === 'color' ? 'wconvert-palette' : 'wconvert-fields'}>
              {group.tokens.map((token) => {
                const from = source(token.name);
                const label = nameOf(labels.tokens, token.name);

                return (
                  <div key={token.name} className="wconvert-scope__token wconvert-fields__item" data-compact={['gap', 'radius'].includes(token.name) || undefined}>
                    <TokenField
                      simple={!advanced}
                      token={token.name}
                      label={label}
                      labels={labels}
                      fallback={
                        from.from === 'here' || from.from === 'narrow'
                          ? inheritedStyle(chain, template, token.name, width)
                          : from.value
                      }
                      standard={token.fallback}
                      design=""
                      value={own[token.name] ?? ''}
                      open={openToken === token.name}
                      onOpenChange={(open) => onOpenToken(open ? token.name : null)}
                      onChange={write(token.name, styleCoalesce(here.path, width, token.name))}
                      resetSaid={sprintf(__('Let %s be inherited again', 'wconvert'), label)}
                    />
                    {width === 'tokens' && Object.hasOwn(here.narrow, token.name) && sourceOfToken(chain, template.tokens, token.name, 'narrow').value !== from.value && <p className="m-0 text-note text-action">{__('Different on mobile', 'wconvert')}</p>}
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
      {/* Everything this element sets for the device being edited goes, so it follows the design again. */}
      <Button type="button" variant="ghost" size="xs" className="wconvert-scope__reset" disabled={Object.keys(own).length === 0}
        onClick={() => onChange({ ...template, tree: withScopeBag(template.tree, here.path, {}, width) })}>
        <RotateCcw aria-hidden="true" />
        {width === 'narrow' ? __('Reset this element on mobile', 'wconvert') : __('Reset this element', 'wconvert')}
      </Button>
      <Disclosure variant="inline" className="wconvert-style-advanced" title={__('Copy or paste styles', 'wconvert')}>
        <div className="wconvert-scope__clipboard">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={Object.keys(own).length === 0}
            onClick={() => onCopy(own)}
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
              {sprintf(_n('Paste %d setting', 'Paste %d settings', Object.keys(copied).length, 'wconvert'), Object.keys(copied).length)}
            </Button>
          )}
        </div>
      </Disclosure>
    </div>
  );
}

/** The history key for one element's own value of one token, at one width. */
export const styleCoalesce = (path: Path, width: WidthBag, name: string) => `style:${path.join('.')}:${width}:${name}`;

/** Exact type sizes: the element's own Size choice is the plain control (ADR 0135). */
const ADVANCED_ONLY = ['heading-size', 'text-size'];

const bagOf = (scope: Scope, width: WidthBag): Tokens => (width === 'narrow' ? scope.narrow : scope.tokens);

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

  onRefer: () => void;
}) {
  const scope = from.scope;

  const literal =
    (from.from === 'here' || from.from === 'narrow') &&
    isColor(from.value) &&
    !REFERABLE.includes(from.value) &&
    REFERABLE.includes(token) &&
    follows(token) !== null;

  if (from.from === 'design' || from.from === 'default' || (from.from === 'here' && !literal)) {
    return null;
  }

  return (
    <p className="wconvert-scope__from">
      {from.from === 'scope' && scope !== undefined ? (
        <button type="button" className="wconvert-linkish" onClick={() => onSelect(scope.path)}>
          {sprintf(__('From %s', 'wconvert'), nameOf(labels.layouts, scope.type))}
        </button>
      ) : from.from === 'narrow' ? (
        <span data-set={from.from}>{__('Mobile override', 'wconvert')}</span>
      ) : null}

      {literal && (
        <button
          type="button"
          className="wconvert-linkish"
          onClick={onRefer}
          title={__(
            'Follow the palette instead of this exact color, so a ready-made look moves it.',
            'wconvert',
          )}
        >
          {sprintf(__('→ %s', 'wconvert'), nameOf(labels.tokens, follows(token) ?? ''))}
        </button>
      )}
    </p>
  );
}

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

  const design = box.path.length === 1;

  return (
    <Description>
      {design
        ? __('This block takes its look from the design.', 'wconvert')
        : sprintf(
            __('This block takes its look from %s.', 'wconvert'),
            nameOf(labels.layouts, box.type),
          )}{' '}
      <button type="button" className="wconvert-linkish" onClick={() => onSelect(box.path)}>
        {design ? __('Open the design’s look', 'wconvert') : __('Open that box', 'wconvert')}
      </button>
    </Description>
  );
}

function ScopeContrast({
  chain,
  template,
  labels,
  width,
  onFix,
}: {
  chain: readonly Scope[];
  template: Template;
  labels: TemplateLabels;
  width: WidthBag;
  /** Writes this element's own value of a token: Fix stays inside the element. */
  onFix: (token: string, value: string) => void;
}) {
  const advanced = useAdvanced();
  const value = (name: string) => sourceOfToken(chain, template.tokens, name, width).value;

  const here = chain[chain.length - 1]?.path ?? [];
  const inside = nodesOf(template.tree)
    .filter((block) => block.path.length >= here.length && here.every((step, at) => block.path[at] === step))
    .map((block) => block.type);

  const wrong = READABLE_PAIRS.flatMap(([fg, bg]) => {
    const readers = PAIR_READERS[pairKey(fg, bg)] ?? [];

    if (readers.length > 0 && !readers.some((type) => inside.includes(type))) {
      return [];
    }

    const verdict = readability(value(fg), value(bg));

    return verdict.readable === false ? [{ fg, bg, verdict }] : [];
  });

  if (wrong.length === 0) {
    return null;
  }

  return (
    <ul className="wconvert-scope__contrast" aria-label={__('Readability in this box', 'wconvert')}>
      {wrong.map(({ fg, bg, verdict }) => {
        /* translators: 1: the text color's name, e.g. “Lighter text”. 2: the surface's, e.g. “Background”. */
        const named = sprintf(__('%1$s on %2$s', 'wconvert'), nameOf(labels.tokens, fg), nameOf(labels.tokens, bg));

        return (
          <li key={`${fg}/${bg}`}>
            <span><strong>{named}</strong> {advanced && verdict.ratio !== null
              ? sprintf(/* translators: 1: a readability verdict. 2: its contrast ratio, e.g. “4.4”. */ __('%1$s (%2$s:1)', 'wconvert'), verdict.said, verdict.ratio)
              : verdict.said}</span>
            <Button type="button" variant="outline" size="xs" aria-label={sprintf(__('Fix %s', 'wconvert'), named)}
              onClick={() => onFix(fg, readableFix(value, bg))}>
              {__('Fix', 'wconvert')}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
