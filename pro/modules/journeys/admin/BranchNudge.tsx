import { __ } from '@wordpress/i18n';
import type { TemplateTree } from '@renderer/types';
import { walkNodes } from '@/builder/structure/journey';

/** The Flow map's way from a straight campaign to its first answer line. */
export function BranchNudge({ tree, onBranch }: { tree: TemplateTree; onBranch(): void }) {
  const hasChoiceQuestion = tree.steps.some(item => walkNodes(item.content).some(node => node.type === 'question' && 'answer_type' in node && node.answer_type !== 'text'));
  return hasChoiceQuestion ? <button type="button" className="wconvert-panel-link" onClick={onBranch}>{__('Send some answers to a different screen', 'wconvert-pro')}</button>
    : <span>{__('Add a question to send answers to different screens.', 'wconvert-pro')}</span>;
}
