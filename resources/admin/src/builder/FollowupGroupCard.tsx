import { memo, useEffect, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { __, sprintf } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import type { FollowupGroup } from './structure/followupGroups';
import { conditionText } from './structure/conditionText';

export interface FollowupGroupData {
  tree: TemplateTree; group: FollowupGroup; rtl: boolean; selected: number | null; samplePath: readonly number[] | null;
  select(index: number): void; expand(group: FollowupGroup): void;
}

export const FollowupGroupCard = memo(function FollowupGroupCard({ data }: NodeProps) {
  const { tree, group, rtl, selected, samplePath, select, expand } = data as unknown as FollowupGroupData;
  const selectedButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { selectedButton.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }, [selected]);
  return <section className="wconvert-followup-group" aria-label={__('Relevant follow-ups', 'wconvert')}>
    <Handle id="in" type="target" position={rtl ? Position.Right : Position.Left} isConnectable={false} />
    <header><strong>{__('Relevant follow-ups', 'wconvert')}</strong><span>{samplePath === null ? sprintf(__('%d screens', 'wconvert'), group.screens.length)
      : sprintf(__('%1$d of %2$d shown', 'wconvert'), group.screens.filter(index => samplePath.includes(index)).length, group.screens.length)}</span></header>
    <p>{__('Show every matching screen, in this order.', 'wconvert')}</p>
    <ol className="nodrag nopan nowheel">{group.screens.map(index => <li key={tree.steps[index].id} className={samplePath !== null && !samplePath.includes(index) ? 'is-muted' : ''}>
      <button ref={selected === index ? selectedButton : undefined} type="button" className="nodrag" aria-pressed={selected === index} onClick={() => select(index)}>
        <strong>{tree.steps[index].name}</strong><span>{conditionText(tree, tree.steps[index].when!)}</span>
        {samplePath !== null && <small>{samplePath.includes(index) ? __('Shown for these answers', 'wconvert') : __('Skipped for these answers', 'wconvert')}</small>}
      </button>
    </li>)}</ol>
    <footer><span>{sprintf(__('Then: %s', 'wconvert'), tree.steps.find(screen => screen.id === group.next)?.name ?? group.next)}</span>
      <button type="button" className="nodrag" onClick={() => expand(group)}>{__('Expand screens', 'wconvert')}</button>
    </footer>
    <Handle id="out" type="source" position={rtl ? Position.Left : Position.Right} isConnectable={false} />
  </section>;
});
