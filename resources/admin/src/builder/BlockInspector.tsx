import { useId, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeftRight, Check, ChevronRight, Layers, Type } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ParamChoice } from './ParamChoice';
import { SlotFields } from './SlotFields';
import { nameOfBlock, stepName } from './BlockRow';
import { LAYOUTS, slotsOf, withHidden, withValue, type Path, type Slot } from './panel';
import { nodeAt, nodesOf, samePath } from './structure/tree';
import { swapLabel, swapNameOf, swapSaid, swapsFor, withSwapped } from './structure/swap';
import type { ConvertingAct } from './structure/catalogue';
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

  readonly look?: ReactNode;
  readonly onSelect?: (path: Path) => void;
  readonly onDesign?: () => void;
  readonly onShowLayers?: () => void;
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
  look,
  onSelect,
  onDesign,
  onShowLayers,
}: BlockInspectorProps) {
  const heading = useId();

  const [half, setHalf] = useState('content');
  const block =
    path === null ? null : (nodesOf(template.tree).find((each) => samePath(each.path, path)) ?? null);
  const slot =
    path === null ? null : (slotsOf(template.tree).find((each) => samePath(each.path, path)) ?? null);
  const styleSettings = slot?.settings.filter((setting) => STYLE_PARAMS.includes(setting.param)) ?? [];

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
  const body = contentBody({
    template,
    labels,
    path,
    block,
    slot,
    onChange,
    endsAt,
    onSetEndDate,
  });

  const breadcrumbs = nodesOf(template.tree).filter(
    (parent) => parent.path.length < path.length && parent.path.every((part, index) => path[index] === part),
  );
  const head = (
    <div className="wconvert-inspector__head">
      <nav className="wconvert-inspector__breadcrumbs" aria-label={__('Selected element', 'wconvert')}>
        <button type="button" onClick={onDesign}>
          {__('Design', 'wconvert')}
        </button>
        {breadcrumbs.map((parent) => (
          <span key={parent.path.join('.')}>
            <ChevronRight aria-hidden="true" />
            <button type="button" onClick={() => onSelect?.(parent.path)}>
              {nameOfBlock(parent, labels)}
            </button>
          </span>
        ))}
      </nav>
      <div className="wconvert-inspector__heading">
        <span className="wconvert-element-icon">
          {block.leaf ? <Type aria-hidden="true" /> : <Layers aria-hidden="true" />}
        </span>
        <div>
          <h4 id={heading} className="wconvert-inspector__name">
            {name}
          </h4>
          <p>{stepName(Number(path[0]) + 1)}</p>
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
          {look}
          {body}
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
            <ChevronRight aria-hidden="true" />
          </button>
          {onShowLayers && (
            <button type="button" className="wconvert-linkish" onClick={onShowLayers}>
              <Layers aria-hidden="true" />
              {__('Show in Layers', 'wconvert')}
            </button>
          )}
        </TabsContent>
        <TabsContent value="style">
          {look}
          {styleSettings.length > 0 && (
            <details className="wconvert-style-advanced">
              <summary>{__('Element options', 'wconvert')}</summary>
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
                  onChange={(value) =>
                    onChange({ ...template, tree: withValue(template.tree, path, setting.param, value) })
                  }
                />
              ))}
            </details>
          )}
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
}: {
  template: Template;
  labels: TemplateLabels;
  path: Path;
  block: { readonly type: string; readonly level: number };
  slot: Slot | null;
  onChange: (template: Template, coalesce?: string) => void;
  endsAt?: string;
  onSetEndDate?: () => void;
}) {
  return (
    <>
      {slot === null ? (
        <>
          <div className="wconvert-layout-params">
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
            for (const key of ['text', 'emphasis', 'link'] as const) {
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
