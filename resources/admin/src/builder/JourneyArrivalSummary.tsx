import { __, _n, sprintf } from '@wordpress/i18n';
import { Disclosure } from '../shell/Disclosure';
import type { TemplateTree } from '@renderer/types';
import { conditionText } from './structure/conditionText';

/** Incoming connections explain how this screen is reached, separately from
 * the screen's own visibility condition. They do not predict a complete visit. */
export function JourneyArrivalSummary({ tree, step, onSelectPath }: {
  tree: TemplateTree; step: number; onSelectPath(index: number, priority: number | 'hidden'): void;
}) {
  const graph = tree.graph, screen = tree.steps[step];
  if (!graph || !screen) return null;
  if (screen.id === graph.entry) return <p className="wconvert-journey-arrival__entry">{__('First screen · visitors start here when display rules match.', 'wconvert')}</p>;
  const incoming = graph.edges.filter(edge => edge.to === screen.id);
  if (!incoming.length) return null;
  const sources = new Set(incoming.map(edge => edge.from));
  return <Disclosure variant="inline" className="wconvert-journey-arrival" key={screen.id}
    title={sources.size === 1 ? sprintf(__('Arrives from %s', 'wconvert'), tree.steps.find(item => item.id === incoming[0].from)?.name ?? __('Removed screen', 'wconvert'))
      : sprintf(_n('Arrives from %d screen', 'Arrives from %d screens', sources.size, 'wconvert'), sources.size)}>
    <p>{__('Review the incoming paths. Earlier answer paths are checked first; this screen’s “Show only if…” is checked on arrival.', 'wconvert')}</p>
    <ul>{incoming.map(edge => {
      const from = tree.steps.findIndex(item => item.id === edge.from);
      if (from < 0) return null;
      const answers = graph.edges.filter(item => item.from === edge.from && item.kind === 'answer');
      const priority = edge.kind === 'hidden' ? 'hidden' : edge.kind === 'default' ? answers.length : answers.findIndex(item => item.id === edge.id);
      const rule = edge.kind === 'hidden' ? __('When that screen is skipped', 'wconvert')
        : edge.kind === 'default' ? answers.length ? __('All other answers', 'wconvert') : __('After completing that screen', 'wconvert')
          : sprintf(__('Path %1$d: %2$s', 'wconvert'), Number(priority) + 1, edge.when ? conditionText(tree, edge.when) : __('Choose a condition', 'wconvert'));
      return <li key={edge.id}><button type="button" onClick={() => onSelectPath(from, priority)}><strong><bdi>{tree.steps[from].name}</bdi></strong><span>{rule}</span></button></li>;
    })}</ul>
  </Disclosure>;
}
