import { useId } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { QuestionNode, TemplateTree } from '@renderer/types';
import { chooseResult, journeyTrace, type Answers } from '../../../../loader/src/journey-rules';
import { graphTrace } from '../../../../loader/src/journey-graph';
import { journeyTraceEdges } from '../structure/journeyTraceEdges';
import { walkNodes } from '../structure/journey';

export interface VisitorTrace {
  readonly screens: readonly number[];
  readonly edges: readonly string[];
  readonly skipped: readonly string[];
  readonly result?: { readonly screen: string; readonly id: string; readonly heading: string };
  readonly questions: readonly (QuestionNode & { id: string })[];
}

/**
 * Where one visitor goes, by the loader's own rules (ADR 0142): `graphTrace`
 * for a graph, `journeyTrace` for version 2. The map marks what it returns;
 * nothing here predicts beyond what those functions decide.
 */
export function visitorTrace(tree: TemplateTree, answers: Answers): VisitorTrace {
  const trace = tree.graph ? graphTrace(tree.steps, tree.graph, answers) : journeyTrace(tree.steps, answers);
  const skipped = 'hidden' in trace ? trace.hidden : trace.skips.filter(skip => skip.reason === 'condition').map(skip => tree.steps[skip.index]?.id).filter((id): id is string => !!id);
  const shown = trace.indices.map(index => tree.steps[index]);
  const resultScreen = shown.find(screen => screen.kind === 'result' && screen.results?.length);
  const result = resultScreen ? chooseResult(resultScreen.results!, trace.answers) : undefined;
  const questions = shown.flatMap(screen => walkNodes(screen.content))
    .filter((node): node is QuestionNode & { id: string } => node.type === 'question' && 'id' in node && typeof node.id === 'string' && node.answer_type !== 'text');
  return { screens: trace.indices, edges: journeyTraceEdges(tree, trace.decisions), skipped,
    ...(result && resultScreen ? { result: { screen: resultScreen.id, id: result.id, heading: result.heading } } : {}), questions };
}

/** Answer as a visitor, inside the map: one control per question they reach. */
export function FlowVisitor({ tree, answers, trace, onAnswers, onStop }: {
  tree: TemplateTree; answers: Answers; trace: VisitorTrace; onAnswers(next: Answers): void; onStop(): void;
}) {
  const id = useId();
  const name = (screen: string) => tree.steps.find(item => item.id === screen)?.name ?? '';
  return <div className="wconvert-flow-visitor" role="group" aria-labelledby={`${id}-title`}>
    <strong id={`${id}-title`}>{__('Answer as a visitor', 'wconvert')}</strong>
    <div className="wconvert-flow-visitor__questions">
      {trace.questions.map(question => question.answer_type === 'multi'
        ? <fieldset key={question.id}><legend><bdi>{question.label}</bdi> · {__('choose several', 'wconvert')}</legend>
          {question.options?.map(option => {
            const picked = Array.isArray(answers[question.id]) ? answers[question.id] as string[] : [];
            return <label key={option.value}><input type="checkbox" checked={picked.includes(option.value)} onChange={event => onAnswers({ ...answers,
              [question.id]: event.target.checked ? [...picked, option.value] : picked.filter(value => value !== option.value) })} /><bdi>{option.label}</bdi></label>;
          })}
        </fieldset>
        : <span key={question.id} className="wconvert-flow-visitor__field"><label htmlFor={`${id}-${question.id}`}><bdi>{question.label}</bdi></label>
          <select id={`${id}-${question.id}`} value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''} onChange={event => {
            const next = { ...answers };
            if (event.target.value) next[question.id] = event.target.value; else delete next[question.id];
            onAnswers(next);
          }}>
            <option value="">{__('No answer', 'wconvert')}</option>
            {question.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select></span>)}
    </div>
    <p role="status">{[sprintf(/* translators: %d: how many screens this visitor sees. */ __('Sees %d screens', 'wconvert'), trace.screens.length),
      ...(trace.skipped.length ? [sprintf(/* translators: %s: screen names. */ __('skips %s', 'wconvert'), trace.skipped.map(screen => `“${name(screen)}”`).join(', '))] : []),
      ...(trace.result ? [sprintf(/* translators: %s: a result's heading. */ __('result: %s', 'wconvert'), trace.result.heading)] : [])].join(' · ')}</p>
    <button type="button" className="wconvert-panel-link" onClick={onStop}>{__('Stop', 'wconvert')}</button>
  </div>;
}
