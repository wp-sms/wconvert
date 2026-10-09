import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { ClipboardCopy, ClipboardPaste } from 'lucide-react';
import { AA_NORMAL, PAIR_READERS, READABLE_PAIRS, contrastOf, pairKey } from './contrast';
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
  onChange: (template: Template) => void;

  copied: Tokens | null;
  onCopy: (tokens: Tokens | null) => void;

  width: WidthBag;
}) {
  const chain = path === null ? [] : scopeChainOf(template.tree, path);
  const here =
    chain.length > 0 && path !== null && chain[chain.length - 1]?.path.length === path.length
      ? chain[chain.length - 1]
      : undefined;

  if (path === null || here === undefined) {
    return <NoScope chain={chain} labels={labels} onSelect={onSelect} />;
  }

  const write = (name: string) => (value: string) =>
    onChange({ ...template, tree: withScopeToken(template.tree, here.path, name, value, width) });

  const mobileOverrides = Object.keys(here.narrow);
  const source = (name: string): TokenSource => sourceOfToken(chain, template.tokens, name, width);

  return (
    <div className="wconvert-scope">
      <details className="wconvert-style-context">
        <summary>{width === 'narrow' ? __('Editing mobile appearance. Unchanged values follow desktop.', 'wconvert') : __('Editing desktop', 'wconvert')}
          {mobileOverrides.length > 0 && <span> · {sprintf(__('%d mobile setting(s)', 'wconvert'), mobileOverrides.length)}</span>}
        </summary>
        <Description>
          {sprintf(
            __('Appearance for %s. Unchanged values follow the surrounding design.', 'wconvert'),
            nameOf(LEAVES[here.type] ? labels.nodes : labels.layouts, here.type),
          )}
        </Description>
        <p className="m-0 mt-1">{mobileOverrides.length === 0
          ? __('No mobile overrides on this element. It follows the surrounding design.', 'wconvert')
          : sprintf(__('Mobile settings: %s', 'wconvert'), mobileOverrides.map(token => nameOf(labels.tokens, token)).join(', '))}</p>
        {width === 'narrow' && mobileOverrides.length > 0 && <Button type="button" variant="ghost" size="xs" className="mt-1" onClick={() => onChange({ ...template, tree: withScopeBag(template.tree, here.path, {}, 'narrow') })}>{__('Reset this element’s mobile overrides', 'wconvert')}</Button>}
      </details>

      <ScopeContrast chain={chain} template={template} labels={labels} width={width} />

      {styleGroups(template, path, width).map((group) => (
          <section key={group.id} className="wconvert-group" aria-label={groupName(group.id)}>
            <h5 className="wconvert-group__name">{groupName(group.id)}</h5>

            <div className={group.id === 'color' ? 'wconvert-palette' : 'wconvert-fields'}>
              {group.tokens.map((token) => {
                const from = source(token.name);
                const label = nameOf(labels.tokens, token.name);

                return (
                  <div key={token.name} className="wconvert-scope__token wconvert-fields__item" data-compact={['gap', 'radius'].includes(token.name) || undefined}>
                    <TokenField
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
                      value={bagOf(here, width)[token.name] ?? ''}
                      open={openToken === token.name}
                      onOpenChange={(open) => onOpenToken(open ? token.name : null)}
                      onChange={write(token.name)}
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
      <details className="wconvert-style-advanced">
        <summary>{__('Copy or paste styles', 'wconvert')}</summary>
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
              {sprintf(__('Paste %d setting(s)', 'wconvert'), Object.keys(copied).length)}
            </Button>
          )}
        </div>
      </details>
    </div>
  );
}

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
}: {
  chain: readonly Scope[];
  template: Template;
  labels: TemplateLabels;
  width: WidthBag;
}) {
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

export function ScopeJson({
  scope,
  name,
  width,
}: {
  scope: Scope;

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
      <summary>{sprintf(__('What is stored on %1$s (%2$d)', 'wconvert'), name, count)}</summary>
      <pre>{JSON.stringify(stored, null, 2)}</pre>
    </details>
  );
}
