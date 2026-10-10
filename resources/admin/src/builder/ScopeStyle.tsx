import { __, _n, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { ClipboardCopy, ClipboardPaste, Monitor, RotateCcw, Smartphone, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { PanelHint, PanelSection } from './PanelSection';
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
  onWidth,
  lead,
  footerEnd,
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
  /** Switch the canvas between desktop and mobile: the device row's link. */
  onWidth?: (width: WidthBag) => void;
  /** The element's own looks (Size, Heading level), drawn first under their own labels (ADR 0136). */
  lead?: ReactNode;
  /** Advanced, at the end of the footer row. */
  footerEnd?: ReactNode;
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

  const mobile = width === 'narrow';
  const pasteSaid = copied === null ? __('Paste styles', 'wconvert')
    : sprintf(/* translators: %d: how many style settings were copied. */ _n('Paste %d setting', 'Paste %d settings', Object.keys(copied).length, 'wconvert'), Object.keys(copied).length);
  return (
    <div className="wconvert-scope">
      {/*
        **One line for the device being edited** (ADR 0136): which one, what
        differs on mobile, and the way to the other. It was a disclosure whose
        title was a sentence.
      */}
      <div className="wconvert-style-device" role="status">
        {mobile ? <Smartphone aria-hidden="true" /> : <Monitor aria-hidden="true" />}
        <strong>{mobile ? __('Mobile', 'wconvert') : __('Desktop', 'wconvert')}</strong>
        <span>{mobile
          ? __('Follows desktop unless changed', 'wconvert')
          : mobileOverrides.length > 0
            ? sprintf(/* translators: 1: how many settings differ on mobile. 2: their names, e.g. “Padding, Text size”. */ _n('%1$d mobile change: %2$s', '%1$d mobile changes: %2$s', mobileOverrides.length, 'wconvert'),
              mobileOverrides.length, mobileOverrides.map(token => nameOf(labels.tokens, token)).join(', '))
            : __('No mobile changes', 'wconvert')}</span>
        {onWidth && <button type="button" className="wconvert-panel-link" onClick={() => onWidth(mobile ? 'tokens' : 'narrow')}>{mobile ? __('Edit desktop', 'wconvert') : __('Edit mobile', 'wconvert')}</button>}
      </div>

      <ScopeContrast chain={chain} template={template} labels={labels} width={width} onFix={(name, value) => write(name)(value)} />

      {lead}

      {styleGroups(template, path, width).map((group) => ({ ...group, tokens: group.tokens.filter((token) => advanced || !ADVANCED_ONLY.includes(token.name)) })).filter((group) => group.tokens.length > 0).map((group) => (
          <PanelSection key={group.id} title={groupName(group.id)} className="wconvert-group">
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
                    {width === 'tokens' && Object.hasOwn(here.narrow, token.name) && sourceOfToken(chain, template.tokens, token.name, 'narrow').value !== from.value && <PanelHint className="text-action">{__('Different on mobile', 'wconvert')}</PanelHint>}
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
          </PanelSection>
        ))}
      {/*
        **The footer row** (ADR 0136): Reset, Copy and Paste for this element,
        then Advanced. Copy and paste were a disclosure of their own.
      */}
      <div className="wconvert-panel-foot">
        {/* Everything this element sets for the device being edited goes, so it follows the design again. */}
        <Button type="button" variant="ghost" size="xs" className="wconvert-scope__reset" disabled={Object.keys(own).length === 0}
          onClick={() => onChange({ ...template, tree: withScopeBag(template.tree, here.path, {}, width) })}>
          <RotateCcw aria-hidden="true" />
          {mobile ? __('Reset on mobile', 'wconvert') : __('Reset', 'wconvert')}
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" disabled={Object.keys(own).length === 0}
          aria-label={__('Copy these styles', 'wconvert')} title={__('Copy these styles', 'wconvert')} onClick={() => onCopy(own)}>
          <ClipboardCopy aria-hidden="true" />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" disabled={copied === null}
          aria-label={pasteSaid} title={pasteSaid}
          onClick={() => copied !== null && onChange({ ...template, tree: withScopeBag(template.tree, here.path, copied, width) })}>
          <ClipboardPaste aria-hidden="true" />
        </Button>
        <span className="wconvert-panel-foot__spacer" />
        {footerEnd}
      </div>
    </div>
  );
}

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

        // Verdict and Fix on one line (ADR 0136); the ratio is Advanced's.
        return (
          <li key={`${fg}/${bg}`} className="wconvert-panel-warn">
            <TriangleAlert aria-hidden="true" />
            <span title={verdict.said}>{sprintf(/* translators: %s: a pair, e.g. “Text on Background”. */ __('%s is hard to read', 'wconvert'), named)}{advanced && verdict.ratio !== null ? ` (${sprintf(/* translators: %s: a contrast ratio, e.g. “4.5”. */ __('%s:1', 'wconvert'), verdict.ratio)})` : ''}</span>
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
