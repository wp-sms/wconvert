import { __, sprintf } from '@wordpress/i18n';
import { Disclosure } from '../shell/Disclosure';
import type { TemplateTree } from '@renderer/types';
import { nodesOf, nodeAt } from './structure/tree';
import { withValue } from './panel';

/** Edit existing content in place: preserve layout, IDs, tokens and button actions. */
export function JourneyScreenContent({ tree, step, onChange }: {
  tree: TemplateTree; step: number; onChange(next: TemplateTree, coalesce?: string): void;
}) {
  if (tree.steps[step].kind === 'result') return null;
  const screenBlocks = nodesOf(tree).filter(block => block.path[0] === step);
  const blocks = screenBlocks.filter(block => ['heading', 'text', 'button'].includes(block.type)
    && !screenBlocks.some(ancestor => ancestor.hidden && ancestor.path.every((part, index) => block.path[index] === part)));
  const counts = new Map<string, number>();
  const hasQuestions = nodesOf(tree).some(block => block.path[0] === step && block.type === 'question');
  const content = <section className="wconvert-journey-settings wconvert-journey-copy" aria-label={__('Screen content', 'wconvert')}>
    {blocks.map(block => {
      const node = nodeAt(tree, block.path)!;
      const button = node.type === 'button';
      // Slot-formatted prose keeps its complete editor on the element; do not expose raw placeholders.
      if (node.type === 'text' && 'text' in node && /%[lsbi]/.test(String(node.text))) return <p key={block.path.join('.')}>
        {__('This message contains formatted text or links. Select it on the canvas to edit it with its formatting.', 'wconvert')}</p>;
      const label = button ? 'action' in node && node.action === 'back' ? __('Back button text', 'wconvert')
        : 'action' in node && node.action === 'skip' ? __('Skip button text', 'wconvert') : __('Button text', 'wconvert')
        : node.type === 'heading' ? __('Heading', 'wconvert') : __('Message', 'wconvert');
      const count = (counts.get(label) ?? 0) + 1; counts.set(label, count);
      const key = button ? 'label' : 'text';
      const value = key in node ? String((node as unknown as Record<string, unknown>)[key] ?? '') : '';
      return <label key={block.path.join('.')}>{count > 1 ? sprintf(__('%1$s %2$d', 'wconvert'), label, count) : label}
        <textarea rows={button ? 1 : node.type === 'heading' ? 2 : 3} value={value}
          onChange={event => onChange(withValue(tree, block.path, key, event.target.value), `journey:${tree.steps[step].id}:copy:${block.path.join('.')}`)} />
      </label>;
    })}
  </section>;
  return hasQuestions ? <Disclosure variant="inline" className="wconvert-journey-copy-options" title={__('Heading, message & buttons', 'wconvert')}>{content}</Disclosure> : content;
}
