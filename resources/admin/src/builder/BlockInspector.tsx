import { RecommendationSettings } from './RecommendationSettings';
import type { ProductsNode } from '@renderer/types';
import { journeysSupported, commerceSupported } from '../settings';
import { tierProductName, unlessFree } from '../goals/availability';
import { useId, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft, ArrowLeftRight, Check, ChevronRight, Layers, Package, Type } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ParamChoice } from './ParamChoice';
import { BorderPreview, ImageFitPreview, ImageShapePreview, SplitRatioPreview } from './ChoicePreview';
import { SlotFields } from './SlotFields';
import { nameOfBlock } from './BlockRow';
import { LAYOUTS, slotsOf, withHidden, withValue, type Path, type Slot } from './panel';
import { nodeAt, nodesOf, samePath, withSwappedPanes } from './structure/tree';
import { swapLabel, swapNameOf, swapSaid, swapsFor, withSwapped } from './structure/swap';
import type { ConvertingAct } from './structure/catalogue';
import { QuestionSettings } from './JourneySettings';
import { useQuestionPanel } from './ScreenPanel';
import { CaptureOwnership } from './CaptureOwnership';
import { submissionScreen } from './structure/journey';
import { nameOf, type TemplateLabels } from '../templates/api';
import type { Template } from '@renderer/types';

export interface BlockInspectorProps {
  readonly template: Template;
  readonly labels: TemplateLabels;

  readonly path: Path | null;

  readonly act: ConvertingAct;

  readonly onChange: (template: Template, coalesce?: string) => void;

  readonly onSwap: (template: Template, said: string) => void;

  readonly endsAt?: string;

  readonly onSetEndDate?: () => void;
  readonly onPlacement?: () => void;

  readonly look?: ReactNode;
  readonly onSelect?: (path: Path) => void;
  /**
   * Back to the screen this element is on: the header's "← <screen>" (D2).
   * The element panel is the only panel while an element is open, so this is
   * the one way back — never a second "Design" crumb beside it.
   */
  readonly onBack?: () => void;
  readonly onDesign?: () => void;
  readonly onShowLayers?: () => void;
  /** A new repair request opens Content even when the same element was on Style. */
  readonly revealContent?: { readonly path: Path } | null;
}

export function BlockInspector({
  template,
  labels,
  path,
  act,
  onChange,
  onSwap,
  endsAt,
  onSetEndDate,
  onPlacement,
  look,
  onSelect,
  onBack,
  onDesign,
  onShowLayers,
  revealContent,
}: BlockInspectorProps) {
  const heading = useId();
  const questionPanel = useQuestionPanel();

  const [half, setHalf] = useState('content');
  const [lastReveal, setLastReveal] = useState(revealContent);
  if (lastReveal !== revealContent) {
    setLastReveal(revealContent);
    if (revealContent) setHalf('content');
  }
  const block =
    path === null ? null : (nodesOf(template.tree).find((each) => samePath(each.path, path)) ?? null);
  const slot =
    path === null ? null : (slotsOf(template.tree).find((each) => samePath(each.path, path)) ?? null);
  const styleSettings = slot?.settings.filter((setting) => STYLE_PARAMS.includes(setting.param) && (slot.type !== 'image' || (typeof slot.values.src === 'string' && slot.values.src.trim() !== ''))) ?? [];

  if (block === null || path === null) {
    return (
      <div className="wconvert-inspector">
        <div className="wconvert-inspector__heading">
          <h4>{__('Design', 'wconvert')}</h4>
          <p>{__('Colors, typography and layout', 'wconvert')}</p>
        </div>
        <div className="wconvert-inspector__body">{look}</div>
      </div>
    );
  }

  const name = nameOfBlock(block, labels);
  // A question's panel is the journey editor's: it owns the dialogs a
  // follow-up or a new path opens (ADR 0134).
  const body = block.type === 'question' && questionPanel !== null ? questionPanel(Number(path[0])) : contentBody({
    template,
    labels,
    path,
    block,
    slot,
    onChange,
    endsAt,
    onSetEndDate,
    onPlacement,
  });

  // Only the layout boxes between the screen and this element: the screen
  // itself is the back button, and a crumb for it would be a second way to
  // say the same thing (D2).
  const boxes = nodesOf(template.tree).filter(
    (parent) => parent.path.length > 1 && parent.path.length < path.length && parent.path.every((part, index) => path[index] === part),
  );
  const screenName = template.tree.steps[Number(path[0])]?.name ?? '';
  // Back to the screen where there is one to go back to; the Design tab's
  // inspector goes back to the whole design, and says so.
  const back = onBack ?? onDesign;
  const backTo = onBack !== undefined ? screenName || __('Screen', 'wconvert') : __('Design', 'wconvert');
  const head = (
    <div className="wconvert-inspector__head">
      {back !== undefined && (
        <button type="button" className="wconvert-inspector__back" onClick={back}>
          <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
          <span>{backTo}</span>
        </button>
      )}
      {boxes.length > 0 && (
        <nav className="wconvert-inspector__breadcrumbs" aria-label={__('Inside', 'wconvert')}>
          {boxes.map((parent, at) => (
            <span key={parent.path.join('.')}>
              {at > 0 && <ChevronRight aria-hidden="true" className="rtl:-scale-x-100" />}
              <button type="button" onClick={() => onSelect?.(parent.path)}>
                {nameOfBlock(parent, labels)}
              </button>
            </span>
          ))}
        </nav>
      )}
      <div className="wconvert-inspector__heading">
        <span className="wconvert-element-icon">
          {block.type === 'products' ? <Package aria-hidden="true" /> : block.leaf ? <Type aria-hidden="true" /> : <Layers aria-hidden="true" />}
        </span>
        <div>
          <h4 id={heading} className="wconvert-inspector__name">
            {name}
          </h4>
        </div>
        <SwapMenu template={template} labels={labels} path={path} act={act} onSwap={onSwap} />
      </div>
      {look !== undefined && slot !== null && (
        <TabsList
          className="wconvert-inspector__halves"
          aria-label={sprintf(__('%s settings', 'wconvert'), name)}
        >
          <TabsTrigger value="content">{__('Content', 'wconvert')}</TabsTrigger>
          <TabsTrigger value="style">{__('Style', 'wconvert')}</TabsTrigger>
        </TabsList>
      )}
    </div>
  );

  if (look === undefined || slot === null) {
    return (
      <div role="group" aria-labelledby={heading} className="wconvert-inspector">
        {head}
        <div className="wconvert-inspector__body">
          {body}
          {look}
        </div>
      </div>
    );
  }

  return (
    <Tabs
      value={half}
      onValueChange={setHalf}
      role="group"
      aria-labelledby={heading}
      className="wconvert-inspector"
    >
      {head}
      <div className="wconvert-inspector__body">
        <TabsContent value="content">
          {body}
          <button type="button" className="wconvert-style-shortcut" onClick={() => setHalf('style')}>
            {__('Edit appearance', 'wconvert')}
            <ChevronRight aria-hidden="true" className="rtl:-scale-x-100" />
          </button>
          {onShowLayers && (
            <button type="button" className="wconvert-linkish" onClick={onShowLayers}>
              <Layers aria-hidden="true" />
              {__('Show in Layers', 'wconvert')}
            </button>
          )}
        </TabsContent>
        <TabsContent value="style">
          {styleSettings.length > 0 && (
            <section className="wconvert-group" aria-label={__('Element appearance', 'wconvert')}>
              <h5 className="wconvert-group__name">{__('Element appearance', 'wconvert')}</h5>
              {styleSettings.map((setting) => (
                <ParamChoice
                  key={setting.param}
                  id={`${slot.type}-style-${setting.param}`}
                  label={nameOf(labels.nodeParams, `${slot.type}.${setting.param}`)}
                  offered={setting.offered}
                  held={setting.held}
                  fallback={setting.fallback}
                  nameOfValue={(choice) =>
                    nameOf(labels.nodeParamValues, `${slot.type}.${setting.param}.${choice}`)
                  }
                  columns={slot.type === 'image' && ['fit', 'shape'].includes(setting.param) ? 2 : undefined}
                  renderChoice={slot.type === 'image' && setting.param === 'fit'
                    ? choice => <ImageFitPreview fit={choice} src={slot.values.src} />
                    : slot.type === 'image' && setting.param === 'shape'
                      ? choice => <ImageShapePreview shape={choice} src={slot.values.src} /> : undefined}
                  onChange={(value) =>
                    onChange({ ...template, tree: withValue(template.tree, path, setting.param, value) })
                  }
                />
              ))}
            </section>
          )}
          {look}
        </TabsContent>
      </div>
    </Tabs>
  );
}

function contentBody({
  template,
  labels,
  path,
  block,
  slot,
  onChange,
  endsAt,
  onSetEndDate,
  onPlacement,
}: {
  template: Template;
  labels: TemplateLabels;
  path: Path;
  block: { readonly type: string; readonly level: number };
  slot: Slot | null;
  onChange: (template: Template, coalesce?: string) => void;
  endsAt?: string;
  onSetEndDate?: () => void;
  onPlacement?: () => void;
}) {
  const node = nodeAt(template.tree, path) as { action?: string; submission?: string } | null;
  if (block.type === 'products') {
    if (!commerceSupported()) return <p>{unlessFree(sprintf(
      /* translators: %s: the product that includes product suggestions, e.g. “WConvert Pro”. */
      __('Product suggestions are included with %s and need WooCommerce on this site.', 'wconvert'), tierProductName('pro')))}</p>;
    const selected = nodeAt(template.tree, path) as ProductsNode;
    return <RecommendationSettings value={selected} onPlacement={onPlacement} onChange={patch => {
      let tree = template.tree;
      for (const [key, value] of Object.entries(patch)) tree = withValue(tree, path, key, value);
      onChange({ ...template, tree });
    }} />;
  }
  if (block.type === 'question' && !journeysSupported()) {
    return <p className="text-note text-muted-foreground">{__('This design uses elements this site can’t display.', 'wconvert')}</p>;
  }
  if (block.type === 'question') {
    return <QuestionSettings tree={template.tree} step={Number(path[0])} onChange={tree => onChange({ ...template, tree })} onSelect={() => undefined} />;
  }
  return (
    <>
      {['field', 'consent'].includes(block.type) && <CaptureOwnership tree={template.tree} path={path} onChange={tree => onChange({ ...template, tree })} />}
      {block.type === 'button' && ['submit', 'skip'].includes(node?.action ?? '') && <label className="wconvert-slot__key">
        {__('Form', 'wconvert')}
        <select value={node?.submission ?? ''} onChange={e => onChange({ ...template, tree: withValue(template.tree, path, 'submission', e.target.value) })}>
          <option value="">{__('Choose a form', 'wconvert')}</option>
          {template.tree.submissions.filter(s => node?.action !== 'skip' || !s.required).map((s, index) => <option key={s.id} value={s.id}>
            {template.tree.steps[submissionScreen(template.tree, s.id)]?.name ?? sprintf(__('Form %d', 'wconvert'), index + 1)}
          </option>)}
        </select>
      </label>}
      {slot === null ? (
        <>
          <div className="wconvert-layout-params">
            {block.type === 'split' && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() =>
                  onChange({ ...template, tree: withSwappedPanes(template.tree, path) })
                }>
                  <ArrowLeftRight aria-hidden="true" />
                  {__('Swap sides', 'wconvert')}
                </Button>
                <p className="description">{__('Swaps this screen’s two panes, including their order when stacked on mobile.', 'wconvert')}</p>
              </>
            )}
            <LayoutParams
              type={block.type}
              labels={labels}
              onParam={(key, value) =>
                onChange({ ...template, tree: withValue(template.tree, path, key, value) })
              }
              valueOf={(key) => (nodeAt(template.tree, path) as Record<string, unknown> | null)?.[key]}
            />
          </div>
        </>
      ) : (
        <SlotFields
          key={path.join('.')}
          slot={{
            ...slot,
            settings: slot.settings.filter((setting) => !STYLE_PARAMS.includes(setting.param)),
          }}
          labels={labels}
          onSentence={(value, typing) => {
            let tree = template.tree;
            for (const key of ['text', 'emphasis', 'italic', 'link'] as const) {
              if (slot.keys.includes(key)) tree = withValue(tree, slot.path, key, value[key]);
            }
            onChange({ ...template, tree }, typing ? typingKey(slot.path, 'sentence') : undefined);
          }}
          onValue={(key, value) =>
            onChange(
              { ...template, tree: withValue(template.tree, slot.path, key, value) },
              typingKey(slot.path, key),
            )
          }
          endsAt={endsAt}
          onSetEndDate={onSetEndDate}
          onParam={(param, value) =>
            onChange({ ...template, tree: withValue(template.tree, slot.path, param, value) })
          }
          onHidden={(hidden) => onChange({ ...template, tree: withHidden(template.tree, slot.path, hidden) })}
        />
      )}
    </>
  );
}

function LayoutParams({
  type,
  labels,
  valueOf,
  onParam,
}: {
  type: string;
  labels: TemplateLabels;
  valueOf: (key: string) => unknown;
  onParam: (key: string, value: unknown) => void;
}) {
  const declared = LAYOUTS[type];

  const params: readonly string[] = (declared?.params ?? []).filter(
    (param) => (declared?.choices?.[param] ?? []).length > 0,
  );

  return (
    <>
      {params.map((param: string) => (
        <ParamChoice
          key={param}
          id={`${type}-${param}`}
          label={nameOf(labels.layoutParams, `${type}.${param}`)}
          offered={declared?.choices?.[param] ?? []}
          held={valueOf(param)}
          fallback={declared?.defaults?.[param]}
          nameOfValue={(choice) => nameOf(labels.layoutParamValues, `${type}.${param}.${choice}`)}
          compact={type === 'panel' && param === 'edges'}
          columns={(type === 'split' && param === 'ratio') || (type === 'panel' && param === 'edges') ? 3 : undefined}
          renderChoice={type === 'split' && param === 'ratio'
            ? choice => <SplitRatioPreview ratio={choice} />
            : type === 'panel' && param === 'edges' ? choice => <BorderPreview edges={choice} /> : undefined}
          onChange={(value) => onParam(param, value)}
        />
      ))}
    </>
  );
}

const STYLE_PARAMS = ['size', 'level', 'shape', 'fit', 'place'];

export const typingKey = (path: Path, key: string): string => `text:${path.join('.')}:${key}`;

function SwapMenu({
  template,
  labels,
  path,
  act,
  onSwap,
}: {
  template: Template;
  labels: TemplateLabels;
  path: Path;
  act: ConvertingAct;
  onSwap: (template: Template, said: string) => void;
}) {
  const name = swapNameOf(template.tree, path);
  const swaps = swapsFor(template.tree, path, act);

  if (name === null || swaps.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="xs" className="wconvert-inspector__swap">
          <ArrowLeftRight aria-hidden="true" />
          {name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-xs">
        {swaps.map((swap) => {
          const said = swapLabel(template.tree, path, swap.to, labels);

          return (
            <DropdownMenuItem
              key={swap.to}
              disabled={swap.refused !== null || swap.current}
              className="flex-col items-start gap-0.5"
              onSelect={() =>
                onSwap(
                  { ...template, tree: withSwapped(template.tree, path, swap.to, act, labels) },
                  swapSaid(said),
                )
              }
            >
              <span className="flex items-center gap-2">
                {swap.current ? <Check aria-hidden="true" /> : <span className="size-4" aria-hidden="true" />}
                {said}
              </span>

              {swap.refused !== null && (
                <span className="text-micro font-normal tracking-normal text-pretty whitespace-normal text-muted-foreground">
                  {swap.refused}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
