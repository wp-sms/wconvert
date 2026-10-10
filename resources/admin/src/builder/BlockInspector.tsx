import { RecommendationSettings } from './RecommendationSettings';
import type { ProductsNode } from '@renderer/types';
import { journeysSupported, commerceSupported } from '../settings';
import { tierProductName, unlessFree } from '../goals/availability';
import { cloneElement, isValidElement, useId, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeftRight, Check, CircleHelp, Eye, EyeOff, Heading, Image, Layers, LayoutPanelLeft, Link, Mail, Minus, Package, Phone, RectangleHorizontal, Sparkles, SquareCheck, Star, Tag, Text, TextCursorInput, Ticket, Timer, Type, User, type LucideIcon } from 'lucide-react';
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
import { SlotFields, buttonActionOf, buttonDoes } from './SlotFields';
import { PanelField, PanelHeader, PanelHint, PanelSection } from './PanelSection';
import { DesignColors } from './ColorField';
import { nameOfBlock } from './BlockRow';
import { LAYOUTS, resolvedToken, slotsOf, withHidden, withValue, type Path, type Slot } from './panel';
import { nodeAt, nodesOf, samePath, withSwappedPanes } from './structure/tree';
import { swapLabel, swapNameOf, swapSaid, swapsFor, withSwapped } from './structure/swap';
import type { ConvertingAct } from './structure/catalogue';
import { QuestionSettings } from './JourneySettings';
import { useQuestionPanel } from './ScreenPanel';
import { AdvancedContext, AdvancedToggle } from './advanced';
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
  /**
   * Back to the screen this element is on: the header's "← <screen>" (D2).
   * The element panel is the only panel while an element is open, so this is
   * the one way back — never a second "Design" crumb beside it.
   */
  readonly onBack?: () => void;
  readonly onDesign?: () => void;
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
  onBack,
  onDesign,
  revealContent,
}: BlockInspectorProps) {
  const heading = useId();
  const questionPanel = useQuestionPanel();

  const [half, setHalf] = useState('content');
  // The Style tab's one Advanced switch (ADR 0135): exact values, units, hex, heading level.
  const [advanced, setAdvanced] = useState(false);
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
  const ownSections = block.type === 'products' || (block.type === 'question' && questionPanel !== null);
  const content = block.type === 'question' && questionPanel !== null ? questionPanel(Number(path[0])) : contentBody({
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
  // Products and the question draw their own sections; everything else is one untitled section.
  const body = ownSections ? content : <PanelSection>{content}</PanelSection>;

  // The innermost box this element sits in is the caption ("In Colored box");
  // the tree already shows the rest of the way there (ADR 0136).
  const boxes = nodesOf(template.tree).filter(
    (parent) => parent.path.length > 1 && parent.path.length < path.length && parent.path.every((part, index) => path[index] === part),
  );
  const box = boxes[boxes.length - 1];
  const node = nodeAt(template.tree, path) as { answer_type?: string; options?: readonly unknown[]; captures?: string } | null;
  const caption = block.type === 'button' && slot !== null ? buttonDoes(buttonActionOf(slot))
    : block.type === 'question' ? sprintf(/* translators: 1: an answer type, e.g. “Choose one”. 2: how many choices. */ __('%1$s · %2$d choices', 'wconvert'),
      node?.answer_type === 'multi' ? __('Choose several', 'wconvert') : node?.answer_type === 'text' ? __('Short answer', 'wconvert') : __('Choose one', 'wconvert'), node?.options?.length ?? 0)
    : box ? sprintf(/* translators: %s: a box's name, e.g. “Colored box”. */ __('In %s', 'wconvert'), nameOfBlock(box, labels)) : null;
  const screenName = template.tree.steps[Number(path[0])]?.name ?? '';
  // Back to the screen where there is one to go back to; the Design tab's
  // inspector goes back to the whole design, and says so.
  const back = onBack ?? onDesign;
  const backTo = onBack !== undefined ? screenName || __('Screen', 'wconvert') : __('Design', 'wconvert');
  const hidden = slot?.hidden ?? block.hidden;
  const Icon = elementIconOf(block.type, slot?.captures ?? null, block.leaf);
  const head = (
    <div className="wconvert-inspector__head">
      <PanelHeader
        back={back !== undefined ? { label: backTo, onClick: back } : undefined}
        icon={<Icon />}
        title={<h4 id={heading} className="wconvert-inspector__name">{name}</h4>}
        caption={caption}
        actions={<>
          <SwapMenu template={template} labels={labels} path={path} act={act} onSwap={onSwap} />
          {/* Shown or hidden is the header's eye (ADR 0136), not a checkbox at the foot of Content. */}
          {slot?.hideable && <button type="button" aria-pressed={!hidden}
            aria-label={hidden ? sprintf(__('%s is hidden. Show it', 'wconvert'), name) : sprintf(__('%s is shown. Hide it', 'wconvert'), name)}
            title={hidden ? __('Hidden. Show it', 'wconvert') : __('Shown. Hide it', 'wconvert')}
            onClick={() => onChange({ ...template, tree: withHidden(template.tree, path, !hidden) })}>
            {hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>}
        </>}
      />
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

  const advancedToggle = <AdvancedToggle advanced={advanced} onToggle={() => setAdvanced((value) => !value)} />;
  const shownStyleSettings = styleSettings.filter((setting) => advanced || !ADVANCED_PARAMS.includes(setting.param));
  // The element's own looks (Size, Heading level) lead the Style tab under their own labels (ADR 0136).
  const ownStyle = slot !== null && shownStyleSettings.length > 0 ? <PanelSection label={sprintf(__('%s style', 'wconvert'), name)}>
    {shownStyleSettings.map((setting) => (
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
  </PanelSection> : null;
  const colors = ['bg', 'fg', 'muted', 'accent', 'accent-fg', 'border', 'input-bg'].map(token => resolvedToken(template.tokens, token));
  const style = isValidElement<StyleSlots>(look) ? cloneElement(look, { lead: ownStyle, footerEnd: advancedToggle }) : look;

  if (look === undefined || slot === null) {
    return (
      <div role="group" aria-labelledby={heading} className="wconvert-inspector">
        {head}
        <div className="wconvert-inspector__body">
          {body}
          {look !== undefined && <AdvancedContext.Provider value={advanced}><DesignColors.Provider value={colors}>
            {style}
          </DesignColors.Provider></AdvancedContext.Provider>}
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
        </TabsContent>
        <TabsContent value="style">
          <AdvancedContext.Provider value={advanced}><DesignColors.Provider value={colors}>
            {style}
          </DesignColors.Provider></AdvancedContext.Provider>
        </TabsContent>
      </div>
    </Tabs>
  );
}

/** The slots {@see ScopeStyle} offers the element panel: its own looks first, Advanced at the foot. */
interface StyleSlots { lead?: ReactNode; footerEnd?: ReactNode }

/** An element's kind as its icon (ADR 0136): a headline is not a "T" like everything else. */
function elementIconOf(type: string, captures: string | null, leaf: boolean): LucideIcon {
  if (!leaf) return type === 'split' ? LayoutPanelLeft : Layers;
  if (type === 'field') return captures === 'email' ? Mail : captures === 'phone' ? Phone : captures === 'name' ? User : TextCursorInput;
  const icons: Readonly<Record<string, LucideIcon>> = {
    heading: Heading, eyebrow: Type, text: Text, badge: Tag, rating: Star, image: Image, icon: Sparkles, divider: Minus,
    countdown: Timer, code: Ticket, question: CircleHelp, button: RectangleHorizontal, consent: SquareCheck, followup: Link, products: Package,
  };
  return icons[type] ?? Type;
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
    if (!commerceSupported()) return <PanelSection><PanelHint>{unlessFree(sprintf(
      /* translators: %s: the product that includes product suggestions, e.g. “WConvert Pro”. */
      __('Product suggestions are included with %s and need WooCommerce on this site.', 'wconvert'), tierProductName('pro')))}</PanelHint></PanelSection>;
    const selected = nodeAt(template.tree, path) as ProductsNode;
    return <RecommendationSettings value={selected} onPlacement={onPlacement} onChange={patch => {
      let tree = template.tree;
      for (const [key, value] of Object.entries(patch)) tree = withValue(tree, path, key, value);
      onChange({ ...template, tree });
    }} />;
  }
  if (block.type === 'question' && !journeysSupported()) {
    return <PanelHint>{__('This design uses elements this site can’t display.', 'wconvert')}</PanelHint>;
  }
  if (block.type === 'question') {
    return <QuestionSettings tree={template.tree} step={Number(path[0])} onChange={tree => onChange({ ...template, tree })} onSelect={() => undefined} />;
  }
  return (
    <>
      {['field', 'consent'].includes(block.type) && <CaptureOwnership tree={template.tree} path={path} onChange={tree => onChange({ ...template, tree })} />}
      {block.type === 'button' && ['submit', 'skip'].includes(node?.action ?? '') && <PanelField label={__('Form', 'wconvert')} htmlFor={`form-${path.join('-')}`}>
        <select id={`form-${path.join('-')}`} value={node?.submission ?? ''} onChange={e => onChange({ ...template, tree: withValue(template.tree, path, 'submission', e.target.value) })}>
          <option value="">{__('Choose a form', 'wconvert')}</option>
          {template.tree.submissions.filter(s => node?.action !== 'skip' || !s.required).map((s, index) => <option key={s.id} value={s.id}>
            {template.tree.steps[submissionScreen(template.tree, s.id)]?.name ?? sprintf(__('Form %d', 'wconvert'), index + 1)}
          </option>)}
        </select>
      </PanelField>}
      {slot === null ? (
        <>
          <div className="wconvert-layout-params">
            {block.type === 'split' && (
              <>
                <Button type="button" variant="outline" size="sm" className="justify-self-start"
                  title={__('Swaps the two panes, including their order when stacked on mobile.', 'wconvert')}
                  onClick={() => onChange({ ...template, tree: withSwappedPanes(template.tree, path) })}>
                  <ArrowLeftRight aria-hidden="true" />
                  {__('Swap sides', 'wconvert')}
                </Button>
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
/** A heading's level is for screen readers and search, not for looks: Advanced. Size is the plain control. */
const ADVANCED_PARAMS = ['level'];

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
        <button type="button" className="wconvert-inspector__swap" aria-label={name} title={name}>
          <ArrowLeftRight aria-hidden="true" />
        </button>
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
