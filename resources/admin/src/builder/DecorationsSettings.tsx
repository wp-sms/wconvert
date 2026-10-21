import { __ } from '@wordpress/i18n';
import type { Decorations, Template } from '@renderer/types';
import { nodesOf, nodeAt } from './structure/tree';
import { withValue } from './panel';
import { CheckRow } from '../shell/CheckRow';
import { PanelSection } from './PanelSection';

export function DecorationsSettings({ template, onChange }: { template: Template; onChange: (next: Template) => void }) {
  const groups = nodesOf(template.tree).flatMap(block => {
    const node = nodeAt(template.tree, block.path);
    const group: Decorations | undefined = node && (node.type === 'panel' || node.type === 'media') ? (node as { decorations?: Decorations }).decorations : undefined;
    return group?.items.length ? [{ path: block.path, group }] : [];
  });
  if (!groups.length) return null;
  return <PanelSection title={__('Decorations', 'wconvert')}>
    {groups.map(({ path, group }) => <CheckRow key={path.join('.')} label={group.label} checked={!group.hidden}
      onChange={event => onChange({ ...template, tree: withValue(template.tree, path, 'decorations', { ...group, hidden: !event.target.checked }) })} />)}
  </PanelSection>;
}
