import { memo, useEffect, useRef } from 'react';
import { Handle, Position, useStore, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { __, sprintf } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { followupGroupSource, type FollowupGroup } from './structure/followupGroups';
import { followupLabel } from './structure/followupLabel';

export interface FollowupGroupData {
  incomingPorts?: string[]; detourEntry?: boolean; detourTarget?: string; tree: TemplateTree; group: FollowupGroup; rtl: boolean; unreachable?: boolean; muted?: boolean; selected: number | null; samplePath: readonly number[] | null;
  select(index: number): void; expand(group: FollowupGroup): void;
}

export const FollowupGroupCard = memo(function FollowupGroupCard({ id, data }: NodeProps) {
  const { incomingPorts = [], detourEntry, detourTarget, tree, group, rtl, unreachable, muted, selected, samplePath, select, expand } = data as unknown as FollowupGroupData;
  const updateInternals = useUpdateNodeInternals();
  const portKey = incomingPorts.join(',');
  useEffect(() => { updateInternals(id); }, [id, detourEntry, detourTarget, portKey, updateInternals]);
  const source = followupGroupSource(tree, group);
  const title = source === undefined ? __('Follow-up questions', 'wconvert') : sprintf(__('Follow-ups: %s', 'wconvert'), tree.steps[source].name);
  const overview = useStore(state => state.transform[2] < .65);
  const selectedButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { selectedButton.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }, [selected]);
  return <section dir={rtl ? 'rtl' : 'ltr'} className={`wconvert-followup-group${unreachable ? ' is-unreachable' : ''}${muted ? ' is-muted' : ''}${overview ? ' is-overview' : ''}`} aria-label={title}>
    {overview && <button type="button" className="wconvert-flow-node__overview nodrag" onClick={() => expand(group)}>
      <small>{sprintf(__('%d relevant follow-ups', 'wconvert'), group.screens.length)}</small><strong>{title}</strong>
      <span>{unreachable ? __('Unreachable', 'wconvert') : samplePath ? sprintf(__('%1$d of %2$d shown', 'wconvert'), group.screens.filter(index => samplePath.includes(index)).length, group.screens.length) : __('Skip those that do not match', 'wconvert')}</span>
    </button>}
    {incomingPorts.length < 2 ? <Handle id="in" type="target" position={rtl ? Position.Right : Position.Left} isConnectable={false} />
      : incomingPorts.map((edge, at) => <Handle key={edge} id={`in:${edge}`} type="target" position={rtl ? Position.Right : Position.Left} isConnectable={false}
        style={{ top: `calc(50% + ${(at - (incomingPorts.length - 1) / 2) * Math.min(18, 80 / incomingPorts.length)}px)` }} />)}
    {detourEntry && <Handle id="detour-in" type="target" position={Position.Top} isConnectable={false} />}
    <header><strong>{title}</strong><span>{samplePath === null ? sprintf(__('%d screens', 'wconvert'), group.screens.length)
      : sprintf(__('%1$d of %2$d shown', 'wconvert'), group.screens.filter(index => samplePath.includes(index)).length, group.screens.length)}</span></header>
    <p>{unreachable ? __('Unreachable — connect an incoming path to show these screens.', 'wconvert') : __('Ask every match, one at a time. Skip the rest.', 'wconvert')}</p>
    <ol className="nodrag nopan nowheel">{group.screens.map(index => <li key={tree.steps[index].id} className={samplePath !== null && !samplePath.includes(index) ? 'is-muted' : ''}>
      <button ref={selected === index ? selectedButton : undefined} type="button" className="nodrag" aria-pressed={selected === index} onClick={() => select(index)}>
        <span className="wconvert-followup-group__answer">{followupLabel(tree, tree.steps[index].when!)}</span><strong><bdi>{tree.steps[index].name}</bdi></strong>
        {samplePath !== null && <small>{samplePath.includes(index) ? __('Shown for these answers', 'wconvert') : __('Skipped for these answers', 'wconvert')}</small>}
      </button>
    </li>)}</ol>
    <footer><span>{sprintf(__('Then: %s', 'wconvert'), tree.steps.find(screen => screen.id === group.next)?.name ?? group.next)}</span>
      <button type="button" className="nodrag" onClick={() => expand(group)}>{__('Edit individual connections', 'wconvert')}</button>
    </footer>
    <Handle id={detourTarget ? "detour-out" : "out"} type="source" position={detourTarget ? Position.Bottom : rtl ? Position.Left : Position.Right} isConnectable={false} />
  </section>;
});
