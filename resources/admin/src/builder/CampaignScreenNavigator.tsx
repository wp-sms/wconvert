import { __, _n, sprintf } from '@wordpress/i18n';
import { CircleHelp, FileText, Flag, GitBranch, Mail, Sparkles } from 'lucide-react';
import type { TemplateTree } from '@renderer/types';
import { graphDisplayOrder } from './structure/graph';
import { followupGroups, followupGroupSource } from './structure/followupGroups';
import { conditionText } from './structure/conditionText';
import { followupLabel } from './structure/followupLabel';
import { walkNodes, unreachableScreenIds } from './structure/journey';

/** Navigation is an inventory, not a claim that every visitor sees every screen. */
export function CampaignScreenNavigator({ tree, step, onSelect, onFlow }: {
  tree: TemplateTree; step: number; onSelect(index: number): void; onFlow(): void;
}) {
  const groups = followupGroups(tree);
  const unreachable = new Set(unreachableScreenIds(tree));
  const owners = new Map(groups.flatMap(group => { const source = followupGroupSource(tree, group); return source === undefined ? [] : [[group.id, source] as const]; }));
  const item = (index: number, nested = false) => {
    const screen = tree.steps[index];
    const nodes = walkNodes(screen.content);
    const branches = tree.graph?.edges.filter(edge => edge.from === screen.id && edge.kind === 'answer').length ?? Math.max(0, (screen.paths?.length ?? 1) - 1);
    const incoming = tree.graph?.edges.filter(edge => edge.to === screen.id) ?? [];
    const path = incoming.length === 1 && incoming[0].kind !== 'hidden' && tree.graph?.edges.some(edge => edge.from === incoming[0].from && edge.kind === 'answer') ? incoming[0] : undefined;
    const Icon = screen.kind === 'result' ? Sparkles : screen.kind === 'acknowledgement' ? Flag
      : nodes.some(node => node.type === 'field') ? Mail : nodes.some(node => node.type === 'question') ? CircleHelp : FileText;
    return <button type="button" key={screen.id} aria-current={step === index ? 'true' : undefined} onClick={() => onSelect(index)}>
      <Icon aria-hidden="true" size={16} /><span>
        {path && <small className="wconvert-campaign-screens__path">{path.kind === 'answer' && path.when ? followupLabel(tree, path.when) : __('Everyone else', 'wconvert')}</small>}
        {nested && screen.when && <small className="wconvert-campaign-screens__answer">{followupLabel(tree, screen.when)}</small>}
        <strong>{screen.name}</strong>
        {unreachable.has(screen.id) ? <small>{__('Not connected', 'wconvert')}</small> : screen.when && !nested ? <small>{conditionText(tree, screen.when)}</small>
          : screen.id === (tree.graph?.entry ?? tree.steps[0].id) ? <small>{__('First screen', 'wconvert')}</small> : null}
        {branches > 0 && <small><GitBranch aria-hidden="true" size={12} />{__('Only one path is followed', 'wconvert')}</small>}
      </span>
    </button>;
  };
  const renderGroup = (group: typeof groups[number]) => <section key={group.id} aria-label={sprintf(__('Follow-ups: %s', 'wconvert'), owners.has(group.id) ? tree.steps[owners.get(group.id)!].name : tree.steps[group.screens[0]].name)}>
    <details open={group.screens.includes(step) || owners.get(group.id) === step}><summary><strong>{sprintf(_n('%d follow-up question', '%d follow-up questions', group.screens.length, 'wconvert'), group.screens.length)}</strong><small>{__('Ask every match, one at a time.', 'wconvert')}</small></summary>
    {group.screens.map(index => item(index, true))}
    <p>{sprintf(__('Then: %s', 'wconvert'), tree.steps.find(screen => screen.id === group.next)?.name ?? '')}</p></details>
  </section>;
  return <nav className="wconvert-campaign-screens" aria-label={__('Campaign screens', 'wconvert')}>
    <div className="wconvert-campaign-screens__heading"><strong>{__('Screens', 'wconvert')}</strong><button type="button" onClick={onFlow}>{__('View flow', 'wconvert')}</button></div>
    <div className="wconvert-campaign-screens__items">{graphDisplayOrder(tree).map(index => {
      const group = groups.find(candidate => candidate.screens.includes(index));
      if (group) return !owners.has(group.id) && group.screens[0] === index ? renderGroup(group) : null;
      return <div key={tree.steps[index].id}>{item(index)}{groups.filter(candidate => owners.get(candidate.id) === index).map(renderGroup)}</div>;
    })}</div>
  </nav>;
}
